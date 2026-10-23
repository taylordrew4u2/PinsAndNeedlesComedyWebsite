"use client";

import { useRef, useState } from "react";
import { upload } from "../MediaField";
import { QUESTION_SOUNDS, SOUND_GROUPS } from "@/lib/question-sounds";
import { CUSTOM_STING_MAX_S } from "@/lib/custom-sting";
import { AUDIO_ACCEPT, AUDIO_MAX_BYTES, audioTypeOf, uploadedFileName } from "@/lib/audio-upload";
import { STING_VOLUME_MAX, STING_VOLUME_MIN, chosenSting, soundUrl, stingName, type QuestionSound, type ScreenSettings } from "@/lib/screen-settings";
import { PreviewButton, type SoundPreview } from "./SoundPreview";

type Props = {
  sting: QuestionSound;
  volume: number;
  url: string;
  /** What is saved now: what 🔊 Test sound plays on the TV until the host saves (spook mode's own sound while that is on). */
  saved: Pick<ScreenSettings, "sting" | "stingUrl" | "stingVolume"> & Partial<Pick<ScreenSettings, "spook" | "spookSting">>;
  /** The card's ▶ previews, shared with the spooky list so two never play at once. */
  preview: SoundPreview;
  edit: (change: Partial<ScreenSettings>) => void;
};

/**
 * The sound the projector plays with every new question, in the Intro and
 * on 🔊 Test sound: one of the built-in recordings or the host's own file,
 * and how loud. ▶ plays a sound here in the host's own browser, at the volume
 * set, so they can choose without the room hearing; the TV only changes on
 * Save. The list folds away under the current choice, so the switches and
 * Save stay in reach on a phone.
 */
export default function QuestionSoundPicker({ sting, volume, url, saved, preview, edit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState("");
  // How long the host's own file runs, once this browser has decoded it, to say when it will be faded.
  const [duration, setDuration] = useState<{ url: string; seconds: number } | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const play = async (id: QuestionSound) => {
    // ■ on the one playing only stops it; any other press starts afresh.
    if (preview.playing !== id) setProblem("");
    const address = soundUrl({ sting: id, stingUrl: url });
    // Every time, not only on a fresh load: after Replace and then Undo, the earlier file's length shows again.
    const heard = id === "custom" ? (buffer: AudioBuffer) => setDuration({ url: address, seconds: buffer.duration }) : undefined;
    const result = await preview.press(id, address, volume, heard);
    if (result === "unsupported") setProblem("This browser can't play sound.");
    if (result === "failed") setProblem(id === "custom" ? "Couldn't play your sound in this browser. Press 🔊 Test sound after saving to check the TV, or try an MP3." : "Couldn't play that here. Check this device's connection, then try again.");
  };

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setProblem("");
    if (!audioTypeOf(file.type, file.name)) {
      setProblem("That isn't a sound file this can use. Try an MP3, M4A, WAV or OGG.");
      return;
    }
    if (file.size > AUDIO_MAX_BYTES) {
      setProblem(`That file is ${(file.size / 1e6).toFixed(1)} MB. A sound can be up to ${AUDIO_MAX_BYTES / 1024 / 1024} MB: trim it, or save it as an MP3.`);
      return;
    }
    preview.stop();
    setUploading(true);
    try {
      const address = await upload(file, file.name);
      edit({ sting: "custom", stingUrl: address });
      // Decoded here too: ready to preview at once, and its length says whether it will be faded.
      try {
        const Offline = window.OfflineAudioContext;
        if (Offline) {
          const buffer = await new Offline(1, 1, 44_100).decodeAudioData(await file.arrayBuffer());
          preview.keep(address, buffer);
          setDuration({ url: address, seconds: buffer.duration });
        }
      } catch {
        setProblem("Uploaded, but this browser can't play that file. Save, then press 🔊 Test sound to check the TV can; if not, try an MP3.");
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const chosen = QUESTION_SOUNDS.find((entry) => entry.id === sting);
  const own = url ? uploadedFileName(url) : "";
  const ownSeconds = duration?.url === url ? duration.seconds : null;
  // The usual choice alone: spook mode's own sound is picked in its own list, so it never counts as a change here.
  const savedUsual = { sting: saved.sting, stingUrl: saved.stingUrl };
  // What the TV would play now against what it will play once saved: the sound, its file, its volume.
  const unsaved = chosenSting(savedUsual) !== chosenSting({ sting, stingUrl: url })
    || (sting === "custom" && saved.stingUrl !== url)
    || saved.stingVolume !== volume;
  // Spook mode is on with a sound of its own: the TV plays that one instead, until spook mode goes off.
  const spooked = chosenSting(saved) !== chosenSting(savedUsual);

  const playButton = (id: QuestionSound, label: string, disabled = false) => (
    <PreviewButton playing={preview.playing === id} label={label} disabled={disabled} onPress={() => void play(id)} />
  );

  const row = (id: QuestionSound, emoji: string, label: string, blurb: string) => (
    <li key={id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${sting === id ? "border-amber-300/80 bg-amber-300/10" : "border-white/15"}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
        <input type="radio" name="question-sound" className="mt-1 h-4 w-4 shrink-0 accent-amber-300" checked={sting === id} onChange={() => edit({ sting: id })} />
        <span aria-hidden="true" className="mt-0.5 shrink-0">{emoji}</span>
        <span className="min-w-0">
          <span className="block text-sm leading-snug">{label}</span>
          <span className="block text-xs leading-snug text-neutral-500">{blurb}</span>
        </span>
      </label>
      {playButton(id, label)}
    </li>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">Plays on the projector with every new question, in the Intro and on 🔊 Test sound. ▶ plays it here, on this device only.</p>

      <div className="flex items-center gap-2 rounded-md border border-white/15 px-2 py-1.5">
        <span aria-hidden="true">{sting === "custom" ? "📁" : chosen?.emoji}</span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {sting === "custom" ? (own ? `Your own: ${own}` : `Your own (nothing uploaded, so ${stingName({ sting, stingUrl: "" })} plays)`) : chosen?.label}
        </span>
        {playButton(sting, sting === "custom" ? "your own sound" : chosen?.label ?? "the sound", sting === "custom" && !url)}
      </div>

      <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>Volume</span>
        <input
          type="range"
          min={STING_VOLUME_MIN}
          max={STING_VOLUME_MAX}
          step={5}
          value={volume}
          onChange={(event) => edit({ stingVolume: Number(event.target.value) })}
          className="min-w-0 flex-1 accent-amber-300"
        />
        <span className="w-12 text-right tabular-nums text-neutral-300">{volume}%</span>
      </label>
      <p className="text-xs text-neutral-500">100% is the sound as recorded: every built-in one is about as loud as the others. ▶ uses this volume too.</p>

      <details className="rounded-md border border-white/15 p-2">
        <summary className="cursor-pointer text-sm">Choose another sound ({QUESTION_SOUNDS.length} to pick from, or your own)</summary>
        <p className="mt-2 text-xs text-neutral-500">All real recordings, all gentle: nothing here jumps out at the room.</p>
        {SOUND_GROUPS.map((group) => (
          <div key={group} className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{group}</p>
            {/* So picking one here isn't mistaken for switching spook mode on, or for choosing its sound. */}
            {group === "Spooky" ? <p className="mt-0.5 text-xs text-neutral-500">Yours to pick any night of the year. Spook mode&rsquo;s own sound is chosen under Spook mode, above.</p> : null}
            <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
              {QUESTION_SOUNDS.filter((entry) => entry.group === group).map((entry) => row(entry.id, entry.emoji, entry.label, entry.blurb))}
            </ul>
          </div>
        ))}
        <ul className="mt-2 grid gap-1.5">
          <li className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${sting === "custom" ? "border-amber-300/80 bg-amber-300/10" : "border-white/15"}`}>
            <label className={`flex min-w-0 flex-1 basis-48 items-start gap-2 ${url ? "cursor-pointer" : ""}`}>
              <input type="radio" name="question-sound" className="mt-1 h-4 w-4 shrink-0 accent-amber-300" checked={sting === "custom"} disabled={!url} onChange={() => edit({ sting: "custom" })} />
              <span aria-hidden="true" className="mt-0.5 shrink-0">📁</span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug">Your own sound</span>
                <span className="block break-words text-xs leading-snug text-neutral-500">
                  {own
                    ? `${own}${ownSeconds !== null ? ` · ${ownSeconds.toFixed(1)} s${ownSeconds > CUSTOM_STING_MAX_S ? `, fades out at ${CUSTOM_STING_MAX_S} s` : ""}` : ""}`
                    : `MP3, M4A, WAV, OGG or AAC, up to ${AUDIO_MAX_BYTES / 1024 / 1024} MB. Longer than ${CUSTOM_STING_MAX_S} s fades out.`}
                </span>
              </span>
            </label>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="rounded-md border border-white/30 px-2.5 py-1 text-sm disabled:opacity-40">
                {uploading ? "Uploading…" : own ? "Replace" : "Upload"}
              </button>
              {playButton("custom", "your own sound", !url)}
            </div>
            <input ref={input} type="file" accept={AUDIO_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Upload your own sound" onChange={(event) => void pick(event.target.files?.[0])} />
          </li>
        </ul>
      </details>

      {problem ? <p role="alert" className="text-xs text-red-300">{problem}</p> : null}
      {spooked ? (
        <p className="text-xs text-neutral-500">🦇 Spook mode is on, so 🔊 Test sound and new questions play {stingName(saved)} instead (chosen under Spook mode, above). This one comes back when spook mode goes off.</p>
      ) : null}
      {unsaved ? (
        <p className="text-xs text-amber-200">{spooked ? "Not saved yet: press Save to keep it." : `Not saved yet: 🔊 Test sound still plays ${stingName(saved)} at ${saved.stingVolume}% on the TV until you press Save.`}</p>
      ) : spooked ? null : (
        <p className="text-xs text-neutral-500">🔊 Test sound, at the top, plays this one on the TV.</p>
      )}
    </div>
  );
}
