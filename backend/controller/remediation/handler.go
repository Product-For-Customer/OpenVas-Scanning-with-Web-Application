package remediation

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ownerDTO / ticketDTO exist because entity.AppUser has no json tags of its
// own (its fields serialize as "ID"/"Email"/"Password"/... in Go's default
// casing) — returning it directly, as entity.RemediationTicket.Owner would,
// leaks the bcrypt password hash to the client and doesn't match the
// frontend's expected snake_case keys. Every response here goes through
// mapTicketDTO instead of serializing the entity directly.
type ownerDTO struct {
	ID        uint   `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type ticketDTO struct {
	ID          uint       `json:"id"`
	TaskID      string     `json:"task_id"`
	HostIP      string     `json:"host_ip"`
	NVTOid      string     `json:"nvt_oid"`
	VulnName    string     `json:"vuln_name"`
	Severity    float64    `json:"severity"`
	Status      string     `json:"status"`
	OwnerUserID *uint      `json:"owner_user_id"`
	Owner       *ownerDTO  `json:"owner"`
	DueDate     *time.Time `json:"due_date"`
	Notes       string     `json:"notes"`
	CreatedByID uint       `json:"created_by_id"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func mapTicketDTO(t entity.RemediationTicket) ticketDTO {
	dto := ticketDTO{
		ID:          t.ID,
		TaskID:      t.TaskID,
		HostIP:      t.HostIP,
		NVTOid:      t.NVTOid,
		VulnName:    t.VulnName,
		Severity:    t.Severity,
		Status:      t.Status,
		OwnerUserID: t.OwnerUserID,
		DueDate:     t.DueDate,
		Notes:       t.Notes,
		CreatedByID: t.CreatedByID,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
	if t.Owner != nil {
		dto.Owner = &ownerDTO{
			ID:        t.Owner.ID,
			Email:     t.Owner.Email,
			FirstName: t.Owner.FirstName,
			LastName:  t.Owner.LastName,
		}
	}
	return dto
}

func mapTicketDTOs(list []entity.RemediationTicket) []ticketDTO {
	out := make([]ticketDTO, 0, len(list))
	for _, t := range list {
		out = append(out, mapTicketDTO(t))
	}
	return out
}

// GET /remediation-tickets — optional filters: status, host_ip, task_id, owner_user_id
func ListRemediationTickets(c *gin.Context) {
	db := config.DB()
	query := db.Preload("Owner").Model(&entity.RemediationTicket{})

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if hostIP := c.Query("host_ip"); hostIP != "" {
		query = query.Where("host_ip = ?", hostIP)
	}
	if taskID := c.Query("task_id"); taskID != "" {
		query = query.Where("task_id = ?", taskID)
	}
	if ownerIDStr := c.Query("owner_user_id"); ownerIDStr != "" {
		if ownerID, err := strconv.ParseUint(ownerIDStr, 10, 64); err == nil {
			query = query.Where("owner_user_id = ?", uint(ownerID))
		}
	}

	var list []entity.RemediationTicket
	if err := query.Order("due_date IS NULL, due_date ASC, severity DESC").Find(&list).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": mapTicketDTOs(list)})
}

// GET /remediation-tickets/summary — counts per status, for a dashboard widget.
func GetRemediationSummary(c *gin.Context) {
	db := config.DB()
	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	if err := db.Model(&entity.RemediationTicket{}).
		Select("status, count(*) as count").
		Group("status").
		Scan(&rows).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	counts := map[string]int64{}
	for status := range entity.RemediationTicketStatuses {
		counts[status] = 0
	}
	var total int64
	for _, r := range rows {
		counts[r.Status] = r.Count
		total += r.Count
	}

	var overdue int64
	db.Model(&entity.RemediationTicket{}).
		Where("due_date IS NOT NULL AND due_date < ? AND status NOT IN ?", time.Now(), []string{"fixed", "risk_accepted", "false_positive"}).
		Count(&overdue)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"total":         total,
		"by_status":     counts,
		"overdue_count": overdue,
	}})
}

// GET /remediation-tickets/:id
func GetRemediationTicket(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	var item entity.RemediationTicket
	if err := db.Preload("Owner").First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": mapTicketDTO(item)})
}

type createTicketInput struct {
	TaskID      string  `json:"task_id"`
	HostIP      string  `json:"host_ip" binding:"required"`
	NVTOid      string  `json:"nvt_oid"`
	VulnName    string  `json:"vuln_name" binding:"required"`
	Severity    float64 `json:"severity"`
	Status      string  `json:"status"`
	OwnerUserID *uint   `json:"owner_user_id"`
	DueDate     *string `json:"due_date"` // RFC3339
	Notes       string  `json:"notes"`
}

func parseDueDate(raw *string) (*time.Time, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *raw)
	if err != nil {
		return nil, fmt.Errorf("due_date must be an RFC3339 timestamp")
	}
	return &t, nil
}

func clampSeverity(s float64) float64 {
	if s < 0 {
		return 0
	}
	if s > 10 {
		return 10
	}
	return s
}

func loadOwnerFor(db *gorm.DB, item *entity.RemediationTicket) {
	if item.OwnerUserID == nil {
		return
	}
	var owner entity.AppUser
	if db.First(&owner, *item.OwnerUserID).Error == nil {
		item.Owner = &owner
	}
}

// POST /remediation-tickets
func CreateRemediationTicket(c *gin.Context) {
	var input createTicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Status == "" {
		input.Status = "open"
	}
	if !entity.RemediationTicketStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	dueDate, err := parseDueDate(input.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()
	if input.OwnerUserID != nil {
		var owner entity.AppUser
		if err := db.First(&owner, *input.OwnerUserID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "owner_user_id does not exist"})
			return
		}
	}

	item := entity.RemediationTicket{
		TaskID:      input.TaskID,
		HostIP:      input.HostIP,
		NVTOid:      input.NVTOid,
		VulnName:    input.VulnName,
		Severity:    clampSeverity(input.Severity),
		Status:      input.Status,
		OwnerUserID: input.OwnerUserID,
		DueDate:     dueDate,
		Notes:       input.Notes,
		CreatedByID: c.GetUint("user_id"),
	}
	if err := db.Create(&item).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	loadOwnerFor(db, &item)
	audit.Log(c, "remediation_ticket.created", "remediation_ticket", strconv.FormatUint(uint64(item.ID), 10),
		fmt.Sprintf("created ticket for %s on %s", item.VulnName, item.HostIP))
	c.JSON(http.StatusCreated, gin.H{"data": mapTicketDTO(item)})
}

type updateTicketInput struct {
	Status      *string  `json:"status"`
	OwnerUserID *uint    `json:"owner_user_id"`
	DueDate     *string  `json:"due_date"`
	Notes       *string  `json:"notes"`
	Severity    *float64 `json:"severity"`
}

// PATCH /remediation-tickets/:id
func UpdateRemediationTicket(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	var item entity.RemediationTicket
	if err := db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var input updateTicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Status != nil {
		if !entity.RemediationTicketStatuses[*input.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
			return
		}
		updates["status"] = *input.Status
	}
	if input.OwnerUserID != nil {
		if *input.OwnerUserID != 0 {
			var owner entity.AppUser
			if err := db.First(&owner, *input.OwnerUserID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "owner_user_id does not exist"})
				return
			}
			updates["owner_user_id"] = *input.OwnerUserID
		} else {
			updates["owner_user_id"] = nil
		}
	}
	if input.DueDate != nil {
		dueDate, err := parseDueDate(input.DueDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updates["due_date"] = dueDate
	}
	if input.Notes != nil {
		updates["notes"] = *input.Notes
	}
	if input.Severity != nil {
		updates["severity"] = clampSeverity(*input.Severity)
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	if err := db.Model(&item).Updates(updates).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	if err := db.Preload("Owner").First(&item, id).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "remediation_ticket.updated", "remediation_ticket", id, fmt.Sprintf("updated ticket for %s", item.HostIP))
	c.JSON(http.StatusOK, gin.H{"data": mapTicketDTO(item)})
}

// DELETE /remediation-tickets/:id
func DeleteRemediationTicket(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	if err := db.Delete(&entity.RemediationTicket{}, id).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}
	audit.Log(c, "remediation_ticket.deleted", "remediation_ticket", id, "deleted remediation ticket")
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
