package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/my-notion/yestion/api/internal/model"
	"github.com/my-notion/yestion/api/internal/repository"
)

var (
	ErrDatabaseNotFound        = errors.New("database not found")
	ErrDatabaseRowNotFound     = errors.New("database row not found")
	ErrInvalidDatabaseProperty = errors.New("invalid database property")
)

type DatabaseService interface {
	Create(ctx context.Context, userID, workspaceID string, parentID *string, name string, properties []model.DatabaseProperty) (*model.Database, error)
	Get(ctx context.Context, userID, databaseID string) (*model.Database, error)
	GetByBlock(ctx context.Context, userID, blockID string) (*model.Database, error)
	Update(ctx context.Context, userID, databaseID, name string, properties []model.DatabaseProperty, views []model.DatabaseView) (*model.Database, error)
	Delete(ctx context.Context, userID, databaseID string) error
	CreateRow(ctx context.Context, userID, databaseID string, properties map[string]any) (*model.DatabaseRow, error)
	ListRows(ctx context.Context, userID, databaseID, sortBy, sortDirection string, filters []model.DatabaseFilter) ([]model.DatabaseRow, error)
	UpdateRow(ctx context.Context, userID, databaseID, rowID string, properties map[string]any) (*model.DatabaseRow, error)
	DeleteRow(ctx context.Context, userID, databaseID, rowID string) error
}

type databaseService struct {
	databases  repository.DatabaseRepository
	workspaces repository.WorkspaceRepository
	blocks     BlockService
}

func NewDatabaseService(
	databases repository.DatabaseRepository,
	workspaces repository.WorkspaceRepository,
	blocks BlockService,
) DatabaseService {
	return &databaseService{
		databases:  databases,
		workspaces: workspaces,
		blocks:     blocks,
	}
}

func (s *databaseService) Create(
	ctx context.Context,
	userID, workspaceID string,
	parentID *string,
	name string,
	properties []model.DatabaseProperty,
) (*model.Database, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Database"
	}

	block, err := s.blocks.Create(ctx, userID, workspaceID, parentID, "database", name)
	if err != nil {
		return nil, err
	}

	databaseID := uuid.NewString()
	if _, err := s.blocks.Update(ctx, userID, block.ID, "", map[string]any{
		"databaseId": databaseID,
	}); err != nil {
		return nil, err
	}

	normalizedProperties, err := normalizeProperties(properties, true)
	if err != nil {
		return nil, err
	}

	database := &model.Database{
		ID:               databaseID,
		BlockID:          block.ID,
		WorkspaceID:      workspaceID,
		Name:             name,
		PropertiesSchema: normalizedProperties,
		Views: []model.DatabaseView{
			{
				ID:   uuid.NewString(),
				Name: "Table",
				Type: "table",
			},
		},
	}

	if err := s.databases.Create(ctx, database); err != nil {
		return nil, err
	}
	return database, nil
}

func (s *databaseService) Get(ctx context.Context, userID, databaseID string) (*model.Database, error) {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}
	return database, nil
}

func (s *databaseService) GetByBlock(ctx context.Context, userID, blockID string) (*model.Database, error) {
	database, err := s.databases.FindByBlockID(ctx, blockID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}
	return database, nil
}

func (s *databaseService) Update(
	ctx context.Context,
	userID, databaseID, name string,
	properties []model.DatabaseProperty,
	views []model.DatabaseView,
) (*model.Database, error) {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}

	if strings.TrimSpace(name) != "" {
		database.Name = strings.TrimSpace(name)
	}

	if properties != nil {
		normalizedProperties, normalizeErr := normalizeProperties(properties, false)
		if normalizeErr != nil {
			return nil, normalizeErr
		}
		database.PropertiesSchema = normalizedProperties
	}

	if views != nil {
		database.Views = views
	}

	if err := s.databases.Update(ctx, database); err != nil {
		return nil, err
	}

	if _, err := s.blocks.Update(ctx, userID, database.BlockID, database.Name, map[string]any{
		"databaseId": database.ID,
	}); err != nil {
		return nil, err
	}

	return database, nil
}

func (s *databaseService) Delete(ctx context.Context, userID, databaseID string) error {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return err
	}

	if err := s.blocks.Delete(ctx, userID, database.BlockID); err != nil {
		return err
	}
	return s.databases.Delete(ctx, databaseID)
}

func (s *databaseService) CreateRow(
	ctx context.Context,
	userID, databaseID string,
	properties map[string]any,
) (*model.DatabaseRow, error) {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}

	page, err := s.blocks.Create(ctx, userID, database.WorkspaceID, &database.BlockID, "page", "Untitled")
	if err != nil {
		return nil, err
	}

	rowProperties := normalizeRowProperties(database.PropertiesSchema, properties)
	position, err := s.databases.MaxRowPosition(ctx, databaseID)
	if err != nil {
		return nil, err
	}

	rowID := uuid.NewString()
	row := &model.DatabaseRow{
		ID:         rowID,
		DatabaseID: databaseID,
		PageID:     page.ID,
		Properties: rowProperties,
		Position:   position + 1,
	}
	if err := s.databases.CreateRow(ctx, row); err != nil {
		return nil, err
	}

	title := ""
	if value, ok := rowProperties["title"].(string); ok {
		title = value
	}
	if _, err := s.blocks.Update(ctx, userID, page.ID, title, map[string]any{
		"databaseId": databaseID,
		"rowId":      rowID,
	}); err != nil {
		return nil, err
	}

	return row, nil
}

func (s *databaseService) ListRows(
	ctx context.Context,
	userID, databaseID, sortBy, sortDirection string,
	filters []model.DatabaseFilter,
) ([]model.DatabaseRow, error) {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}

	rows, err := s.databases.ListRows(ctx, databaseID)
	if err != nil {
		return nil, err
	}

	rows = filterRows(rows, filters)
	sortRows(rows, database.PropertiesSchema, sortBy, sortDirection)
	return rows, nil
}

func (s *databaseService) UpdateRow(
	ctx context.Context,
	userID, databaseID, rowID string,
	properties map[string]any,
) (*model.DatabaseRow, error) {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return nil, err
	}

	row, err := s.databases.FindRow(ctx, rowID)
	if err != nil {
		return nil, err
	}
	if row.DatabaseID != databaseID {
		return nil, repository.ErrDatabaseRowNotFound
	}

	merged := cloneMap(row.Properties)
	for key, value := range properties {
		merged[key] = value
	}
	row.Properties = normalizeRowProperties(database.PropertiesSchema, merged)

	if err := s.databases.UpdateRow(ctx, row); err != nil {
		return nil, err
	}

	if title, ok := row.Properties["title"].(string); ok {
		if _, err := s.blocks.Update(ctx, userID, row.PageID, title, nil); err != nil {
			return nil, err
		}
	}

	return row, nil
}

func (s *databaseService) DeleteRow(ctx context.Context, userID, databaseID, rowID string) error {
	database, err := s.databases.FindByID(ctx, databaseID)
	if err != nil {
		return err
	}
	if err := s.ensureAccess(ctx, database, userID); err != nil {
		return err
	}

	row, err := s.databases.FindRow(ctx, rowID)
	if err != nil {
		return err
	}
	if row.DatabaseID != databaseID {
		return repository.ErrDatabaseRowNotFound
	}

	if err := s.blocks.Delete(ctx, userID, row.PageID); err != nil {
		return err
	}
	return s.databases.DeleteRow(ctx, rowID)
}

func (s *databaseService) ensureAccess(ctx context.Context, database *model.Database, userID string) error {
	if _, err := s.workspaces.FindMember(ctx, database.WorkspaceID, userID); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return ErrForbidden
		}
		return err
	}
	return nil
}

func normalizeProperties(properties []model.DatabaseProperty, allowDefaults bool) ([]model.DatabaseProperty, error) {
	if len(properties) == 0 && allowDefaults {
		return defaultDatabaseProperties(), nil
	}

	seenNames := make(map[string]struct{})
	seenIDs := make(map[string]struct{})
	normalized := make([]model.DatabaseProperty, 0, len(properties))

	for _, property := range properties {
		id := strings.TrimSpace(property.ID)
		if id == "" {
			id = uuid.NewString()
		}
		if _, ok := seenIDs[id]; ok {
			return nil, fmt.Errorf("%w: duplicate id %q", ErrInvalidDatabaseProperty, id)
		}
		seenIDs[id] = struct{}{}

		name := strings.TrimSpace(property.Name)
		if name == "" {
			return nil, fmt.Errorf("%w: name is required", ErrInvalidDatabaseProperty)
		}
		lowerName := strings.ToLower(name)
		if _, ok := seenNames[lowerName]; ok {
			return nil, fmt.Errorf("%w: duplicate name %q", ErrInvalidDatabaseProperty, name)
		}
		seenNames[lowerName] = struct{}{}

		if !isSupportedPropertyType(property.Type) {
			return nil, fmt.Errorf("%w: unsupported type %q", ErrInvalidDatabaseProperty, property.Type)
		}

		property.ID = id
		property.Name = name
		property.Options = normalizeSelectOptions(property.Options)
		normalized = append(normalized, property)
	}

	return normalized, nil
}

func defaultDatabaseProperties() []model.DatabaseProperty {
	return []model.DatabaseProperty{
		{
			ID:   "title",
			Name: "Title",
			Type: model.DatabasePropertyText,
		},
		{
			ID:   uuid.NewString(),
			Name: "Status",
			Type: model.DatabasePropertySelect,
			Options: []model.DatabaseSelectOption{
				{ID: "not-started", Name: "Not started", Color: "zinc"},
				{ID: "in-progress", Name: "In progress", Color: "blue"},
				{ID: "done", Name: "Done", Color: "green"},
			},
		},
		{
			ID:   uuid.NewString(),
			Name: "Estimate",
			Type: model.DatabasePropertyNumber,
		},
		{
			ID:   uuid.NewString(),
			Name: "Due",
			Type: model.DatabasePropertyDate,
		},
		{
			ID:   uuid.NewString(),
			Name: "Done",
			Type: model.DatabasePropertyCheckbox,
		},
	}
}

func normalizeSelectOptions(options []model.DatabaseSelectOption) []model.DatabaseSelectOption {
	seen := make(map[string]struct{})
	normalized := make([]model.DatabaseSelectOption, 0, len(options))
	for _, option := range options {
		id := strings.TrimSpace(option.ID)
		if id == "" {
			id = uuid.NewString()
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		if strings.TrimSpace(option.Name) == "" {
			continue
		}
		option.ID = id
		option.Name = strings.TrimSpace(option.Name)
		normalized = append(normalized, option)
	}
	return normalized
}

func isSupportedPropertyType(propertyType model.DatabasePropertyType) bool {
	switch propertyType {
	case model.DatabasePropertyText,
		model.DatabasePropertyNumber,
		model.DatabasePropertySelect,
		model.DatabasePropertyDate,
		model.DatabasePropertyCheckbox:
		return true
	default:
		return false
	}
}

func normalizeRowProperties(properties []model.DatabaseProperty, input map[string]any) map[string]any {
	output := make(map[string]any, len(properties))
	for _, property := range properties {
		value, exists := input[property.ID]
		if !exists {
			value = defaultValueForProperty(property)
		}
		output[property.ID] = normalizePropertyValue(property, value)
	}
	return output
}

func normalizePropertyValue(property model.DatabaseProperty, value any) any {
	switch property.Type {
	case model.DatabasePropertyNumber:
		switch number := value.(type) {
		case float64:
			return number
		case float32:
			return float64(number)
		case int:
			return float64(number)
		case int64:
			return float64(number)
		case string:
			var parsed float64
			if _, err := fmt.Sscan(strings.TrimSpace(number), &parsed); err == nil {
				return parsed
			}
			return float64(0)
		default:
			return float64(0)
		}
	case model.DatabasePropertyCheckbox:
		boolean, _ := value.(bool)
		return boolean
	case model.DatabasePropertySelect:
		selected, _ := value.(string)
		for _, option := range property.Options {
			if option.ID == selected {
				return selected
			}
		}
		return ""
	case model.DatabasePropertyDate:
		date, _ := value.(string)
		return date
	default:
		if value == nil {
			return ""
		}
		return fmt.Sprint(value)
	}
}

func defaultValueForProperty(property model.DatabaseProperty) any {
	switch property.Type {
	case model.DatabasePropertyNumber:
		return float64(0)
	case model.DatabasePropertyCheckbox:
		return false
	case model.DatabasePropertySelect:
		if len(property.Options) > 0 {
			return property.Options[0].ID
		}
		return ""
	default:
		return ""
	}
}

func cloneMap(input map[string]any) map[string]any {
	output := make(map[string]any, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

func filterRows(rows []model.DatabaseRow, filters []model.DatabaseFilter) []model.DatabaseRow {
	filtered := make([]model.DatabaseRow, 0, len(rows))
	for _, row := range rows {
		if matchesAllFilters(row, filters) {
			filtered = append(filtered, row)
		}
	}
	return filtered
}

func matchesAllFilters(row model.DatabaseRow, filters []model.DatabaseFilter) bool {
	for _, filter := range filters {
		if !matchesFilter(row.Properties[filter.PropertyID], filter) {
			return false
		}
	}
	return true
}

func matchesFilter(value any, filter model.DatabaseFilter) bool {
	switch filter.Operator {
	case "equals":
		return valuesEqual(value, filter.Value)
	case "not_equals":
		return !valuesEqual(value, filter.Value)
	case "contains":
		return strings.Contains(strings.ToLower(fmt.Sprint(value)), strings.ToLower(fmt.Sprint(filter.Value)))
	case "greater_than":
		return compareValues(value, filter.Value) > 0
	case "less_than":
		return compareValues(value, filter.Value) < 0
	case "is_empty":
		return isEmptyValue(value)
	case "is_not_empty":
		return !isEmptyValue(value)
	default:
		return true
	}
}

func valuesEqual(left, right any) bool {
	if isEmptyValue(left) && isEmptyValue(right) {
		return true
	}
	return fmt.Sprint(left) == fmt.Sprint(right)
}

func isEmptyValue(value any) bool {
	if value == nil {
		return true
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed) == ""
	case bool:
		return !typed
	case float64:
		return typed == 0
	default:
		return false
	}
}

func compareValues(left, right any) int {
	leftString := fmt.Sprint(left)
	rightString := fmt.Sprint(right)
	if leftString < rightString {
		return -1
	}
	if leftString > rightString {
		return 1
	}
	return 0
}

func sortRows(rows []model.DatabaseRow, properties []model.DatabaseProperty, sortBy, sortDirection string) {
	sortBy = strings.TrimSpace(sortBy)
	if sortBy == "" {
		sort.SliceStable(rows, func(i, j int) bool {
			return rows[i].Position < rows[j].Position
		})
		return
	}

	descending := strings.EqualFold(sortDirection, "desc")
	sort.SliceStable(rows, func(i, j int) bool {
		left := rows[i].Properties[sortBy]
		right := rows[j].Properties[sortBy]
		comparison := compareValues(left, right)
		if comparison == 0 {
			return rows[i].Position < rows[j].Position
		}
		if descending {
			return comparison > 0
		}
		return comparison < 0
	})
}
