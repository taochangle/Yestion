package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
)

var (
	ErrTemplateNotFound    = errors.New("template not found")
	ErrTemplateUnsupported = errors.New("only page templates can be instantiated in this milestone")
)

type TemplateService interface {
	List(ctx context.Context, userID, workspaceID string) ([]model.Template, error)
	Create(ctx context.Context, userID, workspaceID, name, description, blockType string, properties map[string]any, content map[string]any) (*model.Template, error)
	Instantiate(ctx context.Context, userID, templateID string, parentID *string) (*model.Block, error)
	Delete(ctx context.Context, userID, templateID string) error
}

type templateService struct {
	templates  repository.TemplateRepository
	workspaces repository.WorkspaceRepository
	blocks     BlockService
}

func NewTemplateService(
	templates repository.TemplateRepository,
	workspaces repository.WorkspaceRepository,
	blocks BlockService,
) TemplateService {
	return &templateService{templates: templates, workspaces: workspaces, blocks: blocks}
}

func (s *templateService) List(ctx context.Context, userID, workspaceID string) ([]model.Template, error) {
	if err := s.ensureAccess(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	return s.templates.ListByWorkspace(ctx, workspaceID)
}

func (s *templateService) Create(
	ctx context.Context,
	userID, workspaceID, name, description, blockType string,
	properties map[string]any,
	content map[string]any,
) (*model.Template, error) {
	if err := s.ensureAccess(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("template name is required")
	}
	if strings.TrimSpace(blockType) == "" {
		blockType = "page"
	}

	template := &model.Template{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
		BlockType:   blockType,
		Properties:  properties,
		Content:     content,
		CreatedBy:   userID,
	}
	if template.Properties == nil {
		template.Properties = map[string]any{}
	}
	if template.Content == nil {
		template.Content = map[string]any{}
	}
	if err := s.templates.Create(ctx, template); err != nil {
		return nil, err
	}
	return template, nil
}

func (s *templateService) Instantiate(ctx context.Context, userID, templateID string, parentID *string) (*model.Block, error) {
	template, err := s.templates.FindByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, template.WorkspaceID, userID); err != nil {
		return nil, err
	}
	if template.BlockType != "page" {
		return nil, ErrTemplateUnsupported
	}

	title := template.Name
	if value, ok := template.Properties["title"].(string); ok && strings.TrimSpace(value) != "" {
		title = strings.TrimSpace(value)
	}

	block, err := s.blocks.Create(ctx, userID, template.WorkspaceID, parentID, "page", title)
	if err != nil {
		return nil, err
	}

	properties := cloneMap(template.Properties)
	if template.Content != nil {
		properties["content"] = template.Content
	}
	return s.blocks.Update(ctx, userID, block.ID, "", properties)
}

func (s *templateService) Delete(ctx context.Context, userID, templateID string) error {
	template, err := s.templates.FindByID(ctx, templateID)
	if err != nil {
		return err
	}
	if err := s.ensureAccess(ctx, template.WorkspaceID, userID); err != nil {
		return err
	}
	return s.templates.Delete(ctx, templateID)
}

func (s *templateService) ensureAccess(ctx context.Context, workspaceID, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, workspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}
