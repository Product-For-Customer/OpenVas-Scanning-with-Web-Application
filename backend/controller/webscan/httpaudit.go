package webscan

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ===========================================================================
// B-2 — HTTP Security Header + TLS Grader
//
// A zero-container, in-process check: fetch a registered target once, inspect
// its response headers and TLS handshake, and return an A–F grade plus a
// per-check breakdown. Cheap enough to run on demand from the UI.
//
// Security notes:
//   - Only runs against an existing AppWebScanTarget (the same admin-curated
//     allowlist ZAP uses); the URL is re-validated with ValidateTargetURL.
//   - The HTTP client re-validates EVERY redirect hop, so a target that 302s
//     to a loopback / cloud-metadata / internal-service address can't be used
//     to turn this into an SSRF probe.
//   - Response body is size-capped and (mostly) discarded — only headers and
//     the TLS state are needed.
// ===========================================================================

const (
	httpAuditTimeout      = 15 * time.Second
	httpAuditMaxRedirects = 5
	httpAuditBodyCap      = 256 * 1024 // we don't need the body, but read a little politely
)

// headerCheck is one graded response-header (or cookie) expectation.
type headerCheck struct {
	Name    string `json:"name"`
	Present bool   `json:"present"`
	Good    bool   `json:"good"`   // present AND (where relevant) a sane value
	Value   string `json:"value"`  // the observed value (truncated), "" if absent
	Weight  int    `json:"weight"` // points this check contributes to the score
	Advice  string `json:"advice"` // what to do if not good
}

type tlsInfo struct {
	Enabled         bool      `json:"enabled"`
	Version         string    `json:"version"`
	CipherSuite     string    `json:"cipher_suite"`
	CertSubject     string    `json:"cert_subject"`
	CertIssuer      string    `json:"cert_issuer"`
	NotAfter        time.Time `json:"not_after"`
	DaysUntilExpiry int       `json:"days_until_expiry"`
	Warnings        []string  `json:"warnings"`
}

type httpAuditResult struct {
	TargetID   uint          `json:"target_id"`
	URL        string        `json:"url"`
	FinalURL   string        `json:"final_url"`
	StatusCode int           `json:"status_code"`
	Scheme     string        `json:"scheme"`
	Grade      string        `json:"grade"`
	Score      int           `json:"score"`     // 0-100
	MaxScore   int           `json:"max_score"` // always 100 (kept explicit for the UI)
	Checks     []headerCheck `json:"checks"`
	TLS        tlsInfo       `json:"tls"`
	CheckedAt  time.Time     `json:"checked_at"`
}

// newHTTPAuditClient builds a client that hard-fails any redirect to a
// disallowed host, so the grader can't be redirected into internal space.
func newHTTPAuditClient() *http.Client {
	return &http.Client{
		Timeout: httpAuditTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= httpAuditMaxRedirects {
				return fmt.Errorf("stopped after %d redirects", httpAuditMaxRedirects)
			}
			if err := ValidateTargetURL(req.URL.String()); err != nil {
				return fmt.Errorf("refusing redirect to disallowed host: %w", err)
			}
			return nil
		},
	}
}

// HTTPAudit handles GET /webscan/targets/:id/http-audit.
func HTTPAudit(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid target id"})
		return
	}

	var target entity.AppWebScanTarget
	if err := config.DB().First(&target, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "target not found"})
		return
	}

	// Re-validate even though creation already did — the row could predate a
	// tightening of the rules, and defense-in-depth is cheap here.
	if err := ValidateTargetURL(target.URL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := runHTTPAudit(target)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach or evaluate target: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func runHTTPAudit(target entity.AppWebScanTarget) (*httpAuditResult, error) {
	req, err := http.NewRequest(http.MethodGet, target.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ArgusSecurityHeaderGrader/1.0")

	resp, err := newHTTPAuditClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	// Drain a bounded amount so the connection can be reused, then move on —
	// the grade is computed purely from headers + TLS state.
	_, _ = io.CopyN(io.Discard, resp.Body, httpAuditBodyCap)

	scheme := strings.ToLower(resp.Request.URL.Scheme)
	isHTTPS := scheme == "https"

	checks := gradeSecurityHeaders(resp, isHTTPS)
	tlsData := gradeTLS(resp)

	// Score = earned header points + TLS points, normalised to 100.
	earned := 0
	totalWeight := 0
	for _, ch := range checks {
		totalWeight += ch.Weight
		if ch.Good {
			earned += ch.Weight
		}
	}

	// TLS is worth a fixed 25-point block on top of the header weights.
	const tlsWeight = 25
	totalWeight += tlsWeight
	if isHTTPS && len(tlsData.Warnings) == 0 {
		earned += tlsWeight
	} else if isHTTPS {
		earned += tlsWeight / 2 // HTTPS present but with warnings (weak version / near expiry)
	}
	// Plaintext HTTP earns 0 of the TLS block.

	score := 0
	if totalWeight > 0 {
		score = int(float64(earned) / float64(totalWeight) * 100.0)
	}

	return &httpAuditResult{
		TargetID:   target.ID,
		URL:        target.URL,
		FinalURL:   resp.Request.URL.String(),
		StatusCode: resp.StatusCode,
		Scheme:     scheme,
		Grade:      scoreToGrade(score),
		Score:      score,
		MaxScore:   100,
		Checks:     checks,
		TLS:        tlsData,
		CheckedAt:  time.Now(),
	}, nil
}

// gradeSecurityHeaders inspects the well-known hardening headers. HSTS is only
// counted when the response came over HTTPS (it is meaningless over plaintext).
func gradeSecurityHeaders(resp *http.Response, isHTTPS bool) []headerCheck {
	h := resp.Header
	checks := []headerCheck{}

	add := func(name string, weight int, good bool, value, advice string) {
		checks = append(checks, headerCheck{
			Name:    name,
			Present: strings.TrimSpace(value) != "",
			Good:    good,
			Value:   truncate(value, 200),
			Weight:  weight,
			Advice:  advice,
		})
	}

	csp := h.Get("Content-Security-Policy")
	add("Content-Security-Policy", 20, strings.TrimSpace(csp) != "", csp,
		"Add a CSP to constrain what scripts/resources may load and block clickjacking via frame-ancestors.")

	xfo := h.Get("X-Frame-Options")
	xfoGood := strings.EqualFold(strings.TrimSpace(xfo), "DENY") || strings.EqualFold(strings.TrimSpace(xfo), "SAMEORIGIN")
	// A CSP frame-ancestors directive also satisfies clickjacking protection.
	if !xfoGood && strings.Contains(strings.ToLower(csp), "frame-ancestors") {
		xfoGood = true
	}
	add("X-Frame-Options", 10, xfoGood, xfo,
		"Set X-Frame-Options: DENY (or a CSP frame-ancestors 'none') to prevent clickjacking.")

	xcto := h.Get("X-Content-Type-Options")
	add("X-Content-Type-Options", 10, strings.EqualFold(strings.TrimSpace(xcto), "nosniff"), xcto,
		"Set X-Content-Type-Options: nosniff to stop MIME-sniffing.")

	ref := h.Get("Referrer-Policy")
	add("Referrer-Policy", 8, strings.TrimSpace(ref) != "", ref,
		"Set a Referrer-Policy (e.g. strict-origin-when-cross-origin) so full URLs don't leak to third parties.")

	pp := h.Get("Permissions-Policy")
	add("Permissions-Policy", 7, strings.TrimSpace(pp) != "", pp,
		"Set a Permissions-Policy to deny powerful device APIs the app doesn't use.")

	if isHTTPS {
		hsts := h.Get("Strict-Transport-Security")
		add("Strict-Transport-Security", 15, strings.TrimSpace(hsts) != "", hsts,
			"Set HSTS (Strict-Transport-Security) so browsers refuse to downgrade to HTTP.")
	}

	// Cookie flags: only graded if the response actually sets cookies.
	if cookies := resp.Cookies(); len(cookies) > 0 {
		allFlagged := true
		var sample string
		for _, ck := range cookies {
			if !ck.Secure || !ck.HttpOnly {
				allFlagged = false
				sample = ck.Name
				break
			}
		}
		val := "all cookies Secure+HttpOnly"
		if !allFlagged {
			val = "cookie missing Secure/HttpOnly: " + sample
		}
		add("Cookie flags (Secure+HttpOnly)", 10, allFlagged, val,
			"Set Secure and HttpOnly on session cookies so they aren't sent over HTTP or readable by JavaScript.")
	}

	// Server banner disclosure — informational, small weight; "good" means it
	// does NOT leak a precise version string.
	server := h.Get("Server")
	leaksVersion := strings.ContainsAny(server, "0123456789")
	add("Server banner (no version leak)", 5, strings.TrimSpace(server) == "" || !leaksVersion, server,
		"Suppress or genericise the Server header so it doesn't advertise an exact software version.")

	return checks
}

func gradeTLS(resp *http.Response) tlsInfo {
	info := tlsInfo{Warnings: []string{}}
	cs := resp.TLS
	if cs == nil {
		info.Enabled = false
		info.Warnings = append(info.Warnings, "connection is plaintext HTTP (no TLS)")
		return info
	}

	info.Enabled = true
	info.Version = tlsVersionName(cs.Version)
	info.CipherSuite = tls.CipherSuiteName(cs.CipherSuite)

	if cs.Version < tls.VersionTLS12 {
		info.Warnings = append(info.Warnings, "obsolete TLS version ("+info.Version+") — require TLS 1.2 or higher")
	}

	if len(cs.PeerCertificates) > 0 {
		leaf := cs.PeerCertificates[0]
		info.CertSubject = leaf.Subject.CommonName
		if leaf.Issuer.CommonName != "" {
			info.CertIssuer = leaf.Issuer.CommonName
		} else if len(leaf.Issuer.Organization) > 0 {
			info.CertIssuer = leaf.Issuer.Organization[0]
		}
		info.NotAfter = leaf.NotAfter
		days := int(time.Until(leaf.NotAfter).Hours() / 24)
		info.DaysUntilExpiry = days
		switch {
		case days < 0:
			info.Warnings = append(info.Warnings, "certificate has EXPIRED")
		case days < 14:
			info.Warnings = append(info.Warnings, fmt.Sprintf("certificate expires in %d day(s)", days))
		}
	}

	return info
}

func tlsVersionName(v uint16) string {
	switch v {
	case tls.VersionTLS10:
		return "TLS 1.0"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS13:
		return "TLS 1.3"
	default:
		return fmt.Sprintf("0x%04x", v)
	}
}

func scoreToGrade(score int) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 65:
		return "C"
	case score >= 50:
		return "D"
	case score >= 35:
		return "E"
	default:
		return "F"
	}
}
