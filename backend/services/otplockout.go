package services

import (
	"strings"
	"sync"
	"time"
)

// Per-account OTP brute-force protection. The existing RateLimiter middleware
// only throttles by IP, so an attacker spreading guesses across IPs can still
// brute-force a 6-digit OTP within its validity window. This tracks failed
// verification attempts per account (email) and locks it out for a cooldown
// once too many wrong codes are submitted.
const (
	otpMaxAttempts   = 5
	otpLockoutWindow = 15 * time.Minute
)

type otpAttemptState struct {
	mu          sync.Mutex
	failures    int
	windowStart time.Time
}

var (
	otpAttemptMu sync.RWMutex
	otpAttempts  = make(map[string]*otpAttemptState)
)

func otpLockoutKey(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func getOTPAttemptState(email string) *otpAttemptState {
	key := otpLockoutKey(email)

	otpAttemptMu.RLock()
	s, ok := otpAttempts[key]
	otpAttemptMu.RUnlock()
	if ok {
		return s
	}

	otpAttemptMu.Lock()
	defer otpAttemptMu.Unlock()
	if s, ok = otpAttempts[key]; ok {
		return s
	}
	s = &otpAttemptState{}
	otpAttempts[key] = s
	return s
}

// IsOTPLocked reports whether this account is currently locked out from OTP
// verification, plus how many seconds remain on the lockout.
func IsOTPLocked(email string) (bool, int) {
	s := getOTPAttemptState(email)
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.failures < otpMaxAttempts {
		return false, 0
	}
	remaining := otpLockoutWindow - time.Since(s.windowStart)
	if remaining <= 0 {
		s.failures = 0
		return false, 0
	}
	return true, int(remaining.Seconds()) + 1
}

// RecordOTPFailure increments the failed-attempt counter for this account.
func RecordOTPFailure(email string) {
	s := getOTPAttemptState(email)
	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Since(s.windowStart) > otpLockoutWindow {
		s.failures = 0
		s.windowStart = time.Now()
	}
	s.failures++
}

// ResetOTPAttempts clears the failure counter after a successful verification.
func ResetOTPAttempts(email string) {
	s := getOTPAttemptState(email)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failures = 0
}

// StartOTPLockoutCleanup periodically evicts stale per-account entries so the
// in-memory map doesn't grow unbounded. Mirrors middleware.StartRateLimitCleanup.
func StartOTPLockoutCleanup() {
	go func() {
		for range time.Tick(10 * time.Minute) {
			otpAttemptMu.Lock()
			cutoff := time.Now().Add(-otpLockoutWindow)
			for key, s := range otpAttempts {
				s.mu.Lock()
				stale := s.failures == 0 || s.windowStart.Before(cutoff)
				s.mu.Unlock()
				if stale {
					delete(otpAttempts, key)
				}
			}
			otpAttemptMu.Unlock()
		}
	}()
}
