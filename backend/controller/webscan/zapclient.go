package webscan

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// RequireZAPAPIKey warns loudly at startup if ZAP_API_KEY is unset. The ZAP
// daemon itself is started with `-config api.disablekey=false` and
// `-config api.key=${ZAP_API_KEY}` (see docker-compose.yml) — if that env
// var is empty, ZAP ends up either requiring a literal empty key or (on
// some versions) treating the API as unauthenticated, silently undoing the
// "only the backend can drive this attack tool" boundary this feature
// relies on. Mirrors gmp.RequireGVMCredentials()'s pattern: log and
// continue rather than crash the whole app over an adjacent feature.
func RequireZAPAPIKey() {
	if strings.TrimSpace(os.Getenv("ZAP_API_KEY")) == "" {
		log.Println("⚠️ SECURITY: ZAP_API_KEY is not set — the ZAP scanner API may be running without authentication. Set ZAP_API_KEY in .env and restart both the zap and backend services.")
	}
}

// zapBaseURL / zapAPIKey are read lazily (not at package init) so the env
// vars set by docker-compose are guaranteed to already be in place by the
// time a request actually needs them.
func zapBaseURL() string {
	v := strings.TrimSpace(os.Getenv("ZAP_API_URL"))
	if v == "" {
		return "http://zap:8080"
	}
	return strings.TrimRight(v, "/")
}

func zapAPIKey() string {
	return strings.TrimSpace(os.Getenv("ZAP_API_KEY"))
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

// zapGet calls a ZAP JSON API endpoint and decodes the response into out.
// ZAP's API is GET-based even for actions (spider/scan/stop, etc.) — this is
// ZAP's own design, not a shortcut taken here.
func zapGet(path string, params url.Values, out interface{}) error {
	if params == nil {
		params = url.Values{}
	}
	params.Set("apikey", zapAPIKey())

	fullURL := fmt.Sprintf("%s%s?%s", zapBaseURL(), path, params.Encode())

	req, err := http.NewRequest(http.MethodGet, fullURL, nil)
	if err != nil {
		return fmt.Errorf("zap request build failed: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach ZAP daemon: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read ZAP response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ZAP API returned %s: %s", resp.Status, truncate(string(body), 300))
	}

	if out == nil {
		return nil
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("failed to parse ZAP response: %w (body: %s)", err, truncate(string(body), 300))
	}

	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ZAPReachable checks the daemon is up and the API key is accepted, used to
// give a clear error immediately rather than failing deep inside a scan.
func ZAPReachable() error {
	var out struct {
		Version string `json:"version"`
	}
	return zapGet("/JSON/core/view/version/", nil, &out)
}

// NewSession clears ZAP's in-memory session (spider results, alerts, scan
// history) before starting a new target's scan. This app runs a single
// shared ZAP daemon for every target — without clearing state between runs,
// alerts from a previous target's scan could leak into the next one's
// results. This is also why only one web scan may run at a time (enforced
// by the caller's mutex): sharing one daemon's session across concurrent
// scans of different targets isn't safe to reason about.
func NewSession() error {
	params := url.Values{}
	params.Set("name", "")
	params.Set("overwrite", "true")
	return zapGet("/JSON/core/action/newSession/", params, nil)
}

// authCookieRuleDescription identifies the Replacer rule SetRequestCookie
// creates, so ClearRequestCookie can find and remove exactly that rule
// (identified by description, not id, per ZAP's Replacer API) without
// touching ZAP's own built-in rules or anything else.
const authCookieRuleDescription = "webscan-auth-cookie"

// SetRequestCookie makes ZAP attach a fixed Cookie header to every request
// it sends matching urlPattern, for the rest of the current scan — this is
// how a pre-authenticated session (copied from the admin's own browser
// after logging into the target manually) gets reused by the scanner,
// without ZAP needing to understand that site's specific login form.
// Verified against a live ZAP daemon: the injected header does appear on
// real outgoing requests (checked via /JSON/core/view/messages/).
func SetRequestCookie(urlPattern string, cookieValue string) error {
	params := url.Values{}
	params.Set("description", authCookieRuleDescription)
	params.Set("enabled", "true")
	params.Set("matchType", "REQ_HEADER")
	params.Set("matchRegex", "false")
	params.Set("matchString", "Cookie")
	params.Set("replacement", cookieValue)
	params.Set("initiators", "")
	params.Set("url", urlPattern)
	return zapGet("/JSON/replacer/action/addRule/", params, nil)
}

// ClearRequestCookie removes the rule SetRequestCookie created. Called
// unconditionally at the end of every scan (even if no cookie was set for
// this particular target) so a stale rule can never leak into the next
// scan — ZAP's Replacer rules are a daemon-wide option, not reset by
// NewSession.
func ClearRequestCookie() error {
	params := url.Values{}
	params.Set("description", authCookieRuleDescription)
	// removeRule returns a ZAP API error ("does_not_exist") if no rule with
	// this description exists — not a real failure for this cleanup call,
	// which runs unconditionally regardless of whether a cookie was set.
	_ = zapGet("/JSON/replacer/action/removeRule/", params, nil)
	return nil
}

// authHeaderRuleDescription identifies the Replacer rule SetRequestHeader
// creates (an Authorization/bearer header), kept distinct from the cookie
// rule so each can be added/removed independently.
const authHeaderRuleDescription = "webscan-auth-header"

// SetRequestHeader makes ZAP attach a fixed request header (e.g.
// "Authorization: Bearer <token>") to every request matching urlPattern for
// the rest of the current scan. This is the token-based counterpart to
// SetRequestCookie, for APIs/SPAs that authenticate with a bearer token
// rather than a session cookie.
func SetRequestHeader(urlPattern, headerName, headerValue string) error {
	params := url.Values{}
	params.Set("description", authHeaderRuleDescription)
	params.Set("enabled", "true")
	params.Set("matchType", "REQ_HEADER")
	params.Set("matchRegex", "false")
	params.Set("matchString", headerName)
	params.Set("replacement", headerValue)
	params.Set("initiators", "")
	params.Set("url", urlPattern)
	return zapGet("/JSON/replacer/action/addRule/", params, nil)
}

// ClearRequestHeader removes the rule SetRequestHeader created. Called
// unconditionally at scan end (like ClearRequestCookie) so a stale
// Authorization header can never leak into the next target's scan.
func ClearRequestHeader() error {
	params := url.Values{}
	params.Set("description", authHeaderRuleDescription)
	_ = zapGet("/JSON/replacer/action/removeRule/", params, nil)
	return nil
}

// ImportOpenAPI asks ZAP to import an OpenAPI/Swagger definition from specURL
// so every documented endpoint is added to the scan tree before spidering —
// covering API surfaces the crawler would never reach by following links.
// hostOverride tells ZAP which host the (possibly relative) spec paths belong
// to, set to the target's own origin.
func ImportOpenAPI(specURL, hostOverride string) error {
	params := url.Values{}
	params.Set("url", specURL)
	if hostOverride != "" {
		params.Set("hostOverride", hostOverride)
	}
	return zapGet("/JSON/openapi/action/importUrl/", params, nil)
}

// StartSpider begins crawling targetURL and returns ZAP's scan id.
func StartSpider(targetURL string) (string, error) {
	params := url.Values{}
	params.Set("url", targetURL)
	params.Set("recurse", "true")

	var out struct {
		Scan string `json:"scan"`
	}
	if err := zapGet("/JSON/spider/action/scan/", params, &out); err != nil {
		return "", err
	}
	if out.Scan == "" {
		return "", fmt.Errorf("ZAP did not return a spider scan id")
	}
	return out.Scan, nil
}

// SpiderStatus returns crawl progress 0-100.
func SpiderStatus(scanID string) (int, error) {
	params := url.Values{}
	params.Set("scanId", scanID)

	var out struct {
		Status string `json:"status"`
	}
	if err := zapGet("/JSON/spider/view/status/", params, &out); err != nil {
		return 0, err
	}
	return strconv.Atoi(out.Status)
}

func StopSpider(scanID string) error {
	params := url.Values{}
	params.Set("scanId", scanID)
	return zapGet("/JSON/spider/action/stop/", params, nil)
}

// StartActiveScan begins the active (attack payload) scan phase and returns
// ZAP's scan id. Callers must only invoke this after the caller-side
// confirm-active-scan check — this function does not re-check that, it
// just executes what it's told.
func StartActiveScan(targetURL string) (string, error) {
	params := url.Values{}
	params.Set("url", targetURL)
	params.Set("recurse", "true")

	var out struct {
		Scan string `json:"scan"`
	}
	if err := zapGet("/JSON/ascan/action/scan/", params, &out); err != nil {
		return "", err
	}
	if out.Scan == "" {
		return "", fmt.Errorf("ZAP did not return an active scan id")
	}
	return out.Scan, nil
}

// ActiveScanStatus returns active-scan progress 0-100.
func ActiveScanStatus(scanID string) (int, error) {
	params := url.Values{}
	params.Set("scanId", scanID)

	var out struct {
		Status string `json:"status"`
	}
	if err := zapGet("/JSON/ascan/view/status/", params, &out); err != nil {
		return 0, err
	}
	return strconv.Atoi(out.Status)
}

func StopActiveScan(scanID string) error {
	params := url.Values{}
	params.Set("scanId", scanID)
	return zapGet("/JSON/ascan/action/stop/", params, nil)
}

// ZAPAlert mirrors ZAP's alert objects. Tags comes back from ZAP as a JSON
// object (e.g. {"OWASP_2021_A03":"https://...","CWE-89":"https://..."})
// mapping a classification name to a reference URL — decoded here as
// map[string]string and re-encoded to a plain string for storage by the
// caller (see runWebScan in webscan.go).
type ZAPAlert struct {
	Alert       string            `json:"alert"`
	Risk        string            `json:"risk"`
	Confidence  string            `json:"confidence"`
	URL         string            `json:"url"`
	Param       string            `json:"param"`
	Method      string            `json:"method"`
	Attack      string            `json:"attack"`
	Description string            `json:"description"`
	Solution    string            `json:"solution"`
	OtherInfo   string            `json:"other"`
	Reference   string            `json:"reference"`
	CWEID       string            `json:"cweid"`
	WASCID      string            `json:"wascid"`
	AlertRef    string            `json:"alertRef"`
	PluginID    string            `json:"pluginId"`
	Evidence    string            `json:"evidence"`
	Tags        map[string]string `json:"tags"`
}

// GetAlerts fetches every alert ZAP currently holds for baseURL (the
// caller must have just run NewSession + a scan of exactly this target, so
// nothing else is mixed in).
func GetAlerts(baseURL string) ([]ZAPAlert, error) {
	params := url.Values{}
	params.Set("baseurl", baseURL)
	params.Set("start", "0")
	params.Set("count", "10000")

	var out struct {
		Alerts []ZAPAlert `json:"alerts"`
	}
	if err := zapGet("/JSON/core/view/alerts/", params, &out); err != nil {
		return nil, err
	}
	return out.Alerts, nil
}
