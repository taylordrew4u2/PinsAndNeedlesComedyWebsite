import "server-only";

import { fetchWithin } from "./fetch-within";
import { formEncode } from "./shop-catalog";

/** Stripe over plain REST — no SDK needed for the three calls the shop makes. */

const API = "https://api.stripe.com/v1";

let warnedAboutKey = false;

/**
 * True only for a server-side key. A publishable key (pk_...) pasted into
 * STRIPE_SECRET_KEY looks set but every call fails, so treat it as unset.
 */
export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return false;
  if (/^(sk|rk)_/.test(key)) return true;
  if (!warnedAboutKey) {
    warnedAboutKey = true;
    console.error("[shop] STRIPE_SECRET_KEY is not a secret key (it should start with sk_ or rk_). The shop stays closed until it is replaced.");
  }
  return false;
}

export async function stripe(path: string, body?: string, idempotencyKey?: string): Promise<Record<string, unknown>> {
  const { response, text } = await fetchWithin(
    `${API}${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY?.trim() ?? ""}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
      cache: "no-store",
      redirect: "error",
    },
    15_000
  );
  const data = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!response.ok) {
    const message = (data.error as { message?: string } | undefined)?.message ?? `status ${response.status}`;
    throw new Error(`Stripe: ${message}`);
  }
  return data;
}

export function setSessionMetadata(sessionId: string, metadata: Record<string, string>) {
  return stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`, formEncode({ metadata }));
}
