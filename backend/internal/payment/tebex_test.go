package payment

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTebexHeadlessBasketFlow(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username, password, ok := r.BasicAuth()
		if !ok || username != "public-token" || password != "private-key" {
			t.Fatal("missing or invalid basic authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/accounts/public-token/packages/42":
			_, _ = w.Write([]byte(`{"data":[{"id":42,"name":"Resource","type":"single","base_price":12.5,"total_price":12.5,"currency":"USD"}]}`))
		case r.Method == http.MethodPost && r.URL.Path == "/accounts/public-token/baskets":
			var payload TebexCreateBasketRequest
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Custom["order_id"] != "order-id" {
				t.Fatalf("unexpected basket request: %#v %v", payload, err)
			}
			_, _ = w.Write([]byte(`{"data":{"ident":"basket-id","currency":"USD","links":[]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/baskets/basket-id/packages":
			var payload TebexAddPackageRequest
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.PackageID != 42 || payload.Quantity != 1 {
				t.Fatalf("unexpected package request: %#v %v", payload, err)
			}
			_, _ = w.Write([]byte(`{"ident":"basket-id","base_price":12.5,"total_price":12.5,"currency":"USD"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/accounts/public-token/baskets/basket-id":
			_, _ = w.Write([]byte(`{"data":{"ident":"basket-id","complete":true,"base_price":12.5,"total_price":13.5,"currency":"USD","custom":{"order_id":"order-id"},"links":{"payment":"https://checkout.tebex.io/api/payments/tbx-payment"}}}`))
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	client := TebexClient{PublicToken: "public-token", PrivateKey: "private-key", BaseURL: server.URL}
	pkg, err := client.FetchPackage(context.Background(), 42)
	if err != nil || pkg.ID != 42 || pkg.BasePrice != 12.5 {
		t.Fatalf("FetchPackage = %#v, %v", pkg, err)
	}
	basket, err := client.CreateBasket(context.Background(), TebexCreateBasketRequest{Custom: map[string]any{"order_id": "order-id"}})
	if err != nil || basket.Ident != "basket-id" {
		t.Fatalf("CreateBasket = %#v, %v", basket, err)
	}
	basket, err = client.AddPackage(context.Background(), basket.Ident, pkg.ID, nil)
	if err != nil || basket.BasePrice != 12.5 {
		t.Fatalf("AddPackage = %#v, %v", basket, err)
	}
	basket, err = client.FetchBasket(context.Background(), basket.Ident)
	if err != nil || !basket.Complete || basket.Links.Payment == "" {
		t.Fatalf("FetchBasket = %#v, %v", basket, err)
	}
}

func TestTebexAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"title":"Invalid request","detail":"Package is unavailable"}`))
	}))
	defer server.Close()

	client := TebexClient{PublicToken: "public-token", PrivateKey: "private-key", BaseURL: server.URL}
	_, err := client.FetchBasket(context.Background(), "basket-id")
	apiError, ok := err.(*TebexAPIError)
	if !ok || apiError.Status != http.StatusUnprocessableEntity || apiError.Detail == "" {
		t.Fatalf("unexpected error: %#v", err)
	}
}
