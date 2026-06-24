package host

import (
	"math"
	"net/http"
	"sort"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/setting"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ========================
// DTOs
// ========================

type HostAssetInfo struct {
	Criticality      string `json:"criticality"`
	CriticalityScore int    `json:"criticality_score"`
	AssetType        string `json:"asset_type"`
	Owner            string `json:"owner"`
	BusinessImpact   string `json:"business_impact"`
}

type KEVHitItem struct {
	CVEID             string `json:"cve_id"`
	VulnerabilityName string `json:"vulnerability_name"`
	Product           string `json:"product"`
	IsRansomware      bool   `json:"is_ransomware"`
	DueDate           string `json:"due_date"`
}

type EPSSHitItem struct {
	CVEID      string  `json:"cve_id"`
	EPSSScore  float64 `json:"epss_score"`
	Percentile float64 `json:"percentile"`
	VulnName   string  `json:"vuln_name"`
}

type HostVulnDetail struct {
	VulnName  string  `json:"vuln_name"`
	Family    string  `json:"family"`
	Severity  float64 `json:"severity"`
	Level     string  `json:"level"`
	Port      string  `json:"port"`
	CVEList   string  `json:"cve_list"`
	DaysOpen  int     `json:"days_open"`
	SLAStatus string  `json:"sla_status"` // ok | warning | breach | n/a
	SLADays   int     `json:"sla_days"`
	RiskScore float64 `json:"risk_score"`
}

type HostSummaryResponse struct {
	HostIP    string        `json:"host_ip"`
	TaskName  string        `json:"task_name"`
	ScannedAt string        `json:"scanned_at"`
	Asset     HostAssetInfo `json:"asset"`

	Total    int `json:"total"`
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Info     int `json:"info"`

	RiskScore float64 `json:"risk_score"`
	RiskLevel string  `json:"risk_level"`

	KEVCount int          `json:"kev_count"`
	KEVItems []KEVHitItem `json:"kev_items"`

	TopEPSS []EPSSHitItem `json:"top_epss"`

	SLABreachCount  int `json:"sla_breach_count"`
	SLAWarningCount int `json:"sla_warning_count"`

	Vulnerabilities []HostVulnDetail `json:"vulnerabilities"`
}

// ========================
// SLA Breach Item (global)
// ========================

type SLABreachItem struct {
	HostIP      string  `json:"host_ip" gorm:"column:host_ip"`
	TaskName    string  `json:"task_name" gorm:"column:task_name"`
	VulnName    string  `json:"vuln_name" gorm:"column:vuln_name"`
	Severity    float64 `json:"severity" gorm:"column:severity"`
	Level       string  `json:"level" gorm:"column:level"`
	DaysOpen    int     `json:"days_open" gorm:"column:days_open"`
	SLADays     int     `json:"sla_days" gorm:"column:sla_days"`
	SLAStatus   string  `json:"sla_status" gorm:"column:sla_status"`
	OverdueDays int     `json:"overdue_days" gorm:"column:overdue_days"`
	ScannedAt   string  `json:"scanned_at" gorm:"column:scanned_at"`
}

// ========================
// Attack Surface Matrix
// ========================

type AttackSurfaceRow struct {
	HostIP      string  `gorm:"column:host_ip"`
	Family      string  `gorm:"column:family"`
	VulnCount   int     `gorm:"column:vuln_count"`
	MaxSeverity float64 `gorm:"column:max_severity"`
}

type AttackSurfaceMatrix struct {
	Hosts    []string                       `json:"hosts"`
	Families []string                       `json:"families"`
	Matrix   map[string]map[string]CellData `json:"matrix"`
	MaxCell  int                            `json:"max_cell"`
}

type CellData struct {
	Count    int     `json:"count"`
	Severity float64 `json:"severity"`
}

// ========================
// Internal helpers
// ========================

func slaInfo(level string) (days int) {
	switch level {
	case "Critical":
		return 7
	case "High":
		return 30
	case "Medium":
		return 90
	default:
		return 0
	}
}

func slaStatus(level string, daysOpen int) (status string, slaDays int) {
	slaDays = slaInfo(level)
	if slaDays == 0 {
		return "n/a", 0
	}
	if daysOpen >= slaDays {
		return "breach", slaDays
	}
	if float64(daysOpen) >= float64(slaDays)*0.7 {
		return "warning", slaDays
	}
	return "ok", slaDays
}

func calcRisk(cvss, epss float64, isKEV, isRansomware bool, critScore int) float64 {
	score := (cvss/10.0)*25.0 + epss*35.0
	if isKEV {
		score += 20.0
	}
	if isRansomware {
		score += 10.0
	}
	score += float64(critScore-1) * 2.5
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

// ========================
// GET /host/:ip/summary
// ========================

type vulnRow struct {
	TaskName  string  `gorm:"column:task_name"`
	ScannedAt string  `gorm:"column:scanned_at"`
	VulnName  string  `gorm:"column:vuln_name"`
	Family    string  `gorm:"column:family"`
	Severity  float64 `gorm:"column:severity"`
	Level     string  `gorm:"column:level"`
	Port      string  `gorm:"column:port"`
	CVEList   string  `gorm:"column:cve_list"`
	DaysOpen  int     `gorm:"column:days_open"`
}

func GetHostSummary(c *gin.Context) {
	ip := strings.TrimSpace(c.Param("ip"))
	if ip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ip is required"})
		return
	}

	db := config.DB()

	const vulnSQL = `
WITH LatestReport AS (
  SELECT DISTINCT ON (r.host)
    r.host AS host_ip,
    rp.id  AS report_id,
    COALESCE(t.name, '') AS task_name,
    TO_CHAR(
      to_timestamp(rp.creation_time) AT TIME ZONE 'Asia/Bangkok',
      'YYYY-MM-DD HH24:MI:SS'
    ) AS scanned_at,
    rp.creation_time
  FROM public.results r
  JOIN public.reports rp ON rp.id = r.report
  LEFT JOIN public.tasks t ON t.id = rp.task
  WHERE r.host = ?
    AND r.host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
  ORDER BY r.host, rp.creation_time DESC, rp.id DESC
),
CVERefs AS (
  SELECT
    r.nvt AS nvt_oid,
    STRING_AGG(DISTINCT UPPER(BTRIM(vr.ref_id)), ', '
      ORDER BY UPPER(BTRIM(vr.ref_id))) AS cve_list
  FROM LatestReport lr
  JOIN public.results r  ON r.report = lr.report_id AND r.host = lr.host_ip
  JOIN public.vt_refs vr ON vr.vt_oid = r.nvt
    AND LOWER(BTRIM(vr.type)) = 'cve'
    AND UPPER(BTRIM(vr.ref_id)) ~ '^CVE-[0-9]{4}-[0-9]+$'
  GROUP BY r.nvt
),
VulnAgg AS (
  SELECT
    lr.task_name,
    lr.scanned_at,
    lr.creation_time,
    COALESCE(NULLIF(BTRIM(n.name),   ''), r.nvt::text) AS vuln_name,
    COALESCE(NULLIF(BTRIM(n.family), ''), 'Unknown')   AS family,
    MAX(COALESCE(r.severity, 0))::float8 AS severity,
    CASE
      WHEN MAX(COALESCE(r.severity, 0)) >= 9 THEN 'Critical'
      WHEN MAX(COALESCE(r.severity, 0)) >= 7 THEN 'High'
      WHEN MAX(COALESCE(r.severity, 0)) >= 4 THEN 'Medium'
      WHEN MAX(COALESCE(r.severity, 0)) >  0 THEN 'Low'
      ELSE 'Info'
    END AS level,
    STRING_AGG(DISTINCT NULLIF(BTRIM(r.port), ''), ', ') AS port,
    r.nvt AS nvt_oid
  FROM LatestReport lr
  JOIN public.results r ON r.report = lr.report_id AND r.host = lr.host_ip
  LEFT JOIN public.nvts n ON n.oid = r.nvt
  WHERE COALESCE(r.severity, 0) >= 0
  GROUP BY lr.task_name, lr.scanned_at, lr.creation_time,
    COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text),
    COALESCE(NULLIF(BTRIM(n.family), ''), 'Unknown'),
    r.nvt
)
SELECT
  va.task_name,
  va.scanned_at,
  va.vuln_name,
  va.family,
  va.severity,
  va.level,
  COALESCE(va.port, '') AS port,
  COALESCE(cr.cve_list, '') AS cve_list,
  GREATEST(0, (CURRENT_DATE - (to_timestamp(va.creation_time) AT TIME ZONE 'Asia/Bangkok')::date))::int AS days_open
FROM VulnAgg va
LEFT JOIN CVERefs cr ON cr.nvt_oid = va.nvt_oid
ORDER BY va.severity DESC, va.vuln_name
`

	var rows []vulnRow
	finalVulnSQL := strings.ReplaceAll(vulnSQL, "'Asia/Bangkok'", "'"+setting.GetAppTimezone()+"'")
	if err := db.Raw(finalVulnSQL, ip).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(rows) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no scan data found for host " + ip})
		return
	}

	// Collect CVE IDs
	cveSet := make(map[string]bool)
	for _, r := range rows {
		for _, cve := range strings.Split(r.CVEList, ", ") {
			if t := strings.TrimSpace(cve); t != "" {
				cveSet[t] = true
			}
		}
	}
	cveList := make([]string, 0, len(cveSet))
	for cve := range cveSet {
		cveList = append(cveList, cve)
	}

	// Load EPSS & KEV from cache
	epssMap := make(map[string]entity.AppEPSSCache)
	kevMap := make(map[string]entity.AppKEVCache)
	if len(cveList) > 0 {
		var epssRows []entity.AppEPSSCache
		db.Where("cve_id IN ?", cveList).Find(&epssRows)
		for _, e := range epssRows {
			epssMap[e.CVEID] = e
		}

		var kevRows []entity.AppKEVCache
		db.Where("cve_id IN ?", cveList).Find(&kevRows)
		for _, k := range kevRows {
			kevMap[k.CVEID] = k
		}
	}

	// Load asset criticality
	var asset entity.AppAssetCriticality
	db.Where("host_ip = ?", ip).First(&asset)
	critScore := asset.CriticalityScore
	if critScore == 0 {
		critScore = 3
	}
	critLabel := asset.Criticality
	if critLabel == "" {
		critLabel = "medium"
	}

	// Build response
	resp := HostSummaryResponse{
		HostIP:    ip,
		TaskName:  rows[0].TaskName,
		ScannedAt: rows[0].ScannedAt,
		Asset: HostAssetInfo{
			Criticality:      critLabel,
			CriticalityScore: critScore,
			AssetType:        asset.AssetType,
			Owner:            asset.Owner,
			BusinessImpact:   asset.BusinessImpact,
		},
		KEVItems:        make([]KEVHitItem, 0),
		TopEPSS:         make([]EPSSHitItem, 0),
		Vulnerabilities: make([]HostVulnDetail, 0),
	}

	kevSeen := make(map[string]bool)
	epssItems := make([]EPSSHitItem, 0)
	maxRisk := 0.0

	for _, r := range rows {
		switch r.Level {
		case "Critical":
			resp.Critical++
		case "High":
			resp.High++
		case "Medium":
			resp.Medium++
		case "Low":
			resp.Low++
		default:
			resp.Info++
		}
		resp.Total++

		status, slaDays := slaStatus(r.Level, r.DaysOpen)
		if status == "breach" {
			resp.SLABreachCount++
		} else if status == "warning" {
			resp.SLAWarningCount++
		}

		bestEPSS := 0.0
		isKEV := false
		isRansomware := false

		for _, cve := range strings.Split(r.CVEList, ", ") {
			cve = strings.TrimSpace(cve)
			if cve == "" {
				continue
			}
			if e, ok := epssMap[cve]; ok && e.EPSSScore > bestEPSS {
				bestEPSS = e.EPSSScore
				epssItems = append(epssItems, EPSSHitItem{
					CVEID:      cve,
					EPSSScore:  e.EPSSScore,
					Percentile: e.Percentile,
					VulnName:   r.VulnName,
				})
			}
			if k, ok := kevMap[cve]; ok {
				isKEV = true
				if strings.EqualFold(strings.TrimSpace(k.KnownRansomwareCampaignUse), "Known") {
					isRansomware = true
				}
				if !kevSeen[cve] {
					kevSeen[cve] = true
					dueDate := ""
					if k.DueDate != nil {
						dueDate = k.DueDate.Format("2006-01-02")
					}
					resp.KEVItems = append(resp.KEVItems, KEVHitItem{
						CVEID:             cve,
						VulnerabilityName: k.VulnerabilityName,
						Product:           k.Product,
						IsRansomware:      strings.EqualFold(strings.TrimSpace(k.KnownRansomwareCampaignUse), "Known"),
						DueDate:           dueDate,
					})
				}
			}
		}

		rs := calcRisk(r.Severity, bestEPSS, isKEV, isRansomware, critScore)
		if rs > maxRisk {
			maxRisk = rs
		}

		resp.Vulnerabilities = append(resp.Vulnerabilities, HostVulnDetail{
			VulnName:  r.VulnName,
			Family:    r.Family,
			Severity:  r.Severity,
			Level:     r.Level,
			Port:      r.Port,
			CVEList:   r.CVEList,
			DaysOpen:  r.DaysOpen,
			SLAStatus: status,
			SLADays:   slaDays,
			RiskScore: rs,
		})
	}

	resp.KEVCount = len(kevSeen)
	resp.RiskScore = maxRisk
	resp.RiskLevel = riskLevel(maxRisk)

	// Top 5 EPSS (deduplicated by CVE ID)
	sort.Slice(epssItems, func(i, j int) bool {
		return epssItems[i].EPSSScore > epssItems[j].EPSSScore
	})
	seenCVE := make(map[string]bool)
	for _, e := range epssItems {
		if seenCVE[e.CVEID] {
			continue
		}
		seenCVE[e.CVEID] = true
		resp.TopEPSS = append(resp.TopEPSS, e)
		if len(resp.TopEPSS) >= 5 {
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": resp})
}

// ========================
// GET /vulnerabilities/sla-breaches
// ========================

func GetSLABreaches(c *gin.Context) {
	db := config.DB()

	const slaSQL = `
WITH LatestReports AS (
  SELECT DISTINCT ON (rp.task)
    rp.task AS task_id,
    rp.id   AS report_id,
    rp.creation_time
  FROM public.reports rp
  ORDER BY rp.task, rp.creation_time DESC, rp.id DESC
),
VulnBase AS (
  SELECT
    r.host AS host_ip,
    COALESCE(t.name, '') AS task_name,
    COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text) AS vuln_name,
    MAX(COALESCE(r.severity, 0))::float8 AS severity,
    CASE
      WHEN MAX(COALESCE(r.severity, 0)) >= 9 THEN 'Critical'
      WHEN MAX(COALESCE(r.severity, 0)) >= 7 THEN 'High'
      WHEN MAX(COALESCE(r.severity, 0)) >= 4 THEN 'Medium'
      ELSE 'Low'
    END AS level,
    GREATEST(0,
      (CURRENT_DATE - (to_timestamp(lr.creation_time) AT TIME ZONE 'Asia/Bangkok')::date)
    )::int AS days_open,
    TO_CHAR(
      to_timestamp(lr.creation_time) AT TIME ZONE 'Asia/Bangkok',
      'YYYY-MM-DD'
    ) AS scanned_at
  FROM public.results r
  JOIN LatestReports lr ON lr.report_id = r.report
  LEFT JOIN public.tasks t ON t.id = lr.task_id
  LEFT JOIN public.nvts n ON n.oid = r.nvt
  WHERE r.host IS NOT NULL
    AND BTRIM(r.host) <> ''
    AND r.host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
    AND COALESCE(r.severity, 0) >= 4
  GROUP BY r.host, t.name, COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text), lr.creation_time
),
WithSLA AS (
  SELECT
    vb.*,
    CASE level
      WHEN 'Critical' THEN 7
      WHEN 'High'     THEN 30
      WHEN 'Medium'   THEN 90
      ELSE 999
    END AS sla_days
  FROM VulnBase vb
)
SELECT
  ws.host_ip,
  ws.task_name,
  ws.vuln_name,
  ws.severity,
  ws.level,
  ws.days_open,
  ws.sla_days,
  ws.scanned_at,
  CASE
    WHEN ws.days_open >= ws.sla_days               THEN 'breach'
    WHEN ws.days_open >= ws.sla_days * 0.7::numeric THEN 'warning'
    ELSE 'ok'
  END AS sla_status,
  GREATEST(0, ws.days_open - ws.sla_days) AS overdue_days
FROM WithSLA ws
WHERE ws.days_open >= ws.sla_days * 0.7::numeric
ORDER BY
  CASE WHEN ws.days_open >= ws.sla_days THEN 0 ELSE 1 END,
  (ws.days_open - ws.sla_days) DESC,
  ws.severity DESC
`

	var items []SLABreachItem
	finalSlaSQL := strings.ReplaceAll(slaSQL, "'Asia/Bangkok'", "'"+setting.GetAppTimezone()+"'")
	if err := db.Raw(finalSlaSQL).Scan(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = make([]SLABreachItem, 0)
	}

	breachCount := 0
	warningCount := 0
	for _, it := range items {
		if it.SLAStatus == "breach" {
			breachCount++
		} else {
			warningCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":          items,
		"breach_count":  breachCount,
		"warning_count": warningCount,
		"total":         len(items),
	})
}

// ========================
// GET /attack-surface/matrix
// ========================

func GetAttackSurfaceMatrix(c *gin.Context) {
	db := config.DB()

	const matrixSQL = `
WITH LatestReports AS (
  SELECT DISTINCT ON (rp.task)
    rp.task AS task_id,
    rp.id   AS report_id
  FROM public.reports rp
  ORDER BY rp.task, rp.creation_time DESC
)
SELECT
  r.host AS host_ip,
  COALESCE(NULLIF(BTRIM(n.family), ''), 'Unknown') AS family,
  COUNT(DISTINCT COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text))::int AS vuln_count,
  MAX(COALESCE(r.severity, 0))::float8 AS max_severity
FROM public.results r
JOIN LatestReports lr ON lr.report_id = r.report
LEFT JOIN public.nvts n ON n.oid = r.nvt
WHERE r.host IS NOT NULL
  AND BTRIM(r.host) <> ''
  AND r.host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
  AND COALESCE(r.severity, 0) > 0
GROUP BY r.host, COALESCE(NULLIF(BTRIM(n.family), ''), 'Unknown')
ORDER BY r.host, COUNT(DISTINCT COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text)) DESC
`

	var rows []AttackSurfaceRow
	if err := db.Raw(matrixSQL).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build matrix
	hostSet := make(map[string]bool)
	familySet := make(map[string]bool)
	matrix := make(map[string]map[string]CellData)
	maxCell := 0

	for _, r := range rows {
		hostSet[r.HostIP] = true
		familySet[r.Family] = true
		if matrix[r.HostIP] == nil {
			matrix[r.HostIP] = make(map[string]CellData)
		}
		matrix[r.HostIP][r.Family] = CellData{
			Count:    r.VulnCount,
			Severity: r.MaxSeverity,
		}
		if r.VulnCount > maxCell {
			maxCell = r.VulnCount
		}
	}

	hosts := make([]string, 0, len(hostSet))
	for h := range hostSet {
		hosts = append(hosts, h)
	}
	sort.Strings(hosts)

	// Sort families by total vuln count descending (top families first)
	type familyTotal struct {
		name  string
		total int
	}
	ftList := make([]familyTotal, 0, len(familySet))
	for f := range familySet {
		t := 0
		for _, h := range hosts {
			if cell, ok := matrix[h][f]; ok {
				t += cell.Count
			}
		}
		ftList = append(ftList, familyTotal{f, t})
	}
	sort.Slice(ftList, func(i, j int) bool {
		return ftList[i].total > ftList[j].total
	})
	families := make([]string, 0, len(ftList))
	for _, ft := range ftList {
		families = append(families, ft.name)
	}
	// Cap families at top 20 for readability
	if len(families) > 20 {
		families = families[:20]
	}

	c.JSON(http.StatusOK, gin.H{
		"data": AttackSurfaceMatrix{
			Hosts:    hosts,
			Families: families,
			Matrix:   matrix,
			MaxCell:  maxCell,
		},
	})
}
