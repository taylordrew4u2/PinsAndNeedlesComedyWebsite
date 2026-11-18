/** Network-independent fulfillment workflow; injected I/O makes failure paths testable. */
export class PrintifyError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`Printify request failed (${status})`);
    this.status = status;
    this.data = data;
  }
}

type Order = { id?: string; status?: string; metadata?: { shop_order_id?: string | number } };
type Call = (path: string, init?: RequestInit) => Promise<unknown>;
const accepted = new Set(["sending-to-production", "in-production", "fulfilled", "partially-fulfilled"]);
const idPattern = /^[a-zA-Z0-9_-]+$/;

/**
 * Printify enforces unique external_id per shop. A 409 includes the existing
 * order, allowing recovery even if the create response or Stripe write was lost.
 * Keep the same ID on every retry; never create a replacement for a failed order.
 */
export async function fulfillPrintifyOrder(input: {
  shopId: string;
  externalId: string;
  existingId?: string;
  body: Record<string, unknown>;
  hold: boolean;
}, io: { call: Call; saveOrder: (id: string, shopId: string) => Promise<unknown>; claimProduction: (shopId: string, id: string) => Promise<boolean> }): Promise<string> {
  if (!idPattern.test(input.shopId)) throw new Error("Invalid Printify shop ID");
  const base = `/shops/${input.shopId}/orders`;
  let id = input.existingId;
  if (!id) {
    try {
      const created = await io.call(`${base}.json`, {
        method: "POST", cache: "no-store",
        body: JSON.stringify({ ...input.body, external_id: input.externalId }),
      }) as Order | null;
      id = created?.id;
    } catch (error) {
      if (!(error instanceof PrintifyError) || error.status !== 409) throw error;
      const duplicate = (error.data as { order?: { id?: string; external_id?: string } } | null)?.order;
      if (duplicate?.external_id !== input.externalId || !duplicate.id) throw error;
      id = duplicate.id;
    }
  }
  if (!id || !idPattern.test(id)) throw new Error("No valid Printify order ID");
  const path = `${base}/${id}`;
  const read = async () => {
    const order = await io.call(`${path}.json`, { cache: "no-store" }) as Order | null;
    if (order?.id !== id || String(order.metadata?.shop_order_id ?? "") !== input.externalId) {
      throw new Error("Printify order does not match this checkout");
    }
    return order;
  };
  const order = await read();
  // Persist identity BEFORE production. Failure here prevents this worker sending.
  // Concurrent workers can only resolve to the same provider-enforced unique order.
  await io.saveOrder(id, input.shopId);
  if (accepted.has(order.status ?? "")) return id;
  if (order.status === "pending" || order.status === "cost-calculation") throw new Error("Printify order not ready; retry");
  if (order.status !== "on-hold") throw new Error(`Printify order needs review (${order.status ?? "unknown"})`);
  if (input.hold) return id;
  // Permanent atomic claim, not an expiring lock. Unknown send outcomes never
  // authorize a second submission. A crash after claiming requires review.
  if (!await io.claimProduction(input.shopId, id)) {
    if (accepted.has((await read()).status ?? "")) return id;
    throw new Error("Production already claimed; outcome uncertain, review required");
  }
  // Another process/operator may have advanced the provider since our first read.
  const latest = await read();
  if (accepted.has(latest.status ?? "")) return id;
  if (latest.status !== "on-hold") throw new Error("Claimed order changed state; review required");
  try {
    await io.call(`${path}/send_to_production.json`, { method: "POST", cache: "no-store" });
  } catch (error) {
    // A timeout/conflict may mean another delivery (or this request) succeeded.
    // Only acknowledge if provider state confirms acceptance. Otherwise retain
    // the same order ID and return an error so Stripe can retry/review can occur.
    if (!accepted.has((await read()).status ?? "")) throw error;
  }
  return id;
}
