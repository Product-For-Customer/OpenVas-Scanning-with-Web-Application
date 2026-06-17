package entity

import "time"

type AppComplianceMapping struct {
	ID               uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Framework        string    `gorm:"column:framework;index" json:"framework"` // PCI_DSS, ISO_27001, NIST_CSF, CIS_CONTROLS
	FrameworkVersion string    `gorm:"column:framework_version" json:"framework_version"`
	ControlID        string    `gorm:"column:control_id" json:"control_id"`
	ControlName      string    `gorm:"column:control_name" json:"control_name"`
	ControlDesc      string    `gorm:"column:control_desc;type:text" json:"control_desc"`
	CheckType        string    `gorm:"column:check_type" json:"check_type"` // critical_vuln, high_vuln, kev_vuln, scan_frequency, any_vuln
	SeverityThresh   float64   `gorm:"column:severity_thresh;default:0" json:"severity_thresh"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
