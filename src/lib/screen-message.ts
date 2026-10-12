import { cleanColor } from "./drink-menu.ts";

/**
 * A message of the host's own on the projector ("Short break — back in 10",
 * "Last call!"), big and centred over the question or the set until it is
 * taken down. The drink menu and the Intro explainer still go over it, and a
 * question or a set starting takes it down. The words and colour stay saved
 * while it is down, so it can go straight back up.
 */
export type ScreenMessage = { on: boolean; text: string; color: string };

/** Long enough for a plug or a short announcement, short enough to read from the back of the room. */
export const MESSAGE_MAX = 120;
/** A message can break over a few lines; any more and it would read as a paragraph. */
export const MESSAGE_LINES = 4;

/** White, like the questions, until the host picks another colour. */
export const DEFAULT_MESSAGE_COLOR = "#FFFFFF";

/** Quick picks for the message's colour; any other colour works too. */
export const MESSAGE_COLORS = ["#FFFFFF", "#FF2E4D", "#FFC93C", "#3CE0FF", "#7CFF6B", "#FF6BD6"] as const;

/** One tap fills the box with one of these; the host can still change the words before putting it up. */
export const MESSAGE_PRESETS = [
  { label: "Short break", text: "Short break — back in 10" },
  { label: "Last call", text: "Last call!" },
  { label: "Thanks for coming", text: "Thanks for coming!" },
  { label: "Up next", text: "Up next: " },
] as const;

export const NO_MESSAGE: ScreenMessage = { on: false, text: "", color: "" };

/**
 * The words, as up to a few trimmed lines: spaces inside a line squeezed to
 * one, blank lines kept to one between lines and dropped at the ends, and
 * the whole capped. Anything that is not a string is no words.
 */
export function cleanMessageText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const lines: string[] = [];
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n").map((entry) => entry.replace(/\s+/g, " ").trim())) {
    if (!line && !lines.at(-1)) continue;
    lines.push(line);
  }
  return lines.slice(0, MESSAGE_LINES).join("\n").slice(0, MESSAGE_MAX).trim();
}

/** A colour for the message: six-digit hex, with white (the default) kept as "". */
export function cleanMessageColor(raw: unknown): string {
  const color = cleanColor(raw);
  return color === DEFAULT_MESSAGE_COLOR ? "" : color;
}

/** The stored message. Anything malformed reads as no message; a message with no words is never up. */
export function parseMessage(raw: unknown): ScreenMessage {
  if (!raw || typeof raw !== "object") return { ...NO_MESSAGE };
  const value = raw as Record<string, unknown>;
  const text = cleanMessageText(value.text);
  return { on: value.on === true && Boolean(text), text, color: cleanMessageColor(value.color) };
}

export type MessageChange = { on: boolean; text?: string; color?: string };

/**
 * A change the Control Center sent: up or down, and optionally new words or
 * a new colour ("" for white). Null for anything malformed.
 */
export function parseMessageChange(raw: unknown): MessageChange | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.on !== "boolean") return null;
  if (value.text !== undefined && typeof value.text !== "string") return null;
  if (value.color !== undefined && (typeof value.color !== "string" || (value.color.trim() && !cleanColor(value.color)))) return null;
  return {
    on: value.on,
    ...(value.text !== undefined ? { text: cleanMessageText(value.text) } : {}),
    ...(value.color !== undefined ? { color: cleanMessageColor(value.color) } : {}),
  };
}

/** The saved message with a change applied. Asking to put up a message with no words leaves it down. */
export function applyMessage(current: ScreenMessage, change: MessageChange): ScreenMessage {
  return parseMessage({ ...current, ...change });
}

/** What the live screen shows: the words and their colour, or null when no message is up. */
export function publicMessage(message: ScreenMessage): { text: string; color: string } | null {
  return message.on && message.text ? { text: message.text, color: message.color || DEFAULT_MESSAGE_COLOR } : null;
}

/** The live screen's reading of the public answer: anything odd or missing (an older server, say) is no message. */
export function readPublicMessage(raw: unknown): { text: string; color: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const text = cleanMessageText(value.text);
  return text ? { text, color: cleanColor(value.color) || DEFAULT_MESSAGE_COLOR } : null;
}
