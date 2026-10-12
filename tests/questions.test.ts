import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEARCH_MAX, editedSubmission, isEdited, lineupAfterEdit, matchesSearch, onScreenQuestion, originalOf,
  parseQuestionEdit, selectionAfterEdit, withEdit,
} from "../src/lib/questions.ts";
import { DECISION_MAX, NAME_MAX, sanitizeSubmission } from "../src/lib/decisions.ts";
import type { LiveSelection } from "../src/lib/live-selection.ts";
import type { Lineup, Performer } from "../src/lib/segment.ts";
import type { Submission } from "../src/lib/types.ts";

const ID = "20261008210000000-abc123";
const sent: Submission = {
  id: ID, decision: "Shuold I quit my job?", name: "Sam", createdAt: "2026-10-08T21:00:00Z", status: "open", drawnAt: "", shownAt: "",
};

test("an edit is cleaned exactly like a new submission from the form", () => {
  const raw = { decision: "  Should   I\tquit?\r\n\r\n\r\n\r\nYes. \u0007", name: "  Sam \n Drew  " };
  const parsed = parseQuestionEdit({ submissionId: ID, ...raw });
  assert.deepEqual(parsed, { submissionId: ID, change: sanitizeSubmission({ ...raw, anonymous: false }) });
  assert.deepEqual(parsed?.change, { decision: "Should I quit?\n\nYes.", name: "Sam Drew" });
});

test("an edit keeps to the form's length caps", () => {
  const parsed = parseQuestionEdit({ submissionId: ID, decision: "x".repeat(DECISION_MAX + 50), name: "n".repeat(NAME_MAX + 9) });
  assert.ok(parsed && !("revert" in parsed.change));
  if (!parsed || "revert" in parsed.change) return;
  assert.equal(parsed.change.decision.length, DECISION_MAX);
  assert.equal(parsed.change.name.length, NAME_MAX);
});

test("an empty name means no name on screen; a missing one too", () => {
  assert.deepEqual(parseQuestionEdit({ submissionId: ID, decision: "Should I?", name: "   " })?.change, { decision: "Should I?", name: "" });
  assert.deepEqual(parseQuestionEdit({ submissionId: ID, decision: "Should I?" })?.change, { decision: "Should I?", name: "" });
});

test("an edit with nothing left to show, or not one of ours, is refused", () => {
  for (const value of [
    null, "text", [], {},
    { submissionId: ID, decision: "   \n  " },
    { submissionId: ID, decision: 7 },
    { submissionId: ID, decision: "Fine", name: 7 },
    { submissionId: "../secret", decision: "Fine" },
    { submissionId: "", decision: "Fine" },
    { submissionId: "x".repeat(81), decision: "Fine" },
    { submissionId: ID, revert: "yes" },
  ]) {
    assert.equal(parseQuestionEdit(value), null, JSON.stringify(value));
  }
  assert.deepEqual(parseQuestionEdit({ submissionId: ID, revert: true }), { submissionId: ID, change: { revert: true } });
});

test("the first edit keeps what the sender sent; later edits keep that same original", () => {
  const once = editedSubmission(sent, { decision: "Should I quit my job?", name: "Sam" });
  assert.equal(once.decision, "Should I quit my job?");
  assert.equal(once.originalDecision, "Shuold I quit my job?");
  assert.equal(once.originalName, "Sam");
  assert.equal(isEdited(once), true);

  const twice = editedSubmission(once, { decision: "Should I quit?", name: "" });
  assert.equal(twice.decision, "Should I quit?");
  assert.equal(twice.name, "");
  assert.deepEqual(originalOf(twice), { decision: "Shuold I quit my job?", name: "Sam" });
  // Everything else about the question is untouched.
  assert.equal(twice.id, sent.id);
  assert.equal(twice.createdAt, sent.createdAt);
  assert.equal(twice.status, sent.status);
});

test("revert puts back exactly what was sent and leaves no trace of the edit", () => {
  const edited = editedSubmission(editedSubmission(sent, { decision: "One", name: "" }), { decision: "Two", name: "Jo" });
  const back = editedSubmission(edited, { revert: true });
  assert.deepEqual(back, sent);
  assert.equal(isEdited(back), false);
  assert.ok(!("originalDecision" in back) && !("originalName" in back));
  // Typing the original back in by hand lands in the same place.
  assert.deepEqual(editedSubmission(edited, { decision: sent.decision, name: sent.name }), sent);
  // Reverting something never edited changes nothing.
  assert.deepEqual(editedSubmission(sent, { revert: true }), sent);
});

test("the screen's copy changes only when it is that question and its words moved", () => {
  const screen: LiveSelection = { submissionId: ID, question: sent.decision, name: "Sam" };
  const fixed = editedSubmission(sent, { decision: "Should I quit my job?", name: "Sam" });
  assert.deepEqual(selectionAfterEdit(screen, fixed), { submissionId: ID, question: "Should I quit my job?", name: "Sam" });
  assert.equal(selectionAfterEdit(screen, sent), null);
  assert.equal(selectionAfterEdit(null, fixed), null);
  assert.equal(selectionAfterEdit({ ...screen, submissionId: "20261008210500000-other1" }, fixed), null);
  // Taking the name off takes it off the screen.
  assert.deepEqual(selectionAfterEdit(screen, editedSubmission(sent, { decision: sent.decision, name: "" })), { ...screen, name: "" });
});

test("every performer card holding the question gets the fix; nothing else is touched", () => {
  const slot = (id: string, question: string, name = ""): LiveSelection => ({ submissionId: id, question, name });
  const card = (id: string, slots: (LiveSelection | null)[]): Performer => ({ id, name: id, slots, startedAt: null, stoppedAt: null });
  const lineup: Lineup = { performers: [
    card("sam", [slot(ID, sent.decision, "Sam"), null, slot("20261008210500000-other1", "Other"), null]),
    card("jo", [null, null, null, null]),
    card("al", [null, slot(ID, sent.decision, "Sam"), null, null]),
  ] };
  const fixed = editedSubmission(sent, { decision: "Fixed", name: "" });
  assert.equal(lineupAfterEdit(lineup, fixed)?.performers[2].slots[1]?.name, "", "the name comes off the card too");
  const next = lineupAfterEdit(lineup, fixed);
  assert.ok(next);
  assert.equal(next.performers[0].slots[0]?.question, "Fixed");
  assert.equal(next.performers[0].slots[2]?.question, "Other");
  assert.equal(next.performers[2].slots[1]?.question, "Fixed");
  assert.equal(next.performers[1], lineup.performers[1], "a card without it is the same card");
  assert.equal(lineup.performers[0].slots[0]?.question, sent.decision, "the saved lineup is not changed in place");
  assert.equal(lineupAfterEdit(lineup, editedSubmission(sent, { revert: true })), null, "unchanged words: nothing to write");
  assert.equal(lineupAfterEdit({ performers: [] }, fixed), null);
});

test("the Control Center shows the fix wherever the question sits", () => {
  const other: Submission = { ...sent, id: "20261008210500000-other1", decision: "Other" };
  const fixed = editedSubmission(sent, { decision: "Fixed", name: "Sam" });
  const board = {
    submissions: [other], shown: [sent], archived: [] as Submission[],
    selected: { submissionId: ID, question: sent.decision, name: "Sam" } as LiveSelection | null,
    lineup: { performers: [{ id: "sam", name: "Sam", slots: [{ submissionId: ID, question: sent.decision, name: "Sam" }, null, null, null], startedAt: null, stoppedAt: null }] } as Lineup,
    menu: false,
  };
  const next = withEdit(board, fixed);
  assert.equal(next.shown[0].decision, "Fixed");
  assert.equal(next.submissions[0], other);
  assert.equal(next.selected?.question, "Fixed");
  assert.equal(next.lineup.performers[0].slots[0]?.question, "Fixed");
  assert.equal(next.menu, false, "the rest of the state rides along");
  // Something on screen that is not this question stays as it is.
  const elsewhere = withEdit({ ...board, selected: { submissionId: other.id, question: "Other", name: "" } }, fixed);
  assert.deepEqual(elsewhere.selected, { submissionId: other.id, question: "Other", name: "" });
});

test("the On screen box edits the stored question, or the screen's own copy when it is in no list", () => {
  const screen: LiveSelection = { submissionId: ID, question: "On screen", name: "" };
  const edited = editedSubmission(sent, { decision: "On screen", name: "" });
  assert.equal(onScreenQuestion(screen, [[], [edited]]), edited);
  assert.equal(onScreenQuestion(null, [[edited]]), null);
  const stray = onScreenQuestion(screen, [[], []]);
  assert.deepEqual(stray && { id: stray.id, decision: stray.decision, name: stray.name }, { id: ID, decision: "On screen", name: "" });
  assert.equal(stray && isEdited(stray), false);
});

test("search finds every word, in any order and any case, in the question or the name", () => {
  const item = { decision: "Should I text my EX back?", name: "Sam Drew" };
  assert.equal(matchesSearch(item, ""), true);
  assert.equal(matchesSearch(item, "   "), true);
  assert.equal(matchesSearch(item, "ex text"), true);
  assert.equal(matchesSearch(item, "drew"), true);
  assert.equal(matchesSearch(item, "back sam"), true);
  assert.equal(matchesSearch(item, "ex dog"), false);
  assert.equal(matchesSearch({ decision: "Quit?", name: "" }, "anonymous"), false);
  // A pasted wall of text only counts up to the cap.
  assert.equal(matchesSearch(item, `text ${"z".repeat(SEARCH_MAX)}`), false);
  assert.equal(matchesSearch(item, `text${" ".repeat(SEARCH_MAX)}zzz`), true);
});
