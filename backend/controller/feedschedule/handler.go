package feedschedule

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

// ── Feed type constants ──────────────────────────────────────────────────────
const (
	FeedOpenVAS = "openvas"
	FeedKEV     = "kev"
	FeedEPSS    = "epss"
)

var defaultSchedules = []entity.FeedUpdateSchedule{
	{FeedType: FeedOpenVAS, Frequency: "daily", Hour: 2,  Minute: 0, DayOfMonth: 1, Month: 1, Day: 1, Enabled: true},
	{FeedType: FeedKEV,     Frequency: "daily", Hour: 3,  Minute: 0, DayOfMonth: 1, Month: 1, Day: 1, Enabled: true},
	{FeedType: FeedEPSS,    Frequency: "daily", Hour: 4,  Minute: 30,DayOfMonth: 1, Month: 1, Day: 1, Enabled: true},
}

// ── DTO ──────────────────────────────────────────────────────────────────────

type ScheduleDTO struct {
	ID         uint    `json:"id"`
	FeedType   string  `json:"feed_type"`
	Frequency  string  `json:"frequency"`
	Hour       int     `json:"hour"`
	Minute     int     `json:"minute"`
	DayOfMonth int     `json:"day_of_month"`
	Month      int     `json:"month"`
	Day        int     `json:"day"`
	Enabled    bool    `json:"enabled"`
	LastRunAt  *string `json:"last_run_at,omitempty"`
	NextRunAt  *string `json:"next_run_at,omitempty"`
}

type UpdateScheduleRequest struct {
	Frequency  string `json:"frequency"`
	Hour       *int   `json:"hour"`
	Minute     *int   `json:"minute"`
	DayOfMonth *int   `json:"day_of_month"`
	Month      *int   `json:"month"`
	Day        *int   `json:"day"`
	Enabled    *bool  `json:"enabled"`
}

func toDTO(s entity.FeedUpdateSchedule) ScheduleDTO {
	d := ScheduleDTO{
		ID: s.ID, FeedType: s.FeedType, Frequency: s.Frequency,
		Hour: s.Hour, Minute: s.Minute, DayOfMonth: s.DayOfMonth,
		Month: s.Month, Day: s.Day, Enabled: s.Enabled,
	}
	if s.LastRunAt != nil {
		str := s.LastRunAt.Format(time.RFC3339)
		d.LastRunAt = &str
	}
	if s.NextRunAt != nil {
		str := s.NextRunAt.Format(time.RFC3339)
		d.NextRunAt = &str
	}
	return d
}

// ── Seed default schedules if none exist ─────────────────────────────────────

func SeedDefaultSchedules() {
	db := config.DB()
	if db == nil {
		return
	}
	for _, def := range defaultSchedules {
		var existing entity.FeedUpdateSchedule
		if err := db.Where("feed_type = ?", def.FeedType).First(&existing).Error; err != nil {
			// Create with computed next run
			next := computeNextRun(def.Frequency, def.Hour, def.Minute, def.DayOfMonth, def.Month, def.Day)
			def.NextRunAt = next
			db.Create(&def)
			log.Printf("✅ FeedSchedule seeded: %s daily at %02d:%02d\n", def.FeedType, def.Hour, def.Minute)
		}
	}
}

// ── Next-run computation ─────────────────────────────────────────────────────

func computeNextRun(freq string, hour, minute, dayOfMonth, month, day int) *time.Time {
	now := time.Now()
	loc := now.Location()

	switch freq {
	case "daily":
		d := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, loc)
		if !d.After(now) {
			d = d.Add(24 * time.Hour)
		}
		return &d

	case "monthly":
		d := time.Date(now.Year(), now.Month(), dayOfMonth, hour, minute, 0, 0, loc)
		if !d.After(now) {
			d = d.AddDate(0, 1, 0)
		}
		return &d

	case "yearly":
		d := time.Date(now.Year(), time.Month(month), day, hour, minute, 0, 0, loc)
		if !d.After(now) {
			d = d.AddDate(1, 0, 0)
		}
		return &d
	}
	return nil
}

// ── HTTP Handlers ─────────────────────────────────────────────────────────────

// GET /feed-schedules
func ListSchedules(c *gin.Context) {
	db := config.DB()
	var list []entity.FeedUpdateSchedule
	db.Order("feed_type ASC").Find(&list)
	dtos := make([]ScheduleDTO, 0, len(list))
	for _, s := range list {
		dtos = append(dtos, toDTO(s))
	}
	c.JSON(http.StatusOK, dtos)
}

// PUT /feed-schedules/:feed_type
func UpdateSchedule(c *gin.Context) {
	feedType := strings.TrimSpace(c.Param("feed_type"))
	if feedType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feed_type required"})
		return
	}

	var req UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()
	var s entity.FeedUpdateSchedule
	if err := db.Where("feed_type = ?", feedType).First(&s).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found for feed_type: " + feedType})
		return
	}

	if req.Frequency != ""  { s.Frequency  = req.Frequency  }
	if req.Hour       != nil { s.Hour       = *req.Hour       }
	if req.Minute     != nil { s.Minute     = *req.Minute     }
	if req.DayOfMonth != nil { s.DayOfMonth = *req.DayOfMonth }
	if req.Month      != nil { s.Month      = *req.Month      }
	if req.Day        != nil { s.Day        = *req.Day        }
	if req.Enabled    != nil { s.Enabled    = *req.Enabled    }

	// Recompute next run
	next := computeNextRun(s.Frequency, s.Hour, s.Minute, s.DayOfMonth, s.Month, s.Day)
	s.NextRunAt = next

	db.Save(&s)
	audit.Log(c, "feed_schedule.updated", "feed_schedule", feedType, fmt.Sprintf("updated %s feed schedule (freq=%s, enabled=%t)", feedType, s.Frequency, s.Enabled))
	c.JSON(http.StatusOK, toDTO(s))
}

// POST /feed-schedules/:feed_type/trigger  — manual trigger
func TriggerFeedNow(c *gin.Context) {
	feedType := strings.TrimSpace(c.Param("feed_type"))
	if err := triggerFeedUpdate(feedType); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "feed_schedule.triggered", "feed_schedule", feedType, fmt.Sprintf("manually triggered %s feed update", feedType))
	c.JSON(http.StatusOK, gin.H{"message": "Feed update triggered: " + feedType})
}

// ── Background Scheduler ──────────────────────────────────────────────────────

func StartFeedUpdateScheduler() {
	SeedDefaultSchedules()
	log.Println("🕑 FeedUpdate scheduler started — checking every minute")
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		runDueFeedSchedules()
	}
}

func runDueFeedSchedules() {
	db := config.DB()
	if db == nil {
		return
	}
	var schedules []entity.FeedUpdateSchedule
	db.Where("enabled = true AND next_run_at IS NOT NULL AND next_run_at <= ?", time.Now()).Find(&schedules)
	for _, s := range schedules {
		s := s
		go executeFeedSchedule(s)
	}
}

func executeFeedSchedule(s entity.FeedUpdateSchedule) {
	db := config.DB()
	log.Printf("🔄 Auto feed update triggered: %s (freq=%s)\n", s.FeedType, s.Frequency)

	if err := triggerFeedUpdate(s.FeedType); err != nil {
		log.Printf("❌ Feed update failed: %s — %v\n", s.FeedType, err)
	} else {
		log.Printf("✅ Feed update done: %s\n", s.FeedType)
	}

	now := time.Now()
	s.LastRunAt = &now
	next := computeNextRun(s.Frequency, s.Hour, s.Minute, s.DayOfMonth, s.Month, s.Day)
	s.NextRunAt = next

	if err := db.Save(&s).Error; err != nil {
		log.Printf("⚠️ FeedSchedule save error: %v\n", err)
	}
}

// triggerFeedUpdate calls the appropriate backend endpoint for each feed type
func triggerFeedUpdate(feedType string) error {
	port := getEnv("PORT", "9000")

	switch feedType {
	case FeedOpenVAS:
		token := getEnv("AUTOMATION_TOKEN", "dev-automation-token")
		payload, _ := json.Marshal(map[string]interface{}{
			"triggered_by": "scheduler",
			"source":       "feed_schedule_config",
			"force":        false,
		})
		req, err := http.NewRequest(http.MethodPost,
			fmt.Sprintf("http://127.0.0.1:%s/automation/feed/update", port),
			bytes.NewBuffer(payload),
		)
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Automation-Token", token)
		client := &http.Client{Timeout: 130 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("send request: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return fmt.Errorf("server returned %d", resp.StatusCode)
		}

	case FeedKEV:
		resp, err := http.Post(
			fmt.Sprintf("http://127.0.0.1:%s/threats/kev/sync", port),
			"application/json", nil,
		)
		if err != nil {
			return fmt.Errorf("kev sync: %w", err)
		}
		defer resp.Body.Close()

	case FeedEPSS:
		resp, err := http.Post(
			fmt.Sprintf("http://127.0.0.1:%s/risk/epss/sync", port),
			"application/json", nil,
		)
		if err != nil {
			return fmt.Errorf("epss sync: %w", err)
		}
		defer resp.Body.Close()

	default:
		return fmt.Errorf("unknown feed type: %s", feedType)
	}
	return nil
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

// dummy suppress
var _ = strconv.Itoa
