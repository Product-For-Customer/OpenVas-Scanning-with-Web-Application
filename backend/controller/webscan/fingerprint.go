package webscan

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// B-3 — Technology Fingerprint + End-of-Life detection
//
// Fetches a registered target once (via the same SSRF-hardened client the
// header grader uses), identifies the software stack from response headers,
// cookies and a bounded slice of the HTML, then cross-references detected
// products against endoflife.date to flag versions that are past support.
//
// endoflife.date results are cached per-product in AppEOLCache (24h TTL) so a
// page load never depends on the external API being fast/up, mirroring how the
// KEV/EPSS features cache their upstream data.
// ===========================================================================

const (
	fingerprintBodyCap = 512 * 1024
	eolCacheTTL        = 24 * time.Hour
	eolAPITimeout      = 10 * time.Second
)

type eolStatus struct {
	Product   string `json:"product"` // endoflife.date slug
	Cycle     string `json:"cycle"`
	IsEOL     bool   `json:"is_eol"`
	EOLDate   string `json:"eol_date"` // "" when the upstream marks eol as a bare boolean
	Latest    string `json:"latest"`
	Note      string `json:"note"`
}

type detectedTech struct {
	Name       string     `json:"name"`
	Version    string     `json:"version"`
	Categories []string   `json:"categories"`
	Source     string     `json:"source"`
	EOL        *eolStatus `json:"eol,omitempty"`
}

type fingerprintResult struct {
	TargetID     uint           `json:"target_id"`
	URL          string         `json:"url"`
	FinalURL     string         `json:"final_url"`
	Technologies []detectedTech `json:"technologies"`
	EOLWarnings  int            `json:"eol_warnings"`
	CheckedAt    time.Time      `json:"checked_at"`
}

// eolSlug maps a detected product (lowercased) to its endoflife.date slug.
// Only products actually served by endoflife.date are listed — anything not
// here simply isn't EOL-checked (still reported as detected tech).
var eolSlug = map[string]string{
	"nginx":     "nginx",
	"apache":    "apache-http-server",
	"php":       "php",
	"wordpress": "wordpress",
	"drupal":    "drupal",
	"joomla":    "joomla",
	"openssl":   "openssl",
	"tomcat":    "tomcat",
	"node.js":   "nodejs",
	"python":    "python",
}

// versionRe extracts a dotted version like 1.2 or 7.4.3 from a token.
var versionRe = regexp.MustCompile(`(\d+\.\d+(?:\.\d+)?)`)

// metaGeneratorRe pulls the content of <meta name="generator" content="...">.
var metaGeneratorRe = regexp.MustCompile(`(?i)<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']`)

// Compiled once at package load rather than on every request/loop iteration.
var (
	jqueryRe     = regexp.MustCompile(`(?i)jquery[-.]?(\d+\.\d+(?:\.\d+)?)`)
	majorMinorRe = regexp.MustCompile(`^(\d+\.\d+)`)
	majorRe      = regexp.MustCompile(`^(\d+)`)
)

// Fingerprint handles GET /webscan/targets/:id/fingerprint.
func Fingerprint(c *gin.Context) {
	target, ok := loadValidatedTarget(c)
	if !ok {
		return
	}
	result, err := runFingerprintForTarget(target)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach target: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// runFingerprintForTarget performs the fetch + fingerprint + EOL enrichment and
// returns the result. Reused both by the on-demand HTTP handler and by the ZAP
// scan flow (captureAuxData in webscan.go), so a scan records the same data.
func runFingerprintForTarget(target entity.AppWebScanTarget) (*fingerprintResult, error) {
	req, err := http.NewRequest(http.MethodGet, target.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ArgusTechFingerprint/1.0")

	resp, err := newHTTPAuditClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, fingerprintBodyCap))

	techs := detectTechnologies(resp, string(body))

	// EOL enrichment (cached).
	db := config.DB()
	warnings := 0
	for i := range techs {
		slug, has := eolSlug[strings.ToLower(techs[i].Name)]
		if !has || techs[i].Version == "" {
			continue
		}
		if status := lookupEOL(db, slug, techs[i].Version); status != nil {
			techs[i].EOL = status
			if status.IsEOL {
				warnings++
			}
		}
	}

	return &fingerprintResult{
		TargetID:     target.ID,
		URL:          target.URL,
		FinalURL:     resp.Request.URL.String(),
		Technologies: techs,
		EOLWarnings:  warnings,
		CheckedAt:    time.Now(),
	}, nil
}

// loadValidatedTarget is shared by Fingerprint/HTTPAudit-style handlers: load
// the target by :id and re-run the SSRF allowlist check. Returns ok=false and
// writes the error response when anything is wrong.
func loadValidatedTarget(c *gin.Context) (entity.AppWebScanTarget, bool) {
	var target entity.AppWebScanTarget
	id := strings.TrimSpace(c.Param("id"))
	if err := config.DB().First(&target, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "target not found"})
		return target, false
	}
	if err := ValidateTargetURL(target.URL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return target, false
	}
	return target, true
}

// detectTechnologies runs the signature rules over headers, cookies and HTML.
func detectTechnologies(resp *http.Response, body string) []detectedTech {
	// De-dupe by product name, preferring the entry that carries a version.
	found := map[string]detectedTech{}
	record := func(t detectedTech) {
		key := strings.ToLower(t.Name)
		if prev, ok := found[key]; ok {
			if prev.Version == "" && t.Version != "" {
				found[key] = t
			}
			return
		}
		found[key] = t
	}

	h := resp.Header

	// --- Server header: "nginx/1.18.0", "Apache/2.4.41 (Ubuntu)", "Microsoft-IIS/10.0" ---
	if server := h.Get("Server"); server != "" {
		record(parseProductToken(server, "header: Server", []string{"web-server"}))
	}
	// --- X-Powered-By: "PHP/7.4.3", "ASP.NET", "Express" ---
	if xpb := h.Get("X-Powered-By"); xpb != "" {
		record(parseProductToken(xpb, "header: X-Powered-By", []string{"framework"}))
	}
	if v := h.Get("X-AspNet-Version"); v != "" {
		record(detectedTech{Name: "ASP.NET", Version: firstVersion(v), Categories: []string{"framework"}, Source: "header: X-AspNet-Version"})
	}
	if v := h.Get("X-Generator"); v != "" {
		record(parseProductToken(v, "header: X-Generator", []string{"cms"}))
	}
	if h.Get("X-Drupal-Cache") != "" || h.Get("X-Drupal-Dynamic-Cache") != "" {
		record(detectedTech{Name: "Drupal", Categories: []string{"cms"}, Source: "header: X-Drupal-*"})
	}

	// --- Cookies imply a stack ---
	for _, ck := range resp.Cookies() {
		switch {
		case strings.EqualFold(ck.Name, "PHPSESSID"):
			record(detectedTech{Name: "PHP", Categories: []string{"language"}, Source: "cookie: PHPSESSID"})
		case strings.EqualFold(ck.Name, "JSESSIONID"):
			record(detectedTech{Name: "Java", Categories: []string{"language"}, Source: "cookie: JSESSIONID"})
		case strings.EqualFold(ck.Name, "laravel_session"):
			record(detectedTech{Name: "Laravel", Categories: []string{"framework"}, Source: "cookie: laravel_session"})
		case strings.EqualFold(ck.Name, "ci_session"):
			record(detectedTech{Name: "CodeIgniter", Categories: []string{"framework"}, Source: "cookie: ci_session"})
		case strings.EqualFold(ck.Name, "ASP.NET_SessionId"):
			record(detectedTech{Name: "ASP.NET", Categories: []string{"framework"}, Source: "cookie: ASP.NET_SessionId"})
		case strings.HasPrefix(strings.ToLower(ck.Name), "wordpress_") || strings.HasPrefix(strings.ToLower(ck.Name), "wp-"):
			record(detectedTech{Name: "WordPress", Categories: []string{"cms"}, Source: "cookie: wordpress_*"})
		}
	}

	// --- HTML: <meta name="generator"> ---
	if m := metaGeneratorRe.FindStringSubmatch(body); len(m) == 2 {
		record(parseProductToken(m[1], "meta generator", []string{"cms"}))
	}

	// --- HTML body signatures (paths / script markers) ---
	lower := strings.ToLower(body)
	if strings.Contains(lower, "/wp-content/") || strings.Contains(lower, "/wp-includes/") {
		record(detectedTech{Name: "WordPress", Categories: []string{"cms"}, Source: "html: wp-content path"})
	}
	if m := jqueryRe.FindStringSubmatch(body); len(m) == 2 {
		record(detectedTech{Name: "jQuery", Version: m[1], Categories: []string{"js-library"}, Source: "html: script src"})
	}
	if strings.Contains(lower, "react") && (strings.Contains(lower, "react-dom") || strings.Contains(lower, "data-reactroot")) {
		record(detectedTech{Name: "React", Categories: []string{"js-framework"}, Source: "html: react markers"})
	}
	if strings.Contains(lower, "vue") && strings.Contains(lower, "__vue__") {
		record(detectedTech{Name: "Vue.js", Categories: []string{"js-framework"}, Source: "html: vue markers"})
	}
	if strings.Contains(lower, "ng-version") {
		record(detectedTech{Name: "Angular", Categories: []string{"js-framework"}, Source: "html: ng-version"})
	}
	if strings.Contains(lower, "bootstrap") {
		record(detectedTech{Name: "Bootstrap", Categories: []string{"ui-framework"}, Source: "html: bootstrap"})
	}

	out := make([]detectedTech, 0, len(found))
	for _, t := range found {
		out = append(out, t)
	}
	return out
}

// parseProductToken turns "nginx/1.18.0" or "Apache/2.4.41 (Ubuntu)" into a
// detectedTech with the name cleaned and the first dotted version extracted.
func parseProductToken(token, source string, categories []string) detectedTech {
	token = strings.TrimSpace(token)
	name := token
	if idx := strings.IndexAny(token, "/ "); idx > 0 {
		name = token[:idx]
	}
	// Normalise a couple of vendor-y names to the plain product name.
	switch {
	case strings.EqualFold(name, "Microsoft-IIS"):
		name = "IIS"
	case strings.HasPrefix(strings.ToLower(name), "apache"):
		name = "Apache"
	}
	return detectedTech{
		Name:       name,
		Version:    firstVersion(token),
		Categories: categories,
		Source:     source,
	}
}

func firstVersion(s string) string {
	if m := versionRe.FindString(s); m != "" {
		return m
	}
	return ""
}

// ===========================================================================
// endoflife.date lookup + cache
// ===========================================================================

type eolCycle struct {
	Cycle  string          `json:"cycle"`
	Latest string          `json:"latest"`
	EOL    json.RawMessage `json:"eol"` // bool OR "YYYY-MM-DD"
}

var eolHTTPClient = &http.Client{Timeout: eolAPITimeout}

// lookupEOL returns the EOL status for a detected product/version, using the
// cache and refreshing from endoflife.date when stale. Returns nil if the data
// can't be obtained or the version can't be matched to a release cycle.
func lookupEOL(db *gorm.DB, slug, version string) *eolStatus {
	raw, err := getEOLData(db, slug)
	if err != nil || raw == "" {
		return nil
	}

	var cycles []eolCycle
	if err := json.Unmarshal([]byte(raw), &cycles); err != nil {
		return nil
	}

	// Match the detected version to a release cycle: exact cycle match first
	// (e.g. version 1.18.0 -> cycle "1.18"), then major-only (cycle "1").
	majorMinor := ""
	if m := majorMinorRe.FindStringSubmatch(version); len(m) == 2 {
		majorMinor = m[1]
	}
	major := ""
	if m := majorRe.FindStringSubmatch(version); len(m) == 2 {
		major = m[1]
	}

	var match *eolCycle
	for i := range cycles {
		if cycles[i].Cycle == majorMinor {
			match = &cycles[i]
			break
		}
	}
	if match == nil {
		for i := range cycles {
			if cycles[i].Cycle == major {
				match = &cycles[i]
				break
			}
		}
	}
	if match == nil {
		return nil
	}

	isEOL, eolDate := interpretEOL(match.EOL)
	note := "supported"
	if isEOL {
		if eolDate != "" {
			note = "end-of-life since " + eolDate
		} else {
			note = "end-of-life (no longer supported)"
		}
	}

	return &eolStatus{
		Product: slug,
		Cycle:   match.Cycle,
		IsEOL:   isEOL,
		EOLDate: eolDate,
		Latest:  match.Latest,
		Note:    note,
	}
}

// interpretEOL decodes endoflife.date's polymorphic `eol` field (bool or date
// string) into (isEOL, dateString).
func interpretEOL(raw json.RawMessage) (bool, string) {
	if len(raw) == 0 {
		return false, ""
	}
	// Try boolean.
	var b bool
	if err := json.Unmarshal(raw, &b); err == nil {
		return b, ""
	}
	// Try date string.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			return time.Now().After(t), s
		}
	}
	return false, ""
}

// getEOLData returns the cached raw JSON for slug, refreshing from the network
// when missing or older than the TTL. A stale-but-present cache is preferred
// over a failed refresh (returns the old data rather than erroring).
func getEOLData(db *gorm.DB, slug string) (string, error) {
	var cache entity.AppEOLCache
	err := db.Where("product = ?", slug).First(&cache).Error

	fresh := err == nil && time.Since(cache.FetchedAt) < eolCacheTTL
	if fresh {
		return cache.Data, nil
	}

	data, fetchErr := fetchEOLFromAPI(slug)
	if fetchErr != nil {
		if err == nil {
			// Network failed but we have older cached data — use it.
			return cache.Data, nil
		}
		return "", fetchErr
	}

	now := time.Now()
	if err == nil {
		db.Model(&cache).Updates(map[string]interface{}{"data": data, "fetched_at": now})
	} else {
		db.Create(&entity.AppEOLCache{Product: slug, Data: data, FetchedAt: now})
	}
	return data, nil
}

func fetchEOLFromAPI(slug string) (string, error) {
	url := fmt.Sprintf("https://endoflife.date/api/%s.json", slug)
	resp, err := eolHTTPClient.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("endoflife.date returned %s for %s", resp.Status, slug)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	return string(body), nil
}
