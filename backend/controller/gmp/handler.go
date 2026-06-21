package gmp

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ===========================
// Response DTOs
// ===========================

type TaskDTO struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Comment     string  `json:"comment"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	TargetID    string  `json:"target_id"`
	TargetName  string  `json:"target_name"`
	ConfigID    string  `json:"config_id"`
	ConfigName  string  `json:"config_name"`
	ScannerID   string  `json:"scanner_id"`
	ScannerName string  `json:"scanner_name"`
	LastReportAt string `json:"last_report_at"`
	Severity    float64 `json:"severity"`
	ReportCount int     `json:"report_count"`
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
	Name      string `json:"name" binding:"required"`
	TargetID  string `json:"target_id" binding:"required"`
	ConfigID  string `json:"config_id" binding:"required"`
	ScannerID string `json:"scanner_id"`
	Comment   string `json:"comment"`
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
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   err.Error(),
			"message": "cannot retrieve feed status from gvmd",
		})
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
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   err.Error(),
			"message": "cannot connect to gvmd. Check GVM_SOCKET_PATH or GVM_HOST/GVM_PORT environment variables.",
		})
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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

	if req.Name == "" || req.TargetID == "" || req.ConfigID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, target_id, and config_id are required"})
		return
	}

	id, err := CreateTask(req.Name, req.TargetID, req.ConfigID, req.ScannerID, req.Comment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "scan stopped"})
}

// DELETE /gmp/tasks/:id - ลบ task
func DeleteGMPTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id required"})
		return
	}

	if err := DeleteTask(taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "port list imported"})
}

// ─────────────────────────────────────────────────────────────
// Credential DTOs & Handlers
// ─────────────────────────────────────────────────────────────

type CredentialDTO struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Login   string `json:"login"`
	Comment string `json:"comment"`
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	dtos := make([]CredentialDTO, 0, len(creds))
	for _, cr := range creds {
		dtos = append(dtos, CredentialDTO{
			ID:      cr.ID,
			Name:    cr.Name,
			Type:    cr.Type,
			Login:   cr.Login,
			Comment: cr.Comment,
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "restored"})
}

// DELETE /gmp/trash — empty entire trashcan
func EmptyGMPTrash(c *gin.Context) {
	if err := EmptyTrashcan(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "trashcan emptied"})
}

// DELETE /gmp/trash/task/:id — permanently delete a task
func DeleteGMPTrashTask(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteTaskPermanent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/target/:id — permanently delete a target
func DeleteGMPTrashTarget(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteTargetPermanent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/credential/:id — permanently delete a credential
func DeleteGMPTrashCredential(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeleteCredentialPermanent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
	c.JSON(http.StatusOK, gin.H{"message": "permanently deleted"})
}

// DELETE /gmp/trash/portlist/:id — permanently delete a port list
func DeleteGMPTrashPortList(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" { c.JSON(http.StatusBadRequest, gin.H{"error": "id required"}); return }
	if err := DeletePortListPermanent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "credential deleted"})
}
