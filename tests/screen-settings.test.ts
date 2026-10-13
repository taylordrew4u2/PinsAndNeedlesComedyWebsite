import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTDOWN_MAX, COUNTDOWN_MIN, DEFAULT_LOOK, DEFAULT_SCREEN, SCREEN_TEXT, SOUND_TEST_FRESH_MS,
  changedScreen, cleanScreenText, freshSoundTest, markBadDecisions, parseScreenChange, parseScreenSettings, screenLook,
} from "../src/lib/screen-settings.ts";
import { EXAMPLE_QUESTION } from "../src/lib/explainer.ts";

test("defaults are the screen as it has always been", () => {
  assert.deepEqual(DEFAULT_LOOK, {
    countdown: true, countdownFrom: 3, intro: true, introWord: "Incoming", sound: true, timer: true, names: true, stageLabel: "Now on stage",
    howHeading: "How it works", howStep1: "Scan the QR", howStep2: "Tell us your bad decision", howStep3: "A comedian weighs in, live",
    listenLine: "When you hear this…", exampleQuestion: EXAMPLE_QUESTION,
    closingLine: "That sound means a bad decision just hit the screen.", closingCall: "Scan to send yours.",
  });
  for (const { fallback, max } of Object.values(SCREEN_TEXT)) assert.ok(fallback.length <= max, fallback);
});

test("nothing stored, or junk, reads as the defaults", () => {
  for (const raw of [null, undefined, "on", 42, [], {}]) assert.deepEqual(parseScreenSettings(raw), DEFAULT_SCREEN);
  const junk = parseScreenSettings({ countdown: "no", countdownFrom: 99, sound: 0, introWord: 7, names: null });
  assert.deepEqual(junk, DEFAULT_SCREEN);
});

test("saved settings are read back", () => {
  const saved = parseScreenSettings({ countdown: false, countdownFrom: 5, intro: false, introWord: "  Brace\n yourselves ", sound: false, timer: false, names: false });
  assert.equal(saved.countdown, false);
  assert.equal(saved.countdownFrom, 5);
  assert.equal(saved.intro, false);
  assert.equal(saved.introWord, "Brace yourselves");
  assert.equal(saved.sound, false);
  assert.equal(saved.timer, false);
  assert.equal(saved.names, false);
});

test("the countdown starts from a whole number from 1 to 10", () => {
  for (const from of [COUNTDOWN_MIN, 7, COUNTDOWN_MAX]) assert.equal(parseScreenSettings({ countdownFrom: from }).countdownFrom, from);
  for (const from of [0, 11, 2.5, -1, "4", NaN, Infinity]) assert.equal(parseScreenSettings({ countdownFrom: from }).countdownFrom, 3);
});

test("words are one trimmed, capped line, and the default itself is kept as empty", () => {
  assert.equal(cleanScreenText("stageLabel", "  Up\n next "), "Up next");
  assert.equal(cleanScreenText("stageLabel", "x".repeat(SCREEN_TEXT.stageLabel.max + 20)).length, SCREEN_TEXT.stageLabel.max);
  assert.equal(cleanScreenText("introWord", "Incoming"), "");
  assert.equal(cleanScreenText("exampleQuestion", ` ${EXAMPLE_QUESTION} `), "");
  for (const raw of [null, 42, ["hi"], { text: "hi" }]) assert.equal(cleanScreenText("howHeading", raw), "");
});

test("a change: known settings of the right type only, or nothing at all", () => {
  assert.deepEqual(parseScreenChange({ sound: false }), { sound: false });
  assert.deepEqual(parseScreenChange({ countdownFrom: 10, stageLabel: "  Give it up for " }), { countdownFrom: 10, stageLabel: "Give it up for" });
  assert.deepEqual(parseScreenChange({ howStep1: "Scan the QR" }), { howStep1: "" });
  assert.deepEqual(parseScreenChange(DEFAULT_SCREEN), DEFAULT_SCREEN);
  for (const raw of [null, "sound", [], {}, { sound: "off" }, { countdownFrom: 0 }, { countdownFrom: "3" }, { introWord: 5 }, { volume: 11 }, { sound: false, extra: 1 }]) {
    assert.equal(parseScreenChange(raw), null, JSON.stringify(raw));
  }
});

test("only what differs from the defaults is stored and sent", () => {
  assert.deepEqual(changedScreen(DEFAULT_SCREEN), {});
  assert.deepEqual(changedScreen({ ...DEFAULT_SCREEN, sound: false, closingCall: "Go on, scan it." }), { sound: false, closingCall: "Go on, scan it." });
  // Round trip: what is stored reads back the same.
  const settings = parseScreenSettings({ countdown: false, countdownFrom: 6, howHeading: "The rules" });
  assert.deepEqual(parseScreenSettings(changedScreen(settings)), settings);
});

test("the projector's look fills in every default word, and copes with an old server that sends nothing", () => {
  assert.deepEqual(screenLook(undefined), DEFAULT_LOOK);
  assert.deepEqual(screenLook({}), DEFAULT_LOOK);
  const look = screenLook({ introWord: "Uh oh", names: false });
  assert.equal(look.introWord, "Uh oh");
  assert.equal(look.names, false);
  assert.equal(look.stageLabel, "Now on stage");
  assert.equal(look.exampleQuestion, EXAMPLE_QUESTION);
});

test("the closing line keeps \"bad decision\" in red, wherever the host puts it", () => {
  assert.deepEqual(markBadDecisions(DEFAULT_LOOK.closingLine), [
    { text: "That sound means a ", mark: false },
    { text: "bad decision", mark: true },
    { text: " just hit the screen.", mark: false },
  ]);
  assert.deepEqual(markBadDecisions("Bad Decisions incoming"), [{ text: "Bad Decisions", mark: true }, { text: " incoming", mark: false }]);
  assert.deepEqual(markBadDecisions("No red here"), [{ text: "No red here", mark: false }]);
  assert.deepEqual(markBadDecisions(""), []);
});

test("only a recent sound test reaches the live screen", () => {
  const at = "2026-10-01T22:00:00.000Z";
  const start = Date.parse(at);
  assert.equal(freshSoundTest(at, start + 1_000), at);
  assert.equal(freshSoundTest(at, start + SOUND_TEST_FRESH_MS + 1), null);
  assert.equal(freshSoundTest(at, start - 5_000), null);
  assert.equal(freshSoundTest(null, start), null);
});
