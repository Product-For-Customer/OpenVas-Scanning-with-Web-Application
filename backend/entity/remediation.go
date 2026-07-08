package entity

import (
	"time"

	"gorm.io/gorm"
)

// Remediation lifecycle statuses. The set is intentionally small and the
// transitions are constrained (see controller/remediation): "verified_closed"
// and "reopened" are *earned by re-scanning*, never set by hand — that is what
// makes a closed finding trustworthy ("we proved it's gone", not "someone
// ticked a box"). This is the piece the OpenVAS DB can't model on its own: it
// stores what a scan *found*, but has no concept of a fix being in progress,
// verified, or accepted as a known risk.
const (
	RemediationOpen           = "open"                  // detected, no action yet
	RemediationInProgress     = "in_progress"           // someone is working on it
	RemediationFixedPending   = "fixed_pending_verify"  // claimed fixed, awaiting a confirming re-scan
	RemediationVerifiedClosed = "verified_closed"       // absent from a newer scan → proven fixed
	RemediationRiskAccepted   = "risk_accepted"         // deliberately tolerated
	RemediationFalsePositive  = "false_positive"        // not a real finding
	RemediationReopened       = "reopened"              // was fixed/closed but detected again
)

// AppRemediation is the app-owned lifecycle record for one distinct finding
// (host + NVT + port). Detection data (severity, solution text, CVEs) is
// snapshotted from the read-only Greenbone tables at sync time so the
// remediation view stays stable even as scan reports roll over, and refreshed
// on each sync for still-open items. The row is keyed by FindingKey, a stable
// fingerprint that survives across re-scans so the same weakness is tracked as
// one item over its whole life rather than reappearing as a new row every scan.
type AppRemediation struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	FindingKey string `gorm:"column:finding_key;uniqueIndex;not null" json:"finding_key"`

	HostIP   string `gorm:"column:host_ip;index" json:"host_ip"`
	NVTOid   string `gorm:"column:nvt_oid" json:"nvt_oid"`
	Port     string `gorm:"column:port" json:"port"`
	TaskID   string `gorm:"column:task_id;index" json:"task_id"`
	TaskName string `gorm:"column:task_name" json:"task_name"`

	// ── Detection snapshot (from Greenbone results/nvts) ──────────────────
	VulnName  string  `gorm:"column:vuln_name" json:"vuln_name"`
	Family    string  `gorm:"column:family" json:"family"`
	CVEList   string  `gorm:"column:cve_list;type:text" json:"cve_list"`
	Severity  float64 `gorm:"column:severity" json:"severity"`
	RiskScore float64 `gorm:"column:risk_score" json:"risk_score"`
	RiskLevel string  `gorm:"column:risk_level;index" json:"risk_level"`
	IsKEV     bool    `gorm:"column:is_kev" json:"is_kev"`
	EPSSScore float64 `gorm:"column:epss_score" json:"epss_score"`

	// ── Remediation guidance snapshot ─────────────────────────────────────
	SolutionText string `gorm:"column:solution_text;type:text" json:"solution_text"`
	SolutionType string `gorm:"column:solution_type" json:"solution_type"`
	FixMethod    string `gorm:"column:fix_method" json:"fix_method"` // patch | config | network_control | compensating (Phase 2 fills this)

	// ── Workflow state ────────────────────────────────────────────────────
	Status       string `gorm:"column:status;index;default:'open'" json:"status"`
	AssignedTo   *uint  `gorm:"column:assigned_to" json:"assigned_to"`
	AssignedName string `gorm:"column:assigned_name" json:"assigned_name"`

	// ── Timeline ──────────────────────────────────────────────────────────
	DueDate          *time.Time `gorm:"column:due_date" json:"due_date"`
	FirstDetectedAt  time.Time  `gorm:"column:first_detected_at" json:"first_detected_at"`
	LastSeenAt       time.Time  `gorm:"column:last_seen_at" json:"last_seen_at"`
	LastReportID     string     `gorm:"column:last_report_id" json:"last_report_id"` // Greenbone report the finding was last present in
	FixedAt          *time.Time `gorm:"column:fixed_at" json:"fixed_at"`
	VerifiedAt       *time.Time `gorm:"column:verified_at" json:"verified_at"`
	VerifiedReportID string     `gorm:"column:verified_report_id" json:"verified_report_id"` // report that proved absence
	MTTRHours        *float64   `gorm:"column:mttr_hours" json:"mttr_hours"`
	ReopenCount      int        `gorm:"column:reopen_count;default:0" json:"reopen_count"`

	// SLANotified guards the one-shot "SLA breached" alert so a still-overdue
	// item isn't re-announced on every 20-minute sync. Reset when the item
	// returns to a fresh active state (reopened).
	SLANotified bool `gorm:"column:sla_notified;default:false" json:"sla_notified"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Notes []AppRemediationNote `gorm:"foreignKey:RemediationID" json:"notes,omitempty"`
}

func (AppRemediation) TableName() string { return "app_remediations" }

// AppRemediationNote is one worklog entry on a remediation item — a human
// comment, an automatic status-change record, or a system note (auto-open /
// auto-verify / reopen). Together they form the audit trail of how a finding
// went from detected to closed.
type AppRemediationNote struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RemediationID uint      `gorm:"column:remediation_id;index;not null" json:"remediation_id"`
	AuthorID      uint      `gorm:"column:author_id" json:"author_id"`
	AuthorName    string    `gorm:"column:author_name" json:"author_name"`
	Body          string    `gorm:"column:body;type:text" json:"body"`
	Kind          string    `gorm:"column:kind;default:'comment'" json:"kind"` // comment | status_change | system
	CreatedAt     time.Time `json:"created_at"`
}

func (AppRemediationNote) TableName() string { return "app_remediation_notes" }
