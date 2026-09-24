import type { SubmissionWindow } from "./decisions";

/**
 * A dress rehearsal: the host opens the real QR form for a short while before
 * the show, sends a test from their own phone, puts it on the projector, and
 * then deletes every test in one go.
 *
 * Tests are tagged as they are saved, so finishing a rehearsal removes only
 * what was sent during it — never an audience member's decision. A rehearsal
 * also never overlaps the real window: it ends at the real opening at the
 * latest, and cannot start while the real window is open.
 */
export type Rehearsal = { startedAt: string; endsAt: string };

/** How long one rehearsal keeps the form open. */
export const REHEARSAL_MINUTES = 30;

/** Shorter than this before the real opening is not worth starting. */
const MIN_REHEARSAL_MS = 60_000;

export function parseRehearsal(raw: unknown): Rehearsal | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Rehearsal>;
  if (typeof value.startedAt !== "string" || typeof value.endsAt !== "string") return null;
  const started = Date.parse(value.startedAt);
  const ends = Date.parse(value.endsAt);
  if (!Number.isFinite(started) || !Number.isFinite(ends) || ends <= started) return null;
  return { startedAt: value.startedAt, endsAt: value.endsAt };
}

/** Whether a rehearsal is holding the form open right now. */
export function rehearsalActive(
  rehearsal: Rehearsal | null,
  gate: SubmissionWindow,
  now: Date = new Date()
): boolean {
  if (!rehearsal || gate.open) return false;
  const at = now.getTime();
  return at >= Date.parse(rehearsal.startedAt) && at < Date.parse(rehearsal.endsAt);
}

/**
 * The real window, opened by a rehearsal when one is running.
 *
 * While rehearsing, the window reports the rehearsal's own start and end, so
 * the form re-checks with the server when it ends and the room count covers
 * only the rehearsal. The real window always wins: when it is open this hands
 * it back unchanged, and nothing sent is tagged as a test.
 */
export function withRehearsal(
  gate: SubmissionWindow,
  rehearsal: Rehearsal | null,
  now: Date = new Date()
): SubmissionWindow & { rehearsal: boolean } {
  if (!rehearsalActive(rehearsal, gate, now) || !rehearsal) return { ...gate, rehearsal: false };
  return { ...gate, open: true, opensAt: rehearsal.startedAt, closesAt: rehearsal.endsAt, rehearsal: true };
}

/**
 * A new rehearsal starting now, or why one cannot: it runs for
 * REHEARSAL_MINUTES, cut short so it ends when the real window opens.
 */
export function planRehearsal(
  gate: SubmissionWindow,
  now: Date = new Date()
): { ok: true; rehearsal: Rehearsal } | { ok: false; error: string } {
  if (gate.open) {
    return { ok: false, error: "The real submission window is open, so there is nothing to rehearse — the form is already live." };
  }
  const start = now.getTime();
  let end = start + REHEARSAL_MINUTES * 60_000;
  const opens = Date.parse(gate.opensAt);
  if (Number.isFinite(opens) && opens > start) end = Math.min(end, opens);
  if (end - start < MIN_REHEARSAL_MS) {
    return { ok: false, error: "The real window opens in under a minute. No time to rehearse." };
  }
  return { ok: true, rehearsal: { startedAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() } };
}
