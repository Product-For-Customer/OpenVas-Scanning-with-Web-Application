package schedule

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/gmp"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ─────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────

type ScheduleDTO struct {
	ID         uint    `json:"id"`
	TaskID     string  `json:"task_id"`
	TaskName   string  `json:"task_name"`
	Frequency  string  `json:"frequency"`
	ScanTime   string  `json:"scan_time"`
	ScheduleAt *string `json:"schedule_at,omitempty"` // "YYYY-MM-DD"
	DayOfMonth *int    `json:"day_of_month,omitempty"`
	Month      *int    `json:"month,omitempty"`
	Day        *int    `json:"day,omitempty"`
	Enabled    bool    `json:"enabled"`
	LastRunAt  *string `json:"last_run_at,omitempty"`
	NextRunAt  *string `json:"next_run_at,omitempty"`
	CreatedAt  string  `json:"created_at"`
}

type CreateScheduleRequest struct {
	TaskID     string  `json:"task_id"    binding:"required"`
	TaskName   string  `json:"task_name"`
	Frequency  string  `json:"frequency"  binding:"required"`
	ScanTime   string  `json:"scan_time"  binding:"required"` // "HH:mm"
	ScheduleAt *string `json:"schedule_at,omitempty"`         // "YYYY-MM-DD" for once
	DayOfMonth *int    `json:"day_of_month,omitempty"`
	Month      *int    `json:"month,omitempty"`
	Day        *int    `json:"day,omitempty"`
}

type UpdateScheduleRequest struct {
	Enabled *bool `json:"enabled"`
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

func toDTO(s entity.AutoScanSchedule) ScheduleDTO {
	dto := ScheduleDTO{
		ID:         s.ID,
		TaskID:     s.TaskID,
		TaskName:   s.TaskName,
		Frequency:  s.Frequency,
		ScanTime:   s.ScanTime,
		DayOfMonth: s.DayOfMonth,
		Month:      s.Month,
		Day:        s.Day,
		Enabled:    s.Enabled,
		CreatedAt:  s.CreatedAt.Format(time.RFC3339),
	}
	if s.ScheduleAt != nil {
		str := s.ScheduleAt.Format("2006-01-02")
		dto.ScheduleAt = &str
	}
	if s.LastRunAt != nil {
		str := s.LastRunAt.Format(time.RFC3339)
		dto.LastRunAt = &str
	}
	if s.NextRunAt != nil {
		str := s.NextRunAt.Format(time.RFC3339)
		dto.NextRunAt = &str
	}
	return dto
}

func computeNextRun(freq, scanTime string, scheduleAt *string, dayOfMonth, month, day *int) *time.Time {
	now := time.Now()
	parts := strings.Split(scanTime, ":")
	if len(parts) < 2 {
		return nil
	}
	h, errH := strconv.Atoi(parts[0])
	m, errM := strconv.Atoi(parts[1])
	if errH != nil || errM != nil {
		return nil
	}

	switch freq {
	case "once":
		if scheduleAt == nil {
			return nil
		}
		base, err := time.ParseInLocation("2006-01-02", *scheduleAt, now.Location())
		if err != nil {
			return nil
		}
		t := time.Date(base.Year(), base.Month(), base.Day(), h, m, 0, 0, now.Location())
		return &t

	case "monthly":
		if dayOfMonth == nil {
			return nil
		}
		d := time.Date(now.Year(), now.Month(), *dayOfMonth, h, m, 0, 0, now.Location())
		if !d.After(now) {
			d = d.AddDate(0, 1, 0)
		}
		return &d

	case "yearly":
		if month == nil || day == nil {
			return nil
		}
		d := time.Date(now.Year(), time.Month(*month), *day, h, m, 0, 0, now.Location())
		if !d.After(now) {
			d = d.AddDate(1, 0, 0)
		}
		return &d
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────────────

// GET /scan-schedules
func ListSchedules(c *gin.Context) {
	db := config.DB()
	var list []entity.AutoScanSchedule
	db.Order("created_at DESC").Find(&list)

	dtos := make([]ScheduleDTO, 0, len(list))
	for _, s := range list {
		dtos = append(dtos, toDTO(s))
	}
	c.JSON(http.StatusOK, dtos)
}

// POST /scan-schedules
func CreateSchedule(c *gin.Context) {
	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Frequency != "once" && req.Frequency != "monthly" && req.Frequency != "yearly" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "frequency must be once | monthly | yearly"})
		return
	}

	nextRun := computeNextRun(req.Frequency, req.ScanTime, req.ScheduleAt, req.DayOfMonth, req.Month, req.Day)

	s := entity.AutoScanSchedule{
		TaskID:     req.TaskID,
		TaskName:   req.TaskName,
		Frequency:  req.Frequency,
		ScanTime:   req.ScanTime,
		DayOfMonth: req.DayOfMonth,
		Month:      req.Month,
		Day:        req.Day,
		Enabled:    true,
		NextRunAt:  nextRun,
	}
	if req.ScheduleAt != nil {
		base, err := time.ParseInLocation("2006-01-02", *req.ScheduleAt, time.Now().Location())
		if err == nil {
			t := time.Date(base.Year(), base.Month(), base.Day(), 0, 0, 0, 0, time.Now().Location())
			s.ScheduleAt = &t
		}
	}

	db := config.DB()
	if err := db.Create(&s).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, toDTO(s))
}

// PATCH /scan-schedules/:id
func UpdateSchedule(c *gin.Context) {
	idStr := c.Param("id")
	var req UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()
	var s entity.AutoScanSchedule
	if err := db.First(&s, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
		return
	}
	if req.Enabled != nil {
		s.Enabled = *req.Enabled
	}
	db.Save(&s)
	c.JSON(http.StatusOK, toDTO(s))
}

// DELETE /scan-schedules/:id
func DeleteSchedule(c *gin.Context) {
	idStr := c.Param("id")
	db := config.DB()
	if err := db.Delete(&entity.AutoScanSchedule{}, idStr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─────────────────────────────────────────────────────────────
// Background Scheduler — checks every minute for due schedules
// ─────────────────────────────────────────────────────────────

func StartAutoScanScheduler() {
	log.Println("🕑 Auto scan scheduler started — checking every minute")
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		runDueSchedules()
	}
}

func runDueSchedules() {
	db := config.DB()
	if db == nil {
		return
	}
	var schedules []entity.AutoScanSchedule
	db.Where("enabled = true AND next_run_at IS NOT NULL AND next_run_at <= ?", time.Now()).Find(&schedules)
	for _, s := range schedules {
		s := s // capture loop var
		go triggerScheduledScan(s)
	}
}

func triggerScheduledScan(s entity.AutoScanSchedule) {
	db := config.DB()
	log.Printf("🎯 Auto scan triggered: task=%q id=%d freq=%s\n", s.TaskName, s.ID, s.Frequency)

	if _, err := gmp.StartTask(s.TaskID); err != nil {
		log.Printf("❌ Auto scan failed: task=%q err=%v\n", s.TaskName, err)
	} else {
		log.Printf("✅ Auto scan started: task=%q\n", s.TaskName)
	}

	now := time.Now()
	s.LastRunAt = &now

	if s.Frequency == "once" {
		s.Enabled = false
		s.NextRunAt = nil
	} else {
		var schedAtStr *string
		if s.ScheduleAt != nil {
			str := s.ScheduleAt.Format("2006-01-02")
			schedAtStr = &str
		}
		next := computeNextRun(s.Frequency, s.ScanTime, schedAtStr, s.DayOfMonth, s.Month, s.Day)
		s.NextRunAt = next
	}

	if err := db.Save(&s).Error; err != nil {
		log.Printf("⚠️ Auto scan schedule save error: %v\n", err)
	}
}

