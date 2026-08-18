package model

import "time"

type ChatConversation struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID *string   `gorm:"type:uuid;index" json:"workspaceId"`
	Title       string    `gorm:"size:255;not null" json:"title"`
	CreatedBy   string    `gorm:"type:uuid;not null;index" json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ChatMessage struct {
	ID             string       `gorm:"type:uuid;primaryKey" json:"id"`
	ConversationID string       `gorm:"type:uuid;not null;index" json:"conversationId"`
	Role           string       `gorm:"size:20;not null" json:"role"`
	Content        string       `gorm:"type:text" json:"content"`
	Reasoning      string       `gorm:"type:text" json:"reasoning"`
	Sources        []ChatSource `gorm:"type:jsonb;serializer:json" json:"sources"`
	CreatedAt      time.Time    `json:"createdAt"`
}

type ChatSource struct {
	DocumentID string  `json:"documentId"`
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	DocType    string  `json:"type"`
	Score      float64 `json:"score"`
}
