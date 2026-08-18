package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/service"
)

type ChatHandler struct {
	ai         service.AIService
	workspaces service.WorkspaceService
	history    service.ChatHistoryService
}

func NewChatHandler(
	ai service.AIService,
	workspaces service.WorkspaceService,
	history service.ChatHistoryService,
) *ChatHandler {
	return &ChatHandler{ai: ai, workspaces: workspaces, history: history}
}

type chatRequest struct {
	WorkspaceID  string                `json:"workspaceId" binding:"required"`
	Messages     []service.ChatMessage `json:"messages" binding:"required,min=1"`
	UseKnowledge bool                  `json:"useKnowledge"`
	UseSearch    bool                  `json:"useSearch"`
	TopK         int                   `json:"topk"`
}

func (h *ChatHandler) Stream(c *gin.Context) {
	var request chatRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat request"})
		return
	}

	if _, err := h.workspaces.Get(c.Request.Context(), userID(c), request.WorkspaceID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this workspace"})
		return
	}
	if err := h.ai.Ready(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	if err := h.ai.StreamChat(
		c.Request.Context(),
		request.WorkspaceID,
		request.Messages,
		request.UseKnowledge,
		request.UseSearch,
		c.Writer,
	); err != nil {
		// The stream may have already started; write a final SSE error frame.
		_ = service.WriteSSEError(c.Writer, err)
	}
}

func (h *ChatHandler) ListConversations(c *gin.Context) {
	conversations, err := h.history.ListConversations(
		c.Request.Context(),
		userID(c),
		c.Query("workspaceId"),
	)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

type createConversationRequest struct {
	WorkspaceID string `json:"workspaceId" binding:"required"`
	Title       string `json:"title"`
}

func (h *ChatHandler) CreateConversation(c *gin.Context) {
	var request createConversationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	conversation, err := h.history.CreateConversation(
		c.Request.Context(),
		userID(c),
		request.WorkspaceID,
		request.Title,
	)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"conversation": conversation})
}

type renameConversationRequest struct {
	Title string `json:"title" binding:"required"`
}

func (h *ChatHandler) RenameConversation(c *gin.Context) {
	var request renameConversationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	conversation, err := h.history.RenameConversation(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		request.Title,
	)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation": conversation})
}

func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	if err := h.history.DeleteConversation(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
	); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ChatHandler) ListMessages(c *gin.Context) {
	messages, err := h.history.ListMessages(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
	)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

type addMessageRequest struct {
	Role      string `json:"role" binding:"required"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning"`
}

func (h *ChatHandler) AddMessage(c *gin.Context) {
	var request addMessageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	message, err := h.history.AddMessage(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		request.Role,
		request.Content,
		request.Reasoning,
	)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": message})
}
