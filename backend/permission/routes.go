package permission

// RouteCategory maps every Gin route template registered under main.go's
// `authorized` group to the permission category that gates it. For GET/HEAD
// requests the caller needs CanView on that category; for any other method
// they need CanManage. Routes not listed here are handled by the
// self-service allowlists in middleware.EnforcePermissions (own-account
// TOTP/profile paths, /auth/me) and bypass this map entirely.
var RouteCategory = map[string]string{
	// ── Dashboard & Vulnerability Intel ──────────────────────────────────
	"/tasks/status":                   "dashboard",
	"/vulnerabilities/list":           "dashboard",
	"/assets/risk":                    "dashboard",
	"/devices/risk":                   "dashboard",
	"/vulnerabilities/detail/by-name": "dashboard",
	"/vulnerabilities/:task_id":       "dashboard",
	"/target-differ":                  "dashboard",
	"/vulnerabilities/level/:level":   "dashboard",
	"/all-targets":                    "dashboard",
	"/vulnerabilities/delta/enhanced": "dashboard",
	"/host/:ip/summary":               "dashboard",
	"/vulnerabilities/sla-breaches":   "dashboard",
	"/attack-surface/matrix":          "dashboard",

	// ── Scan Management (GMP + auto-scan schedules) ──────────────────────
	"/gmp/status":                          "scan_management",
	"/gmp/feeds":                           "scan_management",
	"/gmp/trash":                           "scan_management",
	"/gmp/trash/restore/:id":               "scan_management",
	"/gmp/trash/task/:id":                  "scan_management",
	"/gmp/trash/target/:id":                "scan_management",
	"/gmp/trash/credential/:id":            "scan_management",
	"/gmp/trash/portlist/:id":              "scan_management",
	"/gmp/port-lists":                      "scan_management",
	"/gmp/port-lists/import":               "scan_management",
	"/gmp/port-lists/:id":                  "scan_management",
	"/gmp/port-lists/:id/ranges":           "scan_management",
	"/gmp/port-lists/:id/ranges/:range_id": "scan_management",
	"/gmp/credentials":                     "scan_management",
	"/gmp/credentials/:id":                 "scan_management",
	"/gmp/tasks":                           "scan_management",
	"/gmp/tasks/:id":                       "scan_management",
	"/gmp/tasks/:id/start":                 "scan_management",
	"/gmp/tasks/:id/stop":                  "scan_management",
	"/gmp/targets":                         "scan_management",
	"/gmp/targets/:id":                     "scan_management",
	"/gmp/scanners":                        "scan_management",
	"/gmp/configs":                         "scan_management",
	"/scan-schedules":                      "scan_management",
	"/scan-schedules/:id":                  "scan_management",

	// ── Threat Intelligence ───────────────────────────────────────────────
	"/threats/kev":                       "threat_intel",
	"/threats/kev/check":                 "threat_intel",
	"/threats/kev/summary":               "threat_intel",
	"/threats/kev/status":                "threat_intel",
	"/threats/kev/sync":                  "threat_intel",
	"/threats/cve/enrich":                "threat_intel",
	"/feed-schedules":                    "threat_intel",
	"/feed-schedules/:feed_type":         "threat_intel",
	"/feed-schedules/:feed_type/trigger": "threat_intel",

	// ── Risk Scoring ──────────────────────────────────────────────────────
	"/risk/summary":               "risk_scoring",
	"/risk/epss/status":           "risk_scoring",
	"/risk/epss/sync":             "risk_scoring",
	"/risk/asset-criticality":     "risk_scoring",
	"/risk/asset-criticality/:id": "risk_scoring",

	// ── Reports, Diagrams & Locations ─────────────────────────────────────
	"/locations":                "reports_diagrams",
	"/locations/:id":            "reports_diagrams",
	"/create-locations":         "reports_diagrams",
	"/update-locations/:id":     "reports_diagrams",
	"/delete-locations/:id":     "reports_diagrams",
	"/app-report/:id":           "reports_diagrams",
	"/diagrams":                 "reports_diagrams",
	"/diagrams/:id":             "reports_diagrams",
	"/create-diagrams":          "reports_diagrams",
	"/update-diagrams/:id":      "reports_diagrams",
	"/delete-diagrams/:id":      "reports_diagrams",
	"/diagram-nodes":            "reports_diagrams",
	"/diagram-nodes/:id":        "reports_diagrams",
	"/create-diagram-nodes":     "reports_diagrams",
	"/update-diagram-nodes/:id": "reports_diagrams",
	"/delete-diagram-nodes/:id": "reports_diagrams",
	"/compliance/report":        "reports_diagrams",
	"/compliance/violations":    "reports_diagrams",
	"/compliance/control-vulns": "reports_diagrams",
	"/send-pdf-to-email":        "reports_diagrams",

	// ── User & Role Management ────────────────────────────────────────────
	"/users":                 "user_management",
	"/users/:id":             "user_management",
	"/update-users/:id":      "user_management", // non-own-ID writes only; own-ID handled by selfServiceOwnIDPaths first
	"/delete-users/:id":      "user_management",
	"/create-users":          "user_management",
	"/roles":                 "user_management",
	"/roles/:id":             "user_management",
	"/admin/users/:id":       "user_management",
	"/permission-categories": "user_management",
	"/send-emails":           "user_management",
	"/send-email/:id":        "user_management",

	// ── LINE, Settings & Password Policy ──────────────────────────────────
	"/history-notifies":             "line_settings",
	"/delete-history-notifies":      "line_settings",
	"/history-notifies/cleanup":     "line_settings",
	"/app-line-masters":             "line_settings",
	"/create-app-line-masters":      "line_settings",
	"/update-app-line-masters/:id":  "line_settings",
	"/delete-app-line-masters/:id":  "line_settings",
	"/line/test-notify":             "line_settings",
	"/app-notifications":            "line_settings",
	"/create-app-notifications":     "line_settings",
	"/update-app-notifications/:id": "line_settings",
	"/delete-app-notifications/:id": "line_settings",
	"/settings":                     "line_settings",
	"/password-policy":              "line_settings",

	// ── Audit Log ─────────────────────────────────────────────────────────
	"/audit-logs": "audit_log",
}
