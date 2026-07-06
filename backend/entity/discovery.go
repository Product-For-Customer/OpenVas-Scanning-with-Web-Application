package entity

import (
	"time"

	"gorm.io/gorm"
)

// AppDiscoveredHost tracks every IP address a network discovery (Nmap) scan
// has ever seen alive, independent of whether it's a known OpenVAS scan
// target. One row per IP, upserted on every scan — a host with
// IsKnownTarget=false and a recent FirstSeenAt is exactly the "unexpected
// device just joined the network" signal this feature exists to surface.
type AppDiscoveredHost struct {
	ID            uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	IPAddress     string         `gorm:"column:ip_address;uniqueIndex;not null" json:"ip_address"`
	Hostname      string         `gorm:"column:hostname" json:"hostname"`
	OpenPorts     string         `gorm:"column:open_ports;type:text" json:"open_ports"` // comma-separated, e.g. "22,80,443"
	IsKnownTarget bool           `gorm:"column:is_known_target;default:false" json:"is_known_target"`
	Acknowledged  bool           `gorm:"column:acknowledged;default:false" json:"acknowledged"`
	FirstSeenAt   time.Time      `gorm:"column:first_seen_at" json:"first_seen_at"`
	LastSeenAt    time.Time      `gorm:"column:last_seen_at" json:"last_seen_at"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
