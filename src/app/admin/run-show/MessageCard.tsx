"use client";

import { useRef, useState } from "react";
import ScreenMessage from "@/components/ScreenMessage";
import {
  DEFAULT_MESSAGE_COLOR, MESSAGE_COLORS, MESSAGE_MAX, MESSAGE_PRESETS, cleanMessageColor, cleanMessageText,
  type MessageChange, type ScreenMessage as Message,
} from "@/lib/screen-message";

type Props = {
  /** The saved message: its words and colour ("" for white), and whether it is up. */
  message: Message;
  /** The drink menu is up: it covers the message, and putting the message up takes it down. */
  menu: boolean;
  busy: boolean;
  send: (change: MessageChange) => Promise<boolean>;
};

/**
 * A message of the host's own on the projector, big and centred in a colour
 * they pick: a short break, last call, a plug. One tap on a quick message
 * fills the box; nothing reaches the screen until "Put on screen", and the
 * preview shows how it will look first.
 */
export default function MessageCard({ message, menu, busy, send }: Props) {
  // What the host is typing and picking; null until they do, so the saved message shows.
  const [text, setText] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const words = text ?? message.text;
  const pick = color ?? (message.color || DEFAULT_MESSAGE_COLOR);
  const cleaned = cleanMessageText(words);
  const live = message.on && !menu;
  const edited = (text !== null && cleaned !== message.text) || (color !== null && cleanMessageColor(color) !== message.color);

  const putUp = async () => {
    if (await send({ on: true, text: words, color: pick })) {
      setText(null);
      setColor(null);
    }
  };

  /** A quick message fills the box, ready to change before it goes up; "Up next" waits for a name. */
  const fill = (preset: string) => {
    setText(preset);
    const field = box.current;
    if (!field) return;
    field.focus();
    requestAnimationFrame(() => field.setSelectionRange(preset.length, preset.length));
  };

  return (
    <details className="mt-4 rounded-lg border border-sky-300/50 p-4">
      <summary className="cursor-pointer text-sm">
        💬 Message on screen
        {live ? <span className="ml-2 rounded-full bg-sky-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">Up now</span> : null}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-neutral-400">Your own words, big on the projector, over the question or the set until you take them down. Showing a question, a drink menu or starting a set takes the message down too.</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick messages">
          {MESSAGE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => fill(preset.text)} className="rounded-full border border-white/25 px-3 py-1 text-xs text-neutral-200 hover:border-white/60">
              {preset.label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="screen-message" className="sr-only">Message</label>
          <textarea
            id="screen-message"
            ref={box}
            value={words}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            maxLength={MESSAGE_MAX}
            placeholder="e.g. Short break — back in 10"
            className="w-full rounded-md border border-white/30 bg-black px-3 py-2 text-white placeholder:text-neutral-500"
          />
          <p className="text-right text-xs text-neutral-500" aria-live="polite">{words.length}/{MESSAGE_MAX}</p>
        </div>
        <ColorPicker value={pick} onPick={setColor} />
        <div className="aspect-video w-full max-w-sm overflow-hidden rounded-md border border-white/15 bg-black px-[5%] py-[6%]" aria-label="Preview of the message">
          {cleaned ? <ScreenMessage text={cleaned} color={pick} /> : <p className="flex h-full items-center justify-center text-xs text-neutral-600">Preview</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void putUp()}
            disabled={busy || !cleaned || (live && !edited)}
            className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {live ? "Update the screen" : "Put on screen"}
          </button>
          {message.on ? (
            <button type="button" onClick={() => void send({ on: false })} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">
              Take it down
            </button>
          ) : null}
          {edited ? <button type="button" onClick={() => { setText(null); setColor(null); }} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
        </div>
        <p className="text-xs text-neutral-500">{live ? "On screen now." : message.on ? "Under the drink menu: it comes down when the menu goes up." : "Not on screen."}</p>
      </div>
    </details>
  );
}

/** Quick colour swatches plus a picker for any colour. */
function ColorPicker({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-400">Colour</span>
      {MESSAGE_COLORS.map((swatch) => {
        const picked = value.toUpperCase() === swatch;
        return (
          <button
            key={swatch}
            type="button"
            aria-label={`Message colour: ${swatch}`}
            aria-pressed={picked}
            onClick={() => onPick(swatch)}
            className={`h-7 w-7 rounded-full border ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
            style={{ background: swatch }}
          />
        );
      })}
      <label className="flex items-center gap-1.5 text-xs text-neutral-400">
        <input type="color" aria-label="Message colour: any colour" value={value.toLowerCase()} onChange={(event) => onPick(event.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer rounded border border-white/30 bg-black" />
        <span className="font-mono">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}
