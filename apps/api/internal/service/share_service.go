package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/my-notion/notionclone/api/internal/model"
	"github.com/my-notion/notionclone/api/internal/repository"
)

var (
	ErrShareNotFound = errors.New("share not found")
	ErrShareExpired  = errors.New("share link has expired")
)

type ShareService interface {
	Create(ctx context.Context, userID, blockID, permission string, expiresAt *time.Time) (*model.Share, error)
	ListByBlock(ctx context.Context, userID, blockID string) ([]model.Share, error)
	GetByToken(ctx context.Context, token string) (*model.Block, *model.Share, error)
	Revoke(ctx context.Context, userID, shareID string) error
}

type shareService struct {
	shares     repository.ShareRepository
	blocks     repository.BlockRepository
	workspaces repository.WorkspaceRepository
}

func NewShareService(
	shares repository.ShareRepository,
	blocks repository.BlockRepository,
	workspaces repository.WorkspaceRepository,
) ShareService {
	return &shareService{shares: shares, blocks: blocks, workspaces: workspaces}
}

func (s *shareService) Create(
	ctx context.Context,
	userID, blockID, permission string,
	expiresAt *time.Time,
) (*model.Share, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}
	if permission == "" {
		permission = "read"
	}

	share := &model.Share{
		ID:         uuid.NewString(),
		BlockID:    blockID,
		Token:      uuid.NewString(),
		Permission: permission,
		ExpiresAt:  expiresAt,
		CreatedBy:  userID,
	}
	if err := s.shares.Create(ctx, share); err != nil {
		return nil, err
	}
	return share, nil
}

func (s *shareService) ListByBlock(ctx context.Context, userID, blockID string) ([]model.Share, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}
	return s.shares.ListByBlock(ctx, blockID)
}

func (s *shareService) GetByToken(ctx context.Context, token string) (*model.Block, *model.Share, error) {
	share, err := s.shares.FindByToken(ctx, token)
	if err != nil {
		return nil, nil, ErrShareNotFound
	}
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		return nil, nil, ErrShareExpired
	}

	block, err := s.blocks.FindByID(ctx, share.BlockID)
	if err != nil {
		return nil, nil, err
	}
	return block, share, nil
}

func (s *shareService) Revoke(ctx context.Context, userID, shareID string) error {
	share, err := s.shares.FindByID(ctx, shareID)
	if err != nil {
		return err
	}
	block, err := s.blocks.FindByID(ctx, share.BlockID)
	if err != nil {
		return err
	}
	if err := s.ensureAccess(ctx, block.WorkspaceID, userID); err != nil {
		return err
	}
	return s.shares.Delete(ctx, shareID)
}

func (s *shareService) ensureAccess(ctx context.Context, workspaceID, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, workspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}
