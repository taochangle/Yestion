package repository

import (
	"context"
	"errors"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/gorm"
)

var ErrTemplateNotFound = errors.New("template not found")

type TemplateRepository interface {
	Create(ctx context.Context, template *model.Template) error
	FindByID(ctx context.Context, id string) (*model.Template, error)
	ListByWorkspace(ctx context.Context, workspaceID string) ([]model.Template, error)
	Delete(ctx context.Context, id string) error
}

type templateRepository struct {
	db *gorm.DB
}

func NewTemplateRepository(db *gorm.DB) TemplateRepository {
	return &templateRepository{db: db}
}

func (r *templateRepository) Create(ctx context.Context, template *model.Template) error {
	return r.db.WithContext(ctx).Create(template).Error
}

func (r *templateRepository) FindByID(ctx context.Context, id string) (*model.Template, error) {
	var template model.Template
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&template).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	return &template, nil
}

func (r *templateRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]model.Template, error) {
	var templates []model.Template
	err := r.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&templates).Error
	return templates, err
}

func (r *templateRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Template{}).Error
}
