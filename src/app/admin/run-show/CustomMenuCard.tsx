"use client";

import { useState } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { DEFAULT_HEADLINE, DEFAULT_MARQUEE, DEFAULT_MENU_COLOR, HEADLINE_MAX, MENU_COLORS, NOTE_MAX } from "@/lib/drink-menu";

/** What the card saves; "" means the default (and for the note, no note; for its colour, the text colour). */
export type CustomMenuInput = { color: string; headline: string; note: string; noteColor: string };

type Props = CustomMenuInput & {
  /** The saved marquee, so the preview runs the same text the room will see. */
  marquee: string;
  /** The custom menu is on the live screen right now. */
  live: boolean;
  /** The live screen shows the QR (the Bad Decisions page is on), and so the line above it. */
  qr: boolean;
  busy: boolean;
  save: (look: CustomMenuInput) => Promise<boolean>;
};

/**
 * The custom drink menu's differences from the standard one: the colour of
 * its text, the line above the QR code, and a note in its own colour in the
 * empty space under the first two columns. Shows a preview of the board as
 * the edits are typed, before anything is saved.
 */
export default function CustomMenuCard({ color, headline, note, noteColor, marquee, live, qr, busy, save }: Props) {
  // What the host is editing; null until they touch it, so the saved value shows.
  const [colorDraft, setColorDraft] = useState<string | null>(null);
  const [headlineDraft, setHeadlineDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteColorDraft, setNoteColorDraft] = useState<string | null>(null);
  const shownColor = colorDraft ?? (color || DEFAULT_MENU_COLOR);
  const shownHeadline = headlineDraft ?? (headline || DEFAULT_HEADLINE);
  const shownNote = noteDraft ?? note;
  // Until the host picks one, the note is in the same colour as the rest of the text.
  const shownNoteColor = noteColorDraft ?? (noteColor || shownColor);
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const changed = (colorDraft !== null && !same(colorDraft, color || DEFAULT_MENU_COLOR))
    || (headlineDraft !== null && headlineDraft.trim() !== (headline || DEFAULT_HEADLINE))
    || (noteDraft !== null && noteDraft.trim() !== note)
    || (noteColorDraft !== null && !same(noteColorDraft, noteColor || shownColor));

  const submit = async (look: CustomMenuInput) => {
    if (await save(look)) {
      setColorDraft(null);
      setHeadlineDraft(null);
      setNoteDraft(null);
      setNoteColorDraft(null);
    }
  };

  return (
    <form
      className="mt-6 rounded-lg border border-amber-300/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Saving a default stores "" so it follows any future change to the default.
        void submit({
          color: same(shownColor, DEFAULT_MENU_COLOR) ? "" : shownColor,
          headline: shownHeadline.trim() === DEFAULT_HEADLINE ? "" : shownHeadline,
          note: shownNote,
          // A note colour only sticks once picked; left alone, it keeps following the text colour.
          noteColor: noteColorDraft === null && !noteColor ? "" : shownNoteColor,
        });
      }}
    >
      <p className="text-sm">Custom drink menu</p>
      <p className="mt-1 text-sm text-neutral-400">Same as the standard menu, with the text in your colour, a line above the QR code, and your own note in the empty space.{live ? " It is on screen now; saving updates it live." : ""}</p>

      <ColorRow label="Text colour" value={shownColor} onPick={setColorDraft} />

      <label htmlFor="menu-headline" className="mt-3 block text-xs text-neutral-400">Above the QR code</label>
      <input
        id="menu-headline"
        type="text"
        value={shownHeadline}
        onChange={(event) => setHeadlineDraft(event.target.value)}
        maxLength={HEADLINE_MAX}
        placeholder={DEFAULT_HEADLINE}
        className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
      />
      <p className="mt-1 text-right text-xs text-neutral-500" aria-live="polite">{shownHeadline.length}/{HEADLINE_MAX}</p>
      {qr ? null : <p className="mt-1 text-xs text-amber-200">The Bad Decisions page is switched off, so the screen has no QR code, and this line stays off with it. Open questions to bring both back.</p>}

      <label htmlFor="menu-note" className="mt-3 block text-xs text-neutral-400">Note in the empty space (under the first two columns)</label>
      <input
        id="menu-note"
        type="text"
        value={shownNote}
        onChange={(event) => setNoteDraft(event.target.value)}
        maxLength={NOTE_MAX}
        placeholder="e.g. Happy hour till 9 · $2 off cocktails"
        className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
      />
      <p className="mt-1 text-right text-xs text-neutral-500" aria-live="polite">{shownNote.length}/{NOTE_MAX}{shownNote.trim() ? "" : " · empty means no note"}</p>
      <ColorRow label="Note colour" value={shownNoteColor} onPick={setNoteColorDraft} />

      <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the custom menu">
        <DrinkMenu
          contained
          qrSrc={qr ? "/api/decisions/live/qr" : undefined}
          marquee={marquee || DEFAULT_MARQUEE}
          custom={{ color: shownColor, headline: shownHeadline.trim() || DEFAULT_HEADLINE, note: shownNote, noteColor: shownNoteColor }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !changed} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
        <button
          type="button"
          onClick={() => void submit({ color: "", headline: "", note: "", noteColor: "" })}
          disabled={busy || (!color && !headline && !note && !noteColor && !changed)}
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
