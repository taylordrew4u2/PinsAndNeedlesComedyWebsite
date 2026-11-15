"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { compactMenu, type BoardWords } from "@/lib/drink-menu";
import { savePhase, type SavePhase } from "@/lib/save-state";
import type { BoardQr } from "@/lib/screen-qr";
import {
  DRINK_DETAIL_MAX, DRINK_NAME_MAX, DRINK_PRICE_MAX, MAX_DRINKS, MAX_DRINKS_PER_SECTION, MAX_SECTIONS_PER_COLUMN, SECTION_TITLE_MAX,
  addDrink, addSection, defaultDrinkList, drinkCount, listIds, moveDrink, moveSection, newListId, parseDrinkList, removeDrink, removeSection, sameList,
  sectionToColumn, updateDrink, updateSection, visibleMenu,
  type DrinkList, type ListDrink, type ListSection,
} from "@/lib/drink-list";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

type Props = {
  /** The saved list; null while it is the printed menu. */
  saved: DrinkList | null;
  /** A drink menu is on the live screen right now, so a save shows at once. */
  live: boolean;
  /** The show screens' QR as the standard menu draws it, for the preview; null while the screen shows none. */
  qr: BoardQr | null;
  /** The words beside that QR, as the standard menu draws them (standardMenuWords); the printed wording when left out. */
  words?: BoardWords;
  busy: boolean;
  /** The whole list; `from` is the saved list this screen last saw, so the server can refuse when another screen changed it since. */
  save: (drinks: DrinkList | null, message: string, from?: DrinkList | null) => Promise<boolean>;
  /** Drinks of one price, with no detail line, on one line on both menus; and the switch for it, saved straight away. */
  samePriceLine: boolean;
  saveSamePriceLine: (on: boolean) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

type Edit = (change: (list: DrinkList) => DrinkList) => void;

const COLUMN_NAMES = ["Left column", "Middle column", "Right column"];
/** Taller on a phone, so every tap here is an easy 44px; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";
/** 16px type on a phone, so it doesn't zoom in on the box being typed in. */
const INPUT = `${TAP} rounded-md border border-white/30 bg-black px-2.5 py-1.5 text-base text-white placeholder:text-neutral-500 sm:text-sm`;

/**
 * The drink list both menus show: the switch that puts drinks of one price
 * on one line (saved straight away), and the whole list to edit, with a
 * preview of the board, saved only with Save. "Back to the printed menu"
 * puts the venue's printed list back. Nothing is ever sold out. The badge in
 * the summary says whether it is all saved, even while the card is folded.
 */
export default function DrinkListCard({ saved, live, qr, words, busy, save, samePriceLine, saveSamePriceLine, onPhase }: Props) {
  // The whole list as the host is editing it; null until they change something, so the saved list shows.
  const [draft, setDraft] = useState<DrinkList | null>(null);
  // The saved list that edit started from (null: the printed menu), to tell when another screen has changed the list underneath it.
  const [from, setFrom] = useState<DrinkList | null>(null);
  // How the preview fitted the list: the drinks' type size, and whether it fits at all.
  const [fit, setFit] = useState({ size: 1, fits: true });
  // One save history for the card: the list's Save, "Back to the printed menu" and the same-price switch.
  const { memo, fresh, track } = useSaveTracker();
  const base = useMemo(() => saved ?? defaultDrinkList(), [saved]);
  const value = draft ?? base;
  // Previewed as it would save: cleaned, so "7" shows as "$7" and a drink without a name is left off.
  const shown = useMemo(() => visibleMenu(parseDrinkList(value)), [value]);
  // As the board draws it: one price's drinks on one line when that is on.
  const board = useMemo(() => (samePriceLine ? compactMenu(shown) : shown), [shown, samePriceLine]);
  const changed = draft !== null && !sameList(draft, base);
  // A list with nothing left to show would leave the drinks side of the board blank: it cannot be saved.
  const empty = !shown.flat().length;
  const count = drinkCount(value);

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(changed, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const edit: Edit = (change) => {
    if (!draft) setFrom(saved);
    setDraft((current) => change(current ?? base));
  };

  const submit = async () => {
    if (!draft || empty) return;
    // Saving the whole list would quietly undo whatever another screen changed after this edit began.
    if (!sameList(from ?? defaultDrinkList(), base)
      && !window.confirm("The drink list was changed on another screen since you started editing (edited on another phone, say). Save your list over it anyway?")) return;
    if (!fit.fits && !window.confirm("This list is too long for the screen: the bottom of it will be cut off. Save it anyway?")) return;
    // Only the list that was sent is cleared: an edit made while it saves stays, ready for the next Save.
    const sent = draft;
    if (await track(() => save(sent, live ? "Drink list saved. The live screen has it now." : "Drink list saved. Both drink menus use it.", saved))) {
      setDraft((current) => (current === sent ? null : current));
    }
  };

  const backToPrinted = async () => {
    if (!window.confirm("Go back to the printed drink menu? Your own list and hidden drinks are all cleared.")) return;
    if (await track(() => save(null, "The printed drink menu is back."))) setDraft(null);
  };

  // Saved the moment it is switched, with the card's sign saying so.
  const switchSamePriceLine = (on: boolean) => void track(() => saveSamePriceLine(on));

  // Save and Undo, above the list as well as below it: the whole list runs to thousands of pixels, so an
  // edit near the top is never left unsaved for want of scrolling to the bottom.
  const saveButtons = (
    <>
      <SaveButton dirty={changed} memo={memo} fresh={fresh} busy={busy} blocked={empty} onClick={() => void submit()} label="Save drink list" />
      {draft ? <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
    </>
  );

  return (
    <details id="drink-list-card" className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="-my-3 cursor-pointer py-3 text-sm sm:my-0 sm:py-0">
        🍸 Drink list
        <SaveBadge dirty={changed} memo={memo} fresh={fresh} />
      </summary>
      <p className="mt-3 text-sm text-neutral-400">
        Both drink menus show this list. {saved ? "It is your own list." : "It is the printed menu until you change something."}
      </p>

      <label className={`${TAP} mt-3 flex items-center gap-3 text-sm`}>
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-amber-300"
          checked={samePriceLine}
          disabled={busy}
          aria-describedby="same-price-line-hint"
          onChange={(event) => switchSamePriceLine(event.target.checked)}
        />
        Put drinks with the same price on one line
      </label>
      <p id="same-price-line-hint" className="mt-1 text-xs text-neutral-500">
        Drinks that cost the same and have no small line under them share one line (&ldquo;Gimlet · Mojito&rdquo;, then the price once), to make room. On both menus. Saved straight away{live ? ", and the live screen changes with it" : ""}.
      </p>

      <details className="mt-5 rounded-md border border-white/15 p-2 sm:p-3">
        <summary className={`${TAP} cursor-pointer py-2 text-sm sm:py-0`}>
          ✏️ Change drinks, prices and sections
          {/* Said out loud once, by the card's badge; this is a reminder for the eye. */}
          {changed ? <span aria-hidden="true" className="ml-2 rounded bg-amber-300/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">● Not saved yet</span> : null}
        </summary>
        <p className="mt-2 text-xs text-neutral-500">
          Type straight into the boxes. Nothing changes on screen until you press Save. A drink left without a name is left off. {count}/{MAX_DRINKS} drinks.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">{saveButtons}</div>

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
              className={`${TAP} mt-2 rounded-md border border-dashed border-white/30 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40`}
            >
              + Add a section<span className="sr-only"> to the {COLUMN_NAMES[column].toLowerCase()}</span>{sections.length >= MAX_SECTIONS_PER_COLUMN ? ` (${MAX_SECTIONS_PER_COLUMN} is the most)` : ""}
            </button>
          </fieldset>
        ))}

        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the drink menu">
          <DrinkMenu contained drinks={board} qr={qr} words={words} onFit={setFit} />
        </div>
        <p className={`mt-2 text-xs ${fit.fits ? "text-neutral-500" : "text-amber-200"}`}>
          {!fit.fits
            ? "Too much to fit: the screen would cut some of it off. Hide or remove a few drinks, or shorten the details."
            : fit.size < 1
              ? `To fit everything, the drinks are set at ${Math.round(fit.size * 100)}% size.`
              : fit.size > 1
                ? `Room to spare, so the drinks are set bigger (${Math.round(fit.size * 100)}%) to fill it.`
                : "Preview of the standard menu; the custom menu shows the same drinks."}
        </p>
        {empty ? <p className="mt-1 text-xs text-amber-200">Nothing would show on the menu. Add a drink, or show a hidden one, before saving.</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          {changed ? <span className="w-full text-xs text-amber-200">Not saved yet: nothing changes on screen until you press Save.</span> : null}
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
          className={`${TAP} rounded-md border border-white/30 bg-black px-2 py-1.5 text-base text-white sm:text-sm`}
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
        <label className={`${TAP} flex items-center gap-2`}>
          <input
            type="checkbox"
            checked={section.shared}
            onChange={(event) => edit((list) => updateSection(list, section.id, { shared: event.target.checked }))}
            className="h-5 w-5 accent-amber-300 sm:h-4 sm:w-4"
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
        className={`${TAP} mt-2 rounded-md border border-dashed border-white/30 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40`}
      >
        + Add a drink<span className="sr-only"> to {name}</span>{sectionFull ? ` (${MAX_DRINKS_PER_SECTION} is the most in a section)` : listFull ? ` (${MAX_DRINKS} is the most on the menu)` : ""}
      </button>
    </div>
  );
}

/** One drink to edit: name, price (unless the section shares one), details, and its place and hidden mark. */
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
          className={`${INPUT} min-w-0 flex-1 basis-full sm:basis-40 ${drink.hidden ? "opacity-50" : ""}`}
        />
        {shared ? null : (
          <input
            type="text"
            aria-label={`Price of ${name}`}
            value={drink.price}
            onChange={(event) => change({ price: event.target.value })}
            maxLength={DRINK_PRICE_MAX}
            placeholder="$7"
            // A little narrower on a phone, so the price, both arrows, Hide and ✕ share one row.
            className={`${INPUT} w-16 sm:w-20`}
          />
        )}
        <Small label={`Move ${name} up`} onClick={() => edit((list) => moveDrink(list, drink.id, -1))} disabled={first}>↑</Small>
        <Small label={`Move ${name} down`} onClick={() => edit((list) => moveDrink(list, drink.id, 1))} disabled={last}>↓</Small>
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
        className={`${INPUT} mt-1.5 w-full sm:text-xs ${drink.hidden ? "opacity-50" : ""}`}
      />
    </li>
  );
}

function Small({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`${TAP} min-w-11 rounded-md border border-white/25 px-2.5 py-1.5 text-sm text-neutral-200 disabled:opacity-30 sm:min-w-0`}>
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
      className={`${TAP} rounded-md border px-2.5 py-1.5 text-sm ${on ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
    >
      {children}<span className="sr-only">: {name}</span>
    </button>
  );
}
