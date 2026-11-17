import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  checkoutSessionBody,
  formEncode,
  orderFromSession,
  parseCountries,
  pickShopId,
  toShopProduct,
  toShopProducts,
  verifyStripeSignature,
} from "../src/lib/shop-catalog.ts";

const raw = {
  id: "6a17c057b25d331fa50ac427",
  title: " Pins & Needles Cap ",
  description: "<p>Low profile &amp; comfy.</p>",
  visible: true,
  variants: [
    { id: 1, title: "Black", price: 1795, is_enabled: true, is_available: true },
    { id: 2, title: "Red", price: 1995, is_enabled: true, is_available: true },
    { id: 3, title: "Off", price: 1000, is_enabled: false },
    { id: 4, title: "Gone", price: 1000, is_enabled: true, is_available: false },
  ],
  images: [
    { src: "https://images.printify.com/a.jpg", is_default: false },
    { src: "https://images.printify.com/b.jpg", is_default: true },
  ],
};

test("toShopProduct keeps only enabled, available variants and the default image", () => {
  const p = toShopProduct(raw)!;
  assert.equal(p.title, "Pins & Needles Cap");
  assert.equal(p.blurb, "Low profile & comfy.");
  assert.deepEqual(p.variants.map((v) => v.id), [1, 2]);
  assert.equal(p.price, 1795);
  assert.equal(p.priceVaries, true);
  assert.equal(p.image, "https://images.printify.com/b.jpg");
});

test("toShopProduct drops hidden products and ones with nothing to sell", () => {
  assert.equal(toShopProduct({ ...raw, visible: false }), null);
  assert.equal(toShopProduct({ ...raw, variants: [{ id: 9, price: 100, is_enabled: false }] }), null);
  assert.deepEqual(toShopProducts({ data: [raw, { ...raw, is_deleted: true }] }).length, 1);
});

test("pickShopId uses only the Printify API shop, never a Shopify-linked one", () => {
  const shops = [
    { id: 24083172, sales_channel: "shopify" },
    { id: 13829335, sales_channel: "custom_integration" },
  ];
  assert.equal(pickShopId(shops), "13829335");
  assert.equal(pickShopId([{ id: 1, sales_channel: "shopify" }]), null);
  assert.equal(pickShopId(shops, " 42 "), "42");
});

test("formEncode builds Stripe's bracketed keys", () => {
  assert.equal(formEncode({ a: { b: ["x y", 2] }, c: true }), "a%5Bb%5D%5B0%5D=x%20y&a%5Bb%5D%5B1%5D=2&c=true");
});

test("checkoutSessionBody charges the Printify price and carries the order details", () => {
  const product = toShopProduct(raw)!;
  const body = new URLSearchParams(
    checkoutSessionBody({ product, variant: product.variants[1], quantity: 2, siteUrl: "https://x.com/", shippingCents: 599, countries: ["US"] })
  );
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1995");
  assert.equal(body.get("line_items[0][quantity]"), "2");
  assert.equal(body.get("metadata[printify_variant_id]"), "2");
  assert.equal(body.get("cancel_url"), "https://x.com/shop");
  assert.equal(body.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "599");
  assert.equal(body.get("shipping_address_collection[allowed_countries][0]"), "US");
});

test("parseCountries falls back to US", () => {
  assert.deepEqual(parseCountries(undefined), ["US"]);
  assert.deepEqual(parseCountries("us, ca,xx1"), ["US", "CA"]);
});

test("verifyStripeSignature accepts Stripe's signature and rejects tampering or old events", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const t = 1_700_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t), true);
  assert.equal(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, t), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_other", t), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 1000), false);
  assert.equal(verifyStripeSignature(body, null, secret, t), false);
});

test("orderFromSession maps a paid session to a Printify address (new and old Stripe shapes)", () => {
  const base = {
    id: "cs_test_1",
    payment_status: "paid",
    metadata: { printify_product_id: raw.id, printify_variant_id: "2", quantity: "1" },
    customer_details: { email: "a@b.co", phone: "+15555550100", name: "Card Name" },
  };
  const address = { line1: "1 Main St", line2: "Apt 2", city: "Brooklyn", state: "NY", postal_code: "11211", country: "US" };
  const fresh = orderFromSession({ ...base, collected_information: { shipping_details: { name: "Mary Jane Doe", address } } })!;
  assert.equal(fresh.variantId, 2);
  assert.equal(fresh.address.first_name, "Mary Jane");
  assert.equal(fresh.address.last_name, "Doe");
  assert.equal(fresh.address.region, "NY");
  assert.equal(fresh.address.email, "a@b.co");
  const old = orderFromSession({ ...base, shipping_details: { name: "Solo", address } })!;
  assert.equal(old.address.first_name, "Solo");
  assert.equal(orderFromSession({ ...base, payment_status: "unpaid", shipping_details: { name: "x", address } }), null);
});
