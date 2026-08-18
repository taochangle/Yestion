package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
)

// ChatHistoryService persists chat conversations and messages per workspace.
type ChatHistoryService interface {
	ListConversations(ctx context.Context, userID, workspaceID string) ([]model.ChatConversation, error)
	CreateConversation(ctx context.Context, userID, workspaceID, title string) (*model.ChatConversation, error)
	RenameConversation(ctx context.Context, userID, conversationID, title string) (*model.ChatConversation, error)
	DeleteConversation(ctx context.Context, userID, conversationID string) error
	ListMessages(ctx context.Context, userID, conversationID string) ([]model.ChatMessage, error)
	AddMessage(ctx context.Context, userID, conversationID, role, content, reasoning string) (*model.ChatMessage, error)
}

type chatHistoryService struct {
	chats      repository.ChatRepository
	workspaces repository.WorkspaceRepository
}

func NewChatHistoryService(
	chats repository.ChatRepository,
	workspaces repository.WorkspaceRepository,
) ChatHistoryService {
	return &chatHistoryService{chats: chats, workspaces: workspaces}
}

func (s *chatHistoryService) ListConversations(ctx context.Context, userID, workspaceID string) ([]model.ChatConversation, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	return s.chats.ListConversationsByWorkspace(ctx, workspaceID)
}

func (s *chatHistoryService) CreateConversation(ctx context.Context, userID, workspaceID, title string) (*model.ChatConversation, error) {
	if err := s.ensureMember(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	title = strings.TrimSpace(title)
	if title == "" {
		title = "新对话"
	}
	conversation := &model.ChatConversation{
		ID:          uuid.NewString(),
		WorkspaceID: workspaceID,
		Title:       title,
		CreatedBy:   userID,
	}
	if err := s.chats.CreateConversation(ctx, conversation); err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *chatHistoryService) RenameConversation(ctx context.Context, userID, conversationID, title string) (*model.ChatConversation, error) {
	conversation, err := s.chats.FindConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, conversation.WorkspaceID, userID); err != nil {
		return nil, err
	}
	if strings.TrimSpace(title) != "" {
		conversation.Title = strings.TrimSpace(title)
	}
	if err := s.chats.UpdateConversation(ctx, conversation); err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *chatHistoryService) DeleteConversation(ctx context.Context, userID, conversationID string) error {
	conversation, err := s.chats.FindConversationByID(ctx, conversationID)
	if err != nil {
		return err
	}
	if err := s.ensureMember(ctx, conversation.WorkspaceID, userID); err != nil {
		return err
	}
	if err := s.chats.DeleteMessagesByConversation(ctx, conversationID); err != nil {
		return err
	}
	return s.chats.DeleteConversation(ctx, conversationID)
}

func (s *chatHistoryService) ListMessages(ctx context.Context, userID, conversationID string) ([]model.ChatMessage, error) {
	conversation, err := s.chats.FindConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, conversation.WorkspaceID, userID); err != nil {
		return nil, err
	}
	return s.chats.ListMessagesByConversation(ctx, conversationID)
}

func (s *chatHistoryService) AddMessage(
	ctx context.Context,
	userID, conversationID, role, content, reasoning string,
) (*model.ChatMessage, error) {
	conversation, err := s.chats.FindConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureMember(ctx, conversation.WorkspaceID, userID); err != nil {
		return nil, err
	}
	if role != "user" && role != "assistant" {
		return nil, errors.New("invalid message role")
	}
	message := &model.ChatMessage{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		Reasoning:      reasoning,
	}
	if err := s.chats.CreateMessage(ctx, message); err != nil {
		return nil, err
	}
	return message, nil
}

func (s *chatHistoryService) ensureMember(ctx context.Context, workspaceID, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, workspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}
