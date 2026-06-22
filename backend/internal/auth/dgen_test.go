package auth

import (
	"net/url"
	"testing"
)

func TestBuildEmbeddedAuthURL(t *testing.T) {
	client := DGENClient{
		ClientID:          "client-123",
		RedirectURI:       "https://app.example.com/auth/callback",
		EmbedAuthorizeURL: "https://auth.dgenx.net/embed/authorize",
	}

	raw, err := client.BuildEmbeddedAuthURL("state-value", "https://app.example.com", "#101820")
	if err != nil {
		t.Fatalf("BuildEmbeddedAuthURL returned error: %v", err)
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("generated URL is invalid: %v", err)
	}
	if parsed.Scheme+"://"+parsed.Host+parsed.Path != client.EmbedAuthorizeURL {
		t.Fatalf("unexpected endpoint: %s", raw)
	}
	want := map[string]string{
		"client_id":     "client-123",
		"redirect_uri":  "https://app.example.com/auth/callback",
		"response_type": "code",
		"scope":         dgenOAuthScope,
		"state":         "state-value",
		"parent_origin": "https://app.example.com",
		"bg_color":      "#101820",
	}
	for key, expected := range want {
		if actual := parsed.Query().Get(key); actual != expected {
			t.Errorf("%s = %q, want %q", key, actual, expected)
		}
	}
}

func TestBuildEmbeddedAuthURLRejectsMismatchedOrigins(t *testing.T) {
	client := DGENClient{
		ClientID:          "client-123",
		RedirectURI:       "https://app.example.com/auth/callback",
		EmbedAuthorizeURL: "https://auth.dgenx.net/embed/authorize",
	}

	if _, err := client.BuildEmbeddedAuthURL("state-value", "https://other.example.com", "#101820"); err == nil {
		t.Fatal("expected mismatched redirect and parent origins to fail")
	}
}

func TestBuildEmbeddedAuthURLIgnoresInvalidBackgroundColor(t *testing.T) {
	client := DGENClient{
		ClientID:          "client-123",
		RedirectURI:       "https://app.example.com/auth/callback",
		EmbedAuthorizeURL: "https://auth.dgenx.net/embed/authorize",
	}

	raw, err := client.BuildEmbeddedAuthURL("state-value", "https://app.example.com", "red;display:none")
	if err != nil {
		t.Fatalf("BuildEmbeddedAuthURL returned error: %v", err)
	}
	parsed, _ := url.Parse(raw)
	if parsed.Query().Has("bg_color") {
		t.Fatal("invalid background color should not be included")
	}
}
