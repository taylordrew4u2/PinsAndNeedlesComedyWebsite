"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { BEHAVIOUR_KEYS, COUNTDOWN_MAX, COUNTDOWN_MIN, DEFAULT_SCREEN, screenChanges, stingName, type ScreenSettings, type ScreenSwitch } from "@/lib/screen-settings";
import { openCard } from "./open-card";
import QuestionSoundPicker from "./QuestionSoundPicker";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

type Props = {
  /** What is saved now. */
  saved: ScreenSettings;
  busy: boolean;
  /** Only the settings that changed. True once saved. */
  save: (change: Partial<ScreenSettings>) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
};

const COUNT_FROM = Array.from({ length: COUNTDOWN_MAX - COUNTDOWN_MIN + 1 }, (_, index) => COUNTDOWN_MIN + index);

/** Taller on a phone, so every switch and button is an easy 44px tap; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/**
 * How the live screen behaves: the countdown and drum roll before a new
 * question, names under questions, the question sound (which one, how
 * loud), and the set timer. Only these (BEHAVIOUR_KEYS): the words the
 * screen says are in "✏️ Words on the screen", and the QR in "🔳 QR code on
 * the show screens", each with its own Save, so a Save here never writes
 * over them. Nothing reaches the projector until Save (a sound's ▶ only
 * plays it here, for the host).
 */
export default function ScreenSettingsCard({ saved, busy, save, onPhase }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<ScreenSettings>>({});
  const { memo, fresh, track } = useSaveTracker();
  const edit = (change: Partial<ScreenSettings>) => setDraft((current) => ({ ...current, ...change }));
  const value = { ...saved, ...draft };
  // Cleaned the way the server cleans it, so "changed" means something would really change, and only that is sent.
  const pending = screenChanges(saved, value, BEHAVIOUR_KEYS);
  const dirty = Object.keys(pending).length > 0;
  const defaults = screenChanges(saved, DEFAULT_SCREEN, BEHAVIOUR_KEYS);

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async (change: Partial<ScreenSettings>) => {
    // Only what was sent is cleared: anything changed while it saves stays, ready for the next Save.
    const sent = draft;
    if (await track(() => save(change))) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof ScreenSettings] !== entry)));
    }
  };

  const backToDefaults = () => {
    if (!window.confirm(`Put the live screen's switches back to their defaults? Sound, names under questions, the countdown (from 3), drum roll and set timer all go back on, and the question sound goes back to ${stingName(DEFAULT_SCREEN)} at 100%. Your words and the QR stay as they are.`)) return;
    void submit(defaults);
  };

  const toggle = (key: ScreenSwitch, label: string, extra?: ReactNode) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className={`${TAP} flex cursor-pointer items-center gap-2 text-sm`}>
        <input type="checkbox" className="h-5 w-5 accent-amber-300 sm:h-4 sm:w-4" checked={value[key]} disabled={busy} onChange={(event) => edit({ [key]: event.target.checked })} />
        {label}
      </label>
      {extra}
    </div>
  );

  // Its own tap-sized button, not a link inside a sentence, so a phone gets a real target.
  const jump = (id: string, label: string) => (
    <button type="button" onClick={() => openCard(id)} className={`${TAP} rounded-md border border-white/20 px-3 py-1 text-xs text-neutral-200`}>{label}</button>
  );

  return (
    <details id="screen-settings-card" className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="cursor-pointer text-sm">
        📺 Live screen settings
        {Object.keys(defaults).length ? <span className="ml-1 text-xs text-neutral-400">(customised)</span> : null}
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </summary>
      <form className="mt-3 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(pending); }}>
        <p className="text-sm text-neutral-400">How the projector behaves. Saved changes reach it within a couple of seconds; nothing changes until you press Save.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">What the screen says, and its QR, have cards of their own:</span>
          {jump("screen-words-card", "✏️ Words on the screen")}
          {jump("show-qr-card", "🔳 QR code on the show screens")}
        </div>

        <fieldset className="space-y-1">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">When a new question goes up</legend>
          {toggle("countdown", "Count down first", (
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              from
              <select
                value={value.countdownFrom}
                onChange={(event) => edit({ countdownFrom: Number(event.target.value) })}
                disabled={busy || !value.countdown}
                className={`${TAP} rounded-md border border-white/30 bg-black px-2 py-1 text-sm text-white disabled:opacity-40`}
              >
                {COUNT_FROM.map((number) => <option key={number} value={number}>{number}</option>)}
              </select>
            </label>
          ))}
          {toggle("intro", "Drum roll with the dice")}
          {toggle("names", "Show the sender’s name under it")}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Question sound</legend>
          {toggle("sound", "Play the sound on the projector")}
          {value.sound ? null : <p className="text-xs text-amber-200">Muted: no sound with new questions, the Intro or Test sound.</p>}
          <QuestionSoundPicker sting={value.sting} volume={value.stingVolume} url={value.stingUrl} saved={saved} edit={edit} />
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Sets</legend>
          {toggle("timer", "Show the set timer at the bottom")}
        </fieldset>

        <div className="flex flex-wrap gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} />
          {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
          <button
            type="button"
            onClick={backToDefaults}
            disabled={busy || !Object.keys(defaults).length}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
        </div>
      </form>
    </details>
  );
}
