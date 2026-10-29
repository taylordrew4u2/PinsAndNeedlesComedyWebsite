import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MENU_COLOR, DRINK_MENU, HEADLINE_MAX, MARQUEE_MAX, MENU_COLORS, NOTE_MAX, BARTENDER_MAX, cleanBartender, cleanColor, cleanHeadline, cleanMarquee, cleanNote, customLook, parseMenuState,
} from "../src/lib/drink-menu.ts";
import {
  DEFAULT_MARQUEE, DEFAULT_MARQUEE_SPEED, MARQUEE_SPEEDS, MENU_WORDING, WORDING_KEYS, cleanWording, customWording, isMarqueeSpeed, liveMarquee, liveMarqueeLook, marqueeChange, marqueeSpeedOf,
} from "../src/lib/drink-menu.ts";
import {
  CUSTOM_MENU_KEYS, DEFAULT_CUSTOM_MENU, NO_MENU_VIEW, ROTATE_FULL, ROTATE_SECTION, SAME_PRICE_JOIN, compactMenu, compactSection, customMenuChanges, customQrOf,
  customSettingsOf, isRotateFull, isRotateSection, menuView, parseCustomMenuChange, readCustomLook, readMenuView, rotateFullMs, rotateSectionMs, wordingToSave,
  type CustomMenuSettings, type DrinkSection, type MenuState,
} from "../src/lib/drink-menu.ts";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, MENU_FONTS, SCRIPT_FONTS, isMenuFont, isScriptFont } from "../src/lib/menu-fonts.ts";
import { DECISIONS_QR_SRC, adminQrPreviewSrc } from "../src/lib/screen-qr.ts";
import { PRINTED_WORDS } from "../src/lib/screen-settings.ts";

/** The settings a record that never set them reads as: the marquee as it always ran, no QR, rotation on, no daytime marquee, one price's drinks on one line. */
const MENU_EXTRAS = {
  marqueeOn: true, marqueeSpeed: "", marqueeColor: "",
  qrKind: "", qrTo: "", qrImage: "", qrSize: 100, rotateOn: true, rotateFull: "", rotateSection: "", customMarquee: "", samePriceLine: true,
  heading: "", qrCaption: "", qrTitle: "", qrLink: "", bartenderLabel: "",
};
/** The custom menu's wording with nothing written: MENU under the logo, nothing under a QR, the usual label over the bartender. */
const DAYTIME_WORDING = { heading: "MENU", qrCaption: "", qrTitle: "", qrLink: "", bartenderLabel: "Your bartender tonight" };
const LOOK_DEFAULTS = { font: DEFAULT_MENU_FONT, bartender: "", bartenderFont: DEFAULT_SCRIPT_FONT, qr: null, rotate: { fullMs: 30_000, sectionMs: 8_000 }, ...DAYTIME_WORDING };
/** The live screen's signer, standing in for the real one: any clean link gets a made-up signature. */
const sign = (link: string) => `${DECISIONS_QR_SRC}?to=${encodeURIComponent(link)}&sig=${"a".repeat(32)}`;
/** The custom menu's look as the live screen gets it. */
const lookOf = (raw: unknown) => customLook(parseMenuState(raw), sign);

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

test("the line above the QR is one trimmed, capped line, and none until the host writes one", () => {
  assert.equal(cleanHeadline("x".repeat(HEADLINE_MAX + 10)).length, HEADLINE_MAX);
  assert.equal(parseMenuState({ style: "custom" }).headline, "");
});

test("customLook: the daytime menu's defaults carry nothing from the show, and the standard menu has none", () => {
  assert.equal(lookOf({ on: true }), null);
  const plain = lookOf({ on: true, style: "custom" });
  assert.deepEqual(plain, { ...LOOK_DEFAULTS, color: DEFAULT_MENU_COLOR, headline: "", note: "", noteColor: DEFAULT_MENU_COLOR, bartenderColor: DEFAULT_MENU_COLOR });
  // No QR, no 9 PM line, no Bad Decisions wording anywhere in it.
  assert.doesNotMatch(JSON.stringify(plain), /bad.decision|9 PM|scan to submit|pinsandneedles/i);
  assert.deepEqual(
    lookOf({ on: true, style: "custom", color: "#7cff6b", headline: "Doors at 8" }),
    { ...LOOK_DEFAULTS, color: "#7CFF6B", headline: "Doors at 8", note: "", noteColor: "#7CFF6B", bartenderColor: "#7CFF6B" },
  );
});

test("the note: one capped line in its own colour, which follows the text colour until picked", () => {
  assert.equal(cleanNote("  Happy hour\n till 9 ").length, "Happy hour till 9".length);
  assert.equal(cleanNote("x".repeat(NOTE_MAX + 5)).length, NOTE_MAX);
  const look = lookOf({ on: true, style: "custom", color: "#ffc93c", note: "Happy hour till 9", noteColor: "#3ce0ff" });
  assert.deepEqual(look, { ...LOOK_DEFAULTS, color: "#FFC93C", headline: "", note: "Happy hour till 9", noteColor: "#3CE0FF", bartenderColor: "#FFC93C" });
  assert.equal(lookOf({ on: true, style: "custom", color: "#ffc93c", note: "Hi", noteColor: "blue" })?.noteColor, "#FFC93C");
  // The standard menu never carries the note.
  assert.equal(lookOf({ on: true, note: "Hi" }), null);
});

test("fonts: the custom menu's font and the bartender's script are known ids, anything else is the default", () => {
  const picked = lookOf({ on: true, style: "custom", font: "playfair", bartenderFont: "pinyon" });
  assert.equal(picked?.font, "playfair");
  assert.equal(picked?.bartenderFont, "pinyon");
  const junk = parseMenuState({ on: true, style: "custom", font: "comic-sans", bartenderFont: "<script>" });
  assert.equal(junk.font, "");
  assert.equal(junk.bartenderFont, "");
  assert.equal(customLook(junk, sign)?.font, DEFAULT_MENU_FONT);
  assert.equal(customLook(junk, sign)?.bartenderFont, DEFAULT_SCRIPT_FONT);
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
  const look = lookOf({ on: true, style: "custom", color: "#ffc93c", bartender: "Jess" });
  assert.equal(look?.bartender, "Jess");
  assert.equal(look?.bartenderColor, "#FFC93C");
  assert.equal(lookOf({ on: true, style: "custom", bartender: "Jess", bartenderColor: "#ff6bd6" })?.bartenderColor, "#FF6BD6");
  assert.equal(lookOf({ on: true, bartender: "Jess" }), null);
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

test("custom wording: nothing from the show until the host writes their own, each one capped line", () => {
  // The defaults: MENU, nothing under a QR, the usual bartender label; each fits its own limit and has an example for its box.
  assert.deepEqual(Object.fromEntries(WORDING_KEYS.map((key) => [key, MENU_WORDING[key].fallback])), DAYTIME_WORDING);
  for (const key of WORDING_KEYS) {
    assert.ok(MENU_WORDING[key].fallback.length <= MENU_WORDING[key].max, key);
    assert.ok(MENU_WORDING[key].placeholder, key);
  }
  // The show-night menu's printed words live with the show screens' words now.
  assert.deepEqual(PRINTED_WORDS, { heading: "MENU", caption: "SCAN TO SUBMIT", title: "YOUR BAD DECISIONS", link: "pinsandneedlescomedy.com/bad-decisions" });
  assert.equal(cleanWording("qrCaption", "  Point  your\nphone "), "Point your phone");
  for (const key of WORDING_KEYS) assert.equal(cleanWording(key, "x".repeat(200)).length, MENU_WORDING[key].max);
  assert.equal(cleanWording("qrTitle", 7), "");
  // Saved and read back, then drawn with the defaults in every blank.
  const saved = parseMenuState({ on: true, style: "custom", heading: "Drinks", qrTitle: "Tell us your worst idea", bartenderLabel: "  Pouring for you " });
  assert.equal(saved.qrTitle, "Tell us your worst idea");
  assert.equal(saved.bartenderLabel, "Pouring for you");
  const look = customLook(saved, sign);
  assert.equal(look?.heading, "Drinks");
  assert.equal(look?.qrTitle, "Tell us your worst idea");
  assert.equal(look?.bartenderLabel, "Pouring for you");
  assert.equal(look?.qrCaption, "");
  assert.equal(look?.qrLink, "");
  // A missing or blank line in the live answer (an older server, say) still draws.
  assert.deepEqual(customWording({}), DAYTIME_WORDING);
  assert.deepEqual(customWording(null), DAYTIME_WORDING);
  assert.deepEqual(customWording({ qrCaption: "  ", qrLink: 4 }), DAYTIME_WORDING);
  // Under a code for the host's link, the web address is that link, shortened, until they write their own.
  assert.equal(customWording({}, "https://www.instagram.com/pixelatedrecords/").qrLink, "instagram.com/pixelatedrecords");
  assert.equal(customWording({ qrLink: "Follow us" }, "https://www.instagram.com/pixelatedrecords/").qrLink, "Follow us");
});

test("custom wording as saved: the default in any capitals is kept as empty, so it keeps following the default", () => {
  assert.equal(wordingToSave("heading", "menu"), "");
  assert.equal(wordingToSave("heading", " Drinks "), "Drinks");
  assert.equal(wordingToSave("bartenderLabel", "YOUR BARTENDER TONIGHT"), "");
  // The web address is drawn as typed, and has no default to match.
  assert.equal(wordingToSave("qrLink", "Insta.com/Bar"), "Insta.com/Bar");
});

test("the marquee's one Save sends only the part that changed: the text, how it runs, the daytime menu's text, or several", () => {
  const saved = { text: "Two for one tonight", on: true, speed: "", color: "", custom: "" };
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
  assert.deepEqual(marqueeChange(saved, { text: " Happy hour ", on: true, speed: "slow", color: "#FFFFFF", custom: "" }), {
    text: "Happy hour", style: { on: true, speed: "slow", color: "#FFFFFF" },
  });
  // The daytime menu's own text goes on its own, cleaned, and an emptied box is sent as "" (no marquee on that menu).
  assert.deepEqual(marqueeChange(saved, { ...saved, custom: "  Open till 6 " }), { custom: "Open till 6" });
  assert.deepEqual(marqueeChange({ ...saved, custom: "Open till 6" }, { ...saved, custom: " " }), { custom: "" });
  // Too long is capped, as the server caps it.
  assert.equal(marqueeChange(saved, { ...saved, text: "x".repeat(MARQUEE_MAX + 20) }).text?.length, MARQUEE_MAX);
});

test("the custom menu has no QR until the host picks one; an old qrOff switch is ignored either way", () => {
  assert.equal(parseMenuState({ style: "custom" }).qrKind, "");
  for (const qrOff of [true, false, "true", 1, null]) {
    const state = parseMenuState({ style: "custom", qrOff });
    assert.ok(!("qrOff" in state), String(qrOff));
    assert.equal(lookOf({ on: true, style: "custom", qrOff })?.qr, null, String(qrOff));
  }
});

test("the daytime (custom) menu runs only its own marquee, and none until the host writes one", () => {
  // The shared marquee's default is show branding, so it never runs on the daytime menu.
  assert.equal(liveMarquee(parseMenuState({ on: true, style: "custom" })), null);
  assert.equal(liveMarquee(parseMenuState({ on: true, style: "custom", marquee: "Comedy tonight at 9" })), null);
  assert.equal(liveMarquee(parseMenuState({ on: true, style: "custom", customMarquee: "  Open till 6 " })), "Open till 6");
  // The standard menu keeps the shared text, whatever the daytime one says.
  assert.equal(liveMarquee(parseMenuState({ on: true, customMarquee: "Open till 6" })), DEFAULT_MARQUEE);
  // Switched off, or no menu up: nothing on either.
  assert.equal(liveMarquee(parseMenuState({ on: true, style: "custom", customMarquee: "Open till 6", marqueeOn: false })), null);
  assert.equal(liveMarquee(parseMenuState({ on: false, style: "custom", customMarquee: "Open till 6" })), null);
});

test("rotation: on unless switched off exactly, with named times only", () => {
  assert.equal(parseMenuState({}).rotateOn, true);
  assert.equal(parseMenuState({ rotateOn: false }).rotateOn, false);
  for (const rotateOn of [null, 0, "false"]) assert.equal(parseMenuState({ rotateOn }).rotateOn, true, String(rotateOn));
  // The defaults ("") are 30 seconds for the full board and 8 for each section page.
  assert.equal(rotateFullMs(""), 30_000);
  assert.equal(rotateSectionMs(""), 8_000);
  for (const table of [ROTATE_FULL, ROTATE_SECTION]) {
    assert.equal(new Set(table.map((entry) => entry.id)).size, table.length);
    assert.equal(new Set(table.map((entry) => entry.ms)).size, table.length);
  }
  for (const { id, ms } of ROTATE_FULL) {
    assert.ok(isRotateFull(id));
    assert.equal(rotateFullMs(id), ms);
    assert.equal(parseMenuState({ rotateFull: id }).rotateFull, id);
  }
  for (const { id, ms } of ROTATE_SECTION) {
    assert.ok(isRotateSection(id));
    assert.equal(rotateSectionMs(id), ms);
  }
  for (const junk of ["forever", 30_000, null, "LONG"]) {
    assert.equal(isRotateFull(junk), false);
    assert.equal(rotateFullMs(junk), 30_000);
    assert.equal(rotateSectionMs(junk), 8_000);
    assert.equal(parseMenuState({ rotateFull: junk, rotateSection: junk }).rotateFull, "");
  }
  // The look carries the times while it rotates, and null when it is switched off.
  assert.deepEqual(lookOf({ on: true, style: "custom", rotateFull: "long", rotateSection: "short" })?.rotate, { fullMs: 60_000, sectionMs: 5_000 });
  assert.equal(lookOf({ on: true, style: "custom", rotateOn: false })?.rotate, null);
});

test("the custom menu's own QR: none, a code for the host's link (as the signer gives it), or their picture", () => {
  const base = { qrKind: "", qrTo: "", qrImage: "", qrSize: 100 } as const;
  assert.equal(customQrOf(base, sign), null);
  const link = "https://www.instagram.com/pixelatedrecords/";
  assert.deepEqual(customQrOf({ ...base, qrKind: "link", qrTo: link, qrSize: 130 }, sign), { kind: "link", src: sign(link), size: 130 });
  // The Control Center's preview draws the same link from the signed-in preview route.
  assert.equal(customQrOf({ ...base, qrKind: "link", qrTo: link }, adminQrPreviewSrc)?.src, adminQrPreviewSrc(link));
  // A link that can't be signed (no secret) or isn't clean, or a picture that can't be used: no QR at all, never the question form.
  assert.equal(customQrOf({ ...base, qrKind: "link", qrTo: link }, () => null), null);
  assert.equal(customQrOf({ ...base, qrKind: "link", qrTo: "http://example.com" }, sign), null);
  assert.equal(customQrOf({ ...base, qrKind: "picture", qrImage: "/uploads/logo.webp" }, sign)?.src, "/uploads/logo.webp");
  assert.equal(customQrOf({ ...base, qrKind: "picture", qrImage: "javascript:alert(1)" }, sign), null);
  // An odd size reads as the usual one.
  assert.equal(customQrOf({ ...base, qrKind: "picture", qrImage: "/uploads/logo.webp", qrSize: 105 }, sign)?.size, 100);
  // The link's code brings the shortened link as the web address under it; a picture brings none.
  const look = lookOf({ on: true, style: "custom", qrKind: "link", qrTo: link });
  assert.equal(look?.qr?.kind, "link");
  assert.equal(look?.qrLink, "instagram.com/pixelatedrecords");
  assert.equal(lookOf({ on: true, style: "custom", qrKind: "picture", qrImage: "/uploads/logo.webp" })?.qrLink, "");
  // The picked link and picture are kept while "No QR code" is picked, so picking them again brings them back.
  const kept = parseMenuState({ style: "custom", qrKind: "", qrTo: link, qrImage: "/uploads/logo.webp" });
  assert.equal(kept.qrTo, link);
  assert.equal(kept.qrImage, "/uploads/logo.webp");
  assert.equal(customLook(kept, sign)?.qr, null);
});

test("the live screen reads the custom look carefully: an older server's draws with no QR and no rotation, and junk is no custom menu", () => {
  const sent = JSON.parse(JSON.stringify(lookOf({ on: true, style: "custom", color: "#7cff6b", qrKind: "link", qrTo: "https://example.com/x", rotateFull: "long" })));
  assert.deepEqual(readCustomLook(sent), lookOf({ on: true, style: "custom", color: "#7cff6b", qrKind: "link", qrTo: "https://example.com/x", rotateFull: "long" }));
  // What servers sent before: colour, headline and the printed wording, no QR choice or rotation.
  const old = readCustomLook({ color: "#FF2E4D", headline: "Don't miss the 9 PM show", note: "", qrCaption: "SCAN TO SUBMIT" });
  assert.ok(old);
  assert.equal(old.qr, null);
  assert.equal(old.rotate, null);
  assert.equal(old.heading, "MENU");
  // A code from anywhere but the live screen's own route, or the question form itself, is no QR.
  for (const qr of [
    { kind: "link", src: "//evil.example/qr" }, { kind: "link", src: "https://x/api/decisions/live/qr" }, { kind: "link", src: `${DECISIONS_QR_SRC}?to=a//b` },
    { kind: "form", src: DECISIONS_QR_SRC }, { kind: "picture", src: "javascript:alert(1)" }, { kind: "link", src: 7 }, "qr",
  ]) {
    assert.equal(readCustomLook({ ...sent, qr })?.qr, null, JSON.stringify(qr));
  }
  // Times that aren't from the tables don't rotate.
  assert.equal(readCustomLook({ ...sent, rotate: { fullMs: 1, sectionMs: 8_000 } })?.rotate, null);
  for (const junk of [null, "custom", {}, { color: "#FFF" }, { headline: "x" }, { color: 1, headline: "x" }]) assert.equal(readCustomLook(junk), null, JSON.stringify(junk));
});

test("a custom menu change: any of its settings, each checked, at least one known; plain words for what can't be saved", () => {
  assert.deepEqual(parseCustomMenuChange({ bartender: "  Jess " }), { change: { bartender: "Jess" } });
  assert.deepEqual(parseCustomMenuChange({ color: "#ffc93c", rotateOn: false, qrKind: "link", qrTo: "instagram.com/bar".replace(/^/, "https://"), unknown: 1 }), {
    change: { color: "#FFC93C", qrKind: "link", qrTo: "https://instagram.com/bar", rotateOn: false },
  });
  // "" clears a link or picture.
  assert.deepEqual(parseCustomMenuChange({ qrTo: "", qrImage: " " }), { change: { qrTo: "", qrImage: "" } });
  // An older Control Center's whole look (headline and colour included, its old switch too) still saves.
  const old = parseCustomMenuChange({ color: "", headline: "Doors at 8", note: "", font: "", qrOff: true, qrCaption: "SCAN TO SUBMIT" });
  assert.ok("change" in old);
  assert.deepEqual(old.change, { color: "", headline: "Doors at 8", note: "", font: "", qrCaption: "SCAN TO SUBMIT" });
  // Plain words, never a code.
  const errors: unknown[] = [
    null, [], {}, { unknown: 1 }, { qrOff: true }, { color: "red" }, { color: 7 }, { font: "comic-sans" }, { qrKind: "form" }, { qrTo: "http://example.com" },
    { qrTo: "javascript:alert(1)" }, { qrImage: "//evil.example/a.png" }, { qrSize: 105 }, { qrSize: "100" }, { rotateOn: "no" }, { rotateFull: "forever" }, { heading: 9 },
  ];
  for (const raw of errors) {
    const parsed = parseCustomMenuChange(raw);
    assert.ok("error" in parsed && parsed.error.length > 10 && !/invalid/i.test(parsed.error), JSON.stringify(raw));
  }
  const http = parseCustomMenuChange({ qrTo: "http://example.com" });
  assert.ok("error" in http && http.error.includes("https://"));
  // Every setting the card edits is one the server takes.
  assert.deepEqual([...CUSTOM_MENU_KEYS].sort(), (Object.keys(DEFAULT_CUSTOM_MENU) as (keyof CustomMenuSettings)[]).sort());
});

test("what the custom card's Save sends: only what would change what is saved, each as it would be saved", () => {
  const saved = customSettingsOf(menuView(parseMenuState({ style: "custom", bartender: "Jess", heading: "Drinks", qrLink: "Insta" })));
  assert.deepEqual(customMenuChanges(saved, saved), {});
  // Words the board draws in capitals compare in any case; the name, the web address and the link as typed.
  assert.deepEqual(customMenuChanges(saved, { ...saved, heading: "DRINKS" }), {});
  assert.deepEqual(customMenuChanges(saved, { ...saved, bartender: "jess" }), { bartender: "jess" });
  assert.deepEqual(customMenuChanges(saved, { ...saved, qrLink: "INSTA" }), { qrLink: "INSTA" });
  // A default typed back in is sent as "", and the brand red as no colour.
  assert.deepEqual(customMenuChanges(saved, { ...saved, heading: "menu" }), { heading: "" });
  assert.deepEqual(customMenuChanges(saved, { ...saved, color: DEFAULT_MENU_COLOR.toLowerCase() }), {});
  // A link that can't be used goes as typed, so the server says what is wrong.
  assert.deepEqual(customMenuChanges(saved, { ...saved, qrKind: "link", qrTo: "http://bar.example" }), { qrKind: "link", qrTo: "http://bar.example" });
  assert.deepEqual(customMenuChanges(saved, { ...saved, rotateOn: false, rotateSection: "long" }), { rotateOn: false, rotateSection: "long" });
  // Back to the defaults: every changed setting, and nothing else.
  assert.deepEqual(customMenuChanges(saved, DEFAULT_CUSTOM_MENU), { bartender: "", heading: "", qrLink: "" });
});

test("the Control Center's view of the menu: every setting, read back field by field, an older server's gaps kept as they were", () => {
  const state: MenuState = parseMenuState({
    on: true, style: "custom", bartender: "Jess", qrKind: "picture", qrImage: "/uploads/a.webp", qrSize: 150, rotateOn: false, rotateFull: "long",
    customMarquee: "Open till 6", samePriceLine: false, heading: "Drinks",
  });
  const view = menuView(state);
  assert.equal(view.menuQrKind, "picture");
  assert.equal(view.menuQrSize, 150);
  assert.equal(view.marqueeCustom, "Open till 6");
  assert.equal(view.menuSamePriceLine, false);
  assert.deepEqual(readMenuView(JSON.parse(JSON.stringify(view)), NO_MENU_VIEW), view);
  // The custom card's settings come out of it as saved.
  const settings = customSettingsOf(view);
  assert.equal(settings.bartender, "Jess");
  assert.equal(settings.rotateFull, "long");
  assert.equal(settings.customMarquee, "Open till 6");
  // An answer from before these fields (a rollback) keeps what the page had; junk in a field does too.
  const older = readMenuView({ menu: false, menuStyle: "standard", marquee: "Hi" }, view);
  assert.equal(older.menu, false);
  assert.equal(older.marquee, "Hi");
  assert.equal(older.menuQrKind, "picture");
  assert.equal(older.menuSamePriceLine, false);
  assert.equal(readMenuView({ menuQrSize: 105, menuQrKind: "form", menuRotateFull: "forever" }, view).menuQrSize, 150);
  assert.deepEqual(readMenuView(null, NO_MENU_VIEW), NO_MENU_VIEW);
  // Nothing saved: no menu up, no QR, rotation on, drinks of one price on one line.
  assert.equal(NO_MENU_VIEW.menu, false);
  assert.equal(NO_MENU_VIEW.menuQrKind, "");
  assert.equal(NO_MENU_VIEW.menuRotateOn, true);
  assert.equal(NO_MENU_VIEW.menuSamePriceLine, true);
});

test("one line for one price: drinks with no detail line that cost the same share a line, where the first of them sits", () => {
  const section: DrinkSection = {
    id: "c", title: "Classic Cocktails",
    drinks: [
      { id: "1", name: "Margarita", price: "$12", detail: "Flavored +$1" },
      { id: "2", name: "Gimlet", price: "$12" },
      { id: "3", name: "Paloma", price: "$13" },
      { id: "4", name: "Mojito", price: "$12" },
      { id: "5", name: "Negroni", price: "$13" },
      { id: "6", name: "House pour" },
      { id: "7", name: "Sidecar", price: "$15" },
    ],
  };
  const compact = compactSection(section);
  assert.deepEqual(compact.drinks, [
    { id: "1", name: "Margarita", price: "$12", detail: "Flavored +$1" },
    { id: "2", name: `Gimlet${SAME_PRICE_JOIN}Mojito`, price: "$12", names: ["Gimlet", "Mojito"] },
    { id: "3", name: `Paloma${SAME_PRICE_JOIN}Negroni`, price: "$13", names: ["Paloma", "Negroni"] },
    { id: "6", name: "House pour" },
    { id: "7", name: "Sidecar", price: "$15" },
  ]);
  assert.equal(SAME_PRICE_JOIN, " · ");
  // The section's own title and id stay; the list it came from is left alone.
  assert.equal(compact.title, "Classic Cocktails");
  assert.equal(section.drinks.length, 7);
  // Nothing to join, a section with one shared price, or one listed without prices: the same section back.
  const lone: DrinkSection = { title: "Red", drinks: [{ name: "A", price: "$8", detail: "x" }, { name: "B", price: "$8", detail: "y" }] };
  assert.equal(compactSection(lone), lone);
  const shared: DrinkSection = { title: "Highballs", price: "$11", drinks: [{ name: "A" }, { name: "B" }] };
  assert.equal(compactSection(shared), shared);
  const noPrices: DrinkSection = { title: "Specials", shared: true, drinks: [{ name: "A", price: "$5" }, { name: "B", price: "$5" }] };
  assert.equal(compactSection(noPrices), noPrices);
  // Already joined (a board sent through twice) joins no further.
  assert.deepEqual(compactSection(compact), compact);
  // A whole board, section by section.
  assert.deepEqual(compactMenu([[section], [lone], []]), [[compact], [lone], []]);
});
