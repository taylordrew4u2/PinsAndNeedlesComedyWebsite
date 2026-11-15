import { EXAMPLE_QUESTION } from "./explainer.ts";
import { DEFAULT_SOUND, QUESTION_SOUNDS, isSoundId, soundFile, type SoundId } from "./question-sounds.ts";
import { uploadedFileName } from "./audio-upload.ts";
import {
  ASSET_URL_MAX, DECISIONS_QR_SRC, DEFAULT_QR_SIZE, adminQrPreviewSrc, cleanAssetUrl, cleanQrLink, isQrKind, isQrSize, linkLabel,
  type QrKind, type ShownQr,
} from "./screen-qr.ts";
import type { BoardWords } from "./drink-menu.ts";

export { QR_SIZE_MAX, QR_SIZE_MIN } from "./screen-qr.ts";

/** The sound with a new question: one of the built-in recordings, or "custom", the host's own uploaded file. */
export type QuestionSound = SoundId | "custom";

/**
 * How the live screen behaves and what its fixed words say, as the host sets
 * them in the Control Center. Every setting starts at what the screen did
 * before it could be changed, so nothing on screen moves until the host
 * changes something. Words are kept as "" while they are the default, so
 * they keep following it.
 */
export type ScreenSettings = {
  /** A silent countdown before a newly picked question, and the number it starts from. */
  countdown: boolean;
  countdownFrom: number;
  /** The drum roll before a new question (red flashes, the dice, a word blinking under it), and that word. */
  intro: boolean;
  introWord: string;
  /** The question sound on the projector. Off mutes it everywhere: new questions, the Intro explainer, the sound test. */
  sound: boolean;
  /**
   * Which sound that is, how loud (a percentage, 100 being the recording as levelled),
   * and the host's own file when they picked "custom" ("" until one is
   * uploaded). One choice for all three places it plays, so the sound test
   * and the Intro teach the room the sound it will really hear.
   */
  sting: QuestionSound;
  stingVolume: number;
  stingUrl: string;
  /**
   * The QR on the show screens (the live screen's corner, the standard drink
   * menu and the Intro): where it leads ("" the Bad Decisions question form,
   * as it always has; "link" a code for the host's own link, `qrTo`;
   * "picture" the host's own picture, `qrImage`), and how big it is, as a
   * percentage of its usual size. The link and picture are kept while
   * another choice is picked, so picking them again brings them back.
   */
  qrKind: QrKind;
  qrTo: string;
  qrImage: string;
  qrSize: number;
  /** The set clock along the bottom while a timed set runs. */
  timer: boolean;
  /** The sender's name under their question. */
  names: boolean;
  /** The line above a performer's name when their set starts, and the mark before a sender's name under their question. */
  stageLabel: string;
  namePrefix: string;
  /** The "Intro" explainer's words: its heading and three steps, the line before the sound, the example and its tag, the two closing lines, and the words under its QR. */
  howHeading: string;
  howStep1: string;
  howStep2: string;
  howStep3: string;
  listenLine: string;
  exampleLabel: string;
  exampleQuestion: string;
  closingLine: string;
  closingCall: string;
  scanLabel: string;
  /** The standard (show-night) drink menu's left panel: the heading under the logo and the three lines under the QR. */
  standardHeading: string;
  standardQrCaption: string;
  standardQrTitle: string;
  standardQrLink: string;
  /** The TV's own buttons, only seen by whoever is at the TV laptop: the red one while its sound is off, and full screen in and out. */
  soundOffPrompt: string;
  fullscreenEnter: string;
  fullscreenExit: string;
};

export type ScreenText =
  | "introWord" | "stageLabel" | "namePrefix"
  | "howHeading" | "howStep1" | "howStep2" | "howStep3" | "listenLine" | "exampleLabel" | "exampleQuestion" | "closingLine" | "closingCall" | "scanLabel"
  | "standardHeading" | "standardQrCaption" | "standardQrTitle" | "standardQrLink"
  | "soundOffPrompt" | "fullscreenEnter" | "fullscreenExit";
export type ScreenSwitch = "countdown" | "intro" | "sound" | "timer" | "names";

/**
 * Each piece of wording: what it says until the host writes their own, and
 * the longest the screen's layout takes without spilling off the projector
 * (measured against each one's size on a 16:9 screen). `label` and `hint`
 * are the Control Center's words for its box; `caps` means the screen draws
 * it in capitals, so its case doesn't matter.
 */
export const SCREEN_TEXT: Record<ScreenText, { fallback: string; max: number; label: string; hint?: string; caps?: boolean }> = {
  introWord: { fallback: "Incoming", max: 16, label: "Word under the dice", caps: true },
  stageLabel: { fallback: "Now on stage", max: 30, label: "Above a performer’s name when their set starts", caps: true },
  namePrefix: { fallback: "—", max: 12, label: "Mark before the sender’s name", hint: "Empty brings back the dash." },
  howHeading: { fallback: "How it works", max: 28, label: "Heading", caps: true },
  howStep1: { fallback: "Scan the QR", max: 40, label: "Step 1", caps: true },
  howStep2: { fallback: "Tell us your bad decision", max: 40, label: "Step 2", caps: true },
  howStep3: { fallback: "A comedian weighs in, live", max: 40, label: "Step 3", caps: true },
  listenLine: { fallback: "When you hear this…", max: 40, label: "Just before the sound", caps: true },
  exampleLabel: { fallback: "Example", max: 30, label: "Tag over the example question", caps: true },
  exampleQuestion: { fallback: EXAMPLE_QUESTION, max: 120, label: "Example question" },
  closingLine: { fallback: "That sound means a bad decision just hit the screen.", max: 100, label: "After the example", hint: "“Bad decision” shows in red wherever you put it.", caps: true },
  closingCall: { fallback: "Scan to send yours.", max: 40, label: "Last line, beside the QR code", caps: true },
  scanLabel: { fallback: "Scan me", max: 16, label: "Under the QR code", caps: true },
  standardHeading: { fallback: "MENU", max: 9, label: "Heading under the logo", caps: true },
  standardQrCaption: { fallback: "SCAN TO SUBMIT", max: 28, label: "Small line under the QR code", caps: true },
  standardQrTitle: { fallback: "YOUR BAD DECISIONS", max: 28, label: "Big line under the QR code", caps: true },
  standardQrLink: { fallback: "pinsandneedlescomedy.com/bad-decisions", max: 48, label: "Web address under the QR code", hint: "With your own link on the QR, empty shows that link, shortened." },
  soundOffPrompt: { fallback: "Sound is off. Tap to turn it on", max: 40, label: "Red button while the TV’s sound is off", hint: "Any tap on the TV turns sound on, so keep that in the words." },
  fullscreenEnter: { fallback: "Full screen (F)", max: 24, label: "Button to go full screen", hint: "The F key still works whatever this says." },
  fullscreenExit: { fallback: "Exit full screen", max: 24, label: "Button to leave full screen" },
};

/**
 * The words in the Control Center's "Words on the screen" card, in the order
 * the room sees them. Every ScreenText key is in exactly one group (a test
 * checks), so a new word can't ship without a box to change it.
 */
export const SCREEN_TEXT_GROUPS: readonly { id: string; title: string; when: string; keys: readonly ScreenText[] }[] = [
  { id: "stage", title: "Questions and sets", when: "Under each question, and when a performer’s set starts.", keys: ["stageLabel", "namePrefix"] },
  { id: "drumroll", title: "Drum roll", when: "Under the dice, just before a new question.", keys: ["introWord"] },
  {
    id: "intro", title: "Intro explainer", when: "When you press Intro.",
    keys: ["howHeading", "howStep1", "howStep2", "howStep3", "listenLine", "exampleLabel", "exampleQuestion", "closingLine", "closingCall", "scanLabel"],
  },
  { id: "standard", title: "Show-night drink menu", when: "On the standard drink menu, beside the drinks.", keys: ["standardHeading", "standardQrCaption", "standardQrTitle", "standardQrLink"] },
  { id: "buttons", title: "Buttons on the TV", when: "Only seen by whoever is at the TV laptop.", keys: ["soundOffPrompt", "fullscreenEnter", "fullscreenExit"] },
];

/** Every word key; the QR's own settings; and the rest, how the screen behaves. Together they are every setting, each once (a test checks). */
export const TEXT_KEYS = Object.keys(SCREEN_TEXT) as ScreenText[];
export const QR_KEYS = ["qrKind", "qrTo", "qrImage", "qrSize"] as const;
const SWITCH_KEYS: ScreenSwitch[] = ["countdown", "intro", "sound", "timer", "names"];

/** The countdown starts from somewhere between 1 and 10; 3 until the host picks another. */
export const COUNTDOWN_MIN = 1;
export const COUNTDOWN_MAX = 10;

/**
 * The sound's volume runs from barely there to half again as loud: below 10%
 * a room never hears it, and above 150% the limiter only squashes it flatter.
 */
export const STING_VOLUME_MIN = 10;
export const STING_VOLUME_MAX = 150;
/** Long enough for any upload address the stores hand out, short enough that the poll stays small. */
export const STING_URL_MAX = ASSET_URL_MAX;

export const DEFAULT_SCREEN: ScreenSettings = {
  countdown: true, countdownFrom: 3, intro: true, introWord: "", sound: true,
  sting: DEFAULT_SOUND, stingVolume: 100, stingUrl: "", qrKind: "", qrTo: "", qrImage: "", qrSize: DEFAULT_QR_SIZE, timer: true, names: true,
  stageLabel: "", namePrefix: "",
  howHeading: "", howStep1: "", howStep2: "", howStep3: "", listenLine: "", exampleLabel: "", exampleQuestion: "", closingLine: "", closingCall: "", scanLabel: "",
  standardHeading: "", standardQrCaption: "", standardQrTitle: "", standardQrLink: "",
  soundOffPrompt: "", fullscreenEnter: "", fullscreenExit: "",
};

/** Everything that is neither words nor the QR: switches, numbers and the sound. */
export const BEHAVIOUR_KEYS = (Object.keys(DEFAULT_SCREEN) as (keyof ScreenSettings)[])
  .filter((key) => !(TEXT_KEYS as string[]).includes(key) && !(QR_KEYS as readonly string[]).includes(key));

/**
 * One piece of wording as one trimmed, capped line. The default itself is
 * kept as "", so it keeps following the default; for words the screen draws
 * in capitals, the default in any case counts.
 */
export function cleanScreenText(key: ScreenText, raw: unknown): string {
  if (typeof raw !== "string") return "";
  const { fallback, max, caps } = SCREEN_TEXT[key];
  const value = raw.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return (caps ? value.toUpperCase() === fallback.toUpperCase() : value === fallback) ? "" : value;
}

function isCountdownFrom(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= COUNTDOWN_MIN && raw <= COUNTDOWN_MAX;
}

function isQuestionSound(raw: unknown): raw is QuestionSound {
  return raw === "custom" || isSoundId(raw);
}

function isStingVolume(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= STING_VOLUME_MIN && raw <= STING_VOLUME_MAX;
}

/**
 * Where the host's own sound lives, or "" for anything else. Only an address
 * on this site (an upload, /uploads/… or /api/media/…) or a secure web
 * address, since the live screen fetches whatever is here: the same rules as
 * the host's QR picture (see cleanAssetUrl).
 */
export function cleanStingUrl(raw: unknown): string {
  return cleanAssetUrl(raw);
}

/**
 * The sound the projector really plays for these settings: "your own" with
 * nothing uploaded yet plays the default, so the room still hears something.
 */
export function chosenSting(settings: Pick<ScreenSettings, "sting" | "stingUrl">): QuestionSound {
  return settings.sting === "custom" && !settings.stingUrl ? DEFAULT_SOUND : settings.sting;
}

/** The file the projector fetches for these settings: the host's own upload, or the built-in recording. */
export function soundUrl(settings: Pick<ScreenSettings, "sting" | "stingUrl">): string {
  const sting = chosenSting(settings);
  return sting === "custom" ? settings.stingUrl : soundFile(sting);
}

/** What the Control Center calls that sound: a built-in one's name, or the file name of the host's own. */
export function stingName(settings: Pick<ScreenSettings, "sting" | "stingUrl">): string {
  const sting = chosenSting(settings);
  if (sting === "custom") return uploadedFileName(settings.stingUrl);
  return QUESTION_SOUNDS.find((entry) => entry.id === sting)?.label ?? sting;
}

/** The stored settings. Anything missing or malformed reads as its default. */
export function parseScreenSettings(raw: unknown): ScreenSettings {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const settings = { ...DEFAULT_SCREEN };
  for (const key of SWITCH_KEYS) {
    const flag = value[key];
    if (typeof flag === "boolean") settings[key] = flag;
  }
  if (isCountdownFrom(value.countdownFrom)) settings.countdownFrom = value.countdownFrom;
  if (isQuestionSound(value.sting)) settings.sting = value.sting;
  if (isStingVolume(value.stingVolume)) settings.stingVolume = value.stingVolume;
  if (isQrSize(value.qrSize)) settings.qrSize = value.qrSize;
  if (isQrKind(value.qrKind)) settings.qrKind = value.qrKind;
  settings.qrTo = cleanQrLink(value.qrTo);
  settings.qrImage = cleanAssetUrl(value.qrImage);
  settings.stingUrl = cleanStingUrl(value.stingUrl);
  for (const key of TEXT_KEYS) settings[key] = cleanScreenText(key, value[key]);
  return settings;
}

/**
 * A change the Control Center sent: only known settings, each of the right
 * type, words cleaned. Null for anything else, so a bad request changes
 * nothing rather than part of the screen. The one exception is a sound this
 * version no longer has, which an older Control Center still sends with
 * every save: it is left out, so the switch the host just flipped still
 * saves.
 */
export function parseScreenChange(raw: unknown): Partial<ScreenSettings> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length) return null;
  const change: Partial<ScreenSettings> = {};
  for (const [key, value] of entries) {
    if ((SWITCH_KEYS as string[]).includes(key)) {
      if (typeof value !== "boolean") return null;
      change[key as ScreenSwitch] = value;
    } else if (key === "countdownFrom") {
      if (!isCountdownFrom(value)) return null;
      change.countdownFrom = value;
    } else if (key === "sting") {
      if (typeof value !== "string") return null;
      // A sound this version no longer has ("doom", from a Control Center opened before an update): the saved sound stays, the rest still saves.
      if (isQuestionSound(value)) change.sting = value;
    } else if (key === "qrSize") {
      if (!isQrSize(value)) return null;
      change.qrSize = value;
    } else if (key === "qrKind") {
      if (!isQrKind(value)) return null;
      change.qrKind = value;
    } else if (key === "qrTo") {
      // "" clears it; anything else must be a secure link a code can be made from, kept as the code will hold it.
      if (typeof value !== "string") return null;
      const link = cleanQrLink(value);
      if (value.trim() && !link) return null;
      change.qrTo = link;
    } else if (key === "qrImage") {
      if (typeof value !== "string") return null;
      const image = cleanAssetUrl(value);
      if (value.trim() && !image) return null;
      change.qrImage = image;
    } else if (key === "stingVolume") {
      if (!isStingVolume(value)) return null;
      change.stingVolume = value;
    } else if (key === "stingUrl") {
      // "" clears it; anything else must be an address the screen may fetch.
      if (typeof value !== "string") return null;
      const url = cleanStingUrl(value);
      if (value.trim() && !url) return null;
      change.stingUrl = url;
    } else if ((TEXT_KEYS as string[]).includes(key)) {
      if (typeof value !== "string") return null;
      change[key as ScreenText] = cleanScreenText(key as ScreenText, value);
    } else {
      return null;
    }
  }
  return Object.keys(change).length ? change : null;
}

/**
 * What one of the Control Center's cards sends: of the settings it looks
 * after (`keys`), only those that would change what is saved, cleaned as the
 * server keeps them. So a card never writes over a setting another card (or
 * another phone) just saved, and a word left at its default is sent as "",
 * never as the default itself. Words drawn in capitals compare in any case.
 * A link or picture that can't be used is sent as typed, so the server turns
 * it away rather than it quietly going.
 */
export function screenChanges(saved: ScreenSettings, next: ScreenSettings, keys: readonly (keyof ScreenSettings)[]): Partial<ScreenSettings> {
  const cleaned = parseScreenSettings(next);
  const change: Record<string, unknown> = {};
  for (const key of keys) {
    const after = key === "qrTo" ? cleaned.qrTo || next.qrTo.trim()
      : key === "qrImage" ? cleaned.qrImage || next.qrImage.trim()
        : cleaned[key];
    const before = saved[key];
    const caps = (TEXT_KEYS as string[]).includes(key) && SCREEN_TEXT[key as ScreenText].caps;
    const same = caps && typeof before === "string" && typeof after === "string" ? before.toUpperCase() === after.toUpperCase() : before === after;
    if (!same) change[key] = after;
  }
  return change as Partial<ScreenSettings>;
}

/**
 * The QR the show screens draw for these settings: the host's link (as a
 * code, at the address `srcOf` gives: a signed one for the TV, the signed-in
 * preview in the Control Center), their picture, or the question form. A
 * link or picture that can't be used, or a link `srcOf` can't sign, falls
 * back to the question form, at the size picked, so the room always has
 * somewhere to send a question.
 */
export function shownQr(settings: Pick<ScreenSettings, "qrKind" | "qrTo" | "qrImage" | "qrSize">, srcOf: (link: string) => string | null): ShownQr {
  const size = isQrSize(settings.qrSize) ? settings.qrSize : DEFAULT_QR_SIZE;
  if (settings.qrKind === "link") {
    const link = cleanQrLink(settings.qrTo);
    const src = link ? srcOf(link) : null;
    if (src) return { kind: "link", src, size };
  } else if (settings.qrKind === "picture") {
    const image = cleanAssetUrl(settings.qrImage);
    if (image) return { kind: "picture", src: image, size };
  }
  return { kind: "form", src: DECISIONS_QR_SRC, size };
}

/** The same for the Control Center's previews: a link's code comes from the signed-in preview route. */
export function previewQr(settings: Pick<ScreenSettings, "qrKind" | "qrTo" | "qrImage" | "qrSize">): ShownQr {
  return shownQr(settings, adminQrPreviewSrc);
}

/**
 * The words on the standard drink menu's left panel. With the question
 * form's QR, the host's own words or the printed ones. With the host's own
 * link or picture, only words the host wrote, since "Scan to submit your bad
 * decisions" would be wrong under it; the web address then defaults to the
 * link itself, shortened (nothing for a picture). The heading is always
 * there. Takes the settings as saved or as screenLook fills them in: a word
 * that says the same as its default counts as the default.
 */
export function standardMenuWords(settings: ScreenSettings): BoardWords {
  const own = (key: ScreenText) => cleanScreenText(key, settings[key]);
  const link = settings.qrKind === "link" ? cleanQrLink(settings.qrTo) : "";
  const form = !link && !(settings.qrKind === "picture" && cleanAssetUrl(settings.qrImage));
  const line = (key: ScreenText) => own(key) || (form ? SCREEN_TEXT[key].fallback : "");
  return {
    heading: own("standardHeading") || SCREEN_TEXT.standardHeading.fallback,
    caption: line("standardQrCaption"),
    title: line("standardQrTitle"),
    link: own("standardQrLink") || (link ? linkLabel(link, SCREEN_TEXT.standardQrLink.max) : form ? SCREEN_TEXT.standardQrLink.fallback : ""),
  };
}

/**
 * Only the settings that differ from the defaults: what is stored and what
 * the live screen's poll carries, so both stay small. {} until the host
 * changes something.
 */
export function changedScreen(settings: ScreenSettings): Partial<ScreenSettings> {
  return Object.fromEntries(Object.entries(settings).filter(([key, value]) => DEFAULT_SCREEN[key as keyof ScreenSettings] !== value));
}

/**
 * What the projector draws: the settings with every default word filled in.
 * Takes anything, so a missing or odd answer (an older server, say) draws
 * the screen exactly as it always looked.
 */
export function screenLook(raw: unknown): ScreenSettings {
  const settings = parseScreenSettings(raw);
  for (const key of TEXT_KEYS) settings[key] ||= SCREEN_TEXT[key].fallback;
  return settings;
}

export const DEFAULT_LOOK: ScreenSettings = screenLook(null);

/** The standard drink menu's printed wording, as it has always been. */
export const PRINTED_WORDS: BoardWords = standardMenuWords(DEFAULT_SCREEN);

/**
 * A line in parts, with every "bad decision" (or "bad decisions") marked, so
 * the explainer's closing line keeps drawing those words in red whatever the
 * host writes around them.
 */
export function markBadDecisions(text: string): { text: string; mark: boolean }[] {
  const parts: { text: string; mark: boolean }[] = [];
  let from = 0;
  for (const match of text.matchAll(/bad decisions?/gi)) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index), mark: false });
    parts.push({ text: match[0], mark: true });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), mark: false });
  return parts;
}

/** A screen that opens later than this after a "Test sound" tap does not play it. */
export const SOUND_TEST_FRESH_MS = 15_000;

/** The sound test the live screen should act on: only a recent tap, so an old one never replays. */
export function freshSoundTest(at: string | null, now: number): string | null {
  if (!at) return null;
  const age = now - Date.parse(at);
  return age >= 0 && age < SOUND_TEST_FRESH_MS ? at : null;
}
