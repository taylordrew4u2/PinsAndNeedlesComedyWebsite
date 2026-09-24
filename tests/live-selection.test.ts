import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSelection, publicSelection, selectionFor } from "../src/lib/live-selection.ts";
import type { Submission } from "../src/lib/types.ts";

const submission: Submission = {
  id: "20260911210000000-example", decision: "Should I quit my job?", name: "Private name",
  createdAt: "2026-09-11T21:00:00Z", status: "open", drawnAt: "",
};

test("the screen shows the name of someone who asked to be named", () => {
  assert.deepEqual(publicSelection(selectionFor(submission)), { question: submission.decision, name: "Private name" });
  assert.deepEqual(publicSelection(null), { question: null, name: null });
});

test("an anonymous question shows no name", () => {
  assert.deepEqual(publicSelection(selectionFor({ ...submission, name: "" })), { question: submission.decision, name: null });
  assert.deepEqual(publicSelection(selectionFor({ ...submission, name: "   " })), { question: submission.decision, name: null });
});

test("archived questions cannot be selected; previously drawn questions can", () => {
  assert.equal(selectionFor({ ...submission, status: "archived" }), null);
  assert.deepEqual(selectionFor({ ...submission, status: "drawn" }), {
    submissionId: submission.id, question: submission.decision, name: submission.name,
  });
});

test("stored selection is allowlisted and malformed state displays nothing", () => {
  assert.deepEqual(parseSelection({ submissionId: submission.id, question: "Chosen", name: "Named", submissions: [submission] }), {
    submissionId: submission.id, question: "Chosen", name: "Named",
  });
  // Saved before names were shown, or a malformed name: anonymous.
  assert.deepEqual(parseSelection({ submissionId: submission.id, question: "Chosen" }), {
    submissionId: submission.id, question: "Chosen", name: "",
  });
  assert.deepEqual(parseSelection({ submissionId: submission.id, question: "Chosen", name: 7 }), {
    submissionId: submission.id, question: "Chosen", name: "",
  });
  for (const value of [null, [], {}, { submissionId: "../secret", question: "No" }, { submissionId: submission.id, question: " " }]) {
    assert.equal(parseSelection(value), null);
  }
});
