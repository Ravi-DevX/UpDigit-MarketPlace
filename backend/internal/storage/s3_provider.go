package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"marketplace/backend/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3Provider struct {
	client             *s3.Client
	presigner          *s3.PresignClient
	bucketName         string
	publicURL          string
	region             string
	useEndpoint        bool
	publicURLHasBucket bool
}

func NewS3Provider(cfg *config.Config) (StorageProvider, error) {
	var optsFunc []func(*awsConfig.LoadOptions) error
	optsFunc = append(optsFunc, awsConfig.WithRegion(cfg.S3Region))
	optsFunc = append(optsFunc, awsConfig.WithCredentialsProvider(
		credentials.NewStaticCredentialsProvider(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, ""),
	))

	awsCfg, err := awsConfig.LoadDefaultConfig(context.Background(), optsFunc...)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})
	presigner := s3.NewPresignClient(client)

	provider := &s3Provider{
		client:             client,
		presigner:          presigner,
		bucketName:         cfg.S3BucketName,
		publicURL:          "",
		region:             cfg.S3Region,
		useEndpoint:        cfg.S3Endpoint != "",
		publicURLHasBucket: true,
	}

	if cfg.S3Endpoint != "" {
		u, err := url.Parse(cfg.S3Endpoint)
		if err == nil && u.Host != "" {
			provider.publicURL = strings.TrimSuffix(cfg.S3Endpoint, "/")
		}
	}
	return provider, nil
}

func (s *s3Provider) Upload(ctx context.Context, key string, file io.Reader, contentType string, size int64) (string, error) {
	uploader := manager.NewUploader(s.client)
	input := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucketName),
		Key:           aws.String(key),
		Body:          file,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}
	if strings.HasPrefix(contentType, "image/") {
		input.CacheControl = aws.String("public, max-age=31536000, immutable")
	}
	_, err := uploader.Upload(ctx, input)
	if err != nil {
		return "", err
	}
	return s.GetPublicURL(key), nil
}

func (s *s3Provider) GetSignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	if s.publicURL != "" {
		return s.GetPublicURL(key), nil
	}
	req, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(key),
	}, func(po *s3.PresignOptions) {
		po.Expires = expiry
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *s3Provider) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(key),
	})
	return err
}

func (s *s3Provider) GetPublicURL(key string) string {
	if s.useEndpoint && s.publicURL != "" {
		if !s.publicURLHasBucket {
			return fmt.Sprintf("%s/%s", s.publicURL, key)
		}
		return fmt.Sprintf("%s/%s/%s", s.publicURL, s.bucketName, key)
	}
	if s.region == "" {
		return key
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucketName, s.region, key)
}

func NewR2Provider(cfg *config.Config) (StorageProvider, error) {
	if cfg.R2BucketName == "" {
		return nil, errors.New("R2 bucket name required for storage provider r2")
	}

	var optsFunc []func(*awsConfig.LoadOptions) error
	optsFunc = append(optsFunc, awsConfig.WithRegion("auto"))
	optsFunc = append(optsFunc, awsConfig.WithCredentialsProvider(
		credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, ""),
	))
	endpoint := strings.TrimSuffix(cfg.R2S3Endpoint, "/")
	if endpoint == "" && cfg.R2AccountID != "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)
	}
	if endpoint != "" {
		optsFunc = append(optsFunc, awsConfig.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:               endpoint,
					SigningRegion:     "auto",
					HostnameImmutable: true,
				}, nil
			}),
		))
	}

	awsCfg, err := awsConfig.LoadDefaultConfig(context.Background(), optsFunc...)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})
	presigner := s3.NewPresignClient(client)

	return &s3Provider{
		client:             client,
		presigner:          presigner,
		bucketName:         cfg.R2BucketName,
		publicURL:          strings.TrimSuffix(cfg.R2PublicURL, "/"),
		useEndpoint:        strings.TrimSpace(cfg.R2PublicURL) != "",
		publicURLHasBucket: false,
		region:             "auto",
	}, nil
}
