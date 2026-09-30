import { test } from "node:test";
import assert from "node:assert/strict";
import { DRINK_MENU, parseMenuFlag } from "../src/lib/drink-menu.ts";

test("the menu flag is on only when stored exactly as on", () => {
  assert.equal(parseMenuFlag({ on: true }), true);
  for (const raw of [null, undefined, {}, { on: false }, { on: "true" }, { on: 1 }, "on", true]) {
    assert.equal(parseMenuFlag(raw), false);
  }
});

test("every drink has a price, either its own or its section's", () => {
  for (const section of DRINK_MENU.flat()) {
    for (const drink of section.drinks) {
      assert.ok(section.price || drink.price, `${section.title}: ${drink.name} has no price`);
    }
  }
});
