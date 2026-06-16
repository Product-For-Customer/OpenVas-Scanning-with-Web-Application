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

type gmpAuthenticateRequest struct {
	XMLName     xml.Name `xml:"authenticate"`
	Credentials struct {
		Username string `xml:"username"`
		Password string `xml:"password"`
	} `xml:"credentials"`
}

type gmpResponse struct {
	Status     string `xml:"status,attr"`
	StatusText string `xml:"status_text,attr"`
}

type gmpGetVersionResponse struct {
	XMLName xml.Name `xml:"get_version_response"`
	gmpResponse
	Version string `xml:"version"`
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
	ID       string         `xml:"id,attr"`
	Name     string         `xml:"name"`
	Comment  string         `xml:"comment"`
	Status   string         `xml:"status"`
	Progress int            `xml:"progress"`
	Target   GMPRef         `xml:"target"`
	Config   GMPRef         `xml:"config"`
	Scanner  GMPRef         `xml:"scanner"`
	LastReport GMPLastReport `xml:"last_report"`
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
	ID      string `xml:"id,attr"`
	Name    string `xml:"name"`
	Comment string `xml:"comment"`
	Hosts   string `xml:"hosts"`
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

// Create responses
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

func CreateTarget(name, hosts, comment string) (string, error) {
	cmd := fmt.Sprintf(
		`<create_target><name>%s</name><hosts>%s</hosts><comment>%s</comment><alive_tests>Consider Alive</alive_tests></create_target>`,
		xmlEscape(name), xmlEscape(hosts), xmlEscape(comment),
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

func CreateTask(name, targetID, configID, scannerID, comment string) (string, error) {
	// Default OpenVAS scanner if empty
	scannerPart := ""
	if scannerID != "" {
		scannerPart = fmt.Sprintf(`<scanner id="%s"/>`, xmlEscape(scannerID))
	}

	cmd := fmt.Sprintf(
		`<create_task><name>%s</name><comment>%s</comment><target id="%s"/><config id="%s"/>%s</create_task>`,
		xmlEscape(name), xmlEscape(comment),
		xmlEscape(targetID), xmlEscape(configID),
		scannerPart,
	)

	data, err := GetClient().Execute(cmd)
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
