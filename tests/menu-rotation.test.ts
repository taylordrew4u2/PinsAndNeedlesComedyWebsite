import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FULL_PAGE, PAGE_DRINKS_MAX, SMALL_SECTION_MAX, holdMs, keepPage, menuPages, nextPage, pageLabel, rearmMs, rotationSummary, roundMs, splitEvenly, type MenuPage,
} from "../src/lib/menu-rotation.ts";
import { boardDrinks, visibleMenu } from "../src/lib/drink-list.ts";
import type { DrinkSection } from "../src/lib/drink-menu.ts";

const TIMING = { fullMs: 30_000, sectionMs: 8_000 };
const drinks = (count: number, prefix = "D") => Array.from({ length: count }, (_, index) => ({ name: `${prefix}${index + 1}`, price: `$${index + 5}` }));
const sectionOf = (title: string, count: number, id?: string): DrinkSection => ({ ...(id ? { id } : {}), title, drinks: drinks(count, title) });
/** Each page as its key and how many drinks each of its sections has. */
const shape = (pages: readonly MenuPage[]) => pages.map((page) => [page.key, page.sections.map((entry) => entry.section.drinks.length).join("+")]);

test("splitEvenly: as few runs as it takes, as even as they can be, the longer runs first", () => {
  const sizes = (count: number) => splitEvenly(Array.from({ length: count }, (_, index) => index), PAGE_DRINKS_MAX).map((run) => run.length);
  assert.deepEqual(sizes(10), [4, 3, 3]);
  assert.deepEqual(sizes(9), [3, 3, 3]);
  assert.deepEqual(sizes(8), [4, 4]);
  assert.deepEqual(sizes(7), [4, 3]);
  assert.deepEqual(sizes(5), [3, 2]);
  assert.deepEqual(sizes(4), [4]);
  assert.deepEqual(sizes(0), []);
  // Nothing is lost or reordered.
  assert.deepEqual(splitEvenly([1, 2, 3, 4, 5], 2).flat(), [1, 2, 3, 4, 5]);
});

test("the printed menu, each drink on its own line, turns through the full board and 13 section pages", () => {
  const pages = menuPages(visibleMenu(null));
  assert.deepEqual(shape(pages), [
    ["full", ""],
    ["s1:1", "4"], ["s1:2", "3"],
    ["s2:1", "3"],
    ["s3:1+s4:1", "2+2"],
    ["s5:1", "3"],
    ["s6:1", "3"],
    ["s7:1", "4"], ["s7:2", "3"], ["s7:3", "3"],
    ["s8:1", "3"],
    ["s9:1+s10:1", "2+1"],
    ["s11:1+s12:1", "1+1"],
    ["s13:1", "4"],
  ]);
  assert.deepEqual(pages.map(pageLabel), [
    "Full menu",
    "Beer, Cider & Seltzer (1 of 2)", "Beer, Cider & Seltzer (2 of 2)",
    "Zero Proof",
    "Shots, Neat & Rocks + Sodas & More",
    "Highballs",
    "Specialty Cocktails",
    "Classic Cocktails (1 of 3)", "Classic Cocktails (2 of 3)", "Classic Cocktails (3 of 3)",
    "Red",
    "White + Orange",
    "Rosé + Sparkling",
    "Sparkling Cocktails",
  ]);
  // 30 s for the full board and 8 s for each section page.
  assert.equal(roundMs(pages, TIMING), 134_000);
  assert.equal(rotationSummary(pages, TIMING), "The full menu, then 13 section pages. One round takes about 2 min 14 s.");
});

test("the printed menu as the board draws it by default, one price's drinks on one line, has Classic Cocktails on one page", () => {
  const pages = menuPages(boardDrinks(null, true));
  assert.equal(pages.length, 12);
  const classic = pages.find((page) => page.key === "s7:1");
  assert.ok(classic);
  assert.equal(pageLabel(classic), "Classic Cocktails");
  assert.equal(classic.sections[0].section.drinks.length, 4);
  assert.equal(roundMs(pages, TIMING), 30_000 + 11 * 8_000);
});

test("small neighbours share a page: never three to a page, and a part of a long section never shares", () => {
  const pages = menuPages([[sectionOf("A", 1), sectionOf("B", 1), sectionOf("C", 1)], [sectionOf("D", 5), sectionOf("E", 1)], [sectionOf("F", 3), sectionOf("G", 2)]]);
  // C can't join A and B (three to a page), D's parts take no neighbour, E and F fit together, and G can't make three.
  assert.deepEqual(shape(pages), [["full", ""], ["A:1+B:1", "1+1"], ["C:1", "1"], ["D:1", "3"], ["D:2", "2"], ["E:1+F:1", "1+3"], ["G:1", "2"]]);
  // Two of three drinks each are too many for one page.
  assert.deepEqual(shape(menuPages([[sectionOf("A", 3)], [sectionOf("B", 3)], []])), [["full", ""], ["A:1", "3"], ["B:1", "3"]]);
  for (const page of pages) {
    assert.ok(page.sections.length <= 2, page.key);
    if (page.sections.length === 2) {
      assert.ok(page.sections.every((entry) => entry.of === 1), page.key);
      const [first, second] = page.sections.map((entry) => entry.section.drinks.length);
      assert.ok(first + second <= PAGE_DRINKS_MAX && Math.min(first, second) <= SMALL_SECTION_MAX, page.key);
    }
  }
});

test("a part of a long section repeats its heading and shared price, and says which part it is", () => {
  const pages = menuPages([[{ id: "h", title: "Highballs", price: "$11", drinks: drinks(6) }], [sectionOf("B", 2)], []]);
  const parts = pages.filter((page) => page.key.startsWith("h:"));
  assert.equal(parts.length, 2);
  for (const [index, page] of parts.entries()) {
    assert.equal(page.sections[0].section.title, "Highballs");
    assert.equal(page.sections[0].section.price, "$11");
    assert.deepEqual([page.sections[0].part, page.sections[0].of], [index + 1, 2]);
  }
  assert.equal(pageLabel(parts[1]), "Highballs (2 of 2)");
});

test("one section, or none with drinks, is nothing worth turning: the full board alone", () => {
  assert.deepEqual(menuPages([[sectionOf("A", 3)], [], []]), [FULL_PAGE]);
  assert.deepEqual(menuPages([[sectionOf("A", 0)], [sectionOf("B", 0)], []]), [FULL_PAGE]);
  assert.deepEqual(menuPages([[], [], []]), [FULL_PAGE]);
  assert.equal(roundMs([FULL_PAGE], TIMING), 0);
  assert.equal(rotationSummary([FULL_PAGE], TIMING), "Only one section, so there is nothing to rotate.");
  // A section's empty title still has a name in the Control Center.
  assert.equal(pageLabel(menuPages([[sectionOf("", 3)], [sectionOf("B", 3)], []])[1]), "Untitled section");
});

test("pages are keyed by the sections' ids, or titles, and a repeated key gets a number so each is its own", () => {
  const pages = menuPages([[sectionOf("Beer", 3), sectionOf("Beer", 3)], [sectionOf("Wine", 3, "w")], []]);
  assert.deepEqual(pages.map((page) => page.key), ["full", "Beer:1", "Beer:1#2", "w:1"]);
});

test("turning: each page after the one before, back to the full board after the last; an edit keeps the same page up", () => {
  const pages = menuPages(visibleMenu(null));
  assert.equal(nextPage(0, pages), 1);
  assert.equal(nextPage(pages.length - 1, pages), 0);
  assert.equal(nextPage(0, []), 0);
  assert.equal(keepPage("s7:2", pages), 8);
  // Gone (the section hidden, or now too short for a third part): the full board.
  assert.equal(keepPage("s7:3", menuPages(boardDrinks(null, true))), 0);
  assert.equal(keepPage(null, pages), 0);
  assert.equal(keepPage(undefined, pages), 0);
  assert.equal(holdMs(FULL_PAGE, TIMING), 30_000);
  assert.equal(holdMs(pages[3], TIMING), 8_000);
});

test("a new time counts from when the page went up: shorter takes effect at once, never below 0, and a clock that went backwards waits the whole time", () => {
  assert.equal(rearmMs(1_000, 6_000, 8_000), 3_000);
  assert.equal(rearmMs(1_000, 6_000, 120_000), 115_000);
  assert.equal(rearmMs(1_000, 100_000, 15_000), 0);
  assert.equal(rearmMs(10_000, 5_000, 8_000), 8_000);
  assert.equal(rearmMs(5_000, 5_000, 8_000), 8_000);
});
