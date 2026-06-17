package entity

import (
	"time"

	"gorm.io/gorm"
)

type AppAssetCriticality struct {
	ID               uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	HostIP           string         `gorm:"column:host_ip;uniqueIndex;not null" json:"host_ip"`
	Criticality      string         `gorm:"column:criticality;default:'medium'" json:"criticality"` // crown_jewel, high, medium, low
	CriticalityScore int            `gorm:"column:criticality_score;default:3" json:"criticality_score"` // 1-5
	AssetType        string         `gorm:"column:asset_type;default:'server'" json:"asset_type"` // server, database, network, workstation, iot, web
	Owner            string         `gorm:"column:owner" json:"owner"`
	BusinessImpact   string         `gorm:"column:business_impact;type:text" json:"business_impact"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type AppEPSSCache struct {
	CVEID        string    `gorm:"primaryKey;column:cve_id" json:"cve_id"`
	EPSSScore    float64   `gorm:"column:epss_score;type:decimal(10,8)" json:"epss_score"`
	Percentile   float64   `gorm:"column:percentile;type:decimal(10,8)" json:"percentile"`
	ModelVersion string    `gorm:"column:model_version" json:"model_version"`
	ScoreDate    string    `gorm:"column:score_date" json:"score_date"`
	FetchedAt    time.Time `gorm:"column:fetched_at" json:"fetched_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
