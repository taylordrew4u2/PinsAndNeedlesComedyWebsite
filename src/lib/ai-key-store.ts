import "server-only";
import { readRecord, writeRecord } from "./live-store";
import { sealingSecret } from "./session";
import { openSecret, sealSecret, type SealedSecret } from "./secret-box";
import { keyHint, type AiKeyStatus } from "./ai-key";

/** settings/ai-key.json, beside the content: the key sealed, its last four characters, and when it was saved. */
const RECORD = "settings/ai-key.json";

type Stored = { sealed: SealedSecret; hint: string; savedAt: string };

/** The AI writer asks for the key on every request: a few seconds' memory saves a storage read each time. */
const CACHE_MS = 30_000;
let cache: { at: number; value: Stored | null } | null = null;

function parseStored(raw: unknown): Stored | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!value.sealed || typeof value.hint !== "string" || typeof value.savedAt !== "string") return null;
  return { sealed: value.sealed as SealedSecret, hint: value.hint, savedAt: value.savedAt };
}

async function readStored(): Promise<Stored | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = parseStored(await readRecord(RECORD));
  cache = { at: Date.now(), value };
  return value;
}

/** The key saved in the admin, or null when there is none (or it can't be opened here). */
export async function savedAiKey(): Promise<string | null> {
  const stored = await readStored();
  return stored ? openSecret(stored.sealed, sealingSecret()) : null;
}

export async function saveAiKey(key: string): Promise<void> {
  const value: Stored = { sealed: sealSecret(key, sealingSecret()), hint: keyHint(key), savedAt: new Date().toISOString() };
  await writeRecord(RECORD, value, "Save the AI writer key");
  cache = { at: Date.now(), value };
}

export async function clearAiKey(): Promise<void> {
  await writeRecord(RECORD, null, "Remove the AI writer key");
  cache = { at: Date.now(), value: null };
}

export async function aiKeyStatus(): Promise<AiKeyStatus> {
  const stored = await readStored();
  if (stored) {
    const open = openSecret(stored.sealed, sealingSecret()) !== null;
    if (open) return { source: "admin", hint: stored.hint, savedAt: stored.savedAt, unreadable: false };
  }
  const server = (process.env.ANTHROPIC_API_KEY || "").trim();
  return {
    source: server ? "server" : "none",
    hint: server ? keyHint(server) : "",
    savedAt: null,
    unreadable: Boolean(stored),
  };
}
