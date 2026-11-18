import "server-only";
import { claimProduction } from "./shop-production-claim";

import { fetchWithin } from "./fetch-within";
import { fulfillPrintifyOrder, PrintifyError } from "./shop-fulfillment";
import { pickShopId, toShopProduct, toShopProducts, type PrintifyAddress, type ShopProduct } from "./shop-catalog";

/**
 * Printify, read and written from the server only. The token never reaches
 * the browser: set PRINTIFY_API_TOKEN in the deployment's environment.
 */

const API = "https://api.printify.com/v1";
const TIMEOUT_MS = 10_000;

export function printifyConfigured(): boolean {
  return !!process.env.PRINTIFY_API_TOKEN?.trim();
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN?.trim() ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "PinsAndNeedlesComedy-Site",
  };
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const { response, text } = await fetchWithin(`${API}${path}`, { ...init, headers: headers(), redirect: "error" }, TIMEOUT_MS);
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* Non-JSON upstream error. */ }
  if (!response.ok) throw new PrintifyError(response.status, data);
  return data;
}

export async function printifyShopId(): Promise<string | null> {
  const configured = process.env.PRINTIFY_SHOP_ID;
  if (configured?.trim()) return pickShopId(null, configured);
  return pickShopId(await call("/shops.json", { next: { revalidate: 3600 } }));
}

/** Everything sellable, cached for five minutes so /shop stays quick. */
export async function listShopProducts(): Promise<ShopProduct[]> {
  if (!printifyConfigured()) return [];
  try {
    const shop = await printifyShopId();
    if (!shop) return [];
    const products: ShopProduct[] = [];
    for (let page = 1; page <= 5; page++) {
      const data = await call(`/shops/${shop}/products.json?limit=50&page=${page}`, { next: { revalidate: 300 } });
      products.push(...toShopProducts(data));
      const last = (data as { last_page?: number } | null)?.last_page ?? 1;
      if (page >= last) break;
    }
    return products;
  } catch (error) {
    console.error("[shop] could not load Printify products:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** One product, fresh — the price charged at checkout comes from here, never from the browser. */
export async function getShopProduct(productId: string): Promise<ShopProduct | null> {
  if (!/^[a-f0-9]{24}$/i.test(productId)) return null;
  const shop = await printifyShopId();
  if (!shop) return null;
  return toShopProduct(await call(`/shops/${shop}/products/${productId}.json`, { cache: "no-store" }));
}

/** Recover or create one order, persist its identity, then resume production. */
export async function createPrintifyOrder(input: {
  externalId: string;
  productId: string;
  variantId: number;
  quantity: number;
  address: PrintifyAddress;
  existingId?: string;
  existingShopId?: string;
  saveOrder: (id: string, shopId: string) => Promise<unknown>;
}): Promise<string> {
  const shop = input.existingShopId || await printifyShopId();
  if (!shop) throw new Error("No Printify API shop found");
  return fulfillPrintifyOrder({
    shopId: shop,
    externalId: input.externalId,
    existingId: input.existingId,
    hold: process.env.PRINTIFY_HOLD_ORDERS === "1",
    body: {
      label: `Website ${input.externalId.slice(-8)}`,
      line_items: [{ product_id: input.productId, variant_id: input.variantId, quantity: input.quantity }],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: input.address,
    },
  }, { call, saveOrder: input.saveOrder, claimProduction });
}
