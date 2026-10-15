"use client";

import { useEffect, useRef, useState } from "react";

/** The sting runs about three seconds, and the live screen hears of the tap within a couple more. */
const PLAYING_MS = 5_000;

/**
 * Plays just the sting once on the projector, nothing else on screen
 * changing, so the host can check the room hears it without running the
 * whole Intro. Waits while it plays, so a few quick taps don't stack up.
 * Muted in the settings, it says "Muted" rather than "Sound off": the live
 * screen's own "Sound is off" button means the browser blocked the sound,
 * which is a different fix.
 */
export default function TestSoundButton({ sound, busy, test }: { sound: boolean; busy: boolean; test: () => Promise<boolean> }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = async () => {
    if (!(await test())) return;
    setPlaying(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(false), PLAYING_MS);
  };

  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy || playing || !sound}
      title={sound ? "Plays the sound once on the projector, so you can check the room hears it. Nothing else changes." : "Sound is muted in 📺 Live screen settings. Tick “Play the sound on the projector” there to test it."}
      className="rounded-md border border-[#ff2e4d]/60 px-4 py-2 text-sm text-[#ff8a9c] disabled:opacity-50"
    >
      {!sound ? "🔇 Muted" : playing ? "Playing…" : "🔊 Test sound"}
    </button>
  );
}
