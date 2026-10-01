import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPLAINER_FRESH_MS, EXPLAINER_MS, EXPLAINER_STEPS, freshExplainer, parseExplainer } from "../src/lib/explainer.ts";

test("a stored start time is read only when it is a real date", () => {
  assert.equal(parseExplainer({ at: "2026-10-01T22:00:00.000Z" }), "2026-10-01T22:00:00.000Z");
  for (const raw of [null, {}, { at: "soon" }, { at: 5 }, "2026-10-01T22:00:00.000Z"]) assert.equal(parseExplainer(raw), null);
});

test("only a recent tap reaches the live screen", () => {
  const at = "2026-10-01T22:00:00.000Z";
  const start = Date.parse(at);
  assert.equal(freshExplainer(at, start + 1_000), at);
  assert.equal(freshExplainer(at, start + EXPLAINER_FRESH_MS + 1), null);
  assert.equal(freshExplainer(at, start - 5_000), null);
  assert.equal(freshExplainer(null, start), null);
});

test("the explainer plays the real intro and adds up to its total", () => {
  assert.ok(EXPLAINER_STEPS.some(({ step }) => step === "intro"));
  assert.equal(EXPLAINER_MS, EXPLAINER_STEPS.reduce((sum, { ms }) => sum + ms, 0));
});
