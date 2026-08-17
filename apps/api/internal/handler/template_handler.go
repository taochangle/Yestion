package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/notionclone/api/internal/service"
)

type TemplateHandler struct {
	templates service.TemplateService
}

func NewTemplateHandler(templates service.TemplateService) *TemplateHandler {
	return &TemplateHandler{templates: templates}
}

type createTemplateRequest struct {
	WorkspaceID string         `json:"workspaceId" binding:"required"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	BlockType   string         `json:"blockType"`
	Properties  map[string]any `json:"properties"`
	Content     map[string]any `json:"content"`
}

type instantiateTemplateRequest struct {
	ParentID *string `json:"parentId"`
}

func (h *TemplateHandler) List(c *gin.Context) {
	templates, err := h.templates.List(
		c.Request.Context(),
		userID(c),
		c.Query("workspaceId"),
	)
	if err != nil {
		h.writeTemplateError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *TemplateHandler) Create(c *gin.Context) {
	var request createTemplateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspaceId is required"})
		return
	}

	template, err := h.templates.Create(
		c.Request.Context(),
		userID(c),
		request.WorkspaceID,
		request.Name,
		request.Description,
		request.BlockType,
		request.Properties,
		request.Content,
	)
	if err != nil {
		h.writeTemplateError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"template": template})
}

func (h *TemplateHandler) Instantiate(c *gin.Context) {
	var request instantiateTemplateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	block, err := h.templates.Instantiate(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		request.ParentID,
	)
	if err != nil {
		h.writeTemplateError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"block": block})
}

func (h *TemplateHandler) Delete(c *gin.Context) {
	if err := h.templates.Delete(c.Request.Context(), userID(c), c.Param("id")); err != nil {
		h.writeTemplateError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *TemplateHandler) writeTemplateError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrTemplateNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrTemplateUnsupported):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "template operation failed"})
	}
}
