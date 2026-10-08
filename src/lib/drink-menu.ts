/**
 * The venue's drink menu, as the live screen shows it between sets. Copied
 * from Pixelated Records' printed menu; edit here when their list changes.
 */
export type Drink = { name: string; price?: string; detail?: string };
export type DrinkSection = { title: string; price?: string; drinks: Drink[] };

export const DRINK_MENU: DrinkSection[][] = [
  [
    {
      title: "Beers, Cider, Seltzer",
      drinks: [
        { name: "White Claw Black Cherry", price: "$4" },
        { name: "Modelo Especial", price: "$5" },
        { name: "Chelada", price: "$7", detail: "Glass of Ice, Lime & Salt" },
        { name: "Hudson North Big Apple Cider", price: "$6", detail: "Crisp" },
        { name: "KCBC Superhero Sidekicks", price: "$7", detail: "Hazy IPA" },
        { name: "Back Home Beer Sumac Gose", price: "$8", detail: "Tart Cherry" },
      ],
    },
    {
      title: "Non-Alcoholic",
      drinks: [
        { name: "Athletic Free Wave", price: "$6", detail: "Hazy IPA" },
        { name: "Athletic Fruited Fields", price: "$6", detail: "Radler" },
      ],
    },
  ],
  [
    {
      title: "Specialty Cocktails",
      price: "$13",
      drinks: [
        { name: "Gucci Lemonade", detail: "Gin · Vermouth · Lemon Juice · Simple Syrup · Bitters · Sparkling Water" },
        { name: "Whiskey Winehouse", detail: "Whiskey · Malbec · Lemon Juice · Simple Syrup · Cardamom" },
        { name: "Cherry Funk", detail: "Rum · Vermouth · Cherry Blossom Extract · Coconut Extract · Lemon Juice · Ginger Beer · Pineapple" },
      ],
    },
    {
      title: "Highballs",
      price: "$11",
      drinks: [
        { name: "Choice of Well Spirit + Mixer", detail: "Gin · Rum · Tequila · Vodka · Whiskey" },
        { name: "Mixers", detail: "Club Soda · Tonic · Lemon/Sour · Ginger Ale · Cranberry · Cola" },
      ],
    },
  ],
  [
    {
      title: "Red Wine",
      drinks: [
        { name: "Vigna Madre Kriya", price: "$8", detail: "Montepulciano · Italy" },
        { name: "Bernardus", price: "$9", detail: "Pinot Noir · Santa Lucia Highlands · ’23" },
        { name: "Gérard Bertrand Naturae", price: "$10", detail: "Cabernet Sauvignon · France · ’24" },
      ],
    },
    {
      title: "White Wine",
      drinks: [
        { name: "Oyster Bay", price: "$9", detail: "Sauvignon Blanc · New Zealand" },
        { name: "Cave de Lugny Mâcon-Villages", price: "$9", detail: "Chardonnay · France · ’23" },
        { name: "Viña Echeverría No Es Pituko", price: "$11", detail: "Orange · Chile" },
      ],
    },
    {
      title: "Rosé & Sparkling",
      drinks: [
        { name: "Josh Scott Bla Bla Bla", price: "$8", detail: "Rosé · New Zealand · ’22" },
        { name: "Maschio DOC Treviso Brut", price: "$10", detail: "Prosecco · Italy" },
      ],
    },
  ],
];

/** What runs around the drink menu when the host has not set a marquee of their own. */
export const DEFAULT_MARQUEE = "Pins & Needles Comedy";

/** Longest marquee the Control Center accepts; long enough for a plug, short enough to read. */
export const MARQUEE_MAX = 140;

/** Longest line the host can put above the QR code on the custom menu. */
export const HEADLINE_MAX = 80;

/** Longest note the host can put in the empty space under the menu's first two columns. */
export const NOTE_MAX = 120;

/** What the custom menu says above the QR code until the host writes their own. */
export const DEFAULT_HEADLINE = "Don’t miss the 9 PM show! Scan here for Bad Decisions";

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
export type MenuState = { on: boolean; style: MenuStyle; marquee: string; color: string; headline: string; note: string; noteColor: string };

/** What the custom menu draws, defaults filled in. */
export type CustomLook = { color: string; headline: string; note: string; noteColor: string };

/** One line of plain text, trimmed and capped. Anything that is not a string is no text. */
function cleanLine(raw: unknown, max: number): string {
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

/** A six-digit hex colour, upper-cased; anything else is no colour (the default). */
export function cleanColor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
}

/** The stored menu record. Anything malformed reads as off, standard, with the defaults. */
export function parseMenuState(raw: unknown): MenuState {
  if (!raw || typeof raw !== "object") return { on: false, style: "standard", marquee: "", color: "", headline: "", note: "", noteColor: "" };
  const value = raw as { on?: unknown; style?: unknown; marquee?: unknown; color?: unknown; headline?: unknown; note?: unknown; noteColor?: unknown };
  return {
    on: value.on === true,
    style: value.style === "custom" ? "custom" : "standard",
    marquee: cleanMarquee(value.marquee),
    color: cleanColor(value.color),
    headline: cleanHeadline(value.headline),
    note: cleanNote(value.note),
    noteColor: cleanColor(value.noteColor),
  };
}

/** What the custom menu shows, defaults filled in; null for the standard menu. */
export function customLook(state: MenuState): CustomLook | null {
  if (state.style !== "custom") return null;
  const color = state.color || DEFAULT_MENU_COLOR;
  return { color, headline: state.headline || DEFAULT_HEADLINE, note: state.note, noteColor: state.noteColor || color };
}
