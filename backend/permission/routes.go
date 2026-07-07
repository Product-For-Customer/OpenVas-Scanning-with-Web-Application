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

	// ── Risk Scoring (merged into Dashboard 2026-07-03) ──────────────────
	"/risk/summary":               "dashboard",
	"/risk/epss/status":           "dashboard",
	"/risk/epss/sync":             "dashboard",
	"/risk/asset-criticality":     "dashboard",
	"/risk/asset-criticality/:id": "dashboard",

	// ── Reports & Compliance (split out of "reports_diagrams" into Dashboard
	//    2026-07-03; Diagrams/Locations stayed behind under reports_diagrams) ──
	"/app-report/:id":           "dashboard",
	"/send-pdf-to-email":        "dashboard",
	"/send-pdf-to-line":         "dashboard",
	"/report-digests":           "dashboard",
	"/report-digests/:id":       "dashboard",
	"/report-digests/:id/run":   "dashboard",
	"/compliance/report":        "dashboard",
	"/compliance/violations":    "dashboard",
	"/compliance/control-vulns": "dashboard",

	// ── Report data endpoints (2026-07-05: gated behind report.CaptureOrAuth,
	//    which falls back to this normal session+permission check for anyone
	//    without the internal capture token) ──────────────────────────────
	"/summary-vulnerability-report": "dashboard",
	"/critical-report":              "dashboard",
	"/devices/risk-report":          "dashboard",
	"/target-differ-report":         "dashboard",
	"/report/vulnerability-month":   "dashboard",
	"/reports/all/:task_id":         "dashboard",

	// ── Threat Intelligence (includes Scan Management, merged 2026-07-03:
	//    GMP + auto-scan schedules + KEV/CVE/feed schedules) ──────────────
	"/gmp/status":                          "threat_intel",
	"/gmp/feeds":                           "threat_intel",
	"/gmp/trash":                           "threat_intel",
	"/gmp/trash/restore/:id":               "threat_intel",
	"/gmp/trash/task/:id":                  "threat_intel",
	"/gmp/trash/target/:id":                "threat_intel",
	"/gmp/trash/credential/:id":            "threat_intel",
	"/gmp/trash/portlist/:id":              "threat_intel",
	"/gmp/port-lists":                      "threat_intel",
	"/gmp/port-lists/import":               "threat_intel",
	"/gmp/port-lists/:id":                  "threat_intel",
	"/gmp/port-lists/:id/ranges":           "threat_intel",
	"/gmp/port-lists/:id/ranges/:range_id": "threat_intel",
	"/gmp/credentials":                     "threat_intel",
	"/gmp/credentials/:id":                 "threat_intel",
	"/gmp/tasks":                           "threat_intel",
	"/gmp/tasks/:id":                       "threat_intel",
	"/gmp/tasks/:id/start":                 "threat_intel",
	"/gmp/tasks/:id/stop":                  "threat_intel",
	"/gmp/targets":                         "threat_intel",
	"/gmp/targets/:id":                     "threat_intel",
	"/gmp/scanners":                        "threat_intel",
	"/gmp/configs":                         "threat_intel",
	"/scan-schedules":                      "threat_intel",
	"/scan-schedules/:id":                  "threat_intel",
	"/threats/kev":                       "threat_intel",
	"/threats/kev/check":                 "threat_intel",
	"/threats/kev/summary":               "threat_intel",
	"/threats/kev/status":                "threat_intel",
	"/threats/kev/sync":                  "threat_intel",
	"/threats/cve/enrich":                "threat_intel",
	"/feed-schedules":                    "threat_intel",
	"/feed-schedules/:feed_type":         "threat_intel",
	"/feed-schedules/:feed_type/trigger": "threat_intel",

	// ── Network asset discovery (Nmap) — added 2026-07-06 ──────────────────
	"/discovery/trigger": "threat_intel",
	"/discovery/status":  "threat_intel",
	"/discovery/hosts":   "threat_intel",
	"/discovery/hosts/:id/acknowledge": "threat_intel",

	// ── Web application scanning (OWASP ZAP) — added 2026-07-06 ────────────
	"/webscan/targets":                "threat_intel",
	"/webscan/targets/:id":            "threat_intel",
	"/webscan/targets/:id/scan":       "threat_intel",
	"/webscan/status":                 "threat_intel",
	"/webscan/stop":                   "threat_intel",
	"/webscan/results":                "threat_intel",
	"/webscan/results/:id":            "threat_intel",
	"/webscan/results/:id/findings":   "threat_intel",
	"/webscan/targets/:id/http-audit":  "threat_intel",
	"/webscan/targets/:id/fingerprint": "threat_intel",

	// ── Diagrams & Locations ───────────────────────────────────────────────
	"/locations":                "reports_diagrams",
	"/locations/:id":            "reports_diagrams",
	"/create-locations":         "reports_diagrams",
	"/update-locations/:id":     "reports_diagrams",
	"/delete-locations/:id":     "reports_diagrams",
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

	// ── Line Management (split out of "line_settings" 2026-07-03) ──────────
	"/history-notifies":             "line_management",
	"/delete-history-notifies":      "line_management",
	"/history-notifies/cleanup":     "line_management",
	"/app-line-masters":             "line_management",
	"/create-app-line-masters":      "line_management",
	"/update-app-line-masters/:id":  "line_management",
	"/delete-app-line-masters/:id":  "line_management",
	"/line/test-notify":             "line_management",
	"/app-notifications":            "line_management",
	"/create-app-notifications":     "line_management",
	"/update-app-notifications/:id": "line_management",
	"/delete-app-notifications/:id": "line_management",

	// ── Services & Password Policy ─────────────────────────────────────────
	"/settings":        "line_settings",
	"/password-policy": "line_settings",

	// ── Audit Log ─────────────────────────────────────────────────────────
	"/audit-logs": "audit_log",
	// Retention cleanup is a system-policy action (deletes history), not a
	// normal audit-log read — gated under user_management like other
	// sensitive system-config actions, since "audit_log" is view-only
	// (SupportsManage=false) by design and can never satisfy a Manage check.
	"/audit-logs/cleanup": "user_management",
}
