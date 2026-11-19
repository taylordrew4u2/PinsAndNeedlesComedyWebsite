"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { JUST_SAVED_MS, NO_SAVES, pageSave, saveEnded, savePhase, saveStarted, saveWords, type SaveMemo, type SavePhase, type SaveWordSet } from "@/lib/save-state";
import { openCard } from "./open-card";

/**
 * Keeps a card's save history for its badge and Save button: wrap the
 * card's save in `track`. `fresh` is true for JUST_SAVED_MS after a save
 * lands, so the badge can say "Saved just now".
 */
export function useSaveTracker(): { memo: SaveMemo; fresh: boolean; track: (save: () => Promise<boolean>) => Promise<boolean> } {
  const [memo, setMemo] = useState<SaveMemo>(NO_SAVES);
  const [fresh, setFresh] = useState(false);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(freshTimer.current), []);

  const track = useCallback(async (save: () => Promise<boolean>) => {
    setMemo(saveStarted);
    let ok = false;
    try {
      ok = await save();
    } catch {
      ok = false;
    }
    const now = Date.now();
    setMemo((current) => saveEnded(current, ok, now));
    if (ok) {
      setFresh(true);
      clearTimeout(freshTimer.current);
      freshTimer.current = setTimeout(() => setFresh(false), JUST_SAVED_MS);
    }
    return ok;
  }, []);

  return { memo, fresh, track };
}

const BADGE_TONE = {
  saved: "border-emerald-400/60 text-emerald-300",
  unsaved: "border-amber-300/60 bg-amber-300/15 text-amber-200",
  saving: "border-white/25 text-neutral-300",
  failed: "border-red-500/70 bg-red-500/15 text-red-200",
} as const;

/**
 * Whether a card's changes are saved, in a few words: for its summary, so it
 * shows even while the card is folded. Read out politely as it changes.
 * `hidden` leaves it off (the message card, while nothing is up or typed).
 */
export function SaveBadge({ dirty, memo, fresh, words, hidden }: { dirty: boolean; memo: SaveMemo; fresh: boolean; words?: Partial<SaveWordSet>; hidden?: boolean }): ReactElement | null {
  if (hidden) return null;
  const phase = savePhase(dirty, memo);
  const { badge } = saveWords(phase, fresh, words);
  const justNow = phase === "saved" && fresh;
  // Settled and saved: the sign at the top already says so, so the card stays quiet.
  // The status region stays in place (screen readers keep hearing changes).
  if (phase === "saved" && !fresh) return <span role="status" aria-live="polite" className="sr-only">{badge}</span>;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${justNow ? "pnc-saved-pop border-emerald-400 bg-emerald-400 text-black" : BADGE_TONE[phase]}`}
    >
      {phase === "saving" ? <span aria-hidden="true" className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" /> : null}
      {badge}
    </span>
  );
}

const BUTTON_TONE = {
  amber: "bg-amber-300 text-black",
  red: "bg-[#ff2e4d] text-white",
  sky: "bg-sky-300 text-black",
} as const;

/**
 * A card's Save button, saying where things stand: Save (in the card's
 * colour) while there are changes, Saving… while one is on its way, Saved ✓
 * (greyed out) when there is nothing to save, and Try again after a save
 * didn't land. `label` changes the word for Save; `blocked` greys it out
 * while something stops the save (the card says what).
 */
export function SaveButton({ dirty, memo, fresh, busy, blocked, tone = "amber", type = "button", onClick, label, words }: {
  dirty: boolean;
  memo: SaveMemo;
  fresh: boolean;
  busy: boolean;
  blocked?: boolean;
  tone?: "amber" | "red" | "sky";
  type?: "submit" | "button";
  onClick?: () => void;
  label?: string;
  words?: Partial<SaveWordSet>;
}): ReactElement {
  const phase = savePhase(dirty, memo);
  const { button } = saveWords(phase, fresh, words);
  const text = phase === "unsaved" && label ? label : button;
  const style = phase === "failed" ? "border border-red-500 text-red-200"
    : phase === "saved" ? "border border-emerald-400/60 text-emerald-300"
      : phase === "saving" ? "border border-white/25 text-neutral-300"
        : BUTTON_TONE[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || blocked || phase === "saving" || phase === "saved"}
      // 44px tall on a phone, where it is tapped with a thumb mid-show; its own size from a tablet up.
      className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:min-h-0 ${style}`}
    >
      {text}
    </button>
  );
}

const PILL_TONE = {
  saved: "border-emerald-400/60 text-emerald-300",
  unsaved: "border-amber-300/70 bg-amber-300/15 text-amber-200",
  saving: "border-white/25 text-neutral-300",
  failed: "border-red-500 bg-red-500/20 text-red-100",
} as const;

/**
 * The sign at the top of the Control Center: every card's saving summed up,
 * so the host can see at a glance, from anywhere on the page, that nothing
 * is waiting. `cards` is each card's id and phase, in page order. While a
 * card couldn't save, or has changes not saved yet, the sign is a button
 * that opens that card. Read out politely as it changes.
 */
export function SavePill({ cards }: { cards: readonly (readonly [string, SavePhase])[] }): ReactElement {
  const { phase, words, card } = pageSave(cards);
  const style = `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:min-h-0 ${PILL_TONE[phase]}`;
  const mark = phase === "saving"
    ? <span aria-hidden="true" className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
    : <span aria-hidden="true">{phase === "saved" ? "✓" : phase === "failed" ? "✕" : "●"}</span>;
  return (
    <div role="status" aria-live="polite">
      {card ? (
        <button type="button" onClick={() => openCard(card)} className={style}>
          {mark}{words}
          <span className="sr-only">{phase === "failed" ? ". Opens the card that didn't save." : ". Opens the first card with changes."}</span>
        </button>
      ) : (
        <span className={style}>{mark}{words}</span>
      )}
    </div>
  );
}
