package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/utils"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var db *gorm.DB

func DB() *gorm.DB {
	return db
}

func ConnectDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=pg-gvm port=5432 user=pbi password=Pbi12345 dbname=gvmd sslmode=disable"
	}

	// ✅ ปิดการพิมพ์ SQL + ปิดสี
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             2 * time.Second,
			LogLevel:                  logger.Silent,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	var database *gorm.DB
	var err error

	maxRetries := 20
	retryDelay := 2 * time.Second

	for i := 1; i <= maxRetries; i++ {
		database, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: newLogger,
		})

		if err == nil {
			sqlDB, err2 := database.DB()
			if err2 == nil {
				sqlDB.SetMaxIdleConns(5)
				sqlDB.SetMaxOpenConns(20)
				sqlDB.SetConnMaxLifetime(30 * time.Minute)

				if pingErr := sqlDB.Ping(); pingErr == nil {
					db = database
					fmt.Println("✅ Database connected successfully")
					return
				} else {
					err = pingErr
				}
			} else {
				err = err2
			}
		}

		log.Printf("⏳ DB not ready (attempt %d/%d): %v\n", i, maxRetries, err)
		time.Sleep(retryDelay)
	}

	log.Fatalf("❌ failed to connect to PostgreSQL after %d attempts: %v", maxRetries, err)
}

// ✅ สร้างตารางจาก Entity
func SetupDatabase() {
	if db == nil {
		log.Fatal("❌ database is nil, call ConnectDB() before SetupDatabase()")
	}

	err := db.AutoMigrate(
		&entity.OTP{},
		&entity.SendEmail{},
		&entity.AppLineMaster{},
		&entity.AppNotification{},
		&entity.AppRole{},
		&entity.AppUser{},
		&entity.AppStatusNotify{},
		&entity.AppHistoryNotify{},
		&entity.AppTarget{},
		&entity.AppLocation{},
	)
	if err != nil {
		log.Fatalf("❌ AutoMigrate failed: %v", err)
	}

	fmt.Println("✅ AutoMigrate completed (AppGroup, AppLineMaster, Notification)")
}

func SeedDatabase() {
	if db == nil {
		log.Fatal("❌ database is nil, call ConnectDB() before SeedDatabase()")
	}

	// =========================
	// Seed Roles
	// =========================
	adminRole := entity.AppRole{Role: "Admin"}
	userRole := entity.AppRole{Role: "User"}

	db.FirstOrCreate(&adminRole, &entity.AppRole{Role: "Admin"})
	db.FirstOrCreate(&userRole, &entity.AppRole{Role: "User"})

	// =========================
	// Seed StatusNotify
	// =========================
	StatusNotify1 := entity.AppStatusNotify{Status: "Update Completed"}
	StatusNotify2 := entity.AppStatusNotify{Status: "No Update"}
	StatusNotify3 := entity.AppStatusNotify{Status: "Already Running"}
	StatusNotify4 := entity.AppStatusNotify{Status: "Update Failed"}
	StatusNotify5 := entity.AppStatusNotify{Status: "Status Notification"}
	StatusNotify6 := entity.AppStatusNotify{Status: "Unauthorized"}
	StatusNotify7 := entity.AppStatusNotify{Status: "Server Error"}
	StatusNotify8 := entity.AppStatusNotify{Status: "Timeout"}

	db.FirstOrCreate(&StatusNotify1, &entity.AppStatusNotify{Status: "Update Completed"})
	db.FirstOrCreate(&StatusNotify2, &entity.AppStatusNotify{Status: "No Update"})
	db.FirstOrCreate(&StatusNotify3, &entity.AppStatusNotify{Status: "Already Running"})
	db.FirstOrCreate(&StatusNotify4, &entity.AppStatusNotify{Status: "Update Failed"})
	db.FirstOrCreate(&StatusNotify5, &entity.AppStatusNotify{Status: "Status Notification"})
	db.FirstOrCreate(&StatusNotify6, &entity.AppStatusNotify{Status: "Unauthorized"})
	db.FirstOrCreate(&StatusNotify7, &entity.AppStatusNotify{Status: "Server Error"})
	db.FirstOrCreate(&StatusNotify8, &entity.AppStatusNotify{Status: "Timeout"})

	send := &entity.SendEmail{
		Email:   "b6534240@g.sut.ac.th",
		PassApp: "wkeg dbhx tllh mtif",
	}

	db.FirstOrCreate(send, entity.SendEmail{Email: send.Email})

	// =========================
	// Seed HistoryNotify
	// =========================
	HistoryNotify1 := entity.AppHistoryNotify{
		Subject:         "Vulnerability Found",
		DateTime:        time.Now(),
		Description:     "A new vulnerability has been detected in the system.",
		AppStatusNotify: &StatusNotify5, // Status Notification
	}
	db.FirstOrCreate(
		&HistoryNotify1,
		&entity.AppHistoryNotify{
			Subject:     "Vulnerability Found",
			Description: "A new vulnerability has been detected in the system.",
		},
	)

	HistoryNotify2 := entity.AppHistoryNotify{
		Subject:         "Scan Completed",
		DateTime:        time.Now(),
		Description:     "The vulnerability scan has been completed successfully.",
		AppStatusNotify: &StatusNotify1, // Update Completed
	}
	db.FirstOrCreate(
		&HistoryNotify2,
		&entity.AppHistoryNotify{
			Subject:     "Scan Completed",
			Description: "The vulnerability scan has been completed successfully.",
		},
	)

	HistoryNotify3 := entity.AppHistoryNotify{
		Subject:         "Scan Already Running",
		DateTime:        time.Now(),
		Description:     "The scan process is already running in the system.",
		AppStatusNotify: &StatusNotify3, // Already Running
	}
	db.FirstOrCreate(
		&HistoryNotify3,
		&entity.AppHistoryNotify{
			Subject:     "Scan Already Running",
			Description: "The scan process is already running in the system.",
		},
	)

	HistoryNotify4 := entity.AppHistoryNotify{
		Subject:         "Feed Update Failed",
		DateTime:        time.Now(),
		Description:     "Security feed data update failed.",
		AppStatusNotify: &StatusNotify4, // Update Failed
	}
	db.FirstOrCreate(
		&HistoryNotify4,
		&entity.AppHistoryNotify{
			Subject:     "Feed Update Failed",
			Description: "Security feed data update failed.",
		},
	)

	HistoryNotify5 := entity.AppHistoryNotify{
		Subject:         "No Feed Update",
		DateTime:        time.Now(),
		Description:     "There is no new security feed update available.",
		AppStatusNotify: &StatusNotify2, // No Update
	}
	db.FirstOrCreate(
		&HistoryNotify5,
		&entity.AppHistoryNotify{
			Subject:     "No Feed Update",
			Description: "There is no new security feed update available.",
		},
	)
	// =========================
	// Seed LineMasters
	// =========================
	lineMaster1 := entity.AppLineMaster{
		Name:  "Line Sender",
		Token: "G4crCc/2gMnvX+hZErxIhg7WcI0ML+MRLlAj086lTtrdL7VYURieWPRXKd6/9Zl8RxcaME5vQ3I1BW82d1/ZYezvWklVMUk+EGGfXRmI4jwtA28iaHU8MkneAGQSibyr/yp0eetvASPPtplCXWrb7gdB04t89/1O/w1cDnyilFU=",
	}
	db.FirstOrCreate(&lineMaster1, &entity.AppLineMaster{Token: lineMaster1.Token})

	// =========================
	// Seed Notifications
	// =========================
	notification1 := entity.AppNotification{
		Name:            "Get on Technology",
		SendID:          "U3af93a2f92b1048757172584d47571c8",
		Alert:           true,
		AppLineMasterID: lineMaster1.ID,
	}

	db.FirstOrCreate(&notification1, &entity.AppNotification{
		Name:            notification1.Name,
		SendID:          notification1.SendID,
		AppLineMasterID: lineMaster1.ID,
	})

	// =========================
	// Seed AppTarget
	// =========================
	target1 := entity.AppTarget{
		Name:       "Core Switch ITS",
		IpHost:     "192.168.10.1",
		MacAddress: "AA:BB:CC:DD:EE:01",
	}

	db.FirstOrCreate(&target1, &entity.AppTarget{
		Name:       target1.Name,
		MacAddress: target1.MacAddress,
	})

	target2 := entity.AppTarget{
		Name:       "Access Point Building A",
		IpHost:     "192.168.10.2",
		MacAddress: "AA:BB:CC:DD:EE:02",
	}

	db.FirstOrCreate(&target2, &entity.AppTarget{
		Name:       target2.Name,
		MacAddress: target2.MacAddress,
	})

	target3 := entity.AppTarget{
		Name:       "Server Rack 01",
		IpHost:     "192.168.10.3",
		MacAddress: "AA:BB:CC:DD:EE:03",
	}

	db.FirstOrCreate(&target3, &entity.AppTarget{
		Name:       target3.Name,
		MacAddress: target3.MacAddress,
	})

	// =========================
	// Seed AppLocation
	// =========================
	location1 := entity.AppLocation{
		Location:    "ห้อง Network Center",
		Building:    "อาคารเทคโนโลยีสารสนเทศ",
		Floor:       1,
		Latitude:    13.7563,
		Longtitude:  100.5018,
		AppTargetID: target1.ID,
	}

	db.FirstOrCreate(&location1, &entity.AppLocation{
		Location:    location1.Location,
		Building:    location1.Building,
		Floor:       location1.Floor,
		Latitude:    location1.Latitude,
		Longtitude:  location1.Longtitude,
		AppTargetID: target1.ID,
	})

	location2 := entity.AppLocation{
		Location:    "โถงทางเดินชั้น 2",
		Building:    "อาคาร A",
		Floor:       2,
		Latitude:    13.7367,
		Longtitude:  100.5231,
		AppTargetID: target2.ID,
	}

	db.FirstOrCreate(&location2, &entity.AppLocation{
		Location:    location2.Location,
		Building:    location2.Building,
		Floor:       location2.Floor,
		Latitude:    location2.Latitude,
		Longtitude:  location2.Longtitude,
		AppTargetID: target2.ID,
	})

	location3 := entity.AppLocation{
		Location:    "ห้อง Server ชั้น 3",
		Building:    "อาคาร Data Center",
		Floor:       3,
		Latitude:    13.7649,
		Longtitude:  100.5383,
		AppTargetID: target3.ID,
	}

	db.FirstOrCreate(&location3, &entity.AppLocation{
		Location:    location3.Location,
		Building:    location3.Building,
		Floor:       location3.Floor,
		Latitude:    location3.Latitude,
		Longtitude:  location3.Longtitude,
		AppTargetID: target3.ID,
	})

	// =========================
	// Seed Admin User
	// =========================
	var existingAdmin entity.AppUser
	if err := db.Where("email = ?", "tawunchaien@gmail.com").First(&existingAdmin).Error; err != nil {
		hashedPassword, err := utils.HashPassword("12345678")
		if err != nil {
			log.Fatalf("❌ failed to hash seed admin password: %v", err)
		}

		adminUser := entity.AppUser{
			Email:       "tawunchaien@gmail.com",
			Password:    hashedPassword,
			FirstName:   "Admin",
			LastName:    "System",
			Profile:     "Admin Profile",
			PhoneNumber: "0999999999",
			Location:    "Thailand",
			Position:    "Administrator",
			AppRoleID:   adminRole.ID,
		}

		if err := db.Create(&adminUser).Error; err != nil {
			log.Fatalf("❌ failed to create seed admin user: %v", err)
		}
	}

	// =========================
	// Seed User Role 1 Users
	// =========================
	seedUsers := []struct {
		Email       string
		Password    string
		FirstName   string
		LastName    string
		Profile     string
		PhoneNumber string
		Location    string
		Position    string
	}{
		{
			Email:       "user@gmail.com",
			Password:    "12345678",
			FirstName:   "User",
			LastName:    "One",
			Profile:     "User Profile 1",
			PhoneNumber: "0811111111",
			Location:    "Thailand",
			Position:    "Operator",
		},
	}

	for _, u := range seedUsers {
		var existingUser entity.AppUser
		if err := db.Where("email = ?", u.Email).First(&existingUser).Error; err != nil {
			hashedPassword, hashErr := utils.HashPassword(u.Password)
			if hashErr != nil {
				log.Fatalf("❌ failed to hash password for %s: %v", u.Email, hashErr)
			}

			newUser := entity.AppUser{
				Email:       u.Email,
				Password:    hashedPassword,
				FirstName:   u.FirstName,
				LastName:    u.LastName,
				Profile:     u.Profile,
				PhoneNumber: u.PhoneNumber,
				Location:    u.Location,
				Position:    u.Position,
				AppRoleID:   userRole.ID,
			}

			if err := db.Create(&newUser).Error; err != nil {
				log.Fatalf("❌ failed to create seed user %s: %v", u.Email, err)
			}
		}
	}

	fmt.Println("✅ SeedDatabase completed")
}
