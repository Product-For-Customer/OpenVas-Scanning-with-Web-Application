package entity

import "time"

// AppNVDCache เก็บข้อมูล CVE จาก NVD API (National Vulnerability Database)
// ดึงข้อมูลแบบ on-demand และ cache ไว้ 30 วัน
type AppNVDCache struct {
	CVEID        string     `gorm:"primaryKey;column:cve_id"`
	CVSSScore    float64    `gorm:"column:cvss_score"`
	CVSSVector   string     `gorm:"column:cvss_vector"`
	CVSSSeverity string     `gorm:"column:cvss_severity"`
	Description  string     `gorm:"column:description;type:text"`
	PublishedAt  *time.Time `gorm:"column:published_at"`
	ModifiedAt   *time.Time `gorm:"column:modified_at"`
	CWE          string     `gorm:"column:cwe"`
	References   string     `gorm:"column:references;type:text"` // JSON array of URLs
	VulnStatus   string     `gorm:"column:vuln_status"`
	FetchedAt    time.Time  `gorm:"column:fetched_at"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (AppNVDCache) TableName() string {
	return "app_nvd_caches"
}
