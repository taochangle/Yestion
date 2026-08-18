package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
)

var (
	ErrForbidden          = errors.New("you do not have access to this workspace")
	ErrInvalidRole        = errors.New("invalid workspace role")
	ErrAlreadyMember      = errors.New("user is already a workspace member")
	ErrCannotRemoveOwner  = errors.New("the workspace owner cannot be removed")
	ErrInviteUserNotFound = errors.New("user with this email was not found")
	ErrOwnerRoleChange    = errors.New("the owner role cannot be changed")
)

type WorkspaceService interface {
	List(ctx context.Context, userID string) ([]model.Workspace, error)
	Create(ctx context.Context, userID, name, icon string) (*model.Workspace, error)
	Get(ctx context.Context, userID, workspaceID string) (*model.Workspace, error)
	Update(ctx context.Context, userID, workspaceID, name, icon string) (*model.Workspace, error)
	Delete(ctx context.Context, userID, workspaceID string) error
	ListMembers(ctx context.Context, userID, workspaceID string) ([]model.WorkspaceMember, error)
	AddMember(ctx context.Context, userID, workspaceID, email, role string) (*model.WorkspaceMember, error)
	UpdateMemberRole(ctx context.Context, userID, workspaceID, targetUserID, role string) error
	RemoveMember(ctx context.Context, userID, workspaceID, targetUserID string) error
}

type workspaceService struct {
	workspaces repository.WorkspaceRepository
	users      repository.UserRepository
	blocks     repository.BlockRepository
	vectors    VectorIndexService
}

func NewWorkspaceService(
	workspaces repository.WorkspaceRepository,
	users repository.UserRepository,
	blocks repository.BlockRepository,
	vectors VectorIndexService,
) WorkspaceService {
	return &workspaceService{
		workspaces: workspaces,
		users:      users,
		blocks:     blocks,
		vectors:    vectors,
	}
}

func (s *workspaceService) List(ctx context.Context, userID string) ([]model.Workspace, error) {
	return s.workspaces.ListByUser(ctx, userID)
}

func (s *workspaceService) Create(ctx context.Context, userID, name, icon string) (*model.Workspace, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("workspace name is required")
	}

	workspace := &model.Workspace{
		ID:      uuid.NewString(),
		Name:    name,
		Icon:    icon,
		OwnerID: userID,
	}
	if err := s.workspaces.Create(ctx, workspace); err != nil {
		return nil, err
	}

	member := &model.WorkspaceMember{
		ID:          uuid.NewString(),
		WorkspaceID: workspace.ID,
		UserID:      userID,
		Role:        "owner",
	}
	if err := s.workspaces.CreateMember(ctx, member); err != nil {
		return nil, err
	}

	rootPage := &model.Block{
		ID:          uuid.NewString(),
		WorkspaceID: workspace.ID,
		Type:        "page",
		Properties:  map[string]any{"title": "Getting Started"},
		Content:     []string{},
		Position:    0,
		Version:     1,
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}
	if err := s.blocks.Create(ctx, rootPage); err != nil {
		return nil, err
	}
	if err := s.vectors.EnsureWorkspace(ctx, workspace.ID); err != nil {
		log.Printf("ensure zvec collection for workspace %s: %v", workspace.ID, err)
	}
	if err := s.vectors.SyncBlock(ctx, rootPage.ID); err != nil {
		log.Printf("index root page %s: %v", rootPage.ID, err)
	}

	return workspace, nil
}

func (s *workspaceService) Get(ctx context.Context, userID, workspaceID string) (*model.Workspace, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	return s.workspaces.FindByID(ctx, workspaceID)
}

func (s *workspaceService) Update(ctx context.Context, userID, workspaceID, name, icon string) (*model.Workspace, error) {
	if err := s.ensureOwner(ctx, workspaceID, userID); err != nil {
		return nil, err
	}

	workspace, err := s.workspaces.FindByID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) != "" {
		workspace.Name = strings.TrimSpace(name)
	}
	if icon != "" {
		workspace.Icon = icon
	}

	if err := s.workspaces.Update(ctx, workspace); err != nil {
		return nil, err
	}
	return workspace, nil
}

func (s *workspaceService) Delete(ctx context.Context, userID, workspaceID string) error {
	if err := s.ensureOwner(ctx, workspaceID, userID); err != nil {
		return err
	}
	if err := s.workspaces.DeleteWorkspace(ctx, workspaceID); err != nil {
		return err
	}
	if err := s.vectors.DestroyWorkspace(ctx, workspaceID); err != nil {
		log.Printf("destroy zvec collection for workspace %s: %v", workspaceID, err)
	}
	return nil
}

func (s *workspaceService) ListMembers(ctx context.Context, userID, workspaceID string) ([]model.WorkspaceMember, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	return s.workspaces.ListMembers(ctx, workspaceID)
}

func (s *workspaceService) AddMember(ctx context.Context, userID, workspaceID, email, role string) (*model.WorkspaceMember, error) {
	if err := s.ensureOwner(ctx, workspaceID, userID); err != nil {
		return nil, err
	}

	if err := validateRole(role); err != nil {
		return nil, err
	}

	user, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInviteUserNotFound
		}
		return nil, err
	}

	if _, err := s.workspaces.FindMember(ctx, workspaceID, user.ID); err == nil {
		return nil, ErrAlreadyMember
	} else if !errors.Is(err, repository.ErrMemberNotFound) {
		return nil, err
	}

	member := &model.WorkspaceMember{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		UserID:      user.ID,
		Role:        role,
	}
	if err := s.workspaces.CreateMember(ctx, member); err != nil {
		return nil, err
	}
	member.User = *user
	return member, nil
}

func (s *workspaceService) UpdateMemberRole(ctx context.Context, userID, workspaceID, targetUserID, role string) error {
	if err := s.ensureOwner(ctx, workspaceID, userID); err != nil {
		return err
	}
	if err := validateRole(role); err != nil {
		return err
	}

	workspace, err := s.workspaces.FindByID(ctx, workspaceID)
	if err != nil {
		return err
	}
	if targetUserID == workspace.OwnerID {
		return ErrOwnerRoleChange
	}

	return s.workspaces.UpdateMemberRole(ctx, workspaceID, targetUserID, role)
}

func (s *workspaceService) RemoveMember(ctx context.Context, userID, workspaceID, targetUserID string) error {
	if err := s.ensureOwner(ctx, workspaceID, userID); err != nil {
		return err
	}

	workspace, err := s.workspaces.FindByID(ctx, workspaceID)
	if err != nil {
		return err
	}
	if targetUserID == workspace.OwnerID {
		return ErrCannotRemoveOwner
	}

	return s.workspaces.DeleteMember(ctx, workspaceID, targetUserID)
}

func (s *workspaceService) ensureMember(ctx context.Context, workspaceID, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, workspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}

func (s *workspaceService) ensureOwner(ctx context.Context, workspaceID, userID string) error {
	member, err := s.workspaces.FindMember(ctx, workspaceID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	if member.Role != "owner" {
		return ErrForbidden
	}
	return nil
}

func validateRole(role string) error {
	switch role {
	case "owner", "admin", "member", "guest":
		return nil
	default:
		return fmt.Errorf("%w: %s", ErrInvalidRole, role)
	}
}
