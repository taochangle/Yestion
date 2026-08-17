package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
	"github.com/my-notion/yestion/api/internal/service"
)

type DatabaseHandler struct {
	databases service.DatabaseService
}

func NewDatabaseHandler(databases service.DatabaseService) *DatabaseHandler {
	return &DatabaseHandler{databases: databases}
}

type databaseCreateRequest struct {
	WorkspaceID string                   `json:"workspaceId" binding:"required"`
	ParentID    *string                  `json:"parentId"`
	Name        string                   `json:"name"`
	Properties  []model.DatabaseProperty `json:"properties"`
}

type databaseUpdateRequest struct {
	Name       string                   `json:"name"`
	Properties []model.DatabaseProperty `json:"properties"`
	Views      []model.DatabaseView     `json:"views"`
}

type databaseRowRequest struct {
	Properties map[string]any `json:"properties"`
}

func (h *DatabaseHandler) Create(c *gin.Context) {
	var request databaseCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspaceId is required"})
		return
	}

	database, err := h.databases.Create(
		c.Request.Context(),
		userID(c),
		request.WorkspaceID,
		request.ParentID,
		request.Name,
		request.Properties,
	)
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"database": database})
}

func (h *DatabaseHandler) Get(c *gin.Context) {
	database, err := h.databases.Get(c.Request.Context(), userID(c), c.Param("id"))
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) GetByBlock(c *gin.Context) {
	database, err := h.databases.GetByBlock(c.Request.Context(), userID(c), c.Param("blockId"))
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) Update(c *gin.Context) {
	var request databaseUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	database, err := h.databases.Update(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		request.Name,
		request.Properties,
		request.Views,
	)
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) Delete(c *gin.Context) {
	if err := h.databases.Delete(c.Request.Context(), userID(c), c.Param("id")); err != nil {
		h.writeDatabaseError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *DatabaseHandler) CreateRow(c *gin.Context) {
	var request databaseRowRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "properties must be an object"})
		return
	}

	row, err := h.databases.CreateRow(c.Request.Context(), userID(c), c.Param("id"), request.Properties)
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"row": row})
}

func (h *DatabaseHandler) ListRows(c *gin.Context) {
	var filters []model.DatabaseFilter
	if rawFilters := c.Query("filters"); rawFilters != "" {
		if err := json.Unmarshal([]byte(rawFilters), &filters); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "filters must be valid JSON"})
			return
		}
	}

	rows, err := h.databases.ListRows(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		c.Query("sortBy"),
		c.Query("sortDirection"),
		filters,
	)
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"rows": rows})
}

func (h *DatabaseHandler) UpdateRow(c *gin.Context) {
	var request databaseRowRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "properties must be an object"})
		return
	}

	row, err := h.databases.UpdateRow(
		c.Request.Context(),
		userID(c),
		c.Param("id"),
		c.Param("rowId"),
		request.Properties,
	)
	if err != nil {
		h.writeDatabaseError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"row": row})
}

func (h *DatabaseHandler) DeleteRow(c *gin.Context) {
	if err := h.databases.DeleteRow(c.Request.Context(), userID(c), c.Param("id"), c.Param("rowId")); err != nil {
		h.writeDatabaseError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *DatabaseHandler) writeDatabaseError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrDatabaseNotFound),
		errors.Is(err, repository.ErrDatabaseRowNotFound),
		errors.Is(err, service.ErrDatabaseNotFound),
		errors.Is(err, service.ErrDatabaseRowNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInvalidDatabaseProperty):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database operation failed"})
	}
}
