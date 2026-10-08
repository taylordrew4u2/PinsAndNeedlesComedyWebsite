/**
 * The fonts the custom drink menu can be set in, and the script fonts for the
 * bartender's name. Only ids live here, so the server can check a choice; the
 * font files themselves are loaded by `src/components/menu-font-faces.ts`.
 *
 * `scale` shrinks the menu's type for fonts wider than the standard Barlow
 * Condensed, so every drink still fits its column on one line. Each one is
 * the largest that fits, measured on the board with the longest line above
 * the QR, a bartender and the longest note.
 */
export const MENU_FONTS = [
  { id: "barlow", label: "Barlow Condensed", scale: 1 },
  { id: "bebas", label: "Bebas Neue", scale: 1 },
  { id: "oswald", label: "Oswald", scale: 1 },
  { id: "anton", label: "Anton", scale: 0.96 },
  { id: "playfair", label: "Playfair Display", scale: 0.85 },
  { id: "abril", label: "Abril Fatface", scale: 0.86 },
  { id: "righteous", label: "Righteous", scale: 0.85 },
  { id: "marker", label: "Permanent Marker", scale: 0.8 },
  { id: "lobster", label: "Lobster", scale: 0.95 },
] as const;

export const SCRIPT_FONTS = [
  { id: "greatvibes", label: "Great Vibes", scale: 1 },
  { id: "pinyon", label: "Pinyon Script", scale: 0.85 },
  { id: "parisienne", label: "Parisienne", scale: 0.95 },
  { id: "yellowtail", label: "Yellowtail", scale: 0.95 },
  { id: "pacifico", label: "Pacifico", scale: 0.8 },
  { id: "dancing", label: "Dancing Script", scale: 0.95 },
] as const;

export type MenuFontId = (typeof MENU_FONTS)[number]["id"];
export type ScriptFontId = (typeof SCRIPT_FONTS)[number]["id"];

export const DEFAULT_MENU_FONT: MenuFontId = "barlow";
export const DEFAULT_SCRIPT_FONT: ScriptFontId = "greatvibes";

export function isMenuFont(id: unknown): id is MenuFontId {
  return MENU_FONTS.some((font) => font.id === id);
}

export function isScriptFont(id: unknown): id is ScriptFontId {
  return SCRIPT_FONTS.some((font) => font.id === id);
}

export function menuFontScale(id: string): number {
  return MENU_FONTS.find((font) => font.id === id)?.scale ?? 1;
}

export function scriptFontScale(id: string): number {
  return SCRIPT_FONTS.find((font) => font.id === id)?.scale ?? 1;
}
