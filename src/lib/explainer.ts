/**
 * The "Intro" explainer the host can put on the live screen: how Bad
 * Decisions works, then the sting and intro with an example question, so the
 * room learns what the sound means before the real ones start.
 */

/** Each step and how long it holds the screen, in order. The intro step lasts as long as the real intro. */
export const EXPLAINER_STEPS = [
  { step: "how", ms: 6_000 },
  { step: "listen", ms: 2_000 },
  { step: "intro", ms: 3_200 },
  { step: "example", ms: 5_000 },
  { step: "roast", ms: 5_000 },
] as const;

export type ExplainerStep = (typeof EXPLAINER_STEPS)[number]["step"];

export const EXPLAINER_MS = EXPLAINER_STEPS.reduce((total, { ms }) => total + ms, 0);

/** A screen that opens later than this after the tap does not start the explainer part-way through a set. */
export const EXPLAINER_FRESH_MS = 30_000;

export const EXAMPLE_QUESTION = "Should I get my ex’s name tattooed on my neck?";

/** The stored start time, if it is a real ISO date. Anything else means no explainer. */
export function parseExplainer(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const at = (raw as { at?: unknown }).at;
  return typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : null;
}

/** The start time the live screen should act on: only a recent one, so an old tap never replays. */
export function freshExplainer(at: string | null, now: number): string | null {
  if (!at) return null;
  const age = now - Date.parse(at);
  return age >= 0 && age < EXPLAINER_FRESH_MS ? at : null;
}
