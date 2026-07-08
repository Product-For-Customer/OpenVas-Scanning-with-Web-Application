// Package remediation implements the Closed-Loop Remediation lifecycle: every
// distinct scan finding becomes a tracked work item that is opened, worked,
// and — crucially — *verified closed by a later scan that no longer detects
// it*. Detection lives in the read-only Greenbone tables; this package owns the
// lifecycle state on top of it (see entity.AppRemediation).
//
// sync.go is the engine that keeps that lifecycle in step with reality. It runs
// on a scheduler (and on demand) and reconciles the app's remediation rows
// against the latest scan report per task:
//
//   - a finding seen for the first time            → auto-open
//   - a finding claimed-fixed/closed but seen again → auto-reopen
//   - a tracked finding absent from a NEWER report  → auto-verify-closed (+ MTTR)
//
// The "newer report" guard is what makes closure trustworthy: a finding is only
// closed when the host was actually re-scanned and the weakness was gone — not
// merely because it stopped appearing in a query.
package remediation

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/line"
	"github.com/Tawunchai/openvas/controller/risk"
	"github.com/Tawunchai/openvas/controller/vulnerability"
	"github.com/Tawunchai/openvas/entity"
	"gorm.io/gorm"
)

// ── SQL ────────────────────────────────────────────────────────────────────

// latestReportPerTaskSQL returns the newest report for every task, regardless
// of whether that report contains any findings. We need this even for tasks
// whose latest scan came back clean, so a host that was fully remediated still
// gives us a "newer report id" to verify its old findings as closed against.
const latestReportPerTaskSQL = `
SELECT DISTINCT ON (rp.task)
  rp.task::text          AS task_id,
  rp.id::text            AS report_id,
  rp.creation_time::bigint AS creation_time
FROM public.reports rp
WHERE rp.task IS NOT NULL
ORDER BY rp.task, rp.creation_time DESC, rp.id DESC
`

// currentFindingsSQL fingerprints every severity-bearing finding in each task's
// latest report as (host, nvt, port) and snapshots the detection data the
// remediation view shows: name, family, CVEs, severity, and the vendor's
// solution text. Mirrors the fingerprinting used by the existing delta view so
// the two agree on what "the same finding" means.
const currentFindingsSQL = `
WITH LatestReportPerTask AS (
  SELECT DISTINCT ON (rp.task)
    rp.task AS task_id,
    rp.id AS report_id,
    rp.creation_time
  FROM public.reports rp
  WHERE rp.task IS NOT NULL
  ORDER BY rp.task, rp.creation_time DESC, rp.id DESC
),
CurrentFindings AS (
  SELECT
    r.host                                              AS host_ip,
    lrt.task_id::text                                   AS task_id,
    COALESCE(t.name, '')                                AS task_name,
    lrt.report_id::text                                 AS report_id,
    lrt.creation_time::bigint                           AS detected_unix,
    r.nvt::text                                         AS nvt_oid,
    COALESCE(NULLIF(BTRIM(r.port), ''), '')             AS port,
    COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text)    AS vuln_name,
    COALESCE(NULLIF(BTRIM(n.family), ''), '')           AS family,
    COALESCE(NULLIF(BTRIM(n.solution), ''), '')         AS solution,
    COALESCE(NULLIF(BTRIM(n.solution_type), ''), '')    AS solution_type,
    MAX(COALESCE(r.severity, 0))::float8                AS severity
  FROM LatestReportPerTask lrt
  JOIN public.results r ON r.report = lrt.report_id
  LEFT JOIN public.tasks t ON t.id = lrt.task_id
  LEFT JOIN public.nvts n ON n.oid = r.nvt
  WHERE r.host IS NOT NULL
    AND BTRIM(r.host) <> ''
    AND r.host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
    AND COALESCE(r.severity, 0) > 0
  GROUP BY r.host, lrt.task_id, t.name, lrt.report_id, lrt.creation_time,
           r.nvt, COALESCE(NULLIF(BTRIM(r.port), ''), ''),
           COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text),
           COALESCE(NULLIF(BTRIM(n.family), ''), ''),
           COALESCE(NULLIF(BTRIM(n.solution), ''), ''),
           COALESCE(NULLIF(BTRIM(n.solution_type), ''), '')
)
SELECT
  cf.host_ip, cf.task_id, cf.task_name, cf.report_id, cf.detected_unix,
  cf.nvt_oid, cf.port, cf.vuln_name, cf.family, cf.solution, cf.solution_type,
  cf.severity,
  COALESCE(cve.cve_list, '') AS cve_list
FROM CurrentFindings cf
LEFT JOIN (
  SELECT vr.vt_oid::text AS nvt_oid,
         STRING_AGG(DISTINCT UPPER(BTRIM(vr.ref_id)), ', ') AS cve_list
  FROM public.vt_refs vr
  WHERE LOWER(BTRIM(vr.type)) = 'cve'
    AND UPPER(BTRIM(vr.ref_id)) ~ '^CVE-[0-9]{4}-[0-9]+$'
  GROUP BY vr.vt_oid
) cve ON cve.nvt_oid = cf.nvt_oid
`

// ── row structs ─────────────────────────────────────────────────────────────

type latestReportRow struct {
	TaskID       string `gorm:"column:task_id"`
	ReportID     string `gorm:"column:report_id"`
	CreationTime int64  `gorm:"column:creation_time"`
}

type currentFindingRow struct {
	HostIP       string  `gorm:"column:host_ip"`
	TaskID       string  `gorm:"column:task_id"`
	TaskName     string  `gorm:"column:task_name"`
	ReportID     string  `gorm:"column:report_id"`
	DetectedUnix int64   `gorm:"column:detected_unix"`
	NvtOID       string  `gorm:"column:nvt_oid"`
	Port         string  `gorm:"column:port"`
	VulnName     string  `gorm:"column:vuln_name"`
	Family       string  `gorm:"column:family"`
	Solution     string  `gorm:"column:solution"`
	SolutionType string  `gorm:"column:solution_type"`
	Severity     float64 `gorm:"column:severity"`
	CVEList      string  `gorm:"column:cve_list"`
}

// ── helpers ─────────────────────────────────────────────────────────────────

// findingKey is the stable fingerprint that ties a weakness to one lifecycle
// row across re-scans. Same host + NVT + port ⇒ same finding, whatever report
// it shows up in.
func findingKey(host, nvt, port string) string {
	raw := strings.ToLower(strings.TrimSpace(host)) + "|" +
		strings.TrimSpace(nvt) + "|" + strings.TrimSpace(port)
	sum := sha1.Sum([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func normTaskID(s string) string {
	s = strings.TrimSpace(s)
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return strconv.FormatInt(n, 10)
	}
	return s
}

// reportNewer reports whether report id a is strictly newer than b. Greenbone
// report ids are monotonically increasing integers, so a plain numeric compare
// tells us a re-scan happened after the finding was last seen. An empty/older
// b is treated as "cannot confirm newer" to avoid closing a finding we never
// actually re-scanned.
func reportNewer(a, b string) bool {
	ai, aerr := strconv.ParseInt(strings.TrimSpace(a), 10, 64)
	bi, berr := strconv.ParseInt(strings.TrimSpace(b), 10, 64)
	if aerr != nil || berr != nil {
		return false
	}
	return ai > bi
}

func splitCVEs(list string) []string {
	if strings.TrimSpace(list) == "" {
		return nil
	}
	parts := strings.Split(list, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.ToUpper(strings.TrimSpace(p)); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// cvssBand maps an OpenVAS CVSS severity (0–10) to the standard severity band.
// This is what the UI shows as "Level", so it must track the CVSS score the row
// displays — not the composite risk score (which folds in EPSS/KEV/criticality
// and, when those are low, would peg almost everything to LOW). The composite
// score still drives ordering via RiskScore; the band drives the label + SLA.
func cvssBand(severity float64) string {
	switch {
	case severity >= 9:
		return "CRITICAL"
	case severity >= 7:
		return "HIGH"
	case severity >= 4:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

// dueDate derives an SLA target from the severity band. These windows are
// deliberately tighter for higher severity so the remediation queue
// self-prioritizes by deadline as well as by score.
func dueDate(from time.Time, level string) *time.Time {
	var days int
	switch level {
	case "CRITICAL":
		days = 7
	case "HIGH":
		days = 14
	case "MEDIUM":
		days = 30
	default:
		days = 90
	}
	d := from.AddDate(0, 0, days)
	return &d
}

func addSystemNote(db *gorm.DB, remediationID uint, kind, body string) {
	note := entity.AppRemediationNote{
		RemediationID: remediationID,
		Kind:          kind,
		AuthorName:    "system",
		Body:          body,
	}
	if err := db.Create(&note).Error; err != nil {
		log.Printf("⚠️ remediation: failed to write %s note for #%d: %v", kind, remediationID, err)
	}
}

func loadEPSS(db *gorm.DB, cves map[string]bool) map[string]entity.AppEPSSCache {
	out := map[string]entity.AppEPSSCache{}
	if len(cves) == 0 {
		return out
	}
	ids := make([]string, 0, len(cves))
	for c := range cves {
		ids = append(ids, c)
	}
	var rows []entity.AppEPSSCache
	db.Where("cve_id IN ?", ids).Find(&rows)
	for _, r := range rows {
		out[strings.ToUpper(r.CVEID)] = r
	}
	return out
}

func loadKEV(db *gorm.DB, cves map[string]bool) map[string]entity.AppKEVCache {
	out := map[string]entity.AppKEVCache{}
	if len(cves) == 0 {
		return out
	}
	ids := make([]string, 0, len(cves))
	for c := range cves {
		ids = append(ids, c)
	}
	var rows []entity.AppKEVCache
	db.Where("cve_id IN ?", ids).Find(&rows)
	for _, r := range rows {
		out[strings.ToUpper(r.CVEID)] = r
	}
	return out
}

func loadCrit(db *gorm.DB, hosts map[string]bool) map[string]entity.AppAssetCriticality {
	out := map[string]entity.AppAssetCriticality{}
	if len(hosts) == 0 {
		return out
	}
	ids := make([]string, 0, len(hosts))
	for h := range hosts {
		ids = append(ids, h)
	}
	var rows []entity.AppAssetCriticality
	db.Where("host_ip IN ?", ids).Find(&rows)
	for _, r := range rows {
		out[r.HostIP] = r
	}
	return out
}

// enrich resolves the CVE-derived risk inputs for a finding: the max EPSS score
// across its CVEs, and whether any CVE is a CISA KEV / known-ransomware entry.
func enrich(row currentFindingRow, epssMap map[string]entity.AppEPSSCache, kevMap map[string]entity.AppKEVCache) (epss float64, isKEV, isRansom bool) {
	for _, cve := range splitCVEs(row.CVEList) {
		if e, ok := epssMap[cve]; ok && e.EPSSScore > epss {
			epss = e.EPSSScore
		}
		if k, ok := kevMap[cve]; ok {
			isKEV = true
			if k.KnownRansomwareCampaignUse == "Known" {
				isRansom = true
			}
		}
	}
	return
}

func critScoreFor(host string, critMap map[string]entity.AppAssetCriticality) int {
	if a, ok := critMap[host]; ok && a.CriticalityScore >= 1 && a.CriticalityScore <= 5 {
		return a.CriticalityScore
	}
	return 3 // default "medium", same fallback as the risk engine
}

// ── engine ──────────────────────────────────────────────────────────────────

// SyncOnce reconciles remediation rows with the latest scan state exactly once
// and returns how many rows changed status (opened / reopened / verified). It
// is safe to call repeatedly and concurrently-idle; each call is a full,
// idempotent reconciliation.
func SyncOnce() (int, error) {
	db := config.DB()
	if db == nil {
		return 0, nil
	}

	// Respect the same managed-target limit the vulnerability views use, so the
	// remediation queue only ever tracks findings the operator can actually see.
	// Findings whose task drops out of the limit simply stop being reconciled —
	// they are never auto-closed, because closure needs that task's newer report
	// (which we no longer fetch), so no false "verified" can result.
	allowed, err := vulnerability.FindManageLimitTaskIDs(db)
	if err != nil {
		return 0, err
	}
	allowedSet := map[string]bool{}
	for _, t := range allowed {
		allowedSet[normTaskID(t)] = true
	}
	if len(allowedSet) == 0 {
		return 0, nil
	}

	// 1. latest report per (allowed) task
	var lrRows []latestReportRow
	if err := db.Raw(latestReportPerTaskSQL).Scan(&lrRows).Error; err != nil {
		return 0, err
	}
	latestByTask := map[string]latestReportRow{}
	for _, r := range lrRows {
		if allowedSet[normTaskID(r.TaskID)] {
			latestByTask[normTaskID(r.TaskID)] = r
		}
	}

	// 2. current findings (present set), plus CVE/host universe for enrichment
	var cfRows []currentFindingRow
	if err := db.Raw(currentFindingsSQL).Scan(&cfRows).Error; err != nil {
		return 0, err
	}
	present := map[string]currentFindingRow{}
	cveSet := map[string]bool{}
	hostSet := map[string]bool{}
	for _, r := range cfRows {
		if !allowedSet[normTaskID(r.TaskID)] {
			continue
		}
		key := findingKey(r.HostIP, r.NvtOID, r.Port)
		present[key] = r
		for _, cve := range splitCVEs(r.CVEList) {
			cveSet[cve] = true
		}
		hostSet[r.HostIP] = true
	}

	// 3. enrichment caches
	epssMap := loadEPSS(db, cveSet)
	kevMap := loadKEV(db, cveSet)
	critMap := loadCrit(db, hostSet)

	// 4. existing remediation rows, keyed by fingerprint
	var existing []entity.AppRemediation
	db.Find(&existing)
	existingByKey := map[string]entity.AppRemediation{}
	for _, e := range existing {
		existingByKey[e.FindingKey] = e
	}

	now := time.Now()
	changed := 0

	// Lifecycle events collected during reconciliation, announced once at the
	// end so a single sync produces at most one LINE message (never a flood).
	var closedEvents, reopenedEvents []string

	// 5. upsert everything currently present
	for key, r := range present {
		epss, isKEV, isRansom := enrich(r, epssMap, kevMap)
		crit := critScoreFor(r.HostIP, critMap)
		// RiskScore (composite) drives ordering/prioritization; RiskLevel (the
		// displayed band + SLA) tracks the CVSS severity so it isn't stuck on LOW.
		score := risk.CalcRiskScore(r.Severity, epss, isKEV, isRansom, crit)
		level := cvssBand(r.Severity)

		ex, found := existingByKey[key]
		if !found {
			detected := now
			if r.DetectedUnix > 0 {
				detected = time.Unix(r.DetectedUnix, 0)
			}
			rem := entity.AppRemediation{
				FindingKey:      key,
				HostIP:          r.HostIP,
				NVTOid:          r.NvtOID,
				Port:            r.Port,
				TaskID:          normTaskID(r.TaskID),
				TaskName:        r.TaskName,
				VulnName:        r.VulnName,
				Family:          r.Family,
				CVEList:         r.CVEList,
				Severity:        r.Severity,
				RiskScore:       score,
				RiskLevel:       level,
				IsKEV:           isKEV,
				EPSSScore:       epss,
				SolutionText:    r.Solution,
				SolutionType:    r.SolutionType,
				Status:          entity.RemediationOpen,
				FirstDetectedAt: detected,
				LastSeenAt:      now,
				LastReportID:    r.ReportID,
				DueDate:         dueDate(detected, level),
			}
			if err := db.Create(&rem).Error; err != nil {
				log.Printf("⚠️ remediation: create failed for %s: %v", key, err)
				continue
			}
			addSystemNote(db, rem.ID, "system",
				fmt.Sprintf("Auto-opened from scan report %s (severity %.1f, risk %s, due %s).",
					r.ReportID, r.Severity, level, rem.DueDate.Format("2006-01-02")))
			changed++
			continue
		}

		// Existing & still present: always refresh the detection snapshot.
		updates := map[string]interface{}{
			"vuln_name":      r.VulnName,
			"family":         r.Family,
			"cve_list":       r.CVEList,
			"severity":       r.Severity,
			"risk_score":     score,
			"risk_level":     level,
			"is_kev":         isKEV,
			"epss_score":     epss,
			"solution_text":  r.Solution,
			"solution_type":  r.SolutionType,
			"task_id":        normTaskID(r.TaskID),
			"task_name":      r.TaskName,
			"last_seen_at":   now,
			"last_report_id": r.ReportID,
			"due_date":       dueDate(ex.FirstDetectedAt, level), // keep SLA aligned with the (CVSS) band
		}

		// If it was claimed-fixed or previously verified but is detected AGAIN,
		// the fix didn't hold — reopen it and clear the closure fields.
		if ex.Status == entity.RemediationFixedPending || ex.Status == entity.RemediationVerifiedClosed {
			updates["status"] = entity.RemediationReopened
			updates["reopen_count"] = ex.ReopenCount + 1
			updates["fixed_at"] = nil
			updates["verified_at"] = nil
			updates["verified_report_id"] = ""
			updates["mttr_hours"] = nil
			updates["sla_notified"] = false // a fresh active life → allow a new SLA alert
			if err := db.Model(&entity.AppRemediation{}).Where("id = ?", ex.ID).Updates(updates).Error; err == nil {
				prev := "fix was awaiting verification"
				if ex.Status == entity.RemediationVerifiedClosed {
					prev = "was previously verified-closed"
				}
				addSystemNote(db, ex.ID, "system",
					fmt.Sprintf("Reopened — still detected in scan report %s (%s).", r.ReportID, prev))
				reopenedEvents = append(reopenedEvents, fmt.Sprintf("%s @ %s", r.VulnName, r.HostIP))
				changed++
			}
			continue
		}

		db.Model(&entity.AppRemediation{}).Where("id = ?", ex.ID).Updates(updates)
	}

	// 6. verify-close everything that vanished from a NEWER scan
	for key, ex := range existingByKey {
		if _, still := present[key]; still {
			continue
		}
		switch ex.Status {
		case entity.RemediationVerifiedClosed, entity.RemediationRiskAccepted, entity.RemediationFalsePositive:
			continue // terminal states — leave them alone
		}
		lr, ok := latestByTask[normTaskID(ex.TaskID)]
		if !ok {
			continue // task not currently scanned/visible → cannot verify
		}
		if !reportNewer(lr.ReportID, ex.LastReportID) {
			continue // no newer scan yet — not proven fixed, just not re-seen
		}

		verifiedAt := now
		if lr.CreationTime > 0 {
			verifiedAt = time.Unix(lr.CreationTime, 0)
		}
		mttr := verifiedAt.Sub(ex.FirstDetectedAt).Hours()
		if mttr < 0 {
			mttr = 0
		}
		updates := map[string]interface{}{
			"status":             entity.RemediationVerifiedClosed,
			"verified_at":        verifiedAt,
			"verified_report_id": lr.ReportID,
			"mttr_hours":         mttr,
		}
		if ex.FixedAt == nil {
			updates["fixed_at"] = verifiedAt
		}
		if err := db.Model(&entity.AppRemediation{}).Where("id = ?", ex.ID).Updates(updates).Error; err == nil {
			addSystemNote(db, ex.ID, "system",
				fmt.Sprintf("Verified closed — no longer detected in scan report %s (open for %.1f h).", lr.ReportID, mttr))
			closedEvents = append(closedEvents, fmt.Sprintf("%s @ %s", ex.VulnName, ex.HostIP))
			changed++
		}
	}

	// 7. announce lifecycle events (verified-closed, reopened, new SLA breaches).
	notifyLifecycle(db, now, closedEvents, reopenedEvents)

	return changed, nil
}

// activeStatusList is the set used to find work that still counts against SLA.
var activeStatusList = []string{
	entity.RemediationOpen, entity.RemediationInProgress,
	entity.RemediationFixedPending, entity.RemediationReopened,
}

// notifyLifecycle sends a single consolidated LINE message summarizing the
// verified-closed / reopened items from this sync plus any active items that
// have newly breached their SLA (each announced once via the sla_notified
// flag). Best-effort: LINE delivery failures are logged, never fatal.
func notifyLifecycle(db *gorm.DB, now time.Time, closed, reopened []string) {
	// Newly-overdue active items that haven't been announced yet.
	var breachedRows []entity.AppRemediation
	db.Where("status IN ? AND due_date IS NOT NULL AND due_date < ? AND sla_notified = ?",
		activeStatusList, now, false).Find(&breachedRows)

	var breached []string
	if len(breachedRows) > 0 {
		ids := make([]uint, 0, len(breachedRows))
		for _, b := range breachedRows {
			breached = append(breached, fmt.Sprintf("%s @ %s (%s)", b.VulnName, b.HostIP, b.RiskLevel))
			ids = append(ids, b.ID)
		}
		// Mark them announced so the next sync doesn't repeat the alert.
		db.Model(&entity.AppRemediation{}).Where("id IN ?", ids).Update("sla_notified", true)
	}

	if len(closed) == 0 && len(reopened) == 0 && len(breached) == 0 {
		return
	}

	msg := buildLifecycleMessage(closed, reopened, breached)
	if err := line.BroadcastText(msg); err != nil {
		log.Printf("ℹ️ remediation LINE notify: %v", err)
	}
}

// buildLifecycleMessage formats the LINE alert. Kept compact: counts up top,
// then up to 5 example items per category so a busy sync doesn't send a wall of
// text.
func buildLifecycleMessage(closed, reopened, breached []string) string {
	var b strings.Builder
	b.WriteString("🛡️ Remediation update\n")

	writeSection := func(emoji, label string, items []string) {
		if len(items) == 0 {
			return
		}
		b.WriteString(fmt.Sprintf("\n%s %s: %d\n", emoji, label, len(items)))
		limit := len(items)
		if limit > 5 {
			limit = 5
		}
		for _, it := range items[:limit] {
			b.WriteString("• " + it + "\n")
		}
		if len(items) > 5 {
			b.WriteString(fmt.Sprintf("… +%d more\n", len(items)-5))
		}
	}

	writeSection("✅", "Verified closed", closed)
	writeSection("⚠️", "Reopened", reopened)
	writeSection("⏰", "SLA breached", breached)
	return strings.TrimRight(b.String(), "\n")
}

// StartRemediationSyncScheduler runs an initial reconciliation shortly after
// boot, then every 20 minutes. Findings only change when a new scan report
// lands, so a modest cadence keeps the queue fresh without hammering the DB.
func StartRemediationSyncScheduler() {
	go func() {
		time.Sleep(90 * time.Second)
		if n, err := SyncOnce(); err != nil {
			log.Printf("⚠️ remediation sync (startup) error: %v", err)
		} else {
			log.Printf("✅ remediation sync (startup): %d item(s) changed", n)
		}

		ticker := time.NewTicker(20 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n, err := SyncOnce(); err != nil {
				log.Printf("⚠️ remediation sync error: %v", err)
			} else if n > 0 {
				log.Printf("✅ remediation sync: %d item(s) changed", n)
			}
		}
	}()
}
