package repository

import "testing"

func TestProductPublicIDFromSlug(t *testing.T) {
	for _, slug := range []string{
		"shyaminvest-next-gen-investment-system-290682",
		"290682-shyaminvest-next-gen-investment-system",
		"290682",
	} {
		id, ok := productPublicIDFromSlug(slug)
		if !ok || id != 290682 {
			t.Fatalf("productPublicIDFromSlug(%q) = %d, %v", slug, id, ok)
		}
	}
	if _, ok := productPublicIDFromSlug("product-without-id"); ok {
		t.Fatal("productPublicIDFromSlug accepted a slug without an ID")
	}
}
