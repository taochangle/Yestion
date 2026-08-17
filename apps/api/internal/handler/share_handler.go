package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/service"
)

type ShareHandler struct {
	shares service.ShareService
}

func NewShareHandler(shares service.ShareService) *ShareHandler {
	return &ShareHandler{shares: shares}
}

type createShareRequest struct {
	Permission string     `json:"permission"`
	ExpiresAt  *time.Time `json:"expiresAt"`
}

func (h *ShareHandler) Create(c *gin.Context) {
	var request createShareRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	share, err := h.shares.Create(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		request.Permission,
		request.ExpiresAt,
	)
	if err != nil {
		h.writeShareError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"share": share})
}

func (h *ShareHandler) ListByBlock(c *gin.Context) {
	shares, err := h.shares.ListByBlock(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeShareError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"shares": shares})
}

func (h *ShareHandler) GetByToken(c *gin.Context) {
	block, share, err := h.shares.GetByToken(c.Request.Context(), c.Param("token"))
	if err != nil {
		h.writeShareError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"block": block, "share": share})
}

func (h *ShareHandler) Revoke(c *gin.Context) {
	if err := h.shares.Revoke(c.Request.Context(), userID(c), c.Param("id")); err != nil {
		h.writeShareError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ShareHandler) writeShareError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrShareNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrShareExpired):
		c.JSON(http.StatusGone, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "share operation failed"})
	}
}
