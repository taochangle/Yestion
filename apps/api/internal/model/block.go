package model

import (
	"time"

	"gorm.io/gorm"
)

type Block struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID    *string        `gorm:"type:uuid;index" json:"parentId"`
	WorkspaceID string         `gorm:"type:uuid;index;not null" json:"workspaceId"`
	Type        string         `gorm:"size:50;not null" json:"type"`
	Properties  map[string]any `gorm:"type:jsonb;serializer:json" json:"properties"`
	Content     []string       `gorm:"type:jsonb;serializer:json" json:"content"`
	Position    int            `json:"position"`
	Version     int            `gorm:"default:1" json:"version"`
	CreatedBy   string         `gorm:"type:uuid;not null" json:"createdBy"`
	UpdatedBy   string         `gorm:"type:uuid;not null" json:"updatedBy"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
