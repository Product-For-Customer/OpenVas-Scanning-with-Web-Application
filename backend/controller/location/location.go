package location

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

type CreateLocationInput struct {
	Location   string  `json:"location" binding:"required"`
	Building   string  `json:"building" binding:"required"`
	Floor      uint    `json:"floor" binding:"required"`
	Latitude   float64 `json:"latitude" binding:"required"`
	Longtitude float64 `json:"longtitude" binding:"required"`
	TaskID     string  `json:"task_id" binding:"required"`
}

type UpdateLocationInput struct {
	Location   *string  `json:"location"`
	Building   *string  `json:"building"`
	Floor      *uint    `json:"floor"`
	Latitude   *float64 `json:"latitude"`
	Longtitude *float64 `json:"longtitude"`
	TaskID     *string  `json:"task_id"`
}

type LocationResponse struct {
	ID         uint        `json:"id"`
	Location   string      `json:"location"`
	Building   string      `json:"building"`
	Floor      uint        `json:"floor"`
	Latitude   float64     `json:"latitude"`
	Longtitude float64     `json:"longtitude"`
	TaskID     string      `json:"task_id"`
	CreatedAt  interface{} `json:"created_at"`
	UpdatedAt  interface{} `json:"updated_at"`
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

func mapLocationResponse(loc entity.AppLocation) LocationResponse {
	return LocationResponse{
		ID:         loc.ID,
		Location:   loc.Location,
		Building:   loc.Building,
		Floor:      loc.Floor,
		Latitude:   loc.Latitude,
		Longtitude: loc.Longtitude,
		TaskID:     loc.TaskID,
		CreatedAt:  loc.CreatedAt,
		UpdatedAt:  loc.UpdatedAt,
	}
}

func CreateLocation(c *gin.Context) {
	var input CreateLocationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	location := entity.AppLocation{
		Location:   cleanString(input.Location),
		Building:   cleanString(input.Building),
		Floor:      input.Floor,
		Latitude:   input.Latitude,
		Longtitude: input.Longtitude,
		TaskID:     cleanString(input.TaskID),
	}

	ok, err := govalidator.ValidateStruct(location)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Create(&location).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var createdLocation entity.AppLocation
	if err := db.First(&createdLocation, location.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created location",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create location success",
		"data":    mapLocationResponse(createdLocation),
	})
}

func ListLocation(c *gin.Context) {
	db := config.DB()

	var locations []entity.AppLocation
	if err := db.
		Order("id ASC").
		Find(&locations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list locations",
		})
		return
	}

	response := make([]LocationResponse, 0, len(locations))
	for _, loc := range locations {
		response = append(response, mapLocationResponse(loc))
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

func ListLocationByID(c *gin.Context) {
	id := c.Param("id")

	lid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid location id",
		})
		return
	}

	db := config.DB()

	var location entity.AppLocation
	if err := db.First(&location, uint(lid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "location not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get location by id",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": mapLocationResponse(location),
	})
}

func UpdateLocationByID(c *gin.Context) {
	id := c.Param("id")

	lid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid location id",
		})
		return
	}

	var input UpdateLocationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var location entity.AppLocation
	if err := db.First(&location, uint(lid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "location not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	updatedLocation := location

	if input.Location != nil {
		updatedLocation.Location = cleanOptionalString(input.Location)
	}
	if input.Building != nil {
		updatedLocation.Building = cleanOptionalString(input.Building)
	}
	if input.Floor != nil {
		updatedLocation.Floor = *input.Floor
	}
	if input.Latitude != nil {
		updatedLocation.Latitude = *input.Latitude
	}
	if input.Longtitude != nil {
		updatedLocation.Longtitude = *input.Longtitude
	}
	if input.TaskID != nil {
		updatedLocation.TaskID = cleanOptionalString(input.TaskID)
	}

	ok, validateErr := govalidator.ValidateStruct(updatedLocation)
	if !ok || validateErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": validateErr.Error(),
		})
		return
	}

	updates := map[string]interface{}{}

	if input.Location != nil {
		updates["location"] = updatedLocation.Location
	}
	if input.Building != nil {
		updates["building"] = updatedLocation.Building
	}
	if input.Floor != nil {
		updates["floor"] = updatedLocation.Floor
	}
	if input.Latitude != nil {
		updates["latitude"] = updatedLocation.Latitude
	}
	if input.Longtitude != nil {
		updates["longtitude"] = updatedLocation.Longtitude
	}
	if input.TaskID != nil {
		updates["task_id"] = updatedLocation.TaskID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	if err := db.Model(&entity.AppLocation{}).
		Where("id = ?", location.ID).
		Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var reloaded entity.AppLocation
	if err := db.First(&reloaded, location.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated location",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update location success",
		"data":    mapLocationResponse(reloaded),
	})
}

func DeleteLocationByID(c *gin.Context) {
	id := c.Param("id")

	lid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid location id",
		})
		return
	}

	db := config.DB()

	var location entity.AppLocation
	if err := db.First(&location, uint(lid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "location not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Delete(&location).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "location deleted successfully",
	})
}