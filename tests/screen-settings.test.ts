import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEHAVIOUR_KEYS, COUNTDOWN_MAX, COUNTDOWN_MIN, DEFAULT_LOOK, DEFAULT_SCREEN, PRINTED_WORDS, QR_KEYS, SCREEN_TEXT, SCREEN_TEXT_GROUPS, SOUND_TEST_FRESH_MS, STING_URL_MAX,
  STING_VOLUME_MAX, STING_VOLUME_MIN, TEXT_KEYS, changedScreen, chosenSting, cleanScreenText, cleanStingUrl, freshSoundTest, markBadDecisions, parseScreenChange,
  parseScreenSettings, previewQr, screenChanges, screenLook, shownQr, soundUrl, standardMenuWords, stingName, type ScreenSettings,
} from "../src/lib/screen-settings.ts";
import { DECISIONS_QR_SRC, FORM_QR, adminQrPreviewSrc } from "../src/lib/screen-qr.ts";
import { EXAMPLE_QUESTION } from "../src/lib/explainer.ts";
import { DEFAULT_SOUND, QUESTION_SOUNDS } from "../src/lib/question-sounds.ts";

test("defaults are the screen as it has always been", () => {
  assert.deepEqual(DEFAULT_LOOK, {
    countdown: true, countdownFrom: 3, intro: true, introWord: "Incoming", sound: true,
    sting: DEFAULT_SOUND, stingVolume: 100, stingUrl: "", qrKind: "", qrTo: "", qrImage: "", qrSize: 100, timer: true, names: true,
    stageLabel: "Now on stage", namePrefix: "—",
    howHeading: "How it works", howStep1: "Scan the QR", howStep2: "Tell us your bad decision", howStep3: "A comedian weighs in, live",
    listenLine: "When you hear this…", exampleLabel: "Example", exampleQuestion: EXAMPLE_QUESTION,
    closingLine: "That sound means a bad decision just hit the screen.", closingCall: "Scan to send yours.", scanLabel: "Scan me",
    standardHeading: "MENU", standardQrCaption: "SCAN TO SUBMIT", standardQrTitle: "YOUR BAD DECISIONS", standardQrLink: "pinsandneedlescomedy.com/bad-decisions",
    soundOffPrompt: "Sound is off. Tap to turn it on", fullscreenEnter: "Full screen (F)", fullscreenExit: "Exit full screen",
  });
  for (const { fallback, max, label } of Object.values(SCREEN_TEXT)) {
    assert.ok(fallback.length <= max, fallback);
    assert.ok(label.trim(), fallback);
  }
});

test("every word on the screen has exactly one box in the Control Center", () => {
  const grouped = SCREEN_TEXT_GROUPS.flatMap((group) => group.keys);
  assert.deepEqual([...grouped].sort(), [...TEXT_KEYS].sort());
  assert.equal(new Set(grouped).size, grouped.length);
  assert.equal(new Set(SCREEN_TEXT_GROUPS.map((group) => group.id)).size, SCREEN_TEXT_GROUPS.length);
  for (const group of SCREEN_TEXT_GROUPS) assert.ok(group.title && group.when && group.keys.length, group.id);
});

test("words, the QR and the rest: every setting is in exactly one of the three", () => {
  const all = [...TEXT_KEYS, ...QR_KEYS, ...BEHAVIOUR_KEYS];
  assert.deepEqual([...all].sort(), Object.keys(DEFAULT_SCREEN).sort());
  assert.equal(new Set(all).size, all.length);
  assert.ok(BEHAVIOUR_KEYS.includes("sound") && !BEHAVIOUR_KEYS.includes("qrSize") && !BEHAVIOUR_KEYS.includes("introWord"));
});

test("nothing stored, or junk, reads as the defaults", () => {
  for (const raw of [null, undefined, "on", 42, [], {}]) assert.deepEqual(parseScreenSettings(raw), DEFAULT_SCREEN);
  const junk = parseScreenSettings({ countdown: "no", countdownFrom: 99, sound: 0, introWord: 7, names: null, sting: "kazoo", stingVolume: "loud", stingUrl: 5 });
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
  // Words drawn in capitals: the default in any capitals is the default.
  assert.equal(cleanScreenText("standardQrCaption", "scan to submit"), "");
  assert.equal(cleanScreenText("scanLabel", "SCAN ME"), "");
  // Words drawn as typed keep their capitals.
  assert.equal(cleanScreenText("namePrefix", "—"), "");
  assert.equal(cleanScreenText("standardQrLink", "PinsAndNeedlesComedy.com/bad-decisions"), "PinsAndNeedlesComedy.com/bad-decisions");
});

test("the new words are read, changed and stored like the old ones", () => {
  const saved = parseScreenSettings({ namePrefix: " ~ ", exampleLabel: "For instance", soundOffPrompt: "Tap for sound", standardHeading: "drinks", fullscreenExit: 4 });
  assert.equal(saved.namePrefix, "~");
  assert.equal(saved.exampleLabel, "For instance");
  assert.equal(saved.soundOffPrompt, "Tap for sound");
  assert.equal(saved.standardHeading, "drinks");
  assert.equal(saved.fullscreenExit, "");
  assert.deepEqual(parseScreenSettings(changedScreen(saved)), saved);
  assert.deepEqual(parseScreenChange({ scanLabel: "Point here", fullscreenEnter: "" }), { scanLabel: "Point here", fullscreenEnter: "" });
  assert.deepEqual(parseScreenChange({ standardQrTitle: "your bad decisions" }), { standardQrTitle: "" });
  assert.equal(screenLook({ namePrefix: "~" }).namePrefix, "~");
  assert.equal(screenLook({}).soundOffPrompt, "Sound is off. Tap to turn it on");
});

test("a change: known settings of the right type only, or nothing at all", () => {
  assert.deepEqual(parseScreenChange({ sound: false }), { sound: false });
  assert.deepEqual(parseScreenChange({ countdownFrom: 10, stageLabel: "  Give it up for " }), { countdownFrom: 10, stageLabel: "Give it up for" });
  assert.deepEqual(parseScreenChange({ howStep1: "Scan the QR" }), { howStep1: "" });
  assert.deepEqual(parseScreenChange(DEFAULT_SCREEN), DEFAULT_SCREEN);
  for (const raw of [
    null, "sound", [], {}, { sound: "off" }, { countdownFrom: 0 }, { countdownFrom: "3" }, { introWord: 5 }, { volume: 11 }, { sound: false, extra: 1 },
    { sting: "kazoo" }, { sting: null }, { stingVolume: 9 }, { stingVolume: 151 }, { stingVolume: 72.5 }, { stingVolume: "100" },
    { stingUrl: 7 }, { stingUrl: "javascript:alert(1)" }, { sting: "custom", stingUrl: "//elsewhere.example/horn.mp3" },
    { qrKind: "form" }, { qrKind: 1 }, { qrTo: "http://example.com" }, { qrTo: "javascript:alert(1)" }, { qrTo: 7 }, { qrImage: "//evil.example/a.png" },
    { qrImage: "data:image/png;base64,AAAA" }, { namePrefix: 3 },
  ]) {
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

test("the question sound starts as the default recording, as recorded", () => {
  assert.equal(DEFAULT_SCREEN.sting, DEFAULT_SOUND);
  assert.equal(DEFAULT_SCREEN.stingVolume, 100);
  assert.equal(DEFAULT_SCREEN.stingUrl, "");
  assert.equal(DEFAULT_SOUND, QUESTION_SOUNDS[0].id);
});

test("any built-in sound, or the host's own, is read back; anything else is the default", () => {
  for (const { id } of QUESTION_SOUNDS) assert.equal(parseScreenSettings({ sting: id }).sting, id);
  assert.equal(parseScreenSettings({ sting: "custom", stingUrl: "/uploads/abc.mp3" }).sting, "custom");
  for (const sting of ["kazoo", "", "OOH", 3, null, ["ooh"]]) assert.equal(parseScreenSettings({ sting }).sting, DEFAULT_SOUND, JSON.stringify(sting));
  // The synthesized stings are gone: a screen still set to one of them gets the default.
  for (const sting of ["doom", "air-horn", "siren", "soft-chime"]) assert.equal(parseScreenSettings({ sting }).sting, DEFAULT_SOUND, sting);
});

test("the volume is a whole percentage from 10 to 150", () => {
  for (const volume of [STING_VOLUME_MIN, 55, 100, STING_VOLUME_MAX]) assert.equal(parseScreenSettings({ stingVolume: volume }).stingVolume, volume);
  for (const volume of [0, 9, 151, 99.5, -100, "80", NaN, Infinity, null]) assert.equal(parseScreenSettings({ stingVolume: volume }).stingVolume, 100, String(volume));
});

test("the host's own sound is an address on this site or a secure one, and nothing else", () => {
  assert.equal(cleanStingUrl("/uploads/mf3k2a1b-x9y8z7-horn.mp3"), "/uploads/mf3k2a1b-x9y8z7-horn.mp3");
  assert.equal(cleanStingUrl(" /api/media/mf3k2a1b-x9y8z7-horn.m4a "), "/api/media/mf3k2a1b-x9y8z7-horn.m4a");
  assert.equal(cleanStingUrl("https://store.public.blob.vercel-storage.com/uploads/horn.mp3"), "https://store.public.blob.vercel-storage.com/uploads/horn.mp3");
  for (const raw of [
    "", "http://example.com/horn.mp3", "javascript:alert(1)", "data:audio/mp3;base64,AAAA", "//example.com/horn.mp3", "/\\example.com/horn.mp3",
    "uploads/horn.mp3", "/uploads/my horn.mp3", "https://", `/${"x".repeat(STING_URL_MAX)}`, 42, null, { url: "/a.mp3" },
  ]) {
    assert.equal(cleanStingUrl(raw), "", JSON.stringify(raw));
  }
  assert.equal(parseScreenSettings({ stingUrl: "ftp://example.com/horn.mp3" }).stingUrl, "");
});

test("a change to the sound: a known sound, a whole volume in range, and a safe address or none", () => {
  assert.deepEqual(parseScreenChange({ sting: "desk-bell", stingVolume: 80 }), { sting: "desk-bell", stingVolume: 80 });
  assert.equal(parseScreenChange({ sting: "air-horn" }), null, "a sound that no longer exists, and nothing else");
  // A Control Center opened before an update still sends its old sound with every save: the rest saves, the stored sound stays.
  assert.deepEqual(parseScreenChange({ sting: "doom", sound: false, stingVolume: 100 }), { sound: false, stingVolume: 100 });
  for (const sting of [3, null, ["ooh"], { id: "ooh" }]) assert.equal(parseScreenChange({ sting, sound: false }), null, JSON.stringify(sting));
  assert.deepEqual(parseScreenChange({ sting: "custom", stingUrl: " /uploads/a.mp3 " }), { sting: "custom", stingUrl: "/uploads/a.mp3" });
  assert.deepEqual(parseScreenChange({ stingUrl: "" }), { stingUrl: "" });
  assert.deepEqual(parseScreenChange({ stingUrl: "   " }), { stingUrl: "" });
});

test("only a changed sound is stored and sent, and it reads back the same", () => {
  const settings = parseScreenSettings({ sting: "custom", stingVolume: 130, stingUrl: "/uploads/a.mp3" });
  assert.deepEqual(changedScreen(settings), { sting: "custom", stingVolume: 130, stingUrl: "/uploads/a.mp3" });
  assert.deepEqual(parseScreenSettings(changedScreen(settings)), settings);
  assert.deepEqual(changedScreen({ ...DEFAULT_SCREEN, sting: DEFAULT_SOUND, stingVolume: 100 }), {});
  assert.deepEqual(screenLook({ sting: "wind-chimes", stingVolume: 40 }).sting, "wind-chimes");
});

test("the host's own sound with nothing uploaded plays the default, and each sound has a name to show", () => {
  assert.equal(chosenSting({ sting: "custom", stingUrl: "" }), DEFAULT_SOUND);
  assert.equal(chosenSting({ sting: "custom", stingUrl: "/uploads/a.mp3" }), "custom");
  assert.equal(chosenSting({ sting: "kalimba", stingUrl: "/uploads/a.mp3" }), "kalimba");
  for (const { id, label } of QUESTION_SOUNDS) assert.equal(stingName({ sting: id, stingUrl: "" }), label);
  assert.equal(stingName({ sting: "custom", stingUrl: "/uploads/mf3k2a1b-x9y8z7-my-horn.mp3" }), "my-horn.mp3");
  assert.equal(stingName({ sting: "custom", stingUrl: "" }), QUESTION_SOUNDS[0].label);
});

test("the file the screen fetches: the recording, the host's own upload, or the default with nothing uploaded", () => {
  assert.equal(soundUrl({ sting: "desk-bell", stingUrl: "/uploads/a.mp3" }), "/sounds/question/desk-bell.mp3");
  assert.equal(soundUrl({ sting: "custom", stingUrl: "/uploads/a.mp3" }), "/uploads/a.mp3");
  assert.equal(soundUrl({ sting: "custom", stingUrl: "" }), `/sounds/question/${DEFAULT_SOUND}.mp3`);
});

test("the QR size is a whole step of 10 from 50% to 200%; anything else reads as its usual size", () => {
  for (const size of [50, 100, 130, 200]) assert.equal(parseScreenSettings({ qrSize: size }).qrSize, size);
  for (const size of [0, 40, 45, 105, 210, 99.9, "120", null]) assert.equal(parseScreenSettings({ qrSize: size }).qrSize, 100, String(size));
  assert.deepEqual(parseScreenChange({ qrSize: 150 }), { qrSize: 150 });
  assert.equal(parseScreenChange({ qrSize: 155 }), null);
  assert.deepEqual(changedScreen({ ...DEFAULT_SCREEN, qrSize: 150 }), { qrSize: 150 });
});

test("the show screens' QR: the question form until the host picks their own link or picture, each kept while another is picked", () => {
  assert.equal(DEFAULT_SCREEN.qrKind, "");
  const link = parseScreenSettings({ qrKind: "link", qrTo: " https://www.instagram.com/pixelatedrecords/ ", qrImage: "/uploads/a.webp" });
  assert.equal(link.qrKind, "link");
  assert.equal(link.qrTo, "https://www.instagram.com/pixelatedrecords/");
  assert.equal(link.qrImage, "/uploads/a.webp");
  // Junk reads as the defaults.
  const junk = parseScreenSettings({ qrKind: "form", qrTo: "http://example.com", qrImage: "javascript:alert(1)" });
  assert.equal(junk.qrKind, "");
  assert.equal(junk.qrTo, "");
  assert.equal(junk.qrImage, "");
  // A change: a known choice, a clean https link (kept as the code will hold it), a picture address that can be used, or "" to clear.
  assert.deepEqual(parseScreenChange({ qrKind: "link", qrTo: "https://Example.com" }), { qrKind: "link", qrTo: "https://example.com/" });
  assert.deepEqual(parseScreenChange({ qrTo: "", qrImage: "" }), { qrTo: "", qrImage: "" });
  assert.deepEqual(parseScreenChange({ qrKind: "picture", qrImage: "/api/media/a.webp" }), { qrKind: "picture", qrImage: "/api/media/a.webp" });
  assert.deepEqual(changedScreen(parseScreenSettings({ qrKind: "picture", qrImage: "/uploads/a.webp" })), { qrKind: "picture", qrImage: "/uploads/a.webp" });
});

test("shownQr: what the show screens draw for each choice, falling back to the question form at the size picked", () => {
  const sign = (link: string) => `${DECISIONS_QR_SRC}?to=${encodeURIComponent(link)}&sig=${"b".repeat(32)}`;
  const base: Pick<ScreenSettings, "qrKind" | "qrTo" | "qrImage" | "qrSize"> = { qrKind: "", qrTo: "", qrImage: "", qrSize: 100 };
  assert.deepEqual(shownQr(base, sign), FORM_QR);
  assert.deepEqual(shownQr({ ...base, qrSize: 150 }, sign), { ...FORM_QR, size: 150 });
  const to = "https://example.com/menu";
  assert.deepEqual(shownQr({ ...base, qrKind: "link", qrTo: to }, sign), { kind: "link", src: sign(to), size: 100 });
  assert.deepEqual(shownQr({ ...base, qrKind: "picture", qrImage: "/uploads/a.webp", qrSize: 80 }, sign), { kind: "picture", src: "/uploads/a.webp", size: 80 });
  // A link nobody can sign (no secret), a link or picture that can't be used, an odd size: the question form, so the room can always send a question.
  assert.deepEqual(shownQr({ ...base, qrKind: "link", qrTo: to, qrSize: 130 }, () => null), { ...FORM_QR, size: 130 });
  assert.deepEqual(shownQr({ ...base, qrKind: "link", qrTo: "http://example.com" }, sign), FORM_QR);
  assert.deepEqual(shownQr({ ...base, qrKind: "link", qrTo: "" }, sign), FORM_QR);
  assert.deepEqual(shownQr({ ...base, qrKind: "picture", qrImage: "//evil.example/a.png" }, sign), FORM_QR);
  assert.deepEqual(shownQr({ ...base, qrSize: 105 }, sign), FORM_QR);
  // The Control Center's previews draw a link from the signed-in preview route.
  assert.equal(previewQr({ ...base, qrKind: "link", qrTo: to }).src, adminQrPreviewSrc(to));
});

test("the show-night menu's words: the printed ones with the question form, only the host's own under their link or picture", () => {
  assert.deepEqual(PRINTED_WORDS, { heading: "MENU", caption: "SCAN TO SUBMIT", title: "YOUR BAD DECISIONS", link: "pinsandneedlescomedy.com/bad-decisions" });
  assert.deepEqual(standardMenuWords(DEFAULT_SCREEN), PRINTED_WORDS);
  // screenLook's filled-in defaults count as the defaults.
  assert.deepEqual(standardMenuWords(DEFAULT_LOOK), PRINTED_WORDS);
  assert.deepEqual(standardMenuWords({ ...DEFAULT_SCREEN, standardQrTitle: "Tell us everything" }), { ...PRINTED_WORDS, title: "Tell us everything" });
  const link = { ...DEFAULT_SCREEN, qrKind: "link" as const, qrTo: "https://www.instagram.com/pixelatedrecords/" };
  assert.deepEqual(standardMenuWords(link), { heading: "MENU", caption: "", title: "", link: "instagram.com/pixelatedrecords" });
  assert.deepEqual(standardMenuWords(screenLook(link)), { heading: "MENU", caption: "", title: "", link: "instagram.com/pixelatedrecords" });
  assert.deepEqual(standardMenuWords({ ...link, standardQrCaption: "Follow us", standardQrLink: "@pixelated" }), { heading: "MENU", caption: "Follow us", title: "", link: "@pixelated" });
  // A link that can't be used draws the question form, so its printed words come back.
  assert.deepEqual(standardMenuWords({ ...link, qrTo: "" }), PRINTED_WORDS);
  assert.deepEqual(standardMenuWords({ ...DEFAULT_SCREEN, qrKind: "picture", qrImage: "/uploads/a.webp" }), { heading: "MENU", caption: "", title: "", link: "" });
  assert.equal(standardMenuWords({ ...DEFAULT_SCREEN, qrKind: "picture", qrImage: "/uploads/a.webp", standardHeading: "Drinks" }).heading, "Drinks");
});

test("each card sends only the settings it looks after that would change what is saved, never a default word", () => {
  const saved = parseScreenSettings({ sound: false, stageLabel: "Up next" });
  assert.deepEqual(screenChanges(saved, saved, [...TEXT_KEYS, ...QR_KEYS, ...BEHAVIOUR_KEYS]), {});
  // A word typed back to its default goes as "", in any capitals for words drawn in capitals.
  assert.deepEqual(screenChanges(saved, { ...saved, stageLabel: "now on stage" }, TEXT_KEYS), { stageLabel: "" });
  assert.deepEqual(screenChanges(saved, { ...saved, stageLabel: "UP NEXT" }, TEXT_KEYS), {});
  // Only the keys asked about: the words card never sends the sound switch, and the switches card never sends a word.
  const next = { ...saved, sound: true, introWord: "Uh oh", qrKind: "link" as const, qrTo: "https://example.com" };
  assert.deepEqual(screenChanges(saved, next, TEXT_KEYS), { introWord: "Uh oh" });
  assert.deepEqual(screenChanges(saved, next, BEHAVIOUR_KEYS), { sound: true });
  assert.deepEqual(screenChanges(saved, next, QR_KEYS), { qrKind: "link", qrTo: "https://example.com/" });
  // A link that can't be used goes as typed, so the server turns it away rather than it quietly going.
  assert.deepEqual(screenChanges(saved, { ...saved, qrTo: "http://example.com" }, QR_KEYS), { qrTo: "http://example.com" });
  assert.equal(parseScreenChange(screenChanges(saved, { ...saved, qrTo: "http://example.com" }, QR_KEYS)), null);
});
