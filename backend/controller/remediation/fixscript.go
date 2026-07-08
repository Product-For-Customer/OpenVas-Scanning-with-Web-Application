package remediation

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/Tawunchai/openvas/entity"
	"gorm.io/gorm"
)

// FixScript is a ready-to-apply remediation for one finding: a short human
// checklist plus a copy-paste script in a concrete language. It is generated
// from a curated rule library that maps the finding's name / family / CVEs /
// solution type to a concrete action — turning "here is a vulnerability" into
// "here is exactly what to run to fix it", which is the whole point of Phase 2.
type FixScript struct {
	Method   string   `json:"method"`   // patch | config | network_control | credential | certificate | compensating
	Language string   `json:"language"` // powershell | bash | cisco | text
	Script   string   `json:"script"`   // copy-paste block
	Steps    []string `json:"steps"`    // ordered human checklist
	Source   string   `json:"source"`   // "playbook:<id>" or "scanner-solution"
}

type fixRule struct {
	id       string
	method   string
	language string
	// match returns true if this rule applies to the given lowercased haystack
	// (vuln name + family + cve list + solution text, joined).
	match func(hay string) bool
	build func(r entity.AppRemediation) ([]string, string)
}

func contains(hay string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(hay, n) {
			return true
		}
	}
	return false
}

// fixRules is ordered; the first matching rule wins. Rules cover the findings
// an agentless L2–L4 + web scan most commonly surfaces — including network gear
// a competitor's endpoint agent could never remediate (switches, SNMP, telnet).
var fixRules = []fixRule{
	{
		id: "smbv1", method: "config", language: "powershell",
		match: func(h string) bool { return contains(h, "smbv1", "smb1", "ms17-010", "cve-2017-0144", "eternalblue") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Confirm SMBv1 is not required by any legacy client on this host.",
					"Disable the SMBv1 protocol (client + server).",
					"Reboot to fully unload the mrxsmb10 driver.",
					"Re-scan to verify the finding is gone.",
				}, `# Windows — disable SMBv1 (run as Administrator)
Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" SMB1 -Type DWORD -Value 0 -Force
# Reboot required:
# Restart-Computer`
		},
	},
	{
		id: "weak-tls", method: "config", language: "bash",
		match: func(h string) bool {
			return contains(h, "sslv2", "sslv3", "tls 1.0", "tlsv1.0", "tls 1.1", "tlsv1.1", "poodle", "beast", "weak cipher", "weak ssl", "deprecated tls", "rc4")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Disable SSLv2, SSLv3, TLS 1.0 and TLS 1.1 on the service.",
					"Allow only TLS 1.2+ with strong ciphers (no RC4/3DES).",
					"Reload the service and re-scan to verify.",
				}, `# nginx — allow only strong TLS (edit server block, then reload)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
# sudo nginx -t && sudo systemctl reload nginx

# Apache — in the vhost:
# SSLProtocol -all +TLSv1.2 +TLSv1.3
# SSLCipherSuite HIGH:!aNULL:!MD5:!RC4:!3DES
# sudo systemctl reload apache2`
		},
	},
	{
		id: "bluekeep-rdp", method: "patch", language: "powershell",
		match: func(h string) bool { return contains(h, "bluekeep", "cve-2019-0708", "remote desktop", "rdp") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Apply the vendor RDP security update (Windows Update / relevant KB).",
					"Require Network Level Authentication (NLA) for RDP.",
					"Restrict RDP (3389/tcp) to management subnets at the firewall.",
				}, `# Windows — require NLA for RDP and confirm patch level
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "UserAuthentication" -Value 1
# Ensure latest cumulative update is installed:
# Install-Module PSWindowsUpdate; Get-WindowsUpdate -Install -AcceptAll`
		},
	},
	{
		id: "telnet", method: "network_control", language: "cisco",
		match: func(h string) bool { return contains(h, "telnet") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Disable Telnet (cleartext) on the device.",
					"Enable SSH for management instead.",
					"Re-scan to confirm port 23 is closed.",
				}, `! Cisco IOS — disable Telnet, force SSH on the VTY lines
configure terminal
 ip domain-name example.local
 crypto key generate rsa modulus 2048
 line vty 0 15
  transport input ssh
  no transport input telnet
 end
write memory`
		},
	},
	{
		id: "snmp-default", method: "config", language: "cisco",
		match: func(h string) bool {
			return contains(h, "snmp") && contains(h, "default community", "public", "private", "guessable", "weak community")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Remove default SNMP communities (public/private).",
					"Move to SNMPv3 with authentication + privacy, or a strong custom community.",
					"Restrict SNMP (161/udp) to the monitoring host only.",
				}, `! Cisco IOS — remove default communities, enable SNMPv3
configure terminal
 no snmp-server community public
 no snmp-server community private
 snmp-server group SECURE v3 priv
 snmp-server user monuser SECURE v3 auth sha <AUTH_PASS> priv aes 128 <PRIV_PASS>
 end
write memory`
		},
	},
	{
		// Terrapin (CVE-2023-48795) + generic "SSH weak MAC/cipher/KEX" findings —
		// extremely common on switches/routers/appliances an agent can't touch.
		id: "ssh-hardening", method: "config", language: "text",
		match: func(h string) bool {
			if contains(h, "terrapin", "cve-2023-48795") {
				return true
			}
			return contains(h, "ssh") && contains(h, "weak mac", "weak encryption", "weak cipher", "weak key exchange", "cbc mode", "arcfour", "hmac-md5")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Update SSH to a build with strict key-exchange (OpenSSH ≥ 9.6 / vendor fixed release).",
					"Remove CBC ciphers, weak MACs (MD5/96-bit) and legacy KEX; keep CTR/GCM + SHA2.",
					"Restart the SSH service / reload the device, then re-scan.",
				}, `# OpenSSH — /etc/ssh/sshd_config
Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256
# sudo systemctl restart ssh

! Cisco IOS
ip ssh version 2
ip ssh server algorithm encryption aes256-ctr aes192-ctr aes128-ctr
ip ssh server algorithm mac hmac-sha2-512 hmac-sha2-256
! write memory`
		},
	},
	{
		// SSL/TLS renegotiation DoS (CVE-2011-1473 etc.).
		id: "tls-renegotiation", method: "config", language: "bash",
		match: func(h string) bool { return contains(h, "renegotiation") && contains(h, "ssl", "tls") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Disable client-initiated TLS renegotiation on the service.",
					"Update the TLS library to a patched version.",
					"Reload and re-scan.",
				}, `# nginx (>=1.1.13 disables client renegotiation by default) — ensure updated:
sudo apt update && sudo apt install --only-upgrade nginx openssl
sudo systemctl reload nginx

# Apache httpd — in the vhost:
# SSLInsecureRenegotiation off
# sudo systemctl reload apache2`
		},
	},
	{
		// Weak Diffie-Hellman / Logjam / D(HE)ater.
		id: "weak-dh", method: "config", language: "bash",
		match: func(h string) bool {
			return contains(h, "logjam", "d(he)ater", "dheater") || contains(h, "diffie-hellman", "diffie hellman", " dhe ")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Prefer ECDHE and drop finite-field DHE cipher suites (or use a unique ≥2048-bit group).",
					"Reload the service and re-scan.",
				}, `# nginx — prefer ECDHE, generate a strong DH group if DHE is kept
sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048
# in the server block:
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384';
ssl_dhparam /etc/nginx/dhparam.pem;
ssl_prefer_server_ciphers on;
# sudo nginx -t && sudo systemctl reload nginx`
		},
	},
	{
		// Cisco Smart Install abuse (CVE-2018-0171) — network-edge RCE vector.
		id: "cisco-smart-install", method: "network_control", language: "cisco",
		match: func(h string) bool { return contains(h, "smart install", "vstack", "cve-2018-0171") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Disable the Smart Install client if you don't use zero-touch provisioning.",
					"Block TCP/4786 at the network edge.",
					"Re-scan to confirm the port is closed.",
				}, `! Cisco IOS — disable Smart Install
configure terminal
 no vstack
 end
write memory
! Verify:
show vstack config`
		},
	},
	{
		// DCE/RPC · MSRPC · NetBIOS/SMB service enumeration — reduce exposure at L3/L4.
		id: "rpc-smb-exposure", method: "network_control", language: "text",
		match: func(h string) bool {
			return contains(h, "dce/rpc", "dcerpc", "msrpc", "netbios") || (contains(h, "smb") && contains(h, "enumeration", "browser", "null session"))
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"These ports should never face untrusted networks — filter them at the edge and between VLANs.",
					"Disable NetBIOS over TCP/IP where SMB isn't needed.",
					"Re-scan from the untrusted side to confirm they're filtered.",
				}, `# Windows firewall — block inbound RPC/SMB from non-management subnets
New-NetFirewallRule -DisplayName "Block RPC/SMB from users" -Direction Inbound -Protocol TCP -LocalPort 135,139,445 -RemoteAddress 10.10.0.0/16 -Action Block

! Cisco ACL on the boundary interface
ip access-list extended BLOCK-RPC-SMB
 deny tcp any any eq 135
 deny tcp any any eq 139
 deny tcp any any eq 445
 permit ip any any`
		},
	},
	{
		// ICMP timestamp / info leakage.
		id: "icmp-timestamp", method: "network_control", language: "cisco",
		match: func(h string) bool { return contains(h, "icmp timestamp", "timestamp request", "icmp netmask") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Drop ICMP timestamp/netmask requests at the device or edge firewall.",
					"Re-scan to verify.",
				}, `! Cisco IOS — deny ICMP timestamp on the ingress ACL
ip access-list extended ANTI-RECON
 deny icmp any any timestamp-request
 deny icmp any any timestamp-reply
 permit ip any any
! Linux host alternative:
# iptables -A INPUT -p icmp --icmp-type timestamp-request -j DROP`
		},
	},
	{
		id: "default-creds", method: "credential", language: "text",
		match: func(h string) bool {
			return contains(h, "default credential", "default password", "default account", "factory default", "well-known credential")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Log in and change every default/factory account password to a unique strong secret.",
					"Disable or rename unused default accounts.",
					"Store the new credential in your password manager, then re-scan.",
				}, `# Manual — no safe universal script.
# 1) Access the device admin console.
# 2) Change default admin password (>=16 chars, unique).
# 3) Disable guest/unused accounts.
# 4) Re-run the scan to verify the finding clears.`
		},
	},
	{
		id: "expired-cert", method: "certificate", language: "bash",
		match: func(h string) bool {
			return contains(h, "certificate") && contains(h, "expired", "self-signed", "self signed", "untrusted", "expire")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Issue a valid certificate from a trusted CA (or internal PKI).",
					"Install the full chain and private key on the service.",
					"Reload the service and re-scan.",
				}, `# Example — obtain a trusted cert with certbot (public host)
sudo certbot certonly --standalone -d your.domain.example
# Then point the service at:
#   /etc/letsencrypt/live/your.domain.example/fullchain.pem
#   /etc/letsencrypt/live/your.domain.example/privkey.pem
# and reload the service.`
		},
	},
	{
		id: "outdated-openssh", method: "patch", language: "bash",
		match: func(h string) bool { return contains(h, "openssh") },
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Update OpenSSH to the fixed version from your distro.",
					"Restart sshd and re-scan.",
				}, `# Debian/Ubuntu
sudo apt update && sudo apt install --only-upgrade openssh-server
sudo systemctl restart ssh
# RHEL/CentOS
# sudo yum update -y openssh-server && sudo systemctl restart sshd`
		},
	},
	{
		id: "outdated-web", method: "patch", language: "bash",
		match: func(h string) bool { return contains(h, "apache", "nginx", "php", "openssl", "http server") },
		build: func(r entity.AppRemediation) ([]string, string) {
			pkg := "the affected package"
			switch {
			case contains(strings.ToLower(r.VulnName), "nginx"):
				pkg = "nginx"
			case contains(strings.ToLower(r.VulnName), "apache", "httpd"):
				pkg = "apache2"
			case contains(strings.ToLower(r.VulnName), "php"):
				pkg = "php"
			case contains(strings.ToLower(r.VulnName), "openssl"):
				pkg = "openssl"
			}
			return []string{
					fmt.Sprintf("Upgrade %s to the distro's patched version.", pkg),
					"Restart the affected service.",
					"Re-scan to verify.",
				}, fmt.Sprintf(`# Debian/Ubuntu
sudo apt update && sudo apt install --only-upgrade %s
# RHEL/CentOS
# sudo yum update -y %s`, pkg, pkg)
		},
	},
	{
		id: "windows-missing-patch", method: "patch", language: "powershell",
		match: func(h string) bool {
			return contains(h, "microsoft", "windows") && contains(h, "missing", "security update", "patch", "kb")
		},
		build: func(_ entity.AppRemediation) ([]string, string) {
			return []string{
					"Install the missing Microsoft security update(s).",
					"Reboot if required, then re-scan.",
				}, `# Windows — install all pending security updates
Install-Module PSWindowsUpdate -Force -Scope CurrentUser
Import-Module PSWindowsUpdate
Get-WindowsUpdate -Category "Security Updates" -Install -AcceptAll -AutoReboot`
		},
	},
}

// GenerateFixScript produces the best available remediation for a finding.
// It tries the curated playbook rules first (most actionable); if none match it
// falls back to the scanner's own solution text wrapped as guidance, choosing a
// method hint from the finding's solution_type so the UI can still label it.
func GenerateFixScript(r entity.AppRemediation) FixScript {
	hay := strings.ToLower(strings.Join([]string{r.VulnName, r.Family, r.CVEList, r.SolutionText, r.SolutionType}, " "))

	for _, rule := range fixRules {
		if rule.match(hay) {
			steps, script := rule.build(r)
			return FixScript{
				Method:   rule.method,
				Language: rule.language,
				Script:   script,
				Steps:    steps,
				Source:   "playbook:" + rule.id,
			}
		}
	}

	// Fallback: derive a method from the scanner's solution_type and present its
	// solution text as the guidance body.
	method := "compensating"
	switch strings.ToLower(strings.TrimSpace(r.SolutionType)) {
	case "vendorfix":
		method = "patch"
	case "workaround", "mitigation":
		method = "config"
	}
	body := strings.TrimSpace(r.SolutionText)
	steps := []string{}
	if body != "" {
		steps = []string{
			"Follow the scanner-provided solution below.",
			"Apply the change on the affected host/service.",
			"Re-scan to verify the finding clears.",
		}
	} else {
		body = "No vendor solution text was provided by the scanner. Research the CVE(s) and apply the vendor's fix, then re-scan to verify."
	}
	return FixScript{
		Method:   method,
		Language: "text",
		Script:   body,
		Steps:    steps,
		Source:   "scanner-solution",
	}
}

// ── Remediation Plan (richer, honest presentation) ────────────────────────────

// PlanRef is a clickable reference — a CVE detail page or a vendor advisory —
// that turns a thin "update to version X" line into something actionable.
type PlanRef struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// RemediationPlan is the deep, honest remediation view. It distinguishes a real
// runnable Command (from a playbook rule) from plain Guidance (a scanner
// recommendation), and surrounds it with the context an operator needs to act:
// why it matters (Impact), what's affected, the fixed version, and clickable
// references. This replaces the old "everything is a fake script" panel.
type RemediationPlan struct {
	Method       string    `json:"method"`        // patch | config | network_control | credential | certificate | compensating
	Kind         string    `json:"kind"`          // "command" (runnable) | "guidance" (advice text)
	Language     string    `json:"language"`      // powershell | bash | cisco | text
	Command      string    `json:"command"`       // populated when kind == "command"
	Guidance     string    `json:"guidance"`      // populated when kind == "guidance"
	Steps        []string  `json:"steps"`         // ordered checklist
	Impact       string    `json:"impact"`        // why it matters (from NVT)
	Affected     string    `json:"affected"`      // affected software/versions (from NVT)
	FixedVersion string    `json:"fixed_version"` // parsed "upgrade to X" target, if any
	References   []PlanRef `json:"references"`    // CVE + advisory links
	Compensating []string  `json:"compensating"` // network-level mitigations for "can't patch yet"
	Source       string    `json:"source"`        // playbook:<id> | scanner-solution
}

// portLabel turns a Greenbone port string ("5580/tcp", "22/tcp", "general/tcp")
// into a firewall-friendly label like "TCP/5580". Returns "" when there is no
// concrete numeric port to filter on.
func portLabel(port string) string {
	port = strings.TrimSpace(port)
	if port == "" {
		return ""
	}
	parts := strings.SplitN(port, "/", 2)
	num := strings.TrimSpace(parts[0])
	if num == "" || strings.EqualFold(num, "general") {
		return ""
	}
	proto := "tcp"
	if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
		proto = strings.TrimSpace(parts[1])
	}
	return strings.ToUpper(proto) + "/" + num
}

// compensatingControls returns network-level mitigations to apply when the
// vulnerability can't be patched right away — the "reduce blast radius now"
// options. This is exactly the ground agentless L2–L4 scanning owns: an
// endpoint agent can't put an ACL on a switch or segment a VLAN, but we can
// recommend it precisely because we see the device on the network.
func compensatingControls(r entity.AppRemediation) []string {
	out := make([]string, 0, 4)

	if label := portLabel(r.Port); label != "" {
		out = append(out, fmt.Sprintf("Restrict %s to trusted management subnets with a firewall / ACL rule.", label))
	}
	out = append(out, "Isolate the device in a segmented VLAN with least-privilege access between segments.")

	hay := strings.ToLower(r.VulnName + " " + r.Family)
	switch {
	case contains(hay, "ssl", "tls", "https", "certificate"):
		out = append(out, "Terminate the service behind a reverse proxy that enforces modern TLS.")
	case contains(hay, "snmp"):
		out = append(out, "Bind SNMP to the monitoring host's IP only and drop 161/udp elsewhere.")
	case contains(hay, "ssh", "telnet", "rdp", "vnc"):
		out = append(out, "Permit remote management only from a jump host / bastion, not the whole network.")
	case contains(hay, "smb", "rpc", "netbios", "msrpc"):
		out = append(out, "Block 135/139/445 at the network edge and between user VLANs.")
	}

	out = append(out, "If the affected service isn't required on this device, disable it entirely.")
	return out
}

type nvtContextRow struct {
	Impact   string `gorm:"column:impact"`
	Insight  string `gorm:"column:insight"`
	Affected string `gorm:"column:affected"`
	Summary  string `gorm:"column:summary"`
}

// fixedVersionRe pulls a concrete target version out of a solution line like
// "Update to version 20.3.0 or later" / "Upgrade to 1.2.3".
var fixedVersionRe = regexp.MustCompile(`(?i)(?:update|upgrade|patch)\s+to\s+(?:version\s+)?v?([0-9]+(?:\.[0-9]+){1,3})`)

func loadNVTContext(db *gorm.DB, oid string) nvtContextRow {
	var row nvtContextRow
	if db == nil || strings.TrimSpace(oid) == "" {
		return row
	}
	db.Raw(`SELECT
		COALESCE(NULLIF(BTRIM(n.impact), ''), '')   AS impact,
		COALESCE(NULLIF(BTRIM(n.insight), ''), '')  AS insight,
		COALESCE(NULLIF(BTRIM(n.affected), ''), '') AS affected,
		COALESCE(NULLIF(BTRIM(n.summary), ''), '')  AS summary
		FROM public.nvts n WHERE n.oid = ? LIMIT 1`, strings.TrimSpace(oid)).Scan(&row)
	return row
}

func loadURLRefs(db *gorm.DB, oid string) []string {
	var urls []string
	if db == nil || strings.TrimSpace(oid) == "" {
		return urls
	}
	db.Raw(`SELECT DISTINCT BTRIM(ref_id)
		FROM public.vt_refs
		WHERE vt_oid = ?
		  AND LOWER(BTRIM(type)) IN ('url', 'ref')
		  AND BTRIM(ref_id) ILIKE 'http%'
		LIMIT 8`, strings.TrimSpace(oid)).Scan(&urls)
	return urls
}

// BuildRemediationPlan produces the full, enriched remediation view for a
// finding: the concrete fix (command or guidance) plus impact, affected/fixed
// version and clickable references pulled from the Greenbone NVT + reference
// tables. All data is real (from the scan feed) — nothing is fabricated.
func BuildRemediationPlan(db *gorm.DB, r entity.AppRemediation) RemediationPlan {
	fs := GenerateFixScript(r)

	plan := RemediationPlan{
		Method:   fs.Method,
		Language: fs.Language,
		Steps:    fs.Steps,
		Source:   fs.Source,
	}

	// A playbook rule yields a real runnable command; the scanner-solution
	// fallback is advice, not a script — present it honestly as guidance.
	if strings.HasPrefix(fs.Source, "playbook") {
		plan.Kind = "command"
		plan.Command = fs.Script
	} else {
		plan.Kind = "guidance"
		plan.Guidance = fs.Script
	}

	// Context from the NVT: prefer impact, fall back to insight/summary.
	ctx := loadNVTContext(db, r.NVTOid)
	plan.Impact = ctx.Impact
	if plan.Impact == "" {
		plan.Impact = ctx.Insight
	}
	if plan.Impact == "" {
		plan.Impact = ctx.Summary
	}
	plan.Affected = ctx.Affected

	// Fixed version parsed from the scanner solution text.
	if m := fixedVersionRe.FindStringSubmatch(r.SolutionText); len(m) == 2 {
		plan.FixedVersion = m[1]
	}

	// References: CVE detail pages (NVD) + vendor advisory URLs.
	refs := make([]PlanRef, 0, 8)
	for _, cve := range splitCVEs(r.CVEList) {
		refs = append(refs, PlanRef{Label: cve, URL: "https://nvd.nist.gov/vuln/detail/" + cve})
		if len(refs) >= 6 {
			break
		}
	}
	for _, u := range loadURLRefs(db, r.NVTOid) {
		label := u
		if len(label) > 48 {
			label = label[:45] + "…"
		}
		refs = append(refs, PlanRef{Label: label, URL: u})
		if len(refs) >= 10 {
			break
		}
	}
	plan.References = refs

	// Compensating controls: always useful, and the standout value when there's
	// no clean patch (kind == "guidance").
	plan.Compensating = compensatingControls(r)

	return plan
}
