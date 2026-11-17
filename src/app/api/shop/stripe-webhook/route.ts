import { createPrintifyOrder } from "@/lib/printify";
import { orderFromSession, verifyStripeSignature } from "@/lib/shop-catalog";
import { setSessionMetadata, stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe calls this when someone has paid. It sends the order to Printify,
 * which prints and ships it.
 *
 * Point a Stripe webhook at <site>/api/shop/stripe-webhook for the event
 * checkout.session.completed and put its signing secret in
 * STRIPE_WEBHOOK_SECRET. Stripe retries on any non-2xx answer, so a Printify
 * hiccup is retried; the Printify order id is written back onto the Checkout
 * Session so a retry never orders twice.
 */
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
    if (meta.printify_order_id) return Response.json({ received: true, order: meta.printify_order_id });

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
    });
    await setSessionMetadata(order.sessionId, { printify_order_id: printifyId });
    return Response.json({ received: true, order: printifyId });
  } catch (error) {
    console.error("[shop] order for", sessionId, "failed:", error instanceof Error ? error.message : error);
    return new Response("Order failed; retry", { status: 500 });
  }
}
