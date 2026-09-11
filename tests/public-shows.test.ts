import { test } from "node:test";
import assert from "node:assert/strict";
import { upcomingPublicShows } from "../src/lib/public-shows.ts";
import { newWeeklyShow } from "../src/lib/decisions.ts";
import type { WeeklyPage } from "../src/lib/types.ts";
const weekly = { enabled: true, showOnShowsPage: true, weekday: "Thursday", slug: "bad-decisions", title: "Bad Decisions", startTime: "21:00" } as WeeklyPage;
test("next five Thursdays roll across month and daylight saving boundaries", () => {
  assert.deepEqual(upcomingPublicShows([], weekly, "2026-09-11").map(s => s.date), ["2026-09-17", "2026-09-24", "2026-10-01", "2026-10-08", "2026-10-15"]);
  assert.deepEqual(upcomingPublicShows([], weekly, "2026-10-30").map(s => s.date), ["2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03"]);
});
test("dated lineups override exactly one occurrence without duplicates or draft leaks", () => {
  const show = { ...newWeeklyShow(weekly, "2026-09-17"), published: true };
  show.lineup = [{ id: "test", name: "Test performer", role: "Comedian", note: "", imageUrl: "", imageAlt: "", url: "" }];
  const draft = { ...show, id: "draft", date: "2026-09-24", published: false };
  const result = upcomingPublicShows([show, draft], weekly, "2026-09-11");
  assert.equal(result.length, 5);
  assert.equal(result[0].lineup[0].name, "Test performer");
  assert.equal(result[1].lineup.length, 0);
  assert.equal(result[0].generated, false);
  assert.equal(upcomingPublicShows([show], weekly, "2026-09-18")[0].lineup.length, 0);
  assert.equal(show.lineup.length, 1);
});
test("cancelled dates are not replaced with a scheduled occurrence and disabled weekly is hidden", () => {
  const show = { ...newWeeklyShow(weekly, "2026-09-17"), published: true, status: "cancelled" as const };
  assert.equal(upcomingPublicShows([show], weekly, "2026-09-11")[0].status, "cancelled");
  assert.deepEqual(upcomingPublicShows([], { ...weekly, enabled: false }, "2026-09-11"), []);
});
