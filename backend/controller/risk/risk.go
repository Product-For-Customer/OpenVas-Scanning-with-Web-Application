package risk

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/setting"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

// ===========================
// EPSS
// ===========================

type epssAPIResponse struct {
	Status string `json:"status"`
	Data   []struct {
		CVE        string `json:"cve"`
		EPSS       string `json:"epss"`
		Percentile string `json:"percentile"`
		Date       string `json:"date"`
	} `json:"data"`
}

type EPSSData struct {
	CVE        string  `json:"cve"`
	EPSSScore  float64 `json:"epss_score"`
	Percentile float64 `json:"percentile"`
	Date       string  `json:"date"`
}

func fetchEPSSBatch(cveIDs []string) (map[string]EPSSData, error) {
	if len(cveIDs) == 0 {
		return map[string]EPSSData{}, nil
	}

	// EPSS API supports batch queries, max 100 per request
	result := make(map[string]EPSSData)
	chunkSize := 100
	for i := 0; i < len(cveIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(cveIDs) {
			end = len(cveIDs)
		}
		chunk := cveIDs[i:end]

		// Trim whitespace from every CVE ID before building URL
		cleaned := make([]string, 0, len(chunk))
		for _, c := range chunk {
			if t := strings.TrimSpace(c); t != "" {
				cleaned = append(cleaned, t)
			}
		}
		if len(cleaned) == 0 {
			continue
		}

		epssURL := "https://api.first.org/data/1.0/epss?cve=" + strings.Join(cleaned, ",")
		if i == 0 {
			log.Printf("🔍 EPSS sample URL (chunk 1, first CVE): %s", cleaned[0])
		}

		req, reqErr := http.NewRequest(http.MethodGet, epssURL, nil)
		if reqErr != nil {
			log.Printf("⚠️ EPSS build request error: %v", reqErr)
			continue
		}

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("⚠️ EPSS fetch error (chunk %d): %v", i/chunkSize+1, err)
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			// 404 = no EPSS scores for any CVE in this batch (expected for old/obscure CVEs)
			log.Printf("ℹ️ EPSS: no scores for chunk %d (HTTP 404), skipping", i/chunkSize+1)
			resp.Body.Close()
			continue
		}
		if resp.StatusCode != http.StatusOK {
			log.Printf("⚠️ EPSS API returned HTTP %d for chunk %d (URL: %s)", resp.StatusCode, i/chunkSize+1, epssURL[:min(len(epssURL), 120)])
			resp.Body.Close()
			continue
		}

		var apiResp epssAPIResponse
		if decErr := json.NewDecoder(resp.Body).Decode(&apiResp); decErr != nil {
			resp.Body.Close()
			log.Printf("⚠️ EPSS decode error (chunk %d): %v", i/chunkSize+1, decErr)
			continue
		}
		resp.Body.Close()
		log.Printf("🔍 EPSS chunk %d: got %d scores from API", i/chunkSize+1, len(apiResp.Data))

		for _, item := range apiResp.Data {
			var epss, pct float64
			fmt.Sscanf(item.EPSS, "%f", &epss)
			fmt.Sscanf(item.Percentile, "%f", &pct)
			result[strings.ToUpper(item.CVE)] = EPSSData{
				CVE:        item.CVE,
				EPSSScore:  epss,
				Percentile: pct,
				Date:       item.Date,
			}
		}

		if end < len(cveIDs) {
			time.Sleep(2 * time.Second) // rate limiting between chunks
		}
	}
	return result, nil
}

func upsertEPSSCache(data EPSSData) {
	gdb := config.DB()
	cache := entity.AppEPSSCache{
		CVEID:        strings.ToUpper(data.CVE),
		EPSSScore:    data.EPSSScore,
		Percentile:   data.Percentile,
		ScoreDate:    data.Date,
		FetchedAt:    time.Now(),
		ModelVersion: "v2024",
	}
	// Use ON CONFLICT upsert — Save() fails for string PKs (does UPDATE only, never INSERT)
	if err := gdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cve_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"epss_score", "percentile", "score_date", "fetched_at", "model_version"}),
	}).Create(&cache).Error; err != nil {
		log.Printf("⚠️ EPSS upsert error for %s: %v", cache.CVEID, err)
	}
}

// SyncEPSSForKnownCVEs fetches EPSS scores for all CVEs in our scan results.
func SyncEPSSForKnownCVEs() {
	log.Println("🔄 Starting EPSS sync...")
	gdb := config.DB()

	// Get CVEs from actual scan results (not all VT plugin definitions which include old 1999-2004 CVEs)
	var cveIDs []string
	query := `
SELECT DISTINCT BTRIM(vtr.ref_id) AS ref_id
FROM public.results r
JOIN public.vt_refs vtr ON vtr.vt_oid = r.nvt AND LOWER(vtr.type) = 'cve'
WHERE BTRIM(vtr.ref_id) ILIKE 'CVE-%'
  AND COALESCE(r.severity, 0) > 0
ORDER BY ref_id DESC
LIMIT 2000`
	if err := gdb.Raw(query).Scan(&cveIDs).Error; err != nil {
		log.Printf("⚠️ EPSS sync: failed to get CVE IDs from results: %v", err)
		return
	}

	if len(cveIDs) == 0 {
		log.Println("ℹ️ EPSS sync: no CVE IDs found")
		return
	}

	log.Printf("🔄 EPSS sync: fetching scores for %d CVEs...", len(cveIDs))
	epssMap, err := fetchEPSSBatch(cveIDs)
	if err != nil {
		log.Printf("⚠️ EPSS sync error: %v", err)
		return
	}

	for _, data := range epssMap {
		upsertEPSSCache(data)
	}

	log.Printf("✅ EPSS sync complete: %d scores updated", len(epssMap))
}

// StartEPSSSyncScheduler runs EPSS sync at 4:30 AM Bangkok time daily.
func StartEPSSSyncScheduler() {
	go func() {
		// Sync 60s after startup
		time.Sleep(60 * time.Second)
		SyncEPSSForKnownCVEs()

		loc, _ := time.LoadLocation(setting.GetAppTimezone())
		for {
			now := time.Now().In(loc)
			next := time.Date(now.Year(), now.Month(), now.Day(), 4, 30, 0, 0, loc)
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			time.Sleep(time.Until(next))
			SyncEPSSForKnownCVEs()
		}
	}()
}

// ===========================
// Risk Score Calculation
// ===========================

func calcRiskScore(cvssScore, epssScore float64, isKEV, isRansomware bool, criticalityScore int) float64 {
	score := 0.0
	score += (cvssScore / 10.0) * 25.0      // CVSS: max 25 pts
	score += epssScore * 35.0                 // EPSS: max 35 pts
	if isKEV {
		score += 20.0
	}
	if isRansomware {
		score += 10.0
	}
	score += float64(criticalityScore-1) * 2.5 // Asset: 0–10 pts
	if score > 100 {
		score = 100
	}
	return math.Round(score*10) / 10
}

func riskLevel(score float64) string {
	switch {
	case score >= 80:
		return "CRITICAL"
	case score >= 60:
		return "HIGH"
	case score >= 40:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

// ===========================
// DTOs
// ===========================

type RiskScoreDTO struct {
	HostIP           string  `json:"host_ip"`
	TaskName         string  `json:"task_name"`
	CVEID            string  `json:"cve_id"`
	VulnName         string  `json:"vuln_name"`
	CVSSScore        float64 `json:"cvss_score"`
	EPSSScore        float64 `json:"epss_score"`
	EPSSPercentile   float64 `json:"epss_percentile"`
	IsKEV            bool    `json:"is_kev"`
	IsRansomware     bool    `json:"is_ransomware"`
	AssetCriticality string  `json:"asset_criticality"`
	CriticalityScore int     `json:"criticality_score"`
	RiskScore        float64 `json:"risk_score"`
	RiskLevel        string  `json:"risk_level"`
}

type RiskSummaryDTO struct {
	TotalItems     int            `json:"total_items"`
	CriticalCount  int            `json:"critical_count"`
	HighCount      int            `json:"high_count"`
	MediumCount    int            `json:"medium_count"`
	LowCount       int            `json:"low_count"`
	TopRisks       []RiskScoreDTO `json:"top_risks"`
	LastCalculated string         `json:"last_calculated"`
}

type scanCVERow struct {
	HostIP   string  `gorm:"column:host_ip"`
	TaskName string  `gorm:"column:task_name"`
	CVEID    string  `gorm:"column:cve_id"`
	VulnName string  `gorm:"column:vuln_name"`
	Severity float64 `gorm:"column:severity"`
}

// GetRiskSummary calculates composite risk scores for all current CVEs.
func GetRiskSummary(c *gin.Context) {
	db := config.DB()

	// 1. Get all CVEs from latest scan per task
	// Note: avoids joining public.nvts which may not exist in all Greenbone CE versions
	var rows []scanCVERow
	scanQuery := `
SELECT DISTINCT
  r.host AS host_ip,
  COALESCE(t.name, '') AS task_name,
  BTRIM(vtr.ref_id) AS cve_id,
  SPLIT_PART(COALESCE(r.description, ''), E'\n', 1) AS vuln_name,
  COALESCE(r.severity, 0)::float8 AS severity
FROM public.results r
JOIN public.reports rp ON rp.id = r.report
LEFT JOIN public.tasks t ON t.id = rp.task
JOIN public.vt_refs vtr ON vtr.vt_oid = r.nvt AND LOWER(vtr.type) = 'cve'
WHERE r.host IS NOT NULL
  AND BTRIM(r.host) <> ''
  AND r.host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
  AND COALESCE(r.severity, 0) > 0
  AND rp.id IN (
    SELECT DISTINCT ON (task) id
    FROM public.reports
    WHERE task IS NOT NULL
    ORDER BY task, creation_time DESC, id DESC
  )
ORDER BY severity DESC
LIMIT 500`

	if err := db.Raw(scanQuery).Scan(&rows).Error; err != nil {
		log.Printf("⚠️ Risk summary SQL error: %v", err)
		services.RespondInternalError(c, err)
		return
	}
	log.Printf("🔍 Risk summary: found %d CVE-mapped results", len(rows))

	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": RiskSummaryDTO{LastCalculated: time.Now().Format(time.RFC3339), TopRisks: []RiskScoreDTO{}}})
		return
	}

	// 2. Collect unique CVE IDs and host IPs
	cveSet := make(map[string]bool)
	hostSet := make(map[string]bool)
	for _, row := range rows {
		cveSet[row.CVEID] = true
		hostSet[row.HostIP] = true
	}

	cveList := make([]string, 0, len(cveSet))
	for cve := range cveSet {
		cveList = append(cveList, cve)
	}

	// 3. Load EPSS cache
	var epssRows []entity.AppEPSSCache
	if len(cveList) > 0 {
		db.Where("cve_id IN ?", cveList).Find(&epssRows)
	}
	epssMap := make(map[string]entity.AppEPSSCache)
	for _, e := range epssRows {
		epssMap[e.CVEID] = e
	}

	// 4. Load KEV cache
	var kevRows []entity.AppKEVCache
	if len(cveList) > 0 {
		db.Where("cve_id IN ?", cveList).Find(&kevRows)
	}
	kevMap := make(map[string]entity.AppKEVCache)
	for _, k := range kevRows {
		kevMap[k.CVEID] = k
	}

	// 5. Load asset criticality
	hostList := make([]string, 0, len(hostSet))
	for h := range hostSet {
		hostList = append(hostList, h)
	}
	var assetRows []entity.AppAssetCriticality
	if len(hostList) > 0 {
		db.Where("host_ip IN ?", hostList).Find(&assetRows)
	}
	assetMap := make(map[string]entity.AppAssetCriticality)
	for _, a := range assetRows {
		assetMap[a.HostIP] = a
	}

	// 6. Calculate risk scores
	var scored []RiskScoreDTO
	for _, row := range rows {
		epss := epssMap[row.CVEID]
		kev := kevMap[row.CVEID]
		asset := assetMap[row.HostIP]

		critScore := asset.CriticalityScore
		if critScore == 0 {
			critScore = 3
		}
		critLabel := asset.Criticality
		if critLabel == "" {
			critLabel = "medium"
		}

		rs := calcRiskScore(row.Severity, epss.EPSSScore, kev.CVEID != "", kev.KnownRansomwareCampaignUse == "Known", critScore)

		scored = append(scored, RiskScoreDTO{
			HostIP:           row.HostIP,
			TaskName:         row.TaskName,
			CVEID:            row.CVEID,
			VulnName:         row.VulnName,
			CVSSScore:        row.Severity,
			EPSSScore:        epss.EPSSScore,
			EPSSPercentile:   epss.Percentile,
			IsKEV:            kev.CVEID != "",
			IsRansomware:     kev.KnownRansomwareCampaignUse == "Known",
			AssetCriticality: critLabel,
			CriticalityScore: critScore,
			RiskScore:        rs,
			RiskLevel:        riskLevel(rs),
		})
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].RiskScore > scored[j].RiskScore
	})

	summary := RiskSummaryDTO{LastCalculated: time.Now().Format(time.RFC3339)}
	for _, s := range scored {
		summary.TotalItems++
		switch s.RiskLevel {
		case "CRITICAL":
			summary.CriticalCount++
		case "HIGH":
			summary.HighCount++
		case "MEDIUM":
			summary.MediumCount++
		case "LOW":
			summary.LowCount++
		}
	}

	// Top 50 risks
	if len(scored) > 50 {
		summary.TopRisks = scored[:50]
	} else {
		summary.TopRisks = scored
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// GetEPSSStatus returns EPSS cache stats.
func GetEPSSStatus(c *gin.Context) {
	db := config.DB()
	var count int64
	db.Model(&entity.AppEPSSCache{}).Count(&count)

	var latest entity.AppEPSSCache
	db.Order("fetched_at DESC").First(&latest)

	c.JSON(http.StatusOK, gin.H{
		"total":      count,
		"last_sync":  latest.FetchedAt,
		"score_date": latest.ScoreDate,
	})
}

// TriggerEPSSSync manually triggers EPSS sync.
func TriggerEPSSSync(c *gin.Context) {
	go SyncEPSSForKnownCVEs()
	c.JSON(http.StatusOK, gin.H{"message": "EPSS sync started in background"})
}

// ===========================
// Asset Criticality CRUD
// ===========================

func ListAssetCriticality(c *gin.Context) {
	db := config.DB()
	var list []entity.AppAssetCriticality
	db.Order("criticality_score DESC, host_ip ASC").Find(&list)
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func GetAssetCriticality(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	var item entity.AppAssetCriticality
	if err := db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

type assetCritInput struct {
	HostIP           string `json:"host_ip" binding:"required"`
	Criticality      string `json:"criticality"`
	CriticalityScore int    `json:"criticality_score"`
	AssetType        string `json:"asset_type"`
	Owner            string `json:"owner"`
	BusinessImpact   string `json:"business_impact"`
}

func CreateAssetCriticality(c *gin.Context) {
	var input assetCritInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.CriticalityScore < 1 || input.CriticalityScore > 5 {
		input.CriticalityScore = 3
	}
	if input.Criticality == "" {
		input.Criticality = "medium"
	}
	if input.AssetType == "" {
		input.AssetType = "server"
	}

	db := config.DB()
	item := entity.AppAssetCriticality{
		HostIP:           input.HostIP,
		Criticality:      input.Criticality,
		CriticalityScore: input.CriticalityScore,
		AssetType:        input.AssetType,
		Owner:            input.Owner,
		BusinessImpact:   input.BusinessImpact,
	}
	if err := db.Create(&item).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "asset_criticality.created", "asset_criticality", fmt.Sprintf("%d", item.ID), fmt.Sprintf("set %s criticality=%s", item.HostIP, item.Criticality))
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

type updateAssetCritInput struct {
	HostIP           *string `json:"host_ip"`
	Criticality      *string `json:"criticality"`
	CriticalityScore *int    `json:"criticality_score"`
	AssetType        *string `json:"asset_type"`
	Owner            *string `json:"owner"`
	BusinessImpact   *string `json:"business_impact"`
}

func UpdateAssetCriticality(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	var item entity.AppAssetCriticality
	if err := db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var input updateAssetCritInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.HostIP != nil {
		updates["host_ip"] = *input.HostIP
	}
	if input.Criticality != nil {
		updates["criticality"] = *input.Criticality
	}
	if input.CriticalityScore != nil {
		score := *input.CriticalityScore
		if score < 1 || score > 5 {
			score = 3
		}
		updates["criticality_score"] = score
	}
	if input.AssetType != nil {
		updates["asset_type"] = *input.AssetType
	}
	if input.Owner != nil {
		updates["owner"] = *input.Owner
	}
	if input.BusinessImpact != nil {
		updates["business_impact"] = *input.BusinessImpact
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	if err := db.Model(&item).Updates(updates).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "asset_criticality.updated", "asset_criticality", id, fmt.Sprintf("updated criticality for %s", item.HostIP))
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func DeleteAssetCriticality(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	if err := db.Delete(&entity.AppAssetCriticality{}, id).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "asset_criticality.deleted", "asset_criticality", id, "deleted asset criticality entry")
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
