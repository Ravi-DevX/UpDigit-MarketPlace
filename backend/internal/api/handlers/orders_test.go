package handlers

import (
	"testing"

	"marketplace/backend/internal/models"
	"marketplace/backend/internal/payment"
)

func TestValidTebexCheckoutURL(t *testing.T) {
	for _, raw := range []string{
		"https://checkout.tebex.io/checkout/basket-id",
		"https://pay.tebex.io/basket-id",
	} {
		if !validTebexCheckoutURL(raw) {
			t.Errorf("expected valid Tebex URL: %s", raw)
		}
	}
	for _, raw := range []string{
		"http://checkout.tebex.io/checkout/basket-id",
		"https://checkout.tebex.io.evil.example/basket-id",
		"javascript:alert(1)",
	} {
		if validTebexCheckoutURL(raw) {
			t.Errorf("expected invalid Tebex URL: %s", raw)
		}
	}
}

func TestTebexBasketMatchesOrder(t *testing.T) {
	ident := "basket-id"
	order := models.Order{ID: "order-id", BuyerID: "buyer-id", ProductID: "product-id", Amount: 12.5, Currency: "USD", PaymentID: &ident}
	basket := payment.TebexBasket{
		Ident:     ident,
		BasePrice: 12.5,
		Currency:  "USD",
		Custom: map[string]any{
			"order_id":   "order-id",
			"buyer_id":   "buyer-id",
			"product_id": "product-id",
			"currency":   "USD",
		},
	}
	if !tebexBasketMatchesOrder(basket, order) {
		t.Fatal("expected basket metadata to match order")
	}
	basket.Custom["buyer_id"] = "different-buyer"
	if tebexBasketMatchesOrder(basket, order) {
		t.Fatal("basket with different buyer must not match")
	}
}

func TestProductTebexPackageID(t *testing.T) {
	for _, value := range []any{float64(42), "42", int64(42)} {
		id, ok := productTebexPackageID(map[string]any{"tebex_package_id": value})
		if !ok || id != 42 {
			t.Fatalf("productTebexPackageID(%#v) = %d, %t", value, id, ok)
		}
	}
	if _, ok := productTebexPackageID(map[string]any{"tebex_package_id": 4.2}); ok {
		t.Fatal("fractional package ID must be rejected")
	}
}

func TestTebexTransactionID(t *testing.T) {
	valid := "https://checkout.tebex.io/api/payments/tbx-payment?type=txn_id"
	if got := tebexTransactionID(valid); got != "tbx-payment" {
		t.Fatalf("tebexTransactionID() = %q", got)
	}
	if got := tebexTransactionID("https://checkout.tebex.io.evil.example/api/payments/tbx-payment"); got != "" {
		t.Fatalf("untrusted payment URL returned %q", got)
	}
}

func TestTebexPaymentReferenceFallsBackToBasket(t *testing.T) {
	basket := payment.TebexBasket{Ident: "basket-id"}
	if got := tebexPaymentReference(basket); got != "tebex-basket:basket-id" {
		t.Fatalf("tebexPaymentReference() = %q", got)
	}
	basket.Links.Payment = "https://checkout.tebex.io/api/payments/tbx-payment"
	if got := tebexPaymentReference(basket); got != "tbx-payment" {
		t.Fatalf("tebexPaymentReference() = %q", got)
	}
}
