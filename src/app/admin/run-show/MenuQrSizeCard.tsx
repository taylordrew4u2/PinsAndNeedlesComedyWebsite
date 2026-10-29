"use client";

import { useState } from "react";
import { QR_SIZE_MAX, QR_SIZE_MIN } from "@/lib/screen-settings";

export default function MenuQrSizeCard({ saved, busy, save }: {
  saved: number;
  busy: boolean;
  save: (size: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? saved;
  const submit = async () => {
    if (await save(value)) setDraft((current) => current === value ? null : current);
  };

  return (
    <form className="mt-4 space-y-3 rounded-lg border border-white/20 p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label htmlFor="menu-qr-size" className="block text-sm">Menu QR code size</label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400">Smaller</span>
        <input id="menu-qr-size" type="range" min={QR_SIZE_MIN} max={QR_SIZE_MAX} step={10} value={value} disabled={busy} onChange={(event) => setDraft(Number(event.target.value))} className="min-w-0 flex-1 accent-amber-300" />
        <span className="text-xs text-neutral-400">Larger</span>
        <output htmlFor="menu-qr-size" className="w-12 text-right text-sm tabular-nums">{value}%</output>
      </div>
      <p className="text-xs text-neutral-400">Changes the QR on both the drink menu and custom menu. 100% is the usual size. This is shared with the other live-screen QR codes.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || value === saved} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save QR size</button>
        <button type="button" disabled={busy || value === 100} onClick={() => setDraft(100)} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Usual size (100%)</button>
      </div>
    </form>
  );
}
