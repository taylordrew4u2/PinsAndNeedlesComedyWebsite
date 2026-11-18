import { Abril_Fatface, Anton, Bebas_Neue, Dancing_Script, Great_Vibes, Lobster, Oswald, Pacifico, Parisienne, Permanent_Marker, Pinyon_Script, Playfair_Display, Righteous, Yellowtail } from "next/font/google";
import type { MenuFontId, ScriptFontId } from "@/lib/menu-fonts";

/*
 * The custom drink menu's fonts. Not preloaded: a browser only fetches the
 * one the host picked, when the menu is drawn in it.
 */
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
// Variable font (one file covers 500–700). Listing the weights separately makes
// Google repeat the same file URL per weight, which Turbopack's font loader rejects.
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false });
const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
// Variable fonts (Playfair 400–900, Dancing Script 400–700): no weight list, same reason as Oswald.
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false });
const abril = Abril_Fatface({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const righteous = Righteous({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const lobster = Lobster({ weight: "400", subsets: ["latin"], display: "swap", preload: false });

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const parisienne = Parisienne({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const yellowtail = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const dancing = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false });

/** The standard menu's font, loaded once for the whole site in the root layout. */
const POSTER = "var(--font-poster), 'Barlow Condensed', 'Arial Narrow', sans-serif";

export const MENU_FONT_FAMILY: Record<MenuFontId, string> = {
  barlow: POSTER,
  bebas: `${bebas.style.fontFamily}, ${POSTER}`,
  oswald: `${oswald.style.fontFamily}, ${POSTER}`,
  anton: `${anton.style.fontFamily}, ${POSTER}`,
  playfair: `${playfair.style.fontFamily}, Georgia, serif`,
  abril: `${abril.style.fontFamily}, Georgia, serif`,
  righteous: `${righteous.style.fontFamily}, ${POSTER}`,
  marker: `${marker.style.fontFamily}, ${POSTER}`,
  lobster: `${lobster.style.fontFamily}, Georgia, serif`,
};

export const SCRIPT_FONT_FAMILY: Record<ScriptFontId, string> = {
  greatvibes: `${greatVibes.style.fontFamily}, cursive`,
  pinyon: `${pinyon.style.fontFamily}, cursive`,
  parisienne: `${parisienne.style.fontFamily}, cursive`,
  yellowtail: `${yellowtail.style.fontFamily}, cursive`,
  pacifico: `${pacifico.style.fontFamily}, cursive`,
  dancing: `${dancing.style.fontFamily}, cursive`,
};
