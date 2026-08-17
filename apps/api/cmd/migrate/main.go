package main

import (
	"log"

	"github.com/my-notion/yestion/api/internal/config"
	"github.com/my-notion/yestion/api/internal/database"
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

	log.Println("database migration completed")
}
