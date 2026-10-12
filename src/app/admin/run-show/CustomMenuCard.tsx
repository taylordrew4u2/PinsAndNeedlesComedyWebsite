"use client";

import { useMemo, useState } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { MENU_FONT_FAMILY, SCRIPT_FONT_FAMILY } from "@/components/menu-font-faces";
import { BARTENDER_MAX, DEFAULT_HEADLINE, DEFAULT_MARQUEE, DEFAULT_MENU_COLOR, HEADLINE_MAX, MENU_COLORS, MENU_WORDING, NOTE_MAX, customWording, marqueeSpeedOf, type MenuWording, type WordingKey } from "@/lib/drink-menu";
import { visibleMenu, type DrinkList } from "@/lib/drink-list";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, MENU_FONTS, SCRIPT_FONTS, isMenuFont, isScriptFont } from "@/lib/menu-fonts";

/**
 * What the card saves. "" means the default: the brand red, the 9 PM line,
 * the standard font, Great Vibes; no note or bartender; for the note and
 * bartender colours, the menu's text colour; and the printed wording under
 * the QR code and over the bartender.
 */
export type CustomMenuInput = {
  color: string; headline: string; note: string; noteColor: string;
  font: string; bartender: string; bartenderFont: string; bartenderColor: string;
} & MenuWording;

type Props = CustomMenuInput & {
  /** The saved marquee, so the preview runs the same text the room will see. */
  marquee: string;
  /** How the marquee runs (on or off, speed, colour), for the preview; left out, as it always has. */
  marqueeStyle?: { on: boolean; speed: string; color: string };
  /** The host's drink list, for the preview; null or left out, the printed menu. */
  drinks?: DrinkList | null;
  /** The custom menu is on the live screen right now. */
  live: boolean;
  /** The live screen shows the QR (the Bad Decisions page is on), and so the line above it. */
  qr: boolean;
  busy: boolean;
  save: (look: CustomMenuInput) => Promise<boolean>;
};

const EMPTY: CustomMenuInput = {
  color: "", headline: "", note: "", noteColor: "", font: "", bartender: "", bartenderFont: "", bartenderColor: "",
  qrCaption: "", qrTitle: "", qrLink: "", bartenderLabel: "",
};

/** Drawn as typed, so a change of capitals is a change; everything else on the board is in capitals (or a colour). */
const AS_TYPED: (keyof CustomMenuInput)[] = ["bartender", "qrLink"];

/**
 * The custom drink menu's differences from the standard one: its text colour
 * and font, the line above the QR code and the wording under it, and, in the
 * empty space under the first two columns, tonight's bartender and a note,
 * each in its own colour. Shows a preview of the board as the edits are made,
 * before anything is saved.
 */
export default function CustomMenuCard({ marquee, marqueeStyle, drinks, live, qr, busy, save, ...saved }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<CustomMenuInput>>({});
  // How the drinks fit this board: a longer list, a bartender and a note all take room.
  const [fit, setFit] = useState({ size: 1, fits: true });
  const edit = (change: Partial<CustomMenuInput>) => setDraft((current) => ({ ...current, ...change }));
  const value = { ...saved, ...draft };

  // What the board shows, defaults filled in, exactly as the live screen will draw it.
  const color = value.color || DEFAULT_MENU_COLOR;
  const look = {
    color,
    headline: value.headline.trim() || DEFAULT_HEADLINE,
    note: value.note,
    noteColor: value.noteColor || color,
    font: isMenuFont(value.font) ? value.font : DEFAULT_MENU_FONT,
    bartender: value.bartender,
    bartenderFont: isScriptFont(value.bartenderFont) ? value.bartenderFont : DEFAULT_SCRIPT_FONT,
    bartenderColor: value.bartenderColor || color,
    ...customWording(value),
  };
  const shownDrinks = useMemo(() => visibleMenu(drinks ?? null), [drinks]);

  // The printed wording, as a draft or saved value: saved as "" so it keeps following the printed wording.
  const printed = (key: WordingKey) => {
    const text = value[key].trim();
    const fallback = MENU_WORDING[key].fallback;
    return AS_TYPED.includes(key) ? text === fallback : text.toUpperCase() === fallback.toUpperCase();
  };

  // Saved with defaults as "", so a value left at its default keeps following it.
  const toSave = (): CustomMenuInput => ({
    color: value.color.toUpperCase() === DEFAULT_MENU_COLOR ? "" : value.color,
    headline: value.headline.trim() === DEFAULT_HEADLINE ? "" : value.headline,
    note: value.note,
    noteColor: value.noteColor,
    font: value.font === DEFAULT_MENU_FONT ? "" : value.font,
    bartender: value.bartender,
    bartenderFont: value.bartenderFont === DEFAULT_SCRIPT_FONT ? "" : value.bartenderFont,
    bartenderColor: value.bartenderColor,
    qrCaption: printed("qrCaption") ? "" : value.qrCaption,
    qrTitle: printed("qrTitle") ? "" : value.qrTitle,
    qrLink: printed("qrLink") ? "" : value.qrLink,
    bartenderLabel: printed("bartenderLabel") ? "" : value.bartenderLabel,
  });
  const next = toSave();
  // Case only matters where the board shows it as typed: the bartender's name and the web address. Colours compare as hex, the rest is drawn in capitals.
  const changed = (Object.keys(EMPTY) as (keyof CustomMenuInput)[])
    .some((key) => AS_TYPED.includes(key)
      ? next[key].trim() !== saved[key].trim()
      : next[key].trim().toUpperCase() !== saved[key].trim().toUpperCase());
  /** A wording box: the printed wording until the host types, and empty (the printed wording again) once they clear it. */
  const wordingValue = (key: WordingKey) => value[key] || (draft[key] === undefined ? MENU_WORDING[key].fallback : "");

  const submit = async (input: CustomMenuInput) => {
    if (await save(input)) setDraft({});
  };

  return (
    <form className="mt-6 rounded-lg border border-amber-300/40 p-4" onSubmit={(event) => { event.preventDefault(); void submit(next); }}>
      <p className="text-sm">Custom drink menu</p>
      <p className="mt-1 text-sm text-neutral-400">Same drinks as the standard menu, in your colour and font, with a line above the QR code, tonight&rsquo;s bartender and a note in the empty space.{live ? " It is on screen now; saving updates it live." : ""}</p>

      <ColorRow label="Text colour" value={color} onPick={(pick) => edit({ color: pick })} />

      <p className="mt-3 text-xs text-neutral-400">Font</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Menu font">
        {MENU_FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            aria-pressed={look.font === font.id}
            onClick={() => edit({ font: font.id })}
            className={`rounded-md border px-2.5 py-1 text-base leading-tight ${look.font === font.id ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
            style={{ fontFamily: MENU_FONT_FAMILY[font.id] }}
          >
            {font.label}
          </button>
        ))}
      </div>

      <label htmlFor="menu-headline" className="mt-4 block text-xs text-neutral-400">Above the QR code</label>
      <input
        id="menu-headline"
        type="text"
        value={value.headline || (draft.headline === undefined ? DEFAULT_HEADLINE : "")}
        onChange={(event) => edit({ headline: event.target.value })}
        maxLength={HEADLINE_MAX}
        placeholder={DEFAULT_HEADLINE}
        className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
      />
      {qr ? null : <p className="mt-1 text-xs text-amber-200">The Bad Decisions page is switched off, so the screen has no QR code, and this line stays off with it. Open questions to bring both back.</p>}

      <p className="mt-4 text-xs text-neutral-400">Under the QR code (empty goes back to the printed wording)</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {(["qrCaption", "qrTitle", "qrLink"] as const).map((key) => (
          <label key={key} className={`block text-xs text-neutral-500 ${key === "qrLink" ? "sm:col-span-2" : ""}`}>
            {MENU_WORDING[key].label}{key === "qrLink" ? "" : " (in capitals)"}
            <input
              type="text"
              value={wordingValue(key)}
              onChange={(event) => edit({ [key]: event.target.value })}
              maxLength={MENU_WORDING[key].max}
              placeholder={MENU_WORDING[key].fallback}
              className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-white/15 p-3">
        <label htmlFor="menu-bartender" className="block text-xs text-neutral-400">Bartender tonight (shows under &ldquo;{look.bartenderLabel}&rdquo;)</label>
        <input
          id="menu-bartender"
          type="text"
          value={value.bartender}
          onChange={(event) => edit({ bartender: event.target.value })}
          maxLength={BARTENDER_MAX}
          placeholder="e.g. Jess"
          className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-white placeholder:text-neutral-500"
          style={{ fontFamily: SCRIPT_FONT_FAMILY[look.bartenderFont], fontSize: 22 }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Bartender font">
          {SCRIPT_FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              aria-pressed={look.bartenderFont === font.id}
              onClick={() => edit({ bartenderFont: font.id })}
              className={`rounded-md border px-2.5 py-0.5 text-xl leading-tight ${look.bartenderFont === font.id ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
              style={{ fontFamily: SCRIPT_FONT_FAMILY[font.id] }}
            >
              {value.bartender.trim() || font.label}
            </button>
          ))}
        </div>
        <ColorRow label="Name colour" value={look.bartenderColor} onPick={(pick) => edit({ bartenderColor: pick })} />
        <p className="mt-1 text-xs text-neutral-500">{value.bartender.trim() ? `${value.bartender.length}/${BARTENDER_MAX}` : "Empty means no bartender on the menu."}</p>
        <label className="mt-3 block text-xs text-neutral-400">
          {MENU_WORDING.bartenderLabel.label} (in capitals)
          <input
            type="text"
            value={wordingValue("bartenderLabel")}
            onChange={(event) => edit({ bartenderLabel: event.target.value })}
            maxLength={MENU_WORDING.bartenderLabel.max}
            placeholder={MENU_WORDING.bartenderLabel.fallback}
            className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
        </label>
      </div>

      <label htmlFor="menu-note" className="mt-4 block text-xs text-neutral-400">Note in the empty space (under the bartender)</label>
      <input
        id="menu-note"
        type="text"
        value={value.note}
        onChange={(event) => edit({ note: event.target.value })}
        maxLength={NOTE_MAX}
        placeholder="e.g. Happy hour till 9 · $2 off cocktails"
        className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
      />
      <p className="mt-1 text-right text-xs text-neutral-500" aria-live="polite">{value.note.length}/{NOTE_MAX}{value.note.trim() ? "" : " · empty means no note"}</p>
      <ColorRow label="Note colour" value={look.noteColor} onPick={(pick) => edit({ noteColor: pick })} />

      <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the custom menu">
        <DrinkMenu
          contained
          qrSrc={qr ? "/api/decisions/live/qr" : undefined}
          marquee={marqueeStyle?.on === false ? null : marquee || DEFAULT_MARQUEE}
          marqueeSpeed={marqueeSpeedOf(marqueeStyle?.speed)}
          marqueeColor={marqueeStyle?.color}
          custom={look}
          drinks={shownDrinks}
          onFit={setFit}
        />
      </div>
      {fit.fits && fit.size === 1 ? null : (
        <p className={`mt-2 text-xs ${fit.fits ? "text-neutral-500" : "text-amber-200"}`}>
          {fit.fits
            ? `To fit everything on this menu, the drinks are set at ${Math.round(fit.size * 100)}% size.`
            : "Too much to fit on this menu: the screen would cut some drinks off. Shorten the note, or hide a few drinks in the drink list."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !changed} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
        {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
        <button
          type="button"
          onClick={() => void submit(EMPTY)}
          disabled={busy || (Object.values(saved).every((entry) => !entry) && !Object.keys(draft).length)}
          className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
        >
          Use defaults
        </button>
      </div>
    </form>
  );
}

/** Quick colour swatches plus a picker for any colour. */
function ColorRow({ label, value, onPick }: { label: string; value: string; onPick: (color: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-400">{label}</span>
      {MENU_COLORS.map((swatch) => {
        const picked = value.toUpperCase() === swatch;
        return (
          <button
            key={swatch}
            type="button"
            aria-label={`${label}: ${swatch}`}
            aria-pressed={picked}
            onClick={() => onPick(swatch)}
            className={`h-7 w-7 rounded-full border ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
            style={{ background: swatch }}
          />
        );
      })}
      <label className="flex items-center gap-1.5 text-xs text-neutral-400">
        <input type="color" aria-label={`${label}: any colour`} value={value.toLowerCase()} onChange={(event) => onPick(event.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer rounded border border-white/30 bg-black" />
        <span className="font-mono">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}
