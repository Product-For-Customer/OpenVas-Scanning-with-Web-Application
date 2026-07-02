package gmp

import (
	"encoding/xml"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"time"
)

// ===========================
// GMP XML Types
// ===========================

type gmpResponse struct {
	Status     string `xml:"status,attr"`
	StatusText string `xml:"status_text,attr"`
}

type gmpAuthResponse struct {
	XMLName xml.Name `xml:"authenticate_response"`
	gmpResponse
}

// Tasks
type gmpGetTasksResponse struct {
	XMLName xml.Name  `xml:"get_tasks_response"`
	gmpResponse
	Tasks []GMPTask `xml:"task"`
}

type GMPTask struct {
	ID        string         `xml:"id,attr"`
	Name      string         `xml:"name"`
	Comment   string         `xml:"comment"`
	Status    string         `xml:"status"`
	Progress  int            `xml:"progress"`
	Alterable string         `xml:"alterable"` // "0" or "1"
	Target    GMPRef         `xml:"target"`
	Config    GMPRef         `xml:"config"`
	Scanner   GMPRef         `xml:"scanner"`
	LastReport  GMPLastReport `xml:"last_report"`
	ReportCount struct {
		Total int `xml:",chardata"`
	} `xml:"report_count"`
}

type GMPRef struct {
	ID   string `xml:"id,attr"`
	Name string `xml:"name"`
}

type GMPLastReport struct {
	Report struct {
		ID        string `xml:"id,attr"`
		Timestamp string `xml:"timestamp"`
		Severity  struct {
			Full float64 `xml:",chardata"`
		} `xml:"severity"`
	} `xml:"report"`
}

// Targets
type gmpGetTargetsResponse struct {
	XMLName xml.Name    `xml:"get_targets_response"`
	gmpResponse
	Targets []GMPTarget `xml:"target"`
}

type GMPTarget struct {
	ID                   string `xml:"id,attr"`
	Name                 string `xml:"name"`
	Comment              string `xml:"comment"`
	Hosts                string `xml:"hosts"`
	ExcludeHosts         string `xml:"exclude_hosts"`
	MaxHosts             int    `xml:"max_hosts"`
	AliveTests           string `xml:"alive_tests"`
	AllowSimultaneousIPs string `xml:"allow_simultaneous_ips"`
	ReverseLookupOnly    string `xml:"reverse_lookup_only"`
	ReverseLookupUnify   string `xml:"reverse_lookup_unify"`
	PortList struct {
		ID   string `xml:"id,attr"`
		Name string `xml:"name"`
	} `xml:"port_list"`
	SSHCredential struct {
		ID   string `xml:"id,attr"`
		Name string `xml:"name"`
		Port string `xml:"port"`
	} `xml:"ssh_credential"`
	SMBCredential struct {
		ID   string `xml:"id,attr"`
		Name string `xml:"name"`
	} `xml:"smb_credential"`
	ESXiCredential struct {
		ID   string `xml:"id,attr"`
		Name string `xml:"name"`
	} `xml:"esxi_credential"`
	SNMPCredential struct {
		ID   string `xml:"id,attr"`
		Name string `xml:"name"`
	} `xml:"snmp_credential"`
}

// Scanners
type gmpGetScannersResponse struct {
	XMLName  xml.Name     `xml:"get_scanners_response"`
	gmpResponse
	Scanners []GMPScanner `xml:"scanner"`
}

type GMPScanner struct {
	ID   string `xml:"id,attr"`
	Name string `xml:"name"`
	Type int    `xml:"type"`
}

// Configs (scan policies)
type gmpGetConfigsResponse struct {
	XMLName xml.Name    `xml:"get_configs_response"`
	gmpResponse
	Configs []GMPConfig `xml:"config"`
}

type GMPConfig struct {
	ID   string `xml:"id,attr"`
	Name string `xml:"name"`
}

// Feeds
type gmpGetFeedsResponse struct {
	XMLName xml.Name       `xml:"get_feeds_response"`
	gmpResponse
	Feeds []GMPFeedEntry `xml:"feed"`
}

type GMPFeedEntry struct {
	Type             string `xml:"type"`
	Name             string `xml:"name"`
	Version          string `xml:"version"`
	Description      string `xml:"description"`
	CurrentlySyncing *struct {
		Timestamp string `xml:"timestamp"`
	} `xml:"currently_syncing"`
}

// ── Port Lists ────────────────────────────────────────────────
type gmpGetPortListsResponse struct {
	XMLName   xml.Name       `xml:"get_port_lists_response"`
	gmpResponse
	PortLists []GMPPortList `xml:"port_list"`
}

type GMPPortList struct {
	ID        string `xml:"id,attr"`
	Name      string `xml:"name"`
	Comment   string `xml:"comment"`
	PortCount struct {
		All int `xml:"all"`
		TCP int `xml:"tcp"`
		UDP int `xml:"udp"`
	} `xml:"port_count"`
}

type gmpCreatePortListResponse struct {
	XMLName xml.Name `xml:"create_port_list_response"`
	gmpResponse
	ID string `xml:"id,attr"`
}

type gmpDeletePortListResponse struct {
	XMLName xml.Name `xml:"delete_port_list_response"`
	gmpResponse
}

type gmpImportPortListResponse struct {
	XMLName xml.Name `xml:"import_port_list_response"`
	gmpResponse
	ID string `xml:"id,attr"`
}

type gmpModifyPortListResponse struct {
	XMLName xml.Name `xml:"modify_port_list_response"`
	gmpResponse
}

type gmpModifyCredentialResponse struct {
	XMLName xml.Name `xml:"modify_credential_response"`
	gmpResponse
}

type gmpModifyTargetResponse struct {
	XMLName xml.Name `xml:"modify_target_response"`
	gmpResponse
}

type gmpModifyTaskResponse struct {
	XMLName xml.Name `xml:"modify_task_response"`
	gmpResponse
}

// ── Credentials ───────────────────────────────────────────────
type gmpGetCredentialsResponse struct {
	XMLName     xml.Name         `xml:"get_credentials_response"`
	gmpResponse
	Credentials []GMPCredential `xml:"credential"`
}

type GMPCredential struct {
	ID      string `xml:"id,attr"`
	Name    string `xml:"name"`
	Type    string `xml:"type"`
	Login   string `xml:"login"`
	Comment string `xml:"comment"`
}

type gmpCreateCredentialResponse struct {
	XMLName xml.Name `xml:"create_credential_response"`
	gmpResponse
	ID string `xml:"id,attr"`
}

type gmpDeleteCredentialResponse struct {
	XMLName xml.Name `xml:"delete_credential_response"`
	gmpResponse
}

// ── Create responses ──────────────────────────────────────────
type gmpCreateResponse struct {
	gmpResponse
	ID string `xml:"id,attr"`
}

type gmpCreateTargetResponse struct {
	XMLName xml.Name `xml:"create_target_response"`
	gmpCreateResponse
}

type gmpCreateTaskResponse struct {
	XMLName xml.Name `xml:"create_task_response"`
	gmpCreateResponse
}

type gmpStartTaskResponse struct {
	XMLName   xml.Name `xml:"start_task_response"`
	gmpResponse
	ReportID  string `xml:"report_id"`
}

type gmpStopTaskResponse struct {
	XMLName xml.Name `xml:"stop_task_response"`
	gmpResponse
}

type gmpDeleteTaskResponse struct {
	XMLName xml.Name `xml:"delete_task_response"`
	gmpResponse
}

type gmpDeleteTargetResponse struct {
	XMLName xml.Name `xml:"delete_target_response"`
	gmpResponse
}

// ===========================
// GMP Client
// ===========================

type GMPClient struct {
	mu   sync.Mutex
	conn net.Conn
}

var defaultClient *GMPClient
var clientOnce sync.Once

func GetClient() *GMPClient {
	clientOnce.Do(func() {
		defaultClient = &GMPClient{}
	})
	return defaultClient
}

func (c *GMPClient) connect() error {
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}

	socketPath := strings.TrimSpace(os.Getenv("GVM_SOCKET_PATH"))
	if socketPath == "" {
		socketPath = "/run/gvmd/gvmd.sock"
	}

	var conn net.Conn
	var err error

	conn, err = net.DialTimeout("unix", socketPath, 10*time.Second)
	if err != nil {
		// Fallback to TCP
		host := getEnv("GVM_HOST", "gvmd")
		port := getEnv("GVM_PORT", "9390")
		conn, err = net.DialTimeout("tcp", host+":"+port, 10*time.Second)
		if err != nil {
			return fmt.Errorf("cannot connect to gvmd (tried unix socket %s and tcp %s:%s): %w",
				socketPath, host, port, err)
		}
	}

	c.conn = conn
	return nil
}

func (c *GMPClient) sendAndReceive(xmlData string) ([]byte, error) {
	c.conn.SetDeadline(time.Now().Add(30 * time.Second))
	defer c.conn.SetDeadline(time.Time{})

	if _, err := io.WriteString(c.conn, xmlData); err != nil {
		return nil, fmt.Errorf("gmp write error: %w", err)
	}

	buf := make([]byte, 0, 65536)
	tmp := make([]byte, 4096)

	for {
		n, err := c.conn.Read(tmp)
		if n > 0 {
			buf = append(buf, tmp[:n]...)
			// Check if we have a complete XML response
			if isCompleteXML(buf) {
				break
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return buf, fmt.Errorf("gmp read error: %w", err)
		}
	}

	return buf, nil
}

func isCompleteXML(data []byte) bool {
	s := strings.TrimSpace(string(data))
	if len(s) == 0 {
		return false
	}
	// Simple check: count opening vs closing tags at root level
	// More robust: try xml.Decoder
	decoder := xml.NewDecoder(strings.NewReader(s))
	depth := 0
	hasRoot := false
	for {
		tok, err := decoder.Token()
		if err != nil {
			return false
		}
		switch tok.(type) {
		case xml.StartElement:
			depth++
			hasRoot = true
		case xml.EndElement:
			depth--
			if hasRoot && depth == 0 {
				return true
			}
		}
	}
}

func (c *GMPClient) authenticate() error {
	username := getEnv("GVM_USERNAME", "admin")
	password := getEnv("GVM_PASSWORD", "admin")

	authXML := fmt.Sprintf(
		`<authenticate><credentials><username>%s</username><password>%s</password></credentials></authenticate>`,
		xmlEscape(username), xmlEscape(password),
	)

	data, err := c.sendAndReceive(authXML)
	if err != nil {
		return fmt.Errorf("gmp auth send error: %w", err)
	}

	var authResp gmpAuthResponse
	if err := xml.Unmarshal(data, &authResp); err != nil {
		return fmt.Errorf("gmp auth parse error: %w (raw: %s)", err, string(data[:min(len(data), 200)]))
	}

	if authResp.Status != "200" {
		return fmt.Errorf("gmp auth failed: status=%s text=%s", authResp.Status, authResp.StatusText)
	}

	return nil
}

// Execute รัน GMP command หนึ่งครั้ง (connect → auth → command → disconnect)
func (c *GMPClient) Execute(xmlCmd string) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return nil, err
	}
	defer func() {
		if c.conn != nil {
			c.conn.Close()
			c.conn = nil
		}
	}()

	if err := c.authenticate(); err != nil {
		return nil, err
	}

	data, err := c.sendAndReceive(xmlCmd)
	if err != nil {
		return nil, err
	}

	return data, nil
}

// ===========================
// GMP Operations
// ===========================

func GetTasks() ([]GMPTask, error) {
	data, err := GetClient().Execute(`<get_tasks filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}

	var resp gmpGetTasksResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_tasks parse error: %w", err)
	}

	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_tasks failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.Tasks, nil
}

func GetTargets() ([]GMPTarget, error) {
	data, err := GetClient().Execute(`<get_targets filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}

	var resp gmpGetTargetsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_targets parse error: %w", err)
	}

	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_targets failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.Targets, nil
}

func GetScanners() ([]GMPScanner, error) {
	data, err := GetClient().Execute(`<get_scanners/>`)
	if err != nil {
		return nil, err
	}

	var resp gmpGetScannersResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_scanners parse error: %w", err)
	}

	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_scanners failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.Scanners, nil
}

func GetScanConfigs() ([]GMPConfig, error) {
	data, err := GetClient().Execute(`<get_configs filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}

	var resp gmpGetConfigsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_configs parse error: %w", err)
	}

	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_configs failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.Configs, nil
}

// CreateTargetParams holds all parameters for creating an OpenVAS target
type CreateTargetParams struct {
	Name         string
	Comment      string
	Hosts        string
	ExcludeHosts string
	PortListID   string
	AliveTest    string // "" | "Consider Alive" | "ICMP Ping" | ...
	MultipleIPs  bool
	SSHCredID    string
	SSHPort      string // default "22"
	SMBCredID    string
	ESXiCredID   string
	SNMPCredID   string
	ReverseLookup bool
	ReverseUnify  bool
}

func CreateTargetFull(p CreateTargetParams) (string, error) {
	aliveTest := p.AliveTest
	if aliveTest == "" {
		aliveTest = "Scan Config Default"
	}

	multiIPs := "0"
	if p.MultipleIPs {
		multiIPs = "1"
	}

	excludePart := ""
	if p.ExcludeHosts != "" {
		excludePart = fmt.Sprintf(`<exclude_hosts>%s</exclude_hosts>`, xmlEscape(p.ExcludeHosts))
	}

	portListPart := ""
	if p.PortListID != "" {
		portListPart = fmt.Sprintf(`<port_list id="%s"/>`, xmlEscape(p.PortListID))
	}

	sshPart := ""
	if p.SSHCredID != "" {
		port := p.SSHPort
		if port == "" {
			port = "22"
		}
		sshPart = fmt.Sprintf(`<ssh_credential id="%s"><port>%s</port></ssh_credential>`, xmlEscape(p.SSHCredID), xmlEscape(port))
	}
	smbPart := ""
	if p.SMBCredID != "" {
		smbPart = fmt.Sprintf(`<smb_credential id="%s"/>`, xmlEscape(p.SMBCredID))
	}
	esxiPart := ""
	if p.ESXiCredID != "" {
		esxiPart = fmt.Sprintf(`<esxi_credential id="%s"/>`, xmlEscape(p.ESXiCredID))
	}
	snmpPart := ""
	if p.SNMPCredID != "" {
		snmpPart = fmt.Sprintf(`<snmp_credential id="%s"/>`, xmlEscape(p.SNMPCredID))
	}

	rlOnly := "0"
	if p.ReverseLookup {
		rlOnly = "1"
	}
	rlUnify := "0"
	if p.ReverseUnify {
		rlUnify = "1"
	}

	cmd := fmt.Sprintf(
		`<create_target><name>%s</name><comment>%s</comment><hosts>%s</hosts>%s<alive_tests>%s</alive_tests><allow_simultaneous_ips>%s</allow_simultaneous_ips>%s%s%s%s%s<reverse_lookup_only>%s</reverse_lookup_only><reverse_lookup_unify>%s</reverse_lookup_unify></create_target>`,
		xmlEscape(p.Name), xmlEscape(p.Comment), xmlEscape(p.Hosts),
		excludePart, xmlEscape(aliveTest), multiIPs,
		portListPart, sshPart, smbPart, esxiPart, snmpPart,
		rlOnly, rlUnify,
	)

	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}

	var resp gmpCreateTargetResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp create_target parse error: %w", err)
	}

	if resp.Status != "201" {
		return "", fmt.Errorf("gmp create_target failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.ID, nil
}

type CreateTaskFullParams struct {
	Name           string
	Comment        string
	TargetID       string
	ConfigID       string
	ScannerID      string
	ApplyOverrides bool
	MinQoD         int
	Alterable      bool
	AddAssets      bool
	AutoDelete     string // "no" | "keep"
	AutoDeleteData int
	MaxChecks      int
	MaxHosts       int
}

func CreateTask(p CreateTaskFullParams) (string, error) {
	scannerPart := ""
	if p.ScannerID != "" {
		scannerPart = fmt.Sprintf(`<scanner id="%s"/>`, xmlEscape(p.ScannerID))
	}

	applyOverridesVal := "0"
	if p.ApplyOverrides {
		applyOverridesVal = "1"
	}

	alterableVal := "0"
	if p.Alterable {
		alterableVal = "1"
	}

	addAssetsVal := "no"
	if p.AddAssets {
		addAssetsVal = "yes"
	}

	autoDeletePart := `<auto_delete>no</auto_delete>`
	if p.AutoDelete == "keep" {
		n := p.AutoDeleteData
		if n < 1 {
			n = 5
		}
		autoDeletePart = fmt.Sprintf(`<auto_delete>keep</auto_delete><auto_delete_data>%d</auto_delete_data>`, n)
	}

	maxChecks := p.MaxChecks
	if maxChecks < 1 {
		maxChecks = 4
	}
	maxHosts := p.MaxHosts
	if maxHosts < 1 {
		maxHosts = 20
	}

	minQoD := p.MinQoD
	if minQoD < 0 || minQoD > 100 {
		minQoD = 70
	}

	var sb strings.Builder
	sb.WriteString(`<create_task>`)
	sb.WriteString(fmt.Sprintf(`<name>%s</name>`, xmlEscape(p.Name)))
	sb.WriteString(fmt.Sprintf(`<comment>%s</comment>`, xmlEscape(p.Comment)))
	sb.WriteString(fmt.Sprintf(`<target id="%s"/>`, xmlEscape(p.TargetID)))
	if p.ConfigID != "" {
		sb.WriteString(fmt.Sprintf(`<config id="%s"/>`, xmlEscape(p.ConfigID)))
	}
	sb.WriteString(scannerPart)
	sb.WriteString(fmt.Sprintf(`<apply_overrides>%s</apply_overrides>`, applyOverridesVal))
	sb.WriteString(fmt.Sprintf(`<min_qod>%d</min_qod>`, minQoD))
	sb.WriteString(fmt.Sprintf(`<alterable>%s</alterable>`, alterableVal))
	sb.WriteString(fmt.Sprintf(`<add_assets>%s</add_assets>`, addAssetsVal))
	sb.WriteString(autoDeletePart)
	sb.WriteString(fmt.Sprintf(
		`<preferences><preference><scanner_name>max_checks</scanner_name><value>%d</value></preference></preferences>`,
		maxChecks,
	))
	sb.WriteString(fmt.Sprintf(
		`<preferences><preference><scanner_name>max_hosts</scanner_name><value>%d</value></preference></preferences>`,
		maxHosts,
	))
	sb.WriteString(`</create_task>`)

	data, err := GetClient().Execute(sb.String())
	if err != nil {
		return "", err
	}

	var resp gmpCreateTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp create_task parse error: %w", err)
	}

	if resp.Status != "201" {
		return "", fmt.Errorf("gmp create_task failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.ID, nil
}

func StartTask(taskID string) (string, error) {
	cmd := fmt.Sprintf(`<start_task task_id="%s"/>`, xmlEscape(taskID))

	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}

	var resp gmpStartTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp start_task parse error: %w", err)
	}

	if resp.Status != "202" {
		return "", fmt.Errorf("gmp start_task failed: %s - %s", resp.Status, resp.StatusText)
	}

	return resp.ReportID, nil
}

func StopTask(taskID string) error {
	cmd := fmt.Sprintf(`<stop_task task_id="%s"/>`, xmlEscape(taskID))

	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}

	var resp gmpStopTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp stop_task parse error: %w", err)
	}

	if resp.Status != "200" {
		return fmt.Errorf("gmp stop_task failed: %s - %s", resp.Status, resp.StatusText)
	}

	return nil
}

func DeleteTask(taskID string) error {
	cmd := fmt.Sprintf(`<delete_task task_id="%s" ultimate="0"/>`, xmlEscape(taskID))

	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}

	var resp gmpDeleteTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_task parse error: %w", err)
	}

	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_task failed: %s - %s", resp.Status, resp.StatusText)
	}

	return nil
}

// ── Port List operations ──────────────────────────────────────

func GetPortLists() ([]GMPPortList, error) {
	data, err := GetClient().Execute(`<get_port_lists filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetPortListsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_port_lists parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_port_lists failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.PortLists, nil
}

func CreatePortList(name, comment, portRange string) (string, error) {
	cmd := fmt.Sprintf(
		`<create_port_list><name>%s</name><comment>%s</comment><port_range>%s</port_range></create_port_list>`,
		xmlEscape(name), xmlEscape(comment), xmlEscape(portRange),
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}
	var resp gmpCreatePortListResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp create_port_list parse error: %w", err)
	}
	if resp.Status != "201" {
		return "", fmt.Errorf("gmp create_port_list failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.ID, nil
}

func DeletePortList(id string) error {
	cmd := fmt.Sprintf(`<delete_port_list port_list_id="%s" ultimate="0"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeletePortListResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_port_list parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_port_list failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func ImportPortList(xmlContent string) (string, error) {
	cmd := fmt.Sprintf(`<import_port_list>%s</import_port_list>`, xmlContent)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}
	var resp gmpImportPortListResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp import_port_list parse error: %w", err)
	}
	if resp.Status != "201" {
		return "", fmt.Errorf("gmp import_port_list failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.ID, nil
}

func ModifyPortList(id, name, comment string) error {
	cmd := fmt.Sprintf(
		`<modify_port_list port_list_id="%s"><name>%s</name><comment>%s</comment></modify_port_list>`,
		xmlEscape(id), xmlEscape(name), xmlEscape(comment),
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpModifyPortListResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp modify_port_list parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp modify_port_list failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func ModifyTarget(id string, p CreateTargetParams) error {
	aliveTest := p.AliveTest
	if aliveTest == "" {
		aliveTest = "Scan Config Default"
	}
	multiIPs := "0"
	if p.MultipleIPs {
		multiIPs = "1"
	}
	excludePart := ""
	if p.ExcludeHosts != "" {
		excludePart = fmt.Sprintf(`<exclude_hosts>%s</exclude_hosts>`, xmlEscape(p.ExcludeHosts))
	}
	portListPart := ""
	if p.PortListID != "" {
		portListPart = fmt.Sprintf(`<port_list id="%s"/>`, xmlEscape(p.PortListID))
	}
	sshPart := ""
	if p.SSHCredID != "" {
		port := p.SSHPort
		if port == "" {
			port = "22"
		}
		sshPart = fmt.Sprintf(`<ssh_credential id="%s"><port>%s</port></ssh_credential>`, xmlEscape(p.SSHCredID), xmlEscape(port))
	}
	smbPart := ""
	if p.SMBCredID != "" {
		smbPart = fmt.Sprintf(`<smb_credential id="%s"/>`, xmlEscape(p.SMBCredID))
	}
	esxiPart := ""
	if p.ESXiCredID != "" {
		esxiPart = fmt.Sprintf(`<esxi_credential id="%s"/>`, xmlEscape(p.ESXiCredID))
	}
	snmpPart := ""
	if p.SNMPCredID != "" {
		snmpPart = fmt.Sprintf(`<snmp_credential id="%s"/>`, xmlEscape(p.SNMPCredID))
	}
	rlOnly := "0"
	if p.ReverseLookup {
		rlOnly = "1"
	}
	rlUnify := "0"
	if p.ReverseUnify {
		rlUnify = "1"
	}
	cmd := fmt.Sprintf(
		`<modify_target target_id="%s"><name>%s</name><comment>%s</comment><hosts>%s</hosts>%s<alive_tests>%s</alive_tests><allow_simultaneous_ips>%s</allow_simultaneous_ips>%s%s%s%s%s<reverse_lookup_only>%s</reverse_lookup_only><reverse_lookup_unify>%s</reverse_lookup_unify></modify_target>`,
		xmlEscape(id), xmlEscape(p.Name), xmlEscape(p.Comment), xmlEscape(p.Hosts),
		excludePart, xmlEscape(aliveTest), multiIPs,
		portListPart, sshPart, smbPart, esxiPart, snmpPart,
		rlOnly, rlUnify,
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpModifyTargetResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp modify_target parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp modify_target failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// ── Credential operations ─────────────────────────────────────

func GetCredentials() ([]GMPCredential, error) {
	data, err := GetClient().Execute(`<get_credentials filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetCredentialsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_credentials parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_credentials failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.Credentials, nil
}

type CreateCredentialParams struct {
	Name             string
	Comment          string
	Type             string // up | usk | snmp | smime | pgp | pw | cc
	AutoGenerate     bool
	Login            string
	Password         string
	PrivateKey       string
	Passphrase       string
	Community        string
	AuthAlgorithm    string // md5 | sha1
	PrivacyAlgorithm string // aes | des | none
	PrivacyPassword  string
	Certificate      string
	PublicPGPKey     string
	CCPrivateKey     string
	CCPassphrase     string
}

func CreateCredential(p CreateCredentialParams) (string, error) {
	var body string

	switch p.Type {
	case "up":
		if p.AutoGenerate {
			body = fmt.Sprintf(`<auto_generate>1</auto_generate><login>%s</login>`, xmlEscape(p.Login))
		} else {
			body = fmt.Sprintf(`<login>%s</login><password>%s</password>`, xmlEscape(p.Login), xmlEscape(p.Password))
		}
	case "usk":
		if p.AutoGenerate {
			body = fmt.Sprintf(`<auto_generate>1</auto_generate><login>%s</login>`, xmlEscape(p.Login))
		} else {
			keyPart := fmt.Sprintf(`<key><private>%s</private>`, xmlEscape(p.PrivateKey))
			if p.Passphrase != "" {
				keyPart += fmt.Sprintf(`<passphrase>%s</passphrase>`, xmlEscape(p.Passphrase))
			}
			keyPart += `</key>`
			body = fmt.Sprintf(`<login>%s</login>%s`, xmlEscape(p.Login), keyPart)
		}

	case "snmp":
		authAlgo := p.AuthAlgorithm
		if authAlgo == "" {
			authAlgo = "sha1"
		}
		privAlgo := p.PrivacyAlgorithm
		if privAlgo == "" {
			privAlgo = "aes"
		}
		body = fmt.Sprintf(
			`<community>%s</community><login>%s</login><password>%s</password><privacy_password>%s</privacy_password><auth_algorithm>%s</auth_algorithm><privacy_algorithm>%s</privacy_algorithm>`,
			xmlEscape(p.Community), xmlEscape(p.Login), xmlEscape(p.Password),
			xmlEscape(p.PrivacyPassword), xmlEscape(authAlgo), xmlEscape(privAlgo),
		)

	case "smime":
		body = fmt.Sprintf(`<certificate>%s</certificate>`, xmlEscape(p.Certificate))

	case "pgp":
		body = fmt.Sprintf(`<key><public>%s</public></key>`, xmlEscape(p.PublicPGPKey))

	case "pw":
		body = fmt.Sprintf(`<password>%s</password>`, xmlEscape(p.Password))

	case "cc":
		keyPart := fmt.Sprintf(`<key><private>%s</private>`, xmlEscape(p.CCPrivateKey))
		if p.CCPassphrase != "" {
			keyPart += fmt.Sprintf(`<passphrase>%s</passphrase>`, xmlEscape(p.CCPassphrase))
		}
		keyPart += `</key>`
		body = fmt.Sprintf(`<certificate>%s</certificate>%s`, xmlEscape(p.Certificate), keyPart)

	default:
		return "", fmt.Errorf("unsupported credential type: %s", p.Type)
	}

	cmd := fmt.Sprintf(
		`<create_credential><name>%s</name><comment>%s</comment><type>%s</type>%s</create_credential>`,
		xmlEscape(p.Name), xmlEscape(p.Comment), xmlEscape(p.Type), body,
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}
	var resp gmpCreateCredentialResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp create_credential parse error: %w", err)
	}
	if resp.Status != "201" {
		return "", fmt.Errorf("gmp create_credential failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.ID, nil
}

type ModifyCredentialParams struct {
	Name             string
	Comment          string
	Type             string
	Login            string
	Password         string
	PrivateKey       string
	Passphrase       string
	Community        string
	AuthAlgorithm    string
	PrivacyAlgorithm string
	PrivacyPassword  string
	Certificate      string
	PublicPGPKey     string
	CCPrivateKey     string
	CCPassphrase     string
}

func ModifyCredential(id string, p ModifyCredentialParams) error {
	var extra string
	if p.Login != "" {
		extra += fmt.Sprintf(`<login>%s</login>`, xmlEscape(p.Login))
	}
	switch p.Type {
	case "up":
		if p.Password != "" {
			extra += fmt.Sprintf(`<password>%s</password>`, xmlEscape(p.Password))
		}
	case "pw":
		if p.Password != "" {
			extra += fmt.Sprintf(`<password>%s</password>`, xmlEscape(p.Password))
		}
	case "usk":
		if p.PrivateKey != "" {
			kp := fmt.Sprintf(`<key><private>%s</private>`, xmlEscape(p.PrivateKey))
			if p.Passphrase != "" {
				kp += fmt.Sprintf(`<passphrase>%s</passphrase>`, xmlEscape(p.Passphrase))
			}
			kp += `</key>`
			extra += kp
		}
	case "snmp":
		if p.Community != "" {
			extra += fmt.Sprintf(`<community>%s</community>`, xmlEscape(p.Community))
		}
		if p.Password != "" {
			extra += fmt.Sprintf(`<password>%s</password>`, xmlEscape(p.Password))
		}
		if p.PrivacyPassword != "" {
			extra += fmt.Sprintf(`<privacy_password>%s</privacy_password>`, xmlEscape(p.PrivacyPassword))
		}
		if p.AuthAlgorithm != "" {
			extra += fmt.Sprintf(`<auth_algorithm>%s</auth_algorithm>`, xmlEscape(p.AuthAlgorithm))
		}
		if p.PrivacyAlgorithm != "" {
			extra += fmt.Sprintf(`<privacy_algorithm>%s</privacy_algorithm>`, xmlEscape(p.PrivacyAlgorithm))
		}
	case "smime":
		if p.Certificate != "" {
			extra += fmt.Sprintf(`<certificate>%s</certificate>`, xmlEscape(p.Certificate))
		}
	case "pgp":
		if p.PublicPGPKey != "" {
			extra += fmt.Sprintf(`<key><public>%s</public></key>`, xmlEscape(p.PublicPGPKey))
		}
	case "cc":
		if p.Certificate != "" {
			extra += fmt.Sprintf(`<certificate>%s</certificate>`, xmlEscape(p.Certificate))
		}
		if p.CCPrivateKey != "" {
			kp := fmt.Sprintf(`<key><private>%s</private>`, xmlEscape(p.CCPrivateKey))
			if p.CCPassphrase != "" {
				kp += fmt.Sprintf(`<passphrase>%s</passphrase>`, xmlEscape(p.CCPassphrase))
			}
			kp += `</key>`
			extra += kp
		}
	}
	cmd := fmt.Sprintf(
		`<modify_credential credential_id="%s"><name>%s</name><comment>%s</comment>%s</modify_credential>`,
		xmlEscape(id), xmlEscape(p.Name), xmlEscape(p.Comment), extra,
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpModifyCredentialResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp modify_credential parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp modify_credential failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func DeleteCredential(id string) error {
	cmd := fmt.Sprintf(`<delete_credential credential_id="%s" ultimate="0"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeleteCredentialResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_credential parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_credential failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// ── Trash / Trashcan ─────────────────────────────────────────

type gmpRestoreResponse struct {
	XMLName xml.Name `xml:"restore_response"`
	gmpResponse
}

type gmpEmptyTrashcanResponse struct {
	XMLName xml.Name `xml:"empty_trashcan_response"`
	gmpResponse
}

func GetTrashTasks() ([]GMPTask, error) {
	data, err := GetClient().Execute(`<get_tasks trash="1" filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetTasksResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_tasks trash parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_tasks trash failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.Tasks, nil
}

func GetTrashTargets() ([]GMPTarget, error) {
	data, err := GetClient().Execute(`<get_targets trash="1" filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetTargetsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_targets trash parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_targets trash failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.Targets, nil
}

func GetTrashCredentials() ([]GMPCredential, error) {
	data, err := GetClient().Execute(`<get_credentials trash="1" filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetCredentialsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_credentials trash parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_credentials trash failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.Credentials, nil
}

func GetTrashPortLists() ([]GMPPortList, error) {
	data, err := GetClient().Execute(`<get_port_lists trash="1" filter="rows=-1"/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetPortListsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_port_lists trash parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_port_lists trash failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.PortLists, nil
}

// RestoreFromTrash restores any item from trash by ID (GMP figures out the type).
func RestoreFromTrash(id string) error {
	cmd := fmt.Sprintf(`<restore id="%s"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpRestoreResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp restore parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp restore failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// EmptyTrashcan permanently deletes all items in the GMP trashcan.
func EmptyTrashcan() error {
	data, err := GetClient().Execute(`<empty_trashcan/>`)
	if err != nil {
		return err
	}
	var resp gmpEmptyTrashcanResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp empty_trashcan parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp empty_trashcan failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// Permanent deletes (ultimate=1)
func DeleteTaskPermanent(id string) error {
	cmd := fmt.Sprintf(`<delete_task task_id="%s" ultimate="1"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeleteTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_task (permanent) parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_task (permanent) failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func DeleteTargetPermanent(id string) error {
	cmd := fmt.Sprintf(`<delete_target target_id="%s" ultimate="1"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeleteTargetResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_target (permanent) parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_target (permanent) failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func DeleteCredentialPermanent(id string) error {
	cmd := fmt.Sprintf(`<delete_credential credential_id="%s" ultimate="1"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeleteCredentialResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_credential (permanent) parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_credential (permanent) failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

func DeletePortListPermanent(id string) error {
	cmd := fmt.Sprintf(`<delete_port_list port_list_id="%s" ultimate="1"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeletePortListResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_port_list (permanent) parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_port_list (permanent) failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// GetFeeds ดึงข้อมูล OpenVAS feed status จาก gvmd
func GetFeeds() ([]GMPFeedEntry, error) {
	data, err := GetClient().Execute(`<get_feeds/>`)
	if err != nil {
		return nil, err
	}
	var resp gmpGetFeedsResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_feeds parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_feeds failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.Feeds, nil
}

func DeleteTarget(targetID string) error {
	cmd := fmt.Sprintf(`<delete_target target_id="%s" ultimate="0"/>`, xmlEscape(targetID))

	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}

	var resp gmpDeleteTargetResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_target parse error: %w", err)
	}

	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_target failed: %s - %s", resp.Status, resp.StatusText)
	}

	return nil
}

// ===========================
// Port Range — get detail / create / delete
// ===========================

type GMPPortRange struct {
	ID      string `xml:"id,attr"`
	Start   int    `xml:"start"`
	End     int    `xml:"end"`
	Type    string `xml:"type"`    // "TCP" or "UDP"
	Comment string `xml:"comment"`
}

type GMPPortListDetailItem struct {
	ID      string `xml:"id,attr"`
	Name    string `xml:"name"`
	Comment string `xml:"comment"`
	PortCount struct {
		All int `xml:"all"`
		TCP int `xml:"tcp"`
		UDP int `xml:"udp"`
	} `xml:"port_count"`
	PortRanges []GMPPortRange `xml:"port_ranges>port_range"`
}

type gmpGetPortListDetailResponse struct {
	XMLName   xml.Name                `xml:"get_port_lists_response"`
	gmpResponse
	PortLists []GMPPortListDetailItem `xml:"port_list"`
}

type gmpCreatePortRangeResponse struct {
	XMLName xml.Name `xml:"create_port_range_response"`
	gmpResponse
	ID string `xml:"id,attr"`
}

type gmpDeletePortRangeResponse struct {
	XMLName xml.Name `xml:"delete_port_range_response"`
	gmpResponse
}

func GetPortListDetail(id string) (*GMPPortListDetailItem, error) {
	cmd := fmt.Sprintf(`<get_port_lists port_list_id="%s" details="1"/>`, xmlEscape(id))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return nil, err
	}
	var resp gmpGetPortListDetailResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("gmp get_port_list parse error: %w", err)
	}
	if resp.Status != "200" {
		return nil, fmt.Errorf("gmp get_port_list failed: %s - %s", resp.Status, resp.StatusText)
	}
	if len(resp.PortLists) == 0 {
		return nil, fmt.Errorf("port list not found")
	}
	return &resp.PortLists[0], nil
}

func CreatePortRange(portListID string, start, end int, protocol, comment string) (string, error) {
	cmd := fmt.Sprintf(
		`<create_port_range><port_list id="%s"/><start>%d</start><end>%d</end><type>%s</type><comment>%s</comment></create_port_range>`,
		xmlEscape(portListID), start, end, xmlEscape(strings.ToUpper(protocol)), xmlEscape(comment),
	)
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return "", err
	}
	var resp gmpCreatePortRangeResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("gmp create_port_range parse error: %w", err)
	}
	if resp.Status != "201" {
		return "", fmt.Errorf("gmp create_port_range failed: %s - %s", resp.Status, resp.StatusText)
	}
	return resp.ID, nil
}

func DeletePortRange(rangeID string) error {
	cmd := fmt.Sprintf(`<delete_port_range port_range_id="%s"/>`, xmlEscape(rangeID))
	data, err := GetClient().Execute(cmd)
	if err != nil {
		return err
	}
	var resp gmpDeletePortRangeResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp delete_port_range parse error: %w", err)
	}
	if resp.Status != "200" {
		return fmt.Errorf("gmp delete_port_range failed: %s - %s", resp.Status, resp.StatusText)
	}
	return nil
}

// ===========================
// ModifyTask
// ===========================

type ModifyTaskParams struct {
	Name           string
	Comment        string
	// Editable when task is New or Alterable
	TargetID       string
	ConfigID       string
	ScannerID      string
	Alterable      *bool
	AddAssets      *bool
	// Always editable
	ApplyOverrides *bool
	MinQoD         *int
	MaxChecks      *int
	MaxHosts       *int
	AutoDelete     string // "no" | "keep"
	AutoDeleteData *int
}

func ModifyTask(id string, p ModifyTaskParams) error {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`<modify_task task_id="%s">`, xmlEscape(id)))

	if p.Name != "" {
		sb.WriteString(fmt.Sprintf(`<name>%s</name>`, xmlEscape(p.Name)))
	}
	sb.WriteString(fmt.Sprintf(`<comment>%s</comment>`, xmlEscape(p.Comment)))

	// Fields editable only when task is New or Alterable
	if p.TargetID != "" {
		sb.WriteString(fmt.Sprintf(`<target id="%s"/>`, xmlEscape(p.TargetID)))
	}
	if p.ConfigID != "" {
		sb.WriteString(fmt.Sprintf(`<config id="%s"/>`, xmlEscape(p.ConfigID)))
	}
	if p.ScannerID != "" {
		sb.WriteString(fmt.Sprintf(`<scanner id="%s"/>`, xmlEscape(p.ScannerID)))
	}
	if p.Alterable != nil {
		v := "0"
		if *p.Alterable {
			v = "1"
		}
		sb.WriteString(fmt.Sprintf(`<alterable>%s</alterable>`, v))
	}
	if p.AddAssets != nil {
		v := "no"
		if *p.AddAssets {
			v = "yes"
		}
		sb.WriteString(fmt.Sprintf(`<add_assets>%s</add_assets>`, v))
	}

	if p.ApplyOverrides != nil {
		v := "0"
		if *p.ApplyOverrides {
			v = "1"
		}
		sb.WriteString(fmt.Sprintf(`<apply_overrides>%s</apply_overrides>`, v))
	}

	if p.MinQoD != nil {
		sb.WriteString(fmt.Sprintf(`<min_qod>%d</min_qod>`, *p.MinQoD))
	}

	if p.MaxChecks != nil {
		sb.WriteString(fmt.Sprintf(
			`<preferences><preference><scanner_name>max_checks</scanner_name><value>%d</value></preference></preferences>`,
			*p.MaxChecks,
		))
	}

	if p.MaxHosts != nil {
		sb.WriteString(fmt.Sprintf(
			`<preferences><preference><scanner_name>max_hosts</scanner_name><value>%d</value></preference></preferences>`,
			*p.MaxHosts,
		))
	}

	if p.AutoDelete == "keep" || p.AutoDelete == "no" {
		sb.WriteString(fmt.Sprintf(`<auto_delete>%s</auto_delete>`, p.AutoDelete))
		if p.AutoDelete == "keep" && p.AutoDeleteData != nil {
			sb.WriteString(fmt.Sprintf(`<auto_delete_data>%d</auto_delete_data>`, *p.AutoDeleteData))
		}
	}

	sb.WriteString(`</modify_task>`)

	data, err := GetClient().Execute(sb.String())
	if err != nil {
		return err
	}

	var resp gmpModifyTaskResponse
	if err := xml.Unmarshal(data, &resp); err != nil {
		return fmt.Errorf("gmp modify_task parse error: %w", err)
	}

	if resp.Status != "200" {
		return fmt.Errorf("gmp modify_task failed: %s - %s", resp.Status, resp.StatusText)
	}

	return nil
}

// ===========================
// Helpers
// ===========================

func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

