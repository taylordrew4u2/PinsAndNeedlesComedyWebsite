import { parseSelection, type LiveSelection } from "./live-selection.ts";

/**
 * Timed sets. Each performer has a card the host fills in ahead of time: a
 * name and four questions. Pressing Start on a card runs a twelve-minute
 * clock: the performer's name is on the live screen for the first two
 * minutes, then the four questions go up evenly over the last ten, while a
 * small timer counts down. The questions can change at any time; the times
 * they go up never do.
 */
export const SEGMENT_MS = 12 * 60_000;
/** How long the performer's name holds the screen before the first question. */
export const NAME_MS = 2 * 60_000;
export const SEGMENT_SLOTS = 4;
export const SLOT_MS = (SEGMENT_MS - NAME_MS) / SEGMENT_SLOTS;
export const PERFORMER_NAME_MAX = 60;
export const MAX_PERFORMERS = 20;
const PERFORMER_ID = /^[A-Za-z0-9-]{1,40}$/;

/** When slot `i` goes up, measured from Start. */
export function slotStartMs(i: number): number {
  return NAME_MS + i * SLOT_MS;
}

export type Performer = {
  id: string;
  name: string;
  /** Always SEGMENT_SLOTS long; null is an empty slot. */
  slots: (LiveSelection | null)[];
  /** When Start was last pressed on this card; null until then. */
  startedAt: string | null;
  /** When it was stopped by hand, or replaced by another performer's start. */
  stoppedAt: string | null;
};

export type Lineup = { performers: Performer[] };

export type SegmentStatus = {
  running: boolean;
  performerId: string | null;
  /** Which slot is up now; null during the name, or when nothing runs. */
  index: number | null;
  /** Until the whole set ends. */
  remainingMs: number;
  /** Until the screen next changes (first question, next question, or the end). */
  nextSwitchMs: number;
};

const IDLE: SegmentStatus = { running: false, performerId: null, index: null, remainingMs: 0, nextSwitchMs: 0 };

export function emptySlots(): (LiveSelection | null)[] {
  return Array.from({ length: SEGMENT_SLOTS }, () => null);
}

export function cleanPerformerName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, PERFORMER_NAME_MAX).trim();
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function parseSlots(raw: unknown): (LiveSelection | null)[] {
  const slots = emptySlots();
  if (Array.isArray(raw)) for (let i = 0; i < SEGMENT_SLOTS; i += 1) slots[i] = parseSelection(raw[i]);
  return slots;
}

export function parseLineup(raw: unknown): Lineup {
  if (!raw || typeof raw !== "object") return { performers: [] };
  const value = raw as { performers?: unknown; slots?: unknown; startedAt?: unknown };
  // The first version kept one unnamed set: it becomes one card.
  if (!Array.isArray(value.performers)) {
    const slots = parseSlots(value.slots);
    return slots.some(Boolean) ? { performers: [{ id: "set-1", name: "", slots, startedAt: null, stoppedAt: null }] } : { performers: [] };
  }
  const seen = new Set<string>();
  const performers: Performer[] = [];
  for (const entry of value.performers.slice(0, MAX_PERFORMERS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !PERFORMER_ID.test(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    performers.push({
      id: item.id,
      name: cleanPerformerName(item.name),
      slots: parseSlots(item.slots),
      startedAt: isoOrNull(item.startedAt),
      stoppedAt: isoOrNull(item.stoppedAt),
    });
  }
  return { performers };
}

export function performerStatus(performer: Performer, now: number): SegmentStatus {
  const started = performer.startedAt ? Date.parse(performer.startedAt) : NaN;
  const elapsed = now - started;
  if (Number.isNaN(started) || performer.stoppedAt || elapsed < 0 || elapsed >= SEGMENT_MS) return IDLE;
  if (elapsed < NAME_MS) {
    return { running: true, performerId: performer.id, index: null, remainingMs: SEGMENT_MS - elapsed, nextSwitchMs: NAME_MS - elapsed };
  }
  const index = Math.min(SEGMENT_SLOTS - 1, Math.floor((elapsed - NAME_MS) / SLOT_MS));
  const next = index + 1 < SEGMENT_SLOTS ? slotStartMs(index + 1) : SEGMENT_MS;
  return { running: true, performerId: performer.id, index, remainingMs: SEGMENT_MS - elapsed, nextSwitchMs: next - elapsed };
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
 * What a running set puts on the live screen: the performer's name for the
 * first two minutes, then the slot that is up. Undefined when nothing runs.
 */
export function segmentScreen(lineup: Lineup, now: number): { performer: string | null; selection: LiveSelection | null } | undefined {
  const status = segmentStatus(lineup, now);
  if (!status.running) return undefined;
  const performer = lineup.performers.find((entry) => entry.id === status.performerId);
  if (!performer) return undefined;
  if (status.index === null) return { performer: performer.name || null, selection: null };
  return { performer: null, selection: performer.slots[status.index] };
}

/** Every question sitting in a card, so it is not listed or drawn twice. */
export function slottedIds(lineup: Lineup): Set<string> {
  const ids = new Set<string>();
  for (const performer of lineup.performers) for (const slot of performer.slots) if (slot) ids.add(slot.submissionId);
  return ids;
}

export type PerformerInput = { id: string; name: string; slots: (LiveSelection | null)[] };

/**
 * The host's new lineup over the old one. Cards keep their run history.
 * While a set runs, its slots that have been on screen stay as they were and
 * the card cannot be removed; the clock is never touched.
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
    performers.push({
      id: input.id,
      name: cleanPerformerName(input.name),
      slots: emptySlots().map((_, i) => (before && i < locked ? before.slots[i] : input.slots[i] ?? null)),
      startedAt: before?.startedAt ?? null,
      stoppedAt: before?.stoppedAt ?? null,
    });
  }
  // The set on stage cannot be deleted out from under the room.
  for (const performer of lineup.performers) {
    if (!seen.has(performer.id) && performerStatus(performer, now).running) performers.push(performer);
  }
  return { performers };
}

/** Start one card's set; anything else running stops. */
export function startPerformer(lineup: Lineup, id: string, now: number): Lineup | null {
  if (!lineup.performers.some((performer) => performer.id === id)) return null;
  const at = new Date(now).toISOString();
  return {
    performers: lineup.performers.map((performer) => {
      if (performer.id === id) return { ...performer, startedAt: at, stoppedAt: null };
      return performerStatus(performer, now).running ? { ...performer, stoppedAt: at } : performer;
    }),
  };
}

export function stopAll(lineup: Lineup, now: number): Lineup {
  const at = new Date(now).toISOString();
  return { performers: lineup.performers.map((performer) => (performerStatus(performer, now).running ? { ...performer, stoppedAt: at } : performer)) };
}
