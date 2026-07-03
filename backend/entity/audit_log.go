package entity

import "gorm.io/gorm"

// AuditLog records high-risk write actions (role changes, user/target/schedule
// deletion, settings/LINE-master changes) for accountability. Populated by
// the audit package, never written to directly by controllers.
type AuditLog struct {
	gorm.Model
	ActorID    uint   `json:"actor_id"`
	ActorEmail string `json:"actor_email"`
	ActorRole  string `json:"actor_role"`
	Action     string `json:"action" gorm:"index"`
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
	Detail     string `json:"detail" gorm:"type:text"`
	IPAddress  string `json:"ip_address"`
}
