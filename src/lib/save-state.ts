/**
 * The one way every Control Center card says whether its changes are saved:
 * a badge in the card's summary and the words on its Save button. Pure, so
 * the rules are tested; SaveBadge.tsx draws them.
 */

/**
 * Saving: a save is on its way. Failed: the last try didn't land and the
 * changes are still there. Unsaved: changes nobody has tried to save yet.
 * Saved: what is on screen is what the card shows.
 */
export type SavePhase = "saved" | "unsaved" | "saving" | "failed";

/** What a card remembers about its saves: how many are on their way, when the last one landed, and whether the last one failed. */
export type SaveMemo = { saving: number; savedAt: number | null; failed: boolean };

export const NO_SAVES: SaveMemo = { saving: 0, savedAt: null, failed: false };

/** How long a badge says "Saved just now" after a save lands. */
export const JUST_SAVED_MS = 4_000;

/** A save sent. Trying again clears the last failure. */
export function saveStarted(memo: SaveMemo): SaveMemo {
  return { ...memo, saving: memo.saving + 1, failed: false };
}

/** A save answered: one fewer on its way, and when it landed, or that it didn't. */
export function saveEnded(memo: SaveMemo, ok: boolean, now: number): SaveMemo {
  const saving = Math.max(0, memo.saving - 1);
  return ok ? { saving, savedAt: now, failed: false } : { ...memo, saving, failed: true };
}

/**
 * Where a card stands. Saving while any save is on its way; failed only
 * while the changes that didn't save are still there (undone, there is
 * nothing left unsaved); otherwise unsaved or saved by whether it has changes.
 */
export function savePhase(dirty: boolean, memo: SaveMemo): SavePhase {
  if (memo.saving > 0) return "saving";
  if (memo.failed && dirty) return "failed";
  return dirty ? "unsaved" : "saved";
}

/** A save landed within the last JUST_SAVED_MS. A clock that went backwards doesn't count. */
export function justSaved(memo: SaveMemo, now: number): boolean {
  if (memo.savedAt === null) return false;
  const age = now - memo.savedAt;
  return age >= 0 && age < JUST_SAVED_MS;
}

/** The badge's words for each phase; a card can change any of them (the message card says "On screen"). */
export type SaveWordSet = { saved: string; fresh: string; unsaved: string; saving: string; failed: string };

export const SAVE_WORDS: SaveWordSet = {
  saved: "✓ Saved",
  fresh: "✓ Saved just now",
  unsaved: "● Not saved yet",
  saving: "Saving…",
  failed: "✕ Didn't save",
};

/** The badge and the Save button for a phase. `fresh` is justSaved, so the badge can say a save just landed. */
export function saveWords(phase: SavePhase, fresh: boolean, words?: Partial<SaveWordSet>): { badge: string; button: string } {
  const set = { ...SAVE_WORDS, ...words };
  if (phase === "saving") return { badge: set.saving, button: "Saving…" };
  if (phase === "failed") return { badge: set.failed, button: "Try again" };
  if (phase === "unsaved") return { badge: set.unsaved, button: "Save" };
  return { badge: fresh ? set.fresh : set.saved, button: "Saved ✓" };
}
