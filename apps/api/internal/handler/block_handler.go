package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/repository"
	"github.com/my-notion/yestion/api/internal/service"
)

type BlockHandler struct {
	blocks service.BlockService
}

func NewBlockHandler(blocks service.BlockService) *BlockHandler {
	return &BlockHandler{blocks: blocks}
}

type blockCreateRequest struct {
	WorkspaceID string  `json:"workspaceId" binding:"required"`
	ParentID    *string `json:"parentId"`
	Type        string  `json:"type"`
	Title       string  `json:"title"`
}

type blockUpdateRequest struct {
	Title      string         `json:"title"`
	Properties map[string]any `json:"properties"`
}

type blockMoveRequest struct {
	ParentID    *string `json:"parentId"`
	ClearParent bool    `json:"clearParent"`
	Position    *int    `json:"position"`
}

func (h *BlockHandler) Tree(c *gin.Context) {
	nodes, err := h.blocks.Tree(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"blocks": nodes})
}

func (h *BlockHandler) Get(c *gin.Context) {
	block, err := h.blocks.Get(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"block": block})
}

func (h *BlockHandler) Create(c *gin.Context) {
	var request blockCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspaceId is required"})
		return
	}

	block, err := h.blocks.Create(c.Request.Context(), userID(c), request.WorkspaceID, request.ParentID, request.Type, request.Title)
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"block": block})
}

func (h *BlockHandler) Update(c *gin.Context) {
	var request blockUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	block, err := h.blocks.Update(c.Request.Context(), userID(c), c.Param("id"), request.Title, request.Properties)
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"block": block})
}

func (h *BlockHandler) Delete(c *gin.Context) {
	if err := h.blocks.Delete(c.Request.Context(), userID(c), c.Param("id")); err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *BlockHandler) Move(c *gin.Context) {
	var request blockMoveRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	block, err := h.blocks.Move(c.Request.Context(), userID(c), c.Param("id"), request.ParentID, request.ClearParent, request.Position)
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"block": block})
}

func (h *BlockHandler) ListRevisions(c *gin.Context) {
	revisions, err := h.blocks.ListRevisions(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeBlockError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"revisions": revisions})
}

func (h *BlockHandler) writeBlockError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrBlockNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrBlockParent),
		errors.Is(err, service.ErrBlockCycle):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "block operation failed"})
	}
}
