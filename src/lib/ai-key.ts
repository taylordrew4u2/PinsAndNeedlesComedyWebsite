/**
 * The Anthropic API key the host pastes into Site settings, so the AI
 * writer can be set up from the admin rather than the hosting dashboard.
 * The key itself never goes back to a browser: only its last four
 * characters, to tell which one is in use.
 */

/** As the Anthropic Console hands them out: "sk-ant-", then letters, digits, "-" and "_". */
const KEY = /^sk-ant-[A-Za-z0-9_-]{20,300}$/;

/** A pasted key, tidied: the spaces and line breaks a copy can pick up taken out. "" for anything that isn't a key. */
export function cleanApiKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const key = raw.replace(/\s+/g, "");
  return KEY.test(key) ? key : "";
}

/** Enough to tell keys apart, and nothing a key could be rebuilt from. */
export function keyHint(key: string): string {
  return key.length > 12 ? key.slice(-4) : "";
}

/**
 * Which key the AI writer is using: one saved in the admin, the server's
 * own (ANTHROPIC_API_KEY), or none. `unreadable` is a key saved here that
 * this server can no longer open (its signing secret changed).
 */
export type AiKeyStatus = { source: "admin" | "server" | "none"; hint: string; savedAt: string | null; unreadable: boolean };
