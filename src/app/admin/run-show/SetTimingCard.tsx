"use client";

import { useEffect, useRef, useState } from "react";
import TimingFields from "./TimingFields";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";
import { DEFAULT_TIMING, droppedQuestions, parseTiming, sameTiming, setLineupTiming, timingShort, type Lineup, type SetTiming } from "@/lib/segment";
import { savePhase, type SavePhase } from "@/lib/save-state";

type Props = {
  lineup: Lineup;
  /** A set is on stage: it keeps the timing it started with, whatever is saved here. */
  running: boolean;
  busy: boolean;
  /** Saves the lineup's timing; null puts back the standard twelve minutes. */
  save: (timing: SetTiming | null) => Promise<boolean>;
  /** Hears where the card's saving stands, for the sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

/**
 * The lineup's set timing: what every card runs unless it has its own. Safe
 * to change mid-show: the set on stage carries on exactly as it started, and
 * the host is asked first if fewer questions would take some out of the cards.
 */
export default function SetTimingCard({ lineup, running, busy, save, onPhase }: Props) {
  // Only what the host has changed; null shows the saved timing.
  const [draft, setDraft] = useState<SetTiming | null>(null);
  const value = draft ?? lineup.timing;
  const valid = parseTiming(value) !== null;
  const changed = !sameTiming(value, lineup.timing);
  const own = lineup.performers.filter((performer) => performer.timing).length;
  const { memo, fresh, track } = useSaveTracker();

  // Where the card stands, told to the page only when it changes.
  const phase = savePhase(changed, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async (timing: SetTiming | null) => {
    const next = timing ?? DEFAULT_TIMING;
    const lost = droppedQuestions(lineup, setLineupTiming(lineup, next, Date.now())).length;
    if (lost && !window.confirm(`Only ${next.questions === 1 ? "1 question" : `${next.questions} questions`} per set takes ${lost === 1 ? "1 question" : `${lost} questions`} out of the cards. Any not shown yet go back to the waiting list.`)) return;
    if (await track(() => save(timing))) setDraft(null);
  };

  return (
    <details id="set-timing-card" className="mt-3 rounded-md border border-white/20 p-3">
      <summary className="cursor-pointer text-sm">
        ⏱ Set timing
        <SaveBadge dirty={changed} memo={memo} fresh={fresh} />
      </summary>
      <form onSubmit={(event) => { event.preventDefault(); if (valid && changed) void submit(value); }}>
        <p className="mt-2 text-xs text-neutral-400">
          How every set runs, unless a card has its own timing.
          {own ? ` ${own === 1 ? "1 card has its own" : `${own} cards have their own`}.` : ""}
          {running ? " The set on stage keeps the timing it started with." : ""}
        </p>
        <TimingFields id="lineup-timing" value={value} onChange={setDraft} disabled={busy} />
        {/* 44px tall on a phone, their own size from a tablet up. */}
        <div className="mt-3 flex flex-wrap gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={changed} memo={memo} fresh={fresh} busy={busy} blocked={!valid} tone="red" />
          {draft ? <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
          <button
            type="button"
            onClick={() => void submit(null)}
            disabled={busy || (sameTiming(lineup.timing, DEFAULT_TIMING) && !draft)}
            title={`The standard set: ${timingShort(DEFAULT_TIMING)}`}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
        </div>
      </form>
    </details>
  );
}
