import { test } from "node:test";
import assert from "node:assert/strict";
import { adminSaveBody, fromAdmin } from "../src/lib/admin-save.ts";
import { merge } from "../src/lib/merge.ts";

// Just the weekly settings that both the admin and the Control Center write.
type Weekly = { enabled: boolean; alwaysOpen: boolean; closedUntil: string; closedAt: string; thanksText: string };
type Stored = { weekly: Weekly; shows: { id: string }[] };

const loaded: Stored = {
  weekly: { enabled: true, alwaysOpen: false, closedUntil: "", closedAt: "", thanksText: "Got it." },
  shows: [{ id: "a" }],
};

// What the host's "Close questions now" wrote at 9:40 PM, after the tab loaded.
const closedByHost: Stored = {
  ...loaded,
  weekly: { ...loaded.weekly, closedUntil: "2026-10-16T05:00:00.000Z", closedAt: "2026-10-16T01:40:00.000Z" },
};

/** One admin save end to end: the tab's body, the route's filter, the store's merge. */
function save(stored: Stored, snapshot: Stored, base: Stored): Stored {
  const body = JSON.parse(JSON.stringify(adminSaveBody(snapshot, base)));
  return merge(stored, fromAdmin(body));
}

test("an edit in a tab opened before the host closed questions leaves the close alone", () => {
  const edited = { ...loaded, weekly: { ...loaded.weekly, thanksText: "Got it, see you there." } };
  const after = save(closedByHost, edited, loaded);
  assert.equal(after.weekly.closedUntil, closedByHost.weekly.closedUntil);
  assert.equal(after.weekly.closedAt, closedByHost.weekly.closedAt);
  // The edit itself still saves.
  assert.equal(after.weekly.thanksText, "Got it, see you there.");
});

test("a stale tab does not turn off the host's \"Open questions now\" or switch the page off again", () => {
  const stale: Stored = { ...loaded, weekly: { ...loaded.weekly, enabled: false } };
  // Then the host pressed "Open questions now", which also puts the page live.
  const opened: Stored = { ...loaded, weekly: { ...loaded.weekly, enabled: true, alwaysOpen: true } };
  const edited = { ...stale, shows: [{ id: "a" }, { id: "b" }] };
  const after = save(opened, edited, stale);
  assert.equal(after.weekly.alwaysOpen, true);
  assert.equal(after.weekly.enabled, true);
  assert.deepEqual(after.shows, [{ id: "a" }, { id: "b" }]);
});

test("a switch flipped in this tab is saved", () => {
  const off = { ...loaded, weekly: { ...loaded.weekly, enabled: false } };
  assert.equal(save(loaded, off, loaded).weekly.enabled, false);
  const always = { ...loaded, weekly: { ...loaded.weekly, alwaysOpen: true } };
  assert.equal(save(loaded, always, loaded).weekly.alwaysOpen, true);
  // And switched back off again after that save, it saves off.
  assert.equal(save({ ...loaded, weekly: { ...loaded.weekly, alwaysOpen: true } }, loaded, always).weekly.alwaysOpen, false);
});

test("switching \"Keep the form open all the time\" on ends a close, as \"Open questions now\" does", () => {
  const always = { ...loaded, weekly: { ...loaded.weekly, alwaysOpen: true } };
  const after = save(closedByHost, always, loaded);
  assert.equal(after.weekly.alwaysOpen, true);
  assert.equal(after.weekly.closedUntil, "");
});

test("a tab whose copy still has it on does not reopen questions the host has closed", () => {
  // Loaded while "Open questions now" was on; the host then closed questions,
  // which turns it off. An edit in that tab must not bring it back.
  const wasOpen: Stored = { ...loaded, weekly: { ...loaded.weekly, alwaysOpen: true } };
  const closed: Stored = { ...closedByHost, weekly: { ...closedByHost.weekly, alwaysOpen: false } };
  const edited = { ...wasOpen, weekly: { ...wasOpen.weekly, thanksText: "Ta." } };
  const after = save(closed, edited, wasOpen);
  assert.equal(after.weekly.alwaysOpen, false);
  assert.equal(after.weekly.closedUntil, closed.weekly.closedUntil);
});

test("the route drops the host's close from any admin save, whatever the body says", () => {
  const body = { weekly: { closedUntil: "", closedAt: "", thanksText: "x" }, shows: [] };
  assert.deepEqual(fromAdmin(body), { weekly: { thanksText: "x" }, shows: [] });
  // Not an object, or no weekly: passed through untouched.
  for (const patch of [null, "x", [], { shows: [] }, { weekly: "x" }]) {
    assert.deepEqual(fromAdmin(patch), patch);
  }
});

test("the tab's own copy is not changed by building the save", () => {
  const snapshot = structuredClone(loaded);
  adminSaveBody(snapshot, loaded);
  assert.deepEqual(snapshot, loaded);
});
