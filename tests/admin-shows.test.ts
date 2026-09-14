import { test } from "node:test";
import assert from "node:assert/strict";
import { unsavedWeeklyShows } from "../src/lib/admin-shows.ts";
import type { WeeklyPage } from "../src/lib/types.ts";
const weekly = { enabled: true, showOnShowsPage: true, weekday: "Thursday", slug: "bad-decisions", title: "Bad Decisions", startTime: "21:00" } as WeeklyPage;
test("saved nights including drafts have one editor and no duplicate date action", () => {
  const dates = unsavedWeeklyShows([], weekly, "2026-09-14");
  const saved = [{ ...dates[0], published: false }, dates[1]];
  const result = unsavedWeeklyShows(saved, weekly, "2026-09-14");
  assert.deepEqual(result.map(show => show.date), dates.slice(2).map(show => show.date));
  assert.ok(result.every(show => !("generated" in show)));
  assert.equal(saved[0].published, false);
});
test("one-off shows do not hide recurring dates, and disabled recurrence adds none", () => {
  const dates = unsavedWeeklyShows([], weekly, "2026-09-14");
  assert.equal(unsavedWeeklyShows([{ ...dates[0], series: "" }], weekly, "2026-09-14").length, 5);
  assert.deepEqual(unsavedWeeklyShows([], { ...weekly, enabled: false }, "2026-09-14"), []);
  assert.deepEqual(unsavedWeeklyShows([], { ...weekly, showOnShowsPage: false }, "2026-09-14"), []);
});
