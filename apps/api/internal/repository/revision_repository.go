package repository

import (
	"context"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/gorm"
)

type RevisionRepository interface {
	Create(ctx context.Context, revision *model.Revision) error
	ListByBlock(ctx context.Context, blockID string, limit int) ([]model.Revision, error)
}

type revisionRepository struct {
	db *gorm.DB
}

func NewRevisionRepository(db *gorm.DB) RevisionRepository {
	return &revisionRepository{db: db}
}

func (r *revisionRepository) Create(ctx context.Context, revision *model.Revision) error {
	return r.db.WithContext(ctx).Create(revision).Error
}

func (r *revisionRepository) ListByBlock(ctx context.Context, blockID string, limit int) ([]model.Revision, error) {
	if limit <= 0 {
		limit = 50
	}
	var revisions []model.Revision
	err := r.db.WithContext(ctx).
		Where("block_id = ?", blockID).
		Order("created_at DESC").
		Limit(limit).
		Find(&revisions).Error
	return revisions, err
}
