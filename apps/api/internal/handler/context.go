package handler

import "github.com/gin-gonic/gin"

func userID(c *gin.Context) string {
	return c.GetString("user_id")
}
