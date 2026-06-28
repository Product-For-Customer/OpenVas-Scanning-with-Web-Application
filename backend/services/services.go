package services

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type JWTClaims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GetJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "super-secret-dev-key-change-this"
	}
	return secret
}

func GenerateJWT(userID uint, email string, role string) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "openvas-backend",
			Subject:   email,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(GetJWTSecret()))
}

func ParseJWT(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(GetJWTSecret()), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password string, hashedPassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

// ── Login Email-OTP JWT ─────────────────────────────────────────────────────

// LoginOTPClaims embeds the one-time code so the backend can verify it without
// a database round-trip. The cookie is httpOnly so the client cannot read it.
type LoginOTPClaims struct {
	UserID  uint   `json:"user_id"`
	Email   string `json:"email"`
	OTPCode string `json:"otp_code"`
	jwt.RegisteredClaims
}

// GenerateLoginOTPToken creates a 5-minute JWT that carries the OTP code.
func GenerateLoginOTPToken(userID uint, email, otpCode string) (string, error) {
	claims := LoginOTPClaims{
		UserID:  userID,
		Email:   email,
		OTPCode: otpCode,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "openvas-backend",
			Subject:   email,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(GetJWTSecret()))
}

// ParseLoginOTPToken validates and parses a login-OTP pending cookie.
func ParseLoginOTPToken(tokenString string) (*LoginOTPClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &LoginOTPClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(GetJWTSecret()), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*LoginOTPClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid login OTP token")
	}
	return claims, nil
}

// GeneratePendingTOTPToken issues a short-lived JWT (5 min) used while the user
// still needs to pass the TOTP challenge. Role is set to "totp_pending" so it
// cannot be accepted by the normal auth middleware.
func GeneratePendingTOTPToken(userID uint, email string) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   "totp_pending",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "openvas-backend",
			Subject:   email,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(GetJWTSecret()))
}

// ParsePendingTOTPToken parses a totp_pending cookie and validates that it
// carries the "totp_pending" role marker.
func ParsePendingTOTPToken(tokenString string) (*JWTClaims, error) {
	claims, err := ParseJWT(tokenString)
	if err != nil {
		return nil, err
	}
	if claims.Role != "totp_pending" {
		return nil, errors.New("not a pending TOTP token")
	}
	return claims, nil
}
