import { test } from "node:test";
import assert from "node:assert/strict";
import { JUST_SAVED_MS, NO_SAVES, SAVE_WORDS, justSaved, saveEnded, savePhase, saveStarted, saveWords } from "../src/lib/save-state.ts";

test("where a card stands: saving beats everything, a failure only counts while its changes are still there", () => {
  assert.equal(savePhase(false, NO_SAVES), "saved");
  assert.equal(savePhase(true, NO_SAVES), "unsaved");
  const sending = saveStarted(NO_SAVES);
  assert.equal(savePhase(true, sending), "saving");
  assert.equal(savePhase(false, sending), "saving");
  const failed = saveEnded(sending, false, 1_000);
  assert.equal(savePhase(true, failed), "failed");
  // Undone after a failure: nothing is left unsaved.
  assert.equal(savePhase(false, failed), "saved");
});

test("two saves on their way at once: still saving until both are answered", () => {
  let memo = saveStarted(saveStarted(NO_SAVES));
  assert.equal(memo.saving, 2);
  memo = saveEnded(memo, true, 1_000);
  assert.equal(savePhase(false, memo), "saving");
  memo = saveEnded(memo, true, 2_000);
  assert.equal(savePhase(false, memo), "saved");
  assert.equal(memo.savedAt, 2_000);
  // An answer with nothing on its way never goes below none.
  assert.equal(saveEnded(NO_SAVES, true, 3_000).saving, 0);
});

test("a failure, then an edit, then trying again: the try clears the failure", () => {
  let memo = saveEnded(saveStarted(NO_SAVES), false, 1_000);
  assert.equal(memo.failed, true);
  assert.equal(savePhase(true, memo), "failed");
  memo = saveStarted(memo);
  assert.equal(memo.failed, false);
  assert.equal(savePhase(true, memo), "saving");
  memo = saveEnded(memo, true, 2_000);
  assert.deepEqual(memo, { saving: 0, savedAt: 2_000, failed: false });
  // A failure keeps when the last good save landed.
  assert.equal(saveEnded(saveStarted(memo), false, 3_000).savedAt, 2_000);
});

test("\"Saved just now\" lasts JUST_SAVED_MS after a save lands, and a clock that went backwards doesn't count", () => {
  const memo = saveEnded(saveStarted(NO_SAVES), true, 10_000);
  assert.equal(JUST_SAVED_MS, 4_000);
  assert.equal(justSaved(memo, 10_000), true);
  assert.equal(justSaved(memo, 10_000 + 3_999), true);
  assert.equal(justSaved(memo, 10_000 + JUST_SAVED_MS), false);
  assert.equal(justSaved(memo, 9_000), false);
  assert.equal(justSaved(NO_SAVES, 10_000), false);
});

test("the badge and the button for each phase, and a card's own words", () => {
  assert.deepEqual(saveWords("saved", false), { badge: "✓ Saved", button: "Saved ✓" });
  assert.deepEqual(saveWords("saved", true), { badge: "✓ Saved just now", button: "Saved ✓" });
  assert.deepEqual(saveWords("unsaved", false), { badge: "● Not saved yet", button: "Save" });
  assert.deepEqual(saveWords("saving", false), { badge: "Saving…", button: "Saving…" });
  assert.deepEqual(saveWords("failed", true), { badge: "✕ Didn't save", button: "Try again" });
  assert.equal(SAVE_WORDS.unsaved, "● Not saved yet");
  // The message card says "On screen" instead; what it leaves out stays as usual.
  const words = { saved: "✓ On screen", fresh: "✓ On screen just now", unsaved: "● Not on screen yet", saving: "Putting it up…", failed: "✕ Didn't go up" };
  assert.equal(saveWords("saved", true, words).badge, "✓ On screen just now");
  assert.equal(saveWords("saving", false, words).badge, "Putting it up…");
  assert.equal(saveWords("failed", false, { saved: "✓ On screen" }).badge, "✕ Didn't save");
});
