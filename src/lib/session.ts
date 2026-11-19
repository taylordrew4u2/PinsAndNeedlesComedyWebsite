/**
 * Admin session policy: passwords, signing, and the cookie's shape.
 *
 * Deliberately free of any Next.js import. The rules about when the admin is
 * usable are the security-critical part of this app, and keeping them in a
 * plain module means they can be tested directly by the Node test runner
 * rather than only through a running server. `auth.ts` is the thin layer that
 * binds this to the request.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const COOKIE = "pnc_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Admin credentials.
 *
 * Both of these used to fall back to constants baked into this file, in a
 * public repository. That is not a weak password so much as no password: the
 * signing secret was derived from it, so anyone reading the source could mint
 * a valid session cookie without ever visiting the login form.
 *
 * In production there is now no fallback. If either variable is missing the
 * admin fails closed — every login is refused and every existing cookie stops
 * verifying — which is the safe direction to fail in for the one route that
 * can rewrite the whole site. Development keeps working out of the box.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Only ever used off production, so a checkout runs with no setup. */
const DEV_PASSWORD = "dev";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? "" : DEV_PASSWORD);

/**
 * A second password for a producer who runs the show but not the site: it
 * opens the Control Center and the few routes it calls, nothing else. Unset
 * means no producer login at all. Off production "producer" works, so the
 * role can be tried locally with no setup.
 */
const PRODUCER_PASSWORD = process.env.PRODUCER_PASSWORD || (IS_PRODUCTION ? "" : "producer");

/** Who a session belongs to: the site's owner, or a producer limited to the Control Center. */
export type Role = "admin" | "producer";

/**
 * Signing secret. Never derived from the password any more: knowing one should
 * not hand you the other. Off production it is random per process, so sessions
 * simply do not survive a restart.
 */
const SECRET =
  process.env.ADMIN_SECRET || (IS_PRODUCTION ? "" : randomBytes(32).toString("hex"));

/**
 * The server's own secret, for locking away what the admin saves (see
 * secret-box.ts). Only one set on purpose: off production the signing
 * secret falls back to a random one per process, and a key locked with that
 * could be opened by nothing once the process restarts. "" when none is set.
 */
export function sealingSecret(): string {
  return (process.env.ADMIN_SECRET || "").trim();
}

/** Whether the admin is usable at all. False in production with no secrets set. */
export function adminConfigured(): boolean {
  return Boolean(ADMIN_PASSWORD) && Boolean(SECRET);
}

if (IS_PRODUCTION && !adminConfigured()) {
  console.error(
    "[auth] ADMIN_PASSWORD and ADMIN_SECRET are not set. /admin is disabled until they are."
  );
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/**
 * A signed session cookie. An owner's payload is "expiry.nonce", as it always
 * was, so cookies issued before producers existed keep working. A producer's
 * carries a third part, "producer", inside the signature, so it cannot be
 * edited into an owner's.
 */
export function issueToken(role: Role = "admin"): string {
  const payload = `${Date.now() + MAX_AGE_SECONDS * 1000}.${randomBytes(8).toString("hex")}${role === "producer" ? ".producer" : ""}`;
  return `${payload}.${sign(payload)}`;
}

/** The role a cookie signs in as, or null for a missing, forged or expired one. */
export function sessionRole(token: string | undefined): Role | null {
  if (!adminConfigured()) return null;
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const provided = Buffer.from(token.slice(lastDot + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  const parts = payload.split(".");
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  if (parts.length === 2) return "admin";
  if (parts.length === 3 && parts[2] === "producer") return "producer";
  return null;
}

/** An owner's session only. Every admin route uses this, so a producer's cookie opens none of them. */
export function verifyToken(token: string | undefined): boolean {
  return sessionRole(token) === "admin";
}

function matches(candidate: string, password: string): boolean {
  if (!password) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Which role a typed password signs in as, or null. The owner's password wins if both are the same. */
export function passwordRole(candidate: unknown): Role | null {
  if (!adminConfigured()) return null;
  if (typeof candidate !== "string") return null;
  if (matches(candidate, ADMIN_PASSWORD)) return "admin";
  if (matches(candidate, PRODUCER_PASSWORD)) return "producer";
  return null;
}

/** The owner's password only. */
export function checkPassword(candidate: unknown): boolean {
  return passwordRole(candidate) === "admin";
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
