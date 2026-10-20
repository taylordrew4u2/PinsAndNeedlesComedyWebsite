import { test } from "node:test";
import assert from "node:assert/strict";
import { screenStatus, type ScreenView } from "../src/lib/screen-status.ts";

const idle: ScreenView = { menu: null, message: false, set: null, question: false };

test("with no set running: a question, or a cleared screen", () => {
  assert.equal(screenStatus(idle), "Screen cleared");
  assert.equal(screenStatus({ ...idle, question: true }), "Question on screen");
});

test("a set says whose it is and which part of it is up, never \"cleared\" while a name shows", () => {
  const set = (name: string, index: number | null, question = false) => screenStatus({ ...idle, set: { name, index }, question });
  assert.equal(set("Jess", null), "Set running: Jess · name on screen");
  // No name on the card: the screen is blank until the first question goes up.
  assert.equal(set("", null), "Set running: no name on the card · blank until the first question");
  assert.equal(set("Jess", 0, true), "Set running: Jess · question on screen");
  assert.equal(set("Jess", 2, false), "Set running: Jess · empty slot, nothing on screen");
});

test("a drink menu covers everything, then the host's message", () => {
  const busy: ScreenView = { menu: null, message: true, set: { name: "Jess", index: 1 }, question: true };
  assert.equal(screenStatus(busy), "Message on screen");
  assert.equal(screenStatus({ ...busy, menu: "standard" }), "Drink menu on screen");
  assert.equal(screenStatus({ ...busy, menu: "custom" }), "Custom drink menu on screen");
});
