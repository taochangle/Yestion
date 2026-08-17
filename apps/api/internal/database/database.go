package database

import (
	"fmt"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database handle: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)

	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.Workspace{},
		&model.WorkspaceMember{},
		&model.Block{},
		&model.Database{},
		&model.DatabaseRow{},
		&model.Share{},
		&model.Template{},
		&model.Revision{},
	); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}
