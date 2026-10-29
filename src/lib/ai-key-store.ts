import "server-only";
import { readRecord, writeRecord } from "./live-store";
import { sealingSecret } from "./session";
import { openSecret, sealSecret, secretId, type SealedSecret } from "./secret-box";
import { keyHint, type AiKeyStatus } from "./ai-key";
import { pickProvider } from "./ollama.ts";

/** settings/ai-key.json, beside the content: the key sealed, which server secret sealed it, its last four characters, and when it was saved. */
const RECORD = "settings/ai-key.json";

type Stored = { sealed: SealedSecret; kid: string; hint: string; savedAt: string };

/**
 * A couple of seconds' memory, so one AI request (which asks for the key
 * twice) reads it once. Kept short: each server has its own, and a key
 * removed or replaced on one must stop being used on the others too.
 */
const CACHE_MS = 2_000;
let cache: { at: number; value: Stored | null } | null = null;
// Bumped by every save and removal, so a read that started before one never puts the old value back.
let generation = 0;

function parseStored(raw: unknown): Stored | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!value.sealed || typeof value.hint !== "string" || typeof value.savedAt !== "string") return null;
  return { sealed: value.sealed as SealedSecret, kid: typeof value.kid === "string" ? value.kid : "", hint: value.hint, savedAt: value.savedAt };
}

async function readStored(): Promise<Stored | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const before = generation;
  // Created empty on the first read, so on the GitHub store an unchanged record costs a free 304, never a counted 404.
  const value = parseStored(await readRecord(RECORD, { value: null, message: "Start the AI writer key record" }));
  if (generation === before) cache = { at: Date.now(), value };
  return value;
}

/** The key saved in the admin, or null when there is none (or it can't be opened here). */
export async function savedAiKey(): Promise<string | null> {
  const stored = await readStored();
  return stored ? openSecret(stored.sealed, sealingSecret()) : null;
}

export async function saveAiKey(key: string): Promise<void> {
  const secret = sealingSecret();
  const value: Stored = { sealed: sealSecret(key, secret), kid: secretId(secret), hint: keyHint(key), savedAt: new Date().toISOString() };
  generation += 1;
  await writeRecord(RECORD, value, "Save the AI writer key");
  cache = { at: Date.now(), value };
}

export async function clearAiKey(): Promise<void> {
  generation += 1;
  await writeRecord(RECORD, null, "Remove the AI writer key");
  cache = { at: Date.now(), value: null };
}

export async function aiKeyStatus(): Promise<AiKeyStatus> {
  const stored = await readStored();
  const provider = pickProvider(process.env);
  if (stored && openSecret(stored.sealed, sealingSecret()) !== null) {
    return { source: "admin", hint: stored.hint, savedAt: stored.savedAt, unreadable: false, provider };
  }
  const server = (process.env.ANTHROPIC_API_KEY || "").trim();
  return {
    source: server ? "server" : "none",
    hint: server ? keyHint(server) : "",
    savedAt: null,
    unreadable: Boolean(stored),
    provider,
  };
}
