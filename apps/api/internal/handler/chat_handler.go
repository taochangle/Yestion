package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/service"
)

type ChatHandler struct {
	ai         service.AIService
	workspaces service.WorkspaceService
}

func NewChatHandler(ai service.AIService, workspaces service.WorkspaceService) *ChatHandler {
	return &ChatHandler{ai: ai, workspaces: workspaces}
}

type chatRequest struct {
	WorkspaceID  string                `json:"workspaceId" binding:"required"`
	Messages     []service.ChatMessage `json:"messages" binding:"required,min=1"`
	UseKnowledge bool                  `json:"useKnowledge"`
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
		c.Writer,
	); err != nil {
		// The stream may have already started; write a final SSE error frame.
		_ = service.WriteSSEError(c.Writer, err)
	}
}
