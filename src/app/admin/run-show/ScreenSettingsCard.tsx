"use client";

import { useState, type ReactNode } from "react";
import {
  COUNTDOWN_MAX, COUNTDOWN_MIN, DEFAULT_SCREEN, SCREEN_TEXT, changedScreen, parseScreenSettings, screenFallback, stingName, withoutSpook,
  type ScreenSettings, type ScreenSwitch, type ScreenText,
} from "@/lib/screen-settings";
import QuestionSoundPicker from "./QuestionSoundPicker";
import SpookSoundPicker from "./SpookSoundPicker";
import { useSoundPreview } from "./SoundPreview";

type Props = {
  /** What is saved now; "" words are the defaults. */
  saved: ScreenSettings;
  busy: boolean;
  /** Everything but `spook`: only the 🦇 Spook mode button above the live screen switches that, so whole settings (with it) don't type-check here. */
  save: (settings: Omit<ScreenSettings, "spook"> & { spook?: never }) => Promise<boolean>;
};

const COUNT_FROM = Array.from({ length: COUNTDOWN_MAX - COUNTDOWN_MIN + 1 }, (_, index) => COUNTDOWN_MIN + index);

/**
 * How the live screen behaves and what its fixed words say: spook mode's
 * sound, the countdown and drum roll before a new question, the sound
 * (which one, how loud), the set timer, names under questions, the line
 * above a performer's name, and the Intro explainer's wording. Nothing
 * reaches the projector until Save (a sound's ▶ only plays it here, for the
 * host), and every box is capped so the words always fit the screen. Spook
 * mode itself is switched only by its 🦇 button, at once; this card says
 * whether it is on and never sends it. The switches a host reaches for
 * mid-show come next, right above Save; the Intro's wording is folded away
 * under them.
 */
export default function ScreenSettingsCard({ saved, busy, save }: Props) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<ScreenSettings>>({});
  // One ▶ player for the whole card, so the usual and the spooky lists never play over each other.
  const preview = useSoundPreview();
  const edit = (change: Partial<ScreenSettings>) => setDraft((current) => ({ ...current, ...change }));
  const value = { ...saved, ...draft };
  // Cleaned the way the server cleans it, so "changed" means something would really change.
  const next = parseScreenSettings(value);
  const changed = JSON.stringify(changedScreen(next)) !== JSON.stringify(changedScreen(saved));
  // Spook mode isn't this card's to change: on its own it isn't "customised", and leaves Use defaults nothing to do.
  const atDefaults = Object.keys(changedScreen(saved)).every((key) => key === "spook");

  const submit = async (settings: ScreenSettings) => {
    // Only what was sent is cleared: anything changed while it saves stays, ready for the next Save.
    const sent = draft;
    if (await save(withoutSpook(settings))) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof ScreenSettings] !== entry)));
    }
  };

  const backToDefaults = () => {
    // Spook mode's sound goes back too, so it is named when it will change; spook mode itself stays, and says so while it is on.
    const spooky = saved.spookSting !== DEFAULT_SCREEN.spookSting ? ` (${stingName({ ...DEFAULT_SCREEN, spook: true })} in spook mode)` : "";
    const spook = saved.spook ? " Spook mode stays as it is; use the 🦇 Spook mode button to turn it off." : "";
    if (!window.confirm(`Put the live screen back to its defaults? Sound, names under questions, the countdown (from 3), drum roll and set timer all go back on, the question sound goes back to ${stingName(DEFAULT_SCREEN)} at 100%${spooky}, and your wording for the Intro, under the dice and above a performer's name is cleared.${spook}`)) return;
    void submit(DEFAULT_SCREEN);
  };

  const toggle = (key: ScreenSwitch, label: string, extra?: ReactNode) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-amber-300" checked={value[key]} onChange={(event) => edit({ [key]: event.target.checked })} />
        {label}
      </label>
      {extra}
    </div>
  );

  // A saved default shows its words in the box, ready to edit; clearing the box goes back to the default.
  // In spook mode that is the spooky line, since that is what the screen shows for a box left as it was.
  const words = (key: ScreenText, label: string, hint?: string) => {
    const fallback = screenFallback(key, saved.spook);
    // The other mode's default typed in: it counts as left as it was, so Save has nothing to keep. Said here, so it isn't a mystery.
    const otherDefault = draft[key]?.replace(/\s+/g, " ").trim() === screenFallback(key, !saved.spook);
    return (
      <div>
        <label htmlFor={`screen-${key}`} className="block text-xs text-neutral-400">{label}</label>
        <input
          id={`screen-${key}`}
          type="text"
          value={value[key] || (draft[key] === undefined ? fallback : "")}
          onChange={(event) => edit({ [key]: event.target.value })}
          maxLength={SCREEN_TEXT[key].max}
          placeholder={fallback}
          className="mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        />
        {otherDefault ? (
          <p className="mt-1 text-xs text-amber-200">
            That&rsquo;s the {saved.spook ? "usual" : "spooky"} default, so it follows spook mode and can&rsquo;t be saved as your own. Change a word, or a letter&rsquo;s case, to keep it.
          </p>
        ) : null}
        {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
      </div>
    );
  };

  return (
    <details className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="cursor-pointer text-sm">
        📺 Live screen settings{atDefaults ? "" : " (customised)"}
        {changed ? <span className="ml-2 rounded bg-amber-300/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">unsaved</span> : null}
      </summary>
      <form className="mt-3 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(next); }}>
        <p className="text-sm text-neutral-400">How the projector behaves and what it says. Saved changes reach it within a couple of seconds; nothing changes until you press Save.</p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Spook mode</legend>
          <p className="text-sm">
            {saved.spook ? "Spook mode is on." : "Spook mode is off."}{" "}
            <span className="text-neutral-400">Switch it with the 🦇 Spook mode button above the live screen; it changes at once, no Save.</span>
          </p>
          <SpookSoundPicker spookSting={value.spookSting} usual={value} volume={value.stingVolume} saved={saved} preview={preview} edit={edit} />
          <p className="text-xs text-neutral-500">Your own words always win. Boxes left as they were, or set to either default line, use the spooky lines while spook mode is on.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">When a new question goes up</legend>
          {toggle("countdown", "Count down first", (
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              from
              <select
                value={value.countdownFrom}
                onChange={(event) => edit({ countdownFrom: Number(event.target.value) })}
                disabled={!value.countdown}
                className="rounded-md border border-white/30 bg-black px-2 py-1 text-sm text-white disabled:opacity-40"
              >
                {COUNT_FROM.map((number) => <option key={number} value={number}>{number}</option>)}
              </select>
            </label>
          ))}
          {toggle("intro", "Drum roll with the dice")}
          {value.intro ? words("introWord", "Word under the dice") : null}
          {toggle("names", "Show the sender’s name under it")}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Question sound</legend>
          {toggle("sound", "Play the sound on the projector")}
          {value.sound ? null : <p className="text-xs text-amber-200">Muted: no sound with new questions, the Intro or Test sound.</p>}
          <QuestionSoundPicker sting={value.sting} volume={value.stingVolume} url={value.stingUrl} saved={saved} preview={preview} edit={edit} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-neutral-400">Sets</legend>
          {toggle("timer", "Show the set timer at the bottom")}
          {words("stageLabel", "Above a performer’s name when their set starts")}
        </fieldset>

        {/* Folded, so muting or hiding names mid-show doesn't mean scrolling past eight boxes to Save. Still mounted, so typing survives. */}
        <details className="rounded-md border border-white/15 p-3">
          <summary className="cursor-pointer text-sm">Intro wording</summary>
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Intro wording</legend>
            <p className="text-xs text-neutral-500">What the Intro button puts on screen. It runs for the same time whatever it says.</p>
            {words("howHeading", "Heading")}
            {words("howStep1", "Step 1")}
            {words("howStep2", "Step 2")}
            {words("howStep3", "Step 3")}
            {words("listenLine", "Just before the sound")}
            {words("exampleQuestion", "Example question")}
            {words("closingLine", "After the example", "“Bad decision” shows in red wherever you put it.")}
            {words("closingCall", "Last line, beside the QR code")}
          </fieldset>
        </details>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !changed} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
          {Object.keys(draft).length ? <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button> : null}
          <button
            type="button"
            onClick={backToDefaults}
            disabled={busy || (atDefaults && !Object.keys(draft).length)}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
        </div>
      </form>
    </details>
  );
}
