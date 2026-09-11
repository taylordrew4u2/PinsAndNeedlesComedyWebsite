import { createHmac, timingSafeEqual } from "node:crypto";

/** Stable across deploys; rotating the admin secret also replaces printed QR access. */
export function decisionQrKey(secret = process.env.ADMIN_SECRET || ""): string {
  return secret ? createHmac("sha256", secret).update("bad-decisions-qr-v1").digest("hex") : "";
}

export function validDecisionQrKey(value: unknown, secret = process.env.ADMIN_SECRET || ""): value is string {
  const expected = decisionQrKey(secret);
  if (!expected || typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
