"use client";

import { useEffect, useRef, useState } from "react";
import { MENU_FONT_FAMILY } from "@/components/menu-font-faces";
import { DEFAULT_MARQUEE, MARQUEE_SPEEDS, MENU_COLORS, marqueeSpeedOf } from "@/lib/drink-menu";
import { DEFAULT_MENU_FONT } from "@/lib/menu-fonts";

/** What the card saves: the marquee on or off, its speed ("" for Normal) and its colour ("" for the menu's text colour). */
export type MarqueeStyleInput = { on: boolean; speed: string; color: string };

const DEFAULTS: MarqueeStyleInput = { on: true, speed: "", color: "" };

/** The board's marquee type is 28px; the sample is set at half that, so it crawls at half the speed to look the same. */
const SAMPLE_SCALE = 0.5;

type Props = MarqueeStyleInput & {
  /** The saved marquee text, for the sample. */
  text: string;
  busy: boolean;
  save: (style: MarqueeStyleInput) => Promise<boolean>;
};

function speedLabel(id: string): string {
  return MARQUEE_SPEEDS.find((speed) => speed.id === id)?.label ?? "Normal";
}

/**
 * How the marquee runs, beside its text: on or off (off, the band goes and
 * the menu fills the screen), how fast, and in what colour. Nothing reaches
 * the screen until Save, so a stray tap mid-show changes nothing.
 */
export default function MarqueeCard({ text, busy, save, ...saved }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<MarqueeStyleInput>>({});
  // The sample only crawls while the card is open.
  const [open, setOpen] = useState(false);
  const edit = (change: Partial<MarqueeStyleInput>) => setDraft((current) => ({ ...current, ...change }));
  const value = { ...saved, ...draft };
  const changed = value.on !== saved.on || value.speed !== saved.speed || value.color.toUpperCase() !== saved.color.toUpperCase();
  const atDefaults = saved.on === DEFAULTS.on && saved.speed === DEFAULTS.speed && saved.color === DEFAULTS.color;

  const submit = async (style: MarqueeStyleInput) => {
    if (await save(style)) setDraft({});
  };

  const chip = (picked: boolean) => `rounded-md border px-3 py-1.5 text-sm ${picked ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`;

  return (
    <details className="mt-4 rounded-md border border-white/15 p-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm">
        🎞️ Marquee on or off, speed and colour{saved.on ? "" : <span className="ml-2 text-xs text-amber-200">(off now)</span>}
      </summary>
      <p className="mt-2 text-xs text-neutral-500">
        Now: {saved.on ? `on, ${speedLabel(saved.speed).toLowerCase()}, ${saved.color ? `in ${saved.color}` : "in the menu's text colour"}` : "off, so the menu fills the screen"}.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Marquee on or off">
        <button type="button" aria-pressed={value.on} onClick={() => edit({ on: true })} className={chip(value.on)}>On</button>
        <button type="button" aria-pressed={!value.on} onClick={() => edit({ on: false })} className={chip(!value.on)}>Off (menu fills the screen)</button>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Speed</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Marquee speed">
        {MARQUEE_SPEEDS.map((speed) => (
          <button key={speed.id || "normal"} type="button" aria-pressed={value.speed === speed.id} onClick={() => edit({ speed: speed.id })} className={chip(value.speed === speed.id)}>
            {speed.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-400">Colour</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!value.color} onClick={() => edit({ color: "" })} className={chip(!value.color)}>Same as the menu text</button>
        {MENU_COLORS.map((swatch) => {
          const picked = value.color.toUpperCase() === swatch;
          return (
            <button
              key={swatch}
              type="button"
              aria-label={`Marquee colour: ${swatch}`}
              aria-pressed={picked}
              onClick={() => edit({ color: swatch })}
              className={`h-7 w-7 rounded-full border ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
              style={{ background: swatch }}
            />
          );
        })}
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="color" aria-label="Marquee colour: any colour" value={(value.color || "#FFFFFF").toLowerCase()} onChange={(event) => edit({ color: event.target.value.toUpperCase() })} className="h-7 w-9 cursor-pointer rounded border border-white/30 bg-black" />
          {value.color ? <span className="font-mono">{value.color.toUpperCase()}</span> : null}
        </label>
      </div>

      <SampleBand text={text || DEFAULT_MARQUEE} color={value.color || "#FFFFFF"} speed={marqueeSpeedOf(value.speed)} on={value.on} running={open} />
      <p className="mt-1 text-xs text-neutral-500">
        {!value.on ? "Off: no band, and the drink menu fills the screen." : value.color ? "A sample at the speed you picked." : "A sample at the speed you picked. Shown in white here; on the custom menu it follows the menu’s colour."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void submit(value)} disabled={busy || !changed} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
        {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
        <button type="button" onClick={() => void submit(DEFAULTS)} disabled={busy || (atDefaults && !Object.keys(draft).length)} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Use defaults</button>
      </div>
    </details>
  );
}

/**
 * A strip of the marquee as the board sets it (capitals, red stars between),
 * crawling at the picked speed, so "Slow" and "Fast" can be seen rather than
 * guessed. Still while the card is closed, while it is off, and under reduced motion.
 */
function SampleBand({ text, color, speed, on, running }: { text: string; color: string; speed: number; on: boolean; running: boolean }) {
  const strip = useRef<HTMLDivElement>(null);
  const pace = useRef(speed);
  useEffect(() => { pace.current = speed; }, [speed]);

  useEffect(() => {
    const node = strip.current;
    if (!node || !on || !running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let travelled = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // The strip is the text over and over: one copy along, it looks just as it started.
      const loop = (node.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
      travelled = loop ? (travelled + (Math.max(0, now - last) / 1000) * pace.current * SAMPLE_SCALE) % loop : 0;
      last = now;
      node.style.transform = `translateX(${-travelled}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); node.style.transform = ""; };
  }, [on, running]);

  const words = text.toUpperCase();
  return (
    <div className="mt-3 overflow-hidden rounded bg-black py-2" aria-hidden="true" style={{ opacity: on ? 1 : 0.35 }}>
      {/* Enough copies to run past the edge even for a word or two. */}
      <div ref={strip} className="flex w-max whitespace-pre font-bold" style={{ fontFamily: MENU_FONT_FAMILY[DEFAULT_MENU_FONT], fontSize: 28 * SAMPLE_SCALE, letterSpacing: "0.12em" }}>
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className="shrink-0">
            <span style={{ color }}>{words}</span>
            <span className="text-[#FF2E4D]">{" ✦ "}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
