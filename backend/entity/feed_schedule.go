package entity

import "time"

// FeedUpdateSchedule เก็บ config ตารางเวลา auto-update สำหรับแต่ละ feed type
type FeedUpdateSchedule struct {
	ID         uint       `gorm:"primaryKey;autoIncrement"`
	FeedType   string     `gorm:"column:feed_type;uniqueIndex;not null"` // "openvas" | "kev" | "epss"
	Frequency  string     `gorm:"column:frequency;not null;default:'daily'"` // daily | monthly | yearly
	Hour       int        `gorm:"column:hour;not null;default:2"`             // 0-23
	Minute     int        `gorm:"column:minute;not null;default:0"`           // 0-59
	DayOfMonth int        `gorm:"column:day_of_month;not null;default:1"`     // 1-31 (for monthly)
	Month      int        `gorm:"column:month;not null;default:1"`            // 1-12 (for yearly)
	Day        int        `gorm:"column:day;not null;default:1"`              // 1-31 (for yearly)
	Enabled    bool       `gorm:"column:enabled;default:true"`
	LastRunAt  *time.Time `gorm:"column:last_run_at"`
	NextRunAt  *time.Time `gorm:"column:next_run_at"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (FeedUpdateSchedule) TableName() string {
	return "feed_update_schedules"
}
