package remediation

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/gmp"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// manualStatuses are the lifecycle states a human is allowed to set directly.
// "verified_closed" and "reopened" are deliberately excluded: they are earned
// by a re-scan (see sync.go), so letting them be set by hand would undermine
// the guarantee that a closed finding was actually proven fixed.
var manualStatuses = map[string]bool{
	entity.RemediationOpen:          true,
	entity.RemediationInProgress:    true,
	entity.RemediationFixedPending:  true,
	entity.RemediationRiskAccepted:  true,
	entity.RemediationFalsePositive: true,
}

// activeStatuses are the states that still need work — used for "overdue",
// "due soon" and open-by-severity counts.
func isActive(status string) bool {
	switch status {
	case entity.RemediationOpen, entity.RemediationInProgress,
		entity.RemediationFixedPending, entity.RemediationReopened:
		return true
	}
	return false
}

// ── List ────────────────────────────────────────────────────────────────────

// ListRemediations returns the remediation queue, filterable by status, risk
// level, host, assignment and a free-text query, ordered by risk (highest
// first) then SLA due date (soonest first) so the most urgent work floats up.
func ListRemediations(c *gin.Context) {
	db := config.DB()

	q := db.Model(&entity.AppRemediation{})

	if s := strings.TrimSpace(c.Query("status")); s != "" {
		q = q.Where("status = ?", s)
	}
	if strings.EqualFold(c.Query("active"), "true") {
		q = q.Where("status IN ?", []string{
			entity.RemediationOpen, entity.RemediationInProgress,
			entity.RemediationFixedPending, entity.RemediationReopened,
		})
	}
	if rl := strings.TrimSpace(c.Query("risk_level")); rl != "" {
		q = q.Where("risk_level = ?", strings.ToUpper(rl))
	}
	if h := strings.TrimSpace(c.Query("host")); h != "" {
		q = q.Where("host_ip = ?", h)
	}
	switch strings.ToLower(strings.TrimSpace(c.Query("assigned"))) {
	case "me":
		q = q.Where("assigned_to = ?", c.GetUint("user_id"))
	case "unassigned":
		q = q.Where("assigned_to IS NULL")
	}
	if term := strings.TrimSpace(c.Query("q")); term != "" {
		like := "%" + term + "%"
		q = q.Where("vuln_name ILIKE ? OR host_ip ILIKE ? OR cve_list ILIKE ?", like, like, like)
	}

	var rows []entity.AppRemediation
	if err := q.Order("risk_score DESC, due_date ASC NULLS LAST, id DESC").Find(&rows).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	if rows == nil {
		rows = make([]entity.AppRemediation, 0)
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// ── Detail ──────────────────────────────────────────────────────────────────

func GetRemediation(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item entity.AppRemediation
	if err := db.Preload("Notes", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("created_at DESC")
	}).First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

// ── Summary (dashboard) ───────────────────────────────────────────────────────

type SummaryDTO struct {
	Total          int64   `json:"total"`
	Open           int64   `json:"open"`
	InProgress     int64   `json:"in_progress"`
	FixedPending   int64   `json:"fixed_pending_verify"`
	VerifiedClosed int64   `json:"verified_closed"`
	RiskAccepted   int64   `json:"risk_accepted"`
	FalsePositive  int64   `json:"false_positive"`
	Reopened       int64   `json:"reopened"`
	ActiveTotal    int64   `json:"active_total"`
	Overdue        int64   `json:"overdue"`
	DueSoon        int64   `json:"due_soon"`
	CriticalOpen   int64   `json:"critical_open"`
	HighOpen       int64   `json:"high_open"`
	AvgMTTRHours   float64 `json:"avg_mttr_hours"`
	VerifiedLast30 int64   `json:"verified_last_30d"`
	OpenedLast30   int64   `json:"opened_last_30d"`
	GeneratedAt    string  `json:"generated_at"`
}

// GetRemediationSummary aggregates the queue into the numbers the dashboard
// needs — status mix, SLA breaches, open-by-severity and mean-time-to-remediate.
// These are exactly the outcome metrics a detection-only competitor can't show.
func GetRemediationSummary(c *gin.Context) {
	db := config.DB()

	type slim struct {
		Status     string
		RiskLevel  string
		DueDate    *time.Time
		MTTRHours  *float64
		VerifiedAt *time.Time
		CreatedAt  time.Time
	}
	var rows []slim
	if err := db.Model(&entity.AppRemediation{}).
		Select("status, risk_level, due_date, mttr_hours, verified_at, created_at").
		Scan(&rows).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	now := time.Now()
	soon := now.Add(72 * time.Hour)
	cutoff30 := now.AddDate(0, 0, -30)

	var s SummaryDTO
	var mttrSum float64
	var mttrN int64

	for _, r := range rows {
		s.Total++
		switch r.Status {
		case entity.RemediationOpen:
			s.Open++
		case entity.RemediationInProgress:
			s.InProgress++
		case entity.RemediationFixedPending:
			s.FixedPending++
		case entity.RemediationVerifiedClosed:
			s.VerifiedClosed++
		case entity.RemediationRiskAccepted:
			s.RiskAccepted++
		case entity.RemediationFalsePositive:
			s.FalsePositive++
		case entity.RemediationReopened:
			s.Reopened++
		}

		active := isActive(r.Status)
		if active {
			s.ActiveTotal++
			if r.RiskLevel == "CRITICAL" {
				s.CriticalOpen++
			}
			if r.RiskLevel == "HIGH" {
				s.HighOpen++
			}
			if r.DueDate != nil {
				if r.DueDate.Before(now) {
					s.Overdue++
				} else if r.DueDate.Before(soon) {
					s.DueSoon++
				}
			}
		}

		if r.Status == entity.RemediationVerifiedClosed && r.MTTRHours != nil {
			mttrSum += *r.MTTRHours
			mttrN++
		}
		if r.VerifiedAt != nil && r.VerifiedAt.After(cutoff30) {
			s.VerifiedLast30++
		}
		if r.CreatedAt.After(cutoff30) {
			s.OpenedLast30++
		}
	}

	if mttrN > 0 {
		s.AvgMTTRHours = mttrSum / float64(mttrN)
	}
	s.GeneratedAt = now.Format(time.RFC3339)

	c.JSON(http.StatusOK, gin.H{"data": s})
}

// ── Update (status / assignment / fix method) ─────────────────────────────────

type updateInput struct {
	Status    *string `json:"status"`     // one of manualStatuses
	FixMethod *string `json:"fix_method"` // patch | config | network_control | compensating
	Assign    *string `json:"assign"`     // "me" | "clear"
}

// UpdateRemediation applies human-driven changes to a remediation item:
// changing its workflow status, assigning it (to the caller) or clearing the
// assignment, and recording the fix method. Every change is written to the
// item's worklog and the global audit log.
func UpdateRemediation(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item entity.AppRemediation
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var in updateInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	var notes []string
	now := time.Now()

	if in.Status != nil {
		newStatus := strings.TrimSpace(*in.Status)
		if !manualStatuses[newStatus] {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "status must be one of: open, in_progress, fixed_pending_verify, risk_accepted, false_positive (verified_closed/reopened are set by re-scan only)",
			})
			return
		}
		if newStatus != item.Status {
			updates["status"] = newStatus
			// Entering "fixed, pending verify" stamps the fix time so MTTR can be
			// measured once a re-scan confirms closure. Leaving a closed/terminal
			// state back to active clears the stale closure fields.
			switch newStatus {
			case entity.RemediationFixedPending:
				if item.FixedAt == nil {
					updates["fixed_at"] = now
				}
			case entity.RemediationOpen, entity.RemediationInProgress:
				updates["fixed_at"] = nil
				updates["verified_at"] = nil
				updates["verified_report_id"] = ""
				updates["mttr_hours"] = nil
			}
			notes = append(notes, fmt.Sprintf("Status: %s → %s", item.Status, newStatus))
		}
	}

	if in.FixMethod != nil {
		fm := strings.TrimSpace(*in.FixMethod)
		if fm != item.FixMethod {
			updates["fix_method"] = fm
			notes = append(notes, fmt.Sprintf("Fix method set to %q", fm))
		}
	}

	if in.Assign != nil {
		switch strings.ToLower(strings.TrimSpace(*in.Assign)) {
		case "me":
			uid := c.GetUint("user_id")
			email := c.GetString("user_email")
			updates["assigned_to"] = uid
			updates["assigned_name"] = email
			notes = append(notes, fmt.Sprintf("Assigned to %s", email))
		case "clear":
			updates["assigned_to"] = nil
			updates["assigned_name"] = ""
			notes = append(notes, "Assignment cleared")
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "assign must be 'me' or 'clear'"})
			return
		}
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no changes"})
		return
	}

	if err := db.Model(&item).Updates(updates).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	// Record each change as a worklog note + one audit entry.
	actor := c.GetString("user_email")
	for _, n := range notes {
		db.Create(&entity.AppRemediationNote{
			RemediationID: item.ID,
			AuthorID:      c.GetUint("user_id"),
			AuthorName:    actor,
			Kind:          "status_change",
			Body:          n,
		})
	}
	audit.Log(c, "remediation.updated", "remediation", fmt.Sprintf("%d", item.ID),
		fmt.Sprintf("%s [%s @ %s]: %s", item.VulnName, item.HostIP, item.Port, strings.Join(notes, "; ")))

	var fresh entity.AppRemediation
	db.First(&fresh, "id = ?", item.ID)
	c.JSON(http.StatusOK, gin.H{"data": fresh})
}

// ── Worklog ───────────────────────────────────────────────────────────────────

type noteInput struct {
	Body string `json:"body" binding:"required"`
}

func AddNote(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item entity.AppRemediation
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var in noteInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(in.Body) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "note body is required"})
		return
	}

	note := entity.AppRemediationNote{
		RemediationID: item.ID,
		AuthorID:      c.GetUint("user_id"),
		AuthorName:    c.GetString("user_email"),
		Kind:          "comment",
		Body:          strings.TrimSpace(in.Body),
	}
	if err := db.Create(&note).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": note})
}

// ── Manual sync trigger ───────────────────────────────────────────────────────

// TriggerSync runs a reconciliation on demand (e.g. right after a scan finished)
// so the queue reflects the newest report without waiting for the scheduler.
func TriggerSync(c *gin.Context) {
	changed, err := SyncOnce()
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "remediation.sync", "remediation", "", fmt.Sprintf("manual sync: %d item(s) changed", changed))
	c.JSON(http.StatusOK, gin.H{"message": "sync complete", "changed": changed})
}

// ── Fix script (Phase 2) ──────────────────────────────────────────────────────

// GetFixScript returns a ready-to-apply remediation (checklist + copy-paste
// script) generated from the finding's characteristics. It also records the
// derived fix method on the item if one wasn't set yet, so the queue can show
// how each finding is meant to be resolved.
func GetFixScript(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item entity.AppRemediation
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	plan := BuildRemediationPlan(db, item)
	if item.FixMethod == "" && plan.Method != "" {
		db.Model(&item).Update("fix_method", plan.Method)
	}
	c.JSON(http.StatusOK, gin.H{"data": plan})
}

// ── Re-scan to verify (Phase 2) ───────────────────────────────────────────────

// RescanRemediation kicks off the Greenbone scan task that owns this finding so
// the closed-loop can confirm the fix. When the resulting report no longer
// contains the finding, the sync engine auto-verifies it closed. This is the
// one-click "prove it's fixed" action the whole feature is built around.
func RescanRemediation(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var item entity.AppRemediation
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if strings.TrimSpace(item.TaskID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this finding has no associated scan task to re-run"})
		return
	}

	reportID, err := gmp.StartTask(item.TaskID)
	if err != nil {
		// gvmd unreachable / task already running — surface as 503, not 500.
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	actor := c.GetString("user_email")
	db.Create(&entity.AppRemediationNote{
		RemediationID: item.ID,
		AuthorID:      c.GetUint("user_id"),
		AuthorName:    actor,
		Kind:          "system",
		Body:          fmt.Sprintf("Re-scan requested to verify the fix (task %s, report %s). It will auto-close if no longer detected.", item.TaskID, reportID),
	})
	audit.Log(c, "remediation.rescan", "remediation", fmt.Sprintf("%d", item.ID),
		fmt.Sprintf("re-scan task %s (report %s) for %s @ %s", item.TaskID, reportID, item.VulnName, item.HostIP))

	c.JSON(http.StatusOK, gin.H{"message": "re-scan started", "report_id": reportID})
}
