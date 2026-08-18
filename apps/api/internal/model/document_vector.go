package model

import (
	"time"

	"github.com/pgvector/pgvector-go"
)

// DocumentVector persists the vectorized content of a document (page block) in
// PostgreSQL so the embedding survives restarts. Zvec collections are the
// search index; this table is the source of truth for the vectors.
type DocumentVector struct {
	ID          string          `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID string          `gorm:"type:uuid;not null;index" json:"workspaceId"`
	DocumentID  string          `gorm:"type:uuid;not null;uniqueIndex" json:"documentId"`
	Title       string          `gorm:"size:500" json:"title"`
	Content     string          `gorm:"type:text" json:"content"`
	DocType     string          `gorm:"size:50" json:"docType"`
	Vector      pgvector.Vector `gorm:"type:vector" json:"-"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}
