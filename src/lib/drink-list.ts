import { DEFAULT_MARQUEE_SPEED, DRINK_MENU, MARQUEE_SPEEDS, cleanColor, cleanLine, type Drink, type DrinkSection } from "./drink-menu.ts";

/**
 * The drink list the host keeps in the Control Center, shared by both menus.
 * Never saved (or put back) it is the printed menu, DRINK_MENU. It is kept
 * whole, hidden and sold-out drinks included, so a drink can come back with
 * one tap; the live screen is only ever sent what shows (see visibleMenu).
 *
 * The board has three columns, so a list always has exactly three. The
 * limits keep the board readable once it has shrunk its type to fit, and the
 * stored record small (the GitHub store commits every save).
 */
export const DRINK_COLUMNS = 3;
export const MAX_SECTIONS_PER_COLUMN = 4;
export const MAX_DRINKS_PER_SECTION = 10;
/** Well over the printed menu's 24: about as many as still fit once the board has set its type as small as it goes. */
export const MAX_DRINKS = 40;
export const SECTION_TITLE_MAX = 32;
export const DRINK_NAME_MAX = 48;
export const DRINK_PRICE_MAX = 10;
export const DRINK_DETAIL_MAX = 120;

export type ListDrink = { id: string; name: string; price: string; detail: string; soldOut: boolean; hidden: boolean };
/** `shared` lists the drinks under one price, `price`, in the heading; the drinks' own prices are kept for when it is turned off. */
export type ListSection = { id: string; title: string; shared: boolean; price: string; hidden: boolean; drinks: ListDrink[] };
/** Always DRINK_COLUMNS columns, left to right, each its sections top to bottom. */
export type DrinkList = { columns: ListSection[][] };

/** Ids are short and plain: they go in the stored record and serve as React keys. */
const LIST_ID = /^[A-Za-z0-9-]{1,16}$/;

/**
 * The printed menu as a list. Its ids come from where each thing sits
 * (section "s2", its first drink "s2-1"), so they are the same on every read
 * until the host saves a list of their own, which then keeps them.
 */
export function defaultDrinkList(): DrinkList {
  let section = 0;
  return {
    columns: DRINK_MENU.map((column) => column.map((printed) => {
      section += 1;
      return {
        id: `s${section}`, title: printed.title, shared: Boolean(printed.price), price: printed.price ?? "", hidden: false,
        drinks: printed.drinks.map((drink, index) => ({
          id: `s${section}-${index + 1}`, name: drink.name, price: drink.price ?? "", detail: drink.detail ?? "", soldOut: false, hidden: false,
        })),
      };
    })),
  };
}

/** A bare number is a price in dollars: "7" reads "$7", as the rest of the board does. */
export function cleanPrice(raw: unknown): string {
  const price = cleanLine(raw, DRINK_PRICE_MAX);
  return /^\d{1,4}(\.\d{1,2})?$/.test(price) ? `$${price}` : price;
}

/**
 * A stored list, cleaned: text trimmed and capped, limits applied, a drink
 * without a name and a section with neither title nor drinks left out. A
 * missing or repeated id gets a plain one ("x1", "x2"), the same on every
 * read. Null (the printed menu) for anything that is not a list at all.
 */
export function parseDrinkList(raw: unknown): DrinkList | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { columns?: unknown }).columns)) return null;
  const columns = (raw as { columns: unknown[] }).columns;
  const taken = new Set<string>();
  const idOf = (value: unknown): string => {
    let id = typeof value === "string" && LIST_ID.test(value) && !taken.has(value) ? value : "";
    for (let n = 1; !id; n += 1) if (!taken.has(`x${n}`)) id = `x${n}`;
    taken.add(id);
    return id;
  };
  let count = 0;
  const list: DrinkList = { columns: [] };
  for (let index = 0; index < DRINK_COLUMNS; index += 1) {
    const sections: ListSection[] = [];
    const column = Array.isArray(columns[index]) ? columns[index] as unknown[] : [];
    for (const entry of column) {
      if (sections.length >= MAX_SECTIONS_PER_COLUMN) break;
      if (!entry || typeof entry !== "object") continue;
      const section = entry as Record<string, unknown>;
      const drinks: ListDrink[] = [];
      for (const item of Array.isArray(section.drinks) ? section.drinks : []) {
        if (drinks.length >= MAX_DRINKS_PER_SECTION || count >= MAX_DRINKS) break;
        if (!item || typeof item !== "object") continue;
        const drink = item as Record<string, unknown>;
        const name = cleanLine(drink.name, DRINK_NAME_MAX);
        if (!name) continue;
        count += 1;
        drinks.push({
          id: idOf(drink.id), name, price: cleanPrice(drink.price), detail: cleanLine(drink.detail, DRINK_DETAIL_MAX),
          soldOut: drink.soldOut === true, hidden: drink.hidden === true,
        });
      }
      const title = cleanLine(section.title, SECTION_TITLE_MAX);
      if (!title && !drinks.length) continue;
      sections.push({ id: idOf(section.id), title, shared: section.shared === true, price: cleanPrice(section.price), hidden: section.hidden === true, drinks });
    }
    list.columns.push(sections);
  }
  return list;
}

const isText = (value: unknown) => value === undefined || typeof value === "string";
const isFlag = (value: unknown) => value === undefined || typeof value === "boolean";

/**
 * A list sent from the Control Center: exactly three columns and within the
 * limits, every field the right kind, or null to turn it away. Text is then
 * cleaned as any stored list is.
 */
export function cleanDrinkListInput(raw: unknown): DrinkList | null {
  if (!raw || typeof raw !== "object") return null;
  const columns = (raw as { columns?: unknown }).columns;
  if (!Array.isArray(columns) || columns.length !== DRINK_COLUMNS) return null;
  let count = 0;
  for (const column of columns) {
    if (!Array.isArray(column) || column.length > MAX_SECTIONS_PER_COLUMN) return null;
    for (const entry of column) {
      if (!entry || typeof entry !== "object") return null;
      const section = entry as Record<string, unknown>;
      if (typeof section.title !== "string" || !isText(section.id) || !isText(section.price) || !isFlag(section.shared) || !isFlag(section.hidden)) return null;
      if (!Array.isArray(section.drinks) || section.drinks.length > MAX_DRINKS_PER_SECTION) return null;
      for (const item of section.drinks) {
        if (!item || typeof item !== "object") return null;
        const drink = item as Record<string, unknown>;
        if (typeof drink.name !== "string" || !isText(drink.id) || !isText(drink.price) || !isText(drink.detail) || !isFlag(drink.soldOut) || !isFlag(drink.hidden)) return null;
        count += 1;
      }
    }
  }
  return count > MAX_DRINKS ? null : parseDrinkList(raw);
}

/**
 * What the board shows: hidden sections and drinks left out, and a section
 * with nothing left to show left out with them. Fields at their defaults are
 * left off, so the printed menu comes out as DRINK_MENU itself, ids aside.
 */
export function visibleMenu(list: DrinkList | null): DrinkSection[][] {
  return (list ?? defaultDrinkList()).columns.map((column) => column.flatMap((section): DrinkSection[] => {
    if (section.hidden) return [];
    const drinks = section.drinks.filter((drink) => !drink.hidden).map((drink): Drink => ({
      id: drink.id, name: drink.name,
      ...(!section.shared && drink.price ? { price: drink.price } : {}),
      ...(drink.detail ? { detail: drink.detail } : {}),
      ...(drink.soldOut ? { soldOut: true } : {}),
    }));
    if (!drinks.length) return [];
    return [{
      id: section.id, title: section.title,
      ...(section.shared && section.price ? { price: section.price } : {}),
      ...(section.shared && !section.price ? { shared: true } : {}),
      drinks,
    }];
  }));
}

/**
 * The drinks as the live screen receives them, checked; null (the printed
 * menu) for anything that is not three columns of sections. Unset marks are
 * left off, as visibleMenu leaves them.
 */
export function parseVisibleMenu(raw: unknown): DrinkSection[][] | null {
  if (!Array.isArray(raw) || raw.length !== DRINK_COLUMNS || !raw.every(Array.isArray)) return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  const menu: DrinkSection[][] = [];
  for (const column of raw as unknown[][]) {
    const sections: DrinkSection[] = [];
    for (const entry of column) {
      if (!entry || typeof entry !== "object" || !Array.isArray((entry as { drinks?: unknown }).drinks)) return null;
      const section = entry as Record<string, unknown> & { drinks: unknown[] };
      const drinks: Drink[] = [];
      for (const item of section.drinks) {
        const drink = item && typeof item === "object" ? item as Record<string, unknown> : null;
        if (!drink || typeof drink.name !== "string") return null;
        drinks.push({ id: text(drink.id), name: drink.name, price: text(drink.price), detail: text(drink.detail), soldOut: drink.soldOut === true || undefined });
      }
      sections.push({ id: text(section.id), title: typeof section.title === "string" ? section.title : "", price: text(section.price), shared: section.shared === true || undefined, drinks });
    }
    menu.push(sections);
  }
  return menu;
}

/** Everything the live screen draws the board with besides the custom look: the drinks, and the marquee's speed and colour. */
export type LiveBoard = { drinks: DrinkSection[][] | null; marqueeSpeed: number; marqueeColor: string };

const SLOWEST = Math.min(...MARQUEE_SPEEDS.map((speed) => speed.speed));
const FASTEST = Math.max(...MARQUEE_SPEEDS.map((speed) => speed.speed));

/** Read from the live API's answer; anything missing or out of range draws the board as it has always been. */
export function parseLiveBoard(data: unknown): LiveBoard {
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const look = value.marqueeLook && typeof value.marqueeLook === "object" ? value.marqueeLook as Record<string, unknown> : {};
  const speed = typeof look.speed === "number" && look.speed >= SLOWEST && look.speed <= FASTEST ? look.speed : DEFAULT_MARQUEE_SPEED;
  return { drinks: parseVisibleMenu(value.drinks), marqueeSpeed: speed, marqueeColor: cleanColor(look.color) };
}

/* The Control Center's edits. Each returns a new list and leaves the one it was given alone. */

/** Every id in the list, so a new one can be told apart. */
export function listIds(list: DrinkList): Set<string> {
  return new Set(list.columns.flat().flatMap((section) => [section.id, ...section.drinks.map((drink) => drink.id)]));
}

/** A short id not yet in the list: "n" and six letters or digits. */
export function newListId(taken: Set<string>, random: () => number = Math.random): string {
  for (;;) {
    const id = `n${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
    if (!taken.has(id)) return id;
  }
}

export function drinkCount(list: DrinkList): number {
  return list.columns.flat().reduce((total, section) => total + section.drinks.length, 0);
}

/** Where a section sits: its column and its place in it; null when it is gone. */
export function findSection(list: DrinkList, sectionId: string): { column: number; index: number } | null {
  for (const [column, sections] of list.columns.entries()) {
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index >= 0) return { column, index };
  }
  return null;
}

function mapSections(list: DrinkList, change: (section: ListSection) => ListSection): DrinkList {
  return { columns: list.columns.map((column) => column.map(change)) };
}

export function updateSection(list: DrinkList, sectionId: string, change: Partial<Omit<ListSection, "id" | "drinks">>): DrinkList {
  return mapSections(list, (section) => (section.id === sectionId ? { ...section, ...change } : section));
}

export function updateDrink(list: DrinkList, drinkId: string, change: Partial<Omit<ListDrink, "id">>): DrinkList {
  return mapSections(list, (section) => (section.drinks.some((drink) => drink.id === drinkId)
    ? { ...section, drinks: section.drinks.map((drink) => (drink.id === drinkId ? { ...drink, ...change } : drink)) }
    : section));
}

/** A new empty drink at the bottom of a section; the list as it was when the section is full or the list is. */
export function addDrink(list: DrinkList, sectionId: string, id: string): DrinkList {
  if (drinkCount(list) >= MAX_DRINKS) return list;
  return mapSections(list, (section) => (section.id === sectionId && section.drinks.length < MAX_DRINKS_PER_SECTION
    ? { ...section, drinks: [...section.drinks, { id, name: "", price: "", detail: "", soldOut: false, hidden: false }] }
    : section));
}

export function removeDrink(list: DrinkList, drinkId: string): DrinkList {
  return mapSections(list, (section) => ({ ...section, drinks: section.drinks.filter((drink) => drink.id !== drinkId) }));
}

/** A drink one place up (-1) or down (1) in its own section; at either end it stays. */
export function moveDrink(list: DrinkList, drinkId: string, step: -1 | 1): DrinkList {
  return mapSections(list, (section) => {
    const index = section.drinks.findIndex((drink) => drink.id === drinkId);
    const to = index + step;
    if (index < 0 || to < 0 || to >= section.drinks.length) return section;
    const drinks = [...section.drinks];
    [drinks[index], drinks[to]] = [drinks[to], drinks[index]];
    return { ...section, drinks };
  });
}

/** A new empty section at the bottom of a column; the list as it was when that column is full. */
export function addSection(list: DrinkList, column: number, id: string): DrinkList {
  if (!list.columns[column] || list.columns[column].length >= MAX_SECTIONS_PER_COLUMN) return list;
  const section: ListSection = { id, title: "", shared: false, price: "", hidden: false, drinks: [] };
  return { columns: list.columns.map((sections, index) => (index === column ? [...sections, section] : sections)) };
}

export function removeSection(list: DrinkList, sectionId: string): DrinkList {
  return { columns: list.columns.map((sections) => sections.filter((section) => section.id !== sectionId)) };
}

/** A section one place up (-1) or down (1) in its column; at either end it stays. */
export function moveSection(list: DrinkList, sectionId: string, step: -1 | 1): DrinkList {
  const at = findSection(list, sectionId);
  if (!at) return list;
  const sections = [...list.columns[at.column]];
  const to = at.index + step;
  if (to < 0 || to >= sections.length) return list;
  [sections[at.index], sections[to]] = [sections[to], sections[at.index]];
  return { columns: list.columns.map((column, index) => (index === at.column ? sections : column)) };
}

/** A section to the bottom of another column; the list as it was when that column is full. */
export function sectionToColumn(list: DrinkList, sectionId: string, column: number): DrinkList {
  const at = findSection(list, sectionId);
  if (!at || at.column === column || !list.columns[column] || list.columns[column].length >= MAX_SECTIONS_PER_COLUMN) return list;
  const section = list.columns[at.column][at.index];
  return {
    columns: list.columns.map((sections, index) => (index === at.column ? sections.filter((entry) => entry.id !== sectionId)
      : index === column ? [...sections, section] : sections)),
  };
}

/** Whether two lists would save the same, once cleaned: what decides if there is anything to save. */
export function sameList(a: DrinkList | null, b: DrinkList | null): boolean {
  return JSON.stringify(a && parseDrinkList(a)) === JSON.stringify(b && parseDrinkList(b));
}
