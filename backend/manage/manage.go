package manage

const TargetLimit = 25

// GetTargetLimit ใช้สำหรับดึงค่า Target Limit ไปใช้ในไฟล์อื่น
func GetTargetLimit() int {
	return TargetLimit
}

// CanCreateTarget ใช้ตรวจสอบว่าสามารถสร้าง Target / Task เพิ่มได้หรือไม่
func CanCreateTarget(currentTargetCount int) bool {
	return currentTargetCount < TargetLimit
}

// IsTargetLimitReached ใช้ตรวจสอบว่าถึง Limit แล้วหรือยัง
func IsTargetLimitReached(currentTargetCount int) bool {
	return currentTargetCount >= TargetLimit
}