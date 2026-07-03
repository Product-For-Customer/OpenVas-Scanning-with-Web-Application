package entity

import "gorm.io/gorm"

// AppRolePermission is one (role, category) row of the permission matrix —
// whether that role can View and/or Manage the given category.
type AppRolePermission struct {
	gorm.Model
	AppRoleID uint   `gorm:"uniqueIndex:idx_role_category" json:"app_role_id"`
	Category  string `gorm:"uniqueIndex:idx_role_category;size:64" json:"category"`
	CanView   bool   `json:"can_view"`
	CanManage bool   `json:"can_manage"`
}

// PermissionCategory describes one row of the permission matrix editor. This
// is a fixed, code-defined catalog (not stored in the DB) shared by role
// seeding, the role CRUD API, and the frontend matrix editor — the single
// source of truth for which categories exist.
type PermissionCategory struct {
	Key            string `json:"key"`
	Label          string `json:"label"`
	SupportsManage bool   `json:"supports_manage"`
}

var PermissionCategories = []PermissionCategory{
	{Key: "dashboard", Label: "Dashboard & Vulnerability Intel", SupportsManage: false},
	{Key: "scan_management", Label: "Scan Management", SupportsManage: true},
	{Key: "threat_intel", Label: "Threat Intelligence", SupportsManage: true},
	{Key: "risk_scoring", Label: "Risk Scoring", SupportsManage: true},
	{Key: "reports_diagrams", Label: "Reports, Diagrams & Locations", SupportsManage: true},
	{Key: "user_management", Label: "User & Role Management", SupportsManage: true},
	{Key: "line_settings", Label: "LINE, Settings & Password Policy", SupportsManage: true},
	{Key: "audit_log", Label: "Audit Log", SupportsManage: false},
}

// IsValidCategory reports whether key is one of the fixed PermissionCategories.
func IsValidCategory(key string) bool {
	for _, c := range PermissionCategories {
		if c.Key == key {
			return true
		}
	}
	return false
}
