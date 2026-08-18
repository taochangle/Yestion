package model

import "time"

type ChatConversation struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID string    `gorm:"type:uuid;not null;index" json:"workspaceId"`
	Title       string    `gorm:"size:255;not null" json:"title"`
	CreatedBy   string    `gorm:"type:uuid;not null" json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ChatMessage struct {
	ID             string    `gorm:"type:uuid;primaryKey" json:"id"`
	ConversationID string    `gorm:"type:uuid;not null;index" json:"conversationId"`
	Role           string    `gorm:"size:20;not null" json:"role"`
	Content        string    `gorm:"type:text" json:"content"`
	Reasoning      string    `gorm:"type:text" json:"reasoning"`
	CreatedAt      time.Time `json:"createdAt"`
}
