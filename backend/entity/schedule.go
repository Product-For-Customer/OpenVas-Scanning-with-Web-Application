package entity

import "time"

// AutoScanSchedule เก็บตารางเวลา auto scan ที่ผู้ใช้ตั้งไว้
type AutoScanSchedule struct {
	ID         uint       `gorm:"primaryKey;autoIncrement"`
	TaskID     string     `gorm:"column:task_id;not null"`
	TaskName   string     `gorm:"column:task_name"`
	Frequency  string     `gorm:"column:frequency;not null"` // once | monthly | yearly
	ScanTime   string     `gorm:"column:scan_time;not null"` // "HH:mm" 24-hr
	ScheduleAt *time.Time `gorm:"column:schedule_at"`        // for "once" — full datetime
	DayOfMonth *int       `gorm:"column:day_of_month"`       // for "monthly" (1-31)
	Month      *int       `gorm:"column:month"`              // for "yearly" (1-12)
	Day        *int       `gorm:"column:day"`                // for "yearly" (1-31)
	Enabled    bool       `gorm:"column:enabled;default:true"`
	LastRunAt  *time.Time `gorm:"column:last_run_at"`
	NextRunAt  *time.Time `gorm:"column:next_run_at"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (AutoScanSchedule) TableName() string {
	return "auto_scan_schedules"
}
