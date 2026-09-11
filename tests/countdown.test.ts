import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownParts } from "../src/lib/countdown.ts";

test("countdown shows days, hours, minutes and seconds", () => {
  assert.deepEqual(countdownParts("2026-09-18T00:00:00Z", Date.parse("2026-09-16T21:56:56Z")),
    { days: 1, hours: 2, minutes: 3, seconds: 4 });
});
test("countdown rounds up until opening and never goes negative", () => {
  const target = "2026-09-18T00:00:00Z";
  assert.equal(countdownParts(target, Date.parse(target) - 1)?.seconds, 1);
  assert.deepEqual(countdownParts(target, Date.parse(target) + 1000),
    { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
test("missing or invalid schedule has no fabricated countdown", () => {
  assert.equal(countdownParts("", 0), null);
  assert.equal(countdownParts("invalid", 0), null);
});
