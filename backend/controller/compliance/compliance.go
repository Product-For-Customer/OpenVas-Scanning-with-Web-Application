package compliance

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/gin-gonic/gin"
)

// ===========================
// DTOs
// ===========================

type ControlStatus struct {
	ControlID   string `json:"control_id"`
	ControlName string `json:"control_name"`
	Framework   string `json:"framework"`
	Status      string `json:"status"` // compliant, warning, non_compliant
	Violations  int    `json:"violations"`
	Detail      string `json:"detail"`
}

type FrameworkScore struct {
	Framework    string          `json:"framework"`
	FullName     string          `json:"full_name"`
	Score        int             `json:"score"`
	Compliant    int             `json:"compliant"`
	Warning      int             `json:"warning"`
	NonCompliant int             `json:"non_compliant"`
	Total        int             `json:"total"`
	Controls     []ControlStatus `json:"controls"`
}

type ComplianceReport struct {
	GeneratedAt  string           `json:"generated_at"`
	Frameworks   []FrameworkScore `json:"frameworks"`
	OverallScore int              `json:"overall_score"`
	ScanCount    int              `json:"scan_count"`
	LastScanDate string           `json:"last_scan_date"`
}

// ===========================
// Vulnerability Counts
// ===========================

type vulnCounts struct {
	Critical  int
	High      int
	Medium    int
	Low       int
	Total     int
	KEVCount  int
	ScanCount int
	LastScan  string
}

func getVulnCounts() vulnCounts {
	gdb := config.DB()
	var counts vulnCounts

	// Count vulnerabilities from latest reports per task
	type row struct {
		Critical int `gorm:"column:critical"`
		High     int `gorm:"column:high"`
		Medium   int `gorm:"column:medium"`
		Low      int `gorm:"column:low"`
		Total    int `gorm:"column:total"`
	}
	var r row
	gdb.Raw(`
		SELECT
			COUNT(CASE WHEN severity >= 9 THEN 1 END)::int AS critical,
			COUNT(CASE WHEN severity >= 7 AND severity < 9 THEN 1 END)::int AS high,
			COUNT(CASE WHEN severity >= 4 AND severity < 7 THEN 1 END)::int AS medium,
			COUNT(CASE WHEN severity > 0 AND severity < 4 THEN 1 END)::int AS low,
			COUNT(*)::int AS total
		FROM public.results r
		JOIN public.reports rp ON rp.id = r.report
		WHERE r.host IS NOT NULL
			AND BTRIM(r.host) <> ''
			AND COALESCE(r.severity, 0) >= 0
			AND rp.id IN (
				SELECT DISTINCT ON (task) id
				FROM public.reports
				WHERE task IS NOT NULL
				ORDER BY task, creation_time DESC
			)
	`).Scan(&r)

	counts.Critical = r.Critical
	counts.High = r.High
	counts.Medium = r.Medium
	counts.Low = r.Low
	counts.Total = r.Total

	// KEV count from cross-reference
	gdb.Raw(`
		SELECT COUNT(DISTINCT k.cve_id)::int
		FROM app_kev_caches k
		JOIN public.vt_refs vtr ON UPPER(BTRIM(vtr.ref_id)) = k.cve_id AND LOWER(BTRIM(vtr.type)) = 'cve'
		JOIN public.results r ON r.nvt = vtr.vt_oid
		JOIN public.reports rp ON rp.id = r.report
		WHERE rp.id IN (
			SELECT DISTINCT ON (task) id FROM public.reports
			WHERE task IS NOT NULL
			ORDER BY task, creation_time DESC
		)
	`).Scan(&counts.KEVCount)

	// Scan count
	gdb.Raw(`SELECT COUNT(DISTINCT id) FROM public.reports WHERE task IS NOT NULL`).Scan(&counts.ScanCount)

	// Last scan date
	var lastScanUnix int64
	gdb.Raw(`SELECT COALESCE(MAX(creation_time), 0) FROM public.reports`).Scan(&lastScanUnix)
	if lastScanUnix > 0 {
		counts.LastScan = time.Unix(lastScanUnix, 0).Format("2006-01-02")
	}

	return counts
}

// ===========================
// Compliance Scoring Logic
// ===========================

func buildStatus(violations int, threshold int, warnThreshold int) string {
	if violations == 0 {
		return "compliant"
	}
	if violations <= warnThreshold {
		return "warning"
	}
	return "non_compliant"
}

func buildPCIDSS(counts vulnCounts) FrameworkScore {
	controls := []ControlStatus{
		{
			ControlID:   "6.3.3",
			ControlName: "Critical/High Vulnerability Patching",
			Framework:   "PCI_DSS",
			Status:      buildStatus(counts.Critical+counts.High, 0, 5),
			Violations:  counts.Critical + counts.High,
			Detail:      "Critical and High vulnerabilities must be remediated. " + intStr(counts.Critical+counts.High) + " open findings.",
		},
		{
			ControlID:   "11.3.1",
			ControlName: "Internal Vulnerability Scans",
			Framework:   "PCI_DSS",
			Status:      scanFreqStatus(counts.ScanCount),
			Violations:  0,
			Detail:      intStr(counts.ScanCount) + " scans performed. Last scan: " + counts.LastScan,
		},
		{
			ControlID:   "6.2.4",
			ControlName: "Prevent Common Vulnerabilities",
			Framework:   "PCI_DSS",
			Status:      buildStatus(counts.Critical, 0, 2),
			Violations:  counts.Critical,
			Detail:      intStr(counts.Critical) + " critical vulnerabilities open.",
		},
		{
			ControlID:   "BOD-22-01",
			ControlName: "Known Exploited Vulnerabilities (KEV)",
			Framework:   "PCI_DSS",
			Status:      buildStatus(counts.KEVCount, 0, 0),
			Violations:  counts.KEVCount,
			Detail:      intStr(counts.KEVCount) + " KEV vulnerabilities detected in scans.",
		},
	}
	return calcScore("PCI_DSS", "PCI DSS v4.0", controls)
}

func buildISO27001(counts vulnCounts) FrameworkScore {
	controls := []ControlStatus{
		{
			ControlID:   "A.8.8",
			ControlName: "Management of Technical Vulnerabilities",
			Framework:   "ISO_27001",
			Status:      buildStatus(counts.Critical+counts.High, 0, 10),
			Violations:  counts.Critical + counts.High,
			Detail:      intStr(counts.Critical+counts.High) + " critical/high vulnerabilities require remediation.",
		},
		{
			ControlID:   "A.8.20",
			ControlName: "Networks Security",
			Framework:   "ISO_27001",
			Status:      buildStatus(counts.Critical, 0, 3),
			Violations:  counts.Critical,
			Detail:      intStr(counts.Critical) + " critical network vulnerabilities.",
		},
		{
			ControlID:   "A.5.37",
			ControlName: "Documented Operating Procedures",
			Framework:   "ISO_27001",
			Status:      scanFreqStatus(counts.ScanCount),
			Violations:  0,
			Detail:      "Vulnerability scanning process in place. " + intStr(counts.ScanCount) + " total scans.",
		},
		{
			ControlID:   "A.8.16",
			ControlName: "Monitoring Activities",
			Framework:   "ISO_27001",
			Status:      "compliant",
			Violations:  0,
			Detail:      "Active vulnerability monitoring and alerting via OpenVAS and LINE notifications.",
		},
	}
	return calcScore("ISO_27001", "ISO/IEC 27001:2022", controls)
}

func buildNISTCSF(counts vulnCounts) FrameworkScore {
	controls := []ControlStatus{
		{
			ControlID:   "ID.RA-1",
			ControlName: "Asset Vulnerabilities Identified",
			Framework:   "NIST_CSF",
			Status:      "compliant",
			Violations:  0,
			Detail:      "Automated vulnerability scanning operational. " + intStr(counts.Total) + " total findings tracked.",
		},
		{
			ControlID:   "ID.RA-5",
			ControlName: "Threats, Vulnerabilities, Likelihoods Assessed",
			Framework:   "NIST_CSF",
			Status:      "compliant",
			Violations:  0,
			Detail:      "Risk scoring using CVSS + EPSS + KEV intelligence operational.",
		},
		{
			ControlID:   "PR.IP-1",
			ControlName: "Baseline Configuration",
			Framework:   "NIST_CSF",
			Status:      buildStatus(counts.Critical, 0, 5),
			Violations:  counts.Critical,
			Detail:      intStr(counts.Critical) + " critical vulnerabilities indicate possible baseline deviation.",
		},
		{
			ControlID:   "RS.AN-1",
			ControlName: "Notifications Investigated",
			Framework:   "NIST_CSF",
			Status:      "compliant",
			Violations:  0,
			Detail:      "LINE notification system active for vulnerability alerts.",
		},
		{
			ControlID:   "RS.RP-1",
			ControlName: "Response Plan Executed",
			Framework:   "NIST_CSF",
			Status:      buildStatus(counts.KEVCount, 0, 0),
			Violations:  counts.KEVCount,
			Detail:      intStr(counts.KEVCount) + " CISA KEV items require immediate response.",
		},
	}
	return calcScore("NIST_CSF", "NIST Cybersecurity Framework 2.0", controls)
}

func buildCISControls(counts vulnCounts) FrameworkScore {
	controls := []ControlStatus{
		{
			ControlID:   "CIS-7.1",
			ControlName: "Establish Vulnerability Management Process",
			Framework:   "CIS_CONTROLS",
			Status:      "compliant",
			Violations:  0,
			Detail:      "Vulnerability management process established using OpenVAS scanner.",
		},
		{
			ControlID:   "CIS-7.3",
			ControlName: "Perform Automated Vulnerability Scans",
			Framework:   "CIS_CONTROLS",
			Status:      scanFreqStatus(counts.ScanCount),
			Violations:  0,
			Detail:      intStr(counts.ScanCount) + " automated scans performed. Last: " + counts.LastScan,
		},
		{
			ControlID:   "CIS-7.4",
			ControlName: "Remediate Detected Vulnerabilities",
			Framework:   "CIS_CONTROLS",
			Status:      buildStatus(counts.Critical+counts.High, 0, 10),
			Violations:  counts.Critical + counts.High,
			Detail:      intStr(counts.Critical+counts.High) + " critical/high vulnerabilities pending remediation.",
		},
		{
			ControlID:   "CIS-7.5",
			ControlName: "Use Automated Patch Management",
			Framework:   "CIS_CONTROLS",
			Status:      buildStatus(counts.Critical, 0, 3),
			Violations:  counts.Critical,
			Detail:      intStr(counts.Critical) + " critical patches needed immediately.",
		},
	}
	return calcScore("CIS_CONTROLS", "CIS Controls v8", controls)
}

func calcScore(framework, fullName string, controls []ControlStatus) FrameworkScore {
	fs := FrameworkScore{
		Framework: framework,
		FullName:  fullName,
		Controls:  controls,
		Total:     len(controls),
	}
	for _, c := range controls {
		switch c.Status {
		case "compliant":
			fs.Compliant++
		case "warning":
			fs.Warning++
		case "non_compliant":
			fs.NonCompliant++
		}
	}
	// Score: compliant=100%, warning=50%, non_compliant=0%
	if fs.Total > 0 {
		pts := float64(fs.Compliant)*100 + float64(fs.Warning)*50
		fs.Score = int(pts / float64(fs.Total))
	}
	return fs
}

func scanFreqStatus(scanCount int) string {
	if scanCount == 0 {
		return "non_compliant"
	}
	if scanCount < 3 {
		return "warning"
	}
	return "compliant"
}

func intStr(n int) string {
	return fmt.Sprintf("%d", n)
}

// ===========================
// Handlers
// ===========================

func GetComplianceReport(c *gin.Context) {
	counts := getVulnCounts()

	pciDSS := buildPCIDSS(counts)
	iso27001 := buildISO27001(counts)
	nistCSF := buildNISTCSF(counts)
	cisControls := buildCISControls(counts)

	frameworks := []FrameworkScore{pciDSS, iso27001, nistCSF, cisControls}

	totalScore := 0
	for _, f := range frameworks {
		totalScore += f.Score
	}
	overallScore := 0
	if len(frameworks) > 0 {
		overallScore = totalScore / len(frameworks)
	}

	report := ComplianceReport{
		GeneratedAt:  time.Now().Format(time.RFC3339),
		Frameworks:   frameworks,
		OverallScore: overallScore,
		ScanCount:    counts.ScanCount,
		LastScanDate: counts.LastScan,
	}

	c.JSON(http.StatusOK, gin.H{"data": report})
}

func GetComplianceViolations(c *gin.Context) {
	framework := c.Query("framework")
	counts := getVulnCounts()

	allFrameworks := []FrameworkScore{
		buildPCIDSS(counts),
		buildISO27001(counts),
		buildNISTCSF(counts),
		buildCISControls(counts),
	}

	var violations []ControlStatus
	for _, f := range allFrameworks {
		if framework != "" && f.Framework != framework {
			continue
		}
		for _, ctrl := range f.Controls {
			if ctrl.Status != "compliant" {
				violations = append(violations, ctrl)
			}
		}
	}

	if violations == nil {
		violations = []ControlStatus{}
	}

	c.JSON(http.StatusOK, gin.H{"data": violations})
}

// ===========================
// Control Vulnerability Detail
// ===========================

type ViolationVulnDTO struct {
	TaskID            string  `json:"task_id"`
	TaskName          string  `json:"task_name"`
	IP                string  `json:"ip"`
	VulnerabilityID   string  `json:"vulnerability_id"`
	VulnerabilityName string  `json:"vulnerability_name"`
	Severity          float64 `json:"severity"`
	SeverityLabel     string  `json:"severity_label"`
	CVEList           string  `json:"cve_list"`
	Summary           string  `json:"summary"`
	Impact            string  `json:"impact"`
	Insight           string  `json:"insight"`
	Affected          string  `json:"affected"`
	Solution          string  `json:"solution"`
	SolutionType      string  `json:"solution_type"`
}

func sevLabel(s float64) string {
	if s >= 9 {
		return "Critical"
	}
	if s >= 7 {
		return "High"
	}
	if s >= 4 {
		return "Medium"
	}
	if s > 0 {
		return "Low"
	}
	return "Info"
}

// controlSeverityFilter returns the WHERE clause fragment for severity
// based on which violations each control tracks.
//
//	"crit_high" → severity >= 7
//	"crit"      → severity >= 9
//	"kev"       → joined against app_kev_caches (handled separately)
//	""          → no violations (compliant/scan-based)
func controlViolationKind(controlID string) string {
	critHigh := map[string]bool{
		"6.3.3": true, "A.8.8": true, "CIS-7.4": true,
	}
	critOnly := map[string]bool{
		"6.2.4": true, "A.8.20": true, "PR.IP-1": true, "CIS-7.5": true,
	}
	kevOnly := map[string]bool{
		"BOD-22-01": true, "RS.RP-1": true,
	}

	if critHigh[controlID] {
		return "crit_high"
	}
	if critOnly[controlID] {
		return "crit"
	}
	if kevOnly[controlID] {
		return "kev"
	}
	return ""
}

func queryVulnsBySeverity(minSeverity float64) []ViolationVulnDTO {
	gdb := config.DB()

	type row struct {
		TaskID   string  `gorm:"column:task_id"`
		TaskName string  `gorm:"column:task_name"`
		IP       string  `gorm:"column:ip"`
		NvtOID   string  `gorm:"column:nvt_oid"`
		VulnName string  `gorm:"column:vuln_name"`
		Severity float64 `gorm:"column:severity"`
		CVEList  string  `gorm:"column:cve_list"`
		Summary  string  `gorm:"column:summary"`
		Impact   string  `gorm:"column:impact"`
		Insight  string  `gorm:"column:insight"`
		Affected string  `gorm:"column:affected"`
		Solution string  `gorm:"column:solution"`
		SolType  string  `gorm:"column:sol_type"`
	}

	sql := `
SELECT
    t.id::text                                                   AS task_id,
    COALESCE(NULLIF(BTRIM(t.name),''),'Unknown Task')           AS task_name,
    COALESCE(NULLIF(BTRIM(r.host),''),'N/A')                   AS ip,
    r.nvt                                                        AS nvt_oid,
    COALESCE(NULLIF(BTRIM(n.name),''),r.nvt::text,'Unknown')   AS vuln_name,
    ROUND(COALESCE(r.severity,0)::numeric,2)::float8            AS severity,
    COALESCE(STRING_AGG(DISTINCT UPPER(BTRIM(vr.ref_id)),', ')
        FILTER (WHERE LOWER(BTRIM(vr.type))='cve' AND vr.ref_id IS NOT NULL),
    '')                                                          AS cve_list,
    COALESCE(NULLIF(BTRIM(COALESCE(n.summary,'')),''),'')       AS summary,
    COALESCE(NULLIF(BTRIM(COALESCE(n.impact,'')),''),'')        AS impact,
    COALESCE(NULLIF(BTRIM(COALESCE(n.insight,'')),''),'')       AS insight,
    COALESCE(NULLIF(BTRIM(COALESCE(n.affected,'')),''),'')      AS affected,
    COALESCE(NULLIF(BTRIM(COALESCE(n.solution,'')),''),'')      AS solution,
    COALESCE(NULLIF(BTRIM(COALESCE(n.solution_type,'')),''),'') AS sol_type
FROM public.results r
JOIN public.reports rp ON rp.id = r.report
JOIN public.tasks t    ON t.id  = rp.task
LEFT JOIN public.nvts n ON n.oid = r.nvt
LEFT JOIN public.vt_refs vr ON vr.vt_oid = r.nvt
WHERE r.host    IS NOT NULL
  AND BTRIM(r.host) <> ''
  AND r.nvt     IS NOT NULL
  AND COALESCE(r.severity,0) >= ?
  AND rp.id IN (
      SELECT DISTINCT ON (task) id
      FROM public.reports
      WHERE task IS NOT NULL
      ORDER BY task, creation_time DESC
  )
GROUP BY t.id, t.name, r.host, r.nvt, n.name, r.severity,
         n.summary, n.impact, n.insight, n.affected, n.solution, n.solution_type
ORDER BY severity DESC, task_id ASC
LIMIT 200
`

	var rows []row
	gdb.Raw(sql, minSeverity).Scan(&rows)

	out := make([]ViolationVulnDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, ViolationVulnDTO{
			TaskID:            r.TaskID,
			TaskName:          r.TaskName,
			IP:                r.IP,
			VulnerabilityID:   r.NvtOID,
			VulnerabilityName: r.VulnName,
			Severity:          r.Severity,
			SeverityLabel:     sevLabel(r.Severity),
			CVEList:           r.CVEList,
			Summary:           r.Summary,
			Impact:            r.Impact,
			Insight:           r.Insight,
			Affected:          r.Affected,
			Solution:          r.Solution,
			SolutionType:      r.SolType,
		})
	}
	return out
}

func queryVulnsKEV() []ViolationVulnDTO {
	gdb := config.DB()

	type row struct {
		TaskID   string  `gorm:"column:task_id"`
		TaskName string  `gorm:"column:task_name"`
		IP       string  `gorm:"column:ip"`
		NvtOID   string  `gorm:"column:nvt_oid"`
		VulnName string  `gorm:"column:vuln_name"`
		Severity float64 `gorm:"column:severity"`
		CVEList  string  `gorm:"column:cve_list"`
		Summary  string  `gorm:"column:summary"`
		Impact   string  `gorm:"column:impact"`
		Insight  string  `gorm:"column:insight"`
		Affected string  `gorm:"column:affected"`
		Solution string  `gorm:"column:solution"`
		SolType  string  `gorm:"column:sol_type"`
	}

	sql := `
SELECT
    t.id::text                                                   AS task_id,
    COALESCE(NULLIF(BTRIM(t.name),''),'Unknown Task')           AS task_name,
    COALESCE(NULLIF(BTRIM(r.host),''),'N/A')                   AS ip,
    r.nvt                                                        AS nvt_oid,
    COALESCE(NULLIF(BTRIM(n.name),''),r.nvt::text,'Unknown')   AS vuln_name,
    ROUND(COALESCE(r.severity,0)::numeric,2)::float8            AS severity,
    COALESCE(STRING_AGG(DISTINCT UPPER(BTRIM(vr.ref_id)),', ')
        FILTER (WHERE LOWER(BTRIM(vr.type))='cve' AND vr.ref_id IS NOT NULL),
    '')                                                          AS cve_list,
    COALESCE(NULLIF(BTRIM(COALESCE(n.summary,'')),''),'')       AS summary,
    COALESCE(NULLIF(BTRIM(COALESCE(n.impact,'')),''),'')        AS impact,
    COALESCE(NULLIF(BTRIM(COALESCE(n.insight,'')),''),'')       AS insight,
    COALESCE(NULLIF(BTRIM(COALESCE(n.affected,'')),''),'')      AS affected,
    COALESCE(NULLIF(BTRIM(COALESCE(n.solution,'')),''),'')      AS solution,
    COALESCE(NULLIF(BTRIM(COALESCE(n.solution_type,'')),''),'') AS sol_type
FROM public.results r
JOIN public.reports rp ON rp.id = r.report
JOIN public.tasks t    ON t.id  = rp.task
LEFT JOIN public.nvts n ON n.oid = r.nvt
LEFT JOIN public.vt_refs vr ON vr.vt_oid = r.nvt
WHERE r.host IS NOT NULL
  AND BTRIM(r.host) <> ''
  AND r.nvt IS NOT NULL
  AND rp.id IN (
      SELECT DISTINCT ON (task) id
      FROM public.reports
      WHERE task IS NOT NULL
      ORDER BY task, creation_time DESC
  )
  AND r.nvt IN (
      SELECT DISTINCT vtr.vt_oid
      FROM app_kev_caches k
      JOIN public.vt_refs vtr
        ON UPPER(BTRIM(vtr.ref_id)) = k.cve_id
       AND LOWER(BTRIM(vtr.type)) = 'cve'
  )
GROUP BY t.id, t.name, r.host, r.nvt, n.name, r.severity,
         n.summary, n.impact, n.insight, n.affected, n.solution, n.solution_type
ORDER BY severity DESC, task_id ASC
LIMIT 200
`

	var rows []row
	gdb.Raw(sql).Scan(&rows)

	out := make([]ViolationVulnDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, ViolationVulnDTO{
			TaskID:            r.TaskID,
			TaskName:          r.TaskName,
			IP:                r.IP,
			VulnerabilityID:   r.NvtOID,
			VulnerabilityName: r.VulnName,
			Severity:          r.Severity,
			SeverityLabel:     sevLabel(r.Severity),
			CVEList:           r.CVEList,
			Summary:           r.Summary,
			Impact:            r.Impact,
			Insight:           r.Insight,
			Affected:          r.Affected,
			Solution:          r.Solution,
			SolutionType:      r.SolType,
		})
	}
	return out
}

func GetControlVulnerabilities(c *gin.Context) {
	controlID := c.Query("control_id")
	if controlID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "control_id is required"})
		return
	}

	kind := controlViolationKind(controlID)

	var vulns []ViolationVulnDTO
	switch kind {
	case "crit_high":
		vulns = queryVulnsBySeverity(7.0)
	case "crit":
		vulns = queryVulnsBySeverity(9.0)
	case "kev":
		vulns = queryVulnsKEV()
	default:
		vulns = []ViolationVulnDTO{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  vulns,
		"count": len(vulns),
	})
}
