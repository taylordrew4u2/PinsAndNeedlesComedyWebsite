import { productionClaimsConfigured } from "@/lib/shop-production-claim";
import { getShopProduct, printifyConfigured } from "@/lib/printify";
import { checkoutSessionBody, parseCountries } from "@/lib/shop-catalog";
import { stripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Start a Stripe Checkout for one Printify product variant.
 *
 * The browser sends only ids and a quantity. The price, name and picture all
 * come from Printify here on the server, so nobody can edit what they pay.
 */
export async function POST(request: Request): Promise<Response> {
  if (!productionClaimsConfigured() || !printifyConfigured() || !stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    return Response.json({ error: "The shop is not open yet." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId : "";
  const variantId = Number(body.variantId);
  const quantity = Number(body.quantity ?? 1);
  if (!productId || !Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return Response.json({ error: "Pick an option and a quantity from 1 to 10." }, { status: 400 });
  }

  try {
    const product = await getShopProduct(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return Response.json({ error: "That item is no longer available." }, { status: 404 });

    const shipping = Number(process.env.SHOP_SHIPPING_CENTS ?? 599);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
    const session = await stripe(
      "/checkout/sessions",
      checkoutSessionBody({
        product,
        variant,
        quantity,
        siteUrl,
        shippingCents: Number.isInteger(shipping) && shipping >= 0 ? shipping : 599,
        countries: parseCountries(process.env.SHOP_SHIP_COUNTRIES),
      })
    );
    if (typeof session.url !== "string") throw new Error("Stripe returned no checkout URL");
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[shop] checkout failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Checkout could not start. Try again in a minute." }, { status: 502 });
  }
}
