package service

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/my-notion/notionclone/api/internal/config"
)

type File struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

type FileService interface {
	Upload(ctx context.Context, reader io.Reader, size int64, contentType, extension string) (*File, error)
	Download(ctx context.Context, name string) (io.ReadCloser, string, int64, error)
}

type fileService struct {
	client *minio.Client
	bucket string
}

func NewFileService(cfg config.Config) (FileService, error) {
	client, err := minio.New(cfg.MinIOEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
		Secure: cfg.MinIOUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("create minio client: %w", err)
	}

	return &fileService{client: client, bucket: cfg.MinIOBucket}, nil
}

func (s *fileService) Upload(ctx context.Context, reader io.Reader, size int64, contentType, extension string) (*File, error) {
	if err := s.ensureBucket(ctx); err != nil {
		return nil, err
	}

	name := fmt.Sprintf("%s.%s", uuid.NewString(), extension)
	_, err := s.client.PutObject(ctx, s.bucket, name, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return nil, fmt.Errorf("upload file to minio: %w", err)
	}

	return &File{
		Name:        name,
		URL:         "/api/files/" + name,
		ContentType: contentType,
		Size:        size,
	}, nil
}

func (s *fileService) Download(ctx context.Context, name string) (io.ReadCloser, string, int64, error) {
	info, err := s.client.StatObject(ctx, s.bucket, name, minio.StatObjectOptions{})
	if err != nil {
		return nil, "", 0, err
	}

	object, err := s.client.GetObject(ctx, s.bucket, name, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", 0, err
	}

	return object, info.ContentType, info.Size, nil
}

func (s *fileService) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("check minio bucket: %w", err)
	}
	if exists {
		return nil
	}

	if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("create minio bucket: %w", err)
	}
	return nil
}
