"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DrinkMenu from "@/components/DrinkMenu";
import { MENU_FONT_FAMILY, SCRIPT_FONT_FAMILY } from "@/components/menu-font-faces";
import { useMenuRotation } from "@/components/useMenuRotation";
import {
  DEFAULT_CUSTOM_MENU, HEADLINE_MAX, MARQUEE_MAX, MENU_COLORS, MENU_WORDING, NOTE_MAX, ROTATE_FULL, ROTATE_SECTION,
  cleanMarquee, customLookOf, customMenuChanges, marqueeSpeedOf,
  type CustomMenuSettings, type MarqueeStyle, type WordingKey,
} from "@/lib/drink-menu";
import { boardDrinks, type DrinkList } from "@/lib/drink-list";
import { MENU_FONTS, SCRIPT_FONTS } from "@/lib/menu-fonts";
import { menuPages, nextPage, pageLabel, rotationSummary } from "@/lib/menu-rotation";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { adminQrPreviewSrc, cleanAssetUrl, cleanQrLink, qrChoiceProblem, withHttps, type QrKind } from "@/lib/screen-qr";
import QrChooser, { type QrChoice } from "./QrChooser";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

type Props = {
  /** What is saved now ("" for each default). */
  saved: CustomMenuSettings;
  /** How the marquee runs (on or off, speed, colour): set in the marquee card, for both menus. For the preview. */
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
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

/** The daytime menu's QR choices: none (the default, so nothing about the show), a code for the host's link, or their picture. */
const QR_CHOICES: readonly { id: QrKind; label: string }[] = [{ id: "", label: "No QR code" }, { id: "link", label: "My link" }, { id: "picture", label: "My picture" }];

/** Taller on a phone, so every tap here is an easy 44px; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/** A typed web address waits this long after the last key before the board preview asks for its code. */
const PREVIEW_WAIT_MS = 450;

/**
 * The settings the card would save. A bare address gets https:// in front,
 * as the QR chooser shows it. The picked QR goes as typed, so one that can't
 * be used is turned away with a reason; a half-typed link or picture behind
 * another choice waits in its box, unsent, so it never stops a save.
 */
function settingsToSave(saved: CustomMenuSettings, value: CustomMenuSettings): CustomMenuSettings {
  const to = withHttps(value.qrTo);
  const image = value.qrImage.trim();
  return {
    ...value,
    qrTo: value.qrKind === "link" || !to || cleanQrLink(to) ? to : saved.qrTo,
    qrImage: value.qrKind === "picture" || !image || cleanAssetUrl(image) ? image : saved.qrImage,
  };
}

/** `value` once it has stayed the same for `ms`: a typed address asks for one code when the typing stops, not one per letter. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * "🌞 Custom menu (daytime)": the venue's menu for the day, with nothing
 * about Pins & Needles or Bad Decisions unless the host writes it. Its
 * heading, text colour and font; its own QR (none until the host picks their
 * link or picture), its size, the line above it and the words under it;
 * tonight's bartender's look and the words over the name (the name itself is
 * in its own box under the live screen); a note; the full menu taking turns
 * with its sections a few drinks at a time; and its own marquee text (none
 * until the host writes one). A preview shows the board as it is edited,
 * page by page, before anything is saved, and Save sends only what changed.
 * Folded until opened, and its typing stays put while it is folded.
 */
export default function CustomMenuCard({ saved, marqueeStyle, drinks, samePriceLine, live, busy, save, editBartender, onPhase }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<CustomMenuSettings>>({});
  // A picture on its way up: Save waits for its address.
  const [uploading, setUploading] = useState(false);
  // The preview only turns its pages while the card is open and the host asked it to.
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  // How the drinks fit the page in the preview: a longer list, a bartender and a note all take room.
  const [fit, setFit] = useState({ size: 1, fits: true, panelFits: true });
  const { memo, fresh, track } = useSaveTracker();
  const edit = (change: Partial<CustomMenuSettings>) => setDraft((current) => ({ ...current, ...change }));
  const value: CustomMenuSettings = { ...saved, ...draft };

  const next = settingsToSave(saved, value);
  const pending = customMenuChanges(saved, next);
  const dirty = Object.keys(pending).length > 0;
  // A QR picked without a link or picture that works can't be saved: the chooser says what is wrong.
  const qrProblem = qrChoiceProblem({ kind: value.qrKind, to: withHttps(value.qrTo), image: value.qrImage });

  // What the board shows, defaults filled in, exactly as the live screen will draw it (a link's code from the signed-in preview).
  const previewLink = useSettled(next.qrTo, PREVIEW_WAIT_MS);
  const look = customLookOf({ ...next, qrTo: previewLink }, adminQrPreviewSrc);
  const shownDrinks = useMemo(() => boardDrinks(drinks, samePriceLine), [drinks, samePriceLine]);
  // The pages the live screen turns, worked out from the drinks exactly as the board shows them.
  const pages = useMemo(() => menuPages(shownDrinks), [shownDrinks]);
  const rotating = look.rotate !== null && pages.length > 1;
  const { page, index, pin } = useMenuRotation(pages, look.rotate, playing && open && rotating);
  const shownPage = rotating ? page : null;
  const onSectionPage = Boolean(shownPage?.sections.length);
  // The daytime menu runs only its own marquee, and only while the marquee is switched on.
  const marquee = marqueeStyle.on ? cleanMarquee(value.customMarquee) : "";

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async (change: Partial<CustomMenuSettings>, { clearAll = false } = {}) => {
    if (!Object.keys(change).length) {
      if (clearAll) setDraft({});
      return;
    }
    // Only what was sent is cleared: anything typed while it saves stays in its box, ready for the next Save.
    const sent = draft;
    if (await track(() => save(change))) {
      setDraft((current) => clearAll ? {} : Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof CustomMenuSettings] !== entry)));
    }
  };

  // Back to the defaults. Tonight's bartender stays (it has its own box), and so do the link and picture, ready to pick again.
  const defaults = customMenuChanges(saved, { ...DEFAULT_CUSTOM_MENU, bartender: saved.bartender, qrTo: saved.qrTo, qrImage: saved.qrImage });
  const backToDefaults = () => {
    if (!window.confirm(`Put the daytime menu back to its defaults? Its colours, fonts, heading, QR code (back to none), words, note, rotation timings and marquee (back to none) are all reset. Tonight's bartender stays.${live ? " It is on screen now, so the room sees the change at once." : ""}`)) return;
    void submit(defaults, { clearAll: true });
  };

  const editQr = (change: Partial<QrChoice>) => edit({
    ...(change.kind !== undefined ? { qrKind: change.kind } : {}),
    ...(change.to !== undefined ? { qrTo: change.to } : {}),
    ...(change.image !== undefined ? { qrImage: change.image } : {}),
    ...(change.size !== undefined ? { qrSize: change.size } : {}),
  });

  /** A line of the menu's wording: empty means its default (shown greyed in the box). */
  const wordBox = (key: WordingKey, hint: string, placeholder: string = MENU_WORDING[key].placeholder) => (
    <TextBox
      id={`custom-menu-${key}`}
      label={MENU_WORDING[key].label}
      value={value[key]}
      max={MENU_WORDING[key].max}
      caps={MENU_WORDING[key].caps}
      placeholder={placeholder}
      hint={hint}
      onChange={(text) => edit({ [key]: text })}
    />
  );

  // A choice button; `size` is its type size, larger for the font samples.
  const chip = (picked: boolean, size = "text-sm") => `${TAP} rounded-md border px-3 py-1.5 ${size} ${picked ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`;
  const fitWords = onSectionPage
    ? "A section page: a few drinks at a time, in big type."
    : !fit.fits
      ? "Too much to fit on this menu: the screen would cut some drinks off. Shorten the note, or hide a few drinks in 🍸 Drink list."
      : fit.size < 1
        ? `To fit everything on this menu, the drinks are set at ${Math.round(fit.size * 100)}% size.`
        : fit.size > 1
          ? `Room to spare, so the drinks are set bigger (${Math.round(fit.size * 100)}%) to fill it.`
          : "";

  return (
    <details id="custom-menu-card" className="mt-4 rounded-lg border border-amber-300/40 p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="-my-3 cursor-pointer py-3 text-sm sm:my-0 sm:py-0">
        🌞 Custom menu (daytime)
        {live ? <span className="ml-2 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">On screen</span> : null}
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </summary>
      <form className="mt-3 space-y-5" onSubmit={(event) => { event.preventDefault(); if (!qrProblem && !uploading) void submit(pending); }}>
        <p className="text-sm text-neutral-400">
          The venue&rsquo;s menu for the daytime: the drinks in your colour and font, with no QR code, no marquee and nothing about the show unless you add your own. Nothing changes on screen until you press Save.{live ? " It is on screen now." : ""}
        </p>

        <Group title="Look">
          {wordBox("heading", "Under the logo. Shows in capitals. Empty uses “MENU”.")}
          <ColorRow label="Text colour" value={look.color} onPick={(pick) => edit({ color: pick })} />
          <div>
            <p className="text-xs text-neutral-400">Font</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Menu font">
              {MENU_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  aria-pressed={look.font === font.id}
                  onClick={() => edit({ font: font.id })}
                  className={`${chip(look.font === font.id, "text-base")} leading-tight`}
                  style={{ fontFamily: MENU_FONT_FAMILY[font.id] }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="QR code">
          <p className="text-xs text-neutral-400">None until you pick one. This menu has its own QR, its own size and its own words; the show screens&rsquo; QR never shows here.</p>
          <QrChooser
            value={{ kind: value.qrKind, to: value.qrTo, image: value.qrImage, size: value.qrSize }}
            onChange={editQr}
            kinds={QR_CHOICES}
            places={["menu"]}
            busy={busy}
            idPrefix="custom-menu"
            blankIsNone
            onUploading={setUploading}
          />
          {value.qrKind ? (
            <>
              <TextBox
                id="custom-menu-headline"
                label="Line above the QR code"
                value={value.headline}
                max={HEADLINE_MAX}
                caps
                placeholder="e.g. Follow us for tonight's events"
                hint="Shows in capitals. Empty leaves it off."
                onChange={(text) => edit({ headline: text })}
              />
              {wordBox("qrCaption", "Shows in capitals. Empty leaves it off.")}
              {wordBox("qrTitle", "Shows in capitals. Empty leaves it off.")}
              {wordBox(
                "qrLink",
                value.qrKind === "link" ? "Empty shows your link, shortened." : "Empty leaves it off.",
                value.qrKind === "link" && look.qr ? look.qrLink : MENU_WORDING.qrLink.placeholder,
              )}
            </>
          ) : null}
        </Group>

        <Group title="Tonight’s bartender">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/15 bg-black px-3 py-2">
            <p className="min-w-0 flex-1 basis-40">
              {saved.bartender
                ? <span style={{ fontFamily: SCRIPT_FONT_FAMILY[look.bartenderFont], fontSize: 26, lineHeight: 1.2, color: look.bartenderColor, overflowWrap: "anywhere" }}>{saved.bartender}</span>
                : <span className="text-sm text-neutral-400">No bartender on the menu.</span>}
            </p>
            <button type="button" onClick={editBartender} className={`${TAP} rounded-md border border-white/30 px-3 py-1.5 text-sm`}>
              ✏️ {saved.bartender ? "Change" : "Add"} tonight&rsquo;s bartender
            </button>
          </div>
          <p className="text-xs text-neutral-500">The name goes in the 🍹 Tonight&rsquo;s bartender box under the live screen, so it is in reach mid-show. Its look is here.</p>
          {wordBox("bartenderLabel", "Over the name. Shows in capitals. Empty uses “Your bartender tonight”.")}
          <div>
            <p className="text-xs text-neutral-400">The name&rsquo;s font</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Bartender font">
              {SCRIPT_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  aria-pressed={look.bartenderFont === font.id}
                  aria-label={`Bartender font: ${font.label}`}
                  onClick={() => edit({ bartenderFont: font.id })}
                  className={`${chip(look.bartenderFont === font.id, "text-xl")} leading-tight`}
                  style={{ fontFamily: SCRIPT_FONT_FAMILY[font.id] }}
                >
                  {saved.bartender || font.label}
                </button>
              ))}
            </div>
          </div>
          <ColorRow label="Name colour" value={look.bartenderColor} follow={value.bartenderColor} onPick={(pick) => edit({ bartenderColor: pick })} />
        </Group>

        <Group title="Note">
          <TextBox
            id="custom-menu-note"
            label="Note in the empty space, under the bartender"
            value={value.note}
            max={NOTE_MAX}
            placeholder="e.g. Happy hour till 9"
            hint="Empty means no note."
            onChange={(text) => edit({ note: text })}
          />
          <ColorRow label="Note colour" value={look.noteColor} follow={value.noteColor} onPick={(pick) => edit({ noteColor: pick })} />
        </Group>

        <Group title="Taking turns">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Take turns between the full menu and its sections">
            <button type="button" aria-pressed={value.rotateOn} onClick={() => edit({ rotateOn: true })} className={chip(value.rotateOn)}>On: full menu, then a few drinks at a time</button>
            <button type="button" aria-pressed={!value.rotateOn} onClick={() => edit({ rotateOn: false })} className={chip(!value.rotateOn)}>Off: the full menu stays up</button>
          </div>
          {value.rotateOn ? (
            <>
              <div>
                <p className="text-xs text-neutral-400">The full menu stays up for</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="How long the full menu stays up">
                  {ROTATE_FULL.map((entry) => (
                    <button key={entry.id || "default"} type="button" aria-pressed={value.rotateFull === entry.id} onClick={() => edit({ rotateFull: entry.id })} className={chip(value.rotateFull === entry.id)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Each section page stays up for</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="How long each section page stays up">
                  {ROTATE_SECTION.map((entry) => (
                    <button key={entry.id || "default"} type="button" aria-pressed={value.rotateSection === entry.id} onClick={() => edit({ rotateSection: entry.id })} className={chip(value.rotateSection === entry.id)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <p className="text-xs text-neutral-400" aria-live="polite">
            {look.rotate
              ? `${rotationSummary(pages, look.rotate)}${pages.length > 1 ? " Then it lands back on the full menu, round and round." : ""}`
              : "Off: the full menu stays up the whole time."}
          </p>
        </Group>

        <Group title="Marquee on this menu">
          <TextBox
            id="custom-menu-marquee"
            label="Marquee text"
            value={value.customMarquee}
            max={MARQUEE_MAX}
            caps
            placeholder="Leave empty for no marquee"
            hint={marqueeStyle.on
              ? "Empty means no marquee on the daytime menu. It runs at the speed and in the colour set in 🎞️ Marquee."
              : "The marquee is switched off in 🎞️ Marquee, so this won’t run until it is back on there."}
            onChange={(text) => edit({ customMarquee: text })}
          />
        </Group>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Preview</p>
          <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-md border border-white/15" role="img" aria-label="Preview of the custom menu, as the live screen will draw it">
            <DrinkMenu
              contained
              marquee={marquee || null}
              marqueeSpeed={marqueeSpeedOf(marqueeStyle.speed)}
              marqueeColor={marqueeStyle.color}
              custom={look}
              drinks={shownDrinks}
              page={shownPage}
              onFit={setFit}
            />
          </div>
          {rotating ? (
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Preview the pages it takes turns with">
              <button type="button" aria-pressed={index === 0} onClick={() => pin(null)} className={chip(index === 0)}>Full menu</button>
              <button type="button" onClick={() => pin(pages[nextPage(index, pages)].key)} className={chip(false)}>Next page →</button>
              <button type="button" aria-pressed={playing} onClick={() => setPlaying((on) => !on)} className={chip(playing)}>{playing ? "⏸ Stop" : "▶ Play at real speed"}</button>
              <p className="min-w-0 flex-1 basis-40 text-xs text-neutral-400" aria-live={playing ? "off" : "polite"}>
                Page {index + 1} of {pages.length}: {pageLabel(page)}
              </p>
            </div>
          ) : null}
          {fitWords ? <p className={`mt-2 text-xs ${!onSectionPage && !fit.fits ? "text-amber-200" : "text-neutral-500"}`}>{fitWords}</p> : null}
          {look.qr && !fit.panelFits && !onSectionPage ? (
            <p className="mt-1 text-xs text-amber-200">The words beside the QR code don&rsquo;t all fit. Shorten them, or make the QR code smaller.</p>
          ) : null}
        </div>

        {/* Stays in reach at the bottom of the screen while the host works down a long card on a phone. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-white/10 bg-neutral-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton
            type="submit"
            dirty={dirty}
            memo={memo}
            fresh={fresh}
            busy={busy}
            blocked={Boolean(qrProblem) || uploading}
            label={dirty ? `Save ${Object.keys(pending).length === 1 ? "1 change" : `${Object.keys(pending).length} changes`}` : undefined}
          />
          {Object.keys(draft).length ? (
            <button type="button" onClick={() => setDraft({})} disabled={busy || uploading} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button>
          ) : null}
          <button
            type="button"
            onClick={backToDefaults}
            disabled={busy || uploading || (!Object.keys(defaults).length && !Object.keys(draft).length)}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
          {uploading ? <span className="w-full text-xs text-neutral-500">Save and Undo wait until the picture is in.</span> : qrProblem ? <span className="w-full text-xs text-amber-200">Save waits for the QR code: {qrProblem}</span> : null}
        </div>
      </form>
    </details>
  );
}

/** One part of the card, under a small heading, so a phone can see where each part starts. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-white/15 px-3 pb-3 pt-1">
      <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A line of text to type: its label, how much of its most is used, and what empty means. `caps` sets it in capitals, as the board does. */
function TextBox({ id, label, value, max, caps, placeholder, hint, onChange }: {
  id: string;
  label: string;
  value: string;
  max: number;
  caps?: boolean;
  placeholder: string;
  hint: string;
  onChange: (text: string) => void;
}) {
  const full = value.length >= max;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-neutral-200">{label}</label>
        <span id={`${id}-count`} className={`shrink-0 text-xs tabular-nums ${full ? "text-amber-200" : "text-neutral-500"}`}>
          {value.length}/{max}<span className="sr-only"> characters{full ? ", the most that fits" : ""}</span>
        </span>
      </div>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={max}
        placeholder={placeholder}
        aria-describedby={`${id}-count ${id}-hint`}
        className={`${TAP} w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base text-white placeholder:text-neutral-500 sm:text-sm ${caps ? "uppercase placeholder:normal-case" : ""}`}
      />
      <p id={`${id}-hint`} className="text-xs text-neutral-500">{hint}</p>
    </div>
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
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label={label}>
        {follow !== undefined ? (
          <button
            type="button"
            aria-pressed={following}
            onClick={() => onPick("")}
            className={`${TAP} rounded-md border px-3 py-1.5 text-sm ${following ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`}
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
              className={`h-11 w-11 rounded-full border sm:h-7 sm:w-7 ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
              style={{ background: swatch }}
            />
          );
        })}
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="color" aria-label={`${label}: any colour`} value={value.toLowerCase()} onChange={(event) => onPick(event.target.value.toUpperCase())} className="h-11 w-12 cursor-pointer rounded border border-white/30 bg-black sm:h-7 sm:w-9" />
          <span className="font-mono">{value.toUpperCase()}</span>
        </label>
      </div>
    </div>
  );
}
