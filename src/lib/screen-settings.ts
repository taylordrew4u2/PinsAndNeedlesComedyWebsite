import { EXAMPLE_QUESTION } from "./explainer.ts";
import { DEFAULT_SOUND, DEFAULT_SPOOK_SOUND, QUESTION_SOUNDS, isSoundId, soundFile, type SoundId } from "./question-sounds.ts";
import { uploadedFileName } from "./audio-upload.ts";

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
  /** The set clock along the bottom while a timed set runs. */
  timer: boolean;
  /** The sender's name under their question. */
  names: boolean;
  /** The line above a performer's name when their set starts. */
  stageLabel: string;
  /**
   * Spook mode: the show's Halloween look on the projector and the phones,
   * spooky lines wherever the host left the words as they were, and while
   * it is on, the sound that plays ("usual" keeps the host's usual sound).
   * Only the Control Center's 🦇 button switches it.
   */
  spook: boolean;
  spookSting: SoundId | "usual";
  /** The "Intro" explainer's words: its heading and three steps, the line before the sound, the example, and the two closing lines. */
  howHeading: string;
  howStep1: string;
  howStep2: string;
  howStep3: string;
  listenLine: string;
  exampleQuestion: string;
  closingLine: string;
  closingCall: string;
};

export type ScreenText = "introWord" | "stageLabel" | "howHeading" | "howStep1" | "howStep2" | "howStep3" | "listenLine" | "exampleQuestion" | "closingLine" | "closingCall";
export type ScreenSwitch = "countdown" | "intro" | "sound" | "timer" | "names" | "spook";

/**
 * Each piece of wording: what it says until the host writes their own, and
 * the longest the screen's layout takes without spilling off the projector
 * (measured against each one's size on a 16:9 screen).
 */
export const SCREEN_TEXT: Record<ScreenText, { fallback: string; max: number }> = {
  introWord: { fallback: "Incoming", max: 16 },
  stageLabel: { fallback: "Now on stage", max: 30 },
  howHeading: { fallback: "How it works", max: 28 },
  howStep1: { fallback: "Scan the QR", max: 40 },
  howStep2: { fallback: "Tell us your bad decision", max: 40 },
  howStep3: { fallback: "A comedian weighs in, live", max: 40 },
  listenLine: { fallback: "When you hear this…", max: 40 },
  exampleQuestion: { fallback: EXAMPLE_QUESTION, max: 120 },
  closingLine: { fallback: "That sound means a bad decision just hit the screen.", max: 100 },
  closingCall: { fallback: "Scan to send yours.", max: 40 },
};

/**
 * The same wording in spook mode, used wherever the host left a word as it
 * was. Each fits its box above, and the closing line keeps a "bad decision"
 * for the screen to draw in red.
 */
export const SPOOK_TEXT: Record<ScreenText, string> = {
  introWord: "It’s alive!",
  stageLabel: "Now haunting the stage",
  howHeading: "How the haunting works",
  howStep1: "Scan the cursed QR",
  howStep2: "Confess your bad decision",
  howStep3: "A comedian judges your soul, live",
  listenLine: "When you hear this from beyond…",
  exampleQuestion: "Should I get a matching skull tattoo with someone I met at a Halloween party an hour ago?",
  closingLine: "That sound means a bad decision just rose from the grave.",
  closingCall: "Scan if you dare.",
};

/** What a word says while the host has left it as it was: the usual line, or the spooky one in spook mode. */
export function screenFallback(key: ScreenText, spook: boolean): string {
  return spook ? SPOOK_TEXT[key] : SCREEN_TEXT[key].fallback;
}

const TEXT_KEYS = Object.keys(SCREEN_TEXT) as ScreenText[];
const SWITCH_KEYS: ScreenSwitch[] = ["countdown", "intro", "sound", "timer", "names", "spook"];

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
export const STING_URL_MAX = 500;

export const DEFAULT_SCREEN: ScreenSettings = {
  countdown: true, countdownFrom: 3, intro: true, introWord: "", sound: true,
  sting: DEFAULT_SOUND, stingVolume: 100, stingUrl: "", timer: true, names: true, stageLabel: "",
  spook: false, spookSting: DEFAULT_SPOOK_SOUND,
  howHeading: "", howStep1: "", howStep2: "", howStep3: "", listenLine: "", exampleQuestion: "", closingLine: "", closingCall: "",
};

/**
 * One piece of wording as one trimmed, capped line. Either default, usual or
 * spooky, is kept as "", so it keeps following the default in both modes.
 */
export function cleanScreenText(key: ScreenText, raw: unknown): string {
  if (typeof raw !== "string") return "";
  const { fallback, max } = SCREEN_TEXT[key];
  const value = raw.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return value === fallback || value === SPOOK_TEXT[key] ? "" : value;
}

function isCountdownFrom(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= COUNTDOWN_MIN && raw <= COUNTDOWN_MAX;
}

function isQuestionSound(raw: unknown): raw is QuestionSound {
  return raw === "custom" || isSoundId(raw);
}

function isSpookSting(raw: unknown): raw is ScreenSettings["spookSting"] {
  return raw === "usual" || isSoundId(raw);
}

function isStingVolume(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= STING_VOLUME_MIN && raw <= STING_VOLUME_MAX;
}

/**
 * Where the host's own sound lives, or "" for anything else. Only an address
 * on this site (an upload, /uploads/… or /api/media/…) or a secure web
 * address, since the live screen fetches whatever is here: never another
 * scheme, a protocol-relative "//" address, or anything with spaces in it.
 */
export function cleanStingUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || value.length > STING_URL_MAX || /[\s\\]/.test(value)) return "";
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

/** The settings that decide which sound plays: the usual choice, and spook mode's while it is on. */
type SoundChoice = Pick<ScreenSettings, "sting" | "stingUrl"> & Partial<Pick<ScreenSettings, "spook" | "spookSting">>;

/**
 * The sound the projector really plays for these settings: spook mode's
 * while it is on (unless the host kept their usual one), and "your own" with
 * nothing uploaded yet plays the default, so the room still hears something.
 */
export function chosenSting(settings: SoundChoice): QuestionSound {
  if (settings.spook && settings.spookSting && settings.spookSting !== "usual") return settings.spookSting;
  return settings.sting === "custom" && !settings.stingUrl ? DEFAULT_SOUND : settings.sting;
}

/** The file the projector fetches for these settings: the host's own upload, or the built-in recording. */
export function soundUrl(settings: SoundChoice): string {
  const sting = chosenSting(settings);
  return sting === "custom" ? settings.stingUrl : soundFile(sting);
}

/** The file that stands in while the chosen one is loading or failed: spook mode's default while a spooky sound is chosen, else the usual default. */
export function fallbackSoundUrl(settings: Pick<ScreenSettings, "spook" | "spookSting">): string {
  return soundFile(settings.spook && settings.spookSting !== "usual" ? DEFAULT_SPOOK_SOUND : DEFAULT_SOUND);
}

/** What the Control Center calls that sound: a built-in one's name, or the file name of the host's own. */
export function stingName(settings: SoundChoice): string {
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
  settings.stingUrl = cleanStingUrl(value.stingUrl);
  if (isSpookSting(value.spookSting)) settings.spookSting = value.spookSting;
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
    } else if (key === "spookSting") {
      if (typeof value !== "string") return null;
      // Like the sound: one this version doesn't have is left out, and the rest still saves.
      if (isSpookSting(value)) change.spookSting = value;
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
 * Only the settings that differ from the defaults: what is stored and what
 * the live screen's poll carries, so both stay small. {} until the host
 * changes something.
 */
export function changedScreen(settings: ScreenSettings): Partial<ScreenSettings> {
  return Object.fromEntries(Object.entries(settings).filter(([key, value]) => DEFAULT_SCREEN[key as keyof ScreenSettings] !== value));
}

/**
 * What the projector draws: the settings with every default word filled in,
 * the spooky ones while spook mode is on.
 * Takes anything, so a missing or odd answer (an older server, say) draws
 * the screen exactly as it always looked.
 */
export function screenLook(raw: unknown): ScreenSettings {
  const settings = parseScreenSettings(raw);
  for (const key of TEXT_KEYS) settings[key] ||= screenFallback(key, settings.spook);
  return settings;
}

export const DEFAULT_LOOK: ScreenSettings = screenLook(null);

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
