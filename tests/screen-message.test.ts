import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MESSAGE_COLOR, MESSAGE_COLORS, MESSAGE_LINES, MESSAGE_MAX, MESSAGE_PRESETS, NO_MESSAGE,
  applyMessage, cleanMessageColor, cleanMessageText, parseMessage, parseMessageChange, publicMessage, readPublicMessage,
} from "../src/lib/screen-message.ts";

test("nothing stored, or junk, is no message", () => {
  for (const raw of [null, undefined, "Last call!", 42, {}]) assert.deepEqual(parseMessage(raw), NO_MESSAGE);
  assert.deepEqual(parseMessage({ on: "yes", text: "Hi", color: "red" }), { on: false, text: "Hi", color: "" });
});

test("a message with no words is never up", () => {
  assert.equal(parseMessage({ on: true, text: "   \n " }).on, false);
  assert.equal(parseMessage({ on: true, text: "Last call!" }).on, true);
});

test("words: a few trimmed lines, blank lines squeezed, capped", () => {
  assert.equal(cleanMessageText("  Short   break \r\n\r\n\r\n  back in 10  "), "Short break\n\nback in 10");
  assert.equal(cleanMessageText("\n\nLast call!\n\n"), "Last call!");
  assert.equal(cleanMessageText("a\nb\nc\nd\ne\nf").split("\n").length, MESSAGE_LINES);
  assert.equal(cleanMessageText("x".repeat(MESSAGE_MAX + 40)).length, MESSAGE_MAX);
  for (const raw of [null, 7, ["hi"], { text: "hi" }]) assert.equal(cleanMessageText(raw), "");
});

test("colour: six-digit hex, white kept as the default", () => {
  assert.equal(cleanMessageColor("#ffc93c"), "#FFC93C");
  assert.equal(cleanMessageColor("#ffffff"), "");
  for (const raw of ["red", "#fff", "url(x)", null]) assert.equal(cleanMessageColor(raw), "");
  assert.equal(MESSAGE_COLORS[0], DEFAULT_MESSAGE_COLOR);
});

test("a change: up or down, with optional words and colour; anything else is refused", () => {
  assert.deepEqual(parseMessageChange({ on: false }), { on: false });
  assert.deepEqual(parseMessageChange({ on: true, text: " Last  call! ", color: "#ff2e4d" }), { on: true, text: "Last call!", color: "#FF2E4D" });
  assert.deepEqual(parseMessageChange({ on: true, color: "" }), { on: true, color: "" });
  for (const raw of [null, [], "on", {}, { on: "true" }, { on: true, text: 5 }, { on: true, color: "red" }, { on: true, color: 3 }]) {
    assert.equal(parseMessageChange(raw), null, JSON.stringify(raw));
  }
});

test("applying a change keeps what it leaves out, and an empty message stays down", () => {
  const saved = { on: false, text: "Short break — back in 10", color: "#3CE0FF" };
  assert.deepEqual(applyMessage(saved, { on: true }), { ...saved, on: true });
  assert.deepEqual(applyMessage({ ...saved, on: true }, { on: false }), saved);
  assert.deepEqual(applyMessage(saved, { on: true, text: "Last call!", color: "" }), { on: true, text: "Last call!", color: "" });
  assert.equal(applyMessage(NO_MESSAGE, { on: true, text: "  " }).on, false);
});

test("the live screen gets the words and a colour while it is up, and nothing otherwise", () => {
  assert.equal(publicMessage(NO_MESSAGE), null);
  assert.equal(publicMessage({ on: false, text: "Hi", color: "" }), null);
  assert.deepEqual(publicMessage({ on: true, text: "Hi", color: "" }), { text: "Hi", color: DEFAULT_MESSAGE_COLOR });
  assert.deepEqual(publicMessage({ on: true, text: "Hi", color: "#FF2E4D" }), { text: "Hi", color: "#FF2E4D" });
});

test("the live screen reads the answer defensively", () => {
  assert.deepEqual(readPublicMessage({ text: "Hi", color: "#ff2e4d" }), { text: "Hi", color: "#FF2E4D" });
  assert.deepEqual(readPublicMessage({ text: "Hi", color: "javascript:alert(1)" }), { text: "Hi", color: DEFAULT_MESSAGE_COLOR });
  for (const raw of [null, undefined, "Hi", {}, { text: "  " }, { text: 4 }]) assert.equal(readPublicMessage(raw), null);
});

test("presets fit in a message", () => {
  for (const preset of MESSAGE_PRESETS) assert.ok(cleanMessageText(preset.text).length > 0 && preset.text.length <= MESSAGE_MAX, preset.label);
});
