import { EXPLAINER_MS } from "./explainer.ts";

/** An original, locally served score, with room left for the host's real question sound. */
export const EXPLAINER_SCORE_URL = "/sounds/intro/bad-decisions-score.mp3";

export type ExplainerScore = {
  setVolume: (volume: number) => void;
  stop: () => void;
};

/**
 * Start at the visual intro's current position, including after an autoplay
 * unlock or a suspended tab. The whole score plays, independent of the
 * eight-second cap on individual question stings. No timers or new context:
 * the live screen owns the existing sound controls and playback lifetime.
 */
export function playExplainerScore(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  { elapsedMs = 0, volume = 1 }: { elapsedMs?: number; volume?: number } = {},
): ExplainerScore | null {
  const duration = Math.min(buffer.duration, EXPLAINER_MS / 1_000);
  const offset = Math.max(0, elapsedMs / 1_000);
  if (!Number.isFinite(offset) || offset >= duration) return null;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const level = context.createGain();
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  source.connect(level).connect(limiter).connect(context.destination);
  let ended = false;
  const disconnect = () => {
    if (ended) return;
    ended = true;
    source.disconnect();
    level.disconnect();
    limiter.disconnect();
  };
  const setVolume = (next: number) => {
    if (ended) return;
    const safe = Number.isFinite(next) ? Math.max(0, Math.min(1.5, next)) : 0;
    level.gain.cancelScheduledValues(context.currentTime);
    // Muting takes effect immediately; other changes ease in without clicks.
    if (safe === 0) level.gain.setValueAtTime(0, context.currentTime);
    else level.gain.setTargetAtTime(safe, context.currentTime, 0.015);
  };
  level.gain.setValueAtTime(0, context.currentTime);
  setVolume(volume);
  source.onended = disconnect;
  source.start(context.currentTime, offset, duration - offset);
  return {
    setVolume,
    stop() {
      if (ended) return;
      level.gain.cancelScheduledValues(context.currentTime);
      level.gain.setValueAtTime(0, context.currentTime);
      source.stop();
      disconnect();
    },
  };
}
