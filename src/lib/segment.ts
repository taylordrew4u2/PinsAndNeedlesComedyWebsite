import { parseSelection, type LiveSelection } from "./live-selection.ts";

/**
 * A timed segment: the host presses Start and four questions go up on the
 * live screen on a fixed clock, one every three minutes, while a small timer
 * counts the twelve minutes down. The questions in the slots can change at
 * any time; the times they go up never do.
 */
export const SEGMENT_MS = 12 * 60_000;
export const SEGMENT_SLOTS = 4;
export const SLOT_MS = SEGMENT_MS / SEGMENT_SLOTS;

export type Segment = {
  /** When Start was pressed; null while the host is still lining it up. */
  startedAt: string | null;
  /** Always SEGMENT_SLOTS long; null is an empty slot. */
  slots: (LiveSelection | null)[];
};

export type SegmentStatus = {
  running: boolean;
  /** Which slot is on screen now; null when not running. */
  index: number | null;
  /** Until the whole segment ends. */
  remainingMs: number;
  /** Until the next slot goes up, or the segment ends after the last one. */
  nextSwitchMs: number;
};

export function emptySegment(): Segment {
  return { startedAt: null, slots: Array.from({ length: SEGMENT_SLOTS }, () => null) };
}

export function parseSegment(raw: unknown): Segment {
  const segment = emptySegment();
  if (!raw || typeof raw !== "object") return segment;
  const value = raw as { startedAt?: unknown; slots?: unknown };
  if (typeof value.startedAt === "string" && !Number.isNaN(Date.parse(value.startedAt))) segment.startedAt = value.startedAt;
  if (Array.isArray(value.slots)) {
    for (let i = 0; i < SEGMENT_SLOTS; i += 1) segment.slots[i] = parseSelection(value.slots[i]);
  }
  return segment;
}

export function segmentStatus(segment: Segment, now: number): SegmentStatus {
  const started = segment.startedAt ? Date.parse(segment.startedAt) : NaN;
  const elapsed = now - started;
  if (Number.isNaN(started) || elapsed < 0 || elapsed >= SEGMENT_MS) {
    return { running: false, index: null, remainingMs: 0, nextSwitchMs: 0 };
  }
  const index = Math.floor(elapsed / SLOT_MS);
  return { running: true, index, remainingMs: SEGMENT_MS - elapsed, nextSwitchMs: (index + 1) * SLOT_MS - elapsed };
}

/** What the segment puts on the live screen right now; undefined when it is not running. */
export function segmentSelection(segment: Segment, now: number): LiveSelection | null | undefined {
  const { running, index } = segmentStatus(segment, now);
  return running && index !== null ? segment.slots[index] : undefined;
}

/**
 * The host's new lineup applied over the old one. While running, slots that
 * have already been on screen stay as they were: the past is not editable,
 * and the clock is never touched.
 */
export function rearrange(segment: Segment, next: (LiveSelection | null)[], now: number): Segment {
  const { running, index } = segmentStatus(segment, now);
  const locked = running && index !== null ? index : 0;
  const slots = segment.slots.map((current, i) => (i < locked ? current : next[i] ?? null));
  return { ...segment, slots };
}

/** Ids sitting in a slot that has not been on screen yet, so they are not drawn or listed twice. */
export function upcomingIds(segment: Segment, now: number): Set<string> {
  const { running, index } = segmentStatus(segment, now);
  const from = running && index !== null ? index : segment.startedAt && !running && Date.parse(segment.startedAt) <= now ? SEGMENT_SLOTS : 0;
  const ids = new Set<string>();
  segment.slots.forEach((slot, i) => { if (slot && i >= from) ids.add(slot.submissionId); });
  return ids;
}
