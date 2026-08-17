package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	JWTExpiresIn       time.Duration
	CORSAllowedOrigins string
	MinIOEndpoint      string
	MinIOAccessKey     string
	MinIOSecretKey     string
	MinIOBucket        string
	MinIOUseSSL        bool
}

func Load() Config {
	_ = godotenv.Load()

	expiry := getEnv("JWT_EXPIRES_IN", "24h")
	duration, err := time.ParseDuration(expiry)
	if err != nil {
		duration = 24 * time.Hour
	}

	return Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://notion:notion@localhost:5432/notion?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiresIn:       duration,
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		MinIOEndpoint:      getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:     getEnv("MINIO_ACCESS_KEY", "notion"),
		MinIOSecretKey:     getEnv("MINIO_SECRET_KEY", "notion-minio"),
		MinIOBucket:        getEnv("MINIO_BUCKET", "notion-files"),
		MinIOUseSSL:        getEnv("MINIO_USE_SSL", "false") == "true",
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
