"use client";

import { useMemo, useState, type ReactNode } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import {
  DRINK_DETAIL_MAX, DRINK_NAME_MAX, DRINK_PRICE_MAX, MAX_DRINKS, MAX_DRINKS_PER_SECTION, MAX_SECTIONS_PER_COLUMN, SECTION_TITLE_MAX,
  addDrink, addSection, defaultDrinkList, drinkCount, listIds, moveDrink, moveSection, newListId, parseDrinkList, removeDrink, removeSection, sameList,
  sectionToColumn, updateDrink, updateSection, visibleMenu,
  type DrinkList, type ListDrink, type ListSection,
} from "@/lib/drink-list";

type Props = {
  /** The saved list; null while it is the printed menu. */
  saved: DrinkList | null;
  /** A drink menu is on the live screen right now, so a save shows at once. */
  live: boolean;
  /** The live screen shows the QR code, so the preview does too. */
  qr: boolean;
  busy: boolean;
  /** The whole list; `from` is the saved list this screen last saw, so the server can refuse when another screen changed it since. */
  save: (drinks: DrinkList | null, message: string, from?: DrinkList | null) => Promise<boolean>;
  /** One drink sold out or back, applied by the server to the list as saved now. */
  mark: (drinkId: string, soldOut: boolean, message: string) => Promise<boolean>;
};

type Edit = (change: (list: DrinkList) => DrinkList) => void;

const COLUMN_NAMES = ["Left column", "Middle column", "Right column"];
const INPUT = "rounded-md border border-white/30 bg-black px-2.5 py-1.5 text-sm text-white placeholder:text-neutral-500";

/**
 * The drink list both menus show. Up top, for the middle of a show: every
 * drink as a button that marks it sold out (crossed out on the board with a
 * SOLD OUT tag) and back, saved at once. Below, folded away: the whole list
 * to edit, with a preview of the board, saved only with Save. "Back to the
 * printed menu" puts the venue's printed list back.
 */
export default function DrinkListCard({ saved, live, qr, busy, save, mark }: Props) {
  // The whole list as the host is editing it; null until they change something, so the saved list shows.
  const [draft, setDraft] = useState<DrinkList | null>(null);
  // The saved list that edit started from (null: the printed menu), plus this screen's own quick taps since,
  // to tell when another screen has changed the list underneath it.
  const [from, setFrom] = useState<DrinkList | null>(null);
  // How the preview fitted the list: the drinks' type size, and whether it fits at all.
  const [fit, setFit] = useState({ size: 1, fits: true });
  const base = useMemo(() => saved ?? defaultDrinkList(), [saved]);
  const value = draft ?? base;
  // Previewed as it would save: cleaned, so "7" shows as "$7" and a drink without a name is left off.
  const shown = useMemo(() => visibleMenu(parseDrinkList(value)), [value]);
  const changed = draft !== null && !sameList(draft, base);
  // A list with nothing left to show would leave the drinks side of the board blank: it cannot be saved.
  const empty = !shown.flat().length;
  const count = drinkCount(value);
  const edit: Edit = (change) => {
    if (!draft) setFrom(saved);
    setDraft((current) => change(current ?? base));
  };

  /**
   * Sold out or back, straight to the screen. Only this drink is sent, so a
   * tap from another screen a moment ago is kept. A list being edited below
   * takes the same mark, so its Save does not undo it.
   */
  const markSoldOut = async (drink: ListDrink) => {
    const soldOut = !drink.soldOut;
    const ok = await mark(drink.id, soldOut, soldOut ? `“${drink.name}” is marked sold out.` : `“${drink.name}” is back on the menu.`);
    if (!ok) return;
    setDraft((current) => current && updateDrink(current, drink.id, { soldOut }));
    setFrom((current) => updateDrink(current ?? defaultDrinkList(), drink.id, { soldOut }));
  };

  const submit = async () => {
    if (!draft || empty) return;
    // Saving the whole list would quietly undo whatever another screen changed after this edit began.
    if (!sameList(from ?? defaultDrinkList(), base)
      && !window.confirm("The drink list was changed on another screen since you started editing (a drink marked sold out, say). Save your list over it anyway?")) return;
    if (!fit.fits && !window.confirm("This list is too long for the screen: the bottom of it will be cut off. Save it anyway?")) return;
    if (await save(draft, live ? "Drink list saved. The live screen has it now." : "Drink list saved. Both drink menus use it.", saved)) setDraft(null);
  };

  const backToPrinted = async () => {
    if (!window.confirm("Go back to the printed drink menu? Your own list, hidden drinks and sold-out marks are all cleared.")) return;
    if (await save(null, "The printed drink menu is back.")) setDraft(null);
  };

  const onMenu = base.columns.flat().filter((section) => !section.hidden && section.drinks.some((drink) => !drink.hidden));

  // Save and Undo, above the list as well as below it: the whole list runs to thousands of pixels, so an
  // edit near the top is never left unsaved for want of scrolling to the bottom.
  const saveButtons = (
    <>
      <button type="button" onClick={() => void submit()} disabled={busy || !changed || empty} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
      {draft ? <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
    </>
  );

  return (
    <details className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="cursor-pointer text-sm">🍸 Drink list and sold out</summary>
      <p className="mt-3 text-sm text-neutral-400">
        Both drink menus show this list. {saved ? "It is your own list." : "It is the printed menu until you change something."}
      </p>

      <p className="mt-4 text-sm">Sold out tonight</p>
      <p className="mt-1 text-xs text-neutral-500">
        Tap a drink to cross it out on the menu with a SOLD OUT tag; tap it again when it is back. Saves straight away{live ? ", and the live screen changes with it" : ""}.
      </p>
      <div className="mt-2 space-y-2">
        {onMenu.map((section) => (
          <div key={section.id}>
            <p className="text-xs uppercase tracking-wider text-neutral-500">{section.title || "Untitled section"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {section.drinks.filter((drink) => !drink.hidden).map((drink) => (
                <button
                  key={drink.id}
                  type="button"
                  aria-pressed={drink.soldOut}
                  onClick={() => void markSoldOut(drink)}
                  disabled={busy}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-sm disabled:opacity-50 ${drink.soldOut ? "border-[#ff2e4d] bg-[#ff2e4d]/15 text-neutral-300" : "border-white/25 text-white"}`}
                >
                  <span className={drink.soldOut ? "line-through" : ""}>{drink.name}</span>
                  {drink.soldOut ? <span className="ml-1.5 rounded bg-[#ff2e4d] px-1 py-0.5 text-[10px] font-bold tracking-wider text-white">SOLD OUT</span> : null}
                </button>
              ))}
            </div>
          </div>
        ))}
        {onMenu.length ? null : <p className="text-sm text-neutral-500">No drinks are showing. Open the list below to add some or show hidden ones.</p>}
      </div>

      <details className="mt-5 rounded-md border border-white/15 p-2 sm:p-3">
        <summary className="cursor-pointer text-sm">
          ✏️ Change drinks, prices and sections
          {changed ? <span className="ml-2 rounded bg-amber-300/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">unsaved</span> : null}
        </summary>
        <p className="mt-2 text-xs text-neutral-500">
          Type straight into the boxes. Nothing changes on screen until you press Save. A drink left without a name is left off. {count}/{MAX_DRINKS} drinks.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">{saveButtons}</div>

        {value.columns.map((sections, column) => (
          <fieldset key={column} className="mt-4">
            <legend className="text-xs uppercase tracking-widest text-neutral-400">{COLUMN_NAMES[column]}</legend>
            <div className="mt-2 space-y-3">
              {sections.map((section, index) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  column={column}
                  index={index}
                  first={index === 0}
                  last={index === sections.length - 1}
                  full={value.columns.map((entry) => entry.length >= MAX_SECTIONS_PER_COLUMN)}
                  listFull={count >= MAX_DRINKS}
                  edit={edit}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => edit((list) => addSection(list, column, newListId(listIds(list))))}
              disabled={sections.length >= MAX_SECTIONS_PER_COLUMN}
              className="mt-2 rounded-md border border-dashed border-white/30 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40"
            >
              + Add a section<span className="sr-only"> to the {COLUMN_NAMES[column].toLowerCase()}</span>{sections.length >= MAX_SECTIONS_PER_COLUMN ? ` (${MAX_SECTIONS_PER_COLUMN} is the most)` : ""}
            </button>
          </fieldset>
        ))}

        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the drink menu">
          <DrinkMenu contained drinks={shown} qrSrc={qr ? "/api/decisions/live/qr" : undefined} onFit={setFit} />
        </div>
        <p className={`mt-2 text-xs ${fit.fits ? "text-neutral-500" : "text-amber-200"}`}>
          {!fit.fits
            ? "Too much to fit: the screen would cut some of it off. Hide or remove a few drinks, or shorten the details."
            : fit.size < 1
              ? `Longer than the printed menu, so the drinks are set at ${Math.round(fit.size * 100)}% size to fit.`
              : "Preview of the standard menu; the custom menu shows the same drinks."}
        </p>
        {empty ? <p className="mt-1 text-xs text-amber-200">Nothing would show on the menu. Add a drink, or show a hidden one, before saving.</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {changed ? <span className="w-full text-xs text-amber-200">Unsaved changes: not on screen yet.</span> : null}
          {saveButtons}
          <button type="button" onClick={() => void backToPrinted()} disabled={busy || (!saved && !draft)} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Back to the printed menu</button>
        </div>
      </details>
    </details>
  );
}

/** One section to edit: its heading, where it sits, its shared price, and its drinks. */
function SectionEditor({ section, column, index, first, last, full, listFull, edit }: {
  section: ListSection;
  column: number;
  /** Its place in the column, to name a section with no heading yet. */
  index: number;
  first: boolean;
  last: boolean;
  /** Which columns have no room for another section. */
  full: boolean[];
  /** The list has as many drinks as it can take. */
  listFull: boolean;
  edit: Edit;
}) {
  const remove = () => {
    const drinks = section.drinks.filter((drink) => drink.name.trim()).length;
    if (drinks && !window.confirm(`Remove “${section.title || "this section"}” and its ${drinks === 1 ? "drink" : `${drinks} drinks`}? Nothing changes on screen until you press Save.`)) return;
    edit((list) => removeSection(list, section.id));
  };
  const sectionFull = section.drinks.length >= MAX_DRINKS_PER_SECTION;
  // Every section has the same controls, so each one's label says which section it is for.
  const name = section.title.trim() || `untitled section ${index + 1} in the ${COLUMN_NAMES[column].toLowerCase()}`;

  return (
    <div className={`rounded-md border p-2 sm:p-3 ${section.hidden ? "border-dashed border-white/20" : "border-white/20"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          aria-label={`Heading of section ${index + 1} in the ${COLUMN_NAMES[column].toLowerCase()}`}
          value={section.title}
          onChange={(event) => edit((list) => updateSection(list, section.id, { title: event.target.value }))}
          maxLength={SECTION_TITLE_MAX}
          placeholder="Section heading, e.g. Beers"
          className={`${INPUT} min-w-0 flex-1 basis-40 font-semibold uppercase ${section.hidden ? "opacity-50" : ""}`}
        />
        <Small label={`Move ${name} up`} onClick={() => edit((list) => moveSection(list, section.id, -1))} disabled={first}>↑</Small>
        <Small label={`Move ${name} down`} onClick={() => edit((list) => moveSection(list, section.id, 1))} disabled={last}>↓</Small>
        <select
          aria-label={`Column for ${name}`}
          value={column}
          onChange={(event) => edit((list) => sectionToColumn(list, section.id, Number(event.target.value)))}
          className="rounded-md border border-white/30 bg-black px-2 py-1.5 text-sm text-white"
        >
          {COLUMN_NAMES.map((label, to) => (
            <option key={label} value={to} disabled={to !== column && full[to]}>{label}{to !== column && full[to] ? " (full)" : ""}</option>
          ))}
        </select>
        <Toggle on={section.hidden} onClick={() => edit((list) => updateSection(list, section.id, { hidden: !section.hidden }))} title="Keep the section in the list but off the menu" name={name}>
          {section.hidden ? "Hidden" : "Hide"}
        </Toggle>
        <Small label={`Remove ${name}`} onClick={remove}>Remove</Small>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={section.shared}
            onChange={(event) => edit((list) => updateSection(list, section.id, { shared: event.target.checked }))}
            className="h-4 w-4 accent-amber-300"
          />
          <span><span className="sr-only">{name}: </span>One price for every drink here</span>
        </label>
        {section.shared ? (
          <input
            type="text"
            aria-label={`Price for every drink in ${name}`}
            value={section.price}
            onChange={(event) => edit((list) => updateSection(list, section.id, { price: event.target.value }))}
            maxLength={DRINK_PRICE_MAX}
            placeholder="$13"
            className={`${INPUT} w-20`}
          />
        ) : null}
      </div>

      <ul className="mt-2 space-y-2">
        {section.drinks.map((drink, place) => (
          <DrinkEditor
            key={drink.id}
            drink={drink}
            index={place}
            section={name}
            shared={section.shared}
            first={place === 0}
            last={place === section.drinks.length - 1}
            edit={edit}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => edit((list) => addDrink(list, section.id, newListId(listIds(list))))}
        disabled={sectionFull || listFull}
        className="mt-2 rounded-md border border-dashed border-white/30 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40"
      >
        + Add a drink<span className="sr-only"> to {name}</span>{sectionFull ? ` (${MAX_DRINKS_PER_SECTION} is the most in a section)` : listFull ? ` (${MAX_DRINKS} is the most on the menu)` : ""}
      </button>
    </div>
  );
}

/** One drink to edit: name, price (unless the section shares one), details, and its place, sold-out and hidden marks. */
function DrinkEditor({ drink, index, section, shared, first, last, edit }: {
  drink: ListDrink;
  /** Its place in the section, and the section's name, to name a drink with no name yet. */
  index: number;
  section: string;
  shared: boolean;
  first: boolean;
  last: boolean;
  edit: Edit;
}) {
  const change = (update: Partial<Omit<ListDrink, "id">>) => edit((list) => updateDrink(list, drink.id, update));
  // Every drink has the same controls, so each one's label says which drink it is for.
  const name = drink.name.trim() || `unnamed drink ${index + 1} in ${section}`;
  return (
    <li className={`rounded-md border border-white/10 p-1.5 sm:p-2 ${drink.hidden ? "border-dashed" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          aria-label={`Name of drink ${index + 1} in ${section}`}
          value={drink.name}
          onChange={(event) => change({ name: event.target.value })}
          maxLength={DRINK_NAME_MAX}
          placeholder="Drink name"
          className={`${INPUT} min-w-0 flex-1 basis-full sm:basis-40 ${drink.hidden ? "opacity-50" : ""} ${drink.soldOut ? "line-through" : ""}`}
        />
        {shared ? null : (
          <input
            type="text"
            aria-label={`Price of ${name}`}
            value={drink.price}
            onChange={(event) => change({ price: event.target.value })}
            maxLength={DRINK_PRICE_MAX}
            placeholder="$7"
            className={`${INPUT} w-20`}
          />
        )}
        <Small label={`Move ${name} up`} onClick={() => edit((list) => moveDrink(list, drink.id, -1))} disabled={first}>↑</Small>
        <Small label={`Move ${name} down`} onClick={() => edit((list) => moveDrink(list, drink.id, 1))} disabled={last}>↓</Small>
        <Toggle on={drink.soldOut} onClick={() => change({ soldOut: !drink.soldOut })} title="Crossed out on the menu with a SOLD OUT tag" name={name}>Sold out</Toggle>
        <Toggle on={drink.hidden} onClick={() => change({ hidden: !drink.hidden })} title="Kept in the list but off the menu" name={name}>{drink.hidden ? "Hidden" : "Hide"}</Toggle>
        <Small label={`Remove ${name}`} onClick={() => edit((list) => removeDrink(list, drink.id))}>✕</Small>
      </div>
      <input
        type="text"
        aria-label={`Details for ${name}`}
        value={drink.detail}
        onChange={(event) => change({ detail: event.target.value })}
        maxLength={DRINK_DETAIL_MAX}
        placeholder="Small line under the name (optional), e.g. Hazy IPA"
        className={`${INPUT} mt-1.5 w-full text-xs ${drink.hidden ? "opacity-50" : ""}`}
      />
    </li>
  );
}

function Small({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded-md border border-white/25 px-2.5 py-1.5 text-sm text-neutral-200 disabled:opacity-30">
      {children}
    </button>
  );
}

/** `name` says which drink or section it is for: read out after the visible word, which stays first. */
function Toggle({ on, onClick, title, name, children }: { on: boolean; onClick: () => void; title: string; name: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-sm ${on ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
    >
      {children}<span className="sr-only">: {name}</span>
    </button>
  );
}
