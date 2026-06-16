package gmp

import (
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
	ID      string `json:"id"`
	Name    string `json:"name"`
	Hosts   string `json:"hosts"`
	Comment string `json:"comment"`
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
	Name    string `json:"name" binding:"required"`
	Hosts   string `json:"hosts" binding:"required"`
	Comment string `json:"comment"`
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

// GET /gmp/targets - ดู targets ทั้งหมด
func ListGMPTargets(c *gin.Context) {
	targets, err := GetTargets()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	dtos := make([]TargetDTO, 0, len(targets))
	for _, t := range targets {
		dtos = append(dtos, TargetDTO{
			ID:      t.ID,
			Name:    t.Name,
			Hosts:   t.Hosts,
			Comment: t.Comment,
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

// POST /gmp/targets - สร้าง target ใหม่
func CreateGMPTarget(c *gin.Context) {
	var req CreateTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Hosts = strings.TrimSpace(req.Hosts)

	if req.Name == "" || req.Hosts == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and hosts are required"})
		return
	}

	id, err := CreateTarget(req.Name, req.Hosts, req.Comment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "target created successfully",
	})
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
