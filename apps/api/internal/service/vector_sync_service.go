package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
	"github.com/pgvector/pgvector-go"
	"gorm.io/gorm"
)

// VectorIndexService keeps Zvec collections and the document_vectors table in
// sync with workspace and document (block) lifecycle events.
type VectorIndexService interface {
	EnsureWorkspace(ctx context.Context, workspaceID string) error
	DestroyWorkspace(ctx context.Context, workspaceID string) error
	SyncBlock(ctx context.Context, blockID string) error
	DeleteBlock(ctx context.Context, workspaceID, blockID string) error
	Search(ctx context.Context, workspaceID, query string, topK int) ([]ZVecHit, error)
}

type vectorIndexService struct {
	db     *gorm.DB
	blocks repository.BlockRepository
	zvec   *ZVecClient
}

func NewVectorIndexService(db *gorm.DB, blocks repository.BlockRepository, zvec *ZVecClient) VectorIndexService {
	return &vectorIndexService{db: db, blocks: blocks, zvec: zvec}
}

func (s *vectorIndexService) EnsureWorkspace(ctx context.Context, workspaceID string) error {
	return s.zvec.EnsureCollection(ctx, workspaceID)
}

func (s *vectorIndexService) DestroyWorkspace(ctx context.Context, workspaceID string) error {
	if err := s.zvec.DestroyCollection(ctx, workspaceID); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Where("workspace_id = ?", workspaceID).Delete(&model.DocumentVector{}).Error
}

func (s *vectorIndexService) SyncBlock(ctx context.Context, blockID string) error {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return err
	}

	title := strings.TrimSpace(propertyString(block.Properties["title"]))
	content := strings.TrimSpace(blockPlainText(block))
	if title == "" && content == "" {
		return s.DeleteBlock(ctx, block.WorkspaceID, blockID)
	}

	embedding, err := s.zvec.UpsertDocument(ctx, block.WorkspaceID, block.ID, title, content, block.Type)
	if err != nil {
		return err
	}

	row := &model.DocumentVector{
		ID:          uuid.NewString(),
		WorkspaceID: block.WorkspaceID,
		DocumentID:  block.ID,
		Title:       title,
		Content:     content,
		DocType:     block.Type,
		Vector:      pgvector.NewVector(embedding),
		UpdatedAt:   time.Now(),
	}

	var existing model.DocumentVector
	err = s.db.WithContext(ctx).Where("document_id = ?", block.ID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.db.WithContext(ctx).Create(row).Error
	}
	if err != nil {
		return err
	}
	row.ID = existing.ID
	return s.db.WithContext(ctx).Save(row).Error
}

func (s *vectorIndexService) DeleteBlock(ctx context.Context, workspaceID, blockID string) error {
	if err := s.zvec.DeleteDocument(ctx, workspaceID, blockID); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Where("document_id = ?", blockID).Delete(&model.DocumentVector{}).Error
}

func (s *vectorIndexService) Search(ctx context.Context, workspaceID, query string, topK int) ([]ZVecHit, error) {
	return s.zvec.Search(ctx, workspaceID, query, topK)
}

// blockPlainText extracts readable text from a block's TipTap JSON content.
func blockPlainText(block *model.Block) string {
	var builder strings.Builder
	flattenContent(block.Properties["content"], &builder)
	return strings.TrimSpace(builder.String())
}

func flattenContent(value any, builder *strings.Builder) {
	switch typed := value.(type) {
	case map[string]any:
		if text, ok := typed["text"].(string); ok && text != "" {
			builder.WriteString(text)
			builder.WriteString("\n")
		}
		if content, ok := typed["content"].([]any); ok {
			for _, child := range content {
				flattenContent(child, builder)
			}
		}
	case []any:
		for _, child := range typed {
			flattenContent(child, builder)
		}
	case []string:
		for _, item := range typed {
			builder.WriteString(item)
			builder.WriteString("\n")
		}
	case string:
		builder.WriteString(typed)
		builder.WriteString("\n")
	}
}
