import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REHEARSAL_MINUTES,
  parseRehearsal,
  planRehearsal,
  rehearsalActive,
  withRehearsal,
} from "../src/lib/rehearsal.ts";
import type { SubmissionWindow } from "../src/lib/decisions.ts";

// Thursday: the real form opens at 8 PM New York (00:00 UTC Friday).
const closed: SubmissionWindow = {
  open: false,
  date: "2026-09-24",
  opensAt: "2026-09-25T00:00:00.000Z",
  closesAt: "2026-09-25T03:00:00.000Z",
  opensLabel: "tonight at 8:00 PM",
};
const live: SubmissionWindow = { ...closed, open: true };
const afternoon = new Date("2026-09-24T21:00:00.000Z"); // 5 PM New York

test("a rehearsal runs for its full length when the real window is far off", () => {
  const plan = planRehearsal(closed, afternoon);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.rehearsal.startedAt, afternoon.toISOString());
  assert.equal(Date.parse(plan.rehearsal.endsAt) - afternoon.getTime(), REHEARSAL_MINUTES * 60_000);
});

test("a rehearsal is cut short so it never runs into the real window", () => {
  const late = new Date("2026-09-24T23:50:00.000Z"); // 7:50 PM
  const plan = planRehearsal(closed, late);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.rehearsal.endsAt, closed.opensAt);
});

test("no rehearsal while the real window is open, or a minute before it", () => {
  assert.equal(planRehearsal(live, afternoon).ok, false);
  assert.equal(planRehearsal(closed, new Date("2026-09-24T23:59:30.000Z")).ok, false);
});

test("a running rehearsal opens the form and tags what is sent", () => {
  const plan = planRehearsal(closed, afternoon);
  assert.ok(plan.ok);
  const during = new Date(afternoon.getTime() + 60_000);
  const gate = withRehearsal(closed, plan.rehearsal, during);
  assert.equal(gate.open, true);
  assert.equal(gate.rehearsal, true);
  assert.equal(gate.opensAt, plan.rehearsal.startedAt);
  assert.equal(gate.closesAt, plan.rehearsal.endsAt);
});

test("an ended rehearsal leaves the real window exactly as it was", () => {
  const plan = planRehearsal(closed, afternoon);
  assert.ok(plan.ok);
  const after = new Date(Date.parse(plan.rehearsal.endsAt));
  assert.equal(rehearsalActive(plan.rehearsal, closed, after), false);
  assert.deepEqual(withRehearsal(closed, plan.rehearsal, after), { ...closed, rehearsal: false });
  assert.deepEqual(withRehearsal(closed, null, afternoon), { ...closed, rehearsal: false });
});

test("the real window always wins: nothing sent during it is a test", () => {
  // Even a record that somehow overlaps the real window cannot tag real decisions.
  const overlapping = { startedAt: "2026-09-24T23:30:00.000Z", endsAt: "2026-09-25T01:00:00.000Z" };
  const during = new Date("2026-09-25T00:30:00.000Z");
  assert.equal(rehearsalActive(overlapping, live, during), false);
  assert.deepEqual(withRehearsal(live, overlapping, during), { ...live, rehearsal: false });
});

test("a malformed record is no rehearsal", () => {
  for (const raw of [null, [], {}, "x", { startedAt: "soon", endsAt: "later" },
    { startedAt: "2026-09-24T21:30:00Z", endsAt: "2026-09-24T21:00:00Z" }]) {
    assert.equal(parseRehearsal(raw), null);
  }
  const good = { startedAt: "2026-09-24T21:00:00.000Z", endsAt: "2026-09-24T21:30:00.000Z" };
  assert.deepEqual(parseRehearsal({ ...good, extra: 1 }), good);
});
