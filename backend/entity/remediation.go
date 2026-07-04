package entity

import (
	"time"

	"gorm.io/gorm"
)

// RemediationTicket tracks the fix status of one vulnerability finding.
// Vulnerabilities/hosts/tasks themselves are never stored locally — they're
// queried live from Greenbone via GMP — so a ticket can't use a normal
// foreign key to "the vulnerability" and instead identifies one by the
// natural key (task_id, host_ip, nvt_oid). VulnName/Severity are
// denormalized (copied in at creation time) so a ticket's history stays
// readable even if the underlying task/report is later deleted or
// rescanned and the live GMP data no longer matches.
type RemediationTicket struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID      string         `gorm:"column:task_id;index" json:"task_id"`
	HostIP      string         `gorm:"column:host_ip;index;not null" json:"host_ip"`
	NVTOid      string         `gorm:"column:nvt_oid;index" json:"nvt_oid"`
	VulnName    string         `gorm:"column:vuln_name;not null" json:"vuln_name"`
	Severity    float64        `gorm:"column:severity" json:"severity"`
	Status      string         `gorm:"column:status;default:'open';index" json:"status"`
	OwnerUserID *uint          `gorm:"column:owner_user_id" json:"owner_user_id"`
	Owner       *AppUser       `gorm:"foreignKey:OwnerUserID" json:"owner,omitempty"`
	DueDate     *time.Time     `gorm:"column:due_date" json:"due_date"`
	Notes       string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedByID uint           `gorm:"column:created_by_id" json:"created_by_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// RemediationTicketStatuses is the fixed set of valid Status values.
var RemediationTicketStatuses = map[string]bool{
	"open":           true,
	"in_progress":    true,
	"fixed":          true,
	"risk_accepted":  true,
	"false_positive": true,
}
