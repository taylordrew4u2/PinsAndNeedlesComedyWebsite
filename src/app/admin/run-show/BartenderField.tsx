"use client";

import { useEffect, useRef, useState } from "react";
import { SCRIPT_FONT_FAMILY } from "@/components/menu-font-faces";
import { BARTENDER_MAX, DEFAULT_MENU_COLOR, MENU_WORDING, cleanBartender, cleanColor, wordingToSave, type CustomMenuSettings } from "@/lib/drink-menu";
import { DEFAULT_SCRIPT_FONT, isScriptFont } from "@/lib/menu-fonts";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

/** Taller on a phone, so every tap here is an easy 44px; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/** What this box saves: the name, the words over it, or both. */
export type BartenderChange = Partial<Pick<CustomMenuSettings, "bartender" | "bartenderLabel">>;

/**
 * "Tonight's bartender": the one box for the name on the daytime (custom)
 * menu, right under the live screen's mirror, so it is in reach on a phone
 * without opening Setup. The host couldn't find where to change it, so it is
 * never folded and says plainly what it is. The words over the name ("Your
 * bartender tonight") are one tap away under it. Saves only what changed,
 * straight to the menu; the custom menu card shows the name and links here.
 */
export default function BartenderField({ name, label = "", font, color = "", live, busy, save, onPhase }: {
  /** Tonight's bartender as saved; "" for none. */
  name: string;
  /** The words over the name as saved; "" for the default, "Your bartender tonight". */
  label?: string;
  /** The name's script font as saved ("" for the default), so the box shows it the way the room will. */
  font: string;
  /** The colour the name is drawn in; "" for the menu's red. */
  color?: string;
  /** The custom (daytime) menu is on the live screen now, so a save shows at once. */
  live: boolean;
  busy: boolean;
  /** Only what changed. True once saved. */
  save: (change: BartenderChange) => Promise<boolean>;
  /** Hears where the box's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
}) {
  // What the host has typed; null shows what is saved.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  // The words over the name are rarely changed, so they wait behind a tap unless the host has their own.
  const [labelOpen, setLabelOpen] = useState(false);
  const { memo, fresh, track } = useSaveTracker();

  const typedName = draftName ?? name;
  const typedLabel = draftLabel ?? label;
  // Cleaned the way the server keeps them, so a stray space or the default typed out is no change.
  const nextName = cleanBartender(typedName);
  const nextLabel = wordingToSave("bartenderLabel", typedLabel);
  const change: BartenderChange = {
    ...(nextName === name ? {} : { bartender: nextName }),
    // Drawn in capitals, so a change of capitals alone is no change.
    ...(nextLabel.toUpperCase() === label.toUpperCase() ? {} : { bartenderLabel: nextLabel }),
  };
  const dirty = Object.keys(change).length > 0;

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async () => {
    if (!dirty) return;
    const sentName = draftName;
    const sentLabel = draftLabel;
    // Only what was sent is cleared: anything typed while it saves stays in its box, ready for the next Save.
    if (await track(() => save(change))) {
      setDraftName((current) => (current === sentName ? null : current));
      setDraftLabel((current) => (current === sentLabel ? null : current));
    }
  };

  const shownFont = isScriptFont(font) ? font : DEFAULT_SCRIPT_FONT;
  const shownColor = cleanColor(color) || DEFAULT_MENU_COLOR;
  const showLabelBox = labelOpen || Boolean(label) || draftLabel !== null;
  // Opened with a tap: the cursor goes straight into the box that just appeared.
  const labelInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (labelOpen) labelInput.current?.focus(); }, [labelOpen]);

  return (
    <form
      id="bartender-field"
      className="mt-4 rounded-lg border-2 border-amber-300/60 bg-amber-300/5 p-4"
      onSubmit={(event) => { event.preventDefault(); void submit(); }}
    >
      <div className="flex flex-wrap items-center gap-y-1">
        <label htmlFor="bartender-name" className="text-base font-semibold">🍹 Tonight&rsquo;s bartender</label>
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </div>
      <div className="mt-2 flex flex-wrap items-stretch gap-2">
        <input
          id="bartender-name"
          type="text"
          value={typedName}
          onChange={(event) => setDraftName(event.target.value)}
          maxLength={BARTENDER_MAX}
          placeholder="Who’s behind the bar?"
          autoComplete="off"
          aria-describedby="bartender-name-hint"
          className={`${TAP} min-w-0 flex-1 basis-48 rounded-md border border-white/30 bg-black px-3 py-1.5 text-white placeholder:text-neutral-500`}
          // The name as the room will see it: its script, its colour, big enough to read on a phone.
          style={{ fontFamily: SCRIPT_FONT_FAMILY[shownFont], fontSize: 24, lineHeight: 1.2, color: shownColor }}
        />
        <div className="flex gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} />
          {draftName !== null || draftLabel !== null ? (
            <button type="button" onClick={() => { setDraftName(null); setDraftLabel(null); }} disabled={busy} className="rounded-md border border-white/30 px-3 py-2 text-sm disabled:opacity-40">Undo</button>
          ) : null}
        </div>
      </div>
      <p id="bartender-name-hint" className="mt-1.5 text-xs text-neutral-400">
        Shows on both menus, the show-night one and the 🌞 daytime one, under the drinks.{" "}
        {nextName ? `${typedName.length}/${BARTENDER_MAX}.` : "Empty means no bartender on the menu."}
        {live ? " That menu is on screen now, so Save shows it at once." : ""}
      </p>

      {showLabelBox ? (
        <div className="mt-3">
          <label htmlFor="bartender-label" className="block text-xs text-neutral-400">
            {MENU_WORDING.bartenderLabel.label} (shows in capitals)
          </label>
          <input
            ref={labelInput}
            id="bartender-label"
            type="text"
            value={typedLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            maxLength={MENU_WORDING.bartenderLabel.max}
            placeholder={MENU_WORDING.bartenderLabel.fallback}
            aria-describedby="bartender-label-hint"
            className={`${TAP} mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base uppercase text-white placeholder:text-neutral-500 sm:text-sm`}
          />
          <p id="bartender-label-hint" className="mt-1 text-xs text-neutral-500">Empty uses &ldquo;{MENU_WORDING.bartenderLabel.fallback}&rdquo;.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLabelOpen(true)}
          aria-expanded={false}
          className={`${TAP} mt-2 rounded-md px-1 text-left text-xs text-neutral-400 underline underline-offset-2`}
        >
          Over the name it says &ldquo;{MENU_WORDING.bartenderLabel.fallback.toUpperCase()}&rdquo;. Change those words
        </button>
      )}
    </form>
  );
}
