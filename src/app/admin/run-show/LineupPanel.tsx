"use client";

import { useState } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";
import {
  DEFAULT_TIMING, PERFORMER_NAME_MAX, clockText, moveCard, slotAt, slotStartMs, slotTimingOf, slottedIds, switchAfter, timingSentence, timingShort,
  type Lineup, type SegmentStatus, type SetTiming,
} from "@/lib/segment";
import SetTimingCard from "./SetTimingCard";
import CardTiming from "./CardTiming";
import QuestionEditor from "./QuestionEditor";
import type { QuestionChange } from "@/lib/questions";

/** What is being dragged: a waiting question, or a question already in a card. */
export type Drag = { from: "pile"; id: string } | { from: "slot"; performer: string; slot: number };

/** The lineup as the API takes it: ids only for the questions. */
export type LineupInput = { id: string; name: string; slots: (string | null)[] }[];

/** The running set's clock, run forward on this page between polls, on the timing that set started with. */
export type Clock = { running: boolean; performerId: string | null; left: number; index: number | null; timing: SetTiming };

export function clockFor(segment: SegmentStatus, segmentAt: number, now: number): Clock {
  if (!segment.running) return { running: false, performerId: null, left: 0, index: null, timing: DEFAULT_TIMING };
  const timing = segment.timing ?? DEFAULT_TIMING;
  const left = Math.max(0, segment.remainingMs - (now - segmentAt));
  return { running: true, performerId: segment.performerId, left, index: slotAt(timing, timing.setMs - left), timing };
}

/** Slots before this one have been and gone on the running set; every slot is open on any other card. */
export function firstOpen(clock: Clock, performerId: string): number {
  return clock.running && clock.performerId === performerId ? clock.index ?? 0 : 0;
}

export function toInput(lineup: Lineup): LineupInput {
  return lineup.performers.map((performer) => ({ id: performer.id, name: performer.name, slots: performer.slots.map((slot) => slot?.submissionId ?? null) }));
}

/** Whether a card's set has run (and is not running now). */
function done(lineup: Lineup, id: string, clock: Clock): boolean {
  const performer = lineup.performers.find((entry) => entry.id === id);
  return Boolean(performer?.startedAt) && !(clock.running && clock.performerId === id);
}

/**
 * Where "+ Set" puts a question: the first open, empty slot on the set
 * running now, else on the first card that has not run yet.
 */
export function firstEmptySlot(lineup: Lineup, clock: Clock): { performer: string; slot: number } | null {
  const order = [
    ...lineup.performers.filter((performer) => clock.running && performer.id === clock.performerId),
    ...lineup.performers.filter((performer) => !performer.startedAt),
  ];
  for (const performer of order) {
    const slot = performer.slots.findIndex((entry, i) => i >= firstOpen(clock, performer.id) && !entry);
    if (slot !== -1) return { performer: performer.id, slot };
  }
  return null;
}

/** Apply a drop to the lineup; null when it changes nothing. */
export function applyDrop(lineup: Lineup, to: { performer: string; slot: number }, drag: Drag, clock: Clock): LineupInput | null {
  if (to.slot < firstOpen(clock, to.performer)) return null;
  const input = toInput(lineup);
  const target = input.find((entry) => entry.id === to.performer);
  if (!target) return null;
  if (drag.from === "slot") {
    if (drag.performer === to.performer && drag.slot === to.slot) return null;
    if (drag.slot < firstOpen(clock, drag.performer)) return null;
    const source = input.find((entry) => entry.id === drag.performer);
    if (!source) return null;
    [target.slots[to.slot], source.slots[drag.slot]] = [source.slots[drag.slot], target.slots[to.slot]];
  } else {
    // Already in a card (a second "+ Set" before the list caught up, or a drag begun just before): one slot each.
    if (input.some((entry) => entry.slots.includes(drag.id))) return null;
    target.slots[to.slot] = drag.id;
  }
  return input;
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** m:ss, rounded up so a full set reads 12:00. */
export function clock(ms: number): string {
  return clockText(ms);
}

type Props = {
  lineup: Lineup;
  clock: Clock;
  waiting: Submission[];
  busy: boolean;
  dragging: Drag | null;
  setDragging: (drag: Drag | null) => void;
  /** True once the server has it; `quiet` leaves every button live while it saves. */
  save: (input: LineupInput, optimistic: Lineup, options?: { quiet?: boolean }) => Promise<boolean>;
  start: (performerId: string) => Promise<void>;
  stop: () => Promise<void>;
  /** A timing or tidying change the server makes to the whole lineup: posts `body`, then says `done`. */
  edit: (body: object, done: string, failed: string) => Promise<boolean>;
  /** Fix a question's words or name while it waits in a card (the same edit as in the lists). */
  editQuestion: (id: string, change: QuestionChange) => Promise<boolean>;
};

/**
 * One card per performer: their name (on screen at the start of their set)
 * and their questions, filled in ahead of time or during the show. Every set
 * runs the lineup's timing unless its card has its own.
 */
export default function LineupPanel({ lineup, clock: time, waiting, busy, dragging, setDragging, save, start, stop, edit, editQuestion }: Props) {
  const [dropOn, setDropOn] = useState<string | null>(null);
  // The question whose editor is open, by id, so it follows the question if the slots move under it.
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  // What the host is typing in each name box, until it is saved.
  const [names, setNames] = useState<Record<string, string>>({});
  // A question taken out of every card (here or on another device) closes its editor for good, rather than
  // opening it again by itself the next time it goes into a card.
  if (editingSlot && !slottedIds(lineup).has(editingSlot)) setEditingSlot(null);

  /** Save, showing the change at once. Slots carry their question text so the card does not blink. True once saved. */
  const commit = (input: LineupInput, dropped?: Submission, options?: { quiet?: boolean }) => {
    const known = new Map<string, LiveSelection>();
    for (const performer of lineup.performers) for (const slot of performer.slots) if (slot) known.set(slot.submissionId, slot);
    if (dropped) known.set(dropped.id, { submissionId: dropped.id, question: dropped.decision, name: dropped.name.trim() });
    const old = new Map(lineup.performers.map((performer) => [performer.id, performer]));
    const optimistic: Lineup = {
      ...lineup,
      performers: input.map((entry) => ({
        id: entry.id,
        name: entry.name,
        slots: entry.slots.map((id) => (id ? known.get(id) ?? null : null)),
        timing: old.get(entry.id)?.timing ?? null,
        startedAt: old.get(entry.id)?.startedAt ?? null,
        stoppedAt: old.get(entry.id)?.stoppedAt ?? null,
        ranWith: old.get(entry.id)?.ranWith ?? null,
      })),
    };
    return save(input, optimistic, options);
  };

  const drop = (performer: string, slot: number) => {
    if (!dragging) return;
    const input = applyDrop(lineup, { performer, slot }, dragging, time);
    if (input) void commit(input, dragging.from === "pile" ? waiting.find((item) => item.id === dragging.id) : undefined);
  };

  /**
   * A name saves as its box loses focus, quietly: the click that took the focus away (say, Start) still
   * lands, and goes out after the name. The typing stays in the box until the server has it, so a failed
   * save keeps it there, and leaving the box again tries once more.
   */
  const saveName = async (id: string) => {
    const draft = names[id];
    if (draft === undefined) return;
    const forget = () => setNames((current) => {
      // Anything typed since the save went out stays in the box.
      if (current[id] !== draft) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    const input = toInput(lineup);
    const entry = input.find((item) => item.id === id);
    if (!entry || entry.name === draft.trim()) { forget(); return; }
    entry.name = draft.trim();
    if (await commit(input, undefined, { quiet: true })) forget();
  };

  const addPerformer = () => void commit([...toInput(lineup), { id: newId(), name: "", slots: Array.from({ length: lineup.timing.questions }, () => null) }]);

  const removePerformer = (id: string) => {
    const performer = lineup.performers.find((entry) => entry.id === id);
    if (!performer) return;
    if (performer.slots.some(Boolean) && !window.confirm(`Remove ${performer.name || "this performer"}? Their questions go back to the waiting list.`)) return;
    void commit(toInput(lineup).filter((entry) => entry.id !== id));
  };

  /** Running order: one place up or down. */
  const moveBy = (id: string, by: -1 | 1) => {
    const input = moveCard(toInput(lineup), id, by);
    if (input) void commit(input);
  };

  const editSlots = (id: string, change: (slots: (string | null)[], open: number) => (string | null)[]) => {
    const input = toInput(lineup);
    const entry = input.find((item) => item.id === id);
    if (!entry) return;
    entry.slots = change(entry.slots, firstOpen(time, id));
    void commit(input);
  };

  const fill = (id: string) => {
    const used = new Set(toInput(lineup).flatMap((entry) => entry.slots));
    const pool = waiting.filter((item) => !used.has(item.id)).sort(() => Math.random() - 0.5);
    editSlots(id, (slots, open) => slots.map((slot, i) => (i < open || slot || !pool.length ? slot : (pool.pop() as Submission).id)));
  };

  const saveLineupTiming = (timing: SetTiming | null) => edit(
    { lineupTiming: timing },
    `${timing ? `Set timing saved: ${timingShort(timing)}.` : `Set timing back to the standard: ${timingShort(DEFAULT_TIMING)}.`}${time.running ? " The set on stage keeps the timing it started with." : ""}`,
    "Could not save the set timing.",
  );

  const saveCardTiming = (id: string, timing: SetTiming | null) => {
    const who = lineup.performers.find((entry) => entry.id === id)?.name || "This card";
    return edit(
      { cardTiming: { performerId: id, timing } },
      timing ? `${who} now runs ${timingShort(timing)}.` : `${who} follows the lineup's set timing again.`,
      "Could not save the set timing.",
    );
  };

  // Cards whose set has run: cleared together once the host is done with them.
  const finished = lineup.performers.filter((performer) => done(lineup, performer.id, time));
  const clearFinished = () => {
    if (!finished.length) return;
    const who = finished.map((performer) => performer.name || "no name").join(", ");
    if (!window.confirm(`Clear ${finished.length === 1 ? "the card" : `the ${finished.length} cards`} whose set has run (${who})? Questions in them that were never shown go back to the waiting list.`)) return;
    void edit({ clearFinished: true }, "Finished cards cleared.", "Could not clear the finished cards.");
  };
  const someOwnTiming = lineup.performers.some((performer) => performer.timing);

  return (
    <div className="mb-6 rounded-lg border border-[#ff2e4d]/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base">⏱ Sets</h2>
          <p className="text-sm text-neutral-400">
            {time.running
              ? <>Running · <span className="font-semibold tabular-nums text-white">{clock(time.left)}</span> left{nextChange(time)}</>
              : `${timingSentence(lineup.timing)}${someOwnTiming ? " Some cards have their own timing." : ""} Drag questions in any time.`}
          </p>
        </div>
        {time.running ? <button type="button" onClick={() => void stop()} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Stop</button> : null}
      </div>
      <SetTimingCard lineup={lineup} running={time.running} busy={busy} save={saveLineupTiming} />

      <div className="mt-3 space-y-4">
        {lineup.performers.map((performer, number) => {
          const live = time.running && time.performerId === performer.id;
          const open = firstOpen(time, performer.id);
          const ran = done(lineup, performer.id, time);
          // The set on stage runs on the timing it started with; any other card shows the timing its questions are laid out on.
          const timing = live ? time.timing : slotTimingOf(lineup, performer);
          return (
            <div key={performer.id} className={`rounded-md border p-3 ${live ? "border-white bg-white/5" : ran ? "border-white/10 opacity-60" : "border-white/20"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500">{number + 1}.</span>
                <input
                  type="text"
                  aria-label={`Performer ${number + 1} name`}
                  value={names[performer.id] ?? performer.name}
                  onChange={(event) => setNames((current) => ({ ...current, [performer.id]: event.target.value }))}
                  onBlur={() => void saveName(performer.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }}
                  maxLength={PERFORMER_NAME_MAX}
                  placeholder="Performer's name"
                  className="min-w-0 flex-1 basis-40 rounded-md border border-white/30 bg-black px-3 py-1.5 text-sm font-semibold text-white placeholder:font-normal placeholder:text-neutral-500"
                />
                {live
                  ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">On stage</span>
                  : <button type="button" onClick={() => void start(performer.id)} disabled={busy} className="rounded-md bg-[#ff2e4d] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{ran ? "▶ Again" : "▶ Start"}</button>}
                <span className="flex shrink-0">
                  <button type="button" aria-label={`Move performer ${number + 1} up`} onClick={() => moveBy(performer.id, -1)} disabled={busy || number === 0} className="px-1 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move performer ${number + 1} down`} onClick={() => moveBy(performer.id, 1)} disabled={busy || number === lineup.performers.length - 1} className="px-1 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↓</button>
                </span>
                {live ? null : <button type="button" aria-label={`Remove performer ${number + 1}`} onClick={() => removePerformer(performer.id)} disabled={busy} className="px-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">✕</button>}
              </div>
              {timing.nameMs ? (
                <p className={`mt-2 text-xs ${live && time.index === null ? "font-semibold text-white" : "text-neutral-500"}`}>
                  0:00 · name on screen{live && time.index === null ? " now" : ""}
                </p>
              ) : null}
              <ol className="mt-2 space-y-1.5">
                {performer.slots.map((slot, i) => {
                  const key = `${performer.id}:${i}`;
                  const past = i < open;
                  const up = live && time.index === i;
                  // Keyed by its question, so an open editor (and its typing) moves with the question when the slots
                  // move under it. A repeat from an older save falls back to the slot's place, so keys stay unique.
                  const first = slot ? performer.slots.findIndex((entry) => entry?.submissionId === slot.submissionId) === i : false;
                  return (
                    <li
                      key={slot && first ? `q-${slot.submissionId}` : `slot-${i}`}
                      onDragOver={(event) => { if (dragging && !past) { event.preventDefault(); setDropOn(key); } }}
                      onDragLeave={() => setDropOn((current) => (current === key ? null : current))}
                      onDrop={(event) => { event.preventDefault(); setDropOn(null); drop(performer.id, i); setDragging(null); }}
                      className={`flex items-start gap-3 rounded-md border px-3 py-2 ${up ? "border-white bg-white/10" : past ? "border-white/10 opacity-50" : dropOn === key ? "border-[#ff2e4d] bg-[#ff2e4d]/10" : "border-white/15"}`}
                    >
                      {/* Narrower on a phone, with the buttons two by two, so the question gets room to read in whole lines. */}
                      <span className="w-14 shrink-0 text-xs leading-5 text-neutral-400 sm:w-[4.5rem]">
                        <span className="block font-semibold text-white">{clock(slotStartMs(i, timing))}</span>
                        {up ? "on screen" : past ? "done" : live ? `in ${clock(time.left - (timing.setMs - slotStartMs(i, timing)))}` : null}
                      </span>
                      {slot && slot.submissionId === editingSlot ? (
                        <div className="min-w-0 flex-1">
                          <QuestionEditor question={slotQuestion(slot)} live={up} busy={busy} save={(change) => editQuestion(slot.submissionId, change)} close={() => setEditingSlot(null)} />
                        </div>
                      ) : slot ? (
                        <span
                          draggable={!past && !busy}
                          onDragStart={(event) => { event.dataTransfer.setData("text/plain", slot.question); setDragging({ from: "slot", performer: performer.id, slot: i }); }}
                          onDragEnd={() => { setDragging(null); setDropOn(null); }}
                          className={`min-w-0 flex-1 ${past ? "" : "cursor-grab"}`}
                        >
                          <span className="block whitespace-pre-wrap break-words text-sm">{slot.question}</span>
                          <span className="block text-xs text-neutral-500">{slot.name || "Anonymous"}</span>
                        </span>
                      ) : <span className="flex-1 text-sm text-neutral-500">{past ? "Nothing went up" : "Drop a question here"}</span>}
                      {!past ? (
                        <span className="grid shrink-0 grid-cols-2 gap-1 sm:flex">
                          <button type="button" aria-label="Move up" onClick={() => editSlots(performer.id, (slots) => swap(slots, i, i - 1))} disabled={busy || i <= open} className="rounded px-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↑</button>
                          <button type="button" aria-label="Move down" onClick={() => editSlots(performer.id, (slots) => swap(slots, i, i + 1))} disabled={busy || i >= performer.slots.length - 1} className="rounded px-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">↓</button>
                          {slot && slot.submissionId !== editingSlot ? <button type="button" aria-label="Edit question" title="Fix the words or the name" onClick={() => setEditingSlot(slot.submissionId)} disabled={busy} className="rounded px-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">✎</button> : null}
                          {slot ? <button type="button" aria-label="Empty slot" onClick={() => editSlots(performer.id, (slots) => slots.map((entry, j) => (j === i ? null : entry)))} disabled={busy} className="rounded px-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-30">✕</button> : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button type="button" onClick={() => fill(performer.id)} disabled={busy || !waiting.length || !performer.slots.some((slot, i) => i >= open && !slot)} className="rounded-md border border-white/30 px-2.5 py-1 disabled:opacity-40">🎲 Fill empty</button>
                <button type="button" onClick={() => editSlots(performer.id, (slots, from) => slots.map((slot, i) => (i < from ? slot : null)))} disabled={busy || !performer.slots.some((slot, i) => i >= open && slot)} className="rounded-md px-2.5 py-1 text-neutral-400 underline disabled:opacity-40">Empty all</button>
                <CardTiming lineup={lineup} performer={performer} live={live} liveTiming={time.timing} busy={busy} save={(next) => saveCardTiming(performer.id, next)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={addPerformer} disabled={busy} className="rounded-md border border-dashed border-white/40 px-4 py-2 text-sm disabled:opacity-50">+ Add performer</button>
        {finished.length ? <button type="button" onClick={clearFinished} disabled={busy} className="rounded-md border border-white/20 px-4 py-2 text-sm text-neutral-300 disabled:opacity-50">🧹 Clear finished cards ({finished.length})</button> : null}
      </div>
      {time.running ? <p className="mt-2 text-xs text-neutral-500">While a set runs it owns the live screen; Show, Draw and Clear wait until it ends or you stop it.</p> : null}
    </div>
  );
}

function swap(slots: (string | null)[], a: number, b: number): (string | null)[] {
  if (b < 0 || b >= slots.length) return slots;
  const next = [...slots];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function nextChange(time: Clock) {
  // After the last question the next change is the end, which the time left already shows.
  if (time.index !== null && time.index + 1 >= time.timing.questions) return null;
  const next = switchAfter(time.timing, time.index);
  const elapsed = time.timing.setMs - time.left;
  return <> · {time.index === null ? "first question" : "next"} in <span className="tabular-nums">{clock(next - elapsed)}</span></>;
}

/**
 * A card's copy of a question, as the editor takes it. The copy has no
 * record of what the sender first wrote, so "Revert to original" is offered
 * once the question is back in a list.
 */
function slotQuestion(slot: LiveSelection): Submission {
  return { id: slot.submissionId, decision: slot.question, name: slot.name, createdAt: "", status: "open", drawnAt: "" };
}
