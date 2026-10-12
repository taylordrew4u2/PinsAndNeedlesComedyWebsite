"use client";

import { useState } from "react";
import TimingFields from "./TimingFields";
import { DEFAULT_TIMING, droppedQuestions, parseTiming, sameTiming, setLineupTiming, timingShort, type Lineup, type SetTiming } from "@/lib/segment";

type Props = {
  lineup: Lineup;
  /** A set is on stage: it keeps the timing it started with, whatever is saved here. */
  running: boolean;
  busy: boolean;
  /** Saves the lineup's timing; null puts back the standard twelve minutes. */
  save: (timing: SetTiming | null) => Promise<boolean>;
};

/**
 * The lineup's set timing: what every card runs unless it has its own. Safe
 * to change mid-show: the set on stage carries on exactly as it started, and
 * the host is asked first if fewer questions would take some out of the cards.
 */
export default function SetTimingCard({ lineup, running, busy, save }: Props) {
  // Only what the host has changed; null shows the saved timing.
  const [draft, setDraft] = useState<SetTiming | null>(null);
  const value = draft ?? lineup.timing;
  const valid = parseTiming(value) !== null;
  const changed = !sameTiming(value, lineup.timing);
  const own = lineup.performers.filter((performer) => performer.timing).length;

  const submit = async (timing: SetTiming | null) => {
    const next = timing ?? DEFAULT_TIMING;
    const lost = droppedQuestions(lineup, setLineupTiming(lineup, next, Date.now())).length;
    if (lost && !window.confirm(`Only ${next.questions === 1 ? "1 question" : `${next.questions} questions`} per set takes ${lost === 1 ? "1 question" : `${lost} questions`} out of the cards. Any not shown yet go back to the waiting list.`)) return;
    if (await save(timing)) setDraft(null);
  };

  return (
    <details className="mt-3 rounded-md border border-white/20 p-3">
      <summary className="cursor-pointer text-sm">⏱ Set timing</summary>
      <form onSubmit={(event) => { event.preventDefault(); if (valid && changed) void submit(value); }}>
        <p className="mt-2 text-xs text-neutral-400">
          How every set runs, unless a card has its own timing.
          {own ? ` ${own === 1 ? "1 card has its own" : `${own} cards have their own`}.` : ""}
          {running ? " The set on stage keeps the timing it started with." : ""}
        </p>
        <TimingFields id="lineup-timing" value={value} onChange={setDraft} disabled={busy} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !valid || !changed} className="rounded-md bg-[#ff2e4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
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
