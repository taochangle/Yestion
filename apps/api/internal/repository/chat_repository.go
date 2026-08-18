package repository

import (
	"context"
	"errors"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/gorm"
)

var ErrConversationNotFound = errors.New("conversation not found")

type ChatRepository interface {
	CreateConversation(ctx context.Context, conversation *model.ChatConversation) error
	FindConversationByID(ctx context.Context, id string) (*model.ChatConversation, error)
	ListConversationsByUser(ctx context.Context, userID string) ([]model.ChatConversation, error)
	UpdateConversation(ctx context.Context, conversation *model.ChatConversation) error
	DeleteConversation(ctx context.Context, id string) error
	DeleteMessagesByConversation(ctx context.Context, conversationID string) error
	CreateMessage(ctx context.Context, message *model.ChatMessage) error
	ListMessagesByConversation(ctx context.Context, conversationID string) ([]model.ChatMessage, error)
}

type chatRepository struct {
	db *gorm.DB
}

func NewChatRepository(db *gorm.DB) ChatRepository {
	return &chatRepository{db: db}
}

func (r *chatRepository) CreateConversation(ctx context.Context, conversation *model.ChatConversation) error {
	return r.db.WithContext(ctx).Create(conversation).Error
}

func (r *chatRepository) FindConversationByID(ctx context.Context, id string) (*model.ChatConversation, error) {
	var conversation model.ChatConversation
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&conversation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrConversationNotFound
		}
		return nil, err
	}
	return &conversation, nil
}

func (r *chatRepository) ListConversationsByUser(ctx context.Context, userID string) ([]model.ChatConversation, error) {
	var conversations []model.ChatConversation
	err := r.db.WithContext(ctx).
		Where("created_by = ?", userID).
		Order("updated_at DESC").
		Find(&conversations).Error
	return conversations, err
}

func (r *chatRepository) UpdateConversation(ctx context.Context, conversation *model.ChatConversation) error {
	return r.db.WithContext(ctx).Save(conversation).Error
}

func (r *chatRepository) DeleteConversation(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.ChatConversation{}).Error
}

func (r *chatRepository) DeleteMessagesByConversation(ctx context.Context, conversationID string) error {
	return r.db.WithContext(ctx).Where("conversation_id = ?", conversationID).Delete(&model.ChatMessage{}).Error
}

func (r *chatRepository) CreateMessage(ctx context.Context, message *model.ChatMessage) error {
	return r.db.WithContext(ctx).Create(message).Error
}

func (r *chatRepository) ListMessagesByConversation(ctx context.Context, conversationID string) ([]model.ChatMessage, error) {
	var messages []model.ChatMessage
	err := r.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Find(&messages).Error
	return messages, err
}
