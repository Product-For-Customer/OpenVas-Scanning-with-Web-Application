package discovery

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var scanMu sync.Mutex
var isScanning bool
var lastScanStartedAt time.Time
var lastScanFinishedAt time.Time
var lastScanError string

const scriptPath = "/app/scripts/discovery-scan.sh"

// ===========================
// Nmap XML output structs (only the fields this feature needs)
// ===========================

type nmapRun struct {
	XMLName xml.Name   `xml:"nmaprun"`
	Hosts   []nmapHost `xml:"host"`
}

type nmapHost struct {
	Status    nmapStatus    `xml:"status"`
	Addresses []nmapAddress `xml:"address"`
	Hostnames struct {
		Hostname []nmapHostname `xml:"hostname"`
	} `xml:"hostnames"`
	Ports struct {
		Port []nmapPort `xml:"port"`
	} `xml:"ports"`
}

type nmapStatus struct {
	State string `xml:"state,attr"`
}

type nmapAddress struct {
	Addr     string `xml:"addr,attr"`
	AddrType string `xml:"addrtype,attr"`
}

type nmapHostname struct {
	Name string `xml:"name,attr"`
}

type nmapPort struct {
	PortID string `xml:"portid,attr"`
	State  struct {
		State string `xml:"state,attr"`
	} `xml:"state"`
}

// ===========================
// HTTP handlers
// ===========================

// discoverySubnetKey is the SystemConfig key an admin sets from the web UI
// (Discovery page, gated on line_settings.manage — same precedent as
// ScanManagement's global timezone picker, which also writes the shared
// /settings endpoint under that category instead of its own page's category)
// rather than an env var, so changing it doesn't need a container restart.
const discoverySubnetKey = "discovery_subnet"

func getDiscoverySubnet(db *gorm.DB) string {
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", discoverySubnetKey).First(&cfg).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(cfg.Value)
}

func TriggerDiscoveryScanHandler(c *gin.Context) {
	subnet := getDiscoverySubnet(config.DB())
	if subnet == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discovery subnet is not configured — set it on the Asset Discovery page first"})
		return
	}

	scanMu.Lock()
	if isScanning {
		scanMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "a discovery scan is already running"})
		return
	}
	isScanning = true
	lastScanStartedAt = time.Now()
	lastScanError = ""
	scanMu.Unlock()

	go runDiscoveryScan(subnet)

	audit.Log(c, "discovery_scan.triggered", "discovery_scan", "", "started a network asset discovery scan")

	c.JSON(http.StatusOK, gin.H{
		"message":    "discovery scan started",
		"started_at": lastScanStartedAt,
	})
}

func GetDiscoveryScanStatusHandler(c *gin.Context) {
	scanMu.Lock()
	running := isScanning
	startedAt := lastScanStartedAt
	finishedAt := lastScanFinishedAt
	lastErr := lastScanError
	scanMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"is_running":  running,
		"started_at":  startedAt,
		"finished_at": finishedAt,
		"last_error":  lastErr,
	})
}

// ListDiscoveredHosts returns a paginated, optionally filtered/searched page
// of discovered hosts (unknown hosts first, newest FirstSeenAt first within
// each group, so a new/unrecognized device is the first thing an admin
// notices). Query params:
//   - page       (default 1)
//   - page_size  (default 20, capped at 200)
//   - search     substring match against IP address, hostname, or open ports
//   - status     "known" | "unrecognized" | "acknowledged" (default: all)
//
// The two summary counts (total_hosts, unrecognized_count) are always
// computed across the *entire* table regardless of the current search/status
// filter, since the page's summary cards ("Total Hosts Seen" / "Unrecognized")
// are meant to reflect the whole inventory, not just the filtered result set.
func ListDiscoveredHosts(c *gin.Context) {
	db := config.DB()

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	search := strings.TrimSpace(c.Query("search"))
	statusFilter := strings.TrimSpace(c.Query("status"))

	query := db.Model(&entity.AppDiscoveredHost{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("ip_address ILIKE ? OR hostname ILIKE ? OR open_ports ILIKE ?", like, like, like)
	}
	switch statusFilter {
	case "known":
		query = query.Where("is_known_target = ?", true)
	case "unrecognized":
		query = query.Where("is_known_target = ? AND acknowledged = ?", false, false)
	case "acknowledged":
		query = query.Where("is_known_target = ? AND acknowledged = ?", false, true)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	var hosts []entity.AppDiscoveredHost
	if err := query.
		Order("is_known_target ASC, first_seen_at DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&hosts).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	var totalHosts int64
	if err := db.Model(&entity.AppDiscoveredHost{}).Count(&totalHosts).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	var unrecognizedCount int64
	if err := db.Model(&entity.AppDiscoveredHost{}).
		Where("is_known_target = ? AND acknowledged = ?", false, false).
		Count(&unrecognizedCount).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 1 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"data":               hosts,
		"page":               page,
		"page_size":          pageSize,
		"total":              total,
		"total_pages":        totalPages,
		"total_hosts":        totalHosts,
		"unrecognized_count": unrecognizedCount,
	})
}

// AcknowledgeDiscoveredHost lets an admin mark an unexpected host as
// reviewed (e.g. "yes, that's a new laptop we approved") without having to
// formally add it as an OpenVAS scan target.
func AcknowledgeDiscoveredHost(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var host entity.AppDiscoveredHost
	if err := db.First(&host, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if err := db.Model(&host).Update("acknowledged", true).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "discovery_scan.acknowledged", "discovered_host", strconv.FormatUint(uint64(id), 10), fmt.Sprintf("acknowledged host %s", host.IPAddress))
	c.JSON(http.StatusOK, gin.H{"data": host})
}

// ===========================
// Background scan execution
// ===========================

func runDiscoveryScan(subnet string) {
	defer func() {
		scanMu.Lock()
		isScanning = false
		lastScanFinishedAt = time.Now()
		scanMu.Unlock()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", scriptPath)
	cmd.Env = append(os.Environ(), "DISCOVERY_SUBNET="+subnet)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	if stderr.Len() > 0 {
		for _, line := range strings.Split(strings.TrimRight(stderr.String(), "\n"), "\n") {
			if line != "" {
				log.Println("[discovery-scan]", line)
			}
		}
	}

	if err != nil {
		scanMu.Lock()
		lastScanError = err.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: script failed:", err)
		return
	}

	upCount, procErr := processScanOutput(stdout.Bytes())
	if procErr != nil {
		scanMu.Lock()
		lastScanError = procErr.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: failed to process results:", procErr)
		return
	}

	// The scan ran and parsed cleanly but found zero live hosts — not
	// necessarily a bug (a genuinely quiet subnet is possible), but the most
	// common real cause is a networking/permission problem in the throwaway
	// nmap container, which nmap usually reports on stderr. Surface it as the
	// status's "last_error" so it's visible on the page instead of just
	// looking identical to a real empty result.
	if upCount == 0 && stderr.Len() > 0 {
		scanMu.Lock()
		lastScanError = "scan completed but found 0 hosts up — nmap said: " + strings.TrimSpace(stderr.String())
		scanMu.Unlock()
	}
}

// processScanOutput returns the number of "up" hosts it saved, so the caller
// can tell "ran fine, genuinely found nothing" apart from a silent failure.
func processScanOutput(xmlOutput []byte) (int, error) {
	trimmed := bytes.TrimSpace(xmlOutput)
	if len(trimmed) == 0 {
		return 0, fmt.Errorf("nmap produced no output")
	}

	var run nmapRun
	if err := xml.Unmarshal(trimmed, &run); err != nil {
		return 0, fmt.Errorf("failed to parse nmap XML output: %w", err)
	}

	db := config.DB()

	knownIPs, err := knownTargetIPs(db)
	if err != nil {
		// Not fatal — proceed treating every host as "unknown" rather than
		// aborting the whole scan just because the known-target lookup
		// (which reads gvmd's shared tables) failed.
		log.Println("⚠️ discovery scan: could not load known target IPs:", err)
		knownIPs = map[string]bool{}
	}

	now := time.Now()
	newUnknownHosts := make([]string, 0)
	upCount := 0

	for _, h := range run.Hosts {
		if h.Status.State != "up" {
			continue
		}

		var ip string
		for _, addr := range h.Addresses {
			if addr.AddrType == "ipv4" {
				ip = addr.Addr
				break
			}
		}
		if ip == "" {
			continue
		}
		upCount++

		hostname := ""
		if len(h.Hostnames.Hostname) > 0 {
			hostname = h.Hostnames.Hostname[0].Name
		}

		var openPorts []string
		for _, p := range h.Ports.Port {
			if p.State.State == "open" {
				openPorts = append(openPorts, p.PortID)
			}
		}

		isKnown := knownIPs[ip]

		var existing entity.AppDiscoveredHost
		findErr := db.Where("ip_address = ?", ip).First(&existing).Error

		if findErr == gorm.ErrRecordNotFound {
			newHost := entity.AppDiscoveredHost{
				IPAddress:     ip,
				Hostname:      hostname,
				OpenPorts:     strings.Join(openPorts, ","),
				IsKnownTarget: isKnown,
				FirstSeenAt:   now,
				LastSeenAt:    now,
			}
			if err := db.Create(&newHost).Error; err != nil {
				log.Println("❌ discovery scan: failed to save new host", ip, ":", err)
				continue
			}
			if !isKnown {
				newUnknownHosts = append(newUnknownHosts, ip)
			}
			continue
		}

		if findErr != nil {
			log.Println("❌ discovery scan: failed to look up host", ip, ":", findErr)
			continue
		}

		db.Model(&existing).Updates(map[string]interface{}{
			"hostname":        hostname,
			"open_ports":      strings.Join(openPorts, ","),
			"is_known_target": isKnown,
			"last_seen_at":    now,
		})
	}

	if len(newUnknownHosts) > 0 {
		notifyNewUnknownHosts(newUnknownHosts)
	}

	return upCount, nil
}

// knownTargetIPs reads the distinct set of host IPs the GVM scan engine has
// ever reported results for (shared Postgres tables, same database this
// backend already connects to) — used as the "is this a device we already
// know about" baseline, independent of whether anyone has ever set its
// Asset Criticality.
func knownTargetIPs(db *gorm.DB) (map[string]bool, error) {
	var ips []string
	err := db.Raw(`SELECT DISTINCT host FROM public.results WHERE host IS NOT NULL AND BTRIM(host) <> ''`).Scan(&ips).Error
	if err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(ips))
	for _, ip := range ips {
		set[strings.TrimSpace(ip)] = true
	}
	return set, nil
}

// ===========================
// LINE alert on new unknown host (mirrors automation.go's
// sendLinePushToAllNotifications — kept as its own small copy here rather
// than a shared export, consistent with how that pattern already exists)
// ===========================

type lineTextMessage struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type linePushRequest struct {
	To       string            `json:"to"`
	Messages []lineTextMessage `json:"messages"`
}

func notifyNewUnknownHosts(ips []string) {
	db := config.DB()

	var notifications []entity.AppNotification
	if err := db.
		Preload("AppLineMaster").
		Where("alert = ?", true).
		Find(&notifications).Error; err != nil {
		log.Println("⚠️ discovery scan: failed to load LINE notifications:", err)
		return
	}
	if len(notifications) == 0 {
		return
	}

	message := fmt.Sprintf(
		"⚠️ พบอุปกรณ์ใหม่ในเครือข่ายที่ไม่รู้จัก %d เครื่อง\nIP: %s",
		len(ips),
		strings.Join(ips, ", "),
	)

	sentTo := map[string]struct{}{}
	for _, notify := range notifications {
		if notify.AppLineMaster == nil {
			continue
		}
		token := strings.TrimSpace(notify.AppLineMaster.Token)
		sendID := strings.TrimSpace(notify.SendID)
		if token == "" || sendID == "" {
			continue
		}
		dedupKey := token + "::" + sendID
		if _, exists := sentTo[dedupKey]; exists {
			continue
		}
		sentTo[dedupKey] = struct{}{}

		if err := sendLinePush(token, sendID, message); err != nil {
			log.Println("⚠️ discovery scan: LINE notify failed:", err)
		}
	}
}

func sendLinePush(channelToken, to, message string) error {
	payload := linePushRequest{
		To:       to,
		Messages: []lineTextMessage{{Type: "text", Text: message}},
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.line.me/v2/bot/message/push", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channelToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("line send failed: status=%s", resp.Status)
	}
	return nil
}
