import { test } from "node:test";
import assert from "node:assert/strict";
import { SEGMENT_MS, SEGMENT_SLOTS, SLOT_MS, emptySegment, parseSegment, rearrange, segmentSelection, segmentStatus, upcomingIds } from "../src/lib/segment.ts";

const q = (id: string) => ({ submissionId: id, question: `Question ${id}`, name: "" });
const start = Date.parse("2026-10-08T20:00:00Z");
const lined = () => ({ startedAt: new Date(start).toISOString(), slots: [q("a"), q("b"), null, q("d")] });

test("segment: twelve minutes, four even slots", () => {
  assert.equal(SEGMENT_SLOTS, 4);
  assert.equal(SLOT_MS, 3 * 60_000);
  assert.equal(SEGMENT_MS, 12 * 60_000);
});

test("segmentStatus: slots switch on a fixed clock", () => {
  const segment = lined();
  assert.deepEqual(segmentStatus(segment, start), { running: true, index: 0, remainingMs: SEGMENT_MS, nextSwitchMs: SLOT_MS });
  assert.equal(segmentStatus(segment, start + SLOT_MS - 1).index, 0);
  assert.equal(segmentStatus(segment, start + SLOT_MS).index, 1);
  assert.equal(segmentStatus(segment, start + 3 * SLOT_MS + 5_000).index, 3);
  assert.equal(segmentStatus(segment, start + SEGMENT_MS).running, false);
  assert.equal(segmentStatus(segment, start - 1).running, false);
  assert.equal(segmentStatus(emptySegment(), start).running, false);
});

test("segmentSelection: the slot up now, empty slots clear the screen, undefined when not running", () => {
  const segment = lined();
  assert.equal(segmentSelection(segment, start + 1)?.submissionId, "a");
  assert.equal(segmentSelection(segment, start + SLOT_MS)?.submissionId, "b");
  assert.equal(segmentSelection(segment, start + 2 * SLOT_MS), null);
  assert.equal(segmentSelection(segment, start + SEGMENT_MS), undefined);
});

test("rearrange: past slots are locked while running, the clock never moves", () => {
  const segment = lined();
  const next = rearrange(segment, [q("x"), q("d"), q("b"), null], start + SLOT_MS + 10);
  assert.equal(next.startedAt, segment.startedAt);
  assert.deepEqual(next.slots.map((slot) => slot?.submissionId ?? null), ["a", "d", "b", null]);
  // Before starting, every slot is open.
  const planning = rearrange({ ...segment, startedAt: null }, [q("x"), null, null, null], start);
  assert.deepEqual(planning.slots.map((slot) => slot?.submissionId ?? null), ["x", null, null, null]);
});

test("upcomingIds: questions still to go up, from the one on screen on", () => {
  const segment = lined();
  assert.deepEqual([...upcomingIds({ ...segment, startedAt: null }, start)].sort(), ["a", "b", "d"]);
  assert.deepEqual([...upcomingIds(segment, start + SLOT_MS)].sort(), ["b", "d"]);
  assert.deepEqual([...upcomingIds(segment, start + SEGMENT_MS)], []);
});

test("parseSegment: always four slots, junk dropped", () => {
  assert.deepEqual(parseSegment(null), emptySegment());
  const parsed = parseSegment({ startedAt: "nope", slots: [q("a"), { bad: true }] });
  assert.equal(parsed.startedAt, null);
  assert.equal(parsed.slots.length, SEGMENT_SLOTS);
  assert.equal(parsed.slots[0]?.submissionId, "a");
  assert.equal(parsed.slots[1], null);
});
