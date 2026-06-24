package schedule

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/gmp"
	"github.com/Tawunchai/openvas/controller/line"
	"github.com/Tawunchai/openvas/controller/setting"
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
	Timezone   string  `json:"timezone"`
	ScheduleAt *string `json:"schedule_at,omitempty"`
	DayOfMonth *int    `json:"day_of_month,omitempty"`
	Month      *int    `json:"month,omitempty"`
	Day        *int    `json:"day,omitempty"`
	Enabled    bool    `json:"enabled"`
	LastRunAt  *string `json:"last_run_at,omitempty"`
	NextRunAt  *string `json:"next_run_at,omitempty"`
	CreatedAt  string  `json:"created_at"`
}

type CreateScheduleRequest struct {
	TaskID     string  `json:"task_id"   binding:"required"`
	TaskName   string  `json:"task_name"`
	Frequency  string  `json:"frequency" binding:"required"`
	ScanTime   string  `json:"scan_time" binding:"required"`
	ScheduleAt *string `json:"schedule_at,omitempty"`
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

func resolveLocation(tz string) *time.Location {
	t := strings.TrimSpace(tz)
	if t == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(t)
	if err != nil {
		return time.UTC
	}
	return loc
}

func toDTO(s entity.AutoScanSchedule) ScheduleDTO {
	dto := ScheduleDTO{
		ID:         s.ID,
		TaskID:     s.TaskID,
		TaskName:   s.TaskName,
		Frequency:  s.Frequency,
		ScanTime:   s.ScanTime,
		Timezone:   s.Timezone,
		DayOfMonth: s.DayOfMonth,
		Month:      s.Month,
		Day:        s.Day,
		Enabled:    s.Enabled,
		CreatedAt:  s.CreatedAt.Format(time.RFC3339),
	}
	if s.ScheduleAt != nil {
		// Format date in the schedule's own timezone to avoid UTC date drift
		loc := resolveLocation(s.Timezone)
		str := s.ScheduleAt.In(loc).Format("2006-01-02")
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

// computeNextRun always uses the current global timezone from SystemConfig.
func computeNextRun(freq, scanTime string, scheduleAt *string, dayOfMonth, month, day *int) *time.Time {
	tz := setting.GetAppTimezone()
	loc := resolveLocation(tz)
	now := time.Now().In(loc)

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
		base, err := time.ParseInLocation("2006-01-02", *scheduleAt, loc)
		if err != nil {
			return nil
		}
		t := time.Date(base.Year(), base.Month(), base.Day(), h, m, 0, 0, loc)
		return &t

	case "monthly":
		if dayOfMonth == nil {
			return nil
		}
		d := time.Date(now.Year(), now.Month(), *dayOfMonth, h, m, 0, 0, loc)
		if !d.After(now) {
			d = d.AddDate(0, 1, 0)
		}
		return &d

	case "yearly":
		if month == nil || day == nil {
			return nil
		}
		d := time.Date(now.Year(), time.Month(*month), *day, h, m, 0, 0, loc)
		if !d.After(now) {
			d = d.AddDate(1, 0, 0)
		}
		return &d
	}
	return nil
}

// ─────────────────────────────────────────────────────────────
// LINE notification helpers
// ─────────────────────────────────────────────────────────────

func nowInTZ(tz string) string {
	loc := resolveLocation(tz)
	return time.Now().In(loc).Format("02/01/2006 15:04")
}

func buildScanStartMessage(s entity.AutoScanSchedule, targetName string) string {
	tz := s.Timezone
	if tz == "" {
		tz = setting.GetAppTimezone()
	}
	target := targetName
	if target == "" {
		target = "-"
	}
	return fmt.Sprintf(
		"🚀 Auto Scan เริ่มต้นแล้วครับ\n"+
			"━━━━━━━━━━━━━━━━━\n"+
			"📋 Task    : %s\n"+
			"🎯 Target  : %s\n"+
			"⏰ เวลา    : %s\n"+
			"🌐 Timezone: %s\n"+
			"━━━━━━━━━━━━━━━━━\n"+
			"ระบบกำลังสแกนหา Vulnerability ครับ",
		s.TaskName, target, nowInTZ(tz), tz,
	)
}

func buildScanDoneMessage(s entity.AutoScanSchedule, status, targetName string) string {
	tz := s.Timezone
	if tz == "" {
		tz = setting.GetAppTimezone()
	}
	target := targetName
	if target == "" {
		target = "-"
	}
	emoji := "✅"
	label := "เสร็จสิ้นแล้วครับ"
	desc := "การสแกนเสร็จสมบูรณ์ครับ"
	if strings.EqualFold(status, "stopped") || strings.EqualFold(status, "interrupted") {
		emoji = "⚠️"
		label = "ถูกหยุดแล้วครับ"
		desc = fmt.Sprintf("การสแกนถูกหยุด (สถานะ: %s)", status)
	}
	return fmt.Sprintf(
		"%s Auto Scan %s\n"+
			"━━━━━━━━━━━━━━━━━\n"+
			"📋 Task    : %s\n"+
			"🎯 Target  : %s\n"+
			"⏰ เวลา    : %s\n"+
			"🌐 Timezone: %s\n"+
			"━━━━━━━━━━━━━━━━━\n"+
			"%s",
		emoji, label, s.TaskName, target, nowInTZ(tz), tz, desc,
	)
}

// getTaskTargetName tries to resolve the target name from GMP for the given task ID.
func getTaskTargetName(taskID string) string {
	tasks, err := gmp.GetTasks()
	if err != nil {
		return ""
	}
	for _, t := range tasks {
		if t.ID == taskID {
			return t.Target.Name
		}
	}
	return ""
}

// pollForScanCompletion runs in a goroutine and sends a LINE notification when the scan finishes.
func pollForScanCompletion(s entity.AutoScanSchedule, targetName string) {
	ticker := time.NewTicker(30 * time.Second)
	timeout := time.NewTimer(24 * time.Hour)
	defer ticker.Stop()
	defer timeout.Stop()

	for {
		select {
		case <-timeout.C:
			log.Printf("⏱ pollForScanCompletion timeout: task=%q", s.TaskName)
			return

		case <-ticker.C:
			tasks, err := gmp.GetTasks()
			if err != nil {
				continue
			}
			for _, t := range tasks {
				if t.ID != s.TaskID {
					continue
				}
				st := strings.ToLower(t.Status)
				if st == "done" || st == "stopped" || st == "interrupted" {
					msg := buildScanDoneMessage(s, t.Status, targetName)
					line.SendScanNotification(msg)
					log.Printf("📲 LINE scan-done sent: task=%q status=%s", s.TaskName, t.Status)
				}
				return
			}
		}
	}
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

	tz := setting.GetAppTimezone()
	loc := resolveLocation(tz)

	nextRun := computeNextRun(req.Frequency, req.ScanTime, req.ScheduleAt, req.DayOfMonth, req.Month, req.Day)

	s := entity.AutoScanSchedule{
		TaskID:     req.TaskID,
		TaskName:   req.TaskName,
		Frequency:  req.Frequency,
		ScanTime:   req.ScanTime,
		Timezone:   tz,
		DayOfMonth: req.DayOfMonth,
		Month:      req.Month,
		Day:        req.Day,
		Enabled:    true,
		NextRunAt:  nextRun,
	}
	if req.ScheduleAt != nil {
		base, err := time.ParseInLocation("2006-01-02", *req.ScheduleAt, loc)
		if err == nil {
			t := time.Date(base.Year(), base.Month(), base.Day(), 12, 0, 0, 0, loc) // noon avoids UTC date flip
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
		// When re-enabling a "once" schedule that was already fired (next_run_at = nil),
		// recompute next_run_at so it can fire again.
		if *req.Enabled && s.NextRunAt == nil {
			var schedAtStr *string
			if s.ScheduleAt != nil {
				loc := resolveLocation(s.Timezone)
				str := s.ScheduleAt.In(loc).Format("2006-01-02")
				schedAtStr = &str
			}
			s.NextRunAt = computeNextRun(s.Frequency, s.ScanTime, schedAtStr, s.DayOfMonth, s.Month, s.Day)
		}
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
// Background Scheduler
// ─────────────────────────────────────────────────────────────

func StartAutoScanScheduler() {
	log.Println("🕑 Auto scan scheduler started — checking every minute")
	// Run once immediately so schedules due at startup aren't delayed 1 min
	runDueSchedules()
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
		s := s
		go triggerScheduledScan(s)
	}
}

func triggerScheduledScan(s entity.AutoScanSchedule) {
	db := config.DB()
	tz := setting.GetAppTimezone()
	log.Printf("🎯 Auto scan triggered: task=%q id=%d freq=%s tz=%s\n", s.TaskName, s.ID, s.Frequency, tz)

	// Resolve target name once for both notifications
	targetName := getTaskTargetName(s.TaskID)

	if _, err := gmp.StartTask(s.TaskID); err != nil {
		log.Printf("❌ Auto scan failed: task=%q err=%v\n", s.TaskName, err)
		// Notify LINE that scan FAILED to start
		failMsg := fmt.Sprintf(
			"❌ Auto Scan เริ่มไม่ได้ครับ\n📋 Task: %s\n⏰ %s (%s)\nข้อผิดพลาด: %v",
			s.TaskName, nowInTZ(tz), tz, err,
		)
		go line.SendScanNotification(failMsg)
	} else {
		log.Printf("✅ Auto scan started: task=%q\n", s.TaskName)
		// Notify LINE: scan started
		go line.SendScanNotification(buildScanStartMessage(s, targetName))
		// Poll until done then notify again
		go pollForScanCompletion(s, targetName)
	}

	now := time.Now()
	s.LastRunAt = &now
	s.Timezone = tz

	if s.Frequency == "once" {
		s.Enabled = false
		s.NextRunAt = nil
	} else {
		loc := resolveLocation(s.Timezone)
		var schedAtStr *string
		if s.ScheduleAt != nil {
			str := s.ScheduleAt.In(loc).Format("2006-01-02")
			schedAtStr = &str
		}
		next := computeNextRun(s.Frequency, s.ScanTime, schedAtStr, s.DayOfMonth, s.Month, s.Day)
		s.NextRunAt = next
	}

	if err := db.Save(&s).Error; err != nil {
		log.Printf("⚠️ Auto scan schedule save error: %v\n", err)
	}
}
