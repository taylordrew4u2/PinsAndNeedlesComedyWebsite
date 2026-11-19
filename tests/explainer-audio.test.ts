import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPLAINER_MS } from "../src/lib/explainer.ts";
import { playExplainerScore } from "../src/lib/explainer-audio.ts";

function fakeContext() {
  const calls: { op: string; args: number[] }[] = [];
  let onended: (() => void) | null = null;
  const node = { connect(next: unknown) { return next; }, disconnect() { calls.push({ op: "disconnect", args: [] }); } };
  const gain = {
    cancelScheduledValues: (...args: number[]) => { calls.push({ op: "cancel", args }); },
    setValueAtTime: (...args: number[]) => { calls.push({ op: "set", args }); },
    setTargetAtTime: (...args: number[]) => { calls.push({ op: "target", args }); },
  };
  const context = {
    currentTime: 10,
    destination: {},
    createBufferSource: () => ({ ...node, buffer: null,
      set onended(fn: () => void) { onended = fn; },
      start: (...args: number[]) => { calls.push({ op: "start", args }); },
      stop: (...args: number[]) => { calls.push({ op: "stop", args }); },
    }),
    createGain: () => ({ ...node, gain }),
    createDynamicsCompressor: () => ({ ...node, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }),
  };
  return { context: context as unknown as BaseAudioContext, calls, finish: () => onended?.() };
}
const sound = { duration: 28 } as AudioBuffer;

test("the score plays the entire intro, rather than stopping at the question-sting cap", () => {
  const { context, calls } = fakeContext();
  playExplainerScore(context, sound, { volume: 0.6 });
  assert.deepEqual(calls.find(c => c.op === "start")?.args, [10, 0, EXPLAINER_MS / 1_000]);
  assert.deepEqual(calls.find(c => c.op === "target")?.args, [0.6, 10, 0.015]);
});

test("unlocking or resuming part-way through starts at the matching visual position", () => {
  const { context, calls } = fakeContext();
  playExplainerScore(context, sound, { elapsedMs: 5_500 });
  assert.deepEqual(calls.find(c => c.op === "start")?.args, [10, 5.5, EXPLAINER_MS / 1_000 - 5.5]);
  for (const elapsedMs of [EXPLAINER_MS, EXPLAINER_MS + 10_000, NaN]) {
    assert.equal(playExplainerScore(context, sound, { elapsedMs }), null);
  }
  assert.equal(calls.filter(c => c.op === "start").length, 1, "an old intro never starts again");
});

test("the current mute and volume apply during playback, and stop releases audio once", () => {
  const { context, calls, finish } = fakeContext();
  const score = playExplainerScore(context, sound)!;
  score.setVolume(0);
  assert.deepEqual(calls.at(-1), { op: "set", args: [0, 10] });
  score.setVolume(0.4);
  assert.deepEqual(calls.at(-1), { op: "target", args: [0.4, 10, 0.015] });
  score.stop();
  score.stop();
  score.setVolume(1);
  assert.equal(calls.filter(c => c.op === "stop").length, 1);
  assert.equal(calls.filter(c => c.op === "disconnect").length, 3);
  finish();
  assert.equal(calls.filter(c => c.op === "disconnect").length, 3);
});

test("natural completion cannot be unmuted or stopped again", () => {
  const { context, calls, finish } = fakeContext();
  const score = playExplainerScore(context, sound)!;
  finish();
  const after = calls.length;
  score.setVolume(1);
  score.stop();
  assert.equal(calls.length, after);
});
