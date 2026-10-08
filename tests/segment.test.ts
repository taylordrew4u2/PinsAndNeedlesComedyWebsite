import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAME_MS, SEGMENT_MS, SEGMENT_SLOTS, SLOT_MS, parseLineup, rearrange, segmentScreen, segmentStatus, slotStartMs, slottedIds, startPerformer, stopAll,
  type Lineup, type Performer,
} from "../src/lib/segment.ts";

const q = (id: string) => ({ submissionId: id, question: `Question ${id}`, name: "" });
const start = Date.parse("2026-10-08T20:00:00Z");
const card = (id: string, name: string, slots: (string | null)[], startedAt: number | null = null): Performer => ({
  id, name, slots: slots.map((slot) => (slot ? q(slot) : null)), startedAt: startedAt === null ? null : new Date(startedAt).toISOString(), stoppedAt: null,
});
const lineup = (): Lineup => ({ performers: [card("sam", "Sam Drew", ["a", "b", null, "d"], start), card("jo", "Jo", ["e", null, null, null])] });

test("timing: name for two minutes, then four even questions over the last ten", () => {
  assert.equal(SEGMENT_MS, 12 * 60_000);
  assert.equal(NAME_MS, 2 * 60_000);
  assert.equal(SEGMENT_SLOTS, 4);
  assert.equal(SLOT_MS, 150_000);
  assert.deepEqual([0, 1, 2, 3].map(slotStartMs), [120_000, 270_000, 420_000, 570_000]);
});

test("segmentScreen: the name first, no question until 2:00, then each slot on its mark", () => {
  const value = lineup();
  assert.deepEqual(segmentScreen(value, start), { performer: "Sam Drew", selection: null });
  assert.deepEqual(segmentScreen(value, start + NAME_MS - 1), { performer: "Sam Drew", selection: null });
  assert.equal(segmentScreen(value, start + NAME_MS)?.selection?.submissionId, "a");
  assert.equal(segmentScreen(value, start + slotStartMs(1))?.selection?.submissionId, "b");
  assert.equal(segmentScreen(value, start + slotStartMs(2))?.selection, null);
  assert.equal(segmentScreen(value, start + SEGMENT_MS - 1)?.selection?.submissionId, "d");
  assert.equal(segmentScreen(value, start + SEGMENT_MS), undefined);
});

test("segmentStatus: clock and next switch", () => {
  const value = lineup();
  assert.deepEqual(segmentStatus(value, start + 1_000), { running: true, performerId: "sam", index: null, remainingMs: SEGMENT_MS - 1_000, nextSwitchMs: NAME_MS - 1_000 });
  const later = segmentStatus(value, start + slotStartMs(3) + 5_000);
  assert.equal(later.index, 3);
  assert.equal(later.nextSwitchMs, SEGMENT_MS - slotStartMs(3) - 5_000);
  assert.equal(segmentStatus({ performers: [] }, start).running, false);
});

test("startPerformer stops whoever is on; stopAll stops everything", () => {
  const value = lineup();
  const next = startPerformer(value, "jo", start + 60_000);
  assert.ok(next);
  assert.equal(segmentStatus(next, start + 61_000).performerId, "jo");
  assert.equal(next.performers[0].stoppedAt, new Date(start + 60_000).toISOString());
  assert.equal(startPerformer(value, "nobody", start), null);
  assert.equal(segmentStatus(stopAll(value, start + 1), start + 2).running, false);
});

test("rearrange: past slots lock on the running set, history kept, the set on stage cannot be removed", () => {
  const value = lineup();
  const now = start + slotStartMs(1) + 10;
  const next = rearrange(value, [{ id: "jo", name: " Jo  Smith ", slots: [null, q("a"), null, null] }, { id: "new-1", name: "", slots: [q("x"), null, null, null] }], now);
  assert.deepEqual(next.performers.map((performer) => performer.id), ["jo", "new-1", "sam"]);
  assert.equal(next.performers[0].name, "Jo Smith");
  // Sam's set is running and was left out: kept whole.
  assert.deepEqual(next.performers[2].slots.map((slot) => slot?.submissionId ?? null), ["a", "b", null, "d"]);
  const moved = rearrange(value, [{ id: "sam", name: "Sam", slots: [q("z"), q("d"), q("b"), null] }], now);
  assert.deepEqual(moved.performers[0].slots.map((slot) => slot?.submissionId ?? null), ["a", "d", "b", null]);
  assert.equal(moved.performers[0].startedAt, value.performers[0].startedAt);
});

test("slottedIds: every question in any card", () => {
  assert.deepEqual([...slottedIds(lineup())].sort(), ["a", "b", "d", "e"]);
});

test("parseLineup: junk dropped, four slots each, the old single set becomes one card", () => {
  assert.deepEqual(parseLineup(null), { performers: [] });
  const parsed = parseLineup({ performers: [{ id: "ok", name: "A\nB", slots: [q("a")] }, { id: "bad id!" }, { id: "ok" }] });
  assert.equal(parsed.performers.length, 1);
  assert.equal(parsed.performers[0].name, "A B");
  assert.equal(parsed.performers[0].slots.length, SEGMENT_SLOTS);
  const legacy = parseLineup({ startedAt: new Date(start).toISOString(), slots: [q("a"), null, null, null] });
  assert.equal(legacy.performers.length, 1);
  assert.equal(legacy.performers[0].slots[0]?.submissionId, "a");
  assert.equal(legacy.performers[0].startedAt, null);
});
