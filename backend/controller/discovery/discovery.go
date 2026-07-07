package discovery

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var scanMu sync.Mutex
var isScanning bool
var lastScanStartedAt time.Time
var lastScanFinishedAt time.Time
var lastScanError string

// lastScanHostsFound is the running count of live hosts saved so far by the
// in-progress (or most recent) scan. Exposed via the status endpoint so the
// UI can show a live "N hosts found" counter while a scan streams in.
var lastScanHostsFound int

const scriptPath = "/app/scripts/discovery-scan.sh"

// ValidateSubnet checks that s is a subnet in CIDR notation like
// "192.168.1.0/24". Returns a human-readable error suitable for surfacing
// straight to the API caller. Shared by the trigger handler and the settings
// PUT handler so the value is rejected both when saved and before a scan runs.
func ValidateSubnet(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return fmt.Errorf("subnet is empty")
	}
	if !strings.Contains(s, "/") {
		return fmt.Errorf("subnet must be in CIDR notation, e.g. 192.168.1.0/24")
	}
	if _, _, err := net.ParseCIDR(s); err != nil {
		return fmt.Errorf("invalid subnet %q — must be CIDR notation, e.g. 192.168.1.0/24", s)
	}
	return nil
}

// ===========================
// Nmap XML output structs (only the fields this feature needs)
// ===========================

type nmapHost struct {
	Status    nmapStatus    `xml:"status"`
	Addresses []nmapAddress `xml:"address"`
	Hostnames struct {
		Hostname []nmapHostname `xml:"hostname"`
	} `xml:"hostnames"`
	Ports struct {
		Port []nmapPort `xml:"port"`
	} `xml:"ports"`
}

type nmapStatus struct {
	State string `xml:"state,attr"`
}

type nmapAddress struct {
	Addr     string `xml:"addr,attr"`
	AddrType string `xml:"addrtype,attr"`
}

type nmapHostname struct {
	Name string `xml:"name,attr"`
}

type nmapPort struct {
	PortID string `xml:"portid,attr"`
	State  struct {
		State string `xml:"state,attr"`
	} `xml:"state"`
}

// ===========================
// HTTP handlers
// ===========================

// discoverySubnetKey is the SystemConfig key an admin sets from the web UI
// (Discovery page, gated on line_settings.manage — same precedent as
// ScanManagement's global timezone picker, which also writes the shared
// /settings endpoint under that category instead of its own page's category)
// rather than an env var, so changing it doesn't need a container restart.
const discoverySubnetKey = "discovery_subnet"

func getDiscoverySubnet(db *gorm.DB) string {
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", discoverySubnetKey).First(&cfg).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(cfg.Value)
}

func TriggerDiscoveryScanHandler(c *gin.Context) {
	subnet := getDiscoverySubnet(config.DB())
	if subnet == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discovery subnet is not configured — set it on the Asset Discovery page first"})
		return
	}
	if err := ValidateSubnet(subnet); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scanMu.Lock()
	if isScanning {
		scanMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "a discovery scan is already running"})
		return
	}
	isScanning = true
	lastScanStartedAt = time.Now()
	lastScanError = ""
	lastScanHostsFound = 0
	scanMu.Unlock()

	go runDiscoveryScan(subnet)

	audit.Log(c, "discovery_scan.triggered", "discovery_scan", "", "started a network asset discovery scan")

	c.JSON(http.StatusOK, gin.H{
		"message":    "discovery scan started",
		"started_at": lastScanStartedAt,
	})
}

func GetDiscoveryScanStatusHandler(c *gin.Context) {
	scanMu.Lock()
	running := isScanning
	startedAt := lastScanStartedAt
	finishedAt := lastScanFinishedAt
	lastErr := lastScanError
	hostsFound := lastScanHostsFound
	scanMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"is_running":  running,
		"started_at":  startedAt,
		"finished_at": finishedAt,
		"last_error":  lastErr,
		"hosts_found": hostsFound,
	})
}

// ListDiscoveredHosts returns a paginated, optionally filtered/searched page
// of discovered hosts (unknown hosts first, newest FirstSeenAt first within
// each group, so a new/unrecognized device is the first thing an admin
// notices). Query params:
//   - page       (default 1)
//   - page_size  (default 20, capped at 200)
//   - search     substring match against IP address, hostname, or open ports
//   - status     "known" | "unrecognized" | "acknowledged" (default: all)
//
// The two summary counts (total_hosts, unrecognized_count) are always
// computed across the *entire* table regardless of the current search/status
// filter, since the page's summary cards ("Total Hosts Seen" / "Unrecognized")
// are meant to reflect the whole inventory, not just the filtered result set.
func ListDiscoveredHosts(c *gin.Context) {
	db := config.DB()

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	search := strings.TrimSpace(c.Query("search"))
	statusFilter := strings.TrimSpace(c.Query("status"))

	query := db.Model(&entity.AppDiscoveredHost{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("ip_address ILIKE ? OR hostname ILIKE ? OR open_ports ILIKE ?", like, like, like)
	}
	switch statusFilter {
	case "known":
		query = query.Where("is_known_target = ?", true)
	case "unrecognized":
		query = query.Where("is_known_target = ? AND acknowledged = ?", false, false)
	case "acknowledged":
		query = query.Where("is_known_target = ? AND acknowledged = ?", false, true)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	var hosts []entity.AppDiscoveredHost
	if err := query.
		Order("is_known_target ASC, first_seen_at DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&hosts).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	var totalHosts int64
	if err := db.Model(&entity.AppDiscoveredHost{}).Count(&totalHosts).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	var unrecognizedCount int64
	if err := db.Model(&entity.AppDiscoveredHost{}).
		Where("is_known_target = ? AND acknowledged = ?", false, false).
		Count(&unrecognizedCount).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 1 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"data":               hosts,
		"page":               page,
		"page_size":          pageSize,
		"total":              total,
		"total_pages":        totalPages,
		"total_hosts":        totalHosts,
		"unrecognized_count": unrecognizedCount,
	})
}

// AcknowledgeDiscoveredHost lets an admin mark an unexpected host as
// reviewed (e.g. "yes, that's a new laptop we approved") without having to
// formally add it as an OpenVAS scan target.
func AcknowledgeDiscoveredHost(c *gin.Context) {
	db := config.DB()
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var host entity.AppDiscoveredHost
	if err := db.First(&host, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if err := db.Model(&host).Update("acknowledged", true).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "discovery_scan.acknowledged", "discovered_host", strconv.FormatUint(uint64(id), 10), fmt.Sprintf("acknowledged host %s", host.IPAddress))
	c.JSON(http.StatusOK, gin.H{"data": host})
}

// ===========================
// Background scan execution
// ===========================

func runDiscoveryScan(subnet string) {
	defer func() {
		scanMu.Lock()
		isScanning = false
		lastScanFinishedAt = time.Now()
		scanMu.Unlock()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", scriptPath)
	cmd.Env = append(os.Environ(), "DISCOVERY_SUBNET="+subnet)

	// Stream nmap's stdout instead of buffering it all: this lets us parse and
	// upsert each host into the DB as nmap emits it, so the UI (which polls the
	// hosts list) sees devices appear progressively during the scan rather than
	// only after the whole subnet finishes.
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		scanMu.Lock()
		lastScanError = err.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: stdout pipe:", err)
		return
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		scanMu.Lock()
		lastScanError = err.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: start:", err)
		return
	}

	upCount, procErr := streamScanOutput(stdoutPipe)

	waitErr := cmd.Wait()

	if stderr.Len() > 0 {
		for _, line := range strings.Split(strings.TrimRight(stderr.String(), "\n"), "\n") {
			if line != "" {
				log.Println("[discovery-scan]", line)
			}
		}
	}

	if waitErr != nil {
		scanMu.Lock()
		lastScanError = waitErr.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: script failed:", waitErr)
		return
	}

	if procErr != nil {
		scanMu.Lock()
		lastScanError = procErr.Error()
		scanMu.Unlock()
		log.Println("❌ discovery scan: failed to process results:", procErr)
		return
	}

	// The scan ran and parsed cleanly but found zero live hosts — not
	// necessarily a bug (a genuinely quiet subnet is possible), but the most
	// common real cause is a networking/permission problem in the throwaway
	// nmap container, which nmap usually reports on stderr. Surface it as the
	// status's "last_error" so it's visible on the page instead of just
	// looking identical to a real empty result.
	if upCount == 0 && stderr.Len() > 0 {
		scanMu.Lock()
		lastScanError = "scan completed but found 0 hosts up — nmap said: " + strings.TrimSpace(stderr.String())
		scanMu.Unlock()
	}
}

// streamScanOutput decodes nmap's XML from r incrementally, saving each <host>
// element the moment it's fully read. Returns the number of "up" hosts saved,
// so the caller can tell "ran fine, genuinely found nothing" apart from a
// silent failure. Updates lastScanHostsFound live as it goes.
func streamScanOutput(r io.Reader) (int, error) {
	db := config.DB()

	knownIPs, err := knownTargetIPs(db)
	if err != nil {
		// Not fatal — proceed treating every host as "unknown" rather than
		// aborting the whole scan just because the known-target lookup
		// (which reads gvmd's shared tables) failed.
		log.Println("⚠️ discovery scan: could not load known target IPs:", err)
		knownIPs = map[string]bool{}
	}

	dec := xml.NewDecoder(r)
	upCount := 0

	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			// If some hosts were already parsed and saved, treat a trailing
			// parse hiccup as non-fatal — we keep what we got. Only surface an
			// error if nothing came through at all.
			if upCount > 0 {
				return upCount, nil
			}
			return 0, fmt.Errorf("failed to parse nmap XML stream: %w", err)
		}

		se, ok := tok.(xml.StartElement)
		if !ok || se.Name.Local != "host" {
			continue
		}

		var h nmapHost
		if err := dec.DecodeElement(&h, &se); err != nil {
			// Skip a single malformed host rather than aborting the whole scan.
			continue
		}

		if saveDiscoveredHost(db, knownIPs, h, time.Now()) {
			upCount++
			scanMu.Lock()
			lastScanHostsFound = upCount
			scanMu.Unlock()
		}
	}

	return upCount, nil
}

// saveDiscoveredHost upserts one nmap host row and reports whether it counted
// as a live ("up") host with a resolvable IPv4 address.
func saveDiscoveredHost(db *gorm.DB, knownIPs map[string]bool, h nmapHost, now time.Time) bool {
	if h.Status.State != "up" {
		return false
	}

	var ip string
	for _, addr := range h.Addresses {
		if addr.AddrType == "ipv4" {
			ip = addr.Addr
			break
		}
	}
	if ip == "" {
		return false
	}

	hostname := ""
	if len(h.Hostnames.Hostname) > 0 {
		hostname = h.Hostnames.Hostname[0].Name
	}

	var openPorts []string
	for _, p := range h.Ports.Port {
		if p.State.State == "open" {
			openPorts = append(openPorts, p.PortID)
		}
	}

	isKnown := knownIPs[ip]

	var existing entity.AppDiscoveredHost
	findErr := db.Where("ip_address = ?", ip).First(&existing).Error

	if findErr == gorm.ErrRecordNotFound {
		newHost := entity.AppDiscoveredHost{
			IPAddress:     ip,
			Hostname:      hostname,
			OpenPorts:     strings.Join(openPorts, ","),
			IsKnownTarget: isKnown,
			FirstSeenAt:   now,
			LastSeenAt:    now,
		}
		if err := db.Create(&newHost).Error; err != nil {
			log.Println("❌ discovery scan: failed to save new host", ip, ":", err)
			return false
		}
		return true
	}

	if findErr != nil {
		log.Println("❌ discovery scan: failed to look up host", ip, ":", findErr)
		return false
	}

	db.Model(&existing).Updates(map[string]interface{}{
		"hostname":        hostname,
		"open_ports":      strings.Join(openPorts, ","),
		"is_known_target": isKnown,
		"last_seen_at":    now,
	})
	return true
}

// knownTargetIPs reads the distinct set of host IPs the GVM scan engine has
// ever reported results for (shared Postgres tables, same database this
// backend already connects to) — used as the "is this a device we already
// know about" baseline, independent of whether anyone has ever set its
// Asset Criticality.
func knownTargetIPs(db *gorm.DB) (map[string]bool, error) {
	var ips []string
	err := db.Raw(`SELECT DISTINCT host FROM public.results WHERE host IS NOT NULL AND BTRIM(host) <> ''`).Scan(&ips).Error
	if err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(ips))
	for _, ip := range ips {
		set[strings.TrimSpace(ip)] = true
	}
	return set, nil
}
