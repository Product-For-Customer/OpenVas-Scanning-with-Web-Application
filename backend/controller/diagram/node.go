package diagram

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

type CreateAppDiagramNodeInput struct {
	DiagramID   uint    `json:"diagram_id" binding:"required"`
	TaskID      string  `json:"task_id"`
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
	AppUserID   uint        `json:"app_user_id"`
	CreatedAt   interface{} `json:"created_at"`
	UpdatedAt   interface{} `json:"updated_at"`
}

type AppDiagramNodeResponse struct {
	ID          uint         `json:"id"`
	DiagramID   uint         `json:"diagram_id"`
	Diagram     *DiagramInfo `json:"diagram,omitempty"`
	AppUserID   uint         `json:"app_user_id"`
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

type DiagramManageLimitTaskIDDTO struct {
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

func getLoginAppUserIDForDiagramNode(c *gin.Context) (uint, bool) {
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

func normalizeDiagramTaskIDForManageLimit(taskID string) string {
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

func compareDiagramTaskIDForManageLimit(a string, b string) int {
	a = normalizeDiagramTaskIDForManageLimit(a)
	b = normalizeDiagramTaskIDForManageLimit(b)

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

// FindDiagramManageLimitTaskIDs
//
// ใช้หา task_id กลุ่มแรกตามค่า TargetLimit ใน manage.go
//
// ตัวอย่าง:
// manage.TargetLimit = 5
// public.tasks มี task_id = 2, 3, 4, 5, 6, 7
// function นี้จะคืนค่า = 2, 3, 4, 5, 6
func FindDiagramManageLimitTaskIDs(db *gorm.DB) ([]string, error) {
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

	rows := make([]DiagramManageLimitTaskIDDTO, 0)

	if err := db.Raw(query, targetLimit).Scan(&rows).Error; err != nil {
		return nil, err
	}

	taskIDs := make([]string, 0, len(rows))
	seen := make(map[string]bool)

	for _, row := range rows {
		taskID := normalizeDiagramTaskIDForManageLimit(row.TaskID)

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
		return compareDiagramTaskIDForManageLimit(taskIDs[i], taskIDs[j]) < 0
	})

	return taskIDs, nil
}

func BuildDiagramManageLimitTaskIDSet(db *gorm.DB) (map[string]bool, error) {
	taskIDs, err := FindDiagramManageLimitTaskIDs(db)
	if err != nil {
		return nil, err
	}

	allowedTaskIDs := make(map[string]bool)

	for _, taskID := range taskIDs {
		cleanTaskID := normalizeDiagramTaskIDForManageLimit(taskID)

		if cleanTaskID == "" {
			continue
		}

		allowedTaskIDs[cleanTaskID] = true
	}

	return allowedTaskIDs, nil
}

func IsDiagramTaskIDInManageLimit(db *gorm.DB, taskID string) (bool, error) {
	taskID = normalizeDiagramTaskIDForManageLimit(taskID)

	if taskID == "" {
		return false, nil
	}

	allowedTaskIDs, err := BuildDiagramManageLimitTaskIDSet(db)
	if err != nil {
		return false, err
	}

	return allowedTaskIDs[taskID], nil
}

func filterAppDiagramNodesByManageLimit(nodes []entity.AppDiagramNode, allowedTaskIDs map[string]bool) []entity.AppDiagramNode {
	filteredNodes := make([]entity.AppDiagramNode, 0, len(nodes))

	for _, node := range nodes {
		taskID := normalizeDiagramTaskIDForManageLimit(node.TaskID)

		if taskID == "" || allowedTaskIDs[taskID] {
			filteredNodes = append(filteredNodes, node)
		}
	}

	return filteredNodes
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
		AppUserID:   diagram.AppUserID,
		CreatedAt:   diagram.CreatedAt,
		UpdatedAt:   diagram.UpdatedAt,
	}
}

func mapAppDiagramNodeResponse(node entity.AppDiagramNode) AppDiagramNodeResponse {
	return AppDiagramNodeResponse{
		ID:          node.ID,
		DiagramID:   node.DiagramID,
		Diagram:     mapDiagramInfo(node.Diagram),
		AppUserID:   node.AppUserID,
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
	loginAppUserID, ok := getLoginAppUserIDForDiagramNode(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

	var input CreateAppDiagramNodeInput
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

	taskID := normalizeDiagramTaskIDForManageLimit(input.TaskID)
	if taskID != "" {
		isAllowed, err := IsDiagramTaskIDInManageLimit(db, taskID)
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
	}

	var diagram entity.AppDiagram
	if err := db.First(&diagram, input.DiagramID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
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
		AppUserID:   loginAppUserID,
		TaskID:      taskID,
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
	if err := db.
		Preload("Diagram").
		Preload("AppUser").
		First(&createdNode, node.ID).Error; err != nil {
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

	allowedTaskIDs, err := BuildDiagramManageLimitTaskIDSet(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to find manage target limit task ids",
		})
		return
	}

	if len(allowedTaskIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data": make([]AppDiagramNodeResponse, 0),
		})
		return
	}

	var nodes []entity.AppDiagramNode
	if err := db.
		Preload("Diagram").
		Preload("AppUser").
		Order("id ASC").
		Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list app diagram nodes",
		})
		return
	}

	nodes = filterAppDiagramNodesByManageLimit(nodes, allowedTaskIDs)

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
	if err := db.
		Preload("Diagram").
		Preload("AppUser").
		First(&node, uint(nid)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	if node.TaskID != "" {
		isAllowed, err := IsDiagramTaskIDInManageLimit(db, node.TaskID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   err.Error(),
				"message": "failed to check manage target limit task ids",
			})
			return
		}

		if !isAllowed {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "app diagram node not found",
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": mapAppDiagramNodeResponse(node),
	})
}

func UpdateAppDiagramNodeByID(c *gin.Context) {
	loginAppUserID, ok := getLoginAppUserIDForDiagramNode(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

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

	var node entity.AppDiagramNode
	if err := db.First(&node, uint(nid)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	if node.TaskID != "" {
		isCurrentTaskAllowed, err := IsDiagramTaskIDInManageLimit(db, node.TaskID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   err.Error(),
				"message": "failed to check manage target limit task ids",
			})
			return
		}

		if !isCurrentTaskAllowed {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "current node task_id is outside manage target limit",
			})
			return
		}
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
	updatedNode.AppUserID = loginAppUserID

	if input.DiagramID != nil {
		var diagram entity.AppDiagram
		if err := db.First(&diagram, *input.DiagramID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
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
		taskID := normalizeDiagramTaskIDForManageLimit(*input.TaskID)
		if taskID != "" {
			isAllowed, err := IsDiagramTaskIDInManageLimit(db, taskID)
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
		}
		updatedNode.TaskID = taskID
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

	ok, err = govalidator.ValidateStruct(updatedNode)
	if !ok || err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	updates := map[string]interface{}{
		"app_user_id": loginAppUserID,
	}

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
	if err := db.
		Preload("Diagram").
		Preload("AppUser").
		First(&reloadedNode, node.ID).Error; err != nil {
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
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

	isAllowed, err := IsDiagramTaskIDInManageLimit(db, node.TaskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to check manage target limit task ids",
		})
		return
	}

	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "node task_id is outside manage target limit",
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