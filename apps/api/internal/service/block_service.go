package service

import (
	"context"
	"errors"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
)

var (
	ErrBlockParent = errors.New("invalid parent block")
	ErrBlockCycle  = errors.New("a block cannot be moved inside itself")
)

type BlockNode struct {
	model.Block
	Children []*BlockNode `json:"children"`
}

type BlockService interface {
	Tree(ctx context.Context, userID, workspaceID string) ([]*BlockNode, error)
	Get(ctx context.Context, userID, blockID string) (*model.Block, error)
	Create(ctx context.Context, userID, workspaceID string, parentID *string, blockType, title string) (*model.Block, error)
	Update(ctx context.Context, userID, blockID, title string, properties map[string]any) (*model.Block, error)
	Delete(ctx context.Context, userID, blockID string) error
	Move(ctx context.Context, userID, blockID string, parentID *string, clearParent bool, position *int) (*model.Block, error)
	ListRevisions(ctx context.Context, userID, blockID string) ([]model.Revision, error)
}

type blockService struct {
	blocks     repository.BlockRepository
	workspaces repository.WorkspaceRepository
	revisions  repository.RevisionRepository
	vectors    VectorIndexService
}

func NewBlockService(
	blocks repository.BlockRepository,
	workspaces repository.WorkspaceRepository,
	revisions repository.RevisionRepository,
	vectors VectorIndexService,
) BlockService {
	return &blockService{blocks: blocks, workspaces: workspaces, revisions: revisions, vectors: vectors}
}

func (s *blockService) Tree(ctx context.Context, userID, workspaceID string) ([]*BlockNode, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}

	blocks, err := s.blocks.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return buildTree(blocks), nil
}

func (s *blockService) Get(ctx context.Context, userID, blockID string) (*model.Block, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}
	return block, nil
}

func (s *blockService) Create(ctx context.Context, userID, workspaceID string, parentID *string, blockType, title string) (*model.Block, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}

	if parentID != nil {
		parent, err := s.blocks.FindByID(ctx, *parentID)
		if err != nil {
			return nil, ErrBlockParent
		}
		if parent.WorkspaceID != workspaceID {
			return nil, ErrBlockParent
		}
	}

	if strings.TrimSpace(blockType) == "" {
		blockType = "page"
	}
	if strings.TrimSpace(title) == "" {
		title = "Untitled"
	}

	position, err := s.blocks.MaxPosition(ctx, workspaceID, parentID)
	if err != nil {
		return nil, err
	}

	block := &model.Block{
		ID:          uuid.NewString(),
		ParentID:    parentID,
		WorkspaceID: workspaceID,
		Type:        blockType,
		Properties:  map[string]any{"title": title},
		Content:     []string{},
		Position:    position + 1,
		Version:     1,
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}
	if err := s.blocks.Create(ctx, block); err != nil {
		return nil, err
	}
	if err := s.vectors.SyncBlock(ctx, block.ID); err != nil {
		log.Printf("index block %s: %v", block.ID, err)
	}
	return block, nil
}

func (s *blockService) Update(ctx context.Context, userID, blockID, title string, properties map[string]any) (*model.Block, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}

	revision := &model.Revision{
		ID:        uuid.NewString(),
		BlockID:   block.ID,
		Snapshot:  cloneMap(block.Properties),
		CreatedBy: userID,
	}
	if err := s.revisions.Create(ctx, revision); err != nil {
		return nil, err
	}

	if block.Properties == nil {
		block.Properties = map[string]any{}
	}
	if strings.TrimSpace(title) != "" {
		block.Properties["title"] = strings.TrimSpace(title)
	}
	for key, value := range properties {
		block.Properties[key] = value
	}
	block.UpdatedBy = userID
	block.Version++

	if err := s.blocks.Update(ctx, block); err != nil {
		return nil, err
	}
	if err := s.vectors.SyncBlock(ctx, block.ID); err != nil {
		log.Printf("re-index block %s: %v", block.ID, err)
	}
	return block, nil
}

func (s *blockService) ListRevisions(ctx context.Context, userID, blockID string) ([]model.Revision, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}
	return s.revisions.ListByBlock(ctx, blockID, 50)
}

func (s *blockService) Delete(ctx context.Context, userID, blockID string) error {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return err
	}
	if err := s.ensureMember(ctx, block.WorkspaceID, userID); err != nil {
		return err
	}

	blocks, err := s.blocks.ListByWorkspace(ctx, block.WorkspaceID)
	if err != nil {
		return err
	}

	ids := collectDescendantIDs(blockID, blocks)
	ids = append(ids, blockID)
	for _, id := range ids {
		if err := s.blocks.Delete(ctx, id); err != nil {
			return err
		}
	}
	for _, id := range ids {
		if err := s.vectors.DeleteBlock(ctx, block.WorkspaceID, id); err != nil {
			log.Printf("remove vector for block %s: %v", id, err)
		}
	}
	return nil
}

func (s *blockService) Move(ctx context.Context, userID, blockID string, parentID *string, clearParent bool, position *int) (*model.Block, error) {
	block, err := s.blocks.FindByID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, block.WorkspaceID, userID); err != nil {
		return nil, err
	}

	var newParent *string
	switch {
	case clearParent:
		newParent = nil
	case parentID != nil:
		newParent = parentID
	default:
		newParent = block.ParentID
	}

	if newParent != nil {
		if *newParent == blockID {
			return nil, ErrBlockCycle
		}
		parent, err := s.blocks.FindByID(ctx, *newParent)
		if err != nil {
			return nil, ErrBlockParent
		}
		if parent.WorkspaceID != block.WorkspaceID {
			return nil, ErrBlockParent
		}

		blocks, err := s.blocks.ListByWorkspace(ctx, block.WorkspaceID)
		if err != nil {
			return nil, err
		}
		if isDescendant(blockID, *newParent, blocks) {
			return nil, ErrBlockCycle
		}
	}

	oldParent := block.ParentID
	oldPosition := block.Position
	newPosition := oldPosition
	if position != nil {
		newPosition = *position
	}

	if parentChanged(oldParent, newParent) {
		maxPosition, err := s.blocks.MaxPosition(ctx, block.WorkspaceID, newParent)
		if err != nil {
			return nil, err
		}
		if position == nil {
			newPosition = maxPosition + 1
		} else if newPosition < 0 {
			newPosition = 0
		} else if newPosition > maxPosition+1 {
			newPosition = maxPosition + 1
		}

		if oldParent != nil {
			_ = s.blocks.ShiftPositions(ctx, block.WorkspaceID, oldParent, oldPosition+1, -1)
		}
		if newParent != nil {
			_ = s.blocks.ShiftPositions(ctx, block.WorkspaceID, newParent, newPosition, 1)
		}
	} else {
		if position != nil {
			if newPosition > oldPosition {
				_ = s.blocks.ShiftPositions(ctx, block.WorkspaceID, oldParent, oldPosition+1, -1)
			} else if newPosition < oldPosition {
				_ = s.blocks.ShiftPositions(ctx, block.WorkspaceID, oldParent, newPosition, 1)
			}
		}
	}

	block.ParentID = newParent
	block.Position = newPosition
	block.UpdatedBy = userID
	block.Version++

	if err := s.blocks.Update(ctx, block); err != nil {
		return nil, err
	}
	return block, nil
}

func (s *blockService) ensureMember(ctx context.Context, workspaceID, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, workspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}

func buildTree(blocks []model.Block) []*BlockNode {
	nodeByID := make(map[string]*BlockNode, len(blocks))
	nodes := make([]*BlockNode, 0, len(blocks))
	for _, block := range blocks {
		node := &BlockNode{Block: block, Children: []*BlockNode{}}
		nodeByID[block.ID] = node
		nodes = append(nodes, node)
	}

	roots := make([]*BlockNode, 0)
	for _, node := range nodes {
		if node.ParentID == nil {
			roots = append(roots, node)
			continue
		}
		if parent, ok := nodeByID[*node.ParentID]; ok {
			parent.Children = append(parent.Children, node)
		} else {
			roots = append(roots, node)
		}
	}
	return roots
}

func collectDescendantIDs(blockID string, blocks []model.Block) []string {
	byParent := make(map[string][]model.Block)
	for _, block := range blocks {
		if block.ParentID != nil {
			byParent[*block.ParentID] = append(byParent[*block.ParentID], block)
		}
	}

	var result []string
	var walk func(parentID string)
	walk = func(parentID string) {
		for _, child := range byParent[parentID] {
			result = append(result, child.ID)
			walk(child.ID)
		}
	}
	walk(blockID)
	return result
}

func isDescendant(blockID, possibleAncestor string, blocks []model.Block) bool {
	for _, id := range collectDescendantIDs(blockID, blocks) {
		if id == possibleAncestor {
			return true
		}
	}
	return false
}

func parentChanged(oldParent, newParent *string) bool {
	if oldParent == nil && newParent == nil {
		return false
	}
	if oldParent == nil || newParent == nil {
		return true
	}
	return *oldParent != *newParent
}
