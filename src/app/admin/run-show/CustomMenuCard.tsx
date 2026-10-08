"use client";

import { useState } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { DEFAULT_HEADLINE, DEFAULT_MARQUEE, DEFAULT_MENU_COLOR, HEADLINE_MAX, MENU_COLORS } from "@/lib/drink-menu";

type Props = {
  /** Saved colour and line; "" means the default. */
  color: string;
  headline: string;
  /** The saved marquee, so the preview runs the same text the room will see. */
  marquee: string;
  /** The custom menu is on the live screen right now. */
  live: boolean;
  busy: boolean;
  save: (look: { color: string; headline: string }) => Promise<boolean>;
};

/**
 * The custom drink menu's two differences from the standard one: the colour
 * of its text, and the line above the QR code. Shows a preview of the board
 * as the edits are typed, before anything is saved.
 */
export default function CustomMenuCard({ color, headline, marquee, live, busy, save }: Props) {
  // What the host is editing; null until they touch it, so the saved value shows.
  const [colorDraft, setColorDraft] = useState<string | null>(null);
  const [headlineDraft, setHeadlineDraft] = useState<string | null>(null);
  const shownColor = colorDraft ?? (color || DEFAULT_MENU_COLOR);
  const shownHeadline = headlineDraft ?? (headline || DEFAULT_HEADLINE);
  const changed = (colorDraft !== null && colorDraft.toUpperCase() !== (color || DEFAULT_MENU_COLOR).toUpperCase())
    || (headlineDraft !== null && headlineDraft.trim() !== (headline || DEFAULT_HEADLINE));

  const submit = async (look: { color: string; headline: string }) => {
    if (await save(look)) {
      setColorDraft(null);
      setHeadlineDraft(null);
    }
  };

  return (
    <form
      className="mt-6 rounded-lg border border-amber-300/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Saving the default text or colour stores "" so it follows any future change to the default.
        const nextColor = shownColor.toUpperCase() === DEFAULT_MENU_COLOR ? "" : shownColor;
        const nextHeadline = shownHeadline.trim() === DEFAULT_HEADLINE ? "" : shownHeadline;
        void submit({ color: nextColor, headline: nextHeadline });
      }}
    >
      <p className="text-sm">Custom drink menu</p>
      <p className="mt-1 text-sm text-neutral-400">Same as the standard menu, with the text in your colour and a line above the QR code.{live ? " It is on screen now; saving updates it live." : ""}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-400">Text colour</span>
        {MENU_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Use ${swatch}`}
            aria-pressed={shownColor.toUpperCase() === swatch}
            onClick={() => setColorDraft(swatch)}
            className={`h-7 w-7 rounded-full border ${shownColor.toUpperCase() === swatch ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
            style={{ background: swatch }}
          />
        ))}
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="color" aria-label="Pick any colour" value={shownColor.toLowerCase()} onChange={(event) => setColorDraft(event.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer rounded border border-white/30 bg-black" />
          <span className="font-mono">{shownColor.toUpperCase()}</span>
        </label>
      </div>

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

      <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the custom menu">
        <DrinkMenu contained qrSrc="/api/decisions/live/qr" marquee={marquee || DEFAULT_MARQUEE} custom={{ color: shownColor, headline: shownHeadline.trim() || DEFAULT_HEADLINE }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !changed} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
        <button
          type="button"
          onClick={() => void submit({ color: "", headline: "" })}
          disabled={busy || (!color && !headline && !changed)}
          className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
        >
          Use defaults
        </button>
      </div>
    </form>
  );
}
