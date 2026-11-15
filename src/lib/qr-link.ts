import { createHmac, timingSafeEqual } from "node:crypto";
import { DECISIONS_QR_SRC, cleanQrLink } from "./screen-qr.ts";

/**
 * Signed links for the host's own QR codes. The live screen's code route
 * only ever encodes a link that carries a signature made with the admin
 * secret, so it can't be used to put this site's name on anyone else's code,
 * and it never needs to read a record to know what to encode: the address
 * says it all, so the image can be cached for good. Server only (it reads
 * ADMIN_SECRET), but without a "server-only" import, like decision-access.ts,
 * so the tests can load it.
 */

/** Mixed into every signature, and different from decision-access's, so the two can never stand in for each other. */
export const QR_LINK_LABEL = "screen-qr-link-v1";

/**
 * The link's signature: the first 32 hex characters of an HMAC over it. ""
 * without a secret, or for a link that isn't exactly as cleanQrLink keeps it,
 * so only links the host saved are ever signed.
 */
export function qrLinkSig(link: string, secret = process.env.ADMIN_SECRET || ""): string {
  if (!secret || typeof link !== "string" || !link || cleanQrLink(link) !== link) return "";
  return createHmac("sha256", secret).update(`${QR_LINK_LABEL}\n${link}`).digest("hex").slice(0, 32);
}

/** Whether a link and signature from a request belong together. Compared in constant time; anything not a string, the wrong length or unclean is refused. */
export function validQrLinkSig(link: unknown, sig: unknown, secret = process.env.ADMIN_SECRET || ""): link is string {
  if (typeof link !== "string" || typeof sig !== "string" || !/^[a-f0-9]{32}$/.test(sig)) return false;
  const expected = qrLinkSig(link, secret);
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** The live screen's image address for a host's link, or null when it can't be signed (no secret, or a link that isn't clean). */
export function signedQrSrc(link: string, secret = process.env.ADMIN_SECRET || ""): string | null {
  const sig = qrLinkSig(link, secret);
  return sig ? `${DECISIONS_QR_SRC}?to=${encodeURIComponent(link)}&sig=${sig}` : null;
}
