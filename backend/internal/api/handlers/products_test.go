package handlers

import (
	"strings"
	"testing"
)

func TestCanonicalProductSlug(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "title punctuation", input: "ShyamInvest | Next-Gen Investment System", want: "shyaminvest-next-gen-investment-system-290682"},
		{name: "existing suffix", input: "shyaminvest-next-gen-investment-system-290682", want: "shyaminvest-next-gen-investment-system-290682"},
		{name: "empty base", input: "---", want: "product-290682"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := canonicalProductSlug(test.input, 290682); got != test.want {
				t.Fatalf("canonicalProductSlug() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestSanitizeDescriptionPreservesEditorFormatting(t *testing.T) {
	input := `<h2 style="text-align: center" onclick="alert(1)">Release</h2><p><span style="color: #ff0000; position: fixed">Important</span></p><table><tbody><tr><th>Item</th><td>Value</td></tr></tbody></table><script>alert(1)</script>`
	got := sanitizeDescription(input)

	for _, expected := range []string{`<h2 style="text-align: center">`, `style="color: #ff0000"`, `<table>`, `<th>Item</th>`} {
		if !strings.Contains(got, expected) {
			t.Fatalf("sanitizeDescription() removed supported editor markup %q from %q", expected, got)
		}
	}
	for _, unsafe := range []string{"onclick", "position:", "<script"} {
		if strings.Contains(got, unsafe) {
			t.Fatalf("sanitizeDescription() retained unsafe content %q in %q", unsafe, got)
		}
	}
}

func TestSanitizeDescriptionRestrictsEmbeds(t *testing.T) {
	input := `<iframe src="https://www.youtube-nocookie.com/embed/abc_123" width="640" height="360" allowfullscreen></iframe><iframe src="https://example.com/embed/bad"></iframe>`
	got := sanitizeDescription(input)
	if !strings.Contains(got, "youtube-nocookie.com/embed/abc_123") {
		t.Fatalf("sanitizeDescription() removed an approved YouTube embed: %q", got)
	}
	if strings.Contains(got, "example.com") {
		t.Fatalf("sanitizeDescription() retained an unapproved iframe: %q", got)
	}
}

func TestProductVisibilityAndPublicAccess(t *testing.T) {
	tests := []struct {
		name       string
		status     string
		metadata   map[string]any
		visibility string
		accessible bool
	}{
		{name: "published approved", status: "approved", metadata: nil, visibility: "published", accessible: true},
		{name: "unlisted approved", status: "approved", metadata: map[string]any{"visibility": "unlisted"}, visibility: "unlisted", accessible: true},
		{name: "unpublished approved", status: "approved", metadata: map[string]any{"visibility": "unpublished"}, visibility: "unpublished", accessible: false},
		{name: "unlisted pending", status: "pending", metadata: map[string]any{"visibility": "unlisted"}, visibility: "unlisted", accessible: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := productVisibility(test.metadata); got != test.visibility {
				t.Fatalf("productVisibility() = %q, want %q", got, test.visibility)
			}
			if got := productIsPubliclyAccessible(test.status, test.metadata); got != test.accessible {
				t.Fatalf("productIsPubliclyAccessible() = %v, want %v", got, test.accessible)
			}
		})
	}
}

func TestResolvedProductStatusProtectsModeration(t *testing.T) {
	tests := []struct {
		name      string
		current   string
		requested string
		role      string
		want      string
	}{
		{name: "seller keeps approval", current: "approved", requested: "draft", role: "seller", want: "approved"},
		{name: "seller cannot self approve", current: "draft", requested: "approved", role: "seller", want: "draft"},
		{name: "seller submits draft", current: "draft", requested: "pending", role: "seller", want: "pending"},
		{name: "seller resubmits rejection", current: "rejected", requested: "pending", role: "seller", want: "pending"},
		{name: "admin can return to draft", current: "approved", requested: "draft", role: "admin", want: "draft"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := resolvedProductStatus(test.current, test.requested, test.role); got != test.want {
				t.Fatalf("resolvedProductStatus() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestProductMetadataReservesTebexPackageID(t *testing.T) {
	metadata := productMetadataWithReserved(
		map[string]any{"visibility": "unlisted", "tebex_package_id": float64(999)},
		map[string]any{"tebex_package_id": float64(42)},
	)
	if metadata["tebex_package_id"] != float64(42) {
		t.Fatalf("reserved package ID was overwritten: %#v", metadata)
	}
	if metadata["visibility"] != "unlisted" {
		t.Fatalf("ordinary metadata was removed: %#v", metadata)
	}
	created := productMetadataWithReserved(map[string]any{"tebex_package_id": float64(999)}, nil)
	if _, ok := created["tebex_package_id"]; ok {
		t.Fatalf("unvalidated package ID was accepted: %#v", created)
	}
}
