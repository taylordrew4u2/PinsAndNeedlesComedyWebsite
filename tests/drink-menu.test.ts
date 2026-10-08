import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HEADLINE, DEFAULT_MENU_COLOR, DRINK_MENU, HEADLINE_MAX, MARQUEE_MAX, MENU_COLORS, NOTE_MAX, BARTENDER_MAX, cleanBartender, cleanColor, cleanHeadline, cleanMarquee, cleanNote, customLook, parseMenuState,
} from "../src/lib/drink-menu.ts";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, MENU_FONTS, SCRIPT_FONTS, isMenuFont, isScriptFont } from "../src/lib/menu-fonts.ts";

const LOOK_DEFAULTS = { font: DEFAULT_MENU_FONT, bartender: "", bartenderFont: DEFAULT_SCRIPT_FONT };

test("the menu is on only when stored exactly as on", () => {
  assert.deepEqual(parseMenuState({ on: true }), { on: true, style: "standard", marquee: "", color: "", headline: "", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "" });
  for (const raw of [null, undefined, {}, { on: false }, { on: "true" }, { on: 1 }, "on", true]) {
    assert.equal(parseMenuState(raw).on, false);
  }
});

test("the marquee is kept with the menu, on or off", () => {
  assert.equal(parseMenuState({ on: false, marquee: "Happy hour till 9" }).marquee, "Happy hour till 9");
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

test("two menus: anything but \"custom\" is the standard one", () => {
  assert.equal(parseMenuState({ on: true, style: "custom" }).style, "custom");
  for (const style of [undefined, "standard", "CUSTOM", 1, null]) assert.equal(parseMenuState({ on: true, style }).style, "standard");
});

test("the custom look survives the menu going down, and junk reads as the defaults", () => {
  const saved = parseMenuState({ on: false, style: "custom", color: "#ff2e4d", headline: "  Don't  miss\nthe 9 PM show " });
  assert.deepEqual(saved, { on: false, style: "custom", marquee: "", color: "#FF2E4D", headline: "Don't miss the 9 PM show", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "" });
  const junk = parseMenuState({ on: true, style: "custom", color: "red", headline: 7 });
  assert.equal(junk.color, "");
  assert.equal(junk.headline, "");
});

test("colours are six-digit hex only", () => {
  assert.equal(cleanColor(" #3ce0ff "), "#3CE0FF");
  for (const raw of ["#fff", "3ce0ff", "#3ce0fg", "rgb(1,2,3)", "url(x)", null, 42]) assert.equal(cleanColor(raw), "");
  for (const swatch of MENU_COLORS) assert.equal(cleanColor(swatch), swatch);
  assert.equal(cleanColor(DEFAULT_MENU_COLOR), DEFAULT_MENU_COLOR);
});

test("the line above the QR is one trimmed, capped line", () => {
  assert.equal(cleanHeadline("x".repeat(HEADLINE_MAX + 10)).length, HEADLINE_MAX);
  assert.ok(DEFAULT_HEADLINE.length <= HEADLINE_MAX);
});

test("customLook: defaults filled in for the custom menu, nothing for the standard one", () => {
  assert.equal(customLook(parseMenuState({ on: true })), null);
  assert.deepEqual(customLook(parseMenuState({ on: true, style: "custom" })), { ...LOOK_DEFAULTS, color: DEFAULT_MENU_COLOR, headline: DEFAULT_HEADLINE, note: "", noteColor: DEFAULT_MENU_COLOR, bartenderColor: DEFAULT_MENU_COLOR });
  assert.deepEqual(
    customLook(parseMenuState({ on: true, style: "custom", color: "#7cff6b", headline: "Doors at 8" })),
    { ...LOOK_DEFAULTS, color: "#7CFF6B", headline: "Doors at 8", note: "", noteColor: "#7CFF6B", bartenderColor: "#7CFF6B" },
  );
});

test("the note: one capped line in its own colour, which follows the text colour until picked", () => {
  assert.equal(cleanNote("  Happy hour\n till 9 ").length, "Happy hour till 9".length);
  assert.equal(cleanNote("x".repeat(NOTE_MAX + 5)).length, NOTE_MAX);
  const look = customLook(parseMenuState({ on: true, style: "custom", color: "#ffc93c", note: "Happy hour till 9", noteColor: "#3ce0ff" }));
  assert.deepEqual(look, { ...LOOK_DEFAULTS, color: "#FFC93C", headline: DEFAULT_HEADLINE, note: "Happy hour till 9", noteColor: "#3CE0FF", bartenderColor: "#FFC93C" });
  assert.equal(customLook(parseMenuState({ on: true, style: "custom", color: "#ffc93c", note: "Hi", noteColor: "blue" }))?.noteColor, "#FFC93C");
  // The standard menu never carries the note.
  assert.equal(customLook(parseMenuState({ on: true, note: "Hi" })), null);
});

test("fonts: the custom menu's font and the bartender's script are known ids, anything else is the default", () => {
  const picked = customLook(parseMenuState({ on: true, style: "custom", font: "playfair", bartenderFont: "pinyon" }));
  assert.equal(picked?.font, "playfair");
  assert.equal(picked?.bartenderFont, "pinyon");
  const junk = parseMenuState({ on: true, style: "custom", font: "comic-sans", bartenderFont: "<script>" });
  assert.equal(junk.font, "");
  assert.equal(junk.bartenderFont, "");
  assert.equal(customLook(junk)?.font, DEFAULT_MENU_FONT);
  assert.equal(customLook(junk)?.bartenderFont, DEFAULT_SCRIPT_FONT);
  // Ids are unique, the defaults are on the lists, and every font scales down (never up) to keep drinks in their columns.
  for (const list of [MENU_FONTS, SCRIPT_FONTS]) {
    assert.equal(new Set(list.map((font) => font.id)).size, list.length);
    for (const font of list) assert.ok(font.scale > 0 && font.scale <= 1, font.id);
  }
  assert.ok(isMenuFont(DEFAULT_MENU_FONT) && isScriptFont(DEFAULT_SCRIPT_FONT));
  assert.ok(!isMenuFont("greatvibes") && !isScriptFont("barlow"));
});

test("the bartender: one capped line, in the text colour until another is picked; the standard menu has none", () => {
  assert.equal(cleanBartender("  Jess \n & Sam "), "Jess & Sam");
  assert.equal(cleanBartender("x".repeat(BARTENDER_MAX + 9)).length, BARTENDER_MAX);
  const look = customLook(parseMenuState({ on: true, style: "custom", color: "#ffc93c", bartender: "Jess" }));
  assert.equal(look?.bartender, "Jess");
  assert.equal(look?.bartenderColor, "#FFC93C");
  assert.equal(customLook(parseMenuState({ on: true, style: "custom", bartender: "Jess", bartenderColor: "#ff6bd6" }))?.bartenderColor, "#FF6BD6");
  assert.equal(customLook(parseMenuState({ on: true, bartender: "Jess" })), null);
});
