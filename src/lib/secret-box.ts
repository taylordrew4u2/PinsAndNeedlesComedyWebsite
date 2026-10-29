import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Keeps a secret the admin saves (an API key) unreadable wherever the
 * content store keeps its files: AES-256-GCM under a key drawn from the
 * server's own signing secret, which never leaves the server. Opened with
 * the wrong secret, or altered by a single byte, it opens to nothing.
 */
export type SealedSecret = { v: 1; iv: string; tag: string; data: string };

/** Keeps this key apart from anything else drawn from the same server secret. */
const SALT = "pnc-secret-box-v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

// scrypt is slow on purpose; the key for a given secret is worked out once.
const keys = new Map<string, Buffer>();
function keyFor(secret: string): Buffer {
  let key = keys.get(secret);
  if (!key) {
    key = scryptSync(secret, SALT, 32);
    keys.set(secret, key);
  }
  return key;
}

export function sealSecret(plain: string, secret: string): SealedSecret {
  if (!secret) throw new Error("There is no server secret to lock it with");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

/** The secret, or null for anything that isn't a box this server sealed and nobody has touched since. */
export function openSecret(raw: unknown, secret: string): string | null {
  if (!secret || !raw || typeof raw !== "object") return null;
  const box = raw as Record<string, unknown>;
  if (box.v !== 1 || typeof box.iv !== "string" || typeof box.tag !== "string" || typeof box.data !== "string") return null;
  const iv = Buffer.from(box.iv, "base64");
  const tag = Buffer.from(box.tag, "base64");
  // A short tag would let a forged box through more easily: only the full one counts.
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(box.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
