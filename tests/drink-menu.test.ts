import { test } from "node:test";
import assert from "node:assert/strict";
import { DRINK_MENU, MARQUEE_MAX, cleanMarquee, parseMenuState } from "../src/lib/drink-menu.ts";

test("the menu is on only when stored exactly as on", () => {
  assert.deepEqual(parseMenuState({ on: true }), { on: true, marquee: "" });
  for (const raw of [null, undefined, {}, { on: false }, { on: "true" }, { on: 1 }, "on", true]) {
    assert.equal(parseMenuState(raw).on, false);
  }
});

test("the marquee is kept with the menu, on or off", () => {
  assert.deepEqual(parseMenuState({ on: false, marquee: "Happy hour till 9" }), { on: false, marquee: "Happy hour till 9" });
});

test("the marquee is one trimmed, capped line of text", () => {
  assert.equal(cleanMarquee("  Tip your\n  bartenders  "), "Tip your bartenders");
  assert.equal(cleanMarquee("x".repeat(MARQUEE_MAX + 50)).length, MARQUEE_MAX);
  for (const raw of [null, undefined, 42, { text: "hi" }, ["hi"]]) assert.equal(cleanMarquee(raw), "");
});

test("every drink has a price, either its own or its section's", () => {
  for (const section of DRINK_MENU.flat()) {
    for (const drink of section.drinks) {
      assert.ok(section.price || drink.price, `${section.title}: ${drink.name} has no price`);
    }
  }
});
