package location

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateLocationInput struct {
	Location    string  `json:"location" binding:"required"`
	Building    string  `json:"building" binding:"required"`
	Floor       uint    `json:"floor" binding:"required"`
	Latitude    float64 `json:"latitude" binding:"required"`
	Longtitude  float64 `json:"longtitude" binding:"required"`
	AppTargetID uint    `json:"app_target_id" binding:"required"`
}

type UpdateLocationInput struct {
	Location    *string  `json:"location"`
	Building    *string  `json:"building"`
	Floor       *uint    `json:"floor"`
	Latitude    *float64 `json:"latitude"`
	Longtitude  *float64 `json:"longtitude"`
	AppTargetID *uint    `json:"app_target_id"`
}

type CreateTargetInput struct {
	Name       string `json:"name" binding:"required"`
	IpHost     string `json:"ip_host" binding:"required"`
	MacAddress string `json:"mac_address"`
}

type UpdateTargetInput struct {
	Name       *string `json:"name"`
	IpHost     *string `json:"ip_host"`
	MacAddress *string `json:"mac_address"`
}

type TargetMiniResponse struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	IpHost     string `json:"ip_host"`
	MacAddress string `json:"mac_address"`
}

type LocationResponse struct {
	ID          uint               `json:"id"`
	Location    string             `json:"location"`
	Building    string             `json:"building"`
	Floor       uint               `json:"floor"`
	Latitude    float64            `json:"latitude"`
	Longtitude  float64            `json:"longtitude"`
	AppTargetID uint               `json:"app_target_id"`
	AppTarget   TargetMiniResponse `json:"app_target"`
	CreatedAt   interface{}        `json:"created_at"`
	UpdatedAt   interface{}        `json:"updated_at"`
}

type AppTargetResponse struct {
	ID         uint        `json:"id"`
	Name       string      `json:"name"`
	IpHost     string      `json:"ip_host"`
	MacAddress string      `json:"mac_address"`
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
	targetResp := TargetMiniResponse{}

	if loc.AppTarget != nil {
		targetResp = TargetMiniResponse{
			ID:         loc.AppTarget.ID,
			Name:       loc.AppTarget.Name,
			IpHost:     loc.AppTarget.IpHost,
			MacAddress: loc.AppTarget.MacAddress,
		}
	}

	return LocationResponse{
		ID:          loc.ID,
		Location:    loc.Location,
		Building:    loc.Building,
		Floor:       loc.Floor,
		Latitude:    loc.Latitude,
		Longtitude:  loc.Longtitude,
		AppTargetID: loc.AppTargetID,
		AppTarget:   targetResp,
		CreatedAt:   loc.CreatedAt,
		UpdatedAt:   loc.UpdatedAt,
	}
}

func mapAppTargetResponse(t entity.AppTarget) AppTargetResponse {
	return AppTargetResponse{
		ID:         t.ID,
		Name:       t.Name,
		IpHost:     t.IpHost,
		MacAddress: t.MacAddress,
		CreatedAt:  t.CreatedAt,
		UpdatedAt:  t.UpdatedAt,
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

	var target entity.AppTarget
	if err := db.First(&target, input.AppTargetID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "app target not found",
		})
		return
	}

	locationName := strings.TrimSpace(input.Location)
	buildingName := strings.TrimSpace(input.Building)

	if locationName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "location cannot be empty",
		})
		return
	}

	if buildingName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "building cannot be empty",
		})
		return
	}

	location := entity.AppLocation{
		Location:    locationName,
		Building:    buildingName,
		Floor:       input.Floor,
		Latitude:    input.Latitude,
		Longtitude:  input.Longtitude,
		AppTargetID: input.AppTargetID,
	}

	if err := db.Create(&location).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Preload("AppTarget").First(&location, location.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created location",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create location success",
		"data":    mapLocationResponse(location),
	})
}

func ListLocation(c *gin.Context) {
	var locations []entity.AppLocation

	db := config.DB()
	result := db.Preload("AppTarget").Order("id asc").Find(&locations)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": result.Error.Error(),
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

	var location entity.AppLocation

	db := config.DB()
	result := db.Preload("AppTarget").First(&location, uint(lid))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "location not found",
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
	if err := db.Preload("AppTarget").First(&location, uint(lid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "location not found",
		})
		return
	}

	updates := map[string]interface{}{}

	if input.Location != nil {
		newLocation := strings.TrimSpace(*input.Location)
		if newLocation == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "location cannot be empty",
			})
			return
		}
		updates["location"] = newLocation
	}

	if input.Building != nil {
		newBuilding := strings.TrimSpace(*input.Building)
		if newBuilding == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "building cannot be empty",
			})
			return
		}
		updates["building"] = newBuilding
	}

	if input.Floor != nil {
		updates["floor"] = *input.Floor
	}

	if input.Latitude != nil {
		updates["latitude"] = *input.Latitude
	}

	if input.Longtitude != nil {
		updates["longtitude"] = *input.Longtitude
	}

	if input.AppTargetID != nil {
		var target entity.AppTarget
		if err := db.First(&target, *input.AppTargetID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "app target not found",
			})
			return
		}
		updates["app_target_id"] = *input.AppTargetID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	tx := db.Model(&entity.AppLocation{}).
		Where("id = ?", location.ID).
		Updates(updates)

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": tx.Error.Error(),
		})
		return
	}

	var updatedLocation entity.AppLocation
	if err := db.Preload("AppTarget").First(&updatedLocation, location.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated location",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update location success",
		"data":    mapLocationResponse(updatedLocation),
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

func CreateTarget(c *gin.Context) {
	var input CreateTargetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	name := cleanString(input.Name)
	ipHost := cleanString(input.IpHost)
	macAddress := cleanString(input.MacAddress)

	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "name cannot be empty",
		})
		return
	}

	if ipHost == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ip_host cannot be empty",
		})
		return
	}

	db := config.DB()

	target := entity.AppTarget{
		Name:       name,
		IpHost:     ipHost,
		MacAddress: macAddress,
	}

	if err := db.Create(&target).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.First(&target, target.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created target",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create target success",
		"data":    mapAppTargetResponse(target),
	})
}

func ListAppTarget(c *gin.Context) {
	var targets []entity.AppTarget

	db := config.DB()
	result := db.Order("id asc").Find(&targets)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": result.Error.Error(),
		})
		return
	}

	response := make([]AppTargetResponse, 0, len(targets))
	for _, t := range targets {
		response = append(response, mapAppTargetResponse(t))
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}

func ListAppTargetByID(c *gin.Context) {
	id := c.Param("id")

	tid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid target id",
		})
		return
	}

	db := config.DB()

	var target entity.AppTarget
	if err := db.First(&target, uint(tid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "app target not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": mapAppTargetResponse(target),
	})
}

func UpdateTargetByID(c *gin.Context) {
	id := c.Param("id")

	tid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid target id",
		})
		return
	}

	var input UpdateTargetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var target entity.AppTarget
	if err := db.First(&target, uint(tid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "app target not found",
		})
		return
	}

	updates := map[string]interface{}{}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "name cannot be empty",
			})
			return
		}
		updates["name"] = name
	}

	if input.IpHost != nil {
		ipHost := strings.TrimSpace(*input.IpHost)
		if ipHost == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ip_host cannot be empty",
			})
			return
		}
		updates["ip_host"] = ipHost
	}

	if input.MacAddress != nil {
		updates["mac_address"] = cleanOptionalString(input.MacAddress)
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	if err := db.Model(&entity.AppTarget{}).Where("id = ?", target.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var updatedTarget entity.AppTarget
	if err := db.First(&updatedTarget, target.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated target",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update target success",
		"data":    mapAppTargetResponse(updatedTarget),
	})
}

func DeleteTargetByID(c *gin.Context) {
	id := c.Param("id")

	tid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid target id",
		})
		return
	}

	db := config.DB()

	var target entity.AppTarget
	if err := db.First(&target, uint(tid)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app target not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Delete(&target).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "target deleted successfully",
	})
}