"use client";

import { useEffect, useRef, useState } from "react";
import { MENU_FONT_FAMILY } from "@/components/menu-font-faces";
import {
  DEFAULT_MARQUEE, MARQUEE_MAX, MARQUEE_SPEEDS, MENU_COLORS, marqueeChange, marqueeSpeedOf,
  type MarqueeChange, type MarqueeSettings, type MarqueeStyle,
} from "@/lib/drink-menu";
import { DEFAULT_MENU_FONT } from "@/lib/menu-fonts";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { openCard } from "./open-card";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

/** The board's marquee type is 28px; the sample is set at half that, so it crawls at half the speed to look the same. */
const SAMPLE_SCALE = 0.5;

/** Taller on a phone, so every tap here is an easy 44px; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/** The show-night marquee as it always ran: the default text, on, at Normal speed, in the menu's text colour. */
const SHOW_DEFAULTS: MarqueeStyle & { text: string } = { text: "", on: true, speed: "", color: "" };

type Props = MarqueeStyle & {
  /** The show-night marquee's text as saved; "" runs the default. */
  text: string;
  /** The daytime menu's own marquee text as saved ("" for none). Only told here, so the card can say what it is; its box is in the custom menu card. */
  custom?: string;
  /** A drink menu is on the live screen now, so a save shows at once. */
  live: boolean;
  busy: boolean;
  /** Only what changed: the text, how it runs, or both. True once all of it is saved. */
  save: (change: MarqueeChange) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

function speedLabel(id: string): string {
  return MARQUEE_SPEEDS.find((speed) => speed.id === id)?.label ?? "Normal";
}

/**
 * The show-night marquee that runs around the standard drink menu: its text,
 * and, for both menus, on or off (off, the band goes and the menu fills the
 * screen), how fast, and in what colour. The daytime custom menu's own text
 * is in its card, so this card never sends it. One Save covers all of it,
 * and nothing reaches the screen until then, so a stray tap mid-show changes
 * nothing.
 */
export default function MarqueeCard({ live, busy, save, onPhase, custom = "", ...shown }: Props) {
  // The daytime text rides along unchanged on both sides, so marqueeChange never sends it from here.
  const saved: MarqueeSettings = { ...shown, custom };
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<MarqueeStyle & { text: string }>>({});
  // The sample only crawls while the card is open.
  const [open, setOpen] = useState(false);
  const { memo, fresh, track } = useSaveTracker();
  const edit = (change: Partial<MarqueeStyle & { text: string }>) => setDraft((current) => ({ ...current, ...change }));
  const value: MarqueeSettings = { ...saved, ...draft };
  const pending = marqueeChange(saved, value);
  const dirty = Object.keys(pending).length > 0;
  const defaults: MarqueeSettings = { ...SHOW_DEFAULTS, custom };
  // Already the defaults as saved: "Use defaults" only throws away the typing.
  const atDefaults = !Object.keys(marqueeChange(saved, defaults)).length;

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async (next: MarqueeSettings) => {
    const change = marqueeChange(saved, next);
    if (!Object.keys(change).length) {
      setDraft({});
      return;
    }
    // Only what was sent is cleared: anything typed while it saves stays, ready for the next Save.
    const sent = draft;
    if (await track(() => save(change))) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof typeof sent] !== entry)));
    }
  };

  const chip = (picked: boolean) => `${TAP} rounded-md border px-3 py-1.5 text-sm ${picked ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`;
  const words = `“${saved.text || DEFAULT_MARQUEE}”${saved.text ? "" : " (the default)"}`;

  return (
    <details id="marquee-card" className="mt-4 rounded-lg border border-amber-300/40 p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="-my-3 cursor-pointer py-3 text-sm sm:my-0 sm:py-0">
        🎞️ Marquee (show night){saved.on ? null : <span className="ml-2 text-xs text-amber-200">(off now)</span>}
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </summary>
      <form className="mt-3" onSubmit={(event) => { event.preventDefault(); void submit(value); }}>
        <p className="text-sm text-neutral-400">Runs around the edge of the screen while the standard (show-night) drink menu is up. Nothing changes on screen until you press Save.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-white/15 px-3 py-2">
          <p className="min-w-0 flex-1 basis-56 text-xs text-neutral-400">
            The 🌞 daytime menu has its own marquee box{custom ? ` (now “${custom}”)` : " (none until you write one)"}. On, off, speed and colour here go for both.
          </p>
          <button type="button" onClick={() => openCard("custom-menu-card", "#custom-menu-marquee")} className={`${TAP} rounded-md border border-white/20 px-3 py-1 text-xs text-neutral-200`}>
            Daytime marquee
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {saved.on
            ? `${live ? "Running now" : "Saved"}: ${words}, ${speedLabel(saved.speed).toLowerCase()}, ${saved.color ? `in ${saved.color}` : "in the menu's text colour"}.`
            : `Switched off, so the menu fills the screen. Its text, ${words}, is kept for when it comes back on.`}
        </p>

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <label htmlFor="menu-marquee" className="text-xs text-neutral-400">Text on the show-night menu</label>
          <span id="menu-marquee-count" className="shrink-0 text-xs tabular-nums text-neutral-500">{value.text.length}/{MARQUEE_MAX}</span>
        </div>
        <input
          id="menu-marquee"
          type="text"
          value={value.text}
          onChange={(event) => edit({ text: event.target.value })}
          maxLength={MARQUEE_MAX}
          placeholder={DEFAULT_MARQUEE}
          aria-describedby="menu-marquee-count menu-marquee-hint"
          className={`${TAP} mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base text-white placeholder:text-neutral-500 sm:text-sm`}
        />
        <p id="menu-marquee-hint" className="mt-1 text-xs text-neutral-500">Shows in capitals. {value.text.trim() ? "" : `Empty runs the default, “${DEFAULT_MARQUEE}”.`}</p>

        <p className="mt-3 text-xs text-neutral-400">On both menus</p>
        <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Marquee on or off">
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
        <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label="Marquee colour">
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
                className={`h-11 w-11 rounded-full border sm:h-7 sm:w-7 ${picked ? "border-white ring-2 ring-white ring-offset-2 ring-offset-neutral-950" : "border-white/30"}`}
                style={{ background: swatch }}
              />
            );
          })}
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input type="color" aria-label="Marquee colour: any colour" value={(value.color || "#FFFFFF").toLowerCase()} onChange={(event) => edit({ color: event.target.value.toUpperCase() })} className="h-11 w-12 cursor-pointer rounded border border-white/30 bg-black sm:h-7 sm:w-9" />
            {value.color ? <span className="font-mono">{value.color.toUpperCase()}</span> : null}
          </label>
        </div>

        <SampleBand text={value.text.trim() || DEFAULT_MARQUEE} color={value.color || "#FFFFFF"} speed={marqueeSpeedOf(value.speed)} on={value.on} running={open} />
        <p className="mt-1 text-xs text-neutral-500">
          {!value.on ? "Off: no band, and both drink menus fill the screen." : value.color ? "A sample of your text at the speed you picked." : "A sample of your text at the speed you picked. Shown in white here; on the custom menu it follows the menu’s colour."}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} />
          {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
          <button
            type="button"
            onClick={() => void submit(defaults)}
            disabled={busy || (atDefaults && !Object.keys(draft).length)}
            title={`The text “${DEFAULT_MARQUEE}”, on, at Normal speed, in the menu's text colour. The daytime menu's own text stays.`}
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
            <span className="text-[#FF2E4D]">{" ✦ "}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
