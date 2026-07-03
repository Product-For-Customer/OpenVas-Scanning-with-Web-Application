package line

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateAppLineMasterInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description" binding:"required"`
	Token       string `json:"token" binding:"required"`
}

type UpdateAppLineMasterInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Token       *string `json:"token"`
}

type AppLineMasterResponse struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Token       string `json:"token"`
	AppUserID   uint   `json:"app_user_id"`
}

func getLoginAppUserIDForLineMaster(c *gin.Context) (uint, bool) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}

	switch v := userIDValue.(type) {
	case uint:
		if v == 0 {
			return 0, false
		}
		return v, true

	case uint64:
		if v == 0 {
			return 0, false
		}
		return uint(v), true

	case int:
		if v <= 0 {
			return 0, false
		}
		return uint(v), true

	case int64:
		if v <= 0 {
			return 0, false
		}
		return uint(v), true

	case float64:
		if v <= 0 {
			return 0, false
		}
		return uint(v), true

	default:
		return 0, false
	}
}

func mapAppLineMasterResponse(lineMaster entity.AppLineMaster) AppLineMasterResponse {
	return AppLineMasterResponse{
		ID:          lineMaster.ID,
		Name:        lineMaster.Name,
		Description: lineMaster.Description,
		Token:       lineMaster.Token,
		AppUserID:   lineMaster.AppUserID,
	}
}

func CreateAppLineMaster(c *gin.Context) {
	loginAppUserID, ok := getLoginAppUserIDForLineMaster(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

	var input CreateAppLineMasterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var appUser entity.AppUser
	if err := db.First(&appUser, loginAppUserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "login app user not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	lineMaster := entity.AppLineMaster{
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		Token:       strings.TrimSpace(input.Token),
		AppUserID:   loginAppUserID,
	}

	if ok, err := govalidator.ValidateStruct(lineMaster); !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	var existingName entity.AppLineMaster
	err := db.
		Where("LOWER(name) = LOWER(?)", lineMaster.Name).
		First(&existingName).Error

	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "app line master name already exists",
		})
		return
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to check existing app line master name",
		})
		return
	}

	var existingToken entity.AppLineMaster
	err = db.
		Where("token = ?", lineMaster.Token).
		First(&existingToken).Error

	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "app line master token already exists",
		})
		return
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to check existing app line master token",
		})
		return
	}

	if err := db.Create(&lineMaster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var createdLineMaster entity.AppLineMaster
	if err := db.
		Preload("AppUser").
		First(&createdLineMaster, lineMaster.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload created app line master",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create app line master success",
		"data":    mapAppLineMasterResponse(createdLineMaster),
	})
}

func ListAppLineMaster(c *gin.Context) {
	var lineMasters []entity.AppLineMaster

	db := config.DB()

	result := db.
		Preload("AppUser").
		Order("id asc").
		Find(&lineMasters)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": result.Error.Error(),
		})
		return
	}

	canManageLineSettings := permission.Has(c.GetUint("user_role_id"), "line_settings", true)

	response := make([]AppLineMasterResponse, 0, len(lineMasters))
	for _, item := range lineMasters {
		mapped := mapAppLineMasterResponse(item)
		if !canManageLineSettings {
			mapped.Token = ""
		}
		response = append(response, mapped)
	}

	c.JSON(http.StatusOK, response)
}

func UpdateAppLineMasterByID(c *gin.Context) {
	loginAppUserID, ok := getLoginAppUserIDForLineMaster(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

	id := c.Param("id")

	lineMasterID, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app line master id",
		})
		return
	}

	var input UpdateAppLineMasterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var appUser entity.AppUser
	if err := db.First(&appUser, loginAppUserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "login app user not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var lineMaster entity.AppLineMaster
	if err := db.First(&lineMaster, uint(lineMasterID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app line master not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if input.Name == nil && input.Description == nil && input.Token == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	updatedLineMaster := lineMaster
	updatedLineMaster.AppUserID = loginAppUserID

	if input.Name != nil {
		updatedLineMaster.Name = strings.TrimSpace(*input.Name)
	}

	if input.Description != nil {
		updatedLineMaster.Description = strings.TrimSpace(*input.Description)
	}

	if input.Token != nil {
		updatedLineMaster.Token = strings.TrimSpace(*input.Token)
	}

	if ok, err := govalidator.ValidateStruct(updatedLineMaster); !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if input.Name != nil {
		var existing entity.AppLineMaster
		err := db.
			Where(
				"LOWER(name) = LOWER(?) AND id <> ?",
				updatedLineMaster.Name,
				lineMaster.ID,
			).
			First(&existing).Error

		if err == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "app line master name already exists",
			})
			return
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to check existing app line master name",
			})
			return
		}
	}

	if input.Token != nil {
		var existing entity.AppLineMaster
		err := db.
			Where(
				"token = ? AND id <> ?",
				updatedLineMaster.Token,
				lineMaster.ID,
			).
			First(&existing).Error

		if err == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "app line master token already exists",
			})
			return
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to check existing app line master token",
			})
			return
		}
	}

	updates := map[string]interface{}{
		"app_user_id": loginAppUserID,
	}

	if input.Name != nil {
		updates["name"] = updatedLineMaster.Name
	}

	if input.Description != nil {
		updates["description"] = updatedLineMaster.Description
	}

	if input.Token != nil {
		updates["token"] = updatedLineMaster.Token
	}

	tx := db.
		Model(&entity.AppLineMaster{}).
		Where("id = ?", lineMaster.ID).
		Updates(updates)

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": tx.Error.Error(),
		})
		return
	}

	var updated entity.AppLineMaster
	if err := db.
		Preload("AppUser").
		First(&updated, lineMaster.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated app line master",
		})
		return
	}

	audit.Log(c, "line_master.updated", "line_master", id, fmt.Sprintf("updated LINE master %q", updated.Name))

	c.JSON(http.StatusOK, gin.H{
		"message": "update app line master success",
		"data":    mapAppLineMasterResponse(updated),
	})
}

func DeleteAppLineMasterByID(c *gin.Context) {
	id := c.Param("id")

	lineMasterID, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app line master id",
		})
		return
	}

	db := config.DB()

	var lineMaster entity.AppLineMaster
	if err := db.First(&lineMaster, uint(lineMasterID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app line master not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Delete(&lineMaster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	audit.Log(c, "line_master.deleted", "line_master", id, fmt.Sprintf("deleted LINE master %q", lineMaster.Name))

	c.JSON(http.StatusOK, gin.H{
		"message": "app line master deleted successfully",
	})
}