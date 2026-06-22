package handlers

import (
	"bytes"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"

	"github.com/gen2brain/webp"
	"golang.org/x/image/draw"
)

const maxImagePixels = 40_000_000

func optimizeProductImage(reader io.Reader, mimeType string, maxDimension int) ([]byte, string, string, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, "", "", err
	}

	if mimeType == "image/gif" {
		config, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width*config.Height > maxImagePixels {
			return nil, "", "", errors.New("invalid or oversized GIF")
		}
		return data, "image/gif", ".gif", nil
	}

	var source image.Image
	if mimeType == "image/webp" {
		source, err = webp.Decode(bytes.NewReader(data))
	} else {
		source, _, err = image.Decode(bytes.NewReader(data))
	}
	if err != nil {
		return nil, "", "", err
	}

	bounds := source.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width <= 0 || height <= 0 || width*height > maxImagePixels {
		return nil, "", "", errors.New("invalid or oversized image")
	}

	if width > maxDimension || height > maxDimension {
		scale := math.Min(float64(maxDimension)/float64(width), float64(maxDimension)/float64(height))
		newWidth := max(1, int(math.Round(float64(width)*scale)))
		newHeight := max(1, int(math.Round(float64(height)*scale)))
		resized := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
		draw.CatmullRom.Scale(resized, resized.Bounds(), source, bounds, draw.Over, nil)
		source = resized
	}

	var output bytes.Buffer
	if err := webp.Encode(&output, source, webp.Options{Quality: 82, Method: 4}); err != nil {
		return nil, "", "", err
	}
	return output.Bytes(), "image/webp", ".webp", nil
}
