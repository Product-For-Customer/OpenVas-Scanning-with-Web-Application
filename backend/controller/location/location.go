package location

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/manage"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateLocationInput struct {
	Location   string  `json:"location" binding:"required"`
	Latitude   float64 `json:"latitude" binding:"required"`
	Longtitude float64 `json:"longtitude" binding:"required"`
	TaskID     string  `json:"task_id" binding:"required"`
}

type UpdateLocationInput struct {
	Location   *string  `json:"location"`
	Latitude   *float64 `json:"latitude"`
	Longtitude *float64 `json:"longtitude"`
	TaskID     *string  `json:"task_id"`
}

type LocationResponse struct {
	ID         uint        `json:"id"`
	Location   string      `json:"location"`
	Latitude   float64     `json:"latitude"`
	Longtitude float64     `json:"longtitude"`
	TaskID     string      `json:"task_id"`
	AppUserID  uint        `json:"app_user_id"`
	CreatedAt  interface{} `json:"created_at"`
	UpdatedAt  interface{} `json:"updated_at"`
}

type LocationManageLimitTaskIDDTO struct {
	TaskID string `gorm:"column:task_id"`
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

func getLoginAppUserIDForLocation(c *gin.Context) (uint, bool) {
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

func normalizeLocationTaskIDForManageLimit(taskID string) string {
	taskID = strings.TrimSpace(taskID)

	if taskID == "" {
		return ""
	}

	taskIDNumber, err := strconv.ParseInt(taskID, 10, 64)
	if err == nil {
		return strconv.FormatInt(taskIDNumber, 10)
	}

	return taskID
}

func compareLocationTaskIDForManageLimit(a string, b string) int {
	a = normalizeLocationTaskIDForManageLimit(a)
	b = normalizeLocationTaskIDForManageLimit(b)

	if a == "" && b == "" {
		return 0
	}

	if a == "" {
		return 1
	}

	if b == "" {
		return -1
	}

	aNumber, aErr := strconv.ParseInt(a, 10, 64)
	bNumber, bErr := strconv.ParseInt(b, 10, 64)

	if aErr == nil && bErr == nil {
		if aNumber < bNumber {
			return -1
		}

		if aNumber > bNumber {
			return 1
		}

		return 0
	}

	return strings.Compare(a, b)
}

// FindLocationManageLimitTaskIDs
//
// ใช้หา task_id กลุ่มแรกตามค่า TargetLimit ใน manage.go
//
// ตัวอย่าง:
// manage.TargetLimit = 5
// public.tasks มี task_id = 2, 3, 4, 5, 6, 7
// function นี้จะคืนค่า = 2, 3, 4, 5, 6
func FindLocationManageLimitTaskIDs(db *gorm.DB) ([]string, error) {
	targetLimit := manage.GetTargetLimit()

	if targetLimit <= 0 {
		return make([]string, 0), nil
	}

	query := `
SELECT
  t.id::text AS task_id
FROM public.tasks t
WHERE t.id IS NOT NULL
ORDER BY
  t.id ASC
LIMIT ?;
`

	rows := make([]LocationManageLimitTaskIDDTO, 0)

	if err := db.Raw(query, targetLimit).Scan(&rows).Error; err != nil {
		return nil, err
	}

	taskIDs := make([]string, 0, len(rows))
	seen := make(map[string]bool)

	for _, row := range rows {
		taskID := normalizeLocationTaskIDForManageLimit(row.TaskID)

		if taskID == "" {
			continue
		}

		if seen[taskID] {
			continue
		}

		seen[taskID] = true
		taskIDs = append(taskIDs, taskID)
	}

	sort.SliceStable(taskIDs, func(i int, j int) bool {
		return compareLocationTaskIDForManageLimit(taskIDs[i], taskIDs[j]) < 0
	})

	return taskIDs, nil
}

func BuildLocationManageLimitTaskIDSet(db *gorm.DB) (map[string]bool, error) {
	taskIDs, err := FindLocationManageLimitTaskIDs(db)
	if err != nil {
		return nil, err
	}

	allowedTaskIDs := make(map[string]bool)

	for _, taskID := range taskIDs {
		cleanTaskID := normalizeLocationTaskIDForManageLimit(taskID)

		if cleanTaskID == "" {
			continue
		}

		allowedTaskIDs[cleanTaskID] = true
	}

	return allowedTaskIDs, nil
}

func IsLocationTaskIDInManageLimit(db *gorm.DB, taskID string) (bool, error) {
	taskID = normalizeLocationTaskIDForManageLimit(taskID)

	if taskID == "" {
		return false, nil
	}

	allowedTaskIDs, err := BuildLocationManageLimitTaskIDSet(db)
	if err != nil {
		return false, err
	}

	return allowedTaskIDs[taskID], nil
}

func filterLocationsByManageLimit(locations []entity.AppLocation, allowedTaskIDs map[string]bool) []entity.AppLocation {
	filtered := make([]entity.AppLocation, 0, len(locations))

	for _, loc := range locations {
		taskID := normalizeLocationTaskIDForManageLimit(loc.TaskID)

		if allowedTaskIDs[taskID] {
			filtered = append(filtered, loc)
		}
	}

	return filtered
}

func mapLocationResponse(loc entity.AppLocation) LocationResponse {
	return LocationResponse{
		ID:         loc.ID,
		Location:   loc.Location,
		Latitude:   loc.Latitude,
		Longtitude: loc.Longtitude,
		TaskID:     loc.TaskID,
		AppUserID:  loc.AppUserID,
		CreatedAt:  loc.CreatedAt,
		UpdatedAt:  loc.UpdatedAt,
	}
}

func CreateLocation(c *gin.Context) {
	loginAppUserID, ok := getLoginAppUserIDForLocation(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

	var input CreateLocationInput
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

	taskID := normalizeLocationTaskIDForManageLimit(input.TaskID)
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_id is required",
		})
		return
	}

	isAllowed, err := IsLocationTaskIDInManageLimit(db, taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to check manage target limit task ids",
		})
		return
	}

	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_id is outside manage target limit",
		})
		return
	}

	location := entity.AppLocation{
		Location:   cleanString(input.Location),
		Latitude:   input.Latitude,
		Longtitude: input.Longtitude,
		TaskID:     taskID,
		AppUserID:  loginAppUserID,
	}

	ok, err = govalidator.ValidateStruct(location)
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
	if err := db.
		Preload("AppUser").
		First(&createdLocation, location.ID).Error; err != nil {
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

	allowedTaskIDs, err := BuildLocationManageLimitTaskIDSet(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to find manage target limit task ids",
		})
		return
	}

	if len(allowedTaskIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data": make([]LocationResponse, 0),
		})
		return
	}

	var locations []entity.AppLocation
	if err := db.
		Preload("AppUser").
		Order("id ASC").
		Find(&locations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list locations",
		})
		return
	}

	locations = filterLocationsByManageLimit(locations, allowedTaskIDs)

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
	if err := db.
		Preload("AppUser").
		First(&location, uint(lid)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	isAllowed, err := IsLocationTaskIDInManageLimit(db, location.TaskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to check manage target limit task ids",
		})
		return
	}

	if !isAllowed {
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
	loginAppUserID, ok := getLoginAppUserIDForLocation(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

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

	var location entity.AppLocation
	if err := db.First(&location, uint(lid)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	isCurrentTaskAllowed, err := IsLocationTaskIDInManageLimit(db, location.TaskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to check manage target limit task ids",
		})
		return
	}

	if !isCurrentTaskAllowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "current location task_id is outside manage target limit",
		})
		return
	}

	if input.Location == nil &&
		input.Latitude == nil &&
		input.Longtitude == nil &&
		input.TaskID == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	updatedLocation := location
	updatedLocation.AppUserID = loginAppUserID

	if input.Location != nil {
		updatedLocation.Location = cleanOptionalString(input.Location)
	}

	if input.Latitude != nil {
		updatedLocation.Latitude = *input.Latitude
	}

	if input.Longtitude != nil {
		updatedLocation.Longtitude = *input.Longtitude
	}

	if input.TaskID != nil {
		taskID := normalizeLocationTaskIDForManageLimit(*input.TaskID)
		if taskID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "task_id is required",
			})
			return
		}

		isAllowed, err := IsLocationTaskIDInManageLimit(db, taskID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   err.Error(),
				"message": "failed to check manage target limit task ids",
			})
			return
		}

		if !isAllowed {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "task_id is outside manage target limit",
			})
			return
		}

		updatedLocation.TaskID = taskID
	}

	ok, validateErr := govalidator.ValidateStruct(updatedLocation)
	if !ok || validateErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": validateErr.Error(),
		})
		return
	}

	updates := map[string]interface{}{
		"app_user_id": loginAppUserID,
	}

	if input.Location != nil {
		updates["location"] = updatedLocation.Location
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

	if err := db.Model(&entity.AppLocation{}).
		Where("id = ?", location.ID).
		Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	var reloaded entity.AppLocation
	if err := db.
		Preload("AppUser").
		First(&reloaded, location.ID).Error; err != nil {
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	isAllowed, err := IsLocationTaskIDInManageLimit(db, location.TaskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to check manage target limit task ids",
		})
		return
	}

	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "location task_id is outside manage target limit",
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