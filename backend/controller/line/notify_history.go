package line

import (
	"net/http"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

type HistoryNotifyResponse struct {
	ID          uint   `json:"id"`
	Subject     string `json:"subject"`
	DateTime    string `json:"datetime"`
	Description string `json:"description"`
	Status      string `json:"status"`
	StatusID    *uint  `json:"status_id"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type DeleteHistoryNotifyByIDsInput struct {
	IDs []uint `json:"ids" binding:"required"`
}

func mapHistoryNotifyResponse(h entity.AppHistoryNotify) HistoryNotifyResponse {
	status := ""
	if h.AppStatusNotify != nil {
		status = h.AppStatusNotify.Status
	}

	return HistoryNotifyResponse{
		ID:          h.ID,
		Subject:     h.Subject,
		DateTime:    h.DateTime.Format("2006-01-02 15:04:05"),
		Description: h.Description,
		Status:      status,
		StatusID:    h.AppStatusNotifyID,
		CreatedAt:   h.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:   h.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GET /history-notifies
func ListHistoryNotify(c *gin.Context) {
	var historyNotifies []entity.AppHistoryNotify

	db := config.DB()
	result := db.Preload("AppStatusNotify").Order("created_at DESC").Find(&historyNotifies)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	response := make([]HistoryNotifyResponse, 0, len(historyNotifies))
	for _, item := range historyNotifies {
		response = append(response, mapHistoryNotifyResponse(item))
	}

	c.JSON(http.StatusOK, response)
}

// DELETE /delete-history-notifies
func DeleteHistoryNotifyByIDs(c *gin.Context) {
	var input DeleteHistoryNotifyByIDsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids is required"})
		return
	}

	db := config.DB()

	var existing []entity.AppHistoryNotify
	if err := db.Where("id IN ?", input.IDs).Find(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(existing) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no history notify records found"})
		return
	}

	tx := db.Where("id IN ?", input.IDs).Delete(&entity.AppHistoryNotify{})
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": tx.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "history notify records deleted successfully",
		"deleted_count": tx.RowsAffected,
		"requested_ids": input.IDs,
	})
}