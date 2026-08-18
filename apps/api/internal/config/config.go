package config

import (
	"os"
	"strconv"
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
	ZVecServiceURL     string
	DeepSeekAPIKey     string
	DeepSeekBaseURL    string
	DeepSeekModel      string
	ChatTopK           int
	ChatSourceMaxScore float64
	ChatSourceMargin   float64
	ChatSourceMinChars int
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
		ZVecServiceURL:     getEnv("ZVEC_SERVICE_URL", "http://localhost:8765"),
		DeepSeekAPIKey:     getEnv("DEEPSEEK_API_KEY", ""),
		DeepSeekBaseURL:    getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
		DeepSeekModel:      getEnv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
		ChatTopK:           getEnvInt("CHAT_TOP_K", 5),
		ChatSourceMaxScore: getEnvFloat("CHAT_SOURCE_MAX_SCORE", 1.2),
		ChatSourceMargin:   getEnvFloat("CHAT_SOURCE_MARGIN", 0.35),
		ChatSourceMinChars: getEnvInt("CHAT_SOURCE_MIN_CHARS", 20),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func getEnvFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(os.Getenv(key), 64)
	if err != nil {
		return fallback
	}
	return value
}
