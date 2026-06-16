package entity

import "time"

// AppKEVCache เก็บข้อมูล CISA KEV Catalog (Known Exploited Vulnerabilities)
// ซิงค์จาก https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
type AppKEVCache struct {
	CVEID                      string     `gorm:"primaryKey;column:cve_id"`
	VendorProject              string     `gorm:"column:vendor_project"`
	Product                    string     `gorm:"column:product"`
	VulnerabilityName          string     `gorm:"column:vulnerability_name"`
	DateAdded                  time.Time  `gorm:"column:date_added"`
	ShortDescription           string     `gorm:"column:short_description;type:text"`
	RequiredAction             string     `gorm:"column:required_action;type:text"`
	DueDate                    *time.Time `gorm:"column:due_date"`
	KnownRansomwareCampaignUse string     `gorm:"column:known_ransomware_campaign_use"`
	Notes                      string     `gorm:"column:notes;type:text"`
	LastSyncedAt               time.Time  `gorm:"column:last_synced_at"`
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

func (AppKEVCache) TableName() string {
	return "app_kev_caches"
}
