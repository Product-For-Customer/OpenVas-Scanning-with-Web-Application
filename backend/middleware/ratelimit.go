package middlewares

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type slidingWindow struct {
	mu         sync.Mutex
	timestamps []time.Time
	limit      int
	window     time.Duration
}

func (sw *slidingWindow) allow() bool {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-sw.window)

	// Remove old timestamps outside the window
	valid := sw.timestamps[:0]
	for _, t := range sw.timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	sw.timestamps = valid

	if len(sw.timestamps) >= sw.limit {
		return false
	}

	sw.timestamps = append(sw.timestamps, now)
	return true
}

var (
	rateMu  sync.RWMutex
	rateMap = make(map[string]*slidingWindow)
)

func getWindow(key string, limit int, window time.Duration) *slidingWindow {
	rateMu.RLock()
	sw, ok := rateMap[key]
	rateMu.RUnlock()
	if ok {
		return sw
	}

	rateMu.Lock()
	defer rateMu.Unlock()
	if sw, ok = rateMap[key]; ok {
		return sw
	}
	sw = &slidingWindow{limit: limit, window: window}
	rateMap[key] = sw
	return sw
}

// StartRateLimitCleanup removes stale entries every 10 minutes.
func StartRateLimitCleanup() {
	go func() {
		for range time.Tick(10 * time.Minute) {
			rateMu.Lock()
			cutoff := time.Now().Add(-15 * time.Minute)
			for key, sw := range rateMap {
				sw.mu.Lock()
				if len(sw.timestamps) == 0 || sw.timestamps[len(sw.timestamps)-1].Before(cutoff) {
					delete(rateMap, key)
				}
				sw.mu.Unlock()
			}
			rateMu.Unlock()
		}
	}()
}

// clientIP returns the caller's IP for rate-limit keying.
//
// It deliberately does NOT read X-Real-IP / X-Forwarded-For directly: those
// are attacker-controllable and, since the backend is exposed without a
// reverse proxy in front, trusting them let a caller rotate the header value
// to get a brand-new rate-limit window on every request (bypassing the auth
// brute-force limits entirely). c.ClientIP() honours gin's trusted-proxy
// configuration (set in main.go): it returns the real TCP peer unless the
// request genuinely came from a configured TRUSTED_PROXIES address, in which
// case — and only then — the forwarded-for chain is parsed.
func clientIP(c *gin.Context) string {
	return c.ClientIP()
}

// RateLimiter returns a Gin middleware that applies per-IP rate limits.
// General API: 120 req/min. Auth endpoints: 10 req/min.
func RateLimiter() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := clientIP(c)
		path := c.FullPath()

		limit := 120
		window := time.Minute

		// Tighter limit for auth-related endpoints
		if path == "/auth/login" || path == "/send-otp" || path == "/send-otp-signup" {
			limit = 10
		}

		// Email-existence probe: allow enough for normal typing on the
		// Register form but throttle bulk enumeration (this replaced the old
		// endpoint that dumped every address at once).
		if path == "/check-email-available" {
			limit = 20
		}

		// Tighter limit for PDF generation
		if path == "/download-pdf" || path == "/send-pdf-to-line" {
			limit = 10
			window = time.Hour
		}

		// LINE webhook: signature verification is skipped entirely when no
		// channel secret is configured (see CreateAppNotificationByLine), so
		// this is the only backstop against a flood of forged webhook calls
		// piling up goroutines/timers per fake "message" event.
		if path == "/line/webhook/notification" {
			limit = 30
		}

		key := ip + "|" + path
		sw := getWindow(key, limit, window)

		if !sw.allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "too_many_requests",
				"message": "Rate limit exceeded. Please try again later.",
			})
			return
		}

		c.Next()
	}
}
