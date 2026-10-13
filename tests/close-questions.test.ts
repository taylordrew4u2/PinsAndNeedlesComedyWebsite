import { test } from "node:test";
import assert from "node:assert/strict";
import { HOST_CLOSED_TEXT, closeQuestions, closedByHost, closedMessage, submissionWindow, textIntake, windowFor } from "../src/lib/decisions.ts";
import type { WeeklyPage } from "../src/lib/types.ts";

// Only the fields the window reads: a Thursday 9 PM show, open from 8 PM to 1 AM.
const weekly = {
  enabled: true, title: "Pins & Needles: Bad Decisions", weekday: "Thursday", startTime: "21:00",
  openMinutesBefore: 60, closeMinutesAfter: 240, alwaysOpen: false,
  closedText: "Opens an hour before the show. Come back {when}.",
} as unknown as WeeklyPage;

const MID_SHOW = new Date("2026-09-04T01:30:00Z"); // Thursday 9:30 PM in New York
const TONIGHT_CLOSE = "2026-09-04T05:00:00.000Z"; // 1:00 AM, four hours after the start

test("closing mid-show holds until the end of tonight's window, and drops a manual open", () => {
  assert.deepEqual(closeQuestions(weekly, [], MID_SHOW), { alwaysOpen: false, closedUntil: TONIGHT_CLOSE });
  assert.deepEqual(closeQuestions({ ...weekly, alwaysOpen: true }, [], MID_SHOW), { alwaysOpen: false, closedUntil: TONIGHT_CLOSE });
});

test("closed by the host: the form refuses, with no countdown and no promised time", () => {
  const closed = { ...weekly, ...closeQuestions(weekly, [], MID_SHOW) };
  const gate = submissionWindow(closed, [], MID_SHOW);
  assert.equal(gate.open, false);
  assert.equal(gate.closedByHost, true);
  assert.equal(gate.opensAt, "");
  assert.equal(gate.closesAt, "");
  assert.equal(gate.opensLabel, "");
  assert.equal(closedMessage(closed, gate), HOST_CLOSED_TEXT);
  // Still closed later the same night.
  assert.equal(submissionWindow(closed, [], new Date("2026-09-04T03:59:00Z")).open, false);
});

test("a close wins over a manual open left on, while it holds", () => {
  const both = { ...weekly, alwaysOpen: true, closedUntil: TONIGHT_CLOSE };
  assert.equal(submissionWindow(both, [], MID_SHOW).open, false);
});

test("a close nobody undid does not shut next week's show", () => {
  const closed = { ...weekly, ...closeQuestions(weekly, [], MID_SHOW) };
  const nextWeek = submissionWindow(closed, [], new Date("2026-09-11T00:30:00Z")); // next Thursday, 8:30 PM
  assert.equal(nextWeek.open, true);
  assert.equal(nextWeek.closedByHost, undefined);
  // And in between, the page counts down to it as usual.
  const monday = submissionWindow(closed, [], new Date("2026-09-07T16:00:00Z"));
  assert.equal(monday.open, false);
  assert.equal(monday.opensAt, "2026-09-11T00:00:00.000Z");
  assert.equal(closedMessage(closed, monday), "Opens an hour before the show. Come back Thursday at 8:00 PM.");
});

test("closing on show day before the door opens keeps tonight shut", () => {
  const afternoon = new Date("2026-09-03T22:00:00Z"); // Thursday 6 PM
  const patch = closeQuestions({ ...weekly, alwaysOpen: true }, [], afternoon);
  assert.deepEqual(patch, { alwaysOpen: false, closedUntil: TONIGHT_CLOSE });
  assert.equal(submissionWindow({ ...weekly, ...patch }, [], MID_SHOW).open, false);
});

test("closing on another day only ends a manual open; the schedule already has it shut", () => {
  const monday = new Date("2026-08-31T16:00:00Z");
  const patch = closeQuestions({ ...weekly, alwaysOpen: true }, [], monday);
  assert.deepEqual(patch, { alwaysOpen: false, closedUntil: "" });
  const gate = submissionWindow({ ...weekly, ...patch }, [], monday);
  assert.equal(gate.open, false);
  assert.equal(gate.closedByHost, undefined);
  assert.equal(gate.opensAt, "2026-09-04T00:00:00.000Z");
});

test("a weekly with no start time has no window to hold: closing just ends the manual open", () => {
  const undated = { ...weekly, startTime: "", alwaysOpen: true } as WeeklyPage;
  assert.deepEqual(closeQuestions(undated, [], MID_SHOW), { alwaysOpen: false, closedUntil: "" });
});

test("only a real, future stamp holds the form shut", () => {
  assert.equal(closedByHost({ closedUntil: TONIGHT_CLOSE }, MID_SHOW), true);
  assert.equal(closedByHost({ closedUntil: TONIGHT_CLOSE }, new Date(TONIGHT_CLOSE)), false);
  for (const closedUntil of [undefined, "", "soon", "2026-13-45T99:00:00Z"]) {
    assert.equal(closedByHost({ closedUntil }, MID_SHOW), false, String(closedUntil));
  }
  // A damaged record leaves the schedule in charge.
  assert.equal(submissionWindow({ ...weekly, closedUntil: "soon" }, [], MID_SHOW).open, true);
});

test("without a close the window is exactly what it was", () => {
  for (const iso of ["2026-09-03T22:00:00Z", "2026-09-04T00:00:00Z", "2026-09-04T01:30:00Z", "2026-09-07T16:00:00Z"]) {
    const now = new Date(iso);
    assert.deepEqual(submissionWindow({ ...weekly, closedUntil: "" }, [], now), submissionWindow(weekly, [], now));
  }
});

test("the rehearsal form stays open whatever the host did to the live one", () => {
  const closed = { ...weekly, closedUntil: TONIGHT_CLOSE };
  assert.equal(windowFor("rehearsal", closed, [], MID_SHOW).open, true);
  assert.equal(windowFor("live", closed, [], MID_SHOW).open, false);
});

test("texts from the forwarding mailbox: added while open, dropped while the host has it closed, held otherwise", () => {
  assert.equal(textIntake(weekly, submissionWindow(weekly, [], MID_SHOW)), "add");
  // Closed by the host: read and dropped, so opening again does not bring them all in at once.
  const closed = { ...weekly, closedUntil: TONIGHT_CLOSE };
  assert.equal(textIntake(closed, submissionWindow(closed, [], MID_SHOW)), "drop");
  // Outside the hours, or with the page switched off, the mailbox is left for later.
  const monday = new Date("2026-09-07T16:00:00Z");
  assert.equal(textIntake(weekly, submissionWindow(weekly, [], monday)), "wait");
  const off = { ...closed, enabled: false };
  assert.equal(textIntake(off, submissionWindow(off, [], MID_SHOW)), "wait");
});
