package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/notionclone/api/internal/service"
)

type SearchHandler struct {
	search service.SearchService
}

func NewSearchHandler(search service.SearchService) *SearchHandler {
	return &SearchHandler{search: search}
}

func (h *SearchHandler) Search(c *gin.Context) {
	results, err := h.search.Search(c.Request.Context(), userID(c), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}
