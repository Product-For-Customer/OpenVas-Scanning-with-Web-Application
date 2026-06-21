package user

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
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
	if err := db.Where("email = ?", email).First(&existing).Error; err == nil {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		err := db.Where("email = ? AND id <> ?", newEmail, user.ID).First(&existing).Error

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

	if input.AppRoleID != nil {
		var role entity.AppRole
		if err := db.First(&role, *input.AppRoleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role not found"})
			return
		}
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	db.Preload("AppRole").First(&user, user.ID)

	c.JSON(http.StatusOK, mapUserResponse(user))
}

func DeleteUserByID(c *gin.Context) {
	id := c.Param("id")

	uid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	db := config.DB()
	if tx := db.Delete(&entity.AppUser{}, uint(uid)); tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": tx.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

type RoleResponse struct {
	ID   uint   `json:"id"`
	Role string `json:"role"`
}

type UpdateUserByAdminInput struct {
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

func ListRoles(c *gin.Context) {
	var roles []entity.AppRole

	db := config.DB()
	if err := db.Order("id asc").Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list roles",
		})
		return
	}

	response := make([]RoleResponse, 0, len(roles))
	for _, role := range roles {
		response = append(response, RoleResponse{
			ID:   role.ID,
			Role: role.Role,
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

	if input.Email == nil &&
		input.Password == nil &&
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
	var newPlainPassword string

	if input.Email != nil {
		newEmail := strings.TrimSpace(*input.Email)

		var existing entity.AppUser
		err := db.Where("email = ? AND id <> ?", newEmail, user.ID).First(&existing).Error

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

	if input.AppRoleID != nil {
		var role entity.AppRole
		if err := db.First(&role, *input.AppRoleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "role not found",
			})
			return
		}

		validateUser.AppRoleID = *input.AppRoleID
		updates["AppRoleID"] = *input.AppRoleID
	}

	if input.Password != nil {
		newPlainPassword = strings.TrimSpace(*input.Password)
		validateUser.Password = newPlainPassword
	}

	if ok, err := govalidator.ValidateStruct(validateUser); !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if input.Password != nil {
		hashedPassword, err := services.HashPassword(newPlainPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to hash password",
			})
			return
		}
		updates["Password"] = hashedPassword
	}

	tx := db.Model(&entity.AppUser{}).
		Where("id = ?", user.ID).
		Updates(updates)

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": tx.Error.Error(),
		})
		return
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