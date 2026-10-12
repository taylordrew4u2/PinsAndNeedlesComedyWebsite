import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIMING, NAME_MS, QUESTIONS_MAX, QUESTION_MIN_MS, SEGMENT_MS, SEGMENT_SLOTS, SET_MINUTES_MAX, SET_MINUTES_MIN, SLOT_MS,
  clearFinished, clockText, droppedQuestions, durationWords, moveCard, nameMaxMs, parseCardTiming, parseLineup, parseTiming, rearrange,
  scheduleText, segmentScreen, segmentStatus, setCardTiming, setLineupTiming, slotAt, slotCountFor, slotStartMs, slotTimingOf, slottedIds, startPerformer,
  stopAll, switchAfter, timingOf, timingSentence, timingShort,
  type Lineup, type Performer, type SetTiming,
} from "../src/lib/segment.ts";

const q = (id: string) => ({ submissionId: id, question: `Question ${id}`, name: "" });
const start = Date.parse("2026-10-08T20:00:00Z");
const at = (ms: number) => new Date(ms).toISOString();
const ids = (performer: Performer) => performer.slots.map((slot) => slot?.submissionId ?? null);
const card = (id: string, name: string, slots: (string | null)[], startedAt: number | null = null, timing: SetTiming | null = null, ranWith: SetTiming = DEFAULT_TIMING): Performer => ({
  id, name, slots: slots.map((slot) => (slot ? q(slot) : null)), timing,
  startedAt: startedAt === null ? null : at(startedAt), stoppedAt: null, ranWith: startedAt === null ? null : ranWith,
});
const lineup = (): Lineup => ({ timing: DEFAULT_TIMING, performers: [card("sam", "Sam Drew", ["a", "b", null, "d"], start), card("jo", "Jo", ["e", null, null, null])] });
const timing = (minutes: number, nameSeconds: number, questions: number): SetTiming => ({ setMs: minutes * 60_000, nameMs: nameSeconds * 1_000, questions });

test("timing: name for two minutes, then four even questions over the last ten", () => {
  assert.equal(SEGMENT_MS, 12 * 60_000);
  assert.equal(NAME_MS, 2 * 60_000);
  assert.equal(SEGMENT_SLOTS, 4);
  assert.equal(SLOT_MS, 150_000);
  assert.deepEqual(DEFAULT_TIMING, { setMs: SEGMENT_MS, nameMs: NAME_MS, questions: SEGMENT_SLOTS });
  assert.deepEqual([0, 1, 2, 3].map((i) => slotStartMs(i)), [120_000, 270_000, 420_000, 570_000]);
  assert.deepEqual([0, 1, 2, 3].map((i) => slotStartMs(i, DEFAULT_TIMING)), [120_000, 270_000, 420_000, 570_000]);
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
  assert.deepEqual(segmentStatus(value, start + 1_000), { running: true, performerId: "sam", index: null, remainingMs: SEGMENT_MS - 1_000, nextSwitchMs: NAME_MS - 1_000, timing: DEFAULT_TIMING });
  const later = segmentStatus(value, start + slotStartMs(3) + 5_000);
  assert.equal(later.index, 3);
  assert.equal(later.nextSwitchMs, SEGMENT_MS - slotStartMs(3) - 5_000);
  assert.deepEqual(segmentStatus({ timing: DEFAULT_TIMING, performers: [] }, start), { running: false, performerId: null, index: null, remainingMs: 0, nextSwitchMs: 0 });
});

test("the standard timing runs exactly as the fixed twelve minutes did, every second of the set", () => {
  const value = lineup();
  for (let elapsed = -1_000; elapsed <= SEGMENT_MS + 1_000; elapsed += 500) {
    const status = segmentStatus(value, start + elapsed);
    if (elapsed < 0 || elapsed >= SEGMENT_MS) { assert.equal(status.running, false); continue; }
    // The arithmetic the fixed version used.
    const index = elapsed < NAME_MS ? null : Math.min(SEGMENT_SLOTS - 1, Math.floor((elapsed - NAME_MS) / SLOT_MS));
    const next = index === null ? NAME_MS : index + 1 < SEGMENT_SLOTS ? NAME_MS + (index + 1) * SLOT_MS : SEGMENT_MS;
    assert.equal(status.index, index, `index at ${elapsed}`);
    assert.equal(status.remainingMs, SEGMENT_MS - elapsed);
    assert.equal(status.nextSwitchMs, next - elapsed, `next switch at ${elapsed}`);
  }
});

test("startPerformer stops whoever is on; stopAll stops everything", () => {
  const value = lineup();
  const next = startPerformer(value, "jo", start + 60_000);
  assert.ok(next);
  assert.equal(segmentStatus(next, start + 61_000).performerId, "jo");
  assert.equal(next.performers[0].stoppedAt, at(start + 60_000));
  assert.equal(startPerformer(value, "nobody", start), null);
  assert.equal(segmentStatus(stopAll(value, start + 1), start + 2).running, false);
  assert.deepEqual(stopAll(value, start + 1).timing, DEFAULT_TIMING);
});

test("startPerformer fixes the card's timing as it is now: its own, else the lineup's", () => {
  const short = timing(8, 60, 3);
  const value: Lineup = { timing: short, performers: [card("a", "A", [null, null, null]), card("b", "B", [null, null], null, timing(5, 0, 2))] };
  const first = startPerformer(value, "a", start);
  assert.ok(first);
  assert.deepEqual(first.performers[0].ranWith, short);
  assert.equal(first.performers[0].timing, null);
  assert.equal(segmentStatus(first, start).remainingMs, 8 * 60_000);
  const second = startPerformer(first, "b", start + 1_000);
  assert.ok(second);
  assert.deepEqual(second.performers[1].ranWith, timing(5, 0, 2));
  assert.equal(segmentStatus(second, start + 1_000).index, 0);
  // "Again" after the lineup changed takes the new timing.
  const again = startPerformer(setLineupTiming(second, DEFAULT_TIMING, start + 10 * 60_000), "a", start + 10 * 60_000);
  assert.ok(again);
  assert.deepEqual(again.performers[0].ranWith, DEFAULT_TIMING);
  assert.equal(again.performers[0].slots.length, 4);
});

test("rearrange: past slots lock on the running set, history kept, the set on stage cannot be removed", () => {
  const value = lineup();
  const now = start + slotStartMs(1) + 10;
  const next = rearrange(value, [{ id: "jo", name: " Jo  Smith ", slots: [null, q("a"), null, null] }, { id: "new-1", name: "", slots: [q("x"), null, null, null] }], now);
  assert.deepEqual(next.performers.map((performer) => performer.id), ["jo", "new-1", "sam"]);
  assert.equal(next.performers[0].name, "Jo Smith");
  // Sam's set is running and was left out: kept whole.
  assert.deepEqual(ids(next.performers[2]), ["a", "b", null, "d"]);
  const moved = rearrange(value, [{ id: "sam", name: "Sam", slots: [q("z"), q("d"), q("b"), null] }], now);
  assert.deepEqual(ids(moved.performers[0]), ["a", "d", "b", null]);
  assert.equal(moved.performers[0].startedAt, value.performers[0].startedAt);
  assert.deepEqual(moved.performers[0].ranWith, DEFAULT_TIMING);
  assert.deepEqual(moved.timing, DEFAULT_TIMING);
});

test("rearrange: each card holds as many questions as its timing says; timing and history carry over", () => {
  const value: Lineup = { timing: timing(10, 60, 3), performers: [card("own", "Own", [null, null, null, null, null], null, timing(15, 60, 5)), card("std", "Std", [null, null, null])] };
  const next = rearrange(value, [
    { id: "own", name: "Own", slots: [q("a"), null] },
    { id: "std", name: "Std", slots: [q("b"), q("c"), q("d"), q("e")] },
    { id: "new", name: "", slots: [q("f")] },
  ], start);
  assert.deepEqual(next.performers.map((performer) => performer.slots.length), [5, 3, 3]);
  assert.deepEqual(ids(next.performers[0]), ["a", null, null, null, null]);
  assert.deepEqual(ids(next.performers[1]), ["b", "c", "d"]);
  assert.deepEqual(next.performers[0].timing, timing(15, 60, 5));
  assert.equal(next.performers[2].timing, null);
  assert.equal(next.performers[2].ranWith, null);
});

test("rearrange: the running set on its own timing locks the slots that have been up", () => {
  const own = timing(6, 0, 3);
  const value: Lineup = { timing: DEFAULT_TIMING, performers: [card("x", "X", ["a", "b", "c"], start, own, own)] };
  // 2:00 into a six-minute set with no name and three questions: the second is up.
  const now = start + 2 * 60_000 + 5;
  assert.equal(segmentStatus(value, now).index, 1);
  const next = rearrange(value, [{ id: "x", name: "X", slots: [q("z"), q("y"), q("w")] }], now);
  assert.deepEqual(ids(next.performers[0]), ["a", "y", "w"]);
});

test("slottedIds: every question in any card", () => {
  assert.deepEqual([...slottedIds(lineup())].sort(), ["a", "b", "d", "e"]);
});

test("parseLineup: junk dropped, four slots each, the old single set becomes one card", () => {
  assert.deepEqual(parseLineup(null), { timing: DEFAULT_TIMING, performers: [] });
  const parsed = parseLineup({ performers: [{ id: "ok", name: "A\nB", slots: [q("a")] }, { id: "bad id!" }, { id: "ok" }] });
  assert.equal(parsed.performers.length, 1);
  assert.equal(parsed.performers[0].name, "A B");
  assert.equal(parsed.performers[0].slots.length, SEGMENT_SLOTS);
  const legacy = parseLineup({ startedAt: at(start), slots: [q("a"), null, null, null] });
  assert.equal(legacy.performers.length, 1);
  assert.equal(legacy.performers[0].slots[0]?.submissionId, "a");
  assert.equal(legacy.performers[0].startedAt, null);
  assert.deepEqual(legacy.timing, DEFAULT_TIMING);
});

test("parseLineup: a lineup saved before timing could change runs exactly the standard twelve minutes", () => {
  // As stored by the fixed version: no lineup timing, no card timing, no snapshot.
  const stored = JSON.parse(JSON.stringify({ performers: [
    { id: "sam", name: "Sam", slots: [q("a"), q("b"), null, q("d")], startedAt: at(start), stoppedAt: null },
    { id: "jo", name: "Jo", slots: [q("e"), null, null, null], startedAt: null, stoppedAt: null },
  ] }));
  const parsed = parseLineup(stored);
  assert.deepEqual(parsed.timing, DEFAULT_TIMING);
  assert.equal(parsed.performers[0].timing, null);
  assert.deepEqual(parsed.performers[0].ranWith, DEFAULT_TIMING);
  assert.equal(parsed.performers[1].ranWith, null);
  assert.deepEqual(parsed.performers.map((performer) => performer.slots.length), [4, 4]);
  assert.deepEqual(segmentStatus(parsed, start + 1_000), segmentStatus(lineup(), start + 1_000));
  assert.equal(segmentScreen(parsed, start + slotStartMs(3))?.selection?.submissionId, "d");
  assert.equal(segmentStatus(parsed, start + SEGMENT_MS).running, false);
  // Saved again and read back, it is the same lineup.
  assert.deepEqual(parseLineup(JSON.parse(JSON.stringify(parsed))), parsed);
});

test("parseLineup: timing round-trips; bad timing falls back without losing the card", () => {
  const own = timing(20, 90, 6);
  const parsed = parseLineup({
    timing: timing(8, 30, 3),
    performers: [
      { id: "a", name: "A", slots: [q("a"), q("b"), q("c"), q("d")], timing: null, startedAt: null },
      { id: "b", name: "B", slots: [q("e")], timing: own, startedAt: at(start), ranWith: own },
      { id: "c", name: "C", slots: [], timing: { setMs: 1, nameMs: 0, questions: 4 }, startedAt: at(start), ranWith: "junk" },
    ],
  });
  assert.deepEqual(parsed.timing, timing(8, 30, 3));
  // Slots fit each card's timing: the lineup's three, its own six.
  assert.deepEqual(ids(parsed.performers[0]), ["a", "b", "c"]);
  assert.deepEqual(ids(parsed.performers[1]), ["e", null, null, null, null, null]);
  assert.deepEqual(parsed.performers[1].ranWith, own);
  // A broken card timing follows the lineup; a broken snapshot is the standard set.
  assert.equal(parsed.performers[2].timing, null);
  assert.equal(parsed.performers[2].slots.length, 3);
  assert.deepEqual(parsed.performers[2].ranWith, DEFAULT_TIMING);
  assert.deepEqual(parseLineup({ timing: "twelve", performers: [] }).timing, DEFAULT_TIMING);
});

test("parseLineup: only a card holding exactly the questions its set started with keeps that many", () => {
  const parsed = parseLineup({
    timing: timing(8, 60, 3),
    performers: [
      // On the lineup's timing, holding the four it started with: kept.
      { id: "on", name: "On", slots: [q("a"), q("b"), q("c"), q("d")], timing: null, startedAt: at(start), ranWith: DEFAULT_TIMING },
      // Holding some other number: fits the lineup.
      { id: "odd", name: "Odd", slots: [q("e"), null, null, null, null], timing: null, startedAt: at(start), ranWith: DEFAULT_TIMING },
      // Never started: fits the lineup whatever it holds.
      { id: "new", name: "New", slots: [q("f"), null, null, null], timing: null, startedAt: null },
      // Its own timing decides, whatever its last set ran with.
      { id: "own", name: "Own", slots: [q("g"), null, null, null], timing: timing(5, 0, 2), startedAt: at(start), ranWith: DEFAULT_TIMING },
    ],
  });
  assert.deepEqual(parsed.performers.map((performer) => performer.slots.length), [4, 3, 3, 2]);
  assert.deepEqual(ids(parsed.performers[0]), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(parsed.performers[1]), ["e", null, null]);
});

test("parseLineup: a lineup from an older server reads in full, so the Control Center can draw it", () => {
  // As an older build answers: no timing anywhere.
  const parsed = parseLineup({ performers: [{ id: "sam", name: "Sam", slots: [q("a"), null, null, null], startedAt: at(start), stoppedAt: null }] });
  assert.deepEqual(parsed.timing, DEFAULT_TIMING);
  assert.equal(parsed.performers[0].timing, null);
  assert.deepEqual(timingOf(parsed, parsed.performers[0]), DEFAULT_TIMING);
  assert.deepEqual(slotTimingOf(parsed, parsed.performers[0]), DEFAULT_TIMING);
  assert.equal(timingSentence(parsed.timing), "12 minutes each: their name for 2 minutes, then a question at 2:00, 4:30, 7:00 and 9:30.");
  assert.deepEqual(parseLineup(undefined), { timing: DEFAULT_TIMING, performers: [] });
});

test("parseTiming: whole minutes 2 to 60, the name in whole seconds, 1 to 10 questions, 30 seconds each", () => {
  assert.deepEqual(parseTiming(DEFAULT_TIMING), DEFAULT_TIMING);
  assert.deepEqual(parseTiming({ ...timing(7, 45, 2), extra: true }), timing(7, 45, 2));
  assert.deepEqual(parseTiming(timing(SET_MINUTES_MIN, 0, 4)), timing(2, 0, 4));
  assert.deepEqual(parseTiming(timing(SET_MINUTES_MAX, 0, QUESTIONS_MAX)), timing(60, 0, 10));
  assert.deepEqual(parseTiming(timing(12, 0, 1)), timing(12, 0, 1));
  // Exactly 30 seconds a question is allowed; one second less is not.
  assert.deepEqual(parseTiming(timing(12, 600, 4)), timing(12, 600, 4));
  assert.equal(parseTiming(timing(12, 601, 4)), null);
  assert.equal(nameMaxMs(12 * 60_000, 4), 600_000);
  for (const bad of [
    null, undefined, "12", 12, [], {},
    timing(1, 0, 1), timing(61, 0, 4), timing(12, 120, 0), timing(12, 120, 11), timing(12, -1, 4),
    timing(2, 1, 4), timing(2, 0, 5),
    { setMs: 12.5 * 60_000, nameMs: 0, questions: 4 },
    { setMs: SEGMENT_MS, nameMs: 120_500, questions: 4 },
    { setMs: SEGMENT_MS, nameMs: NAME_MS, questions: 4.5 },
    { setMs: String(SEGMENT_MS), nameMs: NAME_MS, questions: 4 },
    { setMs: SEGMENT_MS, nameMs: NAME_MS },
    { setMs: Infinity, nameMs: 0, questions: 1 },
    { setMs: NaN, nameMs: 0, questions: 1 },
  ]) assert.equal(parseTiming(bad), null, JSON.stringify(bad));
});

test("every valid timing: questions go up in order, on whole seconds, each up for 30 seconds or more", () => {
  for (let minutes = SET_MINUTES_MIN; minutes <= SET_MINUTES_MAX; minutes += 1) {
    for (let questions = 1; questions <= QUESTIONS_MAX; questions += 1) {
      for (let name = 0; name <= nameMaxMs(minutes * 60_000, questions); name += 15_000) {
        const value = parseTiming({ setMs: minutes * 60_000, nameMs: name, questions });
        assert.ok(value, `${minutes}/${name}/${questions}`);
        const starts = Array.from({ length: questions }, (_, i) => slotStartMs(i, value));
        assert.equal(starts[0], name);
        const ends = [...starts.slice(1), value.setMs];
        starts.forEach((begin, i) => {
          assert.equal(begin % 1_000, 0);
          assert.ok(ends[i] - begin >= QUESTION_MIN_MS, `${minutes}/${name}/${questions} slot ${i}`);
          assert.equal(slotAt(value, begin), i);
          assert.equal(slotAt(value, ends[i] - 1), i);
          assert.equal(switchAfter(value, i), ends[i]);
        });
        if (name) assert.equal(slotAt(value, name - 1), null);
        assert.equal(switchAfter(value, null), name);
      }
    }
  }
});

test("no name: the first question is up the moment the set starts", () => {
  const value: Lineup = { timing: timing(6, 0, 3), performers: [card("x", "X", ["a", "b", "c"], start, null, timing(6, 0, 3))] };
  assert.deepEqual(segmentScreen(value, start), { performer: null, selection: q("a") });
  assert.deepEqual(segmentStatus(value, start), { running: true, performerId: "x", index: 0, remainingMs: 6 * 60_000, nextSwitchMs: 2 * 60_000, timing: timing(6, 0, 3) });
  assert.equal(segmentScreen(value, start + 2 * 60_000)?.selection?.submissionId, "b");
  assert.equal(segmentScreen(value, start + 6 * 60_000 - 1)?.selection?.submissionId, "c");
  assert.equal(segmentScreen(value, start + 6 * 60_000), undefined);
});

test("one question: it stays up from the end of the name to the end of the set", () => {
  const one = timing(5, 60, 1);
  const value: Lineup = { timing: one, performers: [card("x", "X", ["a"], start, null, one)] };
  assert.deepEqual(segmentScreen(value, start + 59_999), { performer: "X", selection: null });
  const status = segmentStatus(value, start + 60_000);
  assert.equal(status.index, 0);
  assert.equal(status.nextSwitchMs, 4 * 60_000);
  assert.equal(segmentScreen(value, start + 5 * 60_000 - 1)?.selection?.submissionId, "a");
});

test("a set's clock never moves once it starts: not for the lineup's timing, not for the card's", () => {
  const value: Lineup = { timing: DEFAULT_TIMING, performers: [card("sam", "Sam", ["a", "b", "c", "d"], start), card("jo", "Jo", ["e", "f", "g", "h"])] };
  const now = start + slotStartMs(1) + 3_000;
  const before = segmentStatus(value, now);
  const next = setLineupTiming(value, timing(8, 60, 3), now);
  // On stage: same clock, same questions, and it still follows the lineup.
  assert.deepEqual(segmentStatus(next, now), before);
  assert.equal(next.performers[0], value.performers[0]);
  assert.equal(next.performers[0].timing, null);
  assert.deepEqual(ids(next.performers[0]), ["a", "b", "c", "d"]);
  for (const later of [now + 1_000, start + slotStartMs(3), start + SEGMENT_MS - 1]) assert.deepEqual(segmentStatus(next, later), segmentStatus(value, later));
  assert.equal(segmentStatus(next, start + SEGMENT_MS).running, false);
  // Still to go: follows the lineup, down to three questions.
  assert.equal(next.performers[1].timing, null);
  assert.deepEqual(ids(next.performers[1]), ["e", "f", "g"]);
  assert.deepEqual(droppedQuestions(value, next).map((slot) => slot.submissionId), ["h"]);
  // The card on stage cannot be retimed.
  assert.equal(setCardTiming(value, "sam", timing(20, 0, 4), now), "running");
  assert.equal(setCardTiming(value, "sam", null, now), "running");
});

test("a card on stage when the lineup's timing changes follows the lineup again once its set is over", () => {
  const value: Lineup = { timing: DEFAULT_TIMING, performers: [card("sam", "Sam", ["a", "b", "c", "d"], start), card("jo", "Jo", ["e", "f", "g", null])] };
  const now = start + slotStartMs(1) + 3_000;
  const next = setLineupTiming(value, timing(8, 60, 3), now);
  // Nothing has its own timing: no badge, no "Some cards have their own timing".
  assert.equal(next.performers.some((performer) => performer.timing), false);
  // Mid-set the card holds the four questions it started with, and that is the count a save must send.
  assert.equal(slotCountFor(next, "sam"), 4);
  assert.equal(slotCountFor(next, "jo"), 3);
  assert.equal(slotCountFor(next, "brand-new"), 3);
  assert.deepEqual(slotTimingOf(next, next.performers[0]), DEFAULT_TIMING);
  assert.deepEqual(slotTimingOf(next, next.performers[1]), timing(8, 60, 3));
  // Saved and read back mid-set, the running card keeps all four and the clock runs on.
  const stored = parseLineup(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(stored, next);
  assert.equal(segmentScreen(stored, start + slotStartMs(3))?.selection?.submissionId, "d");
  // A save mid-set keeps four slots on the set on stage, with the ones that have been up locked.
  const moved = rearrange(next, [{ id: "sam", name: "Sam", slots: [q("x"), q("y"), q("c"), q("z")] }, { id: "jo", name: "Jo", slots: [q("e"), q("f"), q("g")] }], now);
  assert.deepEqual(ids(moved.performers[0]), ["a", "y", "c", "z"]);
  assert.equal(moved.performers[0].timing, null);
  // The lineup back to the standard mid-set: still nothing of its own, still the same set.
  const back = setLineupTiming(next, DEFAULT_TIMING, now + 1_000);
  assert.equal(back.performers[0].timing, null);
  assert.deepEqual(segmentStatus(back, now + 2_000), segmentStatus(value, now + 2_000));

  const ended = start + SEGMENT_MS + 1;
  assert.equal(segmentStatus(next, ended).running, false);
  // Until it is next saved the finished card shows its questions on the timing they ran with.
  assert.deepEqual(slotTimingOf(next, next.performers[0]), DEFAULT_TIMING);
  assert.deepEqual(timingOf(next, next.performers[0]), timing(8, 60, 3));
  // The first save after the set fits it to the lineup.
  const saved = rearrange(next, [{ id: "sam", name: "Sam", slots: [q("a"), q("b"), q("c"), q("d")] }, { id: "jo", name: "Jo", slots: [q("e"), q("f"), q("g")] }], ended);
  assert.deepEqual(ids(saved.performers[0]), ["a", "b", "c"]);
  assert.deepEqual(slotTimingOf(saved, saved.performers[0]), timing(8, 60, 3));
  assert.deepEqual(droppedQuestions(next, saved).map((slot) => slot.submissionId), ["d"]);
  // "Again" runs the lineup's timing, not the one the last set ran with.
  const again = startPerformer(next, "sam", ended);
  assert.ok(again);
  assert.deepEqual(again.performers[0].ranWith, timing(8, 60, 3));
  assert.equal(again.performers[0].timing, null);
  assert.deepEqual(ids(again.performers[0]), ["a", "b", "c"]);
  assert.equal(segmentStatus(again, ended).remainingMs, 8 * 60_000);
  // A later change to the lineup reaches it like any other card.
  const later = setLineupTiming(next, timing(10, 0, 2), ended);
  assert.equal(later.performers[0].timing, null);
  assert.deepEqual(ids(later.performers[0]), ["a", "b"]);
  assert.deepEqual(ids(later.performers[1]), ["e", "f"]);
  assert.equal(slotCountFor(later, "sam"), 2);
});

test("a finished set stays finished when the timing grows", () => {
  const value: Lineup = { timing: DEFAULT_TIMING, performers: [card("sam", "Sam", ["a", null, null, null], start)] };
  const now = start + 15 * 60_000;
  assert.equal(segmentStatus(value, now).running, false);
  const longer = setLineupTiming(value, timing(30, 120, 4), now);
  assert.equal(segmentStatus(longer, now).running, false);
  assert.deepEqual(longer.performers[0].ranWith, DEFAULT_TIMING);
  assert.equal(longer.performers[0].timing, null);
  const own = setCardTiming(value, "sam", timing(30, 120, 4), now);
  assert.ok(typeof own === "object");
  assert.equal(segmentStatus(own, now).running, false);
  // Stopped by hand: not running whatever the timing.
  const stopped = stopAll(value, start + 60_000);
  assert.equal(segmentStatus(setLineupTiming(stopped, timing(60, 0, 4), start + 61_000), start + 61_000).running, false);
});

test("setLineupTiming: cards with their own timing keep it; the set on stage is left alone", () => {
  const own = timing(20, 60, 6);
  const value: Lineup = { timing: DEFAULT_TIMING, performers: [card("sam", "Sam", ["a", "b", "c", "d"], start), card("own", "Own", ["x", null, null, null, null, null], null, own)] };
  const same = setLineupTiming(value, DEFAULT_TIMING, start + 1_000);
  assert.equal(same.performers[0], value.performers[0]);
  const longer = setLineupTiming(value, timing(15, 120, 5), start + 1_000);
  assert.equal(longer.performers[0], value.performers[0]);
  assert.equal(longer.performers[1], value.performers[1]);
  assert.deepEqual(longer.timing, timing(15, 120, 5));
});

test("setCardTiming: resizes the card, gives questions back, and follows the lineup again on null", () => {
  const value = lineup();
  const now = start + SEGMENT_MS + 1;
  const shorter = setCardTiming(value, "jo", timing(5, 0, 2), now);
  assert.ok(typeof shorter === "object");
  assert.deepEqual(shorter.performers[1].timing, timing(5, 0, 2));
  assert.deepEqual(ids(shorter.performers[1]), ["e", null]);
  assert.deepEqual(droppedQuestions(value, shorter), []);
  const grown = setCardTiming(shorter, "jo", timing(20, 60, 6), now);
  assert.ok(typeof grown === "object");
  assert.deepEqual(ids(grown.performers[1]), ["e", null, null, null, null, null]);
  // Sam's set has run: the card can change, and loses the questions past its new length.
  const sam = setCardTiming(value, "sam", timing(5, 0, 1), now);
  assert.ok(typeof sam === "object");
  assert.deepEqual(ids(sam.performers[0]), ["a"]);
  assert.deepEqual(droppedQuestions(value, sam).map((slot) => slot.submissionId), ["b", "d"]);
  const back = setCardTiming(grown, "jo", null, now);
  assert.ok(typeof back === "object");
  assert.equal(back.performers[1].timing, null);
  assert.equal(back.performers[1].slots.length, 4);
  assert.equal(setCardTiming(value, "nobody", null, now), "gone");
  assert.equal(slotCountFor(grown, "jo"), 6);
  assert.equal(slotCountFor(grown, "sam"), 4);
  assert.equal(slotCountFor(grown, "brand-new"), 4);
  assert.deepEqual(timingOf(grown, grown.performers[1]), timing(20, 60, 6));
  assert.deepEqual(timingOf(grown, grown.performers[0]), DEFAULT_TIMING);
});

test("droppedQuestions: a question moved to another card is not dropped", () => {
  const value = lineup();
  const moved: Lineup = { ...value, performers: [card("sam", "Sam", [null, null, null, null]), card("jo", "Jo", ["a", "b", "d", "e"])] };
  assert.deepEqual(droppedQuestions(value, moved), []);
});

test("parseCardTiming: a card id and a valid timing, or null to follow the lineup", () => {
  assert.deepEqual(parseCardTiming({ performerId: "p-1", timing: timing(8, 60, 3) }), { performerId: "p-1", timing: timing(8, 60, 3) });
  assert.deepEqual(parseCardTiming({ performerId: "p-1", timing: null }), { performerId: "p-1", timing: null });
  for (const bad of [null, "p-1", { performerId: "p-1" }, { performerId: "bad id", timing: null }, { performerId: "p-1", timing: timing(1, 0, 1) }, { timing: null }]) {
    assert.equal(parseCardTiming(bad), null, JSON.stringify(bad));
  }
});

test("clearFinished: only cards whose set has run go; never the one on stage", () => {
  const value: Lineup = {
    timing: DEFAULT_TIMING,
    performers: [card("done", "Done", ["a", null, null, null], start - SEGMENT_MS), card("on", "On", ["b", null, null, null], start), card("next", "Next", ["c", null, null, null])],
  };
  value.performers.push({ ...card("stopped", "Stopped", [null, null, null, null], start - 60_000), stoppedAt: at(start - 30_000) });
  const next = clearFinished(value, start + 1_000);
  assert.deepEqual(next.performers.map((performer) => performer.id), ["on", "next"]);
  assert.deepEqual(droppedQuestions(value, next).map((slot) => slot.submissionId), ["a"]);
  assert.deepEqual(clearFinished(value, start + SEGMENT_MS).performers.map((performer) => performer.id), ["next"]);
  assert.deepEqual(next.timing, DEFAULT_TIMING);
});

test("moveCard: one place up or down, not past either end", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(moveCard(list, "b", -1)?.map((entry) => entry.id), ["b", "a", "c"]);
  assert.deepEqual(moveCard(list, "b", 1)?.map((entry) => entry.id), ["a", "c", "b"]);
  assert.equal(moveCard(list, "a", -1), null);
  assert.equal(moveCard(list, "c", 1), null);
  assert.equal(moveCard(list, "zz", 1), null);
  assert.deepEqual(list.map((entry) => entry.id), ["a", "b", "c"]);
});

test("words: the standard timing reads as it always has; others read plainly", () => {
  assert.equal(timingSentence(DEFAULT_TIMING), "12 minutes each: their name for 2 minutes, then a question at 2:00, 4:30, 7:00 and 9:30.");
  assert.equal(timingSentence(timing(6, 0, 3)), "6 minutes each: a question at 0:00, 2:00 and 4:00.");
  assert.equal(timingSentence(timing(5, 90, 1)), "5 minutes each: their name for 1 minute 30 seconds, then a question at 1:30.");
  assert.equal(timingSentence(timing(2, 45, 2)), "2 minutes each: their name for 45 seconds, then a question at 0:45 and 1:23.");
  assert.equal(scheduleText(DEFAULT_TIMING), "Name 0:00–2:00 · Q1 2:00 · Q2 4:30 · Q3 7:00 · Q4 9:30 · End 12:00");
  assert.equal(scheduleText(timing(6, 0, 3)), "Q1 0:00 · Q2 2:00 · Q3 4:00 · End 6:00");
  assert.equal(timingShort(DEFAULT_TIMING), "12 min · name 2:00 · 4 questions");
  assert.equal(timingShort(timing(5, 0, 1)), "5 min · no name · 1 question");
  assert.equal(durationWords(60_000), "1 minute");
  assert.equal(durationWords(1_000), "1 second");
  assert.equal(durationWords(61_000), "1 minute 1 second");
  assert.equal(clockText(SEGMENT_MS), "12:00");
  assert.equal(clockText(59_001), "1:00");
  assert.equal(clockText(-5), "0:00");
});
