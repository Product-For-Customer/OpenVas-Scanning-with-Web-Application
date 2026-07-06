package webscan

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

// ===========================
// Global scan lock — only one web scan runs at a time across every target.
// Reason: every target shares the same ZAP daemon/session (see
// zapclient.NewSession's doc comment) — running two scans concurrently
// would mix their spider/alert state together unpredictably.
// ===========================

var scanMu sync.Mutex
var isScanning bool
var currentResultID uint

// ===========================
// Target CRUD
// ===========================

type targetInput struct {
	Name        string `json:"name" binding:"required"`
	URL         string `json:"url" binding:"required"`
	Description string `json:"description"`
	// AuthCookie: a session cookie copied from an admin's browser after
	// logging into the target manually (e.g. "session=abc123; other=xyz").
	// On update, an empty string means "leave the existing cookie
	// unchanged" (same masked-secret convention as the Gmail app-password
	// field elsewhere in this app) — there is no separate "clear it" action
	// via this field; delete and recreate the target for that.
	AuthCookie string `json:"auth_cookie"`
}

// targetResponse embeds the entity (whose AuthCookie field is already
// json:"-", so it's never at risk of being echoed back) and adds a computed
// boolean so the frontend can show "authenticated" without ever seeing the
// actual cookie value.
type targetResponse struct {
	entity.AppWebScanTarget
	HasAuthCookie bool `json:"has_auth_cookie"`
}

func toTargetResponse(t entity.AppWebScanTarget) targetResponse {
	return targetResponse{AppWebScanTarget: t, HasAuthCookie: strings.TrimSpace(t.AuthCookie) != ""}
}

func ListWebScanTargets(c *gin.Context) {
	db := config.DB()
	var targets []entity.AppWebScanTarget
	if err := db.Order("created_at DESC").Find(&targets).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	responses := make([]targetResponse, 0, len(targets))
	for _, t := range targets {
		responses = append(responses, toTargetResponse(t))
	}
	c.JSON(http.StatusOK, gin.H{"data": responses})
}

func CreateWebScanTarget(c *gin.Context) {
	var input targetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ValidateTargetURL(input.URL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	target := entity.AppWebScanTarget{
		Name:        strings.TrimSpace(input.Name),
		URL:         strings.TrimSpace(input.URL),
		Description: strings.TrimSpace(input.Description),
		AuthCookie:  strings.TrimSpace(input.AuthCookie),
	}

	db := config.DB()
	if err := db.Create(&target).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	// Deliberately does not include the cookie value in the audit detail.
	audit.Log(c, "webscan_target.created", "webscan_target", fmt.Sprintf("%d", target.ID), fmt.Sprintf("registered web scan target %s (%s)", target.Name, target.URL))
	c.JSON(http.StatusCreated, gin.H{"data": toTargetResponse(target)})
}

func UpdateWebScanTarget(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var target entity.AppWebScanTarget
	if err := db.First(&target, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var input targetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ValidateTargetURL(input.URL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	target.Name = strings.TrimSpace(input.Name)
	target.URL = strings.TrimSpace(input.URL)
	target.Description = strings.TrimSpace(input.Description)
	if trimmed := strings.TrimSpace(input.AuthCookie); trimmed != "" {
		target.AuthCookie = trimmed
	}

	if err := db.Save(&target).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "webscan_target.updated", "webscan_target", fmt.Sprintf("%d", target.ID), fmt.Sprintf("updated web scan target %s", target.Name))
	c.JSON(http.StatusOK, gin.H{"data": toTargetResponse(target)})
}

func DeleteWebScanTarget(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	scanMu.Lock()
	blockedByRunningScan := isScanning
	scanMu.Unlock()
	if blockedByRunningScan {
		c.JSON(http.StatusConflict, gin.H{"error": "a scan is currently running — wait for it to finish before deleting targets"})
		return
	}

	var target entity.AppWebScanTarget
	if err := db.First(&target, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if err := db.Delete(&target).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "webscan_target.deleted", "webscan_target", fmt.Sprintf("%d", id), fmt.Sprintf("deleted web scan target %s", target.Name))
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ===========================
// Scan lifecycle
// ===========================

type triggerScanInput struct {
	ScanType          string `json:"scan_type" binding:"required"` // "baseline" or "full"
	ConfirmActiveScan bool   `json:"confirm_active_scan"`
}

func TriggerWebScan(c *gin.Context) {
	targetIDRaw, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid target id"})
		return
	}
	targetID := uint(targetIDRaw)

	var input triggerScanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.ScanType != "baseline" && input.ScanType != "full" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scan_type must be \"baseline\" or \"full\""})
		return
	}
	// A "full" scan runs ZAP's Active Scan, which sends real attack payloads
	// (SQLi/XSS/etc. probes) against every discovered page and parameter —
	// this can have real side effects on a live application (duplicate form
	// submissions, WAF/IDS alerts, or breaking a fragile app). Requiring an
	// explicit flag here (checked server-side, not just a frontend confirm
	// dialog that could be skipped by calling the API directly) makes sure
	// this was a deliberate choice, not a default.
	if input.ScanType == "full" && !input.ConfirmActiveScan {
		c.JSON(http.StatusBadRequest, gin.H{"error": "full (active) scans send real attack payloads against the target — set confirm_active_scan=true to proceed. Consider running this only against a staging copy, not production."})
		return
	}

	db := config.DB()
	var target entity.AppWebScanTarget
	if err := db.First(&target, "id = ?", targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "target not found"})
		return
	}

	if err := ZAPReachable(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ZAP scanner is not reachable: " + err.Error()})
		return
	}

	scanMu.Lock()
	if isScanning {
		scanMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "another web scan is already running — only one can run at a time"})
		return
	}
	isScanning = true
	scanMu.Unlock()

	result := entity.AppWebScanResult{
		TargetID:  target.ID,
		ScanType:  input.ScanType,
		Status:    "spidering",
		StartedAt: time.Now(),
	}
	if err := db.Create(&result).Error; err != nil {
		scanMu.Lock()
		isScanning = false
		scanMu.Unlock()
		services.RespondInternalError(c, err)
		return
	}

	scanMu.Lock()
	currentResultID = result.ID
	scanMu.Unlock()

	go runWebScan(result.ID, target.URL, input.ScanType, target.AuthCookie)

	audit.Log(c, "webscan.triggered", "webscan_result", fmt.Sprintf("%d", result.ID), fmt.Sprintf("started a %s scan against %s (%s)", input.ScanType, target.Name, target.URL))

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func GetWebScanStatus(c *gin.Context) {
	scanMu.Lock()
	running := isScanning
	resultID := currentResultID
	scanMu.Unlock()

	if !running {
		c.JSON(http.StatusOK, gin.H{"is_running": false})
		return
	}

	db := config.DB()
	var result entity.AppWebScanResult
	if err := db.First(&result, "id = ?", resultID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"is_running": running})
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_running": running, "data": result})
}

// StopWebScan stops whatever phase (spider or active scan) is currently
// running for the in-progress result and marks it "stopped".
func StopWebScan(c *gin.Context) {
	scanMu.Lock()
	running := isScanning
	resultID := currentResultID
	scanMu.Unlock()

	if !running {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no scan is currently running"})
		return
	}

	db := config.DB()
	var result entity.AppWebScanResult
	if err := db.First(&result, "id = ?", resultID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "scan result not found"})
		return
	}

	if result.ZAPActiveScanID != "" {
		if err := StopActiveScan(result.ZAPActiveScanID); err != nil {
			log.Println("⚠️ webscan: failed to stop active scan:", err)
		}
	}
	if result.ZAPSpiderScanID != "" {
		if err := StopSpider(result.ZAPSpiderScanID); err != nil {
			log.Println("⚠️ webscan: failed to stop spider:", err)
		}
	}

	now := time.Now()
	db.Model(&result).Updates(map[string]interface{}{
		"status":      "stopped",
		"finished_at": now,
	})

	scanMu.Lock()
	isScanning = false
	scanMu.Unlock()

	audit.Log(c, "webscan.stopped", "webscan_result", fmt.Sprintf("%d", resultID), "manually stopped a running web scan")
	c.JSON(http.StatusOK, gin.H{"message": "scan stopped"})
}

// ===========================
// Results & findings
// ===========================

func ListWebScanResults(c *gin.Context) {
	db := config.DB()
	var results []entity.AppWebScanResult
	query := db.Order("started_at DESC")
	if targetID := c.Query("target_id"); targetID != "" {
		query = query.Where("target_id = ?", targetID)
	}
	if err := query.Find(&results).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

func ListWebScanFindings(c *gin.Context) {
	resultID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	db := config.DB()
	var findings []entity.AppWebScanFinding
	if err := db.
		Where("result_id = ?", resultID).
		Order("CASE risk WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 WHEN 'Low' THEN 2 ELSE 3 END, alert_name ASC").
		Find(&findings).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": findings})
}

// ===========================
// Background scan execution
// ===========================

const pollInterval = 3 * time.Second
const scanOverallTimeout = 3 * time.Hour

func runWebScan(resultID uint, targetURL string, scanType string, authCookie string) {
	defer func() {
		scanMu.Lock()
		isScanning = false
		scanMu.Unlock()

		// Unconditional, regardless of whether this scan set a cookie at
		// all or failed/stopped partway through — a stale Replacer rule
		// must never survive to leak into the next scan's requests.
		if err := ClearRequestCookie(); err != nil {
			log.Println("⚠️ webscan: failed to clear auth cookie rule:", err)
		}
	}()

	db := config.DB()
	deadline := time.Now().Add(scanOverallTimeout)

	fail := func(errMsg string) {
		now := time.Now()
		db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": errMsg,
			"finished_at":   now,
		})
		log.Println("❌ webscan failed:", errMsg)
	}

	if err := NewSession(); err != nil {
		fail("failed to reset ZAP session: " + err.Error())
		return
	}

	if strings.TrimSpace(authCookie) != "" {
		// Scoped to this target's own origin (escaped for regex safety) so
		// the cookie is only ever attached to requests actually going to
		// this target, not anything else ZAP might touch.
		if err := SetRequestCookie(regexp.QuoteMeta(targetURL)+".*", authCookie); err != nil {
			fail("failed to configure authentication cookie: " + err.Error())
			return
		}
	}

	spiderScanID, err := StartSpider(targetURL)
	if err != nil {
		fail("failed to start spider: " + err.Error())
		return
	}
	db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Update("zap_spider_scan_id", spiderScanID)

	for {
		if time.Now().After(deadline) {
			fail("scan exceeded the maximum allowed duration")
			return
		}
		progress, err := SpiderStatus(spiderScanID)
		if err != nil {
			fail("failed to poll spider status: " + err.Error())
			return
		}
		db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Update("spider_progress", progress)

		// The scan may have been stopped by a user mid-poll.
		var current entity.AppWebScanResult
		if err := db.First(&current, "id = ?", resultID).Error; err == nil && current.Status == "stopped" {
			return
		}

		if progress >= 100 {
			break
		}
		time.Sleep(pollInterval)
	}

	if scanType == "full" {
		db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Update("status", "active_scanning")

		activeScanID, err := StartActiveScan(targetURL)
		if err != nil {
			fail("failed to start active scan: " + err.Error())
			return
		}
		db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Update("zap_active_scan_id", activeScanID)

		for {
			if time.Now().After(deadline) {
				fail("scan exceeded the maximum allowed duration")
				return
			}
			progress, err := ActiveScanStatus(activeScanID)
			if err != nil {
				fail("failed to poll active scan status: " + err.Error())
				return
			}
			db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Update("active_progress", progress)

			var current entity.AppWebScanResult
			if err := db.First(&current, "id = ?", resultID).Error; err == nil && current.Status == "stopped" {
				return
			}

			if progress >= 100 {
				break
			}
			time.Sleep(pollInterval)
		}
	}

	alerts, err := GetAlerts(targetURL)
	if err != nil {
		fail("scan finished but failed to fetch findings: " + err.Error())
		return
	}

	counts := map[string]int{}
	findings := make([]entity.AppWebScanFinding, 0, len(alerts))
	for _, a := range alerts {
		risk := normalizeRisk(a.Risk)
		counts[risk]++

		var tagsJSON string
		if len(a.Tags) > 0 {
			if b, err := json.Marshal(a.Tags); err == nil {
				tagsJSON = string(b)
			}
		}

		findings = append(findings, entity.AppWebScanFinding{
			ResultID:    resultID,
			AlertName:   a.Alert,
			Risk:        risk,
			Confidence:  a.Confidence,
			URL:         a.URL,
			Param:       a.Param,
			Method:      a.Method,
			Description: a.Description,
			Solution:    a.Solution,
			Attack:      a.Attack,
			OtherInfo:   a.OtherInfo,
			CWEID:       a.CWEID,
			WASCID:      a.WASCID,
			AlertRef:    a.AlertRef,
			PluginID:    a.PluginID,
			Reference:   a.Reference,
			Tags:        tagsJSON,
			Evidence:    a.Evidence,
		})
	}

	if len(findings) > 0 {
		if err := db.Create(&findings).Error; err != nil {
			log.Println("❌ webscan: failed to save findings:", err)
		}
	}

	now := time.Now()
	db.Model(&entity.AppWebScanResult{}).Where("id = ?", resultID).Updates(map[string]interface{}{
		"status":        "completed",
		"high":          counts["High"],
		"medium":        counts["Medium"],
		"low":           counts["Low"],
		"informational": counts["Informational"],
		"finished_at":   now,
	})
}

func normalizeRisk(r string) string {
	switch strings.ToLower(strings.TrimSpace(r)) {
	case "high":
		return "High"
	case "medium":
		return "Medium"
	case "low":
		return "Low"
	default:
		return "Informational"
	}
}
