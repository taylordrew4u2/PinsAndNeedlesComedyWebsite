import { test } from "node:test";
import assert from "node:assert/strict";
import { modeQuery, spaceOf, storagePrefix } from "../src/lib/space.ts";
import { submissionWindow, windowFor } from "../src/lib/decisions.ts";
import type { WeeklyPage } from "../src/lib/types.ts";

// Only the fields the window reads: a Thursday 9 PM show, open an hour before.
const weekly = {
  enabled: true, title: "Pins & Needles: Bad Decisions", weekday: "Thursday", startTime: "21:00",
  openMinutesBefore: 60, closeMinutesAfter: 240, alwaysOpen: false,
} as unknown as WeeklyPage;

test("legacy rehearsal URLs now select the live show", () => {
  assert.equal(spaceOf("rehearsal"), "live");
  assert.equal(spaceOf(["rehearsal", "live"]), "live");
  for (const value of [undefined, null, "", "live", "Rehearsal", "rehearsal ", ["live"], 1]) {
    assert.equal(spaceOf(value), "live");
  }
});

test("the live show's storage paths never move", () => {
  // Real submissions live in submissions/ and the projector in live-show/;
  // anything else would strand tonight's pile.
  assert.equal(storagePrefix("live"), "");
  assert.equal(`${storagePrefix("live")}submissions`, "submissions");
  assert.equal(`${storagePrefix("live")}live-show/selection.json`, "live-show/selection.json");
});

test("the rehearsal is stored somewhere the live show never looks", () => {
  const prefix = storagePrefix("rehearsal");
  assert.ok(prefix.length > 0);
  assert.notEqual(`${prefix}submissions`, "submissions");
  assert.ok(!`${prefix}submissions`.startsWith("submissions"));
  assert.ok(!`${prefix}live-show/selection.json`.startsWith("live-show/"));
});

test("rehearsal links carry the mode and live links carry nothing", () => {
  assert.equal(modeQuery("live"), "");
  assert.equal(modeQuery("rehearsal"), "?mode=rehearsal");
  assert.equal(modeQuery("rehearsal", "&"), "&mode=rehearsal");
});

test("the rehearsal form is always open; the live window is untouched", () => {
  const now = new Date("2026-09-24T10:00:00.000Z"); // Thursday morning: live is shut
  assert.equal(windowFor("rehearsal", weekly, [], now).open, true);
  assert.deepEqual(windowFor("live", weekly, [], now), submissionWindow(weekly, [], now));
  assert.equal(windowFor("live", weekly, [], now).open, false);
});
