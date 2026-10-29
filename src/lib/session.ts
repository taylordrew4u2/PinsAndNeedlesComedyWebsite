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
 * Signing secret. Never derived from the password any more: knowing one should
 * not hand you the other. Off production it is random per process, so sessions
 * simply do not survive a restart.
 */
const SECRET =
  process.env.ADMIN_SECRET || (IS_PRODUCTION ? "" : randomBytes(32).toString("hex"));

/** The server's own secret, for locking away what the admin saves (see secret-box.ts). "" when there is none. */
export function sealingSecret(): string {
  return SECRET;
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

export function issueToken(): string {
  const payload = `${Date.now() + MAX_AGE_SECONDS * 1000}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!adminConfigured()) return false;
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const provided = Buffer.from(token.slice(lastDot + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length) return false;
  if (!timingSafeEqual(provided, expected)) return false;
  const expiresAt = Number(payload.split(".")[0]);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function checkPassword(candidate: unknown): boolean {
  if (!adminConfigured()) return false;
  if (typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
