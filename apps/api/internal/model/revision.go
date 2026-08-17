package model

import "time"

type Revision struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BlockID   string         `gorm:"type:uuid;index;not null" json:"blockId"`
	Snapshot  map[string]any `gorm:"type:jsonb;serializer:json" json:"snapshot"`
	CreatedBy string         `gorm:"type:uuid;not null" json:"createdBy"`
	CreatedAt time.Time      `json:"createdAt"`
}
