"use client";

import type { ReactElement } from "react";
import {
  QR_BASE, QR_LINK_MAX, QR_SIZE_MAX, QR_SIZE_MIN, QR_SIZE_STEP, longLink, qrChoiceProblem, withHttps, type QrKind, type QrPlace,
} from "@/lib/screen-qr";

/** One QR choice as a card edits it: where it leads, the link and picture (kept while another is picked), and its size as a percentage. */
export type QrChoice = { kind: QrKind; to: string; image: string; size: number };

/**
 * Picking a QR: where it leads (`kinds` names the choices, "" first), the
 * host's link or picture, and its size. `places` are where it will be drawn,
 * so the size note can say where it stops growing. `blankIsNone` says ""
 * is no QR at all (the custom menu), so there is no size to pick; on the
 * show screens "" is the question form, which has one. `idPrefix` keeps two
 * choosers' boxes apart on one page.
 *
 * A basic version for now: a pasted address for a picture. The show-screen
 * cards finish it (upload, live code preview).
 */
export default function QrChooser({ value, onChange, kinds, places, busy, idPrefix, blankIsNone }: {
  value: QrChoice;
  onChange: (change: Partial<QrChoice>) => void;
  kinds: readonly { id: QrKind; label: string }[];
  places: readonly QrPlace[];
  busy: boolean;
  idPrefix: string;
  blankIsNone?: boolean;
}): ReactElement {
  const problem = qrChoiceProblem(value);
  const chip = (picked: boolean) => `rounded-md border px-3 py-1.5 text-sm ${picked ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`;
  // Where a bigger size stops showing bigger, said once for every place that stops short of the most.
  const stops = places.filter((place) => QR_BASE[place].maxPercent < QR_SIZE_MAX);
  const sized = !(blankIsNone && value.kind === "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where the QR code leads">
        {kinds.map((kind) => (
          <button key={kind.id || "none"} type="button" aria-pressed={value.kind === kind.id} disabled={busy} onClick={() => onChange({ kind: kind.id })} className={chip(value.kind === kind.id)}>
            {kind.label}
          </button>
        ))}
      </div>

      {value.kind === "link" ? (
        <div>
          <label htmlFor={`${idPrefix}-qr-link`} className="block text-xs text-neutral-400">Web address the code opens</label>
          <input
            id={`${idPrefix}-qr-link`}
            type="url"
            inputMode="url"
            value={value.to}
            onChange={(event) => onChange({ to: event.target.value })}
            onBlur={(event) => onChange({ to: withHttps(event.target.value) })}
            maxLength={QR_LINK_MAX + 20}
            placeholder="https://instagram.com/yourbar"
            className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
          {!problem && longLink(value.to) ? <p className="mt-1 text-xs text-amber-200">Long links make a dense code that&rsquo;s hard to scan from across the room. Use a short link.</p> : null}
        </div>
      ) : null}

      {value.kind === "picture" ? (
        <div>
          <label htmlFor={`${idPrefix}-qr-image`} className="block text-xs text-neutral-400">Picture&rsquo;s address</label>
          <input
            id={`${idPrefix}-qr-image`}
            type="text"
            value={value.image}
            onChange={(event) => onChange({ image: event.target.value })}
            placeholder="https://… or /uploads/…"
            className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
          />
        </div>
      ) : null}

      {problem ? <p className="text-xs text-red-300" role="alert">{problem}</p> : null}

      {sized ? (
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>Size</span>
          <input
            type="range"
            min={QR_SIZE_MIN}
            max={QR_SIZE_MAX}
            step={QR_SIZE_STEP}
            value={value.size}
            disabled={busy}
            onChange={(event) => onChange({ size: Number(event.target.value) })}
            className="min-w-0 flex-1 accent-amber-300"
          />
          <span className="w-12 text-right tabular-nums text-neutral-300">{value.size}%</span>
        </label>
      ) : null}
      {sized && stops.length ? (
        <p className="text-xs text-neutral-500">
          100% is its usual size. {stops.map((place) => `${place === "explainer" ? "The Intro" : place === "menu" ? "The drink menu" : "The corner"} stops at ${QR_BASE[place].maxPercent}%.`).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
