package entity

import (
	"time"

	"gorm.io/gorm"
)

// AppReportDigestSchedule is a recurring "auto report": on its schedule the
// backend generates the executive PDF report (the same one the Report page
// produces) and delivers it to the chosen channel — email or LINE. It reuses
// the manual send-to-email / send-to-LINE pipeline, just fired by a scheduler
// instead of a button.
type AppReportDigestSchedule struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"column:name;not null" json:"name"`
	// Channel is how the report is delivered: "email" | "line".
	Channel string `gorm:"column:channel;not null" json:"channel"`
	// Frequency: "weekly" | "monthly" | "yearly".
	Frequency string `gorm:"column:frequency;not null" json:"frequency"`
	Hour      int    `gorm:"column:hour;not null;default:8" json:"hour"`   // 0-23
	Minute    int    `gorm:"column:minute;not null;default:0" json:"minute"` // 0-59
	// DayOfWeek is 0=Sunday .. 6=Saturday, used when Frequency=weekly.
	DayOfWeek int `gorm:"column:day_of_week;not null;default:1" json:"day_of_week"`
	// DayOfMonth is 1-31, used when Frequency=monthly (clamped to the month's length).
	DayOfMonth int `gorm:"column:day_of_month;not null;default:1" json:"day_of_month"`
	// Month (1-12) + Day (1-31) are used when Frequency=yearly.
	Month int `gorm:"column:month;not null;default:1" json:"month"`
	Day   int `gorm:"column:day;not null;default:1" json:"day"`
	// Timezone is an IANA name (e.g. "Asia/Bangkok"); NextRunAt is computed in it.
	Timezone string `gorm:"column:timezone;not null;default:'Asia/Bangkok'" json:"timezone"`
	// EmailTo is a comma-separated list of recipient emails (Channel=email).
	EmailTo string `gorm:"column:email_to;type:text" json:"email_to"`
	// LineNotificationIDs is a comma-separated list of app_notification ids the
	// report link is pushed to (Channel=line).
	LineNotificationIDs string `gorm:"column:line_notification_ids;type:text" json:"line_notification_ids"`

	Enabled    bool       `gorm:"column:enabled;default:true" json:"enabled"`
	LastRunAt  *time.Time `gorm:"column:last_run_at" json:"last_run_at"`
	LastStatus string     `gorm:"column:last_status" json:"last_status"` // "", "ok", "failed"
	LastError  string     `gorm:"column:last_error;type:text" json:"last_error"`
	NextRunAt  *time.Time `gorm:"column:next_run_at" json:"next_run_at"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
