package webscan

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// internalServiceHosts is this compose project's own service names (see
// docker-compose.yml). A "web app scan target" pointed at any of these
// isn't a real web application to test — it's either a misconfiguration or
// an attempt to turn the active-scan attack traffic against this
// deployment's own infrastructure (e.g. active-scanning gvmd's or the
// backend's own endpoints could break the running vulnerability platform).
var internalServiceHosts = map[string]bool{
	"backend":             true,
	"frontend":            true,
	"zap":                 true,
	"gvmd":                true,
	"gsa":                 true,
	"pg-gvm":              true,
	"pg-gvm-migrator":     true,
	"ospd-openvas":        true,
	"openvas":             true,
	"openvasd":            true,
	"configure-openvas":   true,
	"gvm-tools":           true,
	"db-init":             true,
	"vulnerability-tests": true,
	"notus-data":          true,
	"scap-data":           true,
	"cert-bund-data":      true,
	"dfn-cert-data":       true,
	"data-objects":        true,
	"report-formats":      true,
	"gpg-data":            true,
	"redis-server":        true,
	"localhost":           true,
}

// ValidateTargetURL is deliberately conservative rather than exhaustive:
// it blocks the specific, high-confidence-dangerous cases (wrong scheme,
// this deployment's own internal services, loopback, cloud metadata) and
// otherwise allows the URL through — including ordinary private-IP
// addresses (10.x/172.16.x/192.168.x), since scanning an organization's own
// internally-hosted web apps on a private network is this feature's entire
// purpose.
//
// Known limitation: this checks the hostname/IP as written in the URL, not
// what it actually resolves to at request time (full DNS-rebinding
// protection would need to re-resolve and re-check immediately before each
// HTTP call ZAP itself makes, which is inside ZAP's own code, not this
// app's). Acceptable here because targets are an admin-curated allowlist
// created ahead of time, not attacker-supplied at request time.
func ValidateTargetURL(raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fmt.Errorf("URL is required")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("URL must use http:// or https://")
	}

	host := strings.ToLower(parsed.Hostname())
	if host == "" {
		return fmt.Errorf("URL must include a host")
	}

	if internalServiceHosts[host] {
		return fmt.Errorf("cannot scan this deployment's own internal service (%s) — register the URL of an actual web application instead", host)
	}

	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() {
			return fmt.Errorf("cannot scan loopback addresses")
		}
		if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return fmt.Errorf("cannot scan link-local addresses (this range includes cloud instance metadata endpoints)")
		}
	}

	return nil
}
