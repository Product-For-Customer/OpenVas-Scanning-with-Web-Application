package entity

import "time"

// AppNVDCache เก็บข้อมูล CVE จาก NVD API (National Vulnerability Database)
// ดึงข้อมูลแบบ on-demand และ cache ไว้ 30 วัน
// AutoMigrate จะสร้าง / เพิ่ม column ใหม่อัตโนมัติ
type AppNVDCache struct {
	CVEID        string     `gorm:"primaryKey;column:cve_id"`
	VulnStatus   string     `gorm:"column:vuln_status"`
	Description  string     `gorm:"column:description;type:text"`
	CWE          string     `gorm:"column:cwe"`

	// CVSS v3.x (v3.1 preferred over v3.0)
	CVSSScore    float64    `gorm:"column:cvss_score"`
	CVSSVector   string     `gorm:"column:cvss_vector"`
	CVSSSeverity string     `gorm:"column:cvss_severity"`

	// CVSS v2.0
	CVSSV2Score    float64 `gorm:"column:cvss_v2_score"`
	CVSSV2Vector   string  `gorm:"column:cvss_v2_vector"`
	CVSSV2Severity string  `gorm:"column:cvss_v2_severity"`

	// CPE — JSON array of CPE URIs (affected products)
	CPE string `gorm:"column:cpe;type:text"`

	References  string     `gorm:"column:references;type:text"` // JSON array of URLs
	PublishedAt *time.Time `gorm:"column:published_at"`
	ModifiedAt  *time.Time `gorm:"column:modified_at"`
	FetchedAt   time.Time  `gorm:"column:fetched_at"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (AppNVDCache) TableName() string {
	return "app_nvd_caches"
}
