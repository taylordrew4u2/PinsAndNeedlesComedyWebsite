"use client";

import { useEffect, useRef, useState } from "react";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { cleanAssetUrl, cleanQrLink } from "@/lib/screen-qr";
import { SCREEN_TEXT, SCREEN_TEXT_GROUPS, TEXT_KEYS, cleanScreenText, screenChanges, type ScreenSettings, type ScreenText } from "@/lib/screen-settings";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

/** Words this long or longer get two lines to type in, so a phone shows the whole thing. */
const LONG_WORDS = 60;

/** Taller on a phone, so buttons are an easy 44px tap; back to their own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/**
 * "✏️ Words on the screen": every word the show screens draw, in one card,
 * grouped the way the room sees them (SCREEN_TEXT_GROUPS). Each box shows
 * the host's own words, or is empty with the printed wording greyed in it;
 * empty always means the printed wording. Each says how long it may be (the
 * most the screen's layout takes) and whether the screen sets it in
 * capitals. Saves only the words that changed (screenChanges with
 * TEXT_KEYS), so it never writes over a switch or the QR saved from another
 * card or phone. The daytime custom menu's words are in its own card.
 */
export default function ScreenWordsCard({ saved, busy, pageLive, save, onPhase }: {
  /** What is saved now; "" words are the printed ones. */
  saved: ScreenSettings;
  busy: boolean;
  /** The Bad Decisions page is on, so the QR and the words beside it are on the show screens. */
  pageLive: boolean;
  /** Only the words that changed. True once saved. */
  save: (change: Partial<ScreenSettings>) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
}) {
  // Only what the host has touched; everything else shows the saved words.
  const [draft, setDraft] = useState<Partial<Record<ScreenText, string>>>({});
  const { memo, fresh, track } = useSaveTracker();
  const value: ScreenSettings = { ...saved, ...draft };
  // Cleaned the way the server cleans it (a word typed exactly as printed counts as printed), and only that is sent.
  const pending = screenChanges(saved, value, TEXT_KEYS);
  const dirty = Object.keys(pending).length > 0;
  const own = (key: ScreenText) => Boolean(cleanScreenText(key, value[key]));
  const ownCount = TEXT_KEYS.filter((key) => Boolean(saved[key])).length;
  const printed = screenChanges(saved, { ...saved, ...Object.fromEntries(TEXT_KEYS.map((key) => [key, ""])) }, TEXT_KEYS);

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const edit = (key: ScreenText, words: string) => setDraft((current) => ({ ...current, [key]: words }));
  const submit = async (change: Partial<ScreenSettings>) => {
    // Only what was sent is cleared: anything typed while it saves stays in its box, ready for the next Save.
    const sent = draft;
    if (await track(() => save(change))) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as ScreenText] !== entry)));
    }
  };

  // With the host's own link or picture on the QR, the menu's lines under it are only the host's own words.
  const ownQr = (saved.qrKind === "link" && cleanQrLink(saved.qrTo)) || (saved.qrKind === "picture" && cleanAssetUrl(saved.qrImage)) ? saved.qrKind : "";

  const box = (key: ScreenText) => {
    const { fallback, max, label, hint, caps } = SCREEN_TEXT[key];
    const id = `screen-words-${key}`;
    const words = value[key];
    const long = max >= LONG_WORDS;
    const full = words.length >= max;
    // Set in capitals here too when the screen does, so the box looks like what the room will read.
    const field = `w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base text-white placeholder:text-neutral-500 sm:text-sm ${caps ? "uppercase" : ""}`;
    const changed = key in pending;
    return (
      <div key={key} className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm text-neutral-200">
            {label}
            {changed ? <span className="ml-1.5 text-[11px] font-semibold text-amber-200">● changed</span> : null}
          </label>
          <span id={`${id}-count`} className={`shrink-0 text-xs tabular-nums ${full ? "text-amber-200" : "text-neutral-500"}`}>
            {words.length}/{max}<span className="sr-only"> characters{full ? ", the most that fits" : ""}</span>
          </span>
        </div>
        {long ? (
          <textarea
            id={id}
            rows={2}
            value={words}
            onChange={(event) => edit(key, event.target.value.replace(/\n/g, " "))}
            maxLength={max}
            placeholder={fallback}
            disabled={busy}
            aria-describedby={`${id}-count ${id}-hint`}
            className={`${field} resize-none`}
          />
        ) : (
          <input
            id={id}
            type="text"
            value={words}
            onChange={(event) => edit(key, event.target.value)}
            maxLength={max}
            placeholder={fallback}
            disabled={busy}
            aria-describedby={`${id}-count ${id}-hint`}
            className={`${TAP} ${field}`}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p id={`${id}-hint`} className="min-w-0 flex-1 basis-48 text-xs text-neutral-500">
            {[caps ? "Shows in capitals." : "", hint ?? "", own(key) ? "" : "Empty uses the printed wording."].filter(Boolean).join(" ")}
          </p>
          {own(key) ? (
            <button
              type="button"
              onClick={() => edit(key, "")}
              disabled={busy}
              title={`Printed: “${fallback}”`}
              aria-label={`Use the printed wording for “${label}”: ${fallback}`}
              className={`${TAP} shrink-0 rounded-md border border-white/25 px-2.5 py-1 text-xs text-neutral-200 disabled:opacity-40`}
            >
              Use the printed wording
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <details id="screen-words-card" className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="cursor-pointer text-sm">
        ✏️ Words on the screen
        {ownCount ? <span className="ml-1 text-xs text-neutral-400">({ownCount} of your own)</span> : null}
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </summary>
      <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(pending); }}>
        <p className="text-sm text-neutral-400">
          Every word the show screens draw, and the TV&rsquo;s own buttons. Type your own, or leave a box empty for the printed wording (shown greyed in it). Each box stops at the most that fits the screen. Nothing changes until you press Save. The daytime custom menu&rsquo;s words are in its own card.
        </p>
        {pageLive ? null : (
          <p className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
            The Bad Decisions page is switched off, so the screens have no QR right now, and the words under and beside it don&rsquo;t show until it&rsquo;s back on.
          </p>
        )}

        {SCREEN_TEXT_GROUPS.map((group) => {
          const changes = group.keys.filter((key) => key in pending).length;
          const mine = group.keys.filter((key) => Boolean(saved[key])).length;
          return (
            // Folded, so a phone sees the five places at a glance. Still mounted while folded, so typing survives.
            <details key={group.id} id={`screen-words-${group.id}`} className="rounded-md border border-white/15">
              <summary className={`${TAP} flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm`}>
                <span className="font-semibold">{group.title}</span>
                <span className="text-xs text-neutral-500">
                  {group.keys.length} {group.keys.length === 1 ? "line" : "lines"}{mine ? `, ${mine} your own` : ""}
                </span>
                {changes ? <span className="text-[11px] font-semibold text-amber-200">● {changes} not saved yet</span> : null}
              </summary>
              <fieldset className="space-y-4 border-t border-white/10 px-3 pb-3 pt-3">
                <legend className="sr-only">{group.title}</legend>
                <p className="text-xs text-neutral-400">{group.when}</p>
                {group.id === "standard" && ownQr ? (
                  <p className="text-xs text-amber-200">
                    Your own {ownQr} is on the QR, so the lines under it show only what you write here (empty ones are left off{ownQr === "link" ? ", and an empty web address shows your link" : ""}).
                  </p>
                ) : null}
                {group.keys.map(box)}
              </fieldset>
            </details>
          );
        })}

        {/* Stays in reach at the bottom of the screen while the host works down a long card on a phone. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-white/10 bg-neutral-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} label={dirty ? `Save ${Object.keys(pending).length === 1 ? "1 change" : `${Object.keys(pending).length} changes`}` : undefined} />
          {Object.keys(draft).length ? (
            <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button>
          ) : null}
          <button
            type="button"
            onClick={() => { if (window.confirm("Put every word on the show screens back to the printed wording? Your own words are cleared.")) void submit(printed); }}
            disabled={busy || !Object.keys(printed).length}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Printed wording everywhere
          </button>
        </div>
      </form>
    </details>
  );
}
