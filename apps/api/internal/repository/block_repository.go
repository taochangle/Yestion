package repository

import (
	"context"
	"errors"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/gorm"
)

var ErrBlockNotFound = errors.New("block not found")

type BlockRepository interface {
	Create(ctx context.Context, block *model.Block) error
	FindByID(ctx context.Context, id string) (*model.Block, error)
	ListByWorkspace(ctx context.Context, workspaceID string) ([]model.Block, error)
	MaxPosition(ctx context.Context, workspaceID string, parentID *string) (int, error)
	ShiftPositions(ctx context.Context, workspaceID string, parentID *string, startPosition, delta int) error
	Update(ctx context.Context, block *model.Block) error
	Delete(ctx context.Context, id string) error
}

type blockRepository struct {
	db *gorm.DB
}

func NewBlockRepository(db *gorm.DB) BlockRepository {
	return &blockRepository{db: db}
}

func (r *blockRepository) Create(ctx context.Context, block *model.Block) error {
	return r.db.WithContext(ctx).Create(block).Error
}

func (r *blockRepository) FindByID(ctx context.Context, id string) (*model.Block, error) {
	var block model.Block
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&block).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBlockNotFound
		}
		return nil, err
	}
	return &block, nil
}

func (r *blockRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]model.Block, error) {
	var blocks []model.Block
	err := r.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("position ASC").
		Order("created_at ASC").
		Find(&blocks).Error
	return blocks, err
}

func (r *blockRepository) MaxPosition(ctx context.Context, workspaceID string, parentID *string) (int, error) {
	var position int
	query := r.db.WithContext(ctx).
		Model(&model.Block{}).
		Where("workspace_id = ?", workspaceID)
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	if err := query.Select("COALESCE(MAX(position), 0)").Scan(&position).Error; err != nil {
		return 0, err
	}
	return position, nil
}

func (r *blockRepository) ShiftPositions(ctx context.Context, workspaceID string, parentID *string, startPosition, delta int) error {
	query := r.db.WithContext(ctx).
		Model(&model.Block{}).
		Where("workspace_id = ?", workspaceID).
		Where("position >= ?", startPosition)
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	return query.UpdateColumn("position", gorm.Expr("position + ?", delta)).Error
}

func (r *blockRepository) Update(ctx context.Context, block *model.Block) error {
	return r.db.WithContext(ctx).Save(block).Error
}

func (r *blockRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Block{}).Error
}
