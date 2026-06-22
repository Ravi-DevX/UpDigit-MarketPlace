package handlers

import (
	"io"
	"mime/multipart"
	"regexp"
	"strings"

	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/microcosm-cc/bluemonday"
)

func detectFileMagic(file multipart.File) (string, error) {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return "", err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	return http.DetectContentType(buf[:n]), nil
}

var richTextSanitizer = newRichTextSanitizer()

func newRichTextSanitizer() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowStyles("text-align").MatchingEnum("left", "center", "right", "justify").OnElements("p", "h1", "h2", "h3", "h4", "h5", "h6")
	colorPattern := regexp.MustCompile(`(?i)^(#[0-9a-f]{3,8}|rgba?\([0-9.,% ]+\)|hsla?\([0-9.,% deg]+\)|transparent)$`)
	p.AllowStyles("color").Matching(colorPattern).OnElements("span")
	p.AllowStyles("background-color").Matching(colorPattern).OnElements("span", "mark")
	p.AllowAttrs("src").Matching(regexp.MustCompile(`(?i)^https://(www\.)?(youtube\.com|youtube-nocookie\.com)/embed/[a-z0-9_-]+(?:\?.*)?$`)).OnElements("iframe")
	p.AllowAttrs("width", "height").Matching(regexp.MustCompile(`^[0-9]{1,4}$`)).OnElements("iframe")
	p.AllowAttrs("allowfullscreen").Matching(regexp.MustCompile(`(?i)^(|true|allowfullscreen)$`)).OnElements("iframe")
	return p
}

func sanitizeDescription(input string) string {
	return strings.TrimSpace(richTextSanitizer.Sanitize(input))
}

func sanitizeSlug(s string) string {
	base := strings.ToLower(strings.TrimSpace(s))
	base = strings.ReplaceAll(base, " ", "-")
	base = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r + ('a' - 'A')
		case r >= '0' && r <= '9':
			return r
		case r == '-' || r == '_' || r == '.':
			return r
		}
		return -1
	}, base)
	base = strings.Trim(base, "-_.")
	if base == "" {
		return "item-" + time.Now().Format("20060102-150405")
	}
	return base
}

func isAllowedArtifactMime(mimeType string) bool {
	allowed := map[string]bool{
		"application/zip":              true,
		"application/x-zip-compressed": true,
		"application/x-rar-compressed": true,
		"application/x-7z-compressed":  true,
		"application/gzip":             true,
		"application/x-gzip":           true,
		"application/octet-stream":     true,
		"application/x-msdownload":     true,
	}
	return allowed[mimeType]
}

func isAllowedImageMime(mimeType string) bool {
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp", "image/gif":
		return true
	default:
		return false
	}
}

func productVisibility(metadata map[string]any) string {
	if value, ok := metadata["visibility"].(string); ok {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "unlisted", "unpublished":
			return strings.ToLower(strings.TrimSpace(value))
		}
	}
	return "published"
}

func productIsPubliclyAccessible(status string, metadata map[string]any) bool {
	return status == "approved" && productVisibility(metadata) != "unpublished"
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func writeJSONError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}
