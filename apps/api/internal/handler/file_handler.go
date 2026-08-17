package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/my-notion/notionclone/api/internal/service"
)

const maxUploadSize = 50 << 20

type FileHandler struct {
	files service.FileService
}

func NewFileHandler(files service.FileService) *FileHandler {
	return &FileHandler{files: files}
}

func (h *FileHandler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)
	if err := c.Request.ParseMultipartForm(maxUploadSize); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "multipart file is required"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file must be 50MB or smaller"})
		return
	}

	contentType := strings.ToLower(strings.TrimSpace(header.Header.Get("Content-Type")))
	extension, ok := uploadExtensions[contentType]
	if !ok {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "unsupported file type"})
		return
	}

	uploaded, err := h.files.Upload(c.Request.Context(), file, header.Size, contentType, extension)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"file": uploaded})
}

func (h *FileHandler) Download(c *gin.Context) {
	object, contentType, size, err := h.files.Download(c.Request.Context(), c.Param("name"))
	if err != nil {
		h.writeFileError(c, err)
		return
	}
	defer object.Close()

	c.Header("Content-Type", contentType)
	c.Header("Content-Length", strconv.FormatInt(size, 10))
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Status(http.StatusOK)

	if _, err := io.Copy(c.Writer, object); err != nil && !errors.Is(err, io.EOF) {
		_ = c.Error(err)
	}
}

func (h *FileHandler) writeFileError(c *gin.Context, err error) {
	response := minio.ToErrorResponse(err)
	switch response.Code {
	case "NoSuchKey", "NoSuchBucket":
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
	}
}

var uploadExtensions = map[string]string{
	"image/jpeg":       "jpg",
	"image/png":        "png",
	"image/webp":       "webp",
	"image/gif":        "gif",
	"video/mp4":        "mp4",
	"video/webm":       "webm",
	"video/quicktime":  "mov",
	"audio/mpeg":       "mp3",
	"audio/wav":        "wav",
	"audio/ogg":        "ogg",
	"application/pdf":  "pdf",
	"application/zip":  "zip",
	"text/plain":       "txt",
	"text/markdown":    "md",
	"text/csv":         "csv",
	"application/json": "json",
}
