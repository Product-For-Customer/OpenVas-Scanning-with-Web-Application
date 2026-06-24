package line

import "log"

// SendScanNotification pushes a plain-text message to all LINE alert destinations.
// Called by the auto-scan scheduler to notify scan start / done.
func SendScanNotification(msg string) {
	if err := sendLinePushToAllNotifications(msg); err != nil {
		log.Printf("⚠️ SendScanNotification: %v", err)
	}
}
