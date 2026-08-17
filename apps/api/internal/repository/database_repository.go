package repository

import (
	"context"
	"errors"

	"github.com/my-notion/yestion/api/internal/model"
	"gorm.io/gorm"
)

var (
	ErrDatabaseNotFound    = errors.New("database not found")
	ErrDatabaseRowNotFound = errors.New("database row not found")
)

type DatabaseRepository interface {
	Create(ctx context.Context, database *model.Database) error
	FindByID(ctx context.Context, id string) (*model.Database, error)
	FindByBlockID(ctx context.Context, blockID string) (*model.Database, error)
	Update(ctx context.Context, database *model.Database) error
	Delete(ctx context.Context, id string) error
	CreateRow(ctx context.Context, row *model.DatabaseRow) error
	FindRow(ctx context.Context, id string) (*model.DatabaseRow, error)
	ListRows(ctx context.Context, databaseID string) ([]model.DatabaseRow, error)
	MaxRowPosition(ctx context.Context, databaseID string) (int, error)
	UpdateRow(ctx context.Context, row *model.DatabaseRow) error
	DeleteRow(ctx context.Context, id string) error
}

type databaseRepository struct {
	db *gorm.DB
}

func NewDatabaseRepository(db *gorm.DB) DatabaseRepository {
	return &databaseRepository{db: db}
}

func (r *databaseRepository) Create(ctx context.Context, database *model.Database) error {
	return r.db.WithContext(ctx).Create(database).Error
}

func (r *databaseRepository) FindByID(ctx context.Context, id string) (*model.Database, error) {
	var database model.Database
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&database).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDatabaseNotFound
		}
		return nil, err
	}
	return &database, nil
}

func (r *databaseRepository) FindByBlockID(ctx context.Context, blockID string) (*model.Database, error) {
	var database model.Database
	if err := r.db.WithContext(ctx).Where("block_id = ?", blockID).First(&database).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDatabaseNotFound
		}
		return nil, err
	}
	return &database, nil
}

func (r *databaseRepository) Update(ctx context.Context, database *model.Database) error {
	return r.db.WithContext(ctx).Save(database).Error
}

func (r *databaseRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("database_id = ?", id).Delete(&model.DatabaseRow{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&model.Database{}).Error
	})
}

func (r *databaseRepository) CreateRow(ctx context.Context, row *model.DatabaseRow) error {
	return r.db.WithContext(ctx).Create(row).Error
}

func (r *databaseRepository) FindRow(ctx context.Context, id string) (*model.DatabaseRow, error) {
	var row model.DatabaseRow
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDatabaseRowNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *databaseRepository) ListRows(ctx context.Context, databaseID string) ([]model.DatabaseRow, error) {
	var rows []model.DatabaseRow
	err := r.db.WithContext(ctx).
		Where("database_id = ?", databaseID).
		Order("position ASC").
		Order("created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *databaseRepository) MaxRowPosition(ctx context.Context, databaseID string) (int, error) {
	var position int
	err := r.db.WithContext(ctx).
		Model(&model.DatabaseRow{}).
		Where("database_id = ?", databaseID).
		Select("COALESCE(MAX(position), 0)").
		Scan(&position).Error
	return position, err
}

func (r *databaseRepository) UpdateRow(ctx context.Context, row *model.DatabaseRow) error {
	return r.db.WithContext(ctx).Save(row).Error
}

func (r *databaseRepository) DeleteRow(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.DatabaseRow{}).Error
}
