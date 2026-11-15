import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRINK_COLUMNS, DRINK_DETAIL_MAX, DRINK_NAME_MAX, DRINK_PRICE_MAX, MAX_DRINKS, MAX_DRINKS_PER_SECTION, MAX_SECTIONS_PER_COLUMN, SECTION_TITLE_MAX,
  addDrink, addSection, cleanDrinkListInput, cleanPrice, defaultDrinkList, drinkCount, findSection, listIds, moveDrink, moveSection, newListId,
  boardDrinks, parseDrinkList, parseLiveBoard, parseVisibleMenu, removeDrink, removeSection, sameList, sectionToColumn, updateDrink, updateSection, visibleMenu,
  type DrinkList, type ListDrink, type ListSection,
} from "../src/lib/drink-list.ts";
import { DEFAULT_MARQUEE_SPEED, DRINK_MENU, compactMenu, type DrinkSection } from "../src/lib/drink-menu.ts";

/** The board's drinks without their ids, to compare with the printed menu. */
function withoutIds(menu: DrinkSection[][]): DrinkSection[][] {
  return menu.map((column) => column.map(({ id: _section, ...section }) => {
    void _section;
    return { ...section, drinks: section.drinks.map(({ id: _drink, ...drink }) => { void _drink; return drink; }) };
  }));
}

const drink = (name: string, extra: Partial<ListDrink> = {}): ListDrink => ({ id: "", name, price: "$5", detail: "", hidden: false, ...extra });

/** A list as a Control Center from before sold out was removed saved it: some drinks still carry the mark. */
function withOldMarks(list: DrinkList, ids: string[]): DrinkList {
  return {
    columns: list.columns.map((column) => column.map((entry) => ({
      ...entry,
      drinks: entry.drinks.map((item) => ({ ...item, soldOut: ids.includes(item.id) })),
    }))),
  } as DrinkList;
}

/** Whether anything in a list or board still carries a sold-out mark. */
const anyMark = (value: unknown) => JSON.stringify(value).includes("soldOut");
const section = (title: string, drinks: ListDrink[], extra: Partial<ListSection> = {}): ListSection => ({ id: "", title, shared: false, price: "", hidden: false, drinks, ...extra });

test("never saved, both menus show the printed menu exactly", () => {
  assert.deepEqual(withoutIds(visibleMenu(null)), DRINK_MENU);
  assert.deepEqual(withoutIds(visibleMenu(defaultDrinkList())), DRINK_MENU);
  // A record that is not a list at all reads as the printed menu too.
  for (const raw of [null, undefined, "drinks", 42, [], {}, { columns: "three" }]) assert.equal(parseDrinkList(raw), null);
});

test("the printed menu as a list: ids from where things sit, the same every time, and kept once saved", () => {
  const list = defaultDrinkList();
  assert.equal(list.columns.length, DRINK_COLUMNS);
  assert.equal(list.columns[0][0].id, "s1");
  assert.equal(list.columns[0][0].drinks[1].id, "s1-2");
  assert.deepEqual(defaultDrinkList(), list);
  // Sections with one price are shared, their drinks keep none of their own.
  const cocktails = list.columns[1][1];
  assert.equal(cocktails.title, "Specialty Cocktails");
  assert.equal(cocktails.shared, true);
  assert.equal(cocktails.price, "$13");
  assert.ok(cocktails.drinks.every((entry) => entry.price === ""));
  const ids = [...listIds(list)];
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(parseDrinkList(JSON.parse(JSON.stringify(list))), list);
});

test("a stored list is cleaned: text trimmed and capped, nameless drinks and empty sections left out", () => {
  const parsed = parseDrinkList({
    columns: [
      [{ id: "a", title: `  ${"T".repeat(SECTION_TITLE_MAX + 5)} `, drinks: [
        { id: "b", name: ` ${"N".repeat(DRINK_NAME_MAX + 5)}\n`, price: "7", detail: "d".repeat(DRINK_DETAIL_MAX + 5), soldOut: "yes", hidden: 1 },
        { id: "c", name: "   ", price: "$4" },
        "junk",
      ] }],
      [{ title: "", drinks: [] }, null],
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.columns.length, DRINK_COLUMNS);
  const [first] = parsed.columns[0];
  assert.equal(first.title.length, SECTION_TITLE_MAX);
  assert.equal(first.drinks.length, 1);
  assert.equal(first.drinks[0].name.length, DRINK_NAME_MAX);
  assert.equal(first.drinks[0].price, "$7");
  assert.equal(first.drinks[0].detail.length, DRINK_DETAIL_MAX);
  // Only true itself hides a drink, and an old sold-out mark of any kind is dropped.
  assert.equal(first.drinks[0].hidden, false);
  assert.ok(!("soldOut" in first.drinks[0]));
  assert.deepEqual(parsed.columns[1], []);
  assert.deepEqual(parsed.columns[2], []);
});

test("a stored list is held to the limits", () => {
  const many = (count: number, make: (index: number) => unknown) => Array.from({ length: count }, (_, index) => make(index));
  const parsed = parseDrinkList({
    columns: many(5, (c) => many(MAX_SECTIONS_PER_COLUMN + 2, (s) => ({ title: `S${c}-${s}`, drinks: many(MAX_DRINKS_PER_SECTION + 3, (d) => ({ name: `D${c}-${s}-${d}` })) }))),
  });
  assert.ok(parsed);
  assert.equal(parsed.columns.length, DRINK_COLUMNS);
  for (const column of parsed.columns) assert.ok(column.length <= MAX_SECTIONS_PER_COLUMN);
  for (const kept of parsed.columns.flat()) assert.ok(kept.drinks.length <= MAX_DRINKS_PER_SECTION);
  assert.equal(drinkCount(parsed), MAX_DRINKS);
});

test("ids: a good one is kept; a missing, odd or repeated one gets a plain one, the same on every read", () => {
  const raw = { columns: [[{ id: "beer", title: "Beer", drinks: [{ id: "pils", name: "Pils" }, { id: "pils", name: "Lager" }, { id: "has space", name: "Stout" }, { name: "Porter" }] }], [], []] };
  const parsed = parseDrinkList(raw);
  assert.ok(parsed);
  const ids = parsed.columns[0][0].drinks.map((entry) => entry.id);
  assert.equal(ids[0], "pils");
  assert.equal(parsed.columns[0][0].id, "beer");
  assert.equal(new Set([...ids, "beer"]).size, 5);
  for (const id of ids.slice(1)) assert.match(id, /^x\d+$/);
  assert.deepEqual(parseDrinkList(raw), parsed);
});

test("prices: a bare number reads in dollars, anything else as written, capped", () => {
  assert.equal(cleanPrice("7"), "$7");
  assert.equal(cleanPrice(" 7.50 "), "$7.50");
  assert.equal(cleanPrice("$13"), "$13");
  assert.equal(cleanPrice("2 for $10"), "2 for $10");
  assert.equal(cleanPrice("x".repeat(40)).length, DRINK_PRICE_MAX);
  for (const raw of [null, 7, undefined, {}]) assert.equal(cleanPrice(raw), "");
});

test("a list sent from the Control Center: exactly three columns within the limits, every field the right kind", () => {
  const good = { columns: [[section("Beer", [drink("Pils", { price: "6" })])], [], [section("Wine", [drink("Red")], { shared: true, price: "10" })]] };
  const cleaned = cleanDrinkListInput(good);
  assert.ok(cleaned);
  assert.equal(cleaned.columns[0][0].drinks[0].price, "$6");
  assert.equal(cleaned.columns[2][0].price, "$10");
  // A Control Center opened before sold out was removed still sends the mark, of whatever kind: the list is taken, the mark dropped.
  for (const soldOut of [true, false, "yes", 1, null]) {
    const old = cleanDrinkListInput({ columns: [[{ title: "S", drinks: [{ name: "D", soldOut }] }], [], []] });
    assert.ok(old, JSON.stringify(soldOut));
    assert.ok(!anyMark(old));
  }
  // Fields the editor leaves out are fine; text gets cleaned like any stored list.
  assert.ok(cleanDrinkListInput({ columns: [[{ title: "Beer", drinks: [{ name: " Pils " }] }], [], []] }));
  const turnedAway: unknown[] = [
    null, "list", [], { columns: [[], []] }, { columns: [[], [], [], []] }, { columns: "x" },
    { columns: [Array.from({ length: MAX_SECTIONS_PER_COLUMN + 1 }, () => section("S", [])), [], []] },
    { columns: [[section("S", Array.from({ length: MAX_DRINKS_PER_SECTION + 1 }, () => drink("D")))], [], []] },
    { columns: [[{ drinks: [] }], [], []] },
    { columns: [[{ title: "S", drinks: "none" }], [], []] },
    { columns: [[{ title: "S", drinks: [{ price: "$5" }] }], [], []] },
    { columns: [[{ title: "S", hidden: 1, drinks: [] }], [], []] },
    { columns: [[{ title: "S", drinks: [{ name: "D", price: 5 }] }], [], []] },
    { columns: [[{ title: 7, drinks: [] }], [], []] },
    { columns: [[{ title: "S", drinks: [null] }], [], []] },
  ];
  for (const raw of turnedAway) assert.equal(cleanDrinkListInput(raw), null, JSON.stringify(raw)?.slice(0, 80));
  // Too many drinks over the whole list, even with every section within its own limit.
  const full = (n: number) => Array.from({ length: MAX_SECTIONS_PER_COLUMN }, () => section("S", Array.from({ length: n }, () => drink("D"))));
  const perColumn = Math.ceil((MAX_DRINKS + 1) / DRINK_COLUMNS / MAX_SECTIONS_PER_COLUMN);
  assert.ok(perColumn <= MAX_DRINKS_PER_SECTION);
  assert.equal(cleanDrinkListInput({ columns: [full(perColumn), full(perColumn), full(perColumn)] }), null);
});

test("the board shows what is not hidden; a drink marked sold out before the mark was removed shows as any other", () => {
  let list = withOldMarks(defaultDrinkList(), ["s1-2"]);
  list = updateDrink(list, "s1-3", { hidden: true });
  list = updateSection(list, "s2", { hidden: true });
  const shown = visibleMenu(list);
  const beers = shown[0][0];
  assert.equal(beers.drinks.length, DRINK_MENU[0][0].drinks.length - 1);
  assert.deepEqual(beers.drinks[1], { id: "s1-2", name: "Modelo · Especial", price: "$5", detail: "Lager" });
  assert.ok(!anyMark(shown));
  assert.ok(!beers.drinks.some((entry) => entry.name === "Chelada"));
  assert.equal(shown[0].length, DRINK_MENU[0].length - 1);
  // A section whose drinks are all hidden goes with them.
  let empty = defaultDrinkList();
  for (const entry of empty.columns[0][1].drinks) empty = updateDrink(empty, entry.id, { hidden: true });
  assert.equal(visibleMenu(empty)[0].length, DRINK_MENU[0].length - 1);
});

test("one price for a section: the drinks show none of their own, and turning it off brings theirs back", () => {
  const list: DrinkList = { columns: [[section("Beer", [drink("Pils", { id: "p", price: "$6" })], { id: "b", shared: true, price: "$5" })], [], []] };
  assert.deepEqual(visibleMenu(list)[0][0], { id: "b", title: "Beer", price: "$5", drinks: [{ id: "p", name: "Pils" }] });
  const noPrice = updateSection(list, "b", { price: "" });
  assert.deepEqual(visibleMenu(noPrice)[0][0], { id: "b", title: "Beer", shared: true, drinks: [{ id: "p", name: "Pils" }] });
  const own = updateSection(list, "b", { shared: false });
  assert.deepEqual(visibleMenu(own)[0][0], { id: "b", title: "Beer", drinks: [{ id: "p", name: "Pils", price: "$6" }] });
});

test("the live screen reads the board back as sent; anything else draws the printed menu at the usual pace", () => {
  const list = updateSection(defaultDrinkList(), "s4", { hidden: true });
  const sent = JSON.parse(JSON.stringify({ drinks: boardDrinks(list, true), marqueeLook: { speed: 140, color: "#3ce0ff" } }));
  const board = parseLiveBoard(sent);
  assert.deepEqual(JSON.parse(JSON.stringify(board.drinks)), boardDrinks(list, true));
  // A line standing for several drinks keeps each one's name, so the board can keep them whole when it wraps.
  const classic = board.drinks?.[1][2].drinks.find((entry) => entry.price === "$12" && !entry.detail);
  assert.deepEqual(classic?.names, ["Gimlet", "Mojito"]);
  // An older server's sold-out marks are dropped, and names that aren't all text are left off.
  const old = parseVisibleMenu([[{ title: "T", drinks: [{ name: "A", price: "$5", soldOut: true }, { name: "B · C", names: ["B", 3] }] }], [], []]);
  assert.ok(old);
  assert.ok(!anyMark(old));
  assert.equal(old[0][0].drinks[1].names, undefined);
  assert.equal(board.marqueeSpeed, 140);
  assert.equal(board.marqueeColor, "#3CE0FF");
  assert.deepEqual(parseLiveBoard(null), { drinks: null, marqueeSpeed: DEFAULT_MARQUEE_SPEED, marqueeColor: "" });
  assert.deepEqual(parseLiveBoard({ drinks: null, marqueeLook: null }), { drinks: null, marqueeSpeed: DEFAULT_MARQUEE_SPEED, marqueeColor: "" });
  // Out-of-range speeds and odd colours fall back rather than blur or stop the crawl.
  for (const speed of [0, -5, 100_000, "fast", Number.NaN]) assert.equal(parseLiveBoard({ marqueeLook: { speed } }).marqueeSpeed, DEFAULT_MARQUEE_SPEED);
  assert.equal(parseLiveBoard({ marqueeLook: { speed: 90, color: "url(x)" } }).marqueeColor, "");
  for (const drinks of [[], [[], []], "x", [[{ title: "T", drinks: [{ price: "$5" }] }], [], []], [[{ title: "T" }], [], []]]) assert.equal(parseVisibleMenu(drinks), null);
});

test("edits leave the list they were given alone", () => {
  const list = defaultDrinkList();
  const before = JSON.stringify(list);
  updateDrink(list, "s1-1", { name: "Changed" });
  updateSection(list, "s1", { title: "Changed" });
  addDrink(list, "s1", "n000001");
  removeDrink(list, "s1-1");
  moveDrink(list, "s1-2", -1);
  addSection(list, 0, "n000002");
  removeSection(list, "s1");
  moveSection(list, "s2", -1);
  sectionToColumn(list, "s1", 1);
  assert.equal(JSON.stringify(list), before);
});

test("drinks: added at the bottom of their section within the limits, moved within it, removed", () => {
  let list: DrinkList = { columns: [[section("A", [drink("One", { id: "d1" }), drink("Two", { id: "d2" })], { id: "a" })], [], []] };
  list = addDrink(list, "a", "d3");
  assert.deepEqual(list.columns[0][0].drinks.map((entry) => entry.id), ["d1", "d2", "d3"]);
  assert.equal(list.columns[0][0].drinks[2].name, "");
  list = moveDrink(list, "d3", -1);
  assert.deepEqual(list.columns[0][0].drinks.map((entry) => entry.id), ["d1", "d3", "d2"]);
  // At either end it stays.
  assert.deepEqual(moveDrink(list, "d1", -1), list);
  assert.deepEqual(moveDrink(list, "d2", 1), list);
  list = removeDrink(list, "d3");
  assert.deepEqual(list.columns[0][0].drinks.map((entry) => entry.id), ["d1", "d2"]);
  // A full section takes no more.
  const fullSection: DrinkList = { columns: [[section("A", Array.from({ length: MAX_DRINKS_PER_SECTION }, (_, index) => drink(`D${index}`, { id: `d${index}` })), { id: "a" })], [], []] };
  assert.deepEqual(addDrink(fullSection, "a", "extra"), fullSection);
  // Nor does a full list.
  const sections = (column: number) => Array.from({ length: MAX_SECTIONS_PER_COLUMN }, (_, s) => section("S", Array.from({ length: 4 }, (_, d) => drink("D", { id: `c${column}s${s}d${d}` })), { id: `c${column}s${s}` }));
  const fullList: DrinkList = { columns: [sections(0), sections(1), sections(2)] };
  assert.ok(drinkCount(fullList) >= MAX_DRINKS);
  assert.equal(drinkCount(addDrink(fullList, "c0s0", "extra")), drinkCount(fullList));
});

test("sections: added to a column within the limit, moved up and down, to another column, removed", () => {
  // The printed menu: four sections on the left (s1-s4), three in the middle (s5-s7), and the right full with six (s8-s13).
  let list = defaultDrinkList();
  list = moveSection(list, "s2", -1);
  assert.deepEqual(list.columns[0].map((entry) => entry.id), ["s2", "s1", "s3", "s4"]);
  assert.deepEqual(moveSection(list, "s2", -1), list);
  // The right column is full: nothing more goes in.
  assert.equal(list.columns[2].length, MAX_SECTIONS_PER_COLUMN);
  assert.deepEqual(sectionToColumn(list, "s2", 2), list);
  assert.deepEqual(addSection(list, 2, "n1"), list);
  list = sectionToColumn(list, "s2", 1);
  assert.deepEqual(findSection(list, "s2"), { column: 1, index: 3 });
  assert.deepEqual(list.columns[0].map((entry) => entry.id), ["s1", "s3", "s4"]);
  list = addSection(list, 0, "n1");
  assert.deepEqual(list.columns[0].map((entry) => entry.id), ["s1", "s3", "s4", "n1"]);
  list = removeSection(list, "s1");
  assert.equal(findSection(list, "s1"), null);
});

test("new ids are short, unused, and survive a save", () => {
  const list = defaultDrinkList();
  const taken = listIds(list);
  const values = [0, 0, 0.5];
  const id = newListId(new Set([...taken, "n000000"]), () => values.shift() ?? 0.5);
  assert.equal(id, newListId(new Set(), () => 0.5));
  assert.ok(!taken.has(id));
  const added = addDrink(list, "s1", id);
  const named = updateDrink(added, id, { name: "New one" });
  assert.equal(parseDrinkList(JSON.parse(JSON.stringify(named)))?.columns[0][0].drinks.at(-1)?.id, id);
});

test("sold out is gone: a list stored with marks reads without them, and the next save drops them for good", () => {
  // Marked on two screens before the deploy: both marks vanish on read, and nothing else about the list changes.
  const stored = JSON.parse(JSON.stringify(withOldMarks(defaultDrinkList(), ["s1-1", "s1-2"])));
  const read = parseDrinkList(stored);
  assert.deepEqual(read, defaultDrinkList());
  assert.ok(!anyMark(read));
  // What the editor saves next is that list, so the marks are gone from the record too.
  assert.ok(!anyMark(cleanDrinkListInput(stored)));
});

test("sameList: only a change that would save differently counts", () => {
  const list = defaultDrinkList();
  assert.ok(sameList(list, defaultDrinkList()));
  // A new empty drink would be left off, and "8" saves as "$8".
  assert.ok(sameList(addDrink(list, "s1", "n1"), list));
  assert.ok(sameList(updateDrink(list, "s1-6", { price: "8" }), list));
  // An old sold-out mark is dropped when cleaned, so it is no change (and no false "changed on another screen").
  assert.ok(sameList(withOldMarks(list, ["s1-1"]), list));
  assert.ok(!sameList(updateDrink(list, "s1-1", { hidden: true }), list));
  assert.ok(!sameList(list, null));
  assert.ok(sameList(null, null));
});

test("the board's drinks: one price's drinks on one line when that is on, each on its own when it is off", () => {
  const list = defaultDrinkList();
  assert.deepEqual(boardDrinks(list, false), visibleMenu(list));
  assert.deepEqual(boardDrinks(list, true), compactMenu(visibleMenu(list)));
  assert.deepEqual(boardDrinks(null, true), compactMenu(visibleMenu(null)));
  // Classic Cocktails, the one printed section with drinks that share a price and no detail line.
  const classic = boardDrinks(null, true)[1][2];
  assert.deepEqual(classic.drinks.map((entry) => [entry.name, entry.price]), [
    ["Margarita", "$12"],
    ["Gimlet · Mojito", "$12"],
    ["Paloma · Tom Collins · Negroni · Moscow Mule · Old Fashioned · Manhattan", "$13"],
    ["Sidecar", "$15"],
  ]);
  // Every other printed section is drawn as it always was.
  const others = (menu: DrinkSection[][]) => menu.flat().filter((entry) => entry.title !== "Classic Cocktails");
  assert.deepEqual(others(boardDrinks(null, true)), others(visibleMenu(null)));
});
