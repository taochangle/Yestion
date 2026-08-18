package router

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/my-notion/yestion/api/internal/config"
	"github.com/my-notion/yestion/api/internal/handler"
	"github.com/my-notion/yestion/api/internal/middleware"
)

func New(
	cfg config.Config,
	authHandler *handler.AuthHandler,
	workspaceHandler *handler.WorkspaceHandler,
	blockHandler *handler.BlockHandler,
	fileHandler *handler.FileHandler,
	databaseHandler *handler.DatabaseHandler,
	searchHandler *handler.SearchHandler,
	shareHandler *handler.ShareHandler,
	templateHandler *handler.TemplateHandler,
	chatHandler *handler.ChatHandler,
) *gin.Engine {
	router := gin.Default()

	router.Use(cors(cfg.CORSAllowedOrigins))
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.GET("/me", middleware.Auth(cfg.JWTSecret), authHandler.Me)
			auth.POST("/logout", middleware.Auth(cfg.JWTSecret), authHandler.Logout)
		}

		workspaces := api.Group("/workspaces", middleware.Auth(cfg.JWTSecret))
		{
			workspaces.GET("", workspaceHandler.List)
			workspaces.POST("", workspaceHandler.Create)
			workspaces.GET("/:id", workspaceHandler.Get)
			workspaces.PATCH("/:id", workspaceHandler.Update)
			workspaces.DELETE("/:id", workspaceHandler.Delete)
			workspaces.GET("/:id/members", workspaceHandler.ListMembers)
			workspaces.POST("/:id/members", workspaceHandler.AddMember)
			workspaces.PATCH("/:id/members/:userId", workspaceHandler.UpdateMemberRole)
			workspaces.DELETE("/:id/members/:userId", workspaceHandler.RemoveMember)
			workspaces.GET("/:id/blocks", blockHandler.Tree)
		}

		blocks := api.Group("/blocks", middleware.Auth(cfg.JWTSecret))
		{
			blocks.GET("/:id", blockHandler.Get)
			blocks.POST("", blockHandler.Create)
			blocks.PATCH("/:id", blockHandler.Update)
			blocks.DELETE("/:id", blockHandler.Delete)
			blocks.POST("/:id/move", blockHandler.Move)
			blocks.GET("/:id/revisions", blockHandler.ListRevisions)
			blocks.POST("/:id/shares", shareHandler.Create)
			blocks.GET("/:id/shares", shareHandler.ListByBlock)
		}

		files := api.Group("/files")
		{
			files.POST("/upload", middleware.Auth(cfg.JWTSecret), fileHandler.Upload)
			files.GET("/:name", fileHandler.Download)
		}

		databases := api.Group("/databases", middleware.Auth(cfg.JWTSecret))
		{
			databases.POST("", databaseHandler.Create)
			databases.GET("/by-block/:blockId", databaseHandler.GetByBlock)
			databases.GET("/:id", databaseHandler.Get)
			databases.PATCH("/:id", databaseHandler.Update)
			databases.DELETE("/:id", databaseHandler.Delete)
			databases.POST("/:id/rows", databaseHandler.CreateRow)
			databases.GET("/:id/rows", databaseHandler.ListRows)
			databases.PATCH("/:id/rows/:rowId", databaseHandler.UpdateRow)
			databases.DELETE("/:id/rows/:rowId", databaseHandler.DeleteRow)
		}

		search := api.Group("/search", middleware.Auth(cfg.JWTSecret))
		{
			search.GET("", searchHandler.Search)
		}

		shares := api.Group("/shares")
		{
			shares.GET("/:token", shareHandler.GetByToken)
			shares.DELETE("/:id", middleware.Auth(cfg.JWTSecret), shareHandler.Revoke)
		}

		templates := api.Group("/templates", middleware.Auth(cfg.JWTSecret))
		{
			templates.GET("", templateHandler.List)
			templates.POST("", templateHandler.Create)
			templates.POST("/:id/instantiate", templateHandler.Instantiate)
			templates.DELETE("/:id", templateHandler.Delete)
		}

		chat := api.Group("/chat", middleware.Auth(cfg.JWTSecret))
		{
			chat.POST("", chatHandler.Stream)
			chat.GET("/conversations", chatHandler.ListConversations)
			chat.POST("/conversations", chatHandler.CreateConversation)
			chat.PATCH("/conversations/:id", chatHandler.RenameConversation)
			chat.DELETE("/conversations/:id", chatHandler.DeleteConversation)
			chat.GET("/conversations/:id/messages", chatHandler.ListMessages)
			chat.POST("/conversations/:id/messages", chatHandler.AddMessage)
		}
	}

	return router
}

func cors(allowedOrigins string) gin.HandlerFunc {
	origins := make(map[string]struct{})
	for _, origin := range strings.Split(allowedOrigins, ",") {
		origins[strings.TrimSpace(origin)] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := origins[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
