import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHED_SOUNDS, CUSTOM_STING_FADE_S, CUSTOM_STING_MAX_BYTES, CUSTOM_STING_MAX_S, CUSTOM_STING_RETRY_MS, CUSTOM_STING_RETRY_SOON_MS, FALLBACK_MARGIN_MS,
  SoundFileRefused, customStingCache, customStingLength, loadCustomSting, pickQuestionSound, playCustomSting,
} from "../src/lib/custom-sting.ts";

type Call = [node: string, method: string, ...args: unknown[]];

/** Just enough of an audio context to see what a custom sting plays, how loud, and when it stops. */
function fakeContext(currentTime = 10) {
  const calls: Call[] = [];
  const param = (node: string, name: string) => ({
    value: 0,
    setValueAtTime: (value: number, at: number) => { calls.push([node, `${name}.set`, value, at]); },
    linearRampToValueAtTime: (value: number, at: number) => { calls.push([node, `${name}.ramp`, value, at]); },
  });
  const node = (name: string) => ({
    name,
    connect(next: { name: string }) { calls.push([name, "connect", next.name]); return next; },
  });
  const context = {
    currentTime,
    destination: node("destination"),
    createBufferSource: () => ({
      ...node("source"),
      buffer: null as unknown,
      start: (at: number) => { calls.push(["source", "start", at]); },
      stop: (at: number) => { calls.push(["source", "stop", at]); },
    }),
    createGain: () => ({ ...node("gain"), gain: param("gain", "gain") }),
    createDynamicsCompressor: () => ({
      ...node("limiter"), threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    }),
    decodeAudioData: async (bytes: ArrayBuffer) => ({ duration: bytes.byteLength / 1000 }) as AudioBuffer,
  };
  return { context: context as unknown as BaseAudioContext, calls };
}

const sound = (duration: number) => ({ duration }) as AudioBuffer;

test("a short sound plays all the way through, at the chosen volume, through a limiter", () => {
  const { context, calls } = fakeContext();
  assert.equal(playCustomSting(context, sound(3), { volume: 0.5 }), 3);
  assert.deepEqual(calls.filter(([, method]) => method === "connect"), [
    ["source", "connect", "gain"], ["gain", "connect", "limiter"], ["limiter", "connect", "destination"],
  ]);
  assert.deepEqual(calls.find(([, method]) => method === "gain.set"), ["gain", "gain.set", 0.5, 10]);
  assert.deepEqual(calls.find(([, method]) => method === "start"), ["source", "start", 10]);
  assert.equal(calls.some(([, method]) => method === "stop" || method === "gain.ramp"), false);
});

test("a long sound fades out and stops at the cap", () => {
  const { context, calls } = fakeContext(0);
  assert.equal(playCustomSting(context, sound(40)), CUSTOM_STING_MAX_S);
  assert.deepEqual(calls.filter(([, method]) => method === "gain.set"), [
    ["gain", "gain.set", 1, 0], ["gain", "gain.set", 1, CUSTOM_STING_MAX_S - CUSTOM_STING_FADE_S],
  ]);
  assert.deepEqual(calls.find(([, method]) => method === "gain.ramp"), ["gain", "gain.ramp", 0, CUSTOM_STING_MAX_S]);
  const stop = calls.find(([, method]) => method === "stop");
  assert.ok(stop && (stop[2] as number) > CUSTOM_STING_MAX_S && (stop[2] as number) < CUSTOM_STING_MAX_S + 0.2);
});

test("a custom sound plays for its length, never past the cap", () => {
  assert.equal(customStingLength(2.5), 2.5);
  assert.equal(customStingLength(CUSTOM_STING_MAX_S + 30), CUSTOM_STING_MAX_S);
  assert.equal(customStingLength(-1), 0);
});

/** A cache whose sounds are ready, or arrive after a delay, or never: `within` answers as the real one does. */
function fakeCache(sounds: Record<string, { value: string | null; after?: number }>, clock: { now: number }) {
  const waits: [string, number][] = [];
  return {
    waits,
    ready: (url: string) => (sounds[url]?.after === undefined ? sounds[url]?.value ?? null : null),
    within: async (url: string, ms: number) => {
      waits.push([url, ms]);
      const sound = sounds[url];
      if (!sound || sound.after === undefined || ms <= 0) return sound?.after === undefined ? sound?.value ?? null : null;
      // Loading: it arrives after `after` ms if that is within the wait, else the wait runs out.
      clock.now += Math.min(sound.after, ms);
      return sound.after <= ms ? sound.value : null;
    },
  };
}

test("the chosen sound plays once it has loaded; one still loading is waited for", async () => {
  const clock = { now: 0 };
  const now = () => clock.now;
  assert.equal(await pickQuestionSound(fakeCache({ "/c": { value: "chosen" }, "/d": { value: "default" } }, clock), "/c", "/d", 1_500, now), "chosen");
  // Just picked, or the screen only just opened: worth a moment's wait.
  clock.now = 0;
  assert.equal(await pickQuestionSound(fakeCache({ "/c": { value: "chosen", after: 300 }, "/d": { value: "default" } }, clock), "/c", "/d", 1_500, now), "chosen");
  clock.now = 0;
  assert.equal(await pickQuestionSound(fakeCache({ "/c": { value: "chosen", after: 200 }, "/d": { value: "default", after: 100 } }, clock), "/c", "/d", 1_500, now), "chosen");
});

test("the default stands in for a chosen sound that failed or is too slow, in time to still play", async () => {
  const clock = { now: 0 };
  const now = () => clock.now;
  // Their own file failed: the default, at once.
  const failed = fakeCache({ "/c": { value: null }, "/d": { value: "default" } }, clock);
  assert.equal(await pickQuestionSound(failed, "/c", "/d", 1_500, now), "default");
  assert.equal(clock.now, 0);
  // Slow: waited for only until the default must start to stay inside the beat.
  const slow = fakeCache({ "/c": { value: "chosen", after: 5_000 }, "/d": { value: "default" } }, clock);
  assert.equal(await pickQuestionSound(slow, "/c", "/d", 1_500, now), "default");
  assert.deepEqual(slow.waits, [["/c", 1_500 - FALLBACK_MARGIN_MS]]);
  assert.ok(clock.now < 1_500);
  // Neither ready yet: whichever of the two makes it in time.
  clock.now = 0;
  const cold = fakeCache({ "/c": { value: null }, "/d": { value: "default", after: 400 } }, clock);
  assert.equal(await pickQuestionSound(cold, "/c", "/d", 1_500, now), "default");
  clock.now = 0;
  assert.equal(await pickQuestionSound(fakeCache({ "/c": { value: "chosen", after: 9_000 }, "/d": { value: "default", after: 9_000 } }, clock), "/c", "/d", 1_500, now), null);
});

test("a sound file is fetched and decoded; a missing or oversized one is refused", async () => {
  const realFetch = globalThis.fetch;
  try {
    const { context } = fakeContext();
    globalThis.fetch = (async () => new Response(new Uint8Array(2_500))) as typeof fetch;
    assert.equal((await loadCustomSting(context, "/uploads/sting.mp3")).duration, 2.5);
    globalThis.fetch = (async () => new Response("Not found", { status: 404 })) as typeof fetch;
    await assert.rejects(() => loadCustomSting(context, "/uploads/gone.mp3"), (error) => error instanceof SoundFileRefused && /404/.test(error.message));
    globalThis.fetch = (async () => new Response(new Uint8Array(CUSTOM_STING_MAX_BYTES + 1))) as typeof fetch;
    await assert.rejects(() => loadCustomSting(context, "/uploads/huge.wav"), (error) => error instanceof SoundFileRefused && /too big/.test(error.message));
    // Not sound at all: refused too. A dropped connection is not: it is worth trying again soon.
    const notSound = { ...context, decodeAudioData: async () => { throw new Error("EncodingError"); } } as unknown as BaseAudioContext;
    globalThis.fetch = (async () => new Response(new Uint8Array(10))) as typeof fetch;
    await assert.rejects(() => loadCustomSting(notSound, "/uploads/notes.txt"), SoundFileRefused);
    globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    await assert.rejects(() => loadCustomSting(context, "/uploads/sting.mp3"), (error) => error instanceof TypeError);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("each address loads once, and a file the server refused is retried only after a long pause", async () => {
  let now = 0;
  const loads: string[] = [];
  const outcome = new Map<string, boolean>([["/a.mp3", true], ["/b.mp3", false]]);
  const cache = customStingCache(async (url) => {
    loads.push(url);
    if (!outcome.get(url)) throw new SoundFileRefused("The sound file answered 404");
    return `decoded ${url}`;
  }, () => now);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  cache.want("/a.mp3");
  assert.equal(cache.ready("/a.mp3"), null, "still loading");
  cache.want("/a.mp3");
  await settle();
  assert.equal(cache.ready("/a.mp3"), "decoded /a.mp3");
  cache.want("/a.mp3");
  assert.deepEqual(loads, ["/a.mp3"], "loaded once, however often it is asked for");

  cache.want("/b.mp3");
  await settle();
  assert.equal(cache.ready("/b.mp3"), null);
  assert.equal(cache.ready("/a.mp3"), "decoded /a.mp3", "the other sound in use is kept too");
  now += CUSTOM_STING_RETRY_MS - 1;
  cache.want("/b.mp3");
  assert.deepEqual(loads, ["/a.mp3", "/b.mp3"], "no retry straight away");
  now += 1;
  outcome.set("/b.mp3", true);
  cache.want("/b.mp3");
  await settle();
  assert.equal(cache.ready("/b.mp3"), "decoded /b.mp3");
  assert.deepEqual(loads, ["/a.mp3", "/b.mp3", "/b.mp3"]);
});

test("only the sounds lately wanted are kept: the oldest is let go", async () => {
  const loads: string[] = [];
  const cache = customStingCache(async (url) => { loads.push(url); return `decoded ${url}`; });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const urls = Array.from({ length: CACHED_SOUNDS + 1 }, (_, i) => `/${i}.mp3`);
  for (const url of urls.slice(0, CACHED_SOUNDS)) cache.want(url);
  await settle();
  cache.want(urls[0]);
  cache.want(urls[CACHED_SOUNDS]);
  await settle();
  assert.equal(cache.ready(urls[1]), null, "the least lately wanted went");
  for (const url of [urls[0], ...urls.slice(2)]) assert.equal(cache.ready(url), `decoded ${url}`);
  cache.want(urls[0]);
  assert.equal(loads.filter((url) => url === urls[0]).length, 1, "still loaded only once");
});

test("after a dropped connection the file is tried again soon, not after the long pause", async () => {
  let now = 0;
  let online = false;
  const loads: string[] = [];
  const cache = customStingCache(async (url) => {
    loads.push(url);
    if (!online) throw new TypeError("Failed to fetch");
    return `decoded ${url}`;
  }, () => now);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  cache.want("/ooh.mp3");
  await settle();
  now += CUSTOM_STING_RETRY_SOON_MS - 1;
  cache.want("/ooh.mp3");
  assert.equal(loads.length, 1, "not every poll");
  now += 1;
  online = true;
  cache.want("/ooh.mp3");
  await settle();
  assert.equal(cache.ready("/ooh.mp3"), "decoded /ooh.mp3");
  assert.ok(CUSTOM_STING_RETRY_SOON_MS < CUSTOM_STING_RETRY_MS);
});

test("within waits for a sound still loading, up to its limit, and answers at once otherwise", async () => {
  let finish: (value: string) => void = () => {};
  const cache = customStingCache((url) => (url === "/slow.mp3" ? new Promise<string>((resolve) => { finish = resolve; }) : Promise.resolve(`decoded ${url}`)));
  assert.equal(await cache.within("/never-wanted.mp3", 1_000), null);
  cache.want("/quick.mp3");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await cache.within("/quick.mp3", 0), "decoded /quick.mp3");
  cache.want("/slow.mp3");
  assert.equal(await cache.within("/slow.mp3", 20), null, "the wait ran out");
  const waiting = cache.within("/slow.mp3", 1_000);
  finish("decoded /slow.mp3");
  assert.equal(await waiting, "decoded /slow.mp3");
});
