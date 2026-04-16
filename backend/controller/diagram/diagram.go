package diagram

import (
	"net/http"
	"strconv"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateDiagramInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ImageBase64 string `json:"image_base64" binding:"required"`
}

type UpdateDiagramInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	ImageBase64 *string `json:"image_base64"`
}

type DiagramResponse struct {
	ID          uint        `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	ImageBase64 string      `json:"image_base64"`
	CreatedAt   interface{} `json:"created_at"`
	UpdatedAt   interface{} `json:"updated_at"`
}

func mapDiagramResponse(diagram entity.AppDiagram) DiagramResponse {
	return DiagramResponse{
		ID:          diagram.ID,
		Name:        diagram.Name,
		Description: diagram.Description,
		ImageBase64: diagram.ImageBase64,
		CreatedAt:   diagram.CreatedAt,
		UpdatedAt:   diagram.UpdatedAt,
	}
}

func CreateDiagram(c *gin.Context) {
	var input CreateDiagramInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	diagram := entity.AppDiagram{
		Name:        cleanString(input.Name),
		Description: cleanString(input.Description),
		ImageBase64: cleanString(input.ImageBase64),
	}

	ok, err := govalidator.ValidateStruct(diagram)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Create(&diagram).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var createdDiagram entity.AppDiagram
	if err := db.First(&createdDiagram, diagram.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created diagram",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create diagram success",
		"data":    mapDiagramResponse(createdDiagram),
	})
}

func ListDiagrams(c *gin.Context) {
	db := config.DB()

	var diagrams []entity.AppDiagram
	if err := db.Order("id ASC").Find(&diagrams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list diagrams",
		})
		return
	}

	response := make([]DiagramResponse, 0, len(diagrams))
	for _, d := range diagrams {
		response = append(response, mapDiagramResponse(d))
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

func ListDiagramByID(c *gin.Context) {
	id := c.Param("id")

	did, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid diagram id",
		})
		return
	}

	db := config.DB()

	var diagram entity.AppDiagram
	if err := db.First(&diagram, uint(did)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "diagram not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get diagram by id",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": mapDiagramResponse(diagram),
	})
}

func UpdateDiagramByID(c *gin.Context) {
	id := c.Param("id")

	did, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid diagram id",
		})
		return
	}

	var input UpdateDiagramInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var diagram entity.AppDiagram
	if err := db.First(&diagram, uint(did)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "diagram not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if input.Name == nil && input.Description == nil && input.ImageBase64 == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	updatedDiagram := diagram

	if input.Name != nil {
		updatedDiagram.Name = cleanOptionalString(input.Name)
	}

	if input.Description != nil {
		updatedDiagram.Description = cleanOptionalString(input.Description)
	}

	if input.ImageBase64 != nil {
		updatedDiagram.ImageBase64 = cleanOptionalString(input.ImageBase64)
	}

	ok, err := govalidator.ValidateStruct(updatedDiagram)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	updates := map[string]interface{}{}

	if input.Name != nil {
		updates["name"] = updatedDiagram.Name
	}

	if input.Description != nil {
		updates["description"] = updatedDiagram.Description
	}

	if input.ImageBase64 != nil {
		updates["image_base64"] = updatedDiagram.ImageBase64
	}

	if err := db.Model(&entity.AppDiagram{}).
		Where("id = ?", diagram.ID).
		Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var reloadedDiagram entity.AppDiagram
	if err := db.First(&reloadedDiagram, diagram.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated diagram",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update diagram success",
		"data":    mapDiagramResponse(reloadedDiagram),
	})
}

func DeleteDiagramByID(c *gin.Context) {
	id := c.Param("id")

	did, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid diagram id",
		})
		return
	}

	db := config.DB()

	var diagram entity.AppDiagram
	if err := db.First(&diagram, uint(did)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "diagram not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Delete(&diagram).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "diagram deleted successfully",
	})
}