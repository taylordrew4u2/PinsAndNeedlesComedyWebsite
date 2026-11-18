import { createPrintifyOrder } from "@/lib/printify";
import { orderFromSession, verifyStripeSignature } from "@/lib/shop-catalog";
import { setSessionMetadata, stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Verified paid events resume the same provider order, including partial failures. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return new Response("Bad signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return Response.json({ received: true });
  }

  const sessionId = event.data?.object?.id;
  if (typeof sessionId !== "string") return new Response("No session", { status: 400 });

  try {
    // Read the session fresh: the latest metadata says whether it was already ordered.
    const session = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const meta = (session.metadata ?? {}) as Record<string, string>;

    const order = orderFromSession(session);
    if (!order) {
      // Not paid yet (delayed methods send async_payment_succeeded later) or not a shop session.
      return Response.json({ received: true, skipped: true });
    }

    const printifyId = await createPrintifyOrder({
      externalId: order.sessionId,
      productId: order.productId,
      variantId: order.variantId,
      quantity: order.quantity,
      address: order.address,
      existingId: meta.printify_order_id,
      existingShopId: meta.printify_shop_id,
      saveOrder: (id, shopId) => setSessionMetadata(order.sessionId, {
        printify_order_id: id, printify_shop_id: shopId,
      }),
    });
    return Response.json({ received: true, order: printifyId });
  } catch (error) {
    console.error("[shop] order for", sessionId, "failed:", error instanceof Error ? error.message : error);
    return new Response("Order failed; retry", { status: 500 });
  }
}
