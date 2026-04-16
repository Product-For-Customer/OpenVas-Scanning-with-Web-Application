package diagram

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateAppDiagramNodeInput struct {
	DiagramID   uint    `json:"diagram_id" binding:"required"`
	TaskID      string  `json:"task_id" binding:"required"`
	Label       string  `json:"label" binding:"required"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	X           float64 `json:"x" binding:"required"`
	Y           float64 `json:"y" binding:"required"`
	Width       float64 `json:"width"`
	Height      float64 `json:"height"`
	ZIndex      int     `json:"z_index"`
}

type UpdateAppDiagramNodeInput struct {
	DiagramID   *uint    `json:"diagram_id"`
	TaskID      *string  `json:"task_id"`
	Label       *string  `json:"label"`
	Description *string  `json:"description"`
	Icon        *string  `json:"icon"`
	X           *float64 `json:"x"`
	Y           *float64 `json:"y"`
	Width       *float64 `json:"width"`
	Height      *float64 `json:"height"`
	ZIndex      *int     `json:"z_index"`
}

type DiagramInfo struct {
	ID          uint        `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	ImageBase64 string      `json:"image_base64"`
	CreatedAt   interface{} `json:"created_at"`
	UpdatedAt   interface{} `json:"updated_at"`
}

type AppDiagramNodeResponse struct {
	ID          uint         `json:"id"`
	DiagramID   uint         `json:"diagram_id"`
	Diagram     *DiagramInfo `json:"diagram,omitempty"`
	TaskID      string       `json:"task_id"`
	Label       string       `json:"label"`
	Description string       `json:"description"`
	Icon        string       `json:"icon"`
	X           float64      `json:"x"`
	Y           float64      `json:"y"`
	Width       float64      `json:"width"`
	Height      float64      `json:"height"`
	ZIndex      int          `json:"z_index"`
	CreatedAt   interface{}  `json:"created_at"`
	UpdatedAt   interface{}  `json:"updated_at"`
}

func cleanString(value string) string {
	return strings.TrimSpace(value)
}

func cleanOptionalString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func mapDiagramInfo(diagram *entity.AppDiagram) *DiagramInfo {
	if diagram == nil || diagram.ID == 0 {
		return nil
	}

	return &DiagramInfo{
		ID:          diagram.ID,
		Name:        diagram.Name,
		Description: diagram.Description,
		ImageBase64: diagram.ImageBase64,
		CreatedAt:   diagram.CreatedAt,
		UpdatedAt:   diagram.UpdatedAt,
	}
}

func mapAppDiagramNodeResponse(node entity.AppDiagramNode) AppDiagramNodeResponse {
	return AppDiagramNodeResponse{
		ID:          node.ID,
		DiagramID:   node.DiagramID,
		Diagram:     mapDiagramInfo(node.Diagram),
		TaskID:      node.TaskID,
		Label:       node.Label,
		Description: node.Description,
		Icon:        node.Icon,
		X:           node.X,
		Y:           node.Y,
		Width:       node.Width,
		Height:      node.Height,
		ZIndex:      node.ZIndex,
		CreatedAt:   node.CreatedAt,
		UpdatedAt:   node.UpdatedAt,
	}
}

func CreateAppDiagramNode(c *gin.Context) {
	var input CreateAppDiagramNodeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var diagram entity.AppDiagram
	if err := db.First(&diagram, input.DiagramID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "diagram_id not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	node := entity.AppDiagramNode{
		DiagramID:   input.DiagramID,
		TaskID:      cleanString(input.TaskID),
		Label:       cleanString(input.Label),
		Description: cleanString(input.Description),
		Icon:        cleanString(input.Icon),
		X:           input.X,
		Y:           input.Y,
		Width:       input.Width,
		Height:      input.Height,
		ZIndex:      input.ZIndex,
	}

	if node.ZIndex == 0 {
		node.ZIndex = 1
	}

	ok, err := govalidator.ValidateStruct(node)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Create(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var createdNode entity.AppDiagramNode
	if err := db.Preload("Diagram").First(&createdNode, node.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created app diagram node",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create app diagram node success",
		"data":    mapAppDiagramNodeResponse(createdNode),
	})
}

func ListAppDiagramNodes(c *gin.Context) {
	db := config.DB()

	var nodes []entity.AppDiagramNode
	if err := db.Preload("Diagram").Order("id ASC").Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list app diagram nodes",
		})
		return
	}

	response := make([]AppDiagramNodeResponse, 0, len(nodes))
	for _, node := range nodes {
		response = append(response, mapAppDiagramNodeResponse(node))
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

func ListAppDiagramNodeByID(c *gin.Context) {
	id := c.Param("id")

	nid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app diagram node id",
		})
		return
	}

	db := config.DB()

	var node entity.AppDiagramNode
	if err := db.Preload("Diagram").First(&node, uint(nid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app diagram node not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get app diagram node by id",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": mapAppDiagramNodeResponse(node),
	})
}

func UpdateAppDiagramNodeByID(c *gin.Context) {
	id := c.Param("id")

	nid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app diagram node id",
		})
		return
	}

	var input UpdateAppDiagramNodeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var node entity.AppDiagramNode
	if err := db.First(&node, uint(nid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app diagram node not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if input.DiagramID == nil &&
		input.TaskID == nil &&
		input.Label == nil &&
		input.Description == nil &&
		input.Icon == nil &&
		input.X == nil &&
		input.Y == nil &&
		input.Width == nil &&
		input.Height == nil &&
		input.ZIndex == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	updatedNode := node

	if input.DiagramID != nil {
		var diagram entity.AppDiagram
		if err := db.First(&diagram, *input.DiagramID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "diagram_id not found",
				})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}
		updatedNode.DiagramID = *input.DiagramID
	}

	if input.TaskID != nil {
		updatedNode.TaskID = cleanOptionalString(input.TaskID)
	}

	if input.Label != nil {
		updatedNode.Label = cleanOptionalString(input.Label)
	}

	if input.Description != nil {
		updatedNode.Description = cleanOptionalString(input.Description)
	}

	if input.Icon != nil {
		updatedNode.Icon = cleanOptionalString(input.Icon)
	}

	if input.X != nil {
		updatedNode.X = *input.X
	}

	if input.Y != nil {
		updatedNode.Y = *input.Y
	}

	if input.Width != nil {
		updatedNode.Width = *input.Width
	}

	if input.Height != nil {
		updatedNode.Height = *input.Height
	}

	if input.ZIndex != nil {
		updatedNode.ZIndex = *input.ZIndex
	}

	ok, err := govalidator.ValidateStruct(updatedNode)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	updates := map[string]interface{}{}

	if input.DiagramID != nil {
		updates["diagram_id"] = updatedNode.DiagramID
	}

	if input.TaskID != nil {
		updates["task_id"] = updatedNode.TaskID
	}

	if input.Label != nil {
		updates["label"] = updatedNode.Label
	}

	if input.Description != nil {
		updates["description"] = updatedNode.Description
	}

	if input.Icon != nil {
		updates["icon"] = updatedNode.Icon
	}

	if input.X != nil {
		updates["x"] = updatedNode.X
	}

	if input.Y != nil {
		updates["y"] = updatedNode.Y
	}

	if input.Width != nil {
		updates["width"] = updatedNode.Width
	}

	if input.Height != nil {
		updates["height"] = updatedNode.Height
	}

	if input.ZIndex != nil {
		updates["z_index"] = updatedNode.ZIndex
	}

	if err := db.Model(&entity.AppDiagramNode{}).
		Where("id = ?", node.ID).
		Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var reloadedNode entity.AppDiagramNode
	if err := db.Preload("Diagram").First(&reloadedNode, node.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated app diagram node",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update app diagram node success",
		"data":    mapAppDiagramNodeResponse(reloadedNode),
	})
}

func DeleteAppDiagramNodeByID(c *gin.Context) {
	id := c.Param("id")

	nid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app diagram node id",
		})
		return
	}

	db := config.DB()

	var node entity.AppDiagramNode
	if err := db.First(&node, uint(nid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app diagram node not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Delete(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "app diagram node deleted successfully",
	})
}