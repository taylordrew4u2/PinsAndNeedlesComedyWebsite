import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_STING_FADE_S, CUSTOM_STING_MAX_BYTES, CUSTOM_STING_MAX_S, CUSTOM_STING_RETRY_MS,
  customStingCache, customStingLength, loadCustomSting, playCustomSting, playQuestionSound,
} from "../src/lib/custom-sting.ts";
import { DEFAULT_STING, type StingId } from "../src/lib/stings.ts";

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

test("the host's own sound plays once loaded; until then, and with none, the default sting plays", () => {
  const played: [StingId, number | undefined][] = [];
  const builtIn = (_context: BaseAudioContext, id: StingId, options?: { volume?: number }) => { played.push([id, options?.volume]); return 3.2; };
  const { context, calls } = fakeContext();
  assert.equal(playQuestionSound(context, "custom", sound(2), 1.2, builtIn), 2);
  assert.deepEqual(played, []);
  assert.ok(calls.some(([, method]) => method === "start"));
  assert.equal(playQuestionSound(context, "custom", null, 0.8, builtIn), 3.2);
  assert.equal(playQuestionSound(context, "air-horn", sound(2), 1, builtIn), 3.2);
  assert.deepEqual(played, [[DEFAULT_STING, 0.8], ["air-horn", 1]]);
});

test("a sound file is fetched and decoded; a missing or oversized one is refused", async () => {
  const realFetch = globalThis.fetch;
  try {
    const { context } = fakeContext();
    globalThis.fetch = (async () => new Response(new Uint8Array(2_500))) as typeof fetch;
    assert.equal((await loadCustomSting(context, "/uploads/sting.mp3")).duration, 2.5);
    globalThis.fetch = (async () => new Response("Not found", { status: 404 })) as typeof fetch;
    await assert.rejects(() => loadCustomSting(context, "/uploads/gone.mp3"), /404/);
    globalThis.fetch = (async () => new Response(new Uint8Array(CUSTOM_STING_MAX_BYTES + 1))) as typeof fetch;
    await assert.rejects(() => loadCustomSting(context, "/uploads/huge.wav"), /too big/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("each address loads once, a new one replaces it, and a failed one is retried only after a pause", async () => {
  let now = 0;
  const loads: string[] = [];
  const outcome = new Map<string, boolean>([["/a.mp3", true], ["/b.mp3", false]]);
  const cache = customStingCache(async (url) => {
    loads.push(url);
    if (!outcome.get(url)) throw new Error("failed");
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
  assert.equal(cache.ready("/a.mp3"), null, "only the sound in use is kept");
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
