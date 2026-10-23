"use client";

import { useEffect, useRef, useState } from "react";
import { loadCustomSting, playCustomSting } from "@/lib/custom-sting";

type Playing = { key: string; context: AudioContext; timer?: ReturnType<typeof setTimeout> };

/** Why a ▶ played nothing: this browser has no sound at all, or the file wouldn't load or play here. */
export type PreviewProblem = "unsupported" | "failed";

export type SoundPreview = {
  /** The ▶ playing now, by the key it was pressed with; null when nothing is. */
  playing: string | null;
  /**
   * One ▶ pressed: plays the file at `address` here, at `volume` percent, or
   * stops it when that ▶ is the one playing. `loaded` hears the decoded sound
   * every time it is ready. Resolves to a problem to tell the host, or null.
   */
  press: (key: string, address: string, volume: number, loaded?: (buffer: AudioBuffer) => void) => Promise<PreviewProblem | null>;
  /** Stops whatever is playing, at once. */
  stop: () => void;
  /** A sound this page has already decoded (a fresh upload), so its ▶ plays straight away. */
  keep: (address: string, buffer: AudioBuffer) => void;
};

function audioContextClass(): typeof AudioContext | undefined {
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/**
 * The ▶ previews in 📺 Live screen settings: a sound played in the host's
 * own browser, never on the TV, so they can choose without the room
 * hearing. The card keeps one for all its lists, so the usual and the
 * spooky sounds never play over each other: any ▶ stops the one before.
 */
export function useSoundPreview(): SoundPreview {
  const [playing, setPlaying] = useState<string | null>(null);
  const current = useRef<Playing | null>(null);
  // Each sound previewed, decoded once per address; a decoded sound plays on any context.
  const decoded = useRef(new Map<string, AudioBuffer>());

  /** Stops a preview at once: its context is closed, which silences whatever it was playing. */
  const stop = () => {
    const preview = current.current;
    current.current = null;
    if (preview) {
      clearTimeout(preview.timer);
      void preview.context.close().catch(() => {});
    }
    setPlaying(null);
  };
  useEffect(() => () => {
    clearTimeout(current.current?.timer);
    void current.current?.context.close().catch(() => {});
  }, []);

  const press = async (key: string, address: string, volume: number, loaded?: (buffer: AudioBuffer) => void): Promise<PreviewProblem | null> => {
    const again = playing === key;
    stop();
    if (again) return null;
    const Context = audioContextClass();
    if (!Context) return "unsupported";
    let entry: Playing | null = null;
    try {
      // A fresh context for every press, made in the press itself, so the browser lets it play straight away.
      const context = new Context();
      entry = { key, context };
      current.current = entry;
      setPlaying(key);
      await context.resume();
      let buffer = decoded.current.get(address);
      if (!buffer) {
        buffer = await loadCustomSting(context, address);
        decoded.current.set(address, buffer);
      }
      loaded?.(buffer);
      // Stopped, or another ▶ pressed, while it loaded.
      if (current.current !== entry) return null;
      const seconds = playCustomSting(context, buffer, { volume: volume / 100 });
      const started = entry;
      started.timer = setTimeout(() => { if (current.current === started) stop(); }, seconds * 1_000 + 300);
      return null;
    } catch {
      if (current.current !== entry) return null;
      stop();
      return "failed";
    }
  };

  const keep = (address: string, buffer: AudioBuffer) => { decoded.current.set(address, buffer); };

  return { playing, press, stop, keep };
}

/** A sound's ▶, which turns into ■ while that sound plays. */
export function PreviewButton({ playing, label, disabled = false, onPress }: { playing: boolean; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={playing ? `Stop ${label}` : `Preview ${label}`}
      title={playing ? "Stop" : "Play it here, on this device"}
      className={`shrink-0 rounded-md border px-2.5 py-1 text-sm disabled:opacity-40 ${playing ? "border-amber-300 bg-amber-300 text-black" : "border-white/30 text-white"}`}
    >
      {playing ? "■" : "▶"}
    </button>
  );
}
