import { playIntroSound } from "./intro-sound.ts";

/**
 * STUB, replaced at merge by the real set of stings. It matches the shared
 * contract exactly so the settings, the projector and the Control Center can
 * be built and tested against it: every id plays today's sound for now.
 */
export type StingId = "doom" | "sad-trombone" | "air-horn" | "record-scratch" | "rimshot" | "wrong-buzzer" | "ding-ding" | "siren" | "gong" | "dramatic" | "boing" | "soft-chime";

export const STINGS: readonly { id: StingId; label: string; emoji: string; blurb: string }[] = [
  { id: "doom", label: "Doom bell", emoji: "🔔", blurb: "A bell, then a heavy guitar: dun… dun… DUNNN." },
  { id: "sad-trombone", label: "Sad trombone", emoji: "🎺", blurb: "Wah, wah, wah, waaah." },
  { id: "air-horn", label: "Air horn", emoji: "📯", blurb: "Three loud blasts." },
  { id: "record-scratch", label: "Record scratch", emoji: "💿", blurb: "Everything stops." },
  { id: "rimshot", label: "Rimshot", emoji: "🥁", blurb: "Ba-dum tss." },
  { id: "wrong-buzzer", label: "Wrong buzzer", emoji: "❌", blurb: "The game-show buzzer." },
  { id: "ding-ding", label: "Ding ding", emoji: "🛎️", blurb: "We have a winner." },
  { id: "siren", label: "Siren", emoji: "🚨", blurb: "A short alarm." },
  { id: "gong", label: "Gong", emoji: "🪘", blurb: "One big, long gong." },
  { id: "dramatic", label: "Dramatic chord", emoji: "🎹", blurb: "Dun dun DUNNN on the organ." },
  { id: "boing", label: "Boing", emoji: "🤪", blurb: "A cartoon spring." },
  { id: "soft-chime", label: "Soft chime", emoji: "🎐", blurb: "Gentle, for a quieter room." },
];

export const DEFAULT_STING: StingId = "doom";

const IDS = new Set<string>(STINGS.map((sting) => sting.id));

export function isStingId(value: unknown): value is StingId {
  return typeof value === "string" && IDS.has(value);
}

/** Plays it on the context at `at` (default context.currentTime), volume 0..1.5 where 1 is as designed, through its own limiter into context.destination. Returns its length in seconds. */
export function playSting(context: BaseAudioContext, id: StingId, options: { at?: number; volume?: number } = {}): number {
  void id;
  void options.volume;
  return playIntroSound(context, options.at ?? context.currentTime);
}
