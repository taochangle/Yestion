package model

import "time"

type Workspace struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Icon      string    `gorm:"size:50" json:"icon"`
	OwnerID   string    `gorm:"type:uuid;not null;index" json:"ownerId"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type WorkspaceMember struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID string    `gorm:"type:uuid;uniqueIndex:idx_workspace_user;not null" json:"workspaceId"`
	UserID      string    `gorm:"type:uuid;uniqueIndex:idx_workspace_user;not null" json:"userId"`
	Role        string    `gorm:"size:20;not null;default:member" json:"role"`
	CreatedAt   time.Time `json:"createdAt"`
	User        User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
