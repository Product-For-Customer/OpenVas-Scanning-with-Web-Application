package entity

import "time"

// AppEOLCache caches one product's end-of-life dataset as served by
// endoflife.date's public API (https://endoflife.date/api/<product>.json).
//
// The technology-fingerprint feature uses this to flag outdated / unsupported
// software without hitting the external API on every page load: rows are read
// from here first and only refreshed from the network when older than the
// feature's TTL. One row per product slug.
type AppEOLCache struct {
	ID      uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Product string `gorm:"column:product;uniqueIndex;not null" json:"product"`
	// Data is the raw JSON array endoflife.date returns for this product; each
	// element is one release cycle carrying its `cycle`, `eol` and `latest`
	// fields. Stored opaquely and parsed by the fingerprint controller.
	Data      string    `gorm:"column:data;type:text" json:"-"`
	FetchedAt time.Time `gorm:"column:fetched_at" json:"fetched_at"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
