"use client";

import { useMemo, useState } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { MENU_FONT_FAMILY, SCRIPT_FONT_FAMILY } from "@/components/menu-font-faces";
import {
  BARTENDER_MAX, DEFAULT_CUSTOM_MENU, HEADLINE_MAX, MENU_COLORS, MENU_WORDING, NOTE_MAX, customLookOf, customMenuChanges, marqueeSpeedOf,
  type CustomMenuSettings, type MarqueeStyle, type WordingKey,
} from "@/lib/drink-menu";
import { boardDrinks, type DrinkList } from "@/lib/drink-list";
import { SCRIPT_FONTS, MENU_FONTS } from "@/lib/menu-fonts";
import { adminQrPreviewSrc, qrChoiceProblem } from "@/lib/screen-qr";
import QrChooser from "./QrChooser";

type Props = {
  /** What is saved now ("" for each default). */
  saved: CustomMenuSettings;
  /** How the marquee runs (on or off, speed, colour), for the preview. */
  marqueeStyle: MarqueeStyle;
  /** The host's drink list, for the preview; null for the printed menu. */
  drinks: DrinkList | null;
  /** Drinks of one price on one line, as both menus draw them. */
  samePriceLine: boolean;
  /** The custom menu is on the live screen right now. */
  live: boolean;
  busy: boolean;
  /** Only the settings that changed. True once saved. */
  save: (change: Partial<CustomMenuSettings>) => Promise<boolean>;
  /** Takes the host to the one box for tonight's bartender, under the live screen. */
  editBartender: () => void;
};

/** The custom menu's QR choices: none (the default, nothing about the show), a code for the host's link, or their picture. */
const QR_CHOICES = [{ id: "", label: "No QR code" }, { id: "link", label: "QR to my link" }, { id: "picture", label: "My picture" }] as const;

/**
 * The custom (daytime) drink menu: its text colour and font, its own QR (none
 * until the host adds one) with their line above it and wording under it,
 * tonight's bartender and a note, each in its own colour. Shows a preview of
 * the board as the edits are made, before anything is saved. Folded until
 * opened: it is setup, and its typing stays put while it is folded.
 */
export default function CustomMenuCard({ saved, marqueeStyle, drinks, samePriceLine, live, busy, save }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<CustomMenuSettings>>({});
  // How the drinks fit this board: a longer list, a bartender and a note all take room.
  const [fit, setFit] = useState({ size: 1, fits: true });
  const edit = (change: Partial<CustomMenuSettings>) => setDraft((current) => ({ ...current, ...change }));
  const value: CustomMenuSettings = { ...saved, ...draft };

  // What the board shows, defaults filled in, exactly as the live screen will draw it (a link's code from the signed-in preview).
  const look = customLookOf(value, adminQrPreviewSrc);
  const color = look.color;
  const shownDrinks = useMemo(() => boardDrinks(drinks, samePriceLine), [drinks, samePriceLine]);

  const pending = customMenuChanges(saved, value);
  const changed = Object.keys(pending).length > 0;
  // A QR picked without a link or picture that works can't be saved: the chooser says what is wrong.
  const qrProblem = qrChoiceProblem({ kind: value.qrKind, to: value.qrTo, image: value.qrImage });
  /** A wording box: the default until the host types, and empty (the default again) once they clear it. */
  const wordingValue = (key: WordingKey) => value[key] || (draft[key] === undefined ? MENU_WORDING[key].fallback : "");

  const submit = async (change: Partial<CustomMenuSettings>) => {
    // Only what was sent is cleared: anything typed while it saves stays in its box, ready for the next Save.
    const sent = draft;
    if (await save(change)) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof CustomMenuSettings] !== entry)));
    }
  };

  // Back to the defaults, all but the menu's own marquee, which the marquee card looks after.
  const reset = customMenuChanges(saved, { ...DEFAULT_CUSTOM_MENU, customMarquee: saved.customMarquee });
  const backToDefaults = () => {
    if (!window.confirm(`Put the daytime menu back to its defaults? Colours, fonts, the heading, the QR (back to none), its wording, tonight's bartender, the note and the rotation timings are all reset.${live ? " It is on screen now, so the room sees the change at once." : ""}`)) return;
    void submit(reset);
  };

  return (
    <details className="mt-4 rounded-lg border border-amber-300/40 p-4">
      <summary className="cursor-pointer text-sm">
        🌞 Custom menu (daytime)
        {live ? <span className="ml-2 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">On screen</span> : null}
        {changed ? <span className="ml-2 rounded bg-amber-300/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">unsaved</span> : null}
      </summary>
      <form className="mt-3" onSubmit={(event) => { event.preventDefault(); void submit(pending); }}>
        <p className="text-sm text-neutral-400">Up at the venue during the day: no Bad Decisions code or wording unless you add your own.{live ? " It is on screen now; saving updates it live." : ""}</p>

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

        <p className="mt-4 text-xs text-neutral-400">QR code on this menu</p>
        <div className="mt-1">
          <QrChooser
            value={{ kind: value.qrKind, to: value.qrTo, image: value.qrImage, size: value.qrSize }}
            onChange={(change) => edit({
              ...(change.kind !== undefined ? { qrKind: change.kind } : {}),
              ...(change.to !== undefined ? { qrTo: change.to } : {}),
              ...(change.image !== undefined ? { qrImage: change.image } : {}),
              ...(change.size !== undefined ? { qrSize: change.size } : {}),
            })}
            kinds={QR_CHOICES}
            places={["menu"]}
            busy={busy}
            idPrefix="custom-menu"
            blankIsNone
          />
        </div>

        {value.qrKind ? (
          <>
            <label htmlFor="menu-headline" className="mt-4 block text-xs text-neutral-400">Line above the QR code (optional)</label>
            <input
              id="menu-headline"
              type="text"
              value={value.headline}
              onChange={(event) => edit({ headline: event.target.value })}
              maxLength={HEADLINE_MAX}
              placeholder="e.g. Follow us for tonight's events"
              className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
            />

            <p className="mt-4 text-xs text-neutral-400">Under the QR code (empty lines are left off)</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {(["qrCaption", "qrTitle", "qrLink"] as const).map((key) => (
                <label key={key} className={`block text-xs text-neutral-500 ${key === "qrLink" ? "sm:col-span-2" : ""}`}>
                  {MENU_WORDING[key].label}{MENU_WORDING[key].caps ? " (in capitals)" : ""}
                  <input
                    type="text"
                    value={wordingValue(key)}
                    onChange={(event) => edit({ [key]: event.target.value })}
                    maxLength={MENU_WORDING[key].max}
                    placeholder={MENU_WORDING[key].placeholder}
                    className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}

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
          <ColorRow label="Name colour" value={look.bartenderColor} follow={value.bartenderColor} onPick={(pick) => edit({ bartenderColor: pick })} />
          <p className="mt-1 text-xs text-neutral-500">{value.bartender.trim() ? `${value.bartender.length}/${BARTENDER_MAX}` : "Empty means no bartender on the menu."}</p>
          <label className="mt-3 block text-xs text-neutral-400">
            {MENU_WORDING.bartenderLabel.label} (in capitals)
            <input
              type="text"
              value={wordingValue("bartenderLabel")}
              onChange={(event) => edit({ bartenderLabel: event.target.value })}
              maxLength={MENU_WORDING.bartenderLabel.max}
              placeholder={MENU_WORDING.bartenderLabel.placeholder}
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
        <ColorRow label="Note colour" value={look.noteColor} follow={value.noteColor} onPick={(pick) => edit({ noteColor: pick })} />

        <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md border border-white/15" aria-label="Preview of the custom menu">
          <DrinkMenu
            contained
            marquee={marqueeStyle.on && saved.customMarquee ? saved.customMarquee : null}
            marqueeSpeed={marqueeSpeedOf(marqueeStyle.speed)}
            marqueeColor={marqueeStyle.color}
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
          <button type="submit" disabled={busy || !changed || Boolean(qrProblem)} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
          {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
          <button
            type="button"
            onClick={backToDefaults}
            disabled={busy || (!Object.keys(reset).length && !Object.keys(draft).length)}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
        </div>
      </form>
    </details>
  );
}

/**
 * Quick colour swatches plus a picker for any colour. `value` is the colour
 * as drawn. A row given `follow` (the colour as saved, "" while it follows
 * the text colour) also offers "Same as the text", so a picked colour can go
 * back to following the text rather than staying fixed when the text changes.
 */
function ColorRow({ label, value, follow, onPick }: { label: string; value: string; follow?: string; onPick: (color: string) => void }) {
  const following = follow !== undefined && !follow;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-400">{label}</span>
      {follow !== undefined ? (
        <button
          type="button"
          aria-pressed={following}
          onClick={() => onPick("")}
          className={`rounded-md border px-3 py-1.5 text-sm ${following ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
        >
          Same as the text
        </button>
      ) : null}
      {MENU_COLORS.map((swatch) => {
        const picked = !following && value.toUpperCase() === swatch;
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
