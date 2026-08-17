package repository

import (
	"context"
	"errors"

	"github.com/my-notion/notionclone/api/internal/model"
	"gorm.io/gorm"
)

var (
	ErrWorkspaceNotFound = errors.New("workspace not found")
	ErrMemberNotFound    = errors.New("workspace member not found")
)

type WorkspaceRepository interface {
	Create(ctx context.Context, workspace *model.Workspace) error
	FindByID(ctx context.Context, id string) (*model.Workspace, error)
	ListByUser(ctx context.Context, userID string) ([]model.Workspace, error)
	Update(ctx context.Context, workspace *model.Workspace) error
	DeleteWorkspace(ctx context.Context, id string) error
	CreateMember(ctx context.Context, member *model.WorkspaceMember) error
	FindMember(ctx context.Context, workspaceID, userID string) (*model.WorkspaceMember, error)
	ListMembers(ctx context.Context, workspaceID string) ([]model.WorkspaceMember, error)
	UpdateMemberRole(ctx context.Context, workspaceID, userID, role string) error
	DeleteMember(ctx context.Context, workspaceID, userID string) error
}

type workspaceRepository struct {
	db *gorm.DB
}

func NewWorkspaceRepository(db *gorm.DB) WorkspaceRepository {
	return &workspaceRepository{db: db}
}

func (r *workspaceRepository) Create(ctx context.Context, workspace *model.Workspace) error {
	return r.db.WithContext(ctx).Create(workspace).Error
}

func (r *workspaceRepository) FindByID(ctx context.Context, id string) (*model.Workspace, error) {
	var workspace model.Workspace
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&workspace).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}
	return &workspace, nil
}

func (r *workspaceRepository) ListByUser(ctx context.Context, userID string) ([]model.Workspace, error) {
	var workspaces []model.Workspace
	err := r.db.WithContext(ctx).
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ?", userID).
		Order("workspaces.created_at DESC").
		Find(&workspaces).Error
	return workspaces, err
}

func (r *workspaceRepository) Update(ctx context.Context, workspace *model.Workspace) error {
	return r.db.WithContext(ctx).Save(workspace).Error
}

func (r *workspaceRepository) DeleteWorkspace(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("workspace_id = ?", id).Delete(&model.WorkspaceMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("workspace_id = ?", id).Delete(&model.Block{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&model.Workspace{}).Error
	})
}

func (r *workspaceRepository) CreateMember(ctx context.Context, member *model.WorkspaceMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *workspaceRepository) FindMember(ctx context.Context, workspaceID, userID string) (*model.WorkspaceMember, error) {
	var member model.WorkspaceMember
	if err := r.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrMemberNotFound
		}
		return nil, err
	}
	return &member, nil
}

func (r *workspaceRepository) ListMembers(ctx context.Context, workspaceID string) ([]model.WorkspaceMember, error) {
	var members []model.WorkspaceMember
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("workspace_id = ?", workspaceID).
		Order("created_at ASC").
		Find(&members).Error
	return members, err
}

func (r *workspaceRepository) UpdateMemberRole(ctx context.Context, workspaceID, userID, role string) error {
	return r.db.WithContext(ctx).
		Model(&model.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Update("role", role).Error
}

func (r *workspaceRepository) DeleteMember(ctx context.Context, workspaceID, userID string) error {
	return r.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&model.WorkspaceMember{}).Error
}
