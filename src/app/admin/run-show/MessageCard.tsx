"use client";

import { useEffect, useRef, useState } from "react";
import ScreenMessage from "@/components/ScreenMessage";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { SaveBadge, useSaveTracker } from "./SaveBadge";
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
  /** Hears where the card's saving stands, for the sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

/** 44px tall on a phone, its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/**
 * A message of the host's own on the projector, big and centred in a colour
 * they pick: a short break, last call, a plug. One tap on a quick message
 * fills the box; nothing reaches the screen until "Put on screen", and the
 * preview shows how it will look first.
 */
export default function MessageCard({ message, menu, busy, send, onPhase }: Props) {
  // What the host is typing and picking; null until they do, so the saved message shows.
  const [text, setText] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const words = text ?? message.text;
  const pick = color ?? (message.color || DEFAULT_MESSAGE_COLOR);
  const cleaned = cleanMessageText(words);
  const live = message.on && !menu;
  const edited = (text !== null && cleaned !== message.text) || (color !== null && cleanMessageColor(color) !== message.color);
  const { memo, fresh, track } = useSaveTracker();

  // Where the card stands, told to the page only when it changes. Typed but not put up counts as not saved:
  // a reload would lose it.
  const phase = savePhase(edited, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const putUp = async () => {
    // Only what went up is cleared: anything typed while it saves stays in the box.
    const sentText = text;
    const sentColor = color;
    if (await track(() => send({ on: true, text: words, color: pick }))) {
      setText((current) => (current === sentText ? null : current));
      setColor((current) => (current === sentColor ? null : current));
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
    <details id="message-card" className="mt-4 rounded-lg border border-sky-300/50 p-4">
      <summary className="cursor-pointer text-sm">
        💬 Message on screen
        {live ? <span className="ml-2 rounded-full bg-sky-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">Up now</span> : null}
        {/* Nothing to say while no message is up and nothing is typed; up, it says whether the screen has the latest words. */}
        <SaveBadge
          dirty={edited}
          memo={memo}
          fresh={fresh}
          hidden={!message.on && !edited && phase === "saved"}
          words={{ saved: "✓ On screen", fresh: "✓ On screen now", unsaved: "● Not on screen yet", failed: "✕ Didn't reach the screen" }}
        />
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-neutral-400">Your own words, big on the projector, over the question or the set until you take them down. Showing a question, a drink menu or starting a set takes the message down too.</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick messages">
          {MESSAGE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => fill(preset.text)} className={`${TAP} rounded-full border border-white/25 px-3 py-1 text-xs text-neutral-200 hover:border-white/60`}>
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
            disabled={busy || !cleaned || (live && !edited) || phase === "saving"}
            className={`${TAP} rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50`}
          >
            {phase === "saving" ? "Saving…" : phase === "failed" ? "Try again" : live ? "Update the screen" : "Put on screen"}
          </button>
          {message.on ? (
            <button type="button" onClick={() => void track(() => send({ on: false }))} disabled={busy} className={`${TAP} rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40`}>
              Take it down
            </button>
          ) : null}
          {edited ? <button type="button" onClick={() => { setText(null); setColor(null); }} disabled={busy} className={`${TAP} rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40`}>Undo changes</button> : null}
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
            className={`h-11 w-11 rounded-full border sm:h-7 sm:w-7 ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
            style={{ background: swatch }}
          />
        );
      })}
      <label className="flex items-center gap-1.5 text-xs text-neutral-400">
        <input type="color" aria-label="Message colour: any colour" value={value.toLowerCase()} onChange={(event) => onPick(event.target.value.toUpperCase())} className="h-11 w-12 cursor-pointer rounded border border-white/30 bg-black sm:h-7 sm:w-9" />
        <span className="font-mono">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}
