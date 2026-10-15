import type { ShowPerformer } from "./types";

/**
 * Pasting a whole lineup at once: one person per line, each with their
 * Instagram, the way it gets typed into a group chat or copied off a flyer.
 *
 *   Sam Rivera @samcomic
 *   Host: Jo Park - instagram.com/jopark
 *   Alex Kim (@alexkimcomedy)
 *   Dana Lee, https://www.instagram.com/danalee.laughs/
 *   Priya
 *   @priya.funny
 *
 * Every line becomes its own person on the bill, linked to their Instagram
 * (or their website, if that is the link given). A handle alone on the next
 * line belongs to the name above it. "Host:" and the like in front of a name
 * set that person's role; everyone else gets the role picked for the paste.
 */
export type PastedPerformer = { name: string; url: string; role: string };

/** Instagram's own rules: letters, numbers, dots and underscores, at most 30, never ending in a dot. */
const HANDLE = "[A-Za-z0-9_][A-Za-z0-9._]{0,29}";
const INSTAGRAM_URL = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:instagram\\.com|instagr\\.am)\\/(${HANDLE})\\/?(?:[?#]\\S*)?`, "i");
/** "@handle", but not the middle of an email address. */
const AT_HANDLE = new RegExp(`(?:^|[\\s(\\[,|:])@(${HANDLE})`);
/** "IG: handle", "insta - handle", "Instagram handle" (the word on its own, not inside a web address). */
const LABELLED_HANDLE = new RegExp(`(?:^|\\s)(?:ig|insta|instagram)(?![.\\w])\\s*[:\\-–—]?\\s*@?(${HANDLE})`, "i");
/** A label left over once its link is taken out: "Instagram:", "IG -". */
const LEFTOVER_LABEL = /(?:^|\s)(?:ig|insta|instagram)\s*[:\-–—]?\s*$/i;
/** A role in front of a name is never one of these words. */
const NOT_A_ROLE = /\b(?:ig|insta|instagram|website|site|link|web)\b/i;
const OTHER_URL = /\bhttps?:\/\/\S+|\bwww\.\S+/i;
/** "Host:" and other short role words in front of a name. */
const ROLE_PREFIX = /^([A-Za-z][A-Za-z ]{1,24}):\s+(?=\S)/;
/** List markers people paste with: "-", "•", "*", "1.", "2)". */
const BULLET = /^\s*(?:[-–—•*·]+|\d{1,3}[.)])\s+/;
/** Joiners left between a name and its link once the link is taken out. */
const EDGES = /^[\s,;|:–—\-()[\]]+|[\s,;|:–—\-()[\]]+$/g;

export const NAME_MAX = 80;
export const PASTE_MAX = 60;

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

function cleanHandle(raw: string): string {
  return raw.replace(/\.+$/, "");
}

/** The link in one piece of text (an Instagram first), and the text without it. */
function takeLink(text: string): { link: string; rest: string } {
  const url = text.match(INSTAGRAM_URL);
  if (url) {
    const handle = cleanHandle(url[1]);
    // instagram.com/p/… and other non-profile paths are not someone's account: no link, and out of the name.
    if (["p", "reel", "reels", "stories", "explore", "tv"].includes(handle.toLowerCase())) {
      return { link: "", rest: text.replace(/(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/\S*/i, " ") };
    }
    if (handle) return { link: instagramUrl(handle), rest: text.replace(url[0], " ") };
  }
  const at = text.match(AT_HANDLE);
  if (at && cleanHandle(at[1])) return { link: instagramUrl(cleanHandle(at[1])), rest: text.replace(`@${at[1]}`, " ") };
  const labelled = text.match(LABELLED_HANDLE);
  if (labelled && cleanHandle(labelled[1])) return { link: instagramUrl(cleanHandle(labelled[1])), rest: text.replace(labelled[0], " ") };
  const other = text.match(OTHER_URL);
  if (other) {
    const raw = other[0].replace(/[),.;]+$/, "");
    return { link: raw.startsWith("www.") ? `https://${raw}` : raw, rest: text.replace(other[0], " ") };
  }
  return { link: "", rest: text };
}

function tidyName(text: string): string {
  return text.replace(/\s+/g, " ").replace(EDGES, "").replace(LEFTOVER_LABEL, "").replace(EDGES, "").trim().slice(0, NAME_MAX).trim();
}

/** Pieces of one line: usually the line itself, or each "Name @handle" when several share a line. */
function piecesOf(line: string): string[] {
  const links = line.match(new RegExp(`${INSTAGRAM_URL.source}|${AT_HANDLE.source}`, "gi")) ?? [];
  if (links.length < 2) return [line];
  return line.split(/\s*[,;]\s*|\s+\/\s+/).filter((piece) => piece.trim());
}

export function parseLineupPaste(text: string, defaultRole: string): PastedPerformer[] {
  const people: PastedPerformer[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    for (const piece of piecesOf(rawLine.replace(BULLET, ""))) {
      let line = piece.trim();
      if (!line) continue;
      let role = defaultRole;
      const prefix = line.match(ROLE_PREFIX);
      // "Host: Sam" sets a role. "Instagram: sam" is a link, and in "Sam Rivera: @sam" the part before the colon is the name.
      if (prefix && !NOT_A_ROLE.test(prefix[1])
        && tidyName(takeLink(line.slice(prefix[0].length)).rest)) {
        role = prefix[1].trim();
        line = line.slice(prefix[0].length);
      }
      const { link, rest } = takeLink(line);
      const name = tidyName(rest);
      const last = people[people.length - 1];
      // A link on its own line belongs to the name just above it.
      if (!name && link && last && !last.url) {
        last.url = link;
        continue;
      }
      const shown = name || (link.includes("instagram.com/") ? link.split("/").filter(Boolean).pop() ?? "" : "");
      if (!shown) continue;
      const key = shown.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({ name: shown, url: link, role });
      if (people.length >= PASTE_MAX) return people;
    }
  }
  return people;
}

/**
 * The pasted people on the bill. Someone already on it (same name, any
 * capitals) keeps their entry; if it has no link yet, it gets the pasted one.
 */
export function addPasted(
  lineup: ShowPerformer[],
  pasted: PastedPerformer[],
  makeId: () => string,
): { lineup: ShowPerformer[]; added: number; linked: number; skipped: number } {
  const next = lineup.map((person) => ({ ...person }));
  const byName = new Map(next.map((person) => [person.name.trim().replace(/\s+/g, " ").toLowerCase(), person]));
  let added = 0;
  let linked = 0;
  let skipped = 0;
  for (const person of pasted) {
    const have = byName.get(person.name.toLowerCase());
    if (have) {
      if (!have.url.trim() && person.url) { have.url = person.url; linked += 1; } else skipped += 1;
      continue;
    }
    const entry: ShowPerformer = { id: makeId(), name: person.name, role: person.role, note: "", imageUrl: "", imageAlt: "", url: person.url };
    next.push(entry);
    byName.set(person.name.toLowerCase(), entry);
    added += 1;
  }
  return { lineup: next, added, linked, skipped };
}
