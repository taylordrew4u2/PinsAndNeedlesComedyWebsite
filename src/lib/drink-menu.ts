import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, isMenuFont, isScriptFont, type MenuFontId, type ScriptFontId } from "./menu-fonts.ts";

/**
 * The venue's drink menu, as the live screen shows it between sets. Copied
 * from Pixelated Records' printed menu; edit here when their list changes.
 * The host can keep a list of their own from the Control Center (see
 * drink-list.ts); until they do, and after "Back to the printed menu", this is it.
 *
 * `id` keeps a drink or section the same one while the host edits and moves
 * it (the printed menu goes by its names). A sold-out drink stays on the
 * board, crossed out. A section with `shared` set lists its drinks without
 * prices even when no shared price is written in.
 */
export type Drink = { id?: string; name: string; price?: string; detail?: string; soldOut?: boolean };
export type DrinkSection = { id?: string; title: string; price?: string; shared?: boolean; drinks: Drink[] };

export const DRINK_MENU: DrinkSection[][] = [
  [
    {
      title: "Beer, Cider & Seltzer",
      drinks: [
        { name: "White Claw · Black Cherry", price: "$4", detail: "Seltzer" },
        { name: "Modelo · Especial", price: "$5", detail: "Lager" },
        { name: "Chelada", price: "$7", detail: "Modelo · Lime · Salt" },
        { name: "Hudson North · Big Apple Cider", price: "$6" },
        { name: "KCBC · Superhero Sidekicks", price: "$7", detail: "Hazy IPA" },
        { name: "Back Home · Sumac Gose", price: "$8", detail: "Tart Cherry" },
        { name: "Allagash · White", price: "$8", detail: "Belgian-style Wheat" },
      ],
    },
    {
      title: "Zero Proof",
      drinks: [
        { name: "Athletic · Free Wave", price: "$6", detail: "Hazy IPA" },
        { name: "Athletic · Fruited Fields", price: "$6", detail: "Radler" },
        { name: "Mocktails", price: "$8" },
      ],
    },
    {
      title: "Shots, Neat & Rocks",
      drinks: [
        { name: "Well Shot (1.5 oz)", price: "$7" },
        { name: "Well Neat or Rocks (2 oz)", price: "$9", detail: "Inquire about pricing for premium spirits." },
      ],
    },
    {
      title: "Sodas & More",
      drinks: [
        { name: "Drink Palestina", price: "$3", detail: "Cola · Sugar-Free Cola · Orange · Lemon-Lime" },
        { name: "Ginger Beer", price: "$3" },
      ],
    },
  ],
  [
    {
      title: "Highballs",
      price: "$11",
      drinks: [
        { name: "Choice of Well Spirit + Mixer", detail: "Gin · Rum · Tequila · Vodka · Whiskey" },
        { name: "Mixers", detail: "Club Soda · Tonic · Lemon/Sour · Ginger Ale · Cranberry · Cola · Sugar-Free Cola · Red Bull · Red Bull Sugar-Free" },
      ],
    },
    {
      title: "Specialty Cocktails",
      price: "$13",
      drinks: [
        { name: "Gucci Lemonade", detail: "Gin · Vermouth · Lemon · Simple Syrup · Bitters · Sparkling Water" },
        { name: "Whiskey Winehouse", detail: "Whiskey · Red Wine · Lemon · Simple Syrup · Cardamom" },
        { name: "Cherry Funk", detail: "Rum · Elderflower · Cherry Blossom · Coconut · Lemon · Pineapple · Ginger Beer" },
      ],
    },
    {
      title: "Classic Cocktails",
      drinks: [
        { name: "Margarita", price: "$12", detail: "Flavored +$1" },
        { name: "Gimlet", price: "$12" },
        { name: "Mojito", price: "$12" },
        { name: "Paloma", price: "$13" },
        { name: "Tom Collins", price: "$13" },
        { name: "Negroni", price: "$13" },
        { name: "Moscow Mule", price: "$13" },
        { name: "Old Fashioned", price: "$13" },
        { name: "Manhattan", price: "$13" },
        { name: "Sidecar", price: "$15" },
      ],
    },
  ],
  [
    {
      title: "Red Wine",
      drinks: [
        { name: "Vigna Madre Kriya", price: "$8", detail: "Montepulciano · Italy" },
        { name: "Bernardus", price: "$9", detail: "Pinot Noir · Santa Lucia Highlands · 2023" },
        { name: "Gérard Bertrand · Naturae", price: "$10", detail: "Cabernet Sauvignon · France · 2024" },
      ],
    },
    {
      title: "White & Orange Wine",
      drinks: [
        { name: "Oyster Bay", price: "$9", detail: "Sauvignon Blanc · New Zealand" },
        { name: "Cave de Lugny Mâcon-Villages", price: "$9", detail: "Chardonnay · France · 2023" },
        { name: "Viña Echeverría · No Es Pituko", price: "$11", detail: "Orange · Chile" },
      ],
    },
    {
      title: "Rosé & Sparkling",
      drinks: [
        { name: "Josh Scott · Bla Bla Bla", price: "$8", detail: "Rosé · New Zealand · 2022" },
        { name: "Maschio DOC Treviso Brut", price: "$10", detail: "Prosecco · Italy" },
      ],
    },
    {
      title: "Sparkling Cocktails",
      drinks: [
        { name: "Mimosa", price: "$11", detail: "Prosecco · Orange Juice" },
        { name: "Rossini", price: "$11", detail: "Prosecco · Strawberry" },
        { name: "Aperol Spritz", price: "$13", detail: "Prosecco · Aperol · Soda" },
        { name: "French 75", price: "$15", detail: "Prosecco · Gin · Lemon · Simple Syrup" },
      ],
    },
  ],
];

/** What runs around the drink menu when the host has not set a marquee of their own. */
export const DEFAULT_MARQUEE = "Pins & Needles Comedy";

/** Longest marquee the Control Center accepts; long enough for a plug, short enough to read. */
export const MARQUEE_MAX = 140;

/** How fast the marquee has always crawled, in board pixels per second. */
export const DEFAULT_MARQUEE_SPEED = 90;

/**
 * The marquee speeds the host picks from, in board pixels per second. Named
 * rather than a free number, so it can never be set to a blur or a standstill;
 * Normal ("") is the speed it has always run at.
 */
export const MARQUEE_SPEEDS = [
  { id: "slowest", label: "Very slow", speed: 30 },
  { id: "slow", label: "Slow", speed: 55 },
  { id: "", label: "Normal", speed: DEFAULT_MARQUEE_SPEED },
  { id: "fast", label: "Fast", speed: 140 },
  { id: "fastest", label: "Very fast", speed: 210 },
] as const;

export type MarqueeSpeedId = (typeof MARQUEE_SPEEDS)[number]["id"];

export function isMarqueeSpeed(id: unknown): id is MarqueeSpeedId {
  return MARQUEE_SPEEDS.some((speed) => speed.id === id);
}

/** A stored speed in board pixels per second; anything unknown runs at Normal. */
export function marqueeSpeedOf(id: unknown): number {
  return MARQUEE_SPEEDS.find((speed) => speed.id === id)?.speed ?? DEFAULT_MARQUEE_SPEED;
}

/** Longest line the host can put above the QR code on the custom menu. */
export const HEADLINE_MAX = 80;

/** Longest note the host can put in the empty space under the menu's first two columns. */
export const NOTE_MAX = 120;

/** Longest bartender name (or names) the custom menu takes. */
export const BARTENDER_MAX = 40;

/** What the custom menu says above the QR code until the host writes their own. */
export const DEFAULT_HEADLINE = "Don’t miss the 9 PM show! Scan here for Bad Decisions";

/**
 * The rest of the custom menu's wording the host can change: the three lines
 * under the QR code and the label over tonight's bartender. Each starts as
 * the printed board has it, and an empty one goes back to that. The limits
 * keep each to a line or two in its space on the board.
 */
export const MENU_WORDING = {
  qrCaption: { label: "Small line under the QR code", fallback: "SCAN TO SUBMIT", max: 28 },
  qrTitle: { label: "Big line under the QR code", fallback: "YOUR BAD DECISIONS", max: 28 },
  qrLink: { label: "Web address under the QR code", fallback: "pinsandneedlescomedy.com/bad-decisions", max: 48 },
  bartenderLabel: { label: "Over the bartender’s name", fallback: "Your bartender tonight", max: 32 },
} as const;

export type WordingKey = keyof typeof MENU_WORDING;
export const WORDING_KEYS = Object.keys(MENU_WORDING) as WordingKey[];
export type MenuWording = Record<WordingKey, string>;

/** The custom menu's text colour until the host picks one: the brand red. */
export const DEFAULT_MENU_COLOR = "#FF2E4D";

/** Quick picks for the custom menu's text colour; any other colour works too. */
export const MENU_COLORS = ["#FF2E4D", "#FFC93C", "#3CE0FF", "#7CFF6B", "#FF6BD6", "#FFFFFF"] as const;

/**
 * Two menus, the same in every way but these: the custom one's text is in the
 * host's colour, it carries a line above the QR code, and it can carry a note,
 * in a colour of its own, in the empty space under the first two columns.
 */
export type MenuStyle = "standard" | "custom";

/**
 * Whether the drink menu is up and which one, the marquee that runs around
 * it, and the custom menu's colour, line and note (empty for the defaults;
 * an empty note is no note, and an empty note colour follows the text colour).
 */
export type MenuState = {
  on: boolean; style: MenuStyle; marquee: string; color: string; headline: string; note: string; noteColor: string;
  /** The custom menu's font ("" for the standard one), and tonight's bartender in a script font and colour of their own. */
  font: string; bartender: string; bartenderFont: string; bartenderColor: string;
  /** The marquee on (as it has always been) or off, its speed ("" for Normal) and its own colour ("" for the menu's text colour). */
  marqueeOn: boolean; marqueeSpeed: string; marqueeColor: string;
} & MenuWording;

/** What the custom menu draws, defaults filled in. An empty note or bartender is left off. */
export type CustomLook = {
  color: string; headline: string; note: string; noteColor: string;
  font: MenuFontId; bartender: string; bartenderFont: ScriptFontId; bartenderColor: string;
} & MenuWording;

/** One line of plain text, trimmed and capped. Anything that is not a string is no text. */
export function cleanLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** One line of plain text, trimmed and capped. Anything that is not a string is no marquee. */
export function cleanMarquee(raw: unknown): string {
  return cleanLine(raw, MARQUEE_MAX);
}

export function cleanHeadline(raw: unknown): string {
  return cleanLine(raw, HEADLINE_MAX);
}

export function cleanNote(raw: unknown): string {
  return cleanLine(raw, NOTE_MAX);
}

export function cleanBartender(raw: unknown): string {
  return cleanLine(raw, BARTENDER_MAX);
}

/** One line of the custom menu's wording, trimmed and capped; "" is the printed wording. */
export function cleanWording(key: WordingKey, raw: unknown): string {
  return cleanLine(raw, MENU_WORDING[key].max);
}

/** Only the wording the host sent, cleaned: what they left out keeps what is saved. */
export function wordingChange(raw: Record<string, unknown>): Partial<MenuWording> {
  return Object.fromEntries(WORDING_KEYS.filter((key) => raw[key] !== undefined).map((key) => [key, cleanWording(key, raw[key])]));
}

/**
 * The wording with the printed wording in every blank, for drawing. The live
 * screen also reads its answer through this, so a missing line (an older
 * server, a damaged answer) still draws the printed board.
 */
export function customWording(raw: unknown): MenuWording {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(WORDING_KEYS.map((key) => {
    const text = value[key];
    return [key, typeof text === "string" && text.trim() ? text : MENU_WORDING[key].fallback];
  })) as MenuWording;
}

/** A six-digit hex colour, upper-cased; anything else is no colour (the default). */
export function cleanColor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
}

/** The stored menu record. Anything malformed reads as off, standard, with the defaults. */
export function parseMenuState(raw: unknown): MenuState {
  if (!raw || typeof raw !== "object") {
    return {
      on: false, style: "standard", marquee: "", color: "", headline: "", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "",
      marqueeOn: true, marqueeSpeed: "", marqueeColor: "", qrCaption: "", qrTitle: "", qrLink: "", bartenderLabel: "",
    };
  }
  const value = raw as Record<string, unknown>;
  return {
    on: value.on === true,
    style: value.style === "custom" ? "custom" : "standard",
    marquee: cleanMarquee(value.marquee),
    color: cleanColor(value.color),
    headline: cleanHeadline(value.headline),
    note: cleanNote(value.note),
    noteColor: cleanColor(value.noteColor),
    font: isMenuFont(value.font) ? value.font : "",
    bartender: cleanBartender(value.bartender),
    bartenderFont: isScriptFont(value.bartenderFont) ? value.bartenderFont : "",
    bartenderColor: cleanColor(value.bartenderColor),
    // Only a marquee switched off on purpose is off: a record from before the switch runs it, as it always did.
    marqueeOn: value.marqueeOn !== false,
    marqueeSpeed: isMarqueeSpeed(value.marqueeSpeed) ? value.marqueeSpeed : "",
    marqueeColor: cleanColor(value.marqueeColor),
    qrCaption: cleanWording("qrCaption", value.qrCaption),
    qrTitle: cleanWording("qrTitle", value.qrTitle),
    qrLink: cleanWording("qrLink", value.qrLink),
    bartenderLabel: cleanWording("bartenderLabel", value.bartenderLabel),
  };
}

/** What the custom menu shows, defaults filled in; null for the standard menu. */
export function customLook(state: MenuState): CustomLook | null {
  if (state.style !== "custom") return null;
  const color = state.color || DEFAULT_MENU_COLOR;
  return {
    color, headline: state.headline || DEFAULT_HEADLINE, note: state.note, noteColor: state.noteColor || color,
    font: isMenuFont(state.font) ? state.font : DEFAULT_MENU_FONT,
    bartender: state.bartender,
    bartenderFont: isScriptFont(state.bartenderFont) ? state.bartenderFont : DEFAULT_SCRIPT_FONT,
    bartenderColor: state.bartenderColor || color,
    ...customWording(state),
  };
}

/** The marquee the live screen runs: only while a menu is up with the marquee on, in the default text until the host writes one. */
export function liveMarquee(state: MenuState): string | null {
  return state.on && state.marqueeOn ? state.marquee || DEFAULT_MARQUEE : null;
}

/** How fast the live screen runs it, and in what colour ("" for the menu's text colour); null while no menu is up. */
export function liveMarqueeLook(state: MenuState): { speed: number; color: string } | null {
  return state.on ? { speed: marqueeSpeedOf(state.marqueeSpeed), color: state.marqueeColor } : null;
}

/** How the marquee runs: on or off, its speed ("" for Normal) and its colour ("" for the menu's text colour). */
export type MarqueeStyle = { on: boolean; speed: string; color: string };

/** The marquee as the Control Center edits it: its text ("" for the default) and how it runs. */
export type MarqueeSettings = MarqueeStyle & { text: string };

/** What one marquee Save sends: the text, how it runs, or both. */
export type MarqueeChange = { text?: string; style?: MarqueeStyle };

/**
 * What the marquee's one Save sends. The server keeps the text and the style
 * as two separate changes, so each goes only when it would change what is
 * saved, and a half the host left alone is never written over. The text is
 * compared cleaned, as the server keeps it, and the colour in any case.
 */
export function marqueeChange(saved: MarqueeSettings, next: MarqueeSettings): MarqueeChange {
  const text = cleanMarquee(next.text);
  const restyled = next.on !== saved.on || next.speed !== saved.speed || next.color.trim().toUpperCase() !== saved.color.trim().toUpperCase();
  return {
    ...(text === cleanMarquee(saved.text) ? {} : { text }),
    ...(restyled ? { style: { on: next.on, speed: next.speed, color: next.color } } : {}),
  };
}
