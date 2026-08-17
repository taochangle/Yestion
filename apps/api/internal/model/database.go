package model

import "time"

type DatabasePropertyType string

const (
	DatabasePropertyText     DatabasePropertyType = "text"
	DatabasePropertyNumber   DatabasePropertyType = "number"
	DatabasePropertySelect   DatabasePropertyType = "select"
	DatabasePropertyDate     DatabasePropertyType = "date"
	DatabasePropertyCheckbox DatabasePropertyType = "checkbox"
)

type DatabaseSelectOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type DatabaseProperty struct {
	ID      string                 `json:"id"`
	Name    string                 `json:"name"`
	Type    DatabasePropertyType   `json:"type"`
	Options []DatabaseSelectOption `json:"options,omitempty"`
}

type DatabaseSort struct {
	PropertyID string `json:"propertyId"`
	Direction  string `json:"direction"`
}

type DatabaseFilter struct {
	PropertyID string `json:"propertyId"`
	Operator   string `json:"operator"`
	Value      any    `json:"value"`
}

type DatabaseView struct {
	ID      string           `json:"id"`
	Name    string           `json:"name"`
	Type    string           `json:"type"`
	Sort    *DatabaseSort    `json:"sort,omitempty"`
	Filters []DatabaseFilter `json:"filters"`
}

type Database struct {
	ID               string             `gorm:"type:uuid;primaryKey" json:"id"`
	BlockID          string             `gorm:"type:uuid;uniqueIndex;not null" json:"blockId"`
	WorkspaceID      string             `gorm:"type:uuid;index;not null" json:"workspaceId"`
	Name             string             `gorm:"size:255;not null" json:"name"`
	PropertiesSchema []DatabaseProperty `gorm:"type:jsonb;serializer:json" json:"propertiesSchema"`
	Views            []DatabaseView     `gorm:"type:jsonb;serializer:json" json:"views"`
	CreatedAt        time.Time          `json:"createdAt"`
	UpdatedAt        time.Time          `json:"updatedAt"`
}

type DatabaseRow struct {
	ID         string         `gorm:"type:uuid;primaryKey" json:"id"`
	DatabaseID string         `gorm:"type:uuid;index;not null" json:"databaseId"`
	PageID     string         `gorm:"type:uuid;uniqueIndex;not null" json:"pageId"`
	Properties map[string]any `gorm:"type:jsonb;serializer:json" json:"properties"`
	Position   int            `json:"position"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
}
