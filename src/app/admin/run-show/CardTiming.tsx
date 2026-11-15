"use client";

import { useEffect, useRef, useState } from "react";
import TimingFields from "./TimingFields";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";
import { droppedQuestions, parseTiming, sameTiming, setCardTiming, timingOf, timingShort, type Lineup, type Performer, type SetTiming } from "@/lib/segment";
import { savePhase, type SavePhase } from "@/lib/save-state";

type Props = {
  lineup: Lineup;
  performer: Performer;
  /** This card's set is on stage: its timing is fixed until the set ends. */
  live: boolean;
  /** The timing the set on stage started with, shown while it runs. */
  liveTiming: SetTiming;
  busy: boolean;
  /** Saves this card's own timing; null puts it back on the lineup's. */
  save: (timing: SetTiming | null) => Promise<boolean>;
  /** Hears where this card's timing stands, for the sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

/**
 * One card's own timing, for a performer whose set runs differently from the
 * rest (a longer headline set, a quick spot). Folded into a small "⏱ Timing"
 * toggle on the card. Locked while that card's set is on stage.
 */
export default function CardTiming({ lineup, performer, live, liveTiming, busy, save, onPhase }: Props) {
  // Only what the host has changed; null shows the card's timing as it is.
  const [draft, setDraft] = useState<SetTiming | null>(null);
  const saved = timingOf(lineup, performer);
  const value = live ? liveTiming : draft ?? saved;
  const valid = parseTiming(value) !== null;
  const changed = !sameTiming(value, saved);
  const { memo, fresh, track } = useSaveTracker();

  // Where it stands, told to the page only when it changes. A set on stage can't be changed, so nothing is unsaved then.
  const phase = savePhase(changed && !live, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);
  // A performer taken out of the lineup takes this card with them: nothing of it is left to save.
  useEffect(() => () => report.current?.("saved"), []);

  const submit = async (timing: SetTiming | null) => {
    // The same as the lineup's is the lineup's: a later change there reaches this card too.
    const next = timing && !sameTiming(timing, lineup.timing) ? timing : null;
    const result = setCardTiming(lineup, performer.id, next, Date.now());
    const lost = typeof result === "object" ? droppedQuestions(lineup, result).length : 0;
    const count = (next ?? lineup.timing).questions;
    if (lost && !window.confirm(`Only ${count === 1 ? "1 question" : `${count} questions`} on this card takes ${lost === 1 ? "1 question" : `${lost} questions`} out of it. Any not shown yet go back to the waiting list.`)) return;
    if (await track(() => save(next))) setDraft(null);
  };

  return (
    <details id={`card-timing-${performer.id}`} className="open:basis-full">
      <summary
        className={`cursor-pointer list-none rounded-md border px-2.5 py-1 [&::-webkit-details-marker]:hidden ${performer.timing ? "border-[#ff2e4d]/70 text-[#ff8a9c]" : "border-white/30"}`}
        title={performer.timing ? "This card has its own timing" : "This card follows the lineup's set timing"}
      >
        ⏱ {performer.timing ? timingShort(performer.timing) : "Timing"}
        {/* A small chip on the performer's card: the sign only shows while there is something to say. */}
        <SaveBadge dirty={changed && !live} memo={memo} fresh={fresh} hidden={phase === "saved" && !fresh} />
      </summary>
      <form className="mt-2 rounded-md border border-white/15 p-3" onSubmit={(event) => { event.preventDefault(); if (!live && valid && changed) void submit(value); }}>
        <p className="text-xs text-neutral-400">
          {live
            ? "This set is running on the timing it started with. Change it after the set ends."
            : performer.timing ? "This performer has their own timing." : "Same as the lineup's set timing. Change it here for this performer only."}
        </p>
        <TimingFields id={`timing-${performer.id}`} value={value} onChange={setDraft} disabled={busy || live} />
        {live ? null : (
          <div className="mt-3 flex flex-wrap gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
            <SaveButton type="submit" dirty={changed} memo={memo} fresh={fresh} busy={busy} blocked={!valid} tone="red" />
            {draft ? <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-40">Undo changes</button> : null}
            {performer.timing ? <button type="button" onClick={() => void submit(null)} disabled={busy} className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-40">Use lineup timing</button> : null}
          </div>
        )}
      </form>
    </details>
  );
}
