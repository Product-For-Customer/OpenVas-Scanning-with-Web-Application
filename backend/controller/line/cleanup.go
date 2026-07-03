package line

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

// deleteOldHistoryNotifies hard-deletes AppHistoryNotify rows created more
// than 6 months ago. GORM soft-delete is bypassed via Unscoped so records are
// permanently removed.
func deleteOldHistoryNotifies() (int64, error) {
	db := config.DB()
	if db == nil {
		return 0, fmt.Errorf("database connection is nil")
	}

	cutoff := time.Now().AddDate(0, -6, 0)

	result := db.Unscoped().Where("created_at < ?", cutoff).Delete(&entity.AppHistoryNotify{})
	if result.Error != nil {
		return 0, result.Error
	}

	return result.RowsAffected, nil
}

// StartHistoryNotifyAutoCleanup runs a background goroutine that deletes
// notification history records older than 6 months.
// It fires once at startup (to catch any legacy data) then repeats every 24 hours.
// Call with: go line.StartHistoryNotifyAutoCleanup()
func StartHistoryNotifyAutoCleanup() {
	log.Println("✅ HistoryNotify auto-cleanup scheduler started (daily, records older than 6 months)")

	runCleanup := func(label string) {
		n, err := deleteOldHistoryNotifies()
		if err != nil {
			log.Printf("⚠️ HistoryNotify auto-cleanup [%s] error: %v\n", label, err)
			return
		}
		if n > 0 {
			log.Printf("🗑️  HistoryNotify auto-cleanup [%s]: deleted %d record(s) older than 6 months\n", label, n)
		} else {
			log.Printf("✅ HistoryNotify auto-cleanup [%s]: no records older than 6 months\n", label)
		}
	}

	// Run immediately at startup
	runCleanup("startup")

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		runCleanup("daily")
	}
}

// TriggerHistoryNotifyCleanup handles POST /history-notifies/cleanup
// Allows an admin to manually trigger the 6-month cleanup on demand.
func TriggerHistoryNotifyCleanup(c *gin.Context) {
	cutoff := time.Now().AddDate(0, -6, 0)

	deleted, err := deleteOldHistoryNotifies()
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "cleanup completed",
		"deleted_count": deleted,
		"cutoff":        cutoff.Format("2006-01-02"),
	})
}
