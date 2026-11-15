"use client";

import { useEffect, useRef, useState } from "react";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { DEFAULT_QR_SIZE, QR_BASE, QR_SIZE_MAX, QR_SIZE_MIN, QR_SIZE_STEP } from "@/lib/screen-qr";
import { openCard } from "./open-card";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

/**
 * The show QR's size, open at the top of Setup so it is one slide and one
 * tap away: the code in the live screen's corner, on the show-night drink
 * menu and in the Intro. Where that code leads (and the picture that can
 * stand in for it) is in "🔳 QR code on the show screens". The daytime
 * custom menu has its own QR and its own size, in its card.
 */
export default function MenuQrSizeCard({ saved, busy, save, onPhase }: {
  /** The size saved now, as a percentage of the usual size. */
  saved: number;
  busy: boolean;
  /** The new size. True once saved. */
  save: (size: number) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const { memo, fresh, track } = useSaveTracker();
  const value = draft ?? saved;
  const dirty = value !== saved;

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async () => {
    const sent = value;
    // Only the size that was sent is cleared: a slide made while it saves stays, ready for the next Save.
    if (await track(() => save(sent))) setDraft((current) => current === sent ? null : current);
  };

  return (
    <form id="menu-qr-size-card" className="mt-4 space-y-3 rounded-lg border border-white/20 p-4" onSubmit={(event) => { event.preventDefault(); if (dirty) void submit(); }}>
      <div className="flex flex-wrap items-center gap-y-1">
        <label htmlFor="menu-qr-size" className="text-sm">QR code size on the show screens</label>
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-xs text-neutral-400">Smaller</span>
        <input
          id="menu-qr-size"
          type="range"
          min={QR_SIZE_MIN}
          max={QR_SIZE_MAX}
          step={QR_SIZE_STEP}
          value={value}
          disabled={busy}
          aria-valuetext={`${value}%`}
          aria-describedby="menu-qr-size-note"
          onChange={(event) => setDraft(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 accent-amber-300 sm:h-6"
        />
        <span aria-hidden="true" className="text-xs text-neutral-400">Larger</span>
        <output htmlFor="menu-qr-size" className="w-12 text-right text-sm tabular-nums">{value}%</output>
      </div>
      <p id="menu-qr-size-note" className="text-xs text-neutral-400">
        The code in the corner of the live screen, on the show-night drink menu and in the Intro (which stops at {QR_BASE.explainer.maxPercent}%). 100% is the usual size. The daytime custom menu has its own QR size, in 🌞 Custom menu.
      </p>
      <div className="flex flex-wrap items-center gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
        <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} label="Save QR size" />
        <button type="button" disabled={busy || value === DEFAULT_QR_SIZE} onClick={() => setDraft(DEFAULT_QR_SIZE)} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Usual size (100%)</button>
        <button type="button" onClick={() => openCard("show-qr-card")} className="px-1 text-xs text-neutral-400 underline underline-offset-2">Where it leads, or your own picture</button>
      </div>
    </form>
  );
}
