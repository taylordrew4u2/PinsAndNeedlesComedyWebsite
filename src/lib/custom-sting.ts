import { DEFAULT_STING, playSting } from "./stings.ts";
import type { QuestionSound } from "./screen-settings.ts";

/**
 * The host's own question sound: fetched and decoded once, then played the
 * way the built-in stings are, at the chosen volume and through a limiter.
 * A long file is faded out rather than left to run over the question.
 */

/** A question sound is a sting, not a song: anything longer fades out by here. */
export const CUSTOM_STING_MAX_S = 8;
/** How long that fade takes, ending at CUSTOM_STING_MAX_S. */
export const CUSTOM_STING_FADE_S = 1.5;
/** More than this is not a sound file anyone meant to use as a sting, and would stall the screen to decode. */
export const CUSTOM_STING_MAX_BYTES = 10 * 1024 * 1024;
/** A load that has not finished by now is given up, so venue wifi can't leave one hanging. */
export const CUSTOM_STING_LOAD_MS = 20_000;
/** After a failed load, the next try waits this long, so a missing file is not fetched every poll. */
export const CUSTOM_STING_RETRY_MS = 30_000;

/** How long a sound of `duration` seconds plays: all of it, up to the cap. */
export function customStingLength(duration: number): number {
  return Math.max(0, Math.min(duration, CUSTOM_STING_MAX_S));
}

/**
 * Plays a decoded sound at `at` (default now), `volume` 1 being the file as
 * it is. The limiter only catches the peaks a louder setting would push into
 * clipping, so at 100% the file sounds as recorded. Returns how long it plays.
 */
export function playCustomSting(context: BaseAudioContext, buffer: AudioBuffer, options: { at?: number; volume?: number } = {}): number {
  const at = options.at ?? context.currentTime;
  const volume = Math.max(0, options.volume ?? 1);
  const length = customStingLength(buffer.duration);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const level = context.createGain();
  level.gain.setValueAtTime(volume, at);
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  source.connect(level).connect(limiter).connect(context.destination);
  if (buffer.duration > CUSTOM_STING_MAX_S) {
    // Held, then faded to silence, then stopped: no click where it is cut.
    level.gain.setValueAtTime(volume, at + CUSTOM_STING_MAX_S - CUSTOM_STING_FADE_S);
    level.gain.linearRampToValueAtTime(0, at + CUSTOM_STING_MAX_S);
    source.start(at);
    source.stop(at + CUSTOM_STING_MAX_S + 0.05);
  } else {
    source.start(at);
  }
  return length;
}

/**
 * Plays the question sound the host chose: their own file when it has
 * loaded, otherwise the built-in one, and the default in place of their own
 * when it hasn't (not uploaded, still loading, or failed), so the room
 * still hears something. Returns how long it plays. (`builtIn` is only
 * ever swapped by a test.)
 */
export function playQuestionSound(context: BaseAudioContext, sting: QuestionSound, custom: AudioBuffer | null, volume: number, builtIn: typeof playSting = playSting): number {
  if (sting === "custom" && custom) return playCustomSting(context, custom, { volume });
  return builtIn(context, sting === "custom" ? DEFAULT_STING : sting, { volume });
}

/**
 * Fetches and decodes a sound file within CUSTOM_STING_LOAD_MS. Decode it
 * on the context it will play on, so it comes out at that context's sample
 * rate. Throws for a missing, oversized or undecodable file.
 */
export async function loadCustomSting(context: BaseAudioContext, url: string, outer?: AbortSignal): Promise<AudioBuffer> {
  const request = new AbortController();
  const abort = () => request.abort();
  if (outer?.aborted) abort();
  outer?.addEventListener("abort", abort);
  const timer = setTimeout(abort, CUSTOM_STING_LOAD_MS);
  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) throw new Error(`The sound file answered ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > CUSTOM_STING_MAX_BYTES) throw new Error("The sound file is too big");
    return await context.decodeAudioData(bytes);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", abort);
  }
}

/**
 * Remembers the one sound file in use, loaded once per address. `want`
 * starts loading an address the moment the setting names it (the screen
 * calls it on every poll), so by the time a question goes up it is ready;
 * `ready` gives the decoded sound, or null while it loads or after it failed.
 * A failed load is tried again on a later `want`, after a pause.
 */
export function customStingCache<T>(load: (url: string) => Promise<T>, now: () => number = Date.now) {
  let entry: { url: string; value: T | null; loading: boolean; failedAt: number } | null = null;
  const want = (url: string) => {
    if (entry?.url === url && (entry.value !== null || entry.loading || now() - entry.failedAt < CUSTOM_STING_RETRY_MS)) return;
    const current = { url, value: null as T | null, loading: true, failedAt: 0 };
    entry = current;
    load(url).then(
      (value) => { current.value = value; current.loading = false; },
      () => { current.loading = false; current.failedAt = now(); },
    );
  };
  const ready = (url: string): T | null => (entry?.url === url ? entry.value : null);
  return { want, ready };
}
