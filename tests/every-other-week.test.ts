import { test } from "node:test";
import assert from "node:assert/strict";
import { upcomingPublicShows } from "../src/lib/public-shows.ts";
import { newWeeklyShow, nextNightOfRun, submissionWindow, weeklyEvery, weeklyScheduleLine } from "../src/lib/decisions.ts";
import type { WeeklyPage } from "../src/lib/types.ts";

// Every other Thursday at 9 PM, counted from Oct 22, 2026.
const biweekly = {
  enabled: true, showOnShowsPage: true, slug: "bad-decisions", title: "Bad Decisions",
  weekday: "Thursday", everyWeeks: 2, anchorDate: "2026-10-22",
  doorsTime: "21:00", startTime: "21:00",
  openMinutesBefore: 60, closeMinutesAfter: 240, alwaysOpen: false,
} as unknown as WeeklyPage;

test("the Shows page lists every other Thursday from the anchor night", () => {
  assert.deepEqual(upcomingPublicShows([], biweekly, "2026-10-19").map((s) => s.date), [
    "2026-10-22", "2026-11-05", "2026-11-19", "2026-12-03", "2026-12-17",
  ]);
});

test("an off-week Thursday skips to the next night of the run", () => {
  assert.equal(nextNightOfRun(biweekly, "2026-10-23"), "2026-11-05");
  assert.equal(nextNightOfRun(biweekly, "2026-10-29"), "2026-11-05");
  assert.equal(nextNightOfRun(biweekly, "2026-11-05"), "2026-11-05");
  // Before the anchor, the same rhythm runs backwards.
  assert.equal(nextNightOfRun(biweekly, "2026-10-01"), "2026-10-08");
  // Across New Year and the DST change.
  assert.equal(nextNightOfRun(biweekly, "2026-12-30"), "2026-12-31");
  assert.equal(nextNightOfRun(biweekly, "2027-03-12"), "2027-03-25");
});

test("an anchor that is blank or on the wrong weekday falls back to the next matching weekday", () => {
  assert.equal(nextNightOfRun({ ...biweekly, anchorDate: "" }, "2026-10-23"), "2026-10-29");
  assert.equal(nextNightOfRun({ ...biweekly, anchorDate: "2026-10-21" }, "2026-10-23"), "2026-10-29");
});

test("weekly stays weekly when everyWeeks is missing, 1 or nonsense", () => {
  for (const everyWeeks of [undefined, 1, 0, Number.NaN]) {
    const weekly = { ...biweekly, everyWeeks } as unknown as WeeklyPage;
    assert.equal(nextNightOfRun(weekly, "2026-10-23"), "2026-10-29");
    assert.equal(weeklyEvery(weekly), "every Thursday");
  }
});

test("the schedule line and the next-night button follow the run", () => {
  assert.equal(weeklyScheduleLine(biweekly), "Every other Thursday · Doors 9:00 PM · Show 9:00 PM");
  assert.equal(weeklyEvery({ ...biweekly, everyWeeks: 3 }), "every 3 weeks on Thursday");
  assert.equal(newWeeklyShow(biweekly, "2026-10-23").date, "2026-11-05");
});

test("after a night closes, the form points at the night two weeks out", () => {
  // Fri Oct 23, 2:00 AM in New York: Oct 22's window shut at 1 AM.
  const window = submissionWindow(biweekly, [], new Date("2026-10-23T06:00:00Z"));
  assert.equal(window.date, "2026-11-05");
  assert.equal(window.open, false);
});
