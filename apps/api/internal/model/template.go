package model

import "time"

type Template struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID string         `gorm:"type:uuid;index;not null" json:"workspaceId"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	BlockType   string         `gorm:"size:50;not null;default:page" json:"blockType"`
	Properties  map[string]any `gorm:"type:jsonb;serializer:json" json:"properties"`
	Content     map[string]any `gorm:"type:jsonb;serializer:json" json:"content"`
	CreatedBy   string         `gorm:"type:uuid;not null" json:"createdBy"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}
