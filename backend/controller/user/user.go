package user

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/passwordpolicy"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/Tawunchai/openvas/services"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateUserInput struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	Profile     string `json:"profile"`      // optional
	PhoneNumber string `json:"phone_number"` // optional
	Location    string `json:"location"`     // optional
	Position    string `json:"position"`     // optional
	AppRoleID   uint   `json:"app_role_id"`  // optional – defaults to "User" role
}

type UpdateUserInput struct {
	Email       *string `json:"email"`
	Password    *string `json:"password"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Profile     *string `json:"profile"`
	PhoneNumber *string `json:"phone_number"`
	Location    *string `json:"location"`
	Position    *string `json:"position"`
	AppRoleID   *uint   `json:"app_role_id"`
}

type UserResponse struct {
	ID          uint   `json:"id"`
	Email       string `json:"email"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Profile     string `json:"profile"`
	PhoneNumber string `json:"phone_number"`
	Location    string `json:"location"`
	Position    string `json:"position"`
	Role        string `json:"role"`
}

func mapUserResponse(u entity.AppUser) UserResponse {
	role := ""
	if u.AppRole != nil {
		role = u.AppRole.Role
	}

	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		Profile:     u.Profile,
		PhoneNumber: u.PhoneNumber,
		Location:    u.Location,
		Position:    u.Position,
		Role:        role,
	}
}

func CreateUser(c *gin.Context) {
	var input CreateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	email := strings.TrimSpace(input.Email)
	password := strings.TrimSpace(input.Password)
	firstName := strings.TrimSpace(input.FirstName)
	lastName := strings.TrimSpace(input.LastName)
	profile := strings.TrimSpace(input.Profile)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	location := strings.TrimSpace(input.Location)
	position := strings.TrimSpace(input.Position)

	var existing entity.AppUser
	if err := db.Where("LOWER(email) = LOWER(?)", email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing email"})
		return
	}

	// If no role provided, default to "User" role
	if input.AppRoleID == 0 {
		var defaultRole entity.AppRole
		if err := db.Where("LOWER(role) = ?", "user").First(&defaultRole).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "default user role not found"})
			return
		}
		input.AppRoleID = defaultRole.ID
	}

	var role entity.AppRole
	if err := db.First(&role, input.AppRoleID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role not found"})
		return
	}

	validateUser := entity.AppUser{
		Email:       email,
		Password:    password,
		FirstName:   firstName,
		LastName:    lastName,
		Profile:     profile,
		PhoneNumber: phoneNumber,
		Location:    location,
		Position:    position,
		AppRoleID:   input.AppRoleID,
	}

	if ok, err := govalidator.ValidateStruct(validateUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := passwordpolicy.ValidatePassword(db, password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := services.HashPassword(password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := entity.AppUser{
		Email:       email,
		Password:    hashedPassword,
		FirstName:   firstName,
		LastName:    lastName,
		Profile:     profile,
		PhoneNumber: phoneNumber,
		Location:    location,
		Position:    position,
		AppRoleID:   input.AppRoleID,
	}

	if err := db.Create(&user).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
			return
		}
		services.RespondInternalError(c, err)
		return
	}

	audit.Log(c, "user.created", "user", strconv.FormatUint(uint64(user.ID), 10),
		fmt.Sprintf("created user %s with role %q", user.Email, role.Role))

	db.Preload("AppRole").First(&user, user.ID)

	c.JSON(http.StatusCreated, mapUserResponse(user))
}

func ListUser(c *gin.Context) {
	var users []entity.AppUser

	db := config.DB()
	results := db.Preload("AppRole").Find(&users)

	if results.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": results.Error.Error()})
		return
	}

	response := make([]UserResponse, 0, len(users))
	for _, u := range users {
		response = append(response, mapUserResponse(u))
	}

	c.JSON(http.StatusOK, response)
}

func ListUserByID(c *gin.Context) {
	id := c.Param("id")

	uid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var user entity.AppUser

	db := config.DB()
	result := db.Preload("AppRole").First(&user, uint(uid))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, mapUserResponse(user))
}

func UpdateUserByID(c *gin.Context) {
	id := c.Param("id")

	uid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	var user entity.AppUser
	if err := db.Preload("AppRole").First(&user, uint(uid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	oldRoleName := ""
	if user.AppRole != nil {
		oldRoleName = user.AppRole.Role
	}

	if input.Email == nil &&
		input.Password == nil &&
		input.FirstName == nil &&
		input.LastName == nil &&
		input.Profile == nil &&
		input.PhoneNumber == nil &&
		input.Location == nil &&
		input.Position == nil &&
		input.AppRoleID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	validateUser := entity.AppUser{
		Model:       user.Model,
		Email:       user.Email,
		Password:    user.Password,
		FirstName:   user.FirstName,
		LastName:    user.LastName,
		Profile:     user.Profile,
		PhoneNumber: user.PhoneNumber,
		Location:    user.Location,
		Position:    user.Position,
		AppRoleID:   user.AppRoleID,
		AppRole:     user.AppRole,
	}

	var newPlainPassword string

	if input.Email != nil {
		newEmail := strings.TrimSpace(*input.Email)

		var existing entity.AppUser
		err := db.Where("LOWER(email) = LOWER(?) AND id <> ?", newEmail, user.ID).First(&existing).Error

		switch {
		case err == nil:
			c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
			return

		case errors.Is(err, gorm.ErrRecordNotFound):
			// ไม่พบ email ซ้ำ = อัปเดตต่อได้

		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing email"})
			return
		}

		validateUser.Email = newEmail
	}

	if input.FirstName != nil {
		validateUser.FirstName = strings.TrimSpace(*input.FirstName)
	}

	if input.LastName != nil {
		validateUser.LastName = strings.TrimSpace(*input.LastName)
	}

	if input.Profile != nil {
		validateUser.Profile = strings.TrimSpace(*input.Profile)
	}

	if input.PhoneNumber != nil {
		validateUser.PhoneNumber = strings.TrimSpace(*input.PhoneNumber)
	}

	if input.Location != nil {
		validateUser.Location = strings.TrimSpace(*input.Location)
	}

	if input.Position != nil {
		validateUser.Position = strings.TrimSpace(*input.Position)
	}

	newRoleName := ""
	if input.AppRoleID != nil {
		if !permission.Has(c.GetUint("user_role_id"), "user_management", true) {
			c.JSON(http.StatusForbidden, gin.H{"error": "only a role with User & Role Management access can change a user's role"})
			return
		}

		var role entity.AppRole
		if err := db.First(&role, *input.AppRoleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role not found"})
			return
		}
		newRoleName = role.Role
		validateUser.AppRoleID = *input.AppRoleID
	}

	if input.Password != nil {
		newPlainPassword = strings.TrimSpace(*input.Password)
		validateUser.Password = newPlainPassword
	}

	if ok, err := govalidator.ValidateStruct(validateUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Password != nil {
		if err := passwordpolicy.ValidatePassword(db, newPlainPassword); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if input.Email != nil {
		user.Email = validateUser.Email
	}
	if input.FirstName != nil {
		user.FirstName = validateUser.FirstName
	}
	if input.LastName != nil {
		user.LastName = validateUser.LastName
	}
	if input.Profile != nil {
		user.Profile = validateUser.Profile
	}
	if input.PhoneNumber != nil {
		user.PhoneNumber = validateUser.PhoneNumber
	}
	if input.Location != nil {
		user.Location = validateUser.Location
	}
	if input.Position != nil {
		user.Position = validateUser.Position
	}
	if input.AppRoleID != nil {
		user.AppRoleID = validateUser.AppRoleID
	}
	if input.Password != nil {
		hashedPassword, err := services.HashPassword(newPlainPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}
		user.Password = hashedPassword
	}

	if err := db.Save(&user).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	if input.AppRoleID != nil && newRoleName != oldRoleName {
		audit.Log(c, "user.role_changed", "user", strconv.FormatUint(uint64(user.ID), 10),
			fmt.Sprintf("changed role from %q to %q for %s", oldRoleName, newRoleName, user.Email))
	}

	db.Preload("AppRole").First(&user, user.ID)

	c.JSON(http.StatusOK, mapUserResponse(user))
}

// isLastActiveAdmin reports whether userID is currently the only user still
// in the built-in Admin role. Without this check, any user_management-
// permitted caller could delete or demote the sole remaining admin with no
// way to recover — every role/permission page requires user_management
// access, which nobody would have left.
func isLastActiveAdmin(db *gorm.DB, userID uint) bool {
	var user entity.AppUser
	if err := db.Preload("AppRole").First(&user, userID).Error; err != nil {
		return false
	}
	if user.AppRole == nil || !user.AppRole.IsBuiltIn || !strings.EqualFold(user.AppRole.Role, "admin") {
		return false
	}
	var count int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", user.AppRoleID).Count(&count)
	return count <= 1
}

func DeleteUserByID(c *gin.Context) {
	id := c.Param("id")

	uid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	db := config.DB()

	var deletedUser entity.AppUser
	db.First(&deletedUser, uint(uid))

	if isLastActiveAdmin(db, uint(uid)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the last remaining Admin — promote another user to Admin first"})
		return
	}

	if tx := db.Delete(&entity.AppUser{}, uint(uid)); tx.Error != nil {
		services.RespondInternalError(c, tx.Error)
		return
	}

	audit.Log(c, "user.deleted", "user", id, fmt.Sprintf("deleted user %s", deletedUser.Email))

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

type RoleResponse struct {
	ID        uint   `json:"id"`
	Role      string `json:"role"`
	IsBuiltIn bool   `json:"is_built_in"`
	UserCount int64  `json:"user_count"`
}

// UpdateUserByAdminInput deliberately has no Password field — an admin
// editing someone else's account never resets their password from this
// endpoint (self-service password change/reset is a separate OTP-backed
// flow). This also means an admin can never be tricked into overwriting
// another user's password via a raw API call, not just via the UI.
type UpdateUserByAdminInput struct {
	Email       *string `json:"email"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Profile     *string `json:"profile"`
	PhoneNumber *string `json:"phone_number"`
	Location    *string `json:"location"`
	Position    *string `json:"position"`
	AppRoleID   *uint   `json:"app_role_id"`
}

func ListRoles(c *gin.Context) {
	var roles []entity.AppRole

	db := config.DB()
	if err := db.Order("id asc").Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list roles",
		})
		return
	}

	type roleCount struct {
		AppRoleID uint
		Count     int64
	}
	var counts []roleCount
	db.Model(&entity.AppUser{}).
		Select("app_role_id, count(*) as count").
		Group("app_role_id").
		Scan(&counts)
	countByRole := make(map[uint]int64, len(counts))
	for _, rc := range counts {
		countByRole[rc.AppRoleID] = rc.Count
	}

	response := make([]RoleResponse, 0, len(roles))
	for _, role := range roles {
		response = append(response, RoleResponse{
			ID:        role.ID,
			Role:      role.Role,
			IsBuiltIn: role.IsBuiltIn,
			UserCount: countByRole[role.ID],
		})
	}

	c.JSON(http.StatusOK, response)
}

func UpdateUserIDByAdmin(c *gin.Context) {
	id := c.Param("id")

	uid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid user id",
		})
		return
	}

	var input UpdateUserByAdminInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var user entity.AppUser
	if err := db.Preload("AppRole").First(&user, uint(uid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "user not found",
		})
		return
	}

	oldRoleName := ""
	if user.AppRole != nil {
		oldRoleName = user.AppRole.Role
	}

	if input.Email == nil &&
		input.FirstName == nil &&
		input.LastName == nil &&
		input.Profile == nil &&
		input.PhoneNumber == nil &&
		input.Location == nil &&
		input.Position == nil &&
		input.AppRoleID == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no fields to update",
		})
		return
	}

	validateUser := entity.AppUser{
		Model:       user.Model,
		Email:       user.Email,
		Password:    user.Password,
		FirstName:   user.FirstName,
		LastName:    user.LastName,
		Profile:     user.Profile,
		PhoneNumber: user.PhoneNumber,
		Location:    user.Location,
		Position:    user.Position,
		AppRoleID:   user.AppRoleID,
		AppRole:     user.AppRole,
	}

	updates := map[string]interface{}{}

	if input.Email != nil {
		newEmail := strings.TrimSpace(*input.Email)

		var existing entity.AppUser
		err := db.Where("LOWER(email) = LOWER(?) AND id <> ?", newEmail, user.ID).First(&existing).Error

		switch {
		case err == nil:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "email already exists",
			})
			return

		case errors.Is(err, gorm.ErrRecordNotFound):
			// ไม่พบ email ซ้ำ = อัปเดตต่อได้

		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to check existing email",
			})
			return
		}

		validateUser.Email = newEmail
		updates["Email"] = newEmail
	}

	if input.FirstName != nil {
		validateUser.FirstName = strings.TrimSpace(*input.FirstName)
		updates["FirstName"] = validateUser.FirstName
	}

	if input.LastName != nil {
		validateUser.LastName = strings.TrimSpace(*input.LastName)
		updates["LastName"] = validateUser.LastName
	}

	if input.Profile != nil {
		validateUser.Profile = strings.TrimSpace(*input.Profile)
		updates["Profile"] = validateUser.Profile
	}

	if input.PhoneNumber != nil {
		validateUser.PhoneNumber = strings.TrimSpace(*input.PhoneNumber)
		updates["PhoneNumber"] = validateUser.PhoneNumber
	}

	if input.Location != nil {
		validateUser.Location = strings.TrimSpace(*input.Location)
		updates["Location"] = validateUser.Location
	}

	if input.Position != nil {
		validateUser.Position = strings.TrimSpace(*input.Position)
		updates["Position"] = validateUser.Position
	}

	newRoleName := ""
	if input.AppRoleID != nil {
		var role entity.AppRole
		if err := db.First(&role, *input.AppRoleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "role not found",
			})
			return
		}

		newRoleName = role.Role
		if newRoleName != oldRoleName && isLastActiveAdmin(db, user.ID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot change the role of the last remaining Admin — promote another user to Admin first"})
			return
		}
		validateUser.AppRoleID = *input.AppRoleID
		updates["AppRoleID"] = *input.AppRoleID
	}

	if ok, err := govalidator.ValidateStruct(validateUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	tx := db.Model(&entity.AppUser{}).
		Where("id = ?", user.ID).
		Updates(updates)

	if tx.Error != nil {
		services.RespondInternalError(c, tx.Error)
		return
	}

	if input.AppRoleID != nil && newRoleName != oldRoleName {
		audit.Log(c, "user.role_changed", "user", strconv.FormatUint(uint64(user.ID), 10),
			fmt.Sprintf("changed role from %q to %q for %s", oldRoleName, newRoleName, user.Email))
	}

	var updatedUser entity.AppUser
	if err := db.Preload("AppRole").First(&updatedUser, user.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to reload updated user",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update user by admin success",
		"data":    mapUserResponse(updatedUser),
	})
}

type EmailAndPhoneNumberResponse struct {
	ID          uint   `json:"id"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
}

func ListEmailAndPhoneNumber(c *gin.Context) {
	db := config.DB()

	var users []entity.AppUser
	if err := db.Select("id, email, phone_number").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch email and phone number",
		})
		return
	}

	result := make([]EmailAndPhoneNumberResponse, 0, len(users))
	for _, user := range users {
		result = append(result, EmailAndPhoneNumberResponse{
			ID:          user.ID,
			Email:       user.Email,
			PhoneNumber: user.PhoneNumber,
		})
	}

	c.JSON(http.StatusOK, result)
}

// ListExistingEmails is the PUBLIC, narrowly-scoped counterpart to
// ListEmailAndPhoneNumber above, used only for the Register page's
// live "this email is already taken" client-side check before a session
// exists. It intentionally returns emails only (lowercased, no IDs, no
// phone numbers) so an unauthenticated caller can no longer bulk-harvest
// every user's phone number the way the full endpoint used to allow.
func ListExistingEmails(c *gin.Context) {
	db := config.DB()

	var emails []string
	if err := db.Model(&entity.AppUser{}).Pluck("LOWER(email)", &emails).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch existing emails",
		})
		return
	}

	c.JSON(http.StatusOK, emails)
}