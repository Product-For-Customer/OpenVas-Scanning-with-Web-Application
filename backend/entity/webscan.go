package entity

import (
	"time"

	"gorm.io/gorm"
)

// AppWebScanTarget is an admin-registered web application to run OWASP ZAP
// scans against. Scans only ever run against a target row created here —
// never against an arbitrary URL passed at trigger-time — so the set of
// scannable URLs is always an explicit admin-curated allowlist, not
// something a caller can point at any address on request.
type AppWebScanTarget struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string `gorm:"column:name;not null" json:"name"`
	URL         string `gorm:"column:url;not null" json:"url"`
	Description string `gorm:"column:description;type:text" json:"description"`
	// AuthCookie is a pre-authenticated session cookie (copied from an
	// admin's own browser after manually logging into the target with a
	// test account) that ZAP attaches to every request when scanning this
	// target — lets the scanner reach pages behind a login wall without
	// needing to understand the site's specific login form. Deliberately
	// `json:"-"`: never echoed back in any API response (same treatment as
	// LINE tokens/Gmail app passwords elsewhere in this app) — only
	// accepted on write, via the separate targetInput struct in webscan.go.
	AuthCookie string `gorm:"column:auth_cookie;type:text" json:"-"`
	// AuthHeader is an optional raw Authorization header value (e.g.
	// "Bearer eyJhbGc...") for APIs / SPAs that authenticate with a token
	// rather than a session cookie. Same secret treatment as AuthCookie:
	// `json:"-"`, write-only, never echoed back — the frontend only learns
	// whether one is set via the computed HasAuthHeader flag.
	AuthHeader string `gorm:"column:auth_header;type:text" json:"-"`
	// OpenAPIURL, when set, points at an OpenAPI/Swagger spec (JSON or YAML).
	// Before spidering, ZAP imports it so every documented endpoint is added
	// to the scan tree — this is how API surfaces that the crawler would never
	// discover by following links get covered. Not a secret, so it IS returned.
	OpenAPIURL string         `gorm:"column:openapi_url;type:text" json:"openapi_url"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// AppWebScanResult is one scan run (spider + optional active scan) against
// one target. Status machine: spidering -> active_scanning (only for "full"
// scans) -> completed, or -> failed / stopped from any running state.
type AppWebScanResult struct {
	ID              uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	TargetID        uint           `gorm:"column:target_id;index;not null" json:"target_id"`
	ScanType        string         `gorm:"column:scan_type;not null" json:"scan_type"` // baseline, full
	Status          string         `gorm:"column:status;not null" json:"status"`       // spidering, active_scanning, completed, failed, stopped
	SpiderProgress  int            `gorm:"column:spider_progress" json:"spider_progress"`
	ActiveProgress  int            `gorm:"column:active_progress" json:"active_progress"`
	ZAPSpiderScanID string         `gorm:"column:zap_spider_scan_id" json:"-"`
	ZAPActiveScanID string         `gorm:"column:zap_active_scan_id" json:"-"`
	High            int            `gorm:"column:high" json:"high"`
	Medium          int            `gorm:"column:medium" json:"medium"`
	Low             int            `gorm:"column:low" json:"low"`
	Informational   int            `gorm:"column:informational" json:"informational"`
	// ── B-2/B-3 captured alongside the ZAP scan (see webscan.captureAuxData) ──
	// SecurityGrade/Score summarise the HTTP security-header + TLS check;
	// HTTPAuditJSON holds the full httpAuditResult and FingerprintJSON the full
	// fingerprintResult, both stored opaquely as JSON and parsed by the
	// frontend's Scan History detail. EOLWarnings is the count of end-of-life
	// technologies detected. All empty/zero for older scans or a failed capture.
	SecurityGrade   string         `gorm:"column:security_grade" json:"security_grade"`
	SecurityScore   int            `gorm:"column:security_score" json:"security_score"`
	HTTPAuditJSON   string         `gorm:"column:http_audit_json;type:text" json:"http_audit_json"`
	FingerprintJSON string         `gorm:"column:fingerprint_json;type:text" json:"fingerprint_json"`
	EOLWarnings     int            `gorm:"column:eol_warnings" json:"eol_warnings"`
	ErrorMessage    string         `gorm:"column:error_message;type:text" json:"error_message"`
	StartedAt       time.Time      `gorm:"column:started_at" json:"started_at"`
	FinishedAt      *time.Time     `gorm:"column:finished_at" json:"finished_at"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// AppWebScanFinding is one alert ZAP reported for a given scan result.
type AppWebScanFinding struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	ResultID    uint   `gorm:"column:result_id;index;not null" json:"result_id"`
	AlertName   string `gorm:"column:alert_name;not null" json:"alert_name"`
	Risk        string `gorm:"column:risk;not null" json:"risk"` // High, Medium, Low, Informational
	Confidence  string `gorm:"column:confidence" json:"confidence"`
	URL         string `gorm:"column:url;type:text" json:"url"`
	Param       string `gorm:"column:param" json:"param"`
	Method      string `gorm:"column:method" json:"method"`
	Description string `gorm:"column:description;type:text" json:"description"`
	Solution    string `gorm:"column:solution;type:text" json:"solution"`
	Attack      string `gorm:"column:attack;type:text" json:"attack"`
	OtherInfo   string `gorm:"column:other_info;type:text" json:"other_info"`
	CWEID       string `gorm:"column:cwe_id" json:"cwe_id"`
	WASCID      string `gorm:"column:wasc_id" json:"wasc_id"`
	AlertRef    string `gorm:"column:alert_ref" json:"alert_ref"`
	PluginID    string `gorm:"column:plugin_id" json:"plugin_id"`
	// Reference holds ZAP's raw newline-separated list of external reference
	// URLs (OWASP cheat sheets, PortSwigger, RFCs, etc.) for this alert type.
	Reference string `gorm:"column:reference;type:text" json:"reference"`
	// Tags is a JSON-encoded object (e.g. {"OWASP_2021_A03":"https://...",
	// "CWE-89":"https://..."}) as returned by ZAP's alert tags field — stored
	// as a plain string column since it's opaque passthrough data, not
	// something the backend ever queries into. The frontend JSON.parses it.
	Tags      string    `gorm:"column:tags;type:text" json:"tags"`
	Evidence  string    `gorm:"column:evidence;type:text" json:"evidence"`
	CreatedAt time.Time `json:"created_at"`
}
