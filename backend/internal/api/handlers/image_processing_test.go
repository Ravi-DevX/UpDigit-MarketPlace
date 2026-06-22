package handlers

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"testing"

	"github.com/gen2brain/webp"
)

func TestOptimizeProductImageConvertsAndResizesStaticImage(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 1200, 600))
	for y := 0; y < 600; y++ {
		for x := 0; x < 1200; x++ {
			source.SetRGBA(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 120, A: 255})
		}
	}
	var input bytes.Buffer
	if err := png.Encode(&input, source); err != nil {
		t.Fatal(err)
	}

	output, mimeType, extension, err := optimizeProductImage(bytes.NewReader(input.Bytes()), "image/png", 600)
	if err != nil {
		t.Fatal(err)
	}
	if mimeType != "image/webp" || extension != ".webp" {
		t.Fatalf("got %s %s, want image/webp .webp", mimeType, extension)
	}
	decoded, err := webp.Decode(bytes.NewReader(output))
	if err != nil {
		t.Fatalf("optimized output is not valid WebP: %v", err)
	}
	if got := decoded.Bounds().Size(); got.X != 600 || got.Y != 300 {
		t.Fatalf("optimized dimensions = %dx%d, want 600x300", got.X, got.Y)
	}
}

func TestOptimizeProductImagePreservesGIF(t *testing.T) {
	frame := image.NewPaletted(image.Rect(0, 0, 2, 2), color.Palette{color.Black, color.White})
	animation := &gif.GIF{Image: []*image.Paletted{frame, frame}, Delay: []int{5, 5}}
	var input bytes.Buffer
	if err := gif.EncodeAll(&input, animation); err != nil {
		t.Fatal(err)
	}

	output, mimeType, extension, err := optimizeProductImage(bytes.NewReader(input.Bytes()), "image/gif", 600)
	if err != nil {
		t.Fatal(err)
	}
	if mimeType != "image/gif" || extension != ".gif" {
		t.Fatalf("got %s %s, want image/gif .gif", mimeType, extension)
	}
	if !bytes.Equal(output, input.Bytes()) {
		t.Fatal("GIF bytes changed during optimization")
	}
}

func TestDetectFileMagicAcceptsShortFilesAndRewinds(t *testing.T) {
	frame := image.NewPaletted(image.Rect(0, 0, 2, 2), color.Palette{color.Black, color.White})
	var input bytes.Buffer
	if err := gif.Encode(&input, frame, nil); err != nil {
		t.Fatal(err)
	}
	if input.Len() >= 512 {
		t.Fatalf("test fixture must remain shorter than the detection buffer, got %d bytes", input.Len())
	}

	file, err := os.CreateTemp(t.TempDir(), "short-image-*.gif")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if _, err := file.Write(input.Bytes()); err != nil {
		t.Fatal(err)
	}
	if _, err := file.Seek(0, 0); err != nil {
		t.Fatal(err)
	}

	mimeType, err := detectFileMagic(file)
	if err != nil {
		t.Fatal(err)
	}
	if mimeType != "image/gif" {
		t.Fatalf("detected MIME = %q, want image/gif", mimeType)
	}
	position, err := file.Seek(0, 1)
	if err != nil {
		t.Fatal(err)
	}
	if position != 0 {
		t.Fatalf("file position = %d, want 0", position)
	}
}
