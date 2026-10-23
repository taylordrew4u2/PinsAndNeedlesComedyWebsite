"use client";

import { useState } from "react";
import { DEFAULT_SPOOK_SOUND, QUESTION_SOUNDS, soundFile } from "@/lib/question-sounds";
import { chosenSting, soundUrl, stingName, type ScreenSettings } from "@/lib/screen-settings";
import { PreviewButton, type SoundPreview } from "./SoundPreview";

type Props = {
  /** Spook mode's sound as it stands in the card, saved or not. */
  spookSting: ScreenSettings["spookSting"];
  /** The usual sound as it stands in the card: what "Keep my usual sound" keeps. */
  usual: Pick<ScreenSettings, "sting" | "stingUrl">;
  /** The card's one volume, shared with the usual sound: ▶ plays at it. */
  volume: number;
  /** What is saved now: what 🔊 Test sound plays on the TV until the host saves. */
  saved: Pick<ScreenSettings, "spook" | "spookSting" | "sting" | "stingUrl">;
  /** The card's ▶ previews, shared with the usual list so two never play at once. */
  preview: SoundPreview;
  edit: (change: Partial<ScreenSettings>) => void;
};

const SPOOKY = QUESTION_SOUNDS.filter((entry) => entry.group === "Spooky");
/** Its own keys for the shared ▶, so a sound also in the usual list shows ■ only here. */
const KEY = "spook:";

/**
 * Spook mode's question sound: one of the Spooky recordings, or the host's
 * usual sound kept as it is. It plays only while spook mode is on, and the
 * usual choice stays untouched underneath, so it is back the moment spook
 * mode goes off. ▶ plays a sound here only, at the card's volume; the TV
 * only changes on Save.
 */
export default function SpookSoundPicker({ spookSting, usual, volume, saved, preview, edit }: Props) {
  const [problem, setProblem] = useState("");
  // Just the usual choice: a whole settings object here would name spook mode's sound instead.
  const usualChoice = { sting: usual.sting, stingUrl: usual.stingUrl };
  const usualSting = chosenSting(usualChoice);
  const usualEntry = QUESTION_SOUNDS.find((entry) => entry.id === usualSting);
  const usualName = stingName(usualChoice);
  const unsaved = spookSting !== saved.spookSting;

  const play = async (key: string, address: string, own: boolean) => {
    if (preview.playing !== key) setProblem("");
    const result = await preview.press(key, address, volume);
    if (result === "unsupported") setProblem("This browser can't play sound.");
    if (result === "failed") setProblem(own ? "Couldn't play your sound in this browser. Press 🔊 Test sound after saving to check the TV, or try an MP3." : "Couldn't play that here. Check this device's connection, then try again.");
  };

  const row = ({ choice, emoji, label, blurb, address, sound, own = false }: { choice: ScreenSettings["spookSting"]; emoji: string; label: string; blurb: string; address: string; sound: string; own?: boolean }) => {
    const key = KEY + choice;
    return (
      <li key={choice} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${spookSting === choice ? "border-amber-300/80 bg-amber-300/10" : "border-white/15"}`}>
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
          <input type="radio" name="spook-sound" className="mt-1 h-4 w-4 shrink-0 accent-amber-300" checked={spookSting === choice} onChange={() => edit({ spookSting: choice })} />
          <span aria-hidden="true" className="mt-0.5 shrink-0">{emoji}</span>
          <span className="min-w-0">
            <span className="block text-sm leading-snug">{label}</span>
            <span className="block break-words text-xs leading-snug text-neutral-500">{blurb}</span>
          </span>
        </label>
        <PreviewButton playing={preview.playing === key} label={sound} onPress={() => void play(key, address, own)} />
      </li>
    );
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm">Spooky question sound</legend>
      <p className="text-xs text-neutral-500">Plays instead of your usual sound while spook mode is on: with every new question, in the Intro and on 🔊 Test sound. ▶ plays it here, on this device only, at the volume set under Question sound, below.</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {SPOOKY.map((entry) => row({
          choice: entry.id,
          emoji: entry.emoji,
          label: entry.id === DEFAULT_SPOOK_SOUND ? `${entry.label} (the default)` : entry.label,
          blurb: entry.blurb,
          address: soundFile(entry.id),
          sound: entry.label,
        }))}
        {row({
          choice: "usual",
          emoji: usualSting === "custom" ? "📁" : usualEntry?.emoji ?? "🔊",
          label: `Keep my usual sound (${usualName})`,
          blurb: "Spook mode changes the look and the words, not the sound.",
          address: soundUrl(usualChoice),
          sound: usualName,
          own: usualSting === "custom",
        })}
      </ul>
      {problem ? <p role="alert" className="text-xs text-red-300">{problem}</p> : null}
      {unsaved ? (
        <p className="text-xs text-amber-200">
          {saved.spook ? `Not saved yet: 🔊 Test sound still plays ${stingName(saved)} on the TV until you press Save.` : "Not saved yet: press Save to keep it for spook mode."}
        </p>
      ) : saved.spook ? (
        <p className="text-xs text-neutral-500">🔊 Test sound, at the top, plays this one on the TV while spook mode is on.</p>
      ) : null}
    </fieldset>
  );
}
