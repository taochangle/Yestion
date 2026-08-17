package repository

import (
	"context"
	"errors"

	"github.com/my-notion/notionclone/api/internal/model"
	"gorm.io/gorm"
)

var ErrShareNotFound = errors.New("share not found")

type ShareRepository interface {
	Create(ctx context.Context, share *model.Share) error
	FindByID(ctx context.Context, id string) (*model.Share, error)
	FindByToken(ctx context.Context, token string) (*model.Share, error)
	ListByBlock(ctx context.Context, blockID string) ([]model.Share, error)
	Delete(ctx context.Context, id string) error
}

type shareRepository struct {
	db *gorm.DB
}

func NewShareRepository(db *gorm.DB) ShareRepository {
	return &shareRepository{db: db}
}

func (r *shareRepository) Create(ctx context.Context, share *model.Share) error {
	return r.db.WithContext(ctx).Create(share).Error
}

func (r *shareRepository) FindByID(ctx context.Context, id string) (*model.Share, error) {
	var share model.Share
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&share).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
		}
		return nil, err
	}
	return &share, nil
}

func (r *shareRepository) FindByToken(ctx context.Context, token string) (*model.Share, error) {
	var share model.Share
	if err := r.db.WithContext(ctx).Where("token = ?", token).First(&share).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
		}
		return nil, err
	}
	return &share, nil
}

func (r *shareRepository) ListByBlock(ctx context.Context, blockID string) ([]model.Share, error) {
	var shares []model.Share
	err := r.db.WithContext(ctx).
		Where("block_id = ?", blockID).
		Order("created_at DESC").
		Find(&shares).Error
	return shares, err
}

func (r *shareRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Share{}).Error
}
