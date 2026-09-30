import "server-only";
import { timingSafeEqual } from "node:crypto";
import { decisionQrKey, validDecisionQrKey } from "./decision-access";
import { readRecord, writeRecord } from "./live-store";
import { getContent } from "./store";
import { siteBase } from "./seo";

/**
 * The Bad Decisions QR is printed once and reused every week, so the address
 * it encodes must never change. The first time it is generated, its key and
 * full URL are written to their own record (never content.json, which the
 * admin autosaves wholesale) and every QR after that is drawn from the
 * record. Rotating ADMIN_SECRET or editing the site URL leaves printed codes
 * working.
 */
const RECORD = "live-show/decisions-qr.json";
const KEY_SHAPE = /^[a-f0-9]{64}$/;

export type LockedQr = { key: string; url: string };

let cached: LockedQr | null = null;

function parse(raw: unknown): LockedQr | null {
  if (!raw || typeof raw !== "object") return null;
  const { key, url } = raw as Record<string, unknown>;
  if (typeof key !== "string" || !KEY_SHAPE.test(key) || typeof url !== "string" || !url) return null;
  return { key, url };
}

/** The permanent QR key and URL, created from today's values on first use. */
export async function lockedDecisionQr(): Promise<LockedQr | null> {
  if (cached) return cached;
  const stored = parse(await readRecord(RECORD).catch(() => null));
  if (stored) return (cached = stored);

  const key = decisionQrKey();
  const base = siteBase((await getContent()).site.url);
  if (!key || !base) return null;
  const fresh = { key, url: `${base}/bad-decisions?qr=${key}` };
  try {
    await writeRecord(RECORD, fresh, "Lock the Bad Decisions QR code");
    cached = fresh;
  } catch (error) {
    // Not cached, so the next request tries to lock it again.
    console.error("[decisions-qr] could not save the locked QR", error);
  }
  return fresh;
}

/** Accepts the locked key forever, plus today's derived key. */
export async function isValidDecisionQr(value: unknown): Promise<boolean> {
  if (validDecisionQrKey(value)) return true;
  if (typeof value !== "string" || !KEY_SHAPE.test(value)) return false;
  const locked = await lockedDecisionQr();
  return Boolean(locked) && timingSafeEqual(Buffer.from(value), Buffer.from(locked!.key));
}
