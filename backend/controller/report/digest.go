package report

import (
	"fmt"
	"log"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

// ===========================================================================
// Auto-Report Digest
//
// A recurring schedule that generates the executive PDF report and delivers it
// to email or LINE. Lives in the `report` package so it can reuse the exact
// same pipeline the manual buttons use — generatePDFFromCapturePage,
// sendEmailWithPDFAttachment, pushLineTextMessageToTarget, buildPublicPDFURL,
// buildCaptureURL, listAppNotificationsByIDs, parseAppNotificationIDs.
// ===========================================================================

const (
	digestChannelEmail = "email"
	digestChannelLINE  = "line"

	digestFreqWeekly  = "weekly"
	digestFreqMonthly = "monthly"
	digestFreqYearly  = "yearly"
)

// ── Request/response DTO ──────────────────────────────────────────────────

type digestRequest struct {
	Name                string `json:"name"`
	Channel             string `json:"channel"`
	Frequency           string `json:"frequency"`
	Hour                int    `json:"hour"`
	Minute              int    `json:"minute"`
	DayOfWeek           int    `json:"day_of_week"`
	DayOfMonth          int    `json:"day_of_month"`
	Month               int    `json:"month"`
	Day                 int    `json:"day"`
	Timezone            string `json:"timezone"`
	EmailTo             string `json:"email_to"`
	LineNotificationIDs string `json:"line_notification_ids"`
	Enabled             *bool  `json:"enabled"`
}

// ── Validation ────────────────────────────────────────────────────────────

func validateDigest(s *entity.AppReportDigestSchedule) error {
	s.Name = strings.TrimSpace(s.Name)
	if s.Name == "" {
		return fmt.Errorf("name is required")
	}
	if s.Channel != digestChannelEmail && s.Channel != digestChannelLINE {
		return fmt.Errorf("channel must be \"email\" or \"line\"")
	}
	switch s.Frequency {
	case digestFreqWeekly, digestFreqMonthly, digestFreqYearly:
	default:
		return fmt.Errorf("frequency must be weekly, monthly, or yearly")
	}
	if s.Hour < 0 || s.Hour > 23 {
		return fmt.Errorf("hour must be 0-23")
	}
	if s.Minute < 0 || s.Minute > 59 {
		return fmt.Errorf("minute must be 0-59")
	}
	if s.Frequency == digestFreqWeekly && (s.DayOfWeek < 0 || s.DayOfWeek > 6) {
		return fmt.Errorf("day_of_week must be 0-6")
	}
	if s.Frequency == digestFreqMonthly && (s.DayOfMonth < 1 || s.DayOfMonth > 31) {
		return fmt.Errorf("day_of_month must be 1-31")
	}
	if s.Frequency == digestFreqYearly {
		if s.Month < 1 || s.Month > 12 {
			return fmt.Errorf("month must be 1-12")
		}
		if s.Day < 1 || s.Day > 31 {
			return fmt.Errorf("day must be 1-31")
		}
	}
	if strings.TrimSpace(s.Timezone) == "" {
		s.Timezone = "Asia/Bangkok"
	}
	if _, err := time.LoadLocation(s.Timezone); err != nil {
		return fmt.Errorf("invalid timezone %q", s.Timezone)
	}

	// Channel-specific target validation.
	if s.Channel == digestChannelEmail {
		emails := splitCSV(s.EmailTo)
		if len(emails) == 0 {
			return fmt.Errorf("at least one recipient email is required for the email channel")
		}
		for _, e := range emails {
			if _, err := mail.ParseAddress(e); err != nil {
				return fmt.Errorf("invalid email address: %s", e)
			}
		}
		s.EmailTo = strings.Join(emails, ",")
	} else {
		ids, err := parseAppNotificationIDs(s.LineNotificationIDs)
		if err != nil || len(ids) == 0 {
			return fmt.Errorf("at least one LINE notification target is required for the line channel")
		}
	}
	return nil
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := map[string]bool{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out
}

// ── Timezone-aware next-run computation ───────────────────────────────────

// clampDay caps a day-of-month to the number of days in the given year/month
// (so "day 31" in a 30-day month or February doesn't overflow into next month).
func clampDay(year int, month time.Month, day int) int {
	// Day 0 of the next month == last day of this month.
	last := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if day > last {
		return last
	}
	if day < 1 {
		return 1
	}
	return day
}

func computeDigestNextRun(s entity.AppReportDigestSchedule) *time.Time {
	loc, err := time.LoadLocation(s.Timezone)
	if err != nil || loc == nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	var d time.Time
	switch s.Frequency {
	case digestFreqWeekly:
		d = time.Date(now.Year(), now.Month(), now.Day(), s.Hour, s.Minute, 0, 0, loc)
		delta := (s.DayOfWeek - int(d.Weekday()) + 7) % 7
		d = d.AddDate(0, 0, delta)
		if !d.After(now) {
			d = d.AddDate(0, 0, 7)
		}
	case digestFreqMonthly:
		d = time.Date(now.Year(), now.Month(), clampDay(now.Year(), now.Month(), s.DayOfMonth), s.Hour, s.Minute, 0, 0, loc)
		if !d.After(now) {
			nm := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc).AddDate(0, 1, 0)
			d = time.Date(nm.Year(), nm.Month(), clampDay(nm.Year(), nm.Month(), s.DayOfMonth), s.Hour, s.Minute, 0, 0, loc)
		}
	case digestFreqYearly:
		mo := time.Month(s.Month)
		d = time.Date(now.Year(), mo, clampDay(now.Year(), mo, s.Day), s.Hour, s.Minute, 0, 0, loc)
		if !d.After(now) {
			d = time.Date(now.Year()+1, mo, clampDay(now.Year()+1, mo, s.Day), s.Hour, s.Minute, 0, 0, loc)
		}
	default:
		return nil
	}
	return &d
}

// ── HTTP handlers ─────────────────────────────────────────────────────────

// GET /report-digests
func ListDigestSchedules(c *gin.Context) {
	db := config.DB()
	var list []entity.AppReportDigestSchedule
	if err := db.Order("created_at DESC").Find(&list).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(200, gin.H{"data": list})
}

// POST /report-digests
func CreateDigestSchedule(c *gin.Context) {
	var req digestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	s := digestFromRequest(entity.AppReportDigestSchedule{Enabled: true}, req)
	if err := validateDigest(&s); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	s.NextRunAt = computeDigestNextRun(s)

	db := config.DB()
	if err := db.Create(&s).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "report_digest.created", "report_digest", fmt.Sprintf("%d", s.ID), fmt.Sprintf("created report digest %q (%s, %s)", s.Name, s.Channel, s.Frequency))
	c.JSON(201, gin.H{"data": s})
}

// PATCH /report-digests/:id
func UpdateDigestSchedule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid id"})
		return
	}
	db := config.DB()
	var s entity.AppReportDigestSchedule
	if err := db.First(&s, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	var req digestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	s = digestFromRequest(s, req)
	if err := validateDigest(&s); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	s.NextRunAt = computeDigestNextRun(s)

	if err := db.Save(&s).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "report_digest.updated", "report_digest", fmt.Sprintf("%d", s.ID), fmt.Sprintf("updated report digest %q", s.Name))
	c.JSON(200, gin.H{"data": s})
}

// DELETE /report-digests/:id
func DeleteDigestSchedule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid id"})
		return
	}
	db := config.DB()
	var s entity.AppReportDigestSchedule
	if err := db.First(&s, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	if err := db.Delete(&s).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "report_digest.deleted", "report_digest", fmt.Sprintf("%d", id), fmt.Sprintf("deleted report digest %q", s.Name))
	c.JSON(200, gin.H{"message": "deleted"})
}

// POST /report-digests/:id/run — send this digest now (manual trigger).
func RunDigestNow(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid id"})
		return
	}
	db := config.DB()
	var s entity.AppReportDigestSchedule
	if err := db.First(&s, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}

	// Run synchronously so the caller gets the real success/failure — a digest
	// is a bounded operation (one PDF capture + a few sends).
	if err := runDigestDelivery(s); err != nil {
		now := time.Now()
		db.Model(&s).Updates(map[string]interface{}{"last_run_at": now, "last_status": "failed", "last_error": err.Error()})
		c.JSON(502, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	db.Model(&s).Updates(map[string]interface{}{"last_run_at": now, "last_status": "ok", "last_error": ""})
	audit.Log(c, "report_digest.triggered", "report_digest", fmt.Sprintf("%d", id), fmt.Sprintf("manually sent report digest %q", s.Name))
	c.JSON(200, gin.H{"message": "digest sent"})
}

func digestFromRequest(s entity.AppReportDigestSchedule, req digestRequest) entity.AppReportDigestSchedule {
	s.Name = req.Name
	s.Channel = strings.TrimSpace(strings.ToLower(req.Channel))
	s.Frequency = strings.TrimSpace(strings.ToLower(req.Frequency))
	s.Hour = req.Hour
	s.Minute = req.Minute
	s.DayOfWeek = req.DayOfWeek
	s.DayOfMonth = req.DayOfMonth
	s.Month = req.Month
	s.Day = req.Day
	s.Timezone = strings.TrimSpace(req.Timezone)
	s.EmailTo = req.EmailTo
	s.LineNotificationIDs = req.LineNotificationIDs
	if req.Enabled != nil {
		s.Enabled = *req.Enabled
	}
	return s
}

// ── Background scheduler ───────────────────────────────────────────────────

// StartReportDigestScheduler checks every minute for due digest schedules and
// fires them. Mirrors StartFeedUpdateScheduler's design.
func StartReportDigestScheduler() {
	log.Println("🕑 Report digest scheduler started — checking every minute")
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		runDueDigests()
	}
}

func runDueDigests() {
	db := config.DB()
	if db == nil {
		return
	}
	var due []entity.AppReportDigestSchedule
	db.Where("enabled = true AND next_run_at IS NOT NULL AND next_run_at <= ?", time.Now()).Find(&due)
	for _, s := range due {
		s := s
		go executeDigest(s)
	}
}

func executeDigest(s entity.AppReportDigestSchedule) {
	db := config.DB()
	log.Printf("📧 Report digest running: %q (channel=%s, freq=%s)", s.Name, s.Channel, s.Frequency)

	err := runDigestDelivery(s)

	now := time.Now()
	s.LastRunAt = &now
	if err != nil {
		s.LastStatus = "failed"
		s.LastError = err.Error()
		log.Printf("❌ Report digest failed: %q — %v", s.Name, err)
	} else {
		s.LastStatus = "ok"
		s.LastError = ""
		log.Printf("✅ Report digest sent: %q", s.Name)
	}
	// Always advance the next run so a single failure doesn't wedge the schedule.
	s.NextRunAt = computeDigestNextRun(s)
	if err := db.Save(&s).Error; err != nil {
		log.Printf("⚠️ report digest save error: %v", err)
	}
}

// runDigestDelivery generates the executive PDF (full report, no task filter)
// and delivers it via the schedule's channel.
func runDigestDelivery(s entity.AppReportDigestSchedule) error {
	captureURL := buildCaptureURL(nil)
	filePath, err := generatePDFFromCapturePage(captureURL)
	if err != nil {
		return fmt.Errorf("generate report PDF: %w", err)
	}

	switch s.Channel {
	case digestChannelEmail:
		// Email attaches the bytes, so the temp file isn't needed afterward.
		defer os.Remove(filePath)
		return deliverDigestEmail(s, filePath)
	case digestChannelLINE:
		// LINE fetches via the public URL, so keep the file — the report
		// cleanup scheduler removes it after its retention window.
		return deliverDigestLINE(s, filePath)
	default:
		return fmt.Errorf("unknown channel: %s", s.Channel)
	}
}

func deliverDigestEmail(s entity.AppReportDigestSchedule, filePath string) error {
	pdfBytes, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read generated PDF: %w", err)
	}
	fileName := fmt.Sprintf("argus_report_%s.pdf", time.Now().Format("20060102_150405"))

	db := config.DB()
	var sendMail entity.SendEmail
	if err := db.First(&sendMail).Error; err != nil {
		return fmt.Errorf("email is not configured — set it up in Service settings")
	}
	if strings.TrimSpace(sendMail.Email) == "" || strings.TrimSpace(sendMail.PassApp) == "" {
		return fmt.Errorf("email credentials are incomplete")
	}

	recipients := splitCSV(s.EmailTo)
	if len(recipients) == 0 {
		return fmt.Errorf("no email recipients configured")
	}

	var failed []string
	for _, to := range recipients {
		if err := sendEmailWithPDFAttachment(sendMail.Email, sendMail.PassApp, to, fileName, pdfBytes); err != nil {
			failed = append(failed, fmt.Sprintf("%s: %v", to, err))
		}
	}
	if len(failed) == len(recipients) {
		return fmt.Errorf("all recipients failed: %s", strings.Join(failed, "; "))
	}
	return nil
}

func deliverDigestLINE(s entity.AppReportDigestSchedule, filePath string) error {
	ids, err := parseAppNotificationIDs(s.LineNotificationIDs)
	if err != nil || len(ids) == 0 {
		return fmt.Errorf("no LINE notification targets configured")
	}

	publicURL := buildPublicPDFURL(filePath)
	msg := fmt.Sprintf("📄 รายงานสรุปอัตโนมัติ: %s\n\nเปิดรายงานได้ที่:\n%s", s.Name, publicURL)

	items, err := listAppNotificationsByIDs(ids)
	if err != nil {
		return fmt.Errorf("load LINE notifications: %w", err)
	}

	sent := 0
	var failed []string
	for _, item := range items {
		if !item.Alert || strings.TrimSpace(item.SendID) == "" || item.AppLineMaster.ID == 0 {
			failed = append(failed, fmt.Sprintf("id=%d: not deliverable", item.ID))
			continue
		}
		token := strings.TrimSpace(item.AppLineMaster.Token)
		if token == "" {
			failed = append(failed, fmt.Sprintf("id=%d: no line token", item.ID))
			continue
		}
		if err := pushLineTextMessageToTarget(token, item.SendID, msg); err != nil {
			failed = append(failed, fmt.Sprintf("id=%d: %v", item.ID, err))
			continue
		}
		sent++
	}
	if sent == 0 {
		return fmt.Errorf("all LINE targets failed: %s", strings.Join(failed, "; "))
	}
	return nil
}
