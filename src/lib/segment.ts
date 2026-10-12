import { parseSelection, type LiveSelection } from "./live-selection.ts";

/**
 * Timed sets. Each performer has a card the host fills in ahead of time: a
 * name and a few questions. Pressing Start on a card runs its clock: the
 * performer's name is on the live screen first, then the questions go up
 * evenly over the rest, while a small timer counts down. The questions can
 * change at any time; once a set starts, the times they go up never do.
 *
 * The standard set is twelve minutes: the name for two, then four questions
 * at 2:00, 4:30, 7:00 and 9:30. The host can change that for the whole
 * lineup, or give one card its own timing (a headliner's longer set). Start
 * fixes the card's timing for that run, so nothing edited mid-set moves the
 * clock on stage.
 */
export const SEGMENT_MS = 12 * 60_000;
/** How long the performer's name holds the screen before the first question. */
export const NAME_MS = 2 * 60_000;
export const SEGMENT_SLOTS = 4;
export const SLOT_MS = (SEGMENT_MS - NAME_MS) / SEGMENT_SLOTS;
export const PERFORMER_NAME_MAX = 60;
export const MAX_PERFORMERS = 20;
const PERFORMER_ID = /^[A-Za-z0-9-]{1,40}$/;

/** How a set runs: its length, how long the name holds the screen, and how many questions share the rest. */
export type SetTiming = { setMs: number; nameMs: number; questions: number };

/** The standard set, and what every lineup saved before timing could change runs with. */
export const DEFAULT_TIMING: SetTiming = Object.freeze({ setMs: SEGMENT_MS, nameMs: NAME_MS, questions: SEGMENT_SLOTS });
/** Set lengths are whole minutes, from a quick spot to a long headline set. */
export const SET_MINUTES_MIN = 2;
export const SET_MINUTES_MAX = 60;
export const QUESTIONS_MAX = 10;
/** Every question stays up at least this long, so the room can read it and the comic has something to work with. */
export const QUESTION_MIN_MS = 30_000;

/** The longest the name can hold the screen and still leave each question its 30 seconds. */
export function nameMaxMs(setMs: number, questions: number): number {
  return setMs - questions * QUESTION_MIN_MS;
}

/**
 * A timing the host may choose, or null: a whole number of minutes from 2 to
 * 60, the name for whole seconds (0 for none), 1 to 10 questions, and at
 * least 30 seconds for each question.
 */
export function parseTiming(raw: unknown): SetTiming | null {
  if (!raw || typeof raw !== "object") return null;
  const { setMs, nameMs, questions } = raw as Record<string, unknown>;
  if (!Number.isInteger(setMs) || !Number.isInteger(nameMs) || !Number.isInteger(questions)) return null;
  const set = setMs as number;
  const name = nameMs as number;
  const count = questions as number;
  if (set % 60_000 !== 0 || set < SET_MINUTES_MIN * 60_000 || set > SET_MINUTES_MAX * 60_000) return null;
  if (count < 1 || count > QUESTIONS_MAX) return null;
  if (name % 1_000 !== 0 || name < 0 || name > nameMaxMs(set, count)) return null;
  return { setMs: set, nameMs: name, questions: count };
}

export function sameTiming(a: SetTiming, b: SetTiming): boolean {
  return a.setMs === b.setMs && a.nameMs === b.nameMs && a.questions === b.questions;
}

/**
 * When slot `i` goes up, measured from Start: evenly spaced after the name,
 * to the whole second so the times on the cards are the times on stage.
 */
export function slotStartMs(i: number, timing: SetTiming = DEFAULT_TIMING): number {
  return timing.nameMs + Math.round((i * (timing.setMs - timing.nameMs)) / timing.questions / 1_000) * 1_000;
}

/** Which slot is up this far into a set; null while the name is up. */
export function slotAt(timing: SetTiming, elapsed: number): number | null {
  if (elapsed < timing.nameMs) return null;
  let index = 0;
  while (index + 1 < timing.questions && slotStartMs(index + 1, timing) <= elapsed) index += 1;
  return index;
}

/** When the screen next changes after slot `index` (null: the name): the next question, or the end. */
export function switchAfter(timing: SetTiming, index: number | null): number {
  if (index === null) return timing.nameMs;
  return index + 1 < timing.questions ? slotStartMs(index + 1, timing) : timing.setMs;
}

export type Performer = {
  id: string;
  name: string;
  /** One per question in this card's set (its timing's `questions`; the set on stage, as many as it started with); null is an empty slot. */
  slots: (LiveSelection | null)[];
  /** This card's own timing; null follows the lineup's. */
  timing: SetTiming | null;
  /** When Start was last pressed on this card; null until then. */
  startedAt: string | null;
  /** When it was stopped by hand, or replaced by another performer's start. */
  stoppedAt: string | null;
  /** The timing its last set started with, fixed at Start so edits mid-set never move that clock; null until then. */
  ranWith: SetTiming | null;
};

export type Lineup = {
  /** The timing every card follows unless it has its own. */
  timing: SetTiming;
  performers: Performer[];
};

export type SegmentStatus = {
  running: boolean;
  performerId: string | null;
  /** Which slot is up now; null during the name, or when nothing runs. */
  index: number | null;
  /** Until the whole set ends. */
  remainingMs: number;
  /** Until the screen next changes (first question, next question, or the end). */
  nextSwitchMs: number;
  /** The timing the running set started with; absent when nothing runs. */
  timing?: SetTiming;
};

const IDLE: SegmentStatus = { running: false, performerId: null, index: null, remainingMs: 0, nextSwitchMs: 0 };

export function emptySlots(count: number = SEGMENT_SLOTS): (LiveSelection | null)[] {
  return Array.from({ length: count }, () => null);
}

/** A card's slots made to fit `count`: new ones empty, and any past the end dropped (their questions go back to waiting). */
export function fitSlots(slots: (LiveSelection | null)[], count: number): (LiveSelection | null)[] {
  return Array.from({ length: count }, (_, i) => slots[i] ?? null);
}

/** The timing a card shows and starts with: its own, else the lineup's. */
export function timingOf(lineup: Lineup, performer: Performer): SetTiming {
  return performer.timing ?? lineup.timing;
}

/**
 * The timing a card's questions are laid out on: the one it would start with.
 * A set that kept its questions when the lineup's number changed mid-set
 * still holds them, on the timing it ran with, until the card is next saved.
 */
export function slotTimingOf(lineup: Lineup, performer: Performer): SetTiming {
  const timing = timingOf(lineup, performer);
  const ran = performer.ranWith;
  return ran && performer.slots.length !== timing.questions && performer.slots.length === ran.questions ? ran : timing;
}

/** How many questions a card holds now; a card not in the lineup yet gets the lineup's number. */
export function slotCountFor(lineup: Lineup, id: string): number {
  return lineup.performers.find((entry) => entry.id === id)?.slots.length ?? lineup.timing.questions;
}

export function cleanPerformerName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, PERFORMER_NAME_MAX).trim();
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function parseSlots(raw: unknown, count: number): (LiveSelection | null)[] {
  const slots = emptySlots(count);
  if (Array.isArray(raw)) for (let i = 0; i < count; i += 1) slots[i] = parseSelection(raw[i]);
  return slots;
}

/**
 * The stored lineup. Records saved before timing could change have none:
 * they run the standard twelve minutes, exactly as they did.
 */
export function parseLineup(raw: unknown): Lineup {
  if (!raw || typeof raw !== "object") return { timing: DEFAULT_TIMING, performers: [] };
  const value = raw as { performers?: unknown; slots?: unknown; startedAt?: unknown; timing?: unknown };
  const timing = parseTiming(value.timing) ?? DEFAULT_TIMING;
  // The first version kept one unnamed set: it becomes one card.
  if (!Array.isArray(value.performers)) {
    const slots = parseSlots(value.slots, timing.questions);
    return { timing, performers: slots.some(Boolean) ? [{ id: "set-1", name: "", slots, timing: null, startedAt: null, stoppedAt: null, ranWith: null }] : [] };
  }
  const seen = new Set<string>();
  const performers: Performer[] = [];
  for (const entry of value.performers.slice(0, MAX_PERFORMERS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !PERFORMER_ID.test(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    const own = parseTiming(item.timing);
    const startedAt = isoOrNull(item.startedAt);
    // A set started before timing could change ran the standard twelve minutes.
    const ranWith = startedAt ? parseTiming(item.ranWith) ?? DEFAULT_TIMING : null;
    // A card on the lineup's timing that still holds the questions its set
    // started with keeps them: the lineup's number changed while it was on stage.
    const held = !own && ranWith && Array.isArray(item.slots) && item.slots.length === ranWith.questions ? ranWith : own ?? timing;
    performers.push({
      id: item.id,
      name: cleanPerformerName(item.name),
      slots: parseSlots(item.slots, held.questions),
      timing: own,
      startedAt,
      stoppedAt: isoOrNull(item.stoppedAt),
      ranWith,
    });
  }
  return { timing, performers };
}

/** Where a card's set is now, on the timing it started with. */
export function performerStatus(performer: Performer, now: number): SegmentStatus {
  const started = performer.startedAt ? Date.parse(performer.startedAt) : NaN;
  const timing = performer.ranWith ?? DEFAULT_TIMING;
  const elapsed = now - started;
  if (Number.isNaN(started) || performer.stoppedAt || elapsed < 0 || elapsed >= timing.setMs) return IDLE;
  const index = slotAt(timing, elapsed);
  return { running: true, performerId: performer.id, index, remainingMs: timing.setMs - elapsed, nextSwitchMs: switchAfter(timing, index) - elapsed, timing };
}

/** The set running now, if any. */
export function segmentStatus(lineup: Lineup, now: number): SegmentStatus {
  for (const performer of lineup.performers) {
    const status = performerStatus(performer, now);
    if (status.running) return status;
  }
  return IDLE;
}

/**
 * What a running set puts on the live screen: the performer's name until the
 * first question, then the slot that is up. Undefined when nothing runs.
 */
export function segmentScreen(lineup: Lineup, now: number): { performer: string | null; selection: LiveSelection | null } | undefined {
  const status = segmentStatus(lineup, now);
  if (!status.running) return undefined;
  const performer = lineup.performers.find((entry) => entry.id === status.performerId);
  if (!performer) return undefined;
  if (status.index === null) return { performer: performer.name || null, selection: null };
  return { performer: null, selection: performer.slots[status.index] ?? null };
}

/** Every question sitting in a card, so it is not listed or drawn twice. */
export function slottedIds(lineup: Lineup): Set<string> {
  const ids = new Set<string>();
  for (const performer of lineup.performers) for (const slot of performer.slots) if (slot) ids.add(slot.submissionId);
  return ids;
}

/** Questions in a card before a change and in none after it: they go back to the waiting list. */
export function droppedQuestions(before: Lineup, after: Lineup): LiveSelection[] {
  const kept = slottedIds(after);
  const dropped = new Map<string, LiveSelection>();
  for (const performer of before.performers) for (const slot of performer.slots) if (slot && !kept.has(slot.submissionId)) dropped.set(slot.submissionId, slot);
  return [...dropped.values()];
}

export type PerformerInput = { id: string; name: string; slots: (LiveSelection | null)[] };

/**
 * The host's new lineup over the old one. Cards keep their run history and
 * their timing, and hold as many questions as their timing says; the set on
 * stage holds as many as it started with. While a set runs, its slots that
 * have been on screen stay as they were and the card cannot be removed; the
 * clock is never touched.
 */
export function rearrange(lineup: Lineup, next: PerformerInput[], now: number): Lineup {
  const old = new Map(lineup.performers.map((performer) => [performer.id, performer]));
  const performers: Performer[] = [];
  const seen = new Set<string>();
  for (const input of next.slice(0, MAX_PERFORMERS)) {
    if (!PERFORMER_ID.test(input.id) || seen.has(input.id)) continue;
    seen.add(input.id);
    const before = old.get(input.id);
    const status = before ? performerStatus(before, now) : IDLE;
    const locked = status.running && status.index !== null ? status.index : 0;
    const timing = before?.timing ?? null;
    // Once a set is over, its card fits its timing again.
    const count = (status.timing ?? timing ?? lineup.timing).questions;
    performers.push({
      id: input.id,
      name: cleanPerformerName(input.name),
      slots: emptySlots(count).map((_, i) => (before && i < locked ? before.slots[i] ?? null : input.slots[i] ?? null)),
      timing,
      startedAt: before?.startedAt ?? null,
      stoppedAt: before?.stoppedAt ?? null,
      ranWith: before?.ranWith ?? null,
    });
  }
  // The set on stage cannot be deleted out from under the room.
  for (const performer of lineup.performers) {
    if (!seen.has(performer.id) && performerStatus(performer, now).running) performers.push(performer);
  }
  return { ...lineup, performers };
}

/** Start one card's set on its timing as it is now; anything else running stops. */
export function startPerformer(lineup: Lineup, id: string, now: number): Lineup | null {
  if (!lineup.performers.some((performer) => performer.id === id)) return null;
  const at = new Date(now).toISOString();
  return {
    ...lineup,
    performers: lineup.performers.map((performer) => {
      if (performer.id === id) {
        const timing = timingOf(lineup, performer);
        return { ...performer, slots: fitSlots(performer.slots, timing.questions), startedAt: at, stoppedAt: null, ranWith: timing };
      }
      return performerStatus(performer, now).running ? { ...performer, stoppedAt: at } : performer;
    }),
  };
}

export function stopAll(lineup: Lineup, now: number): Lineup {
  const at = new Date(now).toISOString();
  return { ...lineup, performers: lineup.performers.map((performer) => (performerStatus(performer, now).running ? { ...performer, stoppedAt: at } : performer)) };
}

/**
 * A new timing for the lineup. Cards that follow it take its number of
 * questions: added slots are empty, and questions in slots that go come out
 * of the card. The set on stage is never changed: it runs out on the timing
 * it started with and keeps its questions, and it still follows the lineup,
 * so its next set (and the next change here) takes the lineup's timing.
 */
export function setLineupTiming(lineup: Lineup, timing: SetTiming, now: number): Lineup {
  return {
    timing,
    performers: lineup.performers.map((performer) => {
      if (performer.timing || performerStatus(performer, now).running) return performer;
      return { ...performer, slots: fitSlots(performer.slots, timing.questions) };
    }),
  };
}

/**
 * Give one card its own timing, or (null) put it back on the lineup's. Its
 * slots fit the new number of questions. The card on stage is refused: its
 * set keeps running exactly as it started.
 */
export function setCardTiming(lineup: Lineup, id: string, timing: SetTiming | null, now: number): Lineup | "gone" | "running" {
  const performer = lineup.performers.find((entry) => entry.id === id);
  if (!performer) return "gone";
  if (performerStatus(performer, now).running) return "running";
  const count = (timing ?? lineup.timing).questions;
  return {
    ...lineup,
    performers: lineup.performers.map((entry) => (entry.id === id ? { ...entry, timing, slots: fitSlots(entry.slots, count) } : entry)),
  };
}

/** A card timing request: which card, and its own timing or null for the lineup's. Null when it is not one. */
export function parseCardTiming(raw: unknown): { performerId: string; timing: SetTiming | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.performerId !== "string" || !PERFORMER_ID.test(value.performerId)) return null;
  if (value.timing === null) return { performerId: value.performerId, timing: null };
  const timing = parseTiming(value.timing);
  return timing ? { performerId: value.performerId, timing } : null;
}

/** Every card whose set has run, gone; the set on stage and cards still to go stay. */
export function clearFinished(lineup: Lineup, now: number): Lineup {
  return { ...lineup, performers: lineup.performers.filter((performer) => !performer.startedAt || performerStatus(performer, now).running) };
}

/** One card moved a place up (-1) or down (1) in the running order; null when it cannot move. */
export function moveCard<T extends { id: string }>(list: T[], id: string, by: -1 | 1): T[] | null {
  const from = list.findIndex((entry) => entry.id === id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= list.length) return null;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** m:ss, rounded up so a full set reads 12:00. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** "2 minutes", "45 seconds", "1 minute 30 seconds". */
export function durationWords(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const unit = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  if (!minutes) return unit(seconds, "second");
  return seconds ? `${unit(minutes, "minute")} ${unit(seconds, "second")}` : unit(minutes, "minute");
}

/** When each question goes up, as m:ss. */
export function questionTimes(timing: SetTiming): string[] {
  return Array.from({ length: timing.questions }, (_, i) => clockText(slotStartMs(i, timing)));
}

/** The lineup's timing in a sentence; the standard one reads as it always has. */
export function timingSentence(timing: SetTiming): string {
  const times = questionTimes(timing);
  const list = times.length > 1 ? `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}` : times[0];
  return `${durationWords(timing.setMs)} each: ${timing.nameMs ? `their name for ${durationWords(timing.nameMs)}, then ` : ""}a question at ${list}.`;
}

/** The whole run of a set at a glance: "Name 0:00–2:00 · Q1 2:00 · … · End 12:00". */
export function scheduleText(timing: SetTiming): string {
  const name = timing.nameMs ? [`Name 0:00–${clockText(timing.nameMs)}`] : [];
  return [...name, ...questionTimes(timing).map((time, i) => `Q${i + 1} ${time}`), `End ${clockText(timing.setMs)}`].join(" · ");
}

/** A card's timing in a few words: "8 min · name 1:00 · 3 questions". */
export function timingShort(timing: SetTiming): string {
  const questions = `${timing.questions} question${timing.questions === 1 ? "" : "s"}`;
  return `${timing.setMs / 60_000} min · ${timing.nameMs ? `name ${clockText(timing.nameMs)}` : "no name"} · ${questions}`;
}
