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
	// ManageMirrorsView means CanManage is never set independently — it
	// always equals CanView (enforced in role/handler.go's
	// validatePermissions). The matrix editor shows a single effectively
	// usable "View" checkbox for this category, with Manage displayed
	// disabled alongside it (visually like Audit Log's grayed-out Manage
	// cell, but unlike Audit Log this one *is* granted, not always false).
	ManageMirrorsView bool `json:"manage_mirrors_view"`
}

// "scan_management" and "risk_scoring" were folded into "threat_intel" and
// "dashboard" respectively (2026-07-03) — see migrateMergedPermissionCategories
// in config/db.go for the one-time data migration of existing role rows.
// Dashboard now supports Manage because it absorbed Risk Scoring's
// manage-gated asset-criticality routes.
//
// Report + Compliance routes were split out of "reports_diagrams" into
// "dashboard" the same day (see migrateReportsIntoDashboard in config/db.go);
// Diagrams/Locations stayed under "reports_diagrams", relabeled accordingly.
//
// "line_management" was split out of "line_settings" the same day (see
// migrateLineSettingsSplit in config/db.go) — all LINE bot/notification
// routes moved there; "line_settings" kept only /settings + /password-policy
// and was relabeled from "LINE, Services & Password Policy".
//
// "dashboard" was made ManageMirrorsView the same day: the frontend has no
// UI at all for the Manage-gated routes it absorbed from Risk Scoring
// (asset-criticality CRUD), so an independently-toggleable Manage checkbox
// was just confusing dead weight — View now grants both.
var PermissionCategories = []PermissionCategory{
	{Key: "dashboard", Label: "Dashboard & Vulnerability Intel", SupportsManage: true, ManageMirrorsView: true},
	{Key: "threat_intel", Label: "Threat Intelligence", SupportsManage: true},
	{Key: "reports_diagrams", Label: "Diagrams & Locations", SupportsManage: true},
	{Key: "remediation", Label: "Remediation Tickets", SupportsManage: true},
	{Key: "user_management", Label: "User & Role Management", SupportsManage: true},
	{Key: "line_management", Label: "Line Management", SupportsManage: true},
	{Key: "line_settings", Label: "Services & Password Policy", SupportsManage: true},
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
