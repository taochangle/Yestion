package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/repository"
	"github.com/my-notion/yestion/api/internal/service"
)

type WorkspaceHandler struct {
	workspaces service.WorkspaceService
}

func NewWorkspaceHandler(workspaces service.WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{workspaces: workspaces}
}

type workspaceCreateRequest struct {
	Name string `json:"name" binding:"required,max=255"`
	Icon string `json:"icon" binding:"max=50"`
}

type workspaceUpdateRequest struct {
	Name string `json:"name" binding:"max=255"`
	Icon string `json:"icon" binding:"max=50"`
}

type addMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"omitempty,oneof=admin member guest"`
}

type updateMemberRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin member guest"`
}

func (h *WorkspaceHandler) List(c *gin.Context) {
	workspaces, err := h.workspaces.List(c.Request.Context(), userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list workspaces"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"workspaces": workspaces})
}

func (h *WorkspaceHandler) Create(c *gin.Context) {
	var request workspaceCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	workspace, err := h.workspaces.Create(c.Request.Context(), userID(c), request.Name, request.Icon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create workspace"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Get(c *gin.Context) {
	workspace, err := h.workspaces.Get(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Update(c *gin.Context) {
	var request workspaceUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	workspace, err := h.workspaces.Update(c.Request.Context(), userID(c), c.Param("id"), request.Name, request.Icon)
	if err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Delete(c *gin.Context) {
	if err := h.workspaces.Delete(c.Request.Context(), userID(c), c.Param("id")); err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	members, err := h.workspaces.ListMembers(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *WorkspaceHandler) AddMember(c *gin.Context) {
	var request addMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and a valid role are required"})
		return
	}
	if request.Role == "" {
		request.Role = "member"
	}

	member, err := h.workspaces.AddMember(c.Request.Context(), userID(c), c.Param("id"), request.Email, request.Role)
	if err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"member": member})
}

func (h *WorkspaceHandler) UpdateMemberRole(c *gin.Context) {
	var request updateMemberRoleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a valid role is required"})
		return
	}

	if err := h.workspaces.UpdateMemberRole(c.Request.Context(), userID(c), c.Param("id"), c.Param("userId"), request.Role); err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	if err := h.workspaces.RemoveMember(c.Request.Context(), userID(c), c.Param("id"), c.Param("userId")); err != nil {
		h.writeWorkspaceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *WorkspaceHandler) writeWorkspaceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrWorkspaceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrAlreadyMember):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInviteUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInvalidRole),
		errors.Is(err, service.ErrCannotRemoveOwner),
		errors.Is(err, service.ErrOwnerRoleChange):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "workspace operation failed"})
	}
}
