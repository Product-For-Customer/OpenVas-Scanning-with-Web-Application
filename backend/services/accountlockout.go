package services

import (
	"strings"
	"sync"
	"time"
)

// Generic per-account brute-force/abuse throttling, keyed by (purpose,
// account). Same pattern as otplockout.go, generalized: the shared
// middleware.RateLimiter (see backend/middleware/ratelimit.go) only
// throttles by IP, so an attacker spreading requests across IPs (or sharing
// a NAT/proxy with the victim) can still hammer a single account's password,
// TOTP code, or the no-OTP password-reset shortcut. Purposes are kept
// separate (e.g. "login" vs "totp-login") so failures on one endpoint don't
// spuriously lock out attempts on another.
const (
	accountMaxAttempts   = 5
	accountLockoutWindow = 15 * time.Minute
)

type accountAttemptState struct {
	mu          sync.Mutex
	failures    int
	windowStart time.Time
}

var (
	accountAttemptMu sync.RWMutex
	accountAttempts  = make(map[string]*accountAttemptState)
)

func accountLockoutKey(purpose, account string) string {
	return purpose + ":" + strings.ToLower(strings.TrimSpace(account))
}

func getAccountAttemptState(purpose, account string) *accountAttemptState {
	key := accountLockoutKey(purpose, account)

	accountAttemptMu.RLock()
	s, ok := accountAttempts[key]
	accountAttemptMu.RUnlock()
	if ok {
		return s
	}

	accountAttemptMu.Lock()
	defer accountAttemptMu.Unlock()
	if s, ok = accountAttempts[key]; ok {
		return s
	}
	s = &accountAttemptState{}
	accountAttempts[key] = s
	return s
}

// IsAccountLocked reports whether this (purpose, account) pair is currently
// locked out, plus how many seconds remain on the lockout.
func IsAccountLocked(purpose, account string) (bool, int) {
	s := getAccountAttemptState(purpose, account)
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.failures < accountMaxAttempts {
		return false, 0
	}
	remaining := accountLockoutWindow - time.Since(s.windowStart)
	if remaining <= 0 {
		s.failures = 0
		return false, 0
	}
	return true, int(remaining.Seconds()) + 1
}

// RecordAccountFailure increments the failed-attempt counter for this
// (purpose, account) pair.
func RecordAccountFailure(purpose, account string) {
	s := getAccountAttemptState(purpose, account)
	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Since(s.windowStart) > accountLockoutWindow {
		s.failures = 0
		s.windowStart = time.Now()
	}
	s.failures++
}

// ResetAccountAttempts clears the failure counter after a successful attempt.
func ResetAccountAttempts(purpose, account string) {
	s := getAccountAttemptState(purpose, account)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failures = 0
}

// StartAccountLockoutCleanup periodically evicts stale entries so the
// in-memory map doesn't grow unbounded. Mirrors services.StartOTPLockoutCleanup.
func StartAccountLockoutCleanup() {
	go func() {
		for range time.Tick(10 * time.Minute) {
			accountAttemptMu.Lock()
			cutoff := time.Now().Add(-accountLockoutWindow)
			for key, s := range accountAttempts {
				s.mu.Lock()
				stale := s.failures == 0 || s.windowStart.Before(cutoff)
				s.mu.Unlock()
				if stale {
					delete(accountAttempts, key)
				}
			}
			accountAttemptMu.Unlock()
		}
	}()
}
