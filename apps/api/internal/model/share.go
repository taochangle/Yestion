package model

import "time"

type Share struct {
	ID         string     `gorm:"type:uuid;primaryKey" json:"id"`
	BlockID    string     `gorm:"type:uuid;index;not null" json:"blockId"`
	Token      string     `gorm:"size:255;uniqueIndex;not null" json:"token"`
	Permission string     `gorm:"size:20;not null;default:read" json:"permission"`
	ExpiresAt  *time.Time `json:"expiresAt"`
	CreatedBy  string     `gorm:"type:uuid;not null" json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}
