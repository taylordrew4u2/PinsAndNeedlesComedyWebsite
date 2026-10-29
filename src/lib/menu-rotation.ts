import type { DrinkSection, RotationTiming } from "./drink-menu.ts";

/**
 * The custom (daytime) menu taking turns: the full board, then its sections
 * a page at a time in big type, then the full board again, round and round.
 * Worked out here from the drinks exactly as the board shows them, so the
 * live screen and the Control Center's preview turn the same pages; the
 * timers themselves are useMenuRotation's.
 */

/** One section on a page: all of it (part 1 of 1), or one part of a long one, which repeats its heading and shared price. */
export type PageSection = { section: DrinkSection; part: number; of: number };

/** A page: the full board (no sections) or one or two sections. `key` stays the same while the page does, so an edit keeps it up. */
export type MenuPage = { key: string; sections: PageSection[] };

export const FULL_PAGE: MenuPage = { key: "full", sections: [] };

/** The most drinks on a section page, so its type can be big. */
export const PAGE_DRINKS_MAX = 4;

/** A section this small can share a page with its neighbour. */
export const SMALL_SECTION_MAX = 2;

/** `items` in as few runs of at most `max` as it takes, as even as they can be, the longer runs first: 10 by 4 is 4, 3, 3. */
export function splitEvenly<T>(items: readonly T[], max: number): T[][] {
  if (!items.length) return [];
  const count = Math.ceil(items.length / Math.max(1, Math.floor(max)));
  const size = Math.floor(items.length / count);
  const longer = items.length % count;
  const runs: T[][] = [];
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    const length = size + (index < longer ? 1 : 0);
    runs.push(items.slice(at, at + length));
    at += length;
  }
  return runs;
}

/**
 * The pages for a board's drinks: the full board first, then the sections in
 * reading order (down the left column, then the middle, then the right),
 * skipping any with no drinks. A section longer than PAGE_DRINKS_MAX is split
 * into even parts, each its own page. A whole section joins the page before
 * when that page holds one whole section, one of the two has at most
 * SMALL_SECTION_MAX drinks, and together they fit PAGE_DRINKS_MAX: never
 * three to a page, and a part never shares. With fewer than two section
 * pages there is nothing worth turning, so it is the full board alone.
 */
export function menuPages(columns: readonly (readonly DrinkSection[])[]): MenuPage[] {
  const pages: PageSection[][] = [];
  for (const section of columns.flat()) {
    if (!section.drinks.length) continue;
    const parts = splitEvenly(section.drinks, PAGE_DRINKS_MAX);
    if (parts.length > 1) {
      parts.forEach((drinks, index) => pages.push([{ section: { ...section, drinks }, part: index + 1, of: parts.length }]));
      continue;
    }
    const last = pages[pages.length - 1];
    const alone = last && last.length === 1 && last[0].of === 1 ? last[0].section : null;
    const small = alone && (alone.drinks.length <= SMALL_SECTION_MAX || section.drinks.length <= SMALL_SECTION_MAX);
    if (alone && small && alone.drinks.length + section.drinks.length <= PAGE_DRINKS_MAX) last.push({ section, part: 1, of: 1 });
    else pages.push([{ section, part: 1, of: 1 }]);
  }
  if (pages.length < 2) return [FULL_PAGE];
  // Keys come from the sections' ids (titles on the printed menu); a key seen before gets "#2", "#3", so each page's is its own.
  const seen = new Map<string, number>();
  return [FULL_PAGE, ...pages.map((sections) => {
    const base = sections.map(({ section, part }) => `${section.id ?? section.title}:${part}`).join("+");
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { key: count > 1 ? `${base}#${count}` : base, sections };
  })];
}

/** Where the page with this key is now, so an edit keeps the same page up; the full board (0) when it is gone. */
export function keepPage(key: string | null | undefined, pages: readonly MenuPage[]): number {
  const index = key ? pages.findIndex((page) => page.key === key) : -1;
  return Math.max(0, index);
}

/** The page after this one, back to the full board after the last. */
export function nextPage(index: number, pages: readonly MenuPage[]): number {
  return pages.length ? (index + 1) % pages.length : 0;
}

/** How long a page stays up: the full board's time, or a section page's. */
export function holdMs(page: MenuPage, timing: RotationTiming): number {
  return page.sections.length ? timing.sectionMs : timing.fullMs;
}

/**
 * How much longer a page that went up at `startedAt` stays, for a hold of
 * `hold`: the hold counted from when the page went up, so a shorter time
 * picked mid-page takes effect at once, and never below 0. A clock that went
 * backwards gives the whole hold.
 */
export function rearmMs(startedAt: number, now: number, hold: number): number {
  const shown = now - startedAt;
  if (shown < 0) return hold;
  return Math.max(0, hold - shown);
}

/** A page as the Control Center names it: "Full menu", "Classic Cocktails (2 of 3)" or "White + Orange". */
export function pageLabel(page: MenuPage): string {
  if (!page.sections.length) return "Full menu";
  const title = (section: DrinkSection) => section.title.trim() || "Untitled section";
  const [first] = page.sections;
  if (page.sections.length === 1 && first.of > 1) return `${title(first.section)} (${first.part} of ${first.of})`;
  return page.sections.map((entry) => title(entry.section)).join(" + ");
}

/** One time round every page; 0 when there is nothing to turn. */
export function roundMs(pages: readonly MenuPage[], timing: RotationTiming): number {
  if (pages.length < 2) return 0;
  return pages.reduce((total, page) => total + holdMs(page, timing), 0);
}

/** "2 min 14 s", "2 min", "45 s". */
function minutesAndSeconds(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (!minutes) return `${seconds} s`;
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

/** The Control Center's sentence about the turning: how many pages, and how long one round takes. */
export function rotationSummary(pages: readonly MenuPage[], timing: RotationTiming): string {
  if (pages.length < 2) return "Only one section, so there is nothing to rotate.";
  return `The full menu, then ${pages.length - 1} section pages. One round takes about ${minutesAndSeconds(roundMs(pages, timing))}.`;
}
