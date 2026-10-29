import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, isMenuFont, isScriptFont, type MenuFontId, type ScriptFontId } from "./menu-fonts.ts";
import {
  DEFAULT_QR_SIZE, cleanAssetUrl, cleanQrLink, isQrKind, isQrSize, linkLabel, readShownQr, type QrKind, type ShownQr,
} from "./screen-qr.ts";

export type { BoardQr } from "./screen-qr.ts";

/**
 * The venue's drink menu, as the live screen shows it between sets. Copied
 * from Pixelated Records' printed menu; edit here when their list changes.
 * The host can keep a list of their own from the Control Center (see
 * drink-list.ts); until they do, and after "Back to the printed menu", this is it.
 *
 * `id` keeps a drink or section the same one while the host edits and moves
 * it (the printed menu goes by its names). A section with `shared` set lists
 * its drinks without prices even when no shared price is written in.
 * `names` is only on a line that stands for several drinks at one price (see
 * compactSection): each drink's own name, so the board can keep each one
 * whole when the line wraps; `name` is them all joined, for anything that
 * draws it as one.
 */
export type Drink = { id?: string; name: string; price?: string; detail?: string; names?: string[] };
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
        { name: "Well (1.5 oz) Shot", price: "$7" },
        { name: "Well (2 oz) Neat or Rocks", price: "$9", detail: "Inquire about pricing for premium spirits." },
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
        { name: "Choice of Well Spirit + Mixer" },
        { name: "Spirit", detail: "Gin · Rum · Tequila · Vodka · Whiskey" },
        { name: "Mixer", detail: "Club Soda · Tonic · Lemon/Sour · Ginger Ale · Cranberry · Cola · Sugar-Free Cola · Red Bull · Red Bull Sugar-Free" },
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
      title: "Red",
      drinks: [
        { name: "Vigna Madre Kriya", price: "$8", detail: "Montepulciano · Italy" },
        { name: "Bernardus", price: "$9", detail: "Pinot Noir · Santa Lucia Highlands · 2023" },
        { name: "Gérard Bertrand · Naturae", price: "$10", detail: "Cabernet Sauvignon · France · 2024" },
      ],
    },
    {
      title: "White",
      drinks: [
        { name: "Oyster Bay", price: "$9", detail: "Sauvignon Blanc · New Zealand" },
        { name: "Cave de Lugny Mâcon-Villages", price: "$9", detail: "Chardonnay · France · 2023" },
      ],
    },
    {
      title: "Orange",
      drinks: [{ name: "Viña Echeverría · No Es Pituko", price: "$11", detail: "Orange · Chile" }],
    },
    {
      title: "Rosé",
      drinks: [{ name: "Josh Scott · Bla Bla Bla", price: "$8", detail: "Rosé · New Zealand · 2022" }],
    },
    {
      title: "Sparkling",
      drinks: [{ name: "Maschio DOC Treviso Brut", price: "$10", detail: "Prosecco · Italy" }],
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

/** Longest line the host can put above their QR code on the custom menu. */
export const HEADLINE_MAX = 80;

/** Longest note the host can put on the custom menu. */
export const NOTE_MAX = 120;

/** Longest bartender name (or names) the custom menu takes. */
export const BARTENDER_MAX = 40;

/**
 * The rest of the custom menu's wording the host can change: the heading
 * under the logo, the three lines under their QR code and the label over
 * tonight's bartender. The custom menu is the venue's daytime menu, so none
 * of it says anything about Bad Decisions: the lines under a QR are empty
 * until the host writes them (the web address then shows the link itself,
 * shortened), and an empty one is left off. The show-night menu's printed
 * wording is SCREEN_TEXT's standard* words in screen-settings.ts.
 * `placeholder` is the Control Center's example for an empty box; `caps`
 * means the board draws it in capitals. The limits keep each to a line or
 * two in its space on the board.
 */
export const MENU_WORDING = {
  heading: { label: "Heading under the logo", fallback: "MENU", placeholder: "MENU", max: 9, caps: true },
  qrCaption: { label: "Small line under the QR code", fallback: "", placeholder: "e.g. Scan me", max: 28, caps: true },
  qrTitle: { label: "Big line under the QR code", fallback: "", placeholder: "e.g. Follow us", max: 28, caps: true },
  qrLink: { label: "Web address under the QR code", fallback: "", placeholder: "The link, shortened", max: 48, caps: false },
  bartenderLabel: { label: "Over the bartender’s name", fallback: "Your bartender tonight", placeholder: "Your bartender tonight", max: 32, caps: true },
} as const;

export type WordingKey = keyof typeof MENU_WORDING;
export const WORDING_KEYS = Object.keys(MENU_WORDING) as WordingKey[];
export type MenuWording = Record<WordingKey, string>;

/** The custom menu's text colour until the host picks one: the brand red. */
export const DEFAULT_MENU_COLOR = "#FF2E4D";

/** Quick picks for the custom menu's text colour; any other colour works too. */
export const MENU_COLORS = ["#FF2E4D", "#FFC93C", "#3CE0FF", "#7CFF6B", "#FF6BD6", "#FFFFFF"] as const;

/**
 * Two menus. The standard one is the show-night menu, with the Bad
 * Decisions QR and its printed wording. The custom one is the venue's
 * daytime menu: the same drinks in the host's colour and font, with no QR
 * and nothing about the show unless the host adds their own, tonight's
 * bartender and a note, and its sections taking turns on the screen.
 */
export type MenuStyle = "standard" | "custom";

/**
 * How long the custom menu's full board stays up, and each of its section
 * pages after it, before the next. Named rather than a free number, like the
 * marquee's speeds; "" is the default.
 */
export const ROTATE_FULL = [
  { id: "short", label: "15 seconds", ms: 15_000 },
  { id: "", label: "30 seconds", ms: 30_000 },
  { id: "long", label: "1 minute", ms: 60_000 },
  { id: "longest", label: "2 minutes", ms: 120_000 },
] as const;

export const ROTATE_SECTION = [
  { id: "short", label: "5 seconds", ms: 5_000 },
  { id: "", label: "8 seconds", ms: 8_000 },
  { id: "long", label: "12 seconds", ms: 12_000 },
  { id: "longest", label: "20 seconds", ms: 20_000 },
] as const;

export type RotateFullId = (typeof ROTATE_FULL)[number]["id"];
export type RotateSectionId = (typeof ROTATE_SECTION)[number]["id"];

export function isRotateFull(id: unknown): id is RotateFullId {
  return ROTATE_FULL.some((entry) => entry.id === id);
}

export function isRotateSection(id: unknown): id is RotateSectionId {
  return ROTATE_SECTION.some((entry) => entry.id === id);
}

/** How long the full board stays up, in milliseconds; anything unknown is the default 30 seconds. */
export function rotateFullMs(id: unknown): number {
  return (ROTATE_FULL.find((entry) => entry.id === id) ?? ROTATE_FULL[1]).ms;
}

/** How long each section page stays up, in milliseconds; anything unknown is the default 8 seconds. */
export function rotateSectionMs(id: unknown): number {
  return (ROTATE_SECTION.find((entry) => entry.id === id) ?? ROTATE_SECTION[1]).ms;
}

/** How long the custom menu's pages stay up: the full board, then each section page. */
export type RotationTiming = { fullMs: number; sectionMs: number };

/**
 * Whether the drink menu is up and which one, the marquee that runs around
 * it, and the custom menu's look (empty for the defaults; an empty note,
 * headline or bartender is none, and an empty note or name colour follows
 * the text colour).
 */
export type MenuState = {
  on: boolean; style: MenuStyle; marquee: string; color: string; headline: string; note: string; noteColor: string;
  /** The custom menu's font ("" for the standard one), and tonight's bartender in a script font and colour of their own. */
  font: string; bartender: string; bartenderFont: string; bartenderColor: string;
  /** The marquee on (as it has always been) or off, its speed ("" for Normal) and its own colour ("" for the menu's text colour). */
  marqueeOn: boolean; marqueeSpeed: string; marqueeColor: string;
  /**
   * The custom menu's own QR: none (""), a code for the host's link, or the
   * host's picture, and its size as a percentage. The link and picture are
   * kept while another choice is picked, so picking them again brings them
   * back. Its own, so the show screens' QR never decides it.
   */
  qrKind: QrKind; qrTo: string; qrImage: string; qrSize: number;
  /** The custom menu taking turns between its full board and its sections (on unless switched off), and how long each stays up. */
  rotateOn: boolean; rotateFull: RotateFullId; rotateSection: RotateSectionId;
  /** The marquee on the custom menu: "" is none, since the shared marquee's default is show branding. */
  customMarquee: string;
  /** Both menus draw drinks of one price, with no detail line, on one line (on unless switched off). */
  samePriceLine: boolean;
} & MenuWording;

/** The custom menu's own settings, as its card in the Control Center edits them. */
export type CustomMenuSettings = Omit<MenuState, "on" | "style" | "marquee" | "marqueeOn" | "marqueeSpeed" | "marqueeColor" | "samePriceLine">;

/** The words on a menu's left panel: the heading under the logo, then the small and big lines and the web address under the QR. */
export type BoardWords = { heading: string; caption: string; title: string; link: string };

/**
 * What the custom menu draws, defaults filled in. An empty note, headline,
 * bartender or line under the QR is left off. `qr` is its own QR (a code for
 * the host's link, or their picture; never the question form), null for
 * none; the headline and the lines under it only show with one. `rotate` is
 * how long its pages stay up, null when it doesn't rotate.
 */
export type CustomLook = {
  color: string; headline: string; note: string; noteColor: string;
  font: MenuFontId; bartender: string; bartenderFont: ScriptFontId; bartenderColor: string;
  qr: ShownQr | null;
  rotate: RotationTiming | null;
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

/** One line of the custom menu's wording, trimmed and capped; "" is the default. */
export function cleanWording(key: WordingKey, raw: unknown): string {
  return cleanLine(raw, MENU_WORDING[key].max);
}

/**
 * A line of wording as it is saved: "" when it says the same as the
 * default, ignoring capitals where the board draws it in capitals, so a line
 * left at its default keeps following it.
 */
export function wordingToSave(key: WordingKey, text: string): string {
  const value = cleanWording(key, text);
  const { fallback, caps } = MENU_WORDING[key];
  return (caps ? value.toUpperCase() === fallback.toUpperCase() : value === fallback) ? "" : value;
}

/**
 * The wording with the defaults in every blank, for drawing: MENU for the
 * heading, the usual label over the bartender, and nothing under the QR,
 * except that the web address under a code for the host's link (`link`, ""
 * for anything else) is the link itself, shortened. The live screen reads
 * the server's answer through this too, so a missing line (an older server,
 * a damaged answer) still draws.
 */
export function customWording(raw: unknown, link = ""): MenuWording {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(WORDING_KEYS.map((key) => {
    const text = value[key];
    const fallback = key === "qrLink" && link ? linkLabel(link, MENU_WORDING.qrLink.max) : MENU_WORDING[key].fallback;
    return [key, typeof text === "string" && text.trim() ? text : fallback];
  })) as MenuWording;
}

/** A six-digit hex colour, upper-cased; anything else is no colour (the default). */
export function cleanColor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
}

/**
 * The stored menu record. Anything malformed reads as off, standard, with
 * the defaults. A `qrOff` from before the custom menu had its own QR choice
 * is ignored: the custom menu has no QR until the host picks one.
 */
export function parseMenuState(raw: unknown): MenuState {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
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
    qrKind: isQrKind(value.qrKind) ? value.qrKind : "",
    qrTo: cleanQrLink(value.qrTo),
    qrImage: cleanAssetUrl(value.qrImage),
    qrSize: isQrSize(value.qrSize) ? value.qrSize : DEFAULT_QR_SIZE,
    // Like the marquee: on unless switched off on purpose, so a record from before rotation rotates.
    rotateOn: value.rotateOn !== false,
    rotateFull: isRotateFull(value.rotateFull) ? value.rotateFull : "",
    rotateSection: isRotateSection(value.rotateSection) ? value.rotateSection : "",
    customMarquee: cleanMarquee(value.customMarquee),
    samePriceLine: value.samePriceLine !== false,
    heading: cleanWording("heading", value.heading),
    qrCaption: cleanWording("qrCaption", value.qrCaption),
    qrTitle: cleanWording("qrTitle", value.qrTitle),
    qrLink: cleanWording("qrLink", value.qrLink),
    bartenderLabel: cleanWording("bartenderLabel", value.bartenderLabel),
  };
}

/**
 * The custom menu's own QR, as the screens draw it, or null for none: no QR
 * picked, a link that can't be used or signed (`srcOf` gives the image
 * address for a link: a signed one for the TV, the signed-in preview in the
 * Control Center), or a picture whose address can't be used.
 */
export function customQrOf(settings: Pick<MenuState, "qrKind" | "qrTo" | "qrImage" | "qrSize">, srcOf: (link: string) => string | null): ShownQr | null {
  const size = isQrSize(settings.qrSize) ? settings.qrSize : DEFAULT_QR_SIZE;
  if (settings.qrKind === "link") {
    const link = cleanQrLink(settings.qrTo);
    const src = link ? srcOf(link) : null;
    return src ? { kind: "link", src, size } : null;
  }
  if (settings.qrKind === "picture") {
    const image = cleanAssetUrl(settings.qrImage);
    return image ? { kind: "picture", src: image, size } : null;
  }
  return null;
}

/** The custom menu's settings as it draws them, defaults filled in. Nothing about Bad Decisions: no QR, no line, no wording unless the host adds their own. */
export function customLookOf(settings: CustomMenuSettings, srcOf: (link: string) => string | null): CustomLook {
  const color = settings.color || DEFAULT_MENU_COLOR;
  const qr = customQrOf(settings, srcOf);
  return {
    color, headline: settings.headline, note: settings.note, noteColor: settings.noteColor || color,
    font: isMenuFont(settings.font) ? settings.font : DEFAULT_MENU_FONT,
    bartender: settings.bartender,
    bartenderFont: isScriptFont(settings.bartenderFont) ? settings.bartenderFont : DEFAULT_SCRIPT_FONT,
    bartenderColor: settings.bartenderColor || color,
    qr,
    rotate: settings.rotateOn ? { fullMs: rotateFullMs(settings.rotateFull), sectionMs: rotateSectionMs(settings.rotateSection) } : null,
    ...customWording(settings, qr?.kind === "link" ? cleanQrLink(settings.qrTo) : ""),
  };
}

/** What the custom menu shows, defaults filled in; null for the standard menu. */
export function customLook(state: MenuState, srcOf: (link: string) => string | null): CustomLook | null {
  return state.style === "custom" ? customLookOf(state, srcOf) : null;
}

/** How long the pages stay up, as the live screen receives it: only times from the tables, or null (no rotation). */
function readRotation(raw: unknown): RotationTiming | null {
  if (!raw || typeof raw !== "object") return null;
  const { fullMs, sectionMs } = raw as Record<string, unknown>;
  const full = ROTATE_FULL.find((entry) => entry.ms === fullMs);
  const section = ROTATE_SECTION.find((entry) => entry.ms === sectionMs);
  return full && section ? { fullMs: full.ms, sectionMs: section.ms } : null;
}

/**
 * The custom look as the live screen receives it, or null for none. It needs
 * the colour and headline as text (what every server has sent); anything
 * else missing reads as its default, so an older server's answer draws a
 * custom menu with no QR and no rotation. The QR must be one of the live
 * screen's own codes for a link, or a picture address cleanAssetUrl accepts:
 * never an address from elsewhere, and never the question form.
 */
export function readCustomLook(raw: unknown): CustomLook | null {
  if (!raw || typeof raw !== "object") return null;
  const look = raw as Record<string, unknown>;
  if (typeof look.color !== "string" || typeof look.headline !== "string") return null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const qr = readShownQr(look.qr);
  return {
    color: look.color, headline: look.headline,
    note: text(look.note),
    noteColor: typeof look.noteColor === "string" ? look.noteColor : look.color,
    font: isMenuFont(look.font) ? look.font : DEFAULT_MENU_FONT,
    bartender: text(look.bartender),
    bartenderFont: isScriptFont(look.bartenderFont) ? look.bartenderFont : DEFAULT_SCRIPT_FONT,
    bartenderColor: typeof look.bartenderColor === "string" ? look.bartenderColor : look.color,
    qr: qr && qr.kind !== "form" ? qr : null,
    rotate: readRotation(look.rotate),
    ...customWording(look),
  };
}

/** Plain names for the custom menu's settings, for the Control Center's error words. */
const SETTING_NAMES: Record<keyof CustomMenuSettings, string> = {
  color: "text colour", headline: "line above the QR code", note: "note", noteColor: "note colour",
  font: "font", bartender: "bartender's name", bartenderFont: "bartender's font", bartenderColor: "bartender's colour",
  qrKind: "QR code choice", qrTo: "QR code's web address", qrImage: "QR picture", qrSize: "QR code size",
  rotateOn: "rotation switch", rotateFull: "time the full menu stays up", rotateSection: "time each section page stays up",
  customMarquee: "marquee for this menu",
  heading: "heading", qrCaption: "small line under the QR code", qrTitle: "big line under the QR code", qrLink: "web address under the QR code", bartenderLabel: "label over the bartender",
};

export const CUSTOM_MENU_KEYS = Object.keys(SETTING_NAMES) as (keyof CustomMenuSettings)[];

/**
 * A change to the custom menu sent from the Control Center: any of its
 * settings, each checked and cleaned as it is kept; the rest are left as
 * saved. Keys it doesn't know are ignored (an older or newer Control
 * Center's), but at least one it knows must be there. A setting that can't
 * be used turns the whole change away, with plain words saying which.
 */
export function parseCustomMenuChange(raw: unknown): { change: Partial<CustomMenuSettings> } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Nothing to save on the custom menu." };
  const value = raw as Record<string, unknown>;
  const change: Record<string, unknown> = {};
  const broken = (key: keyof CustomMenuSettings) => ({ error: `The custom menu's ${SETTING_NAMES[key]} didn't come through. Reload the Control Center and try again.` });
  for (const key of CUSTOM_MENU_KEYS) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (key === "color" || key === "noteColor" || key === "bartenderColor") {
      if (typeof entry !== "string") return broken(key);
      if (entry.trim() && !cleanColor(entry)) return { error: `The ${SETTING_NAMES[key]} isn't a colour the screen can show. Pick it again.` };
      change[key] = cleanColor(entry);
    } else if (key === "font" || key === "bartenderFont") {
      if (entry !== "" && !(key === "font" ? isMenuFont(entry) : isScriptFont(entry))) return broken(key);
      change[key] = entry;
    } else if (key === "qrKind") {
      if (!isQrKind(entry)) return broken(key);
      change[key] = entry;
    } else if (key === "qrTo") {
      if (typeof entry !== "string") return broken(key);
      const link = cleanQrLink(entry);
      if (entry.trim() && !link) return { error: "That web address can't be used for a QR code: it needs to start with https://" };
      change[key] = link;
    } else if (key === "qrImage") {
      if (typeof entry !== "string") return broken(key);
      const image = cleanAssetUrl(entry);
      if (entry.trim() && !image) return { error: "That picture's address can't be used. Upload the picture again, or use an https:// address." };
      change[key] = image;
    } else if (key === "qrSize") {
      if (!isQrSize(entry)) return { error: "The QR code size goes from 50% to 200%, in steps of 10." };
      change[key] = entry;
    } else if (key === "rotateOn") {
      if (typeof entry !== "boolean") return broken(key);
      change[key] = entry;
    } else if (key === "rotateFull" || key === "rotateSection") {
      if (!(key === "rotateFull" ? isRotateFull(entry) : isRotateSection(entry))) return broken(key);
      change[key] = entry;
    } else {
      if (typeof entry !== "string") return broken(key);
      change[key] = key === "headline" ? cleanHeadline(entry)
        : key === "note" ? cleanNote(entry)
          : key === "bartender" ? cleanBartender(entry)
            : key === "customMarquee" ? cleanMarquee(entry)
              : cleanWording(key, entry);
    }
  }
  if (!Object.keys(change).length) return { error: "Nothing to save on the custom menu." };
  return { change: change as Partial<CustomMenuSettings> };
}

/** Drawn as typed, so a change of capitals is a change. The rest of the custom menu's words are drawn in capitals, and colours are the same colour in any case. */
const AS_TYPED: ReadonlySet<keyof CustomMenuSettings> = new Set<keyof CustomMenuSettings>(["bartender", "qrLink", "qrTo", "qrImage"]);

/** One setting as it would be saved: cleaned as the server keeps it, and "" where it says the same as the default. */
function settingToSave(settings: CustomMenuSettings, key: keyof CustomMenuSettings): CustomMenuSettings[keyof CustomMenuSettings] {
  const entry = settings[key];
  if (key === "color") return cleanColor(entry) === DEFAULT_MENU_COLOR ? "" : cleanColor(entry);
  if (key === "noteColor" || key === "bartenderColor") return cleanColor(entry);
  if (key === "font") return entry === DEFAULT_MENU_FONT || !isMenuFont(entry) ? "" : entry;
  if (key === "bartenderFont") return entry === DEFAULT_SCRIPT_FONT || !isScriptFont(entry) ? "" : entry;
  if (key === "headline") return cleanHeadline(entry);
  if (key === "note") return cleanNote(entry);
  if (key === "bartender") return cleanBartender(entry);
  if (key === "customMarquee") return cleanMarquee(entry);
  // A link or picture that can't be used is sent as typed, so the server says what is wrong rather than it quietly going.
  if (key === "qrTo") return cleanQrLink(entry) || String(entry).trim();
  if (key === "qrImage") return cleanAssetUrl(entry) || String(entry).trim();
  if (key === "heading" || key === "qrCaption" || key === "qrTitle" || key === "qrLink" || key === "bartenderLabel") return wordingToSave(key, String(entry));
  return entry;
}

/**
 * What the custom menu card's Save sends: only the settings that would
 * change what is saved, each as it would be saved. Words the board draws in
 * capitals compare in any case, colours as colours, and the bartender's
 * name, the web address and the QR's link and picture exactly as typed.
 */
export function customMenuChanges(saved: CustomMenuSettings, next: CustomMenuSettings): Partial<CustomMenuSettings> {
  const change: Record<string, unknown> = {};
  for (const key of CUSTOM_MENU_KEYS) {
    const before = saved[key];
    const after = settingToSave(next, key);
    const same = typeof before === "string" && typeof after === "string"
      ? AS_TYPED.has(key) ? before === after : before.toUpperCase() === after.toUpperCase()
      : before === after;
    if (!same) change[key] = after;
  }
  return change as Partial<CustomMenuSettings>;
}

/**
 * The marquee the live screen runs: only while a menu is up with the
 * marquee on. The standard menu runs the host's text, or the default until
 * they write one; the custom (daytime) menu runs only its own text, and no
 * marquee at all until the host gives it one, since the default is show
 * branding.
 */
export function liveMarquee(state: MenuState): string | null {
  if (!state.on || !state.marqueeOn) return null;
  if (state.style === "custom") return state.customMarquee || null;
  return state.marquee || DEFAULT_MARQUEE;
}

/** How fast the live screen runs it, and in what colour ("" for the menu's text colour); null while no menu is up. */
export function liveMarqueeLook(state: MenuState): { speed: number; color: string } | null {
  return state.on ? { speed: marqueeSpeedOf(state.marqueeSpeed), color: state.marqueeColor } : null;
}

/** How the marquee runs: on or off, its speed ("" for Normal) and its colour ("" for the menu's text colour). */
export type MarqueeStyle = { on: boolean; speed: string; color: string };

/** The marquee as the Control Center edits it: its text ("" for the default), the daytime menu's own text ("" for none) and how it runs. */
export type MarqueeSettings = MarqueeStyle & { text: string; custom: string };

/** What one marquee Save sends: the text, how it runs, the daytime menu's text, or any of them together. */
export type MarqueeChange = { text?: string; style?: MarqueeStyle; custom?: string };

/**
 * What the marquee's one Save sends. The server keeps the text, the style
 * and the daytime menu's text as separate changes, so each goes only when it
 * would change what is saved, and a part the host left alone is never
 * written over. Text is compared cleaned, as the server keeps it, and the
 * colour in any case.
 */
export function marqueeChange(saved: MarqueeSettings, next: MarqueeSettings): MarqueeChange {
  const text = cleanMarquee(next.text);
  const custom = cleanMarquee(next.custom);
  const restyled = next.on !== saved.on || next.speed !== saved.speed || next.color.trim().toUpperCase() !== saved.color.trim().toUpperCase();
  return {
    ...(text === cleanMarquee(saved.text) ? {} : { text }),
    ...(restyled ? { style: { on: next.on, speed: next.speed, color: next.color } } : {}),
    ...(custom === cleanMarquee(saved.custom) ? {} : { custom }),
  };
}

/** Joins the names of drinks that share one line. */
export const SAME_PRICE_JOIN = " · ";

/**
 * A section with its drinks of one price on one line, to save room: drinks
 * with no detail line that cost the same are drawn as one line, their names
 * joined, the price once, where the first of them sits. A drink with a
 * detail keeps its own line, and so does a drink with no price; a section
 * that lists one price for all its drinks has nothing to join. The same
 * section comes back when nothing joins.
 */
export function compactSection(section: DrinkSection): DrinkSection {
  if (section.price || section.shared) return section;
  const lines: Drink[] = [];
  // Each price's line so far, by its place in `lines`.
  const linesByPrice = new Map<string, number>();
  let joined = false;
  for (const drink of section.drinks) {
    const price = drink.price?.trim() ?? "";
    if (!price || drink.detail) {
      lines.push(drink);
      continue;
    }
    const at = linesByPrice.get(price);
    if (at === undefined) {
      linesByPrice.set(price, lines.length);
      lines.push(drink);
      continue;
    }
    const first = lines[at];
    const names = [...(first.names ?? [first.name]), drink.name];
    lines[at] = { ...first, name: names.join(SAME_PRICE_JOIN), names };
    joined = true;
  }
  return joined ? { ...section, drinks: lines } : section;
}

/** Every section of a board through compactSection. */
export function compactMenu(columns: DrinkSection[][]): DrinkSection[][] {
  return columns.map((column) => column.map(compactSection));
}

/**
 * The drink menu as the Control Center shows it: which one is up, and every
 * saved setting ("" for a default). One shape for every answer about the
 * menu, so a page reads them all the same way.
 */
export type MenuView = {
  menu: boolean; menuStyle: MenuStyle; marquee: string;
  menuColor: string; menuHeadline: string; menuNote: string; menuNoteColor: string;
  menuFont: string; menuBartender: string; menuBartenderFont: string; menuBartenderColor: string;
  marqueeOn: boolean; marqueeSpeed: string; marqueeColor: string;
  menuQrCaption: string; menuQrTitle: string; menuQrLink: string; menuBartenderLabel: string;
  menuHeading: string; menuQrKind: QrKind; menuQrTo: string; menuQrImage: string; menuQrSize: number;
  menuRotateOn: boolean; menuRotateFull: RotateFullId; menuRotateSection: RotateSectionId;
  marqueeCustom: string; menuSamePriceLine: boolean;
};

export function menuView(menu: MenuState): MenuView {
  return {
    menu: menu.on, menuStyle: menu.style, marquee: menu.marquee,
    menuColor: menu.color, menuHeadline: menu.headline, menuNote: menu.note, menuNoteColor: menu.noteColor,
    menuFont: menu.font, menuBartender: menu.bartender, menuBartenderFont: menu.bartenderFont, menuBartenderColor: menu.bartenderColor,
    marqueeOn: menu.marqueeOn, marqueeSpeed: menu.marqueeSpeed, marqueeColor: menu.marqueeColor,
    menuQrCaption: menu.qrCaption, menuQrTitle: menu.qrTitle, menuQrLink: menu.qrLink, menuBartenderLabel: menu.bartenderLabel,
    menuHeading: menu.heading, menuQrKind: menu.qrKind, menuQrTo: menu.qrTo, menuQrImage: menu.qrImage, menuQrSize: menu.qrSize,
    menuRotateOn: menu.rotateOn, menuRotateFull: menu.rotateFull, menuRotateSection: menu.rotateSection,
    marqueeCustom: menu.customMarquee, menuSamePriceLine: menu.samePriceLine,
  };
}

/** Nothing saved yet: every setting at its default, the menu down. */
export const NO_MENU_VIEW: MenuView = menuView(parseMenuState(null));

/**
 * An answer about the menu, read field by field: anything missing or of the
 * wrong kind keeps `current`'s value. An older server's answer (after a
 * rollback) lacks the newer fields, and one missing must never take the
 * Control Center down mid-show.
 */
export function readMenuView(raw: unknown, current: MenuView): MenuView {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const text = (key: keyof MenuView) => (typeof value[key] === "string" ? value[key] as string : current[key] as string);
  const flag = (key: keyof MenuView) => (typeof value[key] === "boolean" ? value[key] as boolean : current[key] as boolean);
  return {
    menu: flag("menu"),
    menuStyle: value.menuStyle === "custom" || value.menuStyle === "standard" ? value.menuStyle : current.menuStyle,
    marquee: text("marquee"),
    menuColor: text("menuColor"), menuHeadline: text("menuHeadline"), menuNote: text("menuNote"), menuNoteColor: text("menuNoteColor"),
    menuFont: text("menuFont"), menuBartender: text("menuBartender"), menuBartenderFont: text("menuBartenderFont"), menuBartenderColor: text("menuBartenderColor"),
    marqueeOn: flag("marqueeOn"), marqueeSpeed: text("marqueeSpeed"), marqueeColor: text("marqueeColor"),
    menuQrCaption: text("menuQrCaption"), menuQrTitle: text("menuQrTitle"), menuQrLink: text("menuQrLink"), menuBartenderLabel: text("menuBartenderLabel"),
    menuHeading: text("menuHeading"),
    menuQrKind: isQrKind(value.menuQrKind) ? value.menuQrKind : current.menuQrKind,
    menuQrTo: text("menuQrTo"), menuQrImage: text("menuQrImage"),
    menuQrSize: isQrSize(value.menuQrSize) ? value.menuQrSize : current.menuQrSize,
    menuRotateOn: flag("menuRotateOn"),
    menuRotateFull: isRotateFull(value.menuRotateFull) ? value.menuRotateFull : current.menuRotateFull,
    menuRotateSection: isRotateSection(value.menuRotateSection) ? value.menuRotateSection : current.menuRotateSection,
    marqueeCustom: text("marqueeCustom"), menuSamePriceLine: flag("menuSamePriceLine"),
  };
}

/** The custom menu's settings out of the Control Center's view, for its card. */
export function customSettingsOf(view: MenuView): CustomMenuSettings {
  return {
    color: view.menuColor, headline: view.menuHeadline, note: view.menuNote, noteColor: view.menuNoteColor,
    font: view.menuFont, bartender: view.menuBartender, bartenderFont: view.menuBartenderFont, bartenderColor: view.menuBartenderColor,
    qrKind: view.menuQrKind, qrTo: view.menuQrTo, qrImage: view.menuQrImage, qrSize: view.menuQrSize,
    rotateOn: view.menuRotateOn, rotateFull: view.menuRotateFull, rotateSection: view.menuRotateSection,
    customMarquee: view.marqueeCustom,
    heading: view.menuHeading, qrCaption: view.menuQrCaption, qrTitle: view.menuQrTitle, qrLink: view.menuQrLink, bartenderLabel: view.menuBartenderLabel,
  };
}

/** Every custom menu setting at its default: what "Use defaults" on its card goes back to. */
export const DEFAULT_CUSTOM_MENU: CustomMenuSettings = customSettingsOf(NO_MENU_VIEW);
