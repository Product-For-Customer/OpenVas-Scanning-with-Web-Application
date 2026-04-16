package entity

import "gorm.io/gorm"

type AppDiagramNode struct {
	gorm.Model

	DiagramID uint        `json:"diagram_id" gorm:"not null;index" valid:"required~DiagramID is required"`
	Diagram   *AppDiagram `json:"diagram"`

	TaskID string `json:"task_id" gorm:"type:varchar(255);not null;index" valid:"required~TaskID is required"`

	Label       string `json:"label" gorm:"type:varchar(255);not null" valid:"required~Label is required"`
	Description string `json:"description" gorm:"type:text"`
	Icon        string `json:"icon" gorm:"type:varchar(255)"`

	X float64 `json:"x" gorm:"type:decimal(10,4);not null" valid:"required~X is required"`
	Y float64 `json:"y" gorm:"type:decimal(10,4);not null" valid:"required~Y is required"`

	Width  float64 `json:"width" gorm:"type:decimal(10,4)"`
	Height float64 `json:"height" gorm:"type:decimal(10,4)"`

	ZIndex int `json:"z_index" gorm:"default:1"`

}