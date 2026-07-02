package setting

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────────
// In-memory timezone cache — avoids a DB hit on every SQL call
// ─────────────────────────────────────────────────────────────

var (
	tzMu     sync.RWMutex
	tzCached = "Asia/Bangkok" // default until loaded from DB
)

// InitTimezoneCache loads the global app timezone from SystemConfig at startup.
func InitTimezoneCache() {
	db := config.DB()
	if db == nil {
		return
	}
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", "timezone").First(&cfg).Error; err == nil {
		tzMu.Lock()
		tzCached = cfg.Value
		tzMu.Unlock()
		log.Printf("✅ App timezone loaded: %s", cfg.Value)
	}
}

// GetAppTimezone returns the current global app timezone (thread-safe).
func GetAppTimezone() string {
	tzMu.RLock()
	defer tzMu.RUnlock()
	return tzCached
}

func setTimezoneCache(tz string) {
	tzMu.Lock()
	tzCached = tz
	tzMu.Unlock()
}

// ─────────────────────────────────────────────────────────────
// Maintenance mode
// ─────────────────────────────────────────────────────────────

const (
	maintenanceKey          = "argus_maintenance_mode"
	maintenanceActiveAtKey  = "argus_maintenance_active_at"
	maintenanceGraceSeconds = 60
)

// upsertMaintenanceActiveAt writes/refreshes the Unix timestamp at which
// the auth middleware should start blocking non-admin requests
// (now + maintenanceGraceSeconds). This gives the frontend countdown modal
// time to auto-logout the user before the backend starts rejecting calls.
func upsertMaintenanceActiveAt(db *gorm.DB) {
	activeAt := strconv.FormatInt(time.Now().Add(maintenanceGraceSeconds*time.Second).Unix(), 10)

	var cfg entity.SystemConfig
	if err := db.Where("key = ?", maintenanceActiveAtKey).First(&cfg).Error; err != nil {
		db.Create(&entity.SystemConfig{Key: maintenanceActiveAtKey, Value: activeAt})
		return
	}
	cfg.Value = activeAt
	db.Save(&cfg)
}

// GetMaintenanceStatus godoc
// GET /maintenance/status — public, no auth required. Polled by the
// frontend so non-admin users can see the auto-logout countdown.
func GetMaintenanceStatus(c *gin.Context) {
	db := config.DB()

	var cfg entity.SystemConfig
	if err := db.Where("key = ?", maintenanceKey).First(&cfg).Error; err != nil || cfg.Value != "true" {
		c.JSON(http.StatusOK, gin.H{"enabled": false, "seconds_remaining": 0})
		return
	}

	secondsRemaining := 0
	var activeCfg entity.SystemConfig
	if err := db.Where("key = ?", maintenanceActiveAtKey).First(&activeCfg).Error; err == nil {
		if activeAt, err := strconv.ParseInt(activeCfg.Value, 10, 64); err == nil {
			if rem := int(activeAt - time.Now().Unix()); rem > 0 {
				secondsRemaining = rem
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"enabled": true, "seconds_remaining": secondsRemaining})
}

// ─────────────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────────────

// GetSettings godoc
// GET /settings → { "timezone": "Asia/Bangkok", ... }
func GetSettings(c *gin.Context) {
	db := config.DB()
	var rows []entity.SystemConfig
	db.Find(&rows)

	result := make(map[string]string, len(rows))
	for _, r := range rows {
		result[r.Key] = r.Value
	}
	c.JSON(http.StatusOK, result)
}

// UpdateSetting godoc
// PUT /settings  body: { "key": "timezone", "value": "Asia/Bangkok" }
func UpdateSetting(c *gin.Context) {
	var body struct {
		Key   string `json:"key"   binding:"required"`
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate timezone if that's what's being set
	if body.Key == "timezone" {
		if _, err := time.LoadLocation(body.Value); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid IANA timezone: " + body.Value})
			return
		}
	}

	db := config.DB()
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", body.Key).First(&cfg).Error; err != nil {
		cfg = entity.SystemConfig{Key: body.Key, Value: body.Value}
		if err2 := db.Create(&cfg).Error; err2 != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
			return
		}
	} else {
		cfg.Value = body.Value
		if err2 := db.Save(&cfg).Error; err2 != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
			return
		}
	}

	// Update in-memory cache and recalculate all schedule next_run_at
	if body.Key == "timezone" {
		setTimezoneCache(body.Value)
		go recalculateAllSchedules(body.Value)
	}

	// Turning maintenance mode on (re)starts the grace period, giving the
	// frontend countdown modal time to auto-logout non-admin users before
	// the auth middleware starts rejecting their requests with 503.
	if body.Key == maintenanceKey && body.Value == "true" {
		upsertMaintenanceActiveAt(db)
	}

	c.JSON(http.StatusOK, gin.H{"key": cfg.Key, "value": cfg.Value})
}

// recalculateAllSchedules updates next_run_at for all enabled auto scan schedules
// using the new timezone. Called asynchronously after timezone change.
func recalculateAllSchedules(newTZ string) {
	loc, err := time.LoadLocation(newTZ)
	if err != nil {
		log.Printf("⚠️ recalculateAllSchedules: invalid tz %q: %v", newTZ, err)
		return
	}

	db := config.DB()
	var schedules []entity.AutoScanSchedule
	if err := db.Where("enabled = true AND next_run_at IS NOT NULL").Find(&schedules).Error; err != nil {
		log.Printf("⚠️ recalculateAllSchedules: query error: %v", err)
		return
	}

	for _, s := range schedules {
		var schedAtStr *string
		if s.ScheduleAt != nil {
			str := s.ScheduleAt.Format("2006-01-02")
			schedAtStr = &str
		}
		next := calcNextRun(s.Frequency, s.ScanTime, loc, schedAtStr, s.DayOfMonth, s.Month, s.Day)
		s.Timezone = newTZ
		s.NextRunAt = next
		if err2 := db.Save(&s).Error; err2 != nil {
			log.Printf("⚠️ recalculateAllSchedules: save error id=%d: %v", s.ID, err2)
		}
	}
	log.Printf("✅ Recalculated %d schedule(s) for timezone %s", len(schedules), newTZ)
}

// calcNextRun is a shared helper (mirrors schedule/handler logic) to avoid circular import.
func calcNextRun(freq, scanTime string, loc *time.Location, scheduleAt *string, dayOfMonth, month, day *int) *time.Time {
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
