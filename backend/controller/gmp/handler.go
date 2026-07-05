package gmp

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

// ===========================
// Response DTOs
// ===========================

type TaskDTO struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Comment      string  `json:"comment"`
	Status       string  `json:"status"`
	Progress     int     `json:"progress"`
	Alterable    bool    `json:"alterable"`
	TargetID     string  `json:"target_id"`
	TargetName   string  `json:"target_name"`
	ConfigID     string  `json:"config_id"`
	ConfigName   string  `json:"config_name"`
	ScannerID    string  `json:"scanner_id"`
	ScannerName  string  `json:"scanner_name"`
	LastReportAt string  `json:"last_report_at"`
	Severity     float64 `json:"severity"`
	ReportCount  int     `json:"report_count"`
}

type TargetDTO struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Hosts              string `json:"hosts"`
	ExcludeHosts       string `json:"exclude_hosts"`
	Comment            string `json:"comment"`
	MaxHosts           int    `json:"max_hosts"`
	AliveTest          string `json:"alive_test"`
	MultipleIPs        bool   `json:"multiple_ips"`
	ReverseLookupOnly  bool   `json:"reverse_lookup_only"`
	ReverseLookupUnify bool   `json:"reverse_lookup_unify"`
	PortListID         string `json:"port_list_id"`
	PortListName       string `json:"port_list_name"`
	SSHCredID          string `json:"ssh_cred_id"`
	SSHCredName        string `json:"ssh_cred_name"`
	SSHCredPort        string `json:"ssh_cred_port"`
	SMBCredID          string `json:"smb_cred_id"`
	SMBCredName        string `json:"smb_cred_name"`
	ESXiCredID         string `json:"esxi_cred_id"`
	ESXiCredName       string `json:"esxi_cred_name"`
	SNMPCredID         string `json:"snmp_cred_id"`
	SNMPCredName       string `json:"snmp_cred_name"`
}

type ScannerDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type int    `json:"type"`
}

type ScanConfigDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CreateTargetRequest struct {
	Name          string `json:"name"          binding:"required"`
	Hosts         string `json:"hosts"         binding:"required"`
	Comment       string `json:"comment"`
	ExcludeHosts  string `json:"exclude_hosts"`
	PortListID    string `json:"port_list_id"`
	AliveTest     string `json:"alive_test"`
	MultipleIPs   bool   `json:"multiple_ips"`
	SSHCredID     string `json:"ssh_cred_id"`
	SSHPort       string `json:"ssh_port"`
	SMBCredID     string `json:"smb_cred_id"`
	ESXiCredID    string `json:"esxi_cred_id"`
	SNMPCredID    string `json:"snmp_cred_id"`
	ReverseLookup bool   `json:"reverse_lookup"`
	ReverseUnify  bool   `json:"reverse_unify"`
}

type CreateTaskRequest struct {
	Name           string `json:"name" binding:"required"`
	TargetID       string `json:"target_id" binding:"required"`
	ConfigID       string `json:"config_id"` // optional for CVE scanner
	ScannerID      string `json:"scanner_id"`
	Comment        string `json:"comment"`
	ApplyOverrides *bool  `json:"apply_overrides"`
	MinQoD         *int   `json:"min_qod"`
	Alterable      *bool  `json:"alterable"`
	AddAssets      *bool  `json:"add_assets"`
	AutoDelete     string `json:"auto_delete"`
	AutoDeleteData *int   `json:"auto_delete_data"`
	MaxChecks      *int   `json:"max_checks"`
	MaxHosts       *int   `json:"max_hosts"`
}

type GMPStatusResponse struct {
	Connected bool   `json:"connected"`
	Version   string `json:"version"`
	Error     string `json:"error,omitempty"`
}

type FeedDTO struct {
	Type             string `json:"type"`
	Name             string `json:"name"`
	Version          string `json:"version"`
	Description      string `json:"description"`
	CurrentlySyncing bool   `json:"currently_syncing"`
	Status           string `json:"status"`
}

// ===========================
// Helper: check GMP availability
// ===========================

func isGMPAvailable() (bool, string) {
	data, err := GetClient().Execute(`<get_version/>`)
	if err != nil {
		return false, err.Error()
	}
	if len(data) == 0 {
		return false, "empty response from gvmd"
	}
	return true, ""
}

// ===========================
// Handlers
// ===========================

// GET /gmp/status - ตรวจสอบการเชื่อมต่อกับ gvmd
func GetGMPStatus(c *gin.Context) {
	available, errMsg := isGMPAvailable()
	if !available {
		c.JSON(http.StatusOK, GMPStatusResponse{
			Connected: false,
			Error:     errMsg,
		})
		return
	}

	c.JSON(http.StatusOK, GMPStatusResponse{
		Connected: true,
		Version:   "gvmd",
	})
}

// GET /gmp/feeds - ดูสถานะ OpenVAS feeds ทั้งหมด (NVT, SCAP, CERT, GVMD_DATA)
func GetGMPFeeds(c *gin.Context) {
	feeds, err := GetFeeds()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	dtos := make([]FeedDTO, 0, len(feeds))
	for _, f := range feeds {
		isSyncing := f.CurrentlySyncing != nil
		status := "Current"
		if isSyncing {
			status = "Syncing"
		}
		dtos = append(dtos, FeedDTO{
			Type:             f.Type,
			Name:             f.Name,
			Version:          f.Version,
			Description:      f.Description,
			CurrentlySyncing: isSyncing,
			Status:           status,
		})
	}
	c.JSON(http.StatusOK, dtos)
}

// GET /gmp/tasks - ดู scan tasks ทั้งหมดใน gvmd
func ListGMPTasks(c *gin.Context) {
	tasks, err := GetTasks()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	dtos := make([]TaskDTO, 0, len(tasks))
	for _, t := range tasks {
		dto := TaskDTO{
			ID:          t.ID,
			Name:        t.Name,
			Comment:     t.Comment,
			Status:      t.Status,
			Progress:    t.Progress,
			Alterable:   t.Alterable == "1",
			TargetID:    t.Target.ID,
			TargetName:  t.Target.Name,
			ConfigID:    t.Config.ID,
			ConfigName:  t.Config.Name,
			ScannerID:   t.Scanner.ID,
			ScannerName: t.Scanner.Name,
			Severity:    t.LastReport.Report.Severity.Full,
			ReportCount: t.ReportCount.Total,
		}
		if t.LastReport.Report.Timestamp != "" {
			dto.LastReportAt = t.LastReport.Report.Timestamp
		}
		dtos = append(dtos, dto)
	}

	c.JSON(http.StatusOK, dtos)
}

// GET /gmp/targets - ดู targets ทั้งหมด (พร้อม port list + credentials)
func ListGMPTargets(c *gin.Context) {
	targets, err := GetTargets()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	dtos := make([]TargetDTO, 0, len(targets))
	for _, t := range targets {
		dtos = append(dtos, TargetDTO{
			ID:                 t.ID,
			Name:               t.Name,
			Hosts:              t.Hosts,
			ExcludeHosts:       t.ExcludeHosts,
			Comment:            t.Comment,
			MaxHosts:           t.MaxHosts,
			AliveTest:          t.AliveTests,
			MultipleIPs:        t.AllowSimultaneousIPs == "1",
			ReverseLookupOnly:  t.ReverseLookupOnly == "1",
			ReverseLookupUnify: t.ReverseLookupUnify == "1",
			PortListID:         t.PortList.ID,
			PortListName:       t.PortList.Name,
			SSHCredID:          t.SSHCredential.ID,
			SSHCredName:        t.SSHCredential.Name,
			SSHCredPort:        t.SSHCredential.Port,
			SMBCredID:          t.SMBCredential.ID,
			SMBCredName:        t.SMBCredential.Name,
			ESXiCredID:         t.ESXiCredential.ID,
			ESXiCredName:       t.ESXiCredential.Name,
			SNMPCredID:         t.SNMPCredential.ID,
			SNMPCredName:       t.SNMPCredential.Name,
		})
	}

	c.JSON(http.StatusOK, dtos)
}

// GET /gmp/scanners - ดู scanners ทั้งหมด
func ListGMPScanners(c *gin.Context) {
	scanners, err := GetScanners()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	dtos := make([]ScannerDTO, 0, len(scanners))
	for _, s := range scanners {
		dtos = append(dtos, ScannerDTO{
			ID:   s.ID,
			Name: s.Name,
			Type: s.Type,
		})
	}

	c.JSON(http.StatusOK, dtos)
}

// GET /gmp/configs - ดู scan configs
func ListGMPConfigs(c *gin.Context) {
	configs, err := GetScanConfigs()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}

	dtos := make([]ScanConfigDTO, 0, len(configs))
	for _, cfg := range configs {
		dtos = append(dtos, ScanConfigDTO{
			ID:   cfg.ID,
			Name: cfg.Name,
		})
	}

	c.JSON(http.StatusOK, dtos)
}

// POST /gmp/targets - สร้าง target ใหม่ (รองรับ port list + credentials)
func CreateGMPTarget(c *gin.Context) {
	var req CreateTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name  = strings.TrimSpace(req.Name)
	req.Hosts = strings.TrimSpace(req.Hosts)

	if req.Name == "" || req.Hosts == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and hosts are required"})
		return
	}

	id, err := CreateTargetFull(CreateTargetParams{
		Name:          req.Name,
		Comment:       req.Comment,
		Hosts:         req.Hosts,
		ExcludeHosts:  req.ExcludeHosts,
		PortListID:    req.PortListID,
		AliveTest:     req.AliveTest,
		MultipleIPs:   req.MultipleIPs,
		SSHCredID:     req.SSHCredID,
		SSHPort:       req.SSHPort,
		SMBCredID:     req.SMBCredID,
		ESXiCredID:    req.ESXiCredID,
		SNMPCredID:    req.SNMPCredID,
		ReverseLookup: req.ReverseLookup,
		ReverseUnify:  req.ReverseUnify,
	})
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "target.created", "target", id, fmt.Sprintf("created target %q (%s)", req.Name, req.Hosts))
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "target created"})
}

// POST /gmp/tasks - สร้าง scan task ใหม่
func CreateGMPTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.TargetID = strings.TrimSpace(req.TargetID)
	req.ConfigID = strings.TrimSpace(req.ConfigID)

	if req.Name == "" || req.TargetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and target_id are required"})
		return
	}

	// Resolve optional fields with defaults
	applyOverrides := true
	if req.ApplyOverrides != nil {
		applyOverrides = *req.ApplyOverrides
	}
	minQoD := 70
	if req.MinQoD != nil {
		minQoD = *req.MinQoD
	}
	alterable := false
	if req.Alterable != nil {
		alterable = *req.Alterable
	}
	addAssets := true
	if req.AddAssets != nil {
		addAssets = *req.AddAssets
	}
	autoDelete := "no"
	if req.AutoDelete == "keep" {
		autoDelete = "keep"
	}
	autoDeleteData := 5
	if req.AutoDeleteData != nil {
		autoDeleteData = *req.AutoDeleteData
	}
	maxChecks := 4
	if req.MaxChecks != nil {
		maxChecks = *req.MaxChecks
	}
	maxHosts := 20
	if req.MaxHosts != nil {
		maxHosts = *req.MaxHosts
	}

	id, err := CreateTask(CreateTaskFullParams{
		Name:           req.Name,
		Comment:        req.Comment,
		TargetID:       req.TargetID,
		ConfigID:       req.ConfigID,
		ScannerID:      req.ScannerID,
		ApplyOverrides: applyOverrides,
		MinQoD:         minQoD,
		Alterable:      alterable,
		AddAssets:      addAssets,
		AutoDelete:     autoDelete,
		AutoDeleteData: autoDeleteData,
		MaxChecks:      maxChecks,
		MaxHosts:       maxHosts,
	})
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "task.created", "task", id, fmt.Sprintf("created task %q for target %s", req.Name, req.TargetID))
	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "task created successfully",
	})
}

// POST /gmp/tasks/:id/start - เริ่ม scan
func StartGMPTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id required"})
		return
	}

	reportID, err := StartTask(taskID)
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "task.started", "task", taskID, fmt.Sprintf("started scan, report %s", reportID))
	c.JSON(http.StatusOK, gin.H{
		"message":   "scan started",
		"report_id": reportID,
	})
}

// POST /gmp/tasks/:id/stop - หยุด scan
func StopGMPTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id required"})
		return
	}

	if err := StopTask(taskID); err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "task.stopped", "task", taskID, "stopped scan")
	c.JSON(http.StatusOK, gin.H{"message": "scan stopped"})
}

// PATCH /gmp/tasks/:id - แก้ไข task
type UpdateTaskRequest struct {
	Name           string `json:"name" binding:"required"`
	Comment        string `json:"comment"`
	// Editable when task is New or Alterable
	TargetID       string `json:"target_id"`
	ConfigID       string `json:"config_id"`
	ScannerID      string `json:"scanner_id"`
	Alterable      *bool  `json:"alterable"`
	AddAssets      *bool  `json:"add_assets"`
	// Always editable
	ApplyOverrides *bool  `json:"apply_overrides"`
	MinQoD         *int   `json:"min_qod"`
	MaxChecks      *int   `json:"max_checks"`
	MaxHosts       *int   `json:"max_hosts"`
	AutoDelete     string `json:"auto_delete"`
	AutoDeleteData *int   `json:"auto_delete_data"`
}

func UpdateGMPTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id required"})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	if req.MinQoD != nil && (*req.MinQoD < 0 || *req.MinQoD > 100) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "min_qod must be between 0 and 100"})
		return
	}

	params := ModifyTaskParams{
		Name:           req.Name,
		Comment:        req.Comment,
		TargetID:       req.TargetID,
		ConfigID:       req.ConfigID,
		ScannerID:      req.ScannerID,
		Alterable:      req.Alterable,
		AddAssets:      req.AddAssets,
		ApplyOverrides: req.ApplyOverrides,
		MinQoD:         req.MinQoD,
		MaxChecks:      req.MaxChecks,
		MaxHosts:       req.MaxHosts,
		AutoDelete:     req.AutoDelete,
		AutoDeleteData: req.AutoDeleteData,
	}

	if err := ModifyTask(taskID, params); err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "task.updated", "task", taskID, fmt.Sprintf("updated task %q", req.Name))
	c.JSON(http.StatusOK, gin.H{"message": "task updated successfully"})
}

// DELETE /gmp/tasks/:id - ลบ task
func DeleteGMPTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id required"})
		return
	}

	if err := DeleteTask(taskID); err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "task.deleted", "task", taskID, "deleted GMP task")
	c.JSON(http.StatusOK, gin.H{"message": "task deleted"})
}

// DELETE /gmp/targets/:id - ลบ target
func DeleteGMPTarget(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target id required"})
		return
	}

	if err := DeleteTarget(targetID); err != nil {
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "target.deleted", "target", targetID, "deleted GMP target")

	c.JSON(http.StatusOK, gin.H{"message": "target deleted"})
}

// ─────────────────────────────────────────────────────────────
// Port List DTOs & Handlers
// ─────────────────────────────────────────────────────────────

type PortListDTO struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Comment string `json:"comment"`
	Total   int    `json:"total"`
	TCP     int    `json:"tcp"`
	UDP     int    `json:"udp"`
}

type CreatePortListRequest struct {
	Name      string `json:"name"       binding:"required"`
	Comment   string `json:"comment"`
	PortRange string `json:"port_range" binding:"required"`
}

// GET /gmp/port-lists
func ListGMPPortLists(c *gin.Context) {
	lists, err := GetPortLists()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}
	dtos := make([]PortListDTO, 0, len(lists))
	for _, pl := range lists {
		dtos = append(dtos, PortListDTO{
			ID:      pl.ID,
			Name:    pl.Name,
			Comment: pl.Comment,
			Total:   pl.PortCount.All,
			TCP:     pl.PortCount.TCP,
			UDP:     pl.PortCount.UDP,
		})
	}
	c.JSON(http.StatusOK, dtos)
}

// POST /gmp/port-lists
func CreateGMPPortList(c *gin.Context) {
	var req CreatePortListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name      = strings.TrimSpace(req.Name)
	req.PortRange = strings.TrimSpace(req.PortRange)
	if req.Name == "" || req.PortRange == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and port_range are required"})
		return
	}
	id, err := CreatePortList(req.Name, req.Comment, req.PortRange)
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portlist.created", "port_list", id, fmt.Sprintf("created port list %q (%s)", req.Name, req.PortRange))
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "port list created"})
}

// DELETE /gmp/port-lists/:id
func DeleteGMPPortList(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if err := DeletePortList(id); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portlist.deleted", "port_list", id, "deleted port list")
	c.JSON(http.StatusOK, gin.H{"message": "port list deleted"})
}

// POST /gmp/port-lists/import
func ImportGMPPortList(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "xml file is required"})
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	id, err := ImportPortList(strings.TrimSpace(string(content)))
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portlist.imported", "port_list", id, "imported port list from XML file")
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "port list imported"})
}

// ─────────────────────────────────────────────────────────────
// Port List Detail + Port Range Handlers
// ─────────────────────────────────────────────────────────────

type PortRangeDTO struct {
	ID       string `json:"id"`
	Start    int    `json:"start"`
	End      int    `json:"end"`
	Protocol string `json:"protocol"` // "tcp" or "udp" (lowercase)
	Comment  string `json:"comment,omitempty"`
}

type PortListDetailDTO struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Comment    string         `json:"comment"`
	Total      int            `json:"total"`
	TCP        int            `json:"tcp"`
	UDP        int            `json:"udp"`
	PortRanges []PortRangeDTO `json:"port_ranges"`
}

// GET /gmp/port-lists/:id — returns port list with its port ranges
func GetGMPPortListDetail(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	detail, err := GetPortListDetail(id)
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	dto := PortListDetailDTO{
		ID:         detail.ID,
		Name:       detail.Name,
		Comment:    detail.Comment,
		Total:      detail.PortCount.All,
		TCP:        detail.PortCount.TCP,
		UDP:        detail.PortCount.UDP,
		PortRanges: []PortRangeDTO{},
	}
	for _, pr := range detail.PortRanges {
		dto.PortRanges = append(dto.PortRanges, PortRangeDTO{
			ID:       pr.ID,
			Start:    pr.Start,
			End:      pr.End,
			Protocol: strings.ToLower(pr.Type),
			Comment:  pr.Comment,
		})
	}
	c.JSON(http.StatusOK, dto)
}

type CreatePortRangeRequest struct {
	Start    int    `json:"start"`
	End      int    `json:"end"`
	Protocol string `json:"protocol" binding:"required"` // "tcp" or "udp"
	Comment  string `json:"comment"`
}

// POST /gmp/port-lists/:id/ranges
func CreateGMPPortRange(c *gin.Context) {
	portListID := strings.TrimSpace(c.Param("id"))
	if portListID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "port list id required"})
		return
	}
	var req CreatePortRangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Protocol = strings.ToLower(strings.TrimSpace(req.Protocol))
	if req.Protocol != "tcp" && req.Protocol != "udp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "protocol must be 'tcp' or 'udp'"})
		return
	}
	if req.Start < 1 || req.Start > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start port must be 1–65535"})
		return
	}
	if req.End < req.Start || req.End > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end port must be >= start and <= 65535"})
		return
	}
	id, err := CreatePortRange(portListID, req.Start, req.End, req.Protocol, req.Comment)
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portrange.created", "port_list", portListID, fmt.Sprintf("added %s range %d-%d", req.Protocol, req.Start, req.End))
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "port range created"})
}

// DELETE /gmp/port-lists/:id/ranges/:range_id
func DeleteGMPPortRange(c *gin.Context) {
	portListID := strings.TrimSpace(c.Param("id"))
	rangeID := strings.TrimSpace(c.Param("range_id"))
	if rangeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "range id required"})
		return
	}
	if err := DeletePortRange(rangeID); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portrange.deleted", "port_list", portListID, fmt.Sprintf("deleted port range %s", rangeID))
	c.JSON(http.StatusOK, gin.H{"message": "port range deleted"})
}

// ─────────────────────────────────────────────────────────────
// Credential DTOs & Handlers
// ─────────────────────────────────────────────────────────────

type CredentialDTO struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	Login            string `json:"login"`
	Comment          string `json:"comment"`
	AuthAlgorithm    string `json:"auth_algorithm,omitempty"`
	PrivacyAlgorithm string `json:"privacy_algorithm,omitempty"`
}

type CreateCredentialRequest struct {
	Name             string `json:"name"              binding:"required"`
	Comment          string `json:"comment"`
	Type             string `json:"type"              binding:"required"`
	AutoGenerate     bool   `json:"auto_generate"`
	Login            string `json:"login"`
	Password         string `json:"password"`
	PrivateKey       string `json:"private_key"`
	Passphrase       string `json:"passphrase"`
	Community        string `json:"community"`
	AuthAlgorithm    string `json:"auth_algorithm"`    // md5 | sha1
	PrivacyAlgorithm string `json:"privacy_algorithm"` // aes | des | none
	PrivacyPassword  string `json:"privacy_password"`
	Certificate      string `json:"certificate"`
	PublicPGPKey     string `json:"public_pgp_key"`
	CCPrivateKey     string `json:"cc_private_key"`
	CCPassphrase     string `json:"cc_passphrase"`
}

// GET /gmp/credentials
func ListGMPCredentials(c *gin.Context) {
	creds, err := GetCredentials()
	if err != nil {
		services.RespondError(c, http.StatusServiceUnavailable, err)
		return
	}
	dtos := make([]CredentialDTO, 0, len(creds))
	for _, cr := range creds {
		dtos = append(dtos, CredentialDTO{
			ID:               cr.ID,
			Name:             cr.Name,
			Type:             cr.Type,
			Login:            cr.Login,
			Comment:          cr.Comment,
			AuthAlgorithm:    cr.AuthAlgorithm,
			PrivacyAlgorithm: cr.PrivacyAlgorithm,
		})
	}
	c.JSON(http.StatusOK, dtos)
}

// POST /gmp/credentials
func CreateGMPCredential(c *gin.Context) {
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.TrimSpace(req.Type)
	if req.Name == "" || req.Type == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and type are required"})
		return
	}

	id, err := CreateCredential(CreateCredentialParams{
		Name: req.Name, Comment: req.Comment, Type: req.Type,
		AutoGenerate: req.AutoGenerate,
		Login: req.Login, Password: req.Password,
		PrivateKey: req.PrivateKey, Passphrase: req.Passphrase,
		Community: req.Community,
		AuthAlgorithm: req.AuthAlgorithm, PrivacyAlgorithm: req.PrivacyAlgorithm,
		PrivacyPassword: req.PrivacyPassword,
		Certificate: req.Certificate, PublicPGPKey: req.PublicPGPKey,
		CCPrivateKey: req.CCPrivateKey, CCPassphrase: req.CCPassphrase,
	})
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "credential.created", "credential", id, fmt.Sprintf("created %s credential %q (login=%q, secrets not logged)", req.Type, req.Name, req.Login))
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "credential created"})
}

// ─────────────────────────────────────────────────────────────
// Trash / Recycle Bin Handlers
// ─────────────────────────────────────────────────────────────

type TrashDTO struct {
	Tasks       []TaskDTO       `json:"tasks"`
	Targets     []TargetDTO     `json:"targets"`
	Credentials []CredentialDTO `json:"credentials"`
	PortLists   []PortListDTO   `json:"port_lists"`
}

// GET /gmp/trash — รายการ items ทั้งหมดใน trashcan
func GetGMPTrash(c *gin.Context) {
	tasks, errT  := GetTrashTasks()
	tgts,  errTg := GetTrashTargets()
	creds, errC  := GetTrashCredentials()
	pls,   errP  := GetTrashPortLists()

	// Collect errors but still return partial data
	errs := []string{}
	if errT  != nil { errs = append(errs, "tasks: "+errT.Error()) }
	if errTg != nil { errs = append(errs, "targets: "+errTg.Error()) }
	if errC  != nil { errs = append(errs, "credentials: "+errC.Error()) }
	if errP  != nil { errs = append(errs, "portlists: "+errP.Error()) }

	// Map tasks
	taskDTOs := make([]TaskDTO, 0, len(tasks))
	for _, t := range tasks {
		dto := TaskDTO{
			ID: t.ID, Name: t.Name, Comment: t.Comment, Status: t.Status,
			Progress: t.Progress, TargetID: t.Target.ID, TargetName: t.Target.Name,
			ConfigID: t.Config.ID, ConfigName: t.Config.Name,
			ScannerID: t.Scanner.ID, ScannerName: t.Scanner.Name,
			Severity: t.LastReport.Report.Severity.Full, ReportCount: t.ReportCount.Total,
		}
		if t.LastReport.Report.Timestamp != "" { dto.LastReportAt = t.LastReport.Report.Timestamp }
		taskDTOs = append(taskDTOs, dto)
	}

	// Map targets
	tgtDTOs := make([]TargetDTO, 0, len(tgts))
	for _, t := range tgts {
		tgtDTOs = append(tgtDTOs, TargetDTO{
			ID: t.ID, Name: t.Name, Hosts: t.Hosts, ExcludeHosts: t.ExcludeHosts,
			Comment: t.Comment, MaxHosts: t.MaxHosts,
			AliveTest: t.AliveTests, MultipleIPs: t.AllowSimultaneousIPs == "1",
			ReverseLookupOnly: t.ReverseLookupOnly == "1", ReverseLookupUnify: t.ReverseLookupUnify == "1",
			PortListID: t.PortList.ID, PortListName: t.PortList.Name,
			SSHCredID: t.SSHCredential.ID, SSHCredName: t.SSHCredential.Name, SSHCredPort: t.SSHCredential.Port,
			SMBCredID: t.SMBCredential.ID, SMBCredName: t.SMBCredential.Name,
			ESXiCredID: t.ESXiCredential.ID, ESXiCredName: t.ESXiCredential.Name,
			SNMPCredID: t.SNMPCredential.ID, SNMPCredName: t.SNMPCredential.Name,
		})
	}

	// Map credentials
	credDTOs := make([]CredentialDTO, 0, len(creds))
	for _, cr := range creds {
		credDTOs = append(credDTOs, CredentialDTO{ID: cr.ID, Name: cr.Name, Type: cr.Type, Login: cr.Login, Comment: cr.Comment})
	}

	// Map port lists
	plDTOs := make([]PortListDTO, 0, len(pls))
	for _, pl := range pls {
		plDTOs = append(plDTOs, PortListDTO{ID: pl.ID, Name: pl.Name, Comment: pl.Comment, Total: pl.PortCount.All, TCP: pl.PortCount.TCP, UDP: pl.PortCount.UDP})
	}

	resp := gin.H{
		"tasks":       taskDTOs,
		"targets":     tgtDTOs,
		"credentials": credDTOs,
		"port_lists":  plDTOs,
	}
	if len(errs) > 0 {
		resp["warnings"] = errs
	}
	c.JSON(http.StatusOK, resp)
}

// POST /gmp/trash/restore/:id — restore item by ID (type-agnostic)
func RestoreGMPTrash(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if err := RestoreFromTrash(id); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "trash.restored", "trash_item", id, "restored item from trash")
	c.JSON(http.StatusOK, gin.H{"message": "restored"})
}

// DELETE /gmp/trash — empty entire trashcan
func EmptyGMPTrash(c *gin.Context) {
	if err := EmptyTrashcan(); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "trash.emptied", "trash", "", "permanently emptied entire trashcan")
	c.JSON(http.StatusOK, gin.H{"message": "trashcan emptied"})
}

// DELETE /gmp/trash/task/:id — permanently delete a task
func DeleteGMPTrashTask(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteTaskPermanent(id); err != nil {
		services.RespondInternalError(c, err); return
	}
	audit.Log(c, "trash.permanently_deleted", "task", id, "permanently deleted task from trash")
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/target/:id — permanently delete a target
func DeleteGMPTrashTarget(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteTargetPermanent(id); err != nil {
		services.RespondInternalError(c, err); return
	}
	audit.Log(c, "trash.permanently_deleted", "target", id, "permanently deleted target from trash")
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/credential/:id — permanently delete a credential
func DeleteGMPTrashCredential(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteCredentialPermanent(id); err != nil {
		services.RespondInternalError(c, err); return
	}
	audit.Log(c, "trash.permanently_deleted", "credential", id, "permanently deleted credential from trash")
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/portlist/:id — permanently delete a port list
func DeleteGMPTrashPortList(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeletePortListPermanent(id); err != nil {
		services.RespondInternalError(c, err); return
	}
	audit.Log(c, "trash.permanently_deleted", "port_list", id, "permanently deleted port list from trash")
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// PATCH /gmp/port-lists/:id
func UpdateGMPPortList(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	var req struct {
		Name    string `json:"name" binding:"required"`
		Comment string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	if err := ModifyPortList(id, req.Name, req.Comment); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "portlist.updated", "port_list", id, fmt.Sprintf("updated port list %q", req.Name))
	c.JSON(http.StatusOK, gin.H{"message": "port list updated"})
}

// PATCH /gmp/credentials/:id
func UpdateGMPCredential(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	if err := ModifyCredential(id, ModifyCredentialParams{
		Name: req.Name, Comment: req.Comment, Type: req.Type,
		Login: req.Login, Password: req.Password,
		PrivateKey: req.PrivateKey, Passphrase: req.Passphrase,
		Community: req.Community,
		AuthAlgorithm: req.AuthAlgorithm, PrivacyAlgorithm: req.PrivacyAlgorithm,
		PrivacyPassword: req.PrivacyPassword,
		Certificate: req.Certificate, PublicPGPKey: req.PublicPGPKey,
		CCPrivateKey: req.CCPrivateKey, CCPassphrase: req.CCPassphrase,
	}); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "credential.updated", "credential", id, fmt.Sprintf("updated %s credential %q (secrets not logged)", req.Type, req.Name))
	c.JSON(http.StatusOK, gin.H{"message": "credential updated"})
}

// PATCH /gmp/targets/:id
func UpdateGMPTarget(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	var req CreateTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name  = strings.TrimSpace(req.Name)
	req.Hosts = strings.TrimSpace(req.Hosts)
	if req.Name == "" || req.Hosts == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and hosts are required"})
		return
	}
	if err := ModifyTarget(id, CreateTargetParams{
		Name: req.Name, Comment: req.Comment, Hosts: req.Hosts,
		ExcludeHosts: req.ExcludeHosts, PortListID: req.PortListID,
		AliveTest: req.AliveTest, MultipleIPs: req.MultipleIPs,
		SSHCredID: req.SSHCredID, SSHPort: req.SSHPort,
		SMBCredID: req.SMBCredID, ESXiCredID: req.ESXiCredID, SNMPCredID: req.SNMPCredID,
		ReverseLookup: req.ReverseLookup, ReverseUnify: req.ReverseUnify,
	}); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "target.updated", "target", id, fmt.Sprintf("updated target %q (%s)", req.Name, req.Hosts))
	c.JSON(http.StatusOK, gin.H{"message": "target updated"})
}

// DELETE /gmp/credentials/:id
func DeleteGMPCredential(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if err := DeleteCredential(id); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "credential.deleted", "credential", id, "deleted GMP credential")
	c.JSON(http.StatusOK, gin.H{"message": "credential deleted"})
}
