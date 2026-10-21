/**
 * Playing a question sound from its file, one of the built-in recordings or
 * the host's own upload: fetched and decoded once, then played at the chosen
 * volume through a limiter. A long file is faded out rather than left to run
 * over the question.
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
 * Plays the question sound: the one the host chose once it has loaded, and
 * the default recording while it hasn't (just picked and still loading, or
 * their own file failed), so the room still hears something. Silent only if
 * neither has loaded. Returns how long it plays.
 */
export function playQuestionSound(context: BaseAudioContext, chosen: AudioBuffer | null, fallback: AudioBuffer | null, volume: number): number {
  const sound = chosen ?? fallback;
  return sound ? playCustomSting(context, sound, { volume }) : 0;
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

/** The chosen sound and the default it falls back on, and one more, so switching back to the last sound needs no new load. */
export const CACHED_SOUNDS = 3;

/**
 * Remembers the sound files in use, each loaded once per address. `want`
 * starts loading an address the moment the setting names it (the screen
 * calls it on every poll), so by the time a question goes up it is ready;
 * `ready` gives the decoded sound, or null while it loads or after it failed.
 * A failed load is tried again on a later `want`, after a pause. Only the
 * CACHED_SOUNDS most lately wanted are kept.
 */
export function customStingCache<T>(load: (url: string) => Promise<T>, now: () => number = Date.now) {
  const entries = new Map<string, { value: T | null; loading: boolean; failedAt: number }>();
  const want = (url: string) => {
    const entry = entries.get(url);
    // Kept in the order last wanted, so the oldest is the one let go.
    entries.delete(url);
    if (entry) {
      entries.set(url, entry);
      if (entry.value !== null || entry.loading || now() - entry.failedAt < CUSTOM_STING_RETRY_MS) return;
    }
    const current = { value: null as T | null, loading: true, failedAt: 0 };
    entries.set(url, current);
    for (const old of entries.keys()) {
      if (entries.size <= CACHED_SOUNDS) break;
      entries.delete(old);
    }
    load(url).then(
      (value) => { current.value = value; current.loading = false; },
      () => { current.loading = false; current.failedAt = now(); },
    );
  };
  const ready = (url: string): T | null => entries.get(url)?.value ?? null;
  return { want, ready };
}
