package main

import (
	"log"

	"github.com/my-notion/yestion/api/internal/config"
	"github.com/my-notion/yestion/api/internal/database"
	"github.com/my-notion/yestion/api/internal/handler"
	"github.com/my-notion/yestion/api/internal/repository"
	"github.com/my-notion/yestion/api/internal/router"
	"github.com/my-notion/yestion/api/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	userRepository := repository.NewUserRepository(db)
	workspaceRepository := repository.NewWorkspaceRepository(db)
	blockRepository := repository.NewBlockRepository(db)
	revisionRepository := repository.NewRevisionRepository(db)
	databaseRepository := repository.NewDatabaseRepository(db)
	shareRepository := repository.NewShareRepository(db)
	templateRepository := repository.NewTemplateRepository(db)
	chatRepository := repository.NewChatRepository(db)

	authService := service.NewAuthService(userRepository, cfg.JWTSecret, cfg.JWTExpiresIn)
	authHandler := handler.NewAuthHandler(authService)

	zvecClient := service.NewZVecClient(cfg.ZVecServiceURL)
	vectorIndexService := service.NewVectorIndexService(db, blockRepository, zvecClient)

	workspaceService := service.NewWorkspaceService(workspaceRepository, userRepository, blockRepository, vectorIndexService)
	blockService := service.NewBlockService(blockRepository, workspaceRepository, revisionRepository, vectorIndexService)
	databaseService := service.NewDatabaseService(databaseRepository, workspaceRepository, blockService)
	searchService := service.NewSearchService(workspaceRepository, blockRepository)
	shareService := service.NewShareService(shareRepository, blockRepository, workspaceRepository)
	templateService := service.NewTemplateService(templateRepository, workspaceRepository, blockService)
	fileService, err := service.NewFileService(cfg)
	if err != nil {
		log.Fatalf("create file service: %v", err)
	}

	aiService := service.NewAIService(zvecClient, cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL, cfg.DeepSeekModel, cfg.ChatTopK, cfg.ChatSourceMaxScore)
	chatHistoryService := service.NewChatHistoryService(chatRepository, workspaceRepository)

	workspaceHandler := handler.NewWorkspaceHandler(workspaceService)
	blockHandler := handler.NewBlockHandler(blockService)
	fileHandler := handler.NewFileHandler(fileService)
	databaseHandler := handler.NewDatabaseHandler(databaseService)
	searchHandler := handler.NewSearchHandler(searchService)
	shareHandler := handler.NewShareHandler(shareService)
	templateHandler := handler.NewTemplateHandler(templateService)
	chatHandler := handler.NewChatHandler(aiService, workspaceService, chatHistoryService)

	engine := router.New(cfg, authHandler, workspaceHandler, blockHandler, fileHandler, databaseHandler, searchHandler, shareHandler, templateHandler, chatHandler)
	if err := engine.Run(":" + cfg.Port); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
