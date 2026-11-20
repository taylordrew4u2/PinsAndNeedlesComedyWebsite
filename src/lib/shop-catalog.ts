import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The shop's pure parts: turning Printify products into what /shop shows,
 * building the Stripe Checkout request, checking Stripe's webhook signature,
 * and turning the address Stripe collected into the one Printify ships to.
 *
 * Nothing here talks to the network, so all of it is tested directly.
 */

export type ShopVariant = { id: number; title: string; price: number };

export type ShopProduct = {
  id: string;
  title: string;
  /** Plain text, tags stripped, for the card. */
  blurb: string;
  image: string | null;
  images: string[];
  variants: ShopVariant[];
  /** Lowest variant price, in cents. */
  price: number;
  /** True when variants differ in price, so the card says "From". */
  priceVaries: boolean;
};

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function shortBlurb(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

/** One Printify product, or null when it cannot be sold (hidden, deleted, nothing enabled). */
export function toShopProduct(raw: unknown): ShopProduct | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  if (raw.visible === false || raw.is_deleted === true) return null;

  const variants: ShopVariant[] = [];
  for (const v of Array.isArray(raw.variants) ? raw.variants : []) {
    if (!isRecord(v) || v.is_enabled !== true || v.is_available === false) continue;
    if (typeof v.id !== "number" || typeof v.price !== "number" || v.price <= 0) continue;
    variants.push({ id: v.id, title: typeof v.title === "string" ? v.title : "Default", price: Math.round(v.price) });
  }
  if (!variants.length) return null;

  const images: string[] = [];
  let image: string | null = null;
  for (const img of Array.isArray(raw.images) ? raw.images : []) {
    if (!isRecord(img) || typeof img.src !== "string" || !img.src.startsWith("https://")) continue;
    images.push(img.src);
    if (img.is_default === true && !image) image = img.src;
  }
  image ??= images[0] ?? null;

  const prices = variants.map((v) => v.price);
  const price = Math.min(...prices);

  return {
    id: raw.id,
    title: raw.title.trim(),
    blurb: shortBlurb(stripTags(typeof raw.description === "string" ? raw.description : "")),
    image,
    images,
    variants,
    price,
    priceVaries: prices.some((p) => p !== price),
  };
}

export function toShopProducts(list: unknown): ShopProduct[] {
  const data = isRecord(list) && Array.isArray(list.data) ? list.data : Array.isArray(list) ? list : [];
  return data.map(toShopProduct).filter((p): p is ShopProduct => p !== null);
}

/**
 * The Printify shop orders go to: the configured one, else the API
 * ("custom integration") shop. Shops linked to another storefront (Shopify,
 * Etsy…) are never picked: their orders belong to that storefront.
 */
export function pickShopId(shops: unknown, configured?: string): string | null {
  if (configured && /^\d+$/.test(configured.trim())) return configured.trim();
  if (!Array.isArray(shops)) return null;
  const api = shops.filter(isRecord).find((s) => typeof s.id === "number" && s.sales_channel === "custom_integration");
  return api ? String(api.id) : null;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ---------------- Stripe Checkout ---------------- */

/** Stripe's API takes form encoding with bracketed keys: a[b][0]=c. */
export function formEncode(value: unknown, prefix = "", out: string[] = []): string {
  if (value === undefined || value === null) return out.join("&");
  if (Array.isArray(value)) {
    value.forEach((item, i) => formEncode(item, `${prefix}[${i}]`, out));
  } else if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) {
      formEncode(inner, prefix ? `${prefix}[${key}]` : key, out);
    }
  } else {
    out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  }
  return out.join("&");
}

export function parseCountries(raw: string | undefined): string[] {
  const list = (raw || "US")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return list.length ? Array.from(new Set(list)) : ["US"];
}

export function checkoutSessionBody(input: {
  product: ShopProduct;
  variant: ShopVariant;
  quantity: number;
  siteUrl: string;
  shippingCents: number;
  countries: string[];
}): string {
  const { product, variant, quantity, siteUrl, shippingCents, countries } = input;
  const base = siteUrl.replace(/\/+$/, "");
  const name = variant.title && variant.title !== "Default" ? `${product.title} — ${variant.title}` : product.title;
  return formEncode({
    mode: "payment",
    success_url: `${base}/shop/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/shop`,
    line_items: [
      {
        quantity,
        price_data: {
          currency: "usd",
          unit_amount: variant.price,
          product_data: { name: name.slice(0, 250), ...(product.image ? { images: [product.image] } : {}) },
        },
      },
    ],
    shipping_address_collection: { allowed_countries: countries },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Standard shipping",
          fixed_amount: { amount: shippingCents, currency: "usd" },
        },
      },
    ],
    phone_number_collection: { enabled: "true" },
    metadata: {
      printify_product_id: product.id,
      printify_variant_id: String(variant.id),
      quantity: String(quantity),
    },
  });
}

/**
 * Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]. The signed payload is
 * `${t}.${rawBody}`, HMAC-SHA256 with the endpoint's whsec_ secret.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
): boolean {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const t = Number(timestamp);
  if (!Number.isFinite(t) || !signatures.length) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/* ---------------- Printify order ---------------- */

export type PrintifyAddress = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2: string;
  city: string;
  zip: string;
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The paid Checkout Session, as Stripe sends it in checkout.session.completed.
 * Newer API versions put the address under collected_information; older ones
 * under shipping_details. Either works.
 */
export function orderFromSession(session: unknown): {
  sessionId: string;
  productId: string;
  variantId: number;
  quantity: number;
  address: PrintifyAddress;
} | null {
  if (!isRecord(session) || typeof session.id !== "string") return null;
  if (session.payment_status !== "paid") return null;
  const meta = isRecord(session.metadata) ? session.metadata : {};
  const productId = str(meta.printify_product_id);
  const variantId = Number(meta.printify_variant_id);
  const quantity = Number(meta.quantity || 1);
  if (!productId || !Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity < 1) return null;

  const collected = isRecord(session.collected_information) ? session.collected_information : {};
  const shipping = isRecord(collected.shipping_details)
    ? collected.shipping_details
    : isRecord(session.shipping_details)
      ? session.shipping_details
      : null;
  const customer = isRecord(session.customer_details) ? session.customer_details : {};
  const addr = shipping && isRecord(shipping.address) ? shipping.address : null;
  if (!shipping || !addr) return null;

  const fullName = str(shipping.name) || str(customer.name);
  const space = fullName.lastIndexOf(" ");
  const first = space > 0 ? fullName.slice(0, space) : fullName;
  const last = space > 0 ? fullName.slice(space + 1) : "";

  return {
    sessionId: session.id,
    productId,
    variantId,
    quantity,
    address: {
      first_name: first || "Customer",
      last_name: last || "-",
      email: str(customer.email),
      phone: str(customer.phone),
      country: str(addr.country),
      region: str(addr.state),
      address1: str(addr.line1),
      address2: str(addr.line2),
      city: str(addr.city),
      zip: str(addr.postal_code),
    },
  };
}

/* ---------------- Saved catalog ---------------- */

const SNAPSHOT_MAX = 250;

/**
 * The last product list Printify gave us, as saved for when it is slow or down.
 * Anything malformed is dropped, and null means there is nothing usable to show.
 * Prices here are display-only: checkout always fetches the product fresh.
 */
export function parseShopSnapshot(raw: unknown): ShopProduct[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.products)) return null;
  const products: ShopProduct[] = [];
  for (const item of raw.products.slice(0, SNAPSHOT_MAX)) {
    if (!isRecord(item)) continue;
    const { id, title, blurb, image, images, variants, price, priceVaries } = item;
    if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id) || typeof title !== "string") continue;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) continue;
    const cleanVariants = (Array.isArray(variants) ? variants : []).filter(
      (v): v is ShopVariant => isRecord(v) && Number.isInteger(v.id) && typeof v.title === "string" && typeof v.price === "number" && Number.isFinite(v.price) && v.price >= 0,
    ).map(({ id, title, price }) => ({ id, title, price }));
    if (!cleanVariants.length) continue;
    const cleanImages = (Array.isArray(images) ? images : []).filter((src): src is string => typeof src === "string" && src.startsWith("https://"));
    products.push({
      id,
      title,
      blurb: typeof blurb === "string" ? blurb : "",
      image: typeof image === "string" && image.startsWith("https://") ? image : cleanImages[0] ?? null,
      images: cleanImages,
      variants: cleanVariants,
      price,
      priceVaries: priceVaries === true,
    });
  }
  return products.length ? products : null;
}
