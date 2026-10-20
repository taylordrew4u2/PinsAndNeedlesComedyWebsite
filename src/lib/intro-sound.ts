import { playSting } from "./stings.ts";

/**
 * The original sting, the doom bell and guitar, kept under its old name so
 * anything that plays "the intro sound" still does. It and all the other
 * stings live in stings.ts.
 *
 * Takes any audio context, so a test can render it offline.
 */
export function playIntroSound(context: BaseAudioContext, at = context.currentTime): number {
  return playSting(context, "doom", { at });
}
