import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HEADLINE, DEFAULT_MENU_COLOR, DRINK_MENU, HEADLINE_MAX, MARQUEE_MAX, MENU_COLORS, NOTE_MAX, BARTENDER_MAX, cleanBartender, cleanColor, cleanHeadline, cleanMarquee, cleanNote, customLook, parseMenuState,
} from "../src/lib/drink-menu.ts";
import {
  DEFAULT_MARQUEE, DEFAULT_MARQUEE_SPEED, MARQUEE_SPEEDS, MENU_WORDING, WORDING_KEYS, cleanWording, customWording, isMarqueeSpeed, liveMarquee, liveMarqueeLook, marqueeChange, marqueeSpeedOf, wordingChange,
} from "../src/lib/drink-menu.ts";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, MENU_FONTS, SCRIPT_FONTS, isMenuFont, isScriptFont } from "../src/lib/menu-fonts.ts";

/** The marquee's own settings and the custom wording, as a record that never set them reads. */
const MENU_EXTRAS = { marqueeOn: true, marqueeSpeed: "", marqueeColor: "", qrCaption: "", qrTitle: "", qrLink: "", bartenderLabel: "" };
const PRINTED_WORDING = { qrCaption: "SCAN TO SUBMIT", qrTitle: "YOUR BAD DECISIONS", qrLink: "pinsandneedlescomedy.com/bad-decisions", bartenderLabel: "Your bartender tonight" };
const LOOK_DEFAULTS = { font: DEFAULT_MENU_FONT, bartender: "", bartenderFont: DEFAULT_SCRIPT_FONT, ...PRINTED_WORDING };

test("the menu is on only when stored exactly as on", () => {
  assert.deepEqual(parseMenuState({ on: true }), { on: true, style: "standard", marquee: "", color: "", headline: "", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "", ...MENU_EXTRAS });
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
  assert.deepEqual(saved, { on: false, style: "custom", marquee: "", color: "#FF2E4D", headline: "Don't miss the 9 PM show", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "", ...MENU_EXTRAS });
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

test("the marquee runs as it always has until the host switches it off", () => {
  const before = parseMenuState({ on: true, marquee: "Tip your bartenders" });
  assert.equal(before.marqueeOn, true);
  assert.equal(liveMarquee(before), "Tip your bartenders");
  assert.equal(liveMarquee(parseMenuState({ on: true })), DEFAULT_MARQUEE);
  // Only false itself is off; junk keeps it running.
  for (const marqueeOn of [undefined, null, 0, "false", "off"]) assert.equal(parseMenuState({ on: true, marqueeOn }).marqueeOn, true);
  const off = parseMenuState({ on: true, marqueeOn: false, marquee: "Tip your bartenders" });
  assert.equal(liveMarquee(off), null);
  // The text is kept for when it comes back on, and nothing runs while the menu is down.
  assert.equal(off.marquee, "Tip your bartenders");
  assert.equal(liveMarquee(parseMenuState({ on: false, marquee: "Tip your bartenders" })), null);
});

test("marquee speed: named speeds only, Normal is today's 90", () => {
  assert.equal(DEFAULT_MARQUEE_SPEED, 90);
  assert.equal(marqueeSpeedOf(""), DEFAULT_MARQUEE_SPEED);
  assert.equal(MARQUEE_SPEEDS.find((speed) => speed.id === "")?.label, "Normal");
  assert.equal(new Set(MARQUEE_SPEEDS.map((speed) => speed.id)).size, MARQUEE_SPEEDS.length);
  // Slowest to fastest, never a standstill.
  for (let index = 1; index < MARQUEE_SPEEDS.length; index += 1) assert.ok(MARQUEE_SPEEDS[index].speed > MARQUEE_SPEEDS[index - 1].speed);
  assert.ok(MARQUEE_SPEEDS[0].speed > 0);
  for (const speed of MARQUEE_SPEEDS) {
    assert.ok(isMarqueeSpeed(speed.id));
    assert.equal(parseMenuState({ marqueeSpeed: speed.id }).marqueeSpeed, speed.id);
  }
  for (const junk of ["warp", 90, null, "FAST", undefined]) {
    assert.equal(isMarqueeSpeed(junk), false);
    assert.equal(parseMenuState({ marqueeSpeed: junk }).marqueeSpeed, "");
    assert.equal(marqueeSpeedOf(junk), DEFAULT_MARQUEE_SPEED);
  }
});

test("the live screen gets the marquee's speed and colour while a menu is up, and nothing otherwise", () => {
  assert.deepEqual(liveMarqueeLook(parseMenuState({ on: true })), { speed: DEFAULT_MARQUEE_SPEED, color: "" });
  assert.deepEqual(liveMarqueeLook(parseMenuState({ on: true, marqueeSpeed: "fast", marqueeColor: "#3ce0ff" })), { speed: 140, color: "#3CE0FF" });
  assert.equal(parseMenuState({ marqueeColor: "blue" }).marqueeColor, "");
  assert.equal(liveMarqueeLook(parseMenuState({ on: false, marqueeSpeed: "fast" })), null);
});

test("custom wording: the printed words until the host writes their own, each one capped line", () => {
  // The printed board's words are the fallbacks, and each fits its own limit.
  assert.deepEqual(Object.fromEntries(WORDING_KEYS.map((key) => [key, MENU_WORDING[key].fallback])), PRINTED_WORDING);
  for (const key of WORDING_KEYS) assert.ok(MENU_WORDING[key].fallback.length <= MENU_WORDING[key].max, key);
  assert.equal(cleanWording("qrCaption", "  Point  your\nphone "), "Point your phone");
  for (const key of WORDING_KEYS) assert.equal(cleanWording(key, "x".repeat(200)).length, MENU_WORDING[key].max);
  assert.equal(cleanWording("qrTitle", 7), "");
  // Saved and read back, then drawn with the printed words in every blank.
  const saved = parseMenuState({ on: true, style: "custom", qrTitle: "Tell us your worst idea", bartenderLabel: "  Pouring for you " });
  assert.equal(saved.qrTitle, "Tell us your worst idea");
  assert.equal(saved.bartenderLabel, "Pouring for you");
  const look = customLook(saved);
  assert.equal(look?.qrTitle, "Tell us your worst idea");
  assert.equal(look?.bartenderLabel, "Pouring for you");
  assert.equal(look?.qrCaption, PRINTED_WORDING.qrCaption);
  assert.equal(look?.qrLink, PRINTED_WORDING.qrLink);
  // A missing or blank line in the live answer (an older server, say) still draws the printed words.
  assert.deepEqual(customWording({}), PRINTED_WORDING);
  assert.deepEqual(customWording(null), PRINTED_WORDING);
  assert.deepEqual(customWording({ qrCaption: "  ", qrLink: 4 }), PRINTED_WORDING);
});

test("custom wording: a save changes only the lines it sends", () => {
  assert.deepEqual(wordingChange({ qrCaption: " Scan me ", headline: "ignored" }), { qrCaption: "Scan me" });
  // An empty line is sent as "", which puts the printed words back.
  assert.deepEqual(wordingChange({ qrLink: "", bartenderLabel: null }), { qrLink: "", bartenderLabel: "" });
  assert.deepEqual(wordingChange({}), {});
});

test("the marquee's one Save sends only the half that changed: the text, how it runs, or both", () => {
  const saved = { text: "Two for one tonight", on: true, speed: "", color: "" };
  assert.deepEqual(marqueeChange(saved, saved), {});
  // Typing that cleans to the saved text changes nothing, so nothing is sent.
  assert.deepEqual(marqueeChange(saved, { ...saved, text: "  Two  for one tonight " }), {});
  assert.deepEqual(marqueeChange(saved, { ...saved, text: "Last call at 11" }), { text: "Last call at 11" });
  // An emptied box is sent as "": the default text again.
  assert.deepEqual(marqueeChange(saved, { ...saved, text: "   " }), { text: "" });
  // The style goes whole, on its own, whichever part of it changed.
  assert.deepEqual(marqueeChange(saved, { ...saved, speed: "fast" }), { style: { on: true, speed: "fast", color: "" } });
  assert.deepEqual(marqueeChange(saved, { ...saved, on: false }), { style: { on: false, speed: "", color: "" } });
  // A colour in other capitals is the same colour.
  const coloured = { ...saved, color: "#3CE0FF" };
  assert.deepEqual(marqueeChange(coloured, { ...coloured, color: "#3ce0ff" }), {});
  assert.deepEqual(marqueeChange(coloured, { ...coloured, color: "" }), { style: { on: true, speed: "", color: "" } });
  // Both changed: both go, and the text goes as the server will keep it.
  assert.deepEqual(marqueeChange(saved, { text: " Happy hour ", on: true, speed: "slow", color: "#FFFFFF" }), {
    text: "Happy hour", style: { on: true, speed: "slow", color: "#FFFFFF" },
  });
  // Too long is capped, as the server caps it.
  assert.equal(marqueeChange(saved, { ...saved, text: "x".repeat(MARQUEE_MAX + 20) }).text?.length, MARQUEE_MAX);
});
