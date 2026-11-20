import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanReport } from "../src/lib/client-error.ts";

test("a crash report keeps what finds the bug and nothing else", () => {
  const report = cleanReport({ message: "x is undefined", stack: "at y", path: "/admin/run-show?token=abc#frag", source: "window", extra: "dropped" }, "iPhone Safari");
  assert.deepEqual(report, { message: "x is undefined", stack: "at y", path: "/admin/run-show", source: "window", agent: "iPhone Safari" });
});

test("junk is refused and long parts are cut short", () => {
  assert.equal(cleanReport(null, null), null);
  assert.equal(cleanReport({ message: "   " }, null), null);
  assert.equal(cleanReport({ message: 42 }, null), null);
  const long = cleanReport({ message: "m".repeat(5000), stack: "s".repeat(9000), path: "https://evil.example/x" }, "a".repeat(999));
  assert.equal(long?.message.length, 500);
  assert.equal(long?.stack.length, 2000);
  assert.equal(long?.path, "", "only a path on this site");
  assert.equal(long?.agent.length, 300);
});
