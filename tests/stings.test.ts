import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STING, STINGS, isStingId, playSting, type StingId } from "../src/lib/stings.ts";
import { playIntroSound } from "../src/lib/intro-sound.ts";

// A stand-in for a browser's audio context: it builds nothing audible, but it
// records the graph a sting builds and objects, the way a browser would or
// worse, to the mistakes that make a sting silent, clicky or leaky.

type ParamEvent = { kind: "set" | "linear" | "exponential" | "target"; value: number; time: number };

class FakeParam {
  owner: FakeNode;
  value: number;
  events: ParamEvent[] = [];
  constructor(owner: FakeNode, value: number) {
    this.owner = owner;
    this.value = value;
  }
  private add(kind: ParamEvent["kind"], value: number, time: number) {
    assert.ok(Number.isFinite(value), `${this.owner.kind}: ${kind} to ${value}`);
    assert.ok(Number.isFinite(time) && time >= 0, `${this.owner.kind}: ${kind} at ${time}`);
    this.events.push({ kind, value, time });
    return this;
  }
  setValueAtTime(value: number, time: number) {
    return this.add("set", value, time);
  }
  linearRampToValueAtTime(value: number, time: number) {
    return this.add("linear", value, time);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    // A browser throws on a ramp to zero.
    if (!(value > 0)) throw new RangeError(`${this.owner.kind}: exponential ramp to ${value}`);
    return this.add("exponential", value, time);
  }
  setTargetAtTime(target: number, time: number, timeConstant: number) {
    assert.ok(timeConstant > 0, `${this.owner.kind}: time constant ${timeConstant}`);
    return this.add("target", target, time);
  }
  /** Everything this parameter is ever set to. */
  values(): number[] {
    return [this.value, ...this.events.map((event) => event.value)];
  }
}

type Target = FakeNode | FakeParam;

class FakeNode {
  context: FakeContext;
  kind: string;
  outputs: Target[] = [];
  constructor(context: FakeContext, kind: string) {
    this.context = context;
    this.kind = kind;
    context.nodes.push(this);
  }
  connect<T extends Target>(target: T): T {
    assert.ok(target instanceof FakeNode || target instanceof FakeParam, `${this.kind} connected to something that isn't a node`);
    const node = target instanceof FakeParam ? target.owner : target;
    assert.equal(node.context, this.context, `${this.kind} connected across contexts`);
    this.outputs.push(target);
    return target;
  }
  params(): FakeParam[] {
    return Object.values(this).filter((value): value is FakeParam => value instanceof FakeParam);
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam(this, 1);
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(this, 350);
  Q = new FakeParam(this, 1);
  gain = new FakeParam(this, 0);
  detune = new FakeParam(this, 0);
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam(this, -24);
  knee = new FakeParam(this, 30);
  ratio = new FakeParam(this, 12);
  attack = new FakeParam(this, 0.003);
  release = new FakeParam(this, 0.25);
}

class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "none";
}

class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
  normalize = true;
}

class FakeSource extends FakeNode {
  started: number | undefined;
  stopped: number | undefined;
  start(when = 0) {
    assert.equal(this.started, undefined, `${this.kind} started twice`);
    assert.ok(Number.isFinite(when) && when >= 0, `${this.kind} started at ${when}`);
    this.started = when;
  }
  stop(when = 0) {
    assert.notEqual(this.started, undefined, `${this.kind} stopped before it was started`);
    assert.ok(Number.isFinite(when), `${this.kind} stopped at ${when}`);
    this.stopped = when;
  }
}

class FakeOscillator extends FakeSource {
  type = "sine";
  frequency = new FakeParam(this, 440);
  detune = new FakeParam(this, 0);
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam(this, 1);
  detune = new FakeParam(this, 0);
}

class FakeBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  private channels: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    assert.ok(Number.isInteger(channels) && channels >= 1 && channels <= 32, `buffer with ${channels} channels`);
    assert.ok(Number.isInteger(length) && length > 0, `buffer of ${length} samples`);
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(channel: number): Float32Array {
    assert.ok(channel >= 0 && channel < this.numberOfChannels, `no channel ${channel}`);
    return this.channels[channel];
  }
}

class FakeContext {
  sampleRate = 44_100;
  currentTime = 0;
  nodes: FakeNode[] = [];
  destination = new FakeNode(this, "destination");
  createGain() {
    return new FakeGain(this, "gain");
  }
  createBiquadFilter() {
    return new FakeFilter(this, "filter");
  }
  createDynamicsCompressor() {
    return new FakeCompressor(this, "compressor");
  }
  createWaveShaper() {
    return new FakeShaper(this, "shaper");
  }
  createConvolver() {
    return new FakeConvolver(this, "convolver");
  }
  createOscillator() {
    return new FakeOscillator(this, "oscillator");
  }
  createBufferSource() {
    return new FakeBufferSource(this, "buffer source");
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    assert.equal(sampleRate, this.sampleRate, "buffer at a different rate from its context");
    return new FakeBuffer(channels, length, sampleRate);
  }
  /** What a sting expects to be given. */
  get audio(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
  /** Every node with at least one route, through other nodes or their settings, to the speakers. */
  heard(): Set<FakeNode> {
    const heard = new Set<FakeNode>([this.destination]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of this.nodes) {
        if (heard.has(node)) continue;
        if (node.outputs.some((target) => heard.has(target instanceof FakeParam ? target.owner : target))) {
          heard.add(node);
          grew = true;
        }
      }
    }
    return heard;
  }
  inputsOf(target: FakeNode): FakeNode[] {
    return this.nodes.filter((node) => node.outputs.includes(target));
  }
}

/** The gain a sting's volume goes into: the one feeding its compressor. */
function masterGain(fake: FakeContext): number {
  const [compressor] = fake.nodes.filter((node) => node instanceof FakeCompressor);
  const [master] = fake.inputsOf(compressor);
  assert.ok(master instanceof FakeGain);
  return master.gain.value;
}

test("the twelve stings, in order, doom first and the default", () => {
  assert.deepEqual(
    STINGS.map((sting) => sting.id),
    ["doom", "sad-trombone", "air-horn", "record-scratch", "rimshot", "wrong-buzzer", "ding-ding", "siren", "gong", "dramatic", "boing", "soft-chime"],
  );
  assert.equal(DEFAULT_STING, "doom");
  assert.equal(STINGS[0].id, DEFAULT_STING);
});

test("each has a short plain label, an emoji and a one-line blurb, none repeated", () => {
  for (const { id, label, emoji, blurb } of STINGS) {
    assert.ok(label.trim() && label.length <= 16, `${id} label "${label}"`);
    assert.ok(emoji.trim() && !/[a-z0-9]/i.test(emoji), `${id} emoji "${emoji}"`);
    assert.ok(blurb.trim() && blurb.length <= 60 && !blurb.includes("\n"), `${id} blurb "${blurb}"`);
  }
  for (const field of ["label", "emoji", "blurb"] as const) {
    assert.equal(new Set(STINGS.map((sting) => sting[field])).size, STINGS.length, `${field}s repeat`);
  }
});

test("isStingId knows exactly the stings, nothing that merely looks like one", () => {
  for (const { id } of STINGS) assert.equal(isStingId(id), true, id);
  for (const value of ["", "Doom", " doom", "doom ", "sad trombone", "kazoo", "toString", "constructor", "__proto__", "hasOwnProperty", undefined, null, 0, 1, true, {}, ["doom"], { id: "doom" }]) {
    assert.equal(isStingId(value), false, JSON.stringify(value) ?? String(value));
  }
});

for (const { id } of STINGS) {
  test(`${id}: a whole graph, all of it heard, starting at once and tidying up after itself`, () => {
    const fake = new FakeContext();
    fake.currentTime = 2;
    const at = 5;
    const length = playSting(fake.audio, id, { at });
    assert.ok(length >= 1 && length <= 4, `lasts ${length}s`);

    const sources = fake.nodes.filter((node): node is FakeSource => node instanceof FakeSource);
    assert.ok(sources.length > 0, "makes a sound at all");
    for (const source of sources) {
      assert.notEqual(source.started, undefined, `a ${source.kind} is never started`);
      // A source left running is a leak: over a night of questions they'd pile up.
      assert.notEqual(source.stopped, undefined, `a ${source.kind} is never stopped`);
      const started = source.started as number;
      const stopped = source.stopped as number;
      assert.ok(started >= at && started <= at + length, `a ${source.kind} starts at ${started}`);
      assert.ok(stopped > started && stopped <= at + length + 2, `a ${source.kind} runs ${started}–${stopped}`);
    }
    assert.equal(Math.min(...sources.map((source) => source.started as number)), at, "something sounds the moment it is asked to");

    const heard = fake.heard();
    const unheard = fake.nodes.filter((node) => !heard.has(node)).map((node) => node.kind);
    assert.deepEqual(unheard, [], "every node it makes reaches the speakers");

    for (const node of fake.nodes) {
      for (const param of node.params()) {
        const events = [...param.events].sort((a, b) => a.time - b.time);
        events.forEach((event, index) => {
          assert.ok(event.time >= at, `${node.kind} changes at ${event.time}, before the sting starts`);
          // An exponential ramp from silence stays silent until it jumps: a sting with a hole and a click.
          const from = index ? events[index - 1].value : param.value;
          if (event.kind === "exponential") assert.ok(from > 0, `${node.kind} ramps exponentially from ${from}`);
        });
      }
      if (node instanceof FakeOscillator) {
        for (const pitch of node.frequency.values()) assert.ok(pitch >= 0.5 && pitch <= 20_000, `an oscillator at ${pitch} Hz`);
      }
      if (node instanceof FakeFilter) {
        for (const frequency of node.frequency.values()) assert.ok(frequency >= 20 && frequency <= 20_000, `a filter at ${frequency} Hz`);
      }
      if (node instanceof FakeBufferSource || node instanceof FakeConvolver) assert.ok(node.buffer, `a ${node.kind} with nothing to play`);
    }
  });
}

test("every sting goes out through its own compressor and ceiling, the volume ahead of both", () => {
  const fake = new FakeContext();
  playSting(fake.audio, "air-horn");
  playSting(fake.audio, "gong");
  const last = fake.inputsOf(fake.destination);
  assert.equal(last.length, 2, "one chain each");
  for (const ceiling of last) {
    assert.ok(ceiling instanceof FakeShaper && ceiling.curve, "the last stage is the ceiling");
    assert.equal(ceiling.outputs.length, 1);
    const [scale] = fake.inputsOf(ceiling);
    assert.ok(scale instanceof FakeGain);
    const [compressor] = fake.inputsOf(scale);
    assert.ok(compressor instanceof FakeCompressor);
    assert.equal(compressor.threshold.value, -12);
    assert.equal(compressor.ratio.value, 8);
    const [master] = fake.inputsOf(compressor);
    assert.ok(master instanceof FakeGain && master.gain.value > 0);
  }
});

test("the ceiling leaves the sound alone below its knee and never lets a peak reach full scale", () => {
  const fake = new FakeContext();
  playSting(fake.audio, "doom");
  const [ceiling] = fake.inputsOf(fake.destination);
  assert.ok(ceiling instanceof FakeShaper && ceiling.curve);
  const [scale] = fake.inputsOf(ceiling);
  assert.ok(scale instanceof FakeGain);
  const curve = ceiling.curve;
  // What a browser's shaper does: clamp the input to -1..1 and read the curve with straight lines between points.
  const pass = (x: number) => {
    const input = Math.max(-1, Math.min(1, x * scale.gain.value));
    const spot = ((input + 1) / 2) * (curve.length - 1);
    const low = Math.min(Math.floor(spot), curve.length - 2);
    return curve[low] + (curve[low + 1] - curve[low]) * (spot - low);
  };
  let previous = -Infinity;
  for (let x = -6; x <= 6; x += 0.0005) {
    const y = pass(x);
    assert.ok(Math.abs(y) < 1, `${x} comes out at ${y}`);
    assert.ok(y >= previous - 1e-9, `louder in, quieter out at ${x}`);
    previous = y;
    if (Math.abs(x) <= 0.9) assert.ok(Math.abs(y - x) < 1e-6, `${x} is changed to ${y}`);
  }
});

test("volume scales what goes into the limiter: 0 to 1.5, anything else held to that, nonsense ignored", () => {
  const level = (volume?: number) => {
    const fake = new FakeContext();
    playSting(fake.audio, "rimshot", volume === undefined ? {} : { volume });
    return masterGain(fake);
  };
  const designed = level();
  assert.ok(designed > 0);
  assert.equal(level(1), designed);
  assert.equal(level(0.5), designed * 0.5);
  assert.equal(level(1.5), designed * 1.5);
  assert.equal(level(9), designed * 1.5);
  assert.equal(level(0), 0);
  assert.equal(level(-2), 0);
  assert.equal(level(Number.NaN), designed);
  assert.equal(level(Number.POSITIVE_INFINITY), designed);
});

test("without `at`, it starts at the context's current time", () => {
  const fake = new FakeContext();
  fake.currentTime = 12.5;
  playSting(fake.audio, "siren");
  const starts = fake.nodes.filter((node): node is FakeSource => node instanceof FakeSource).map((source) => source.started as number);
  assert.equal(Math.min(...starts), 12.5);
});

test("something that isn't a sting, like an old saved setting, plays the default rather than nothing", () => {
  const unknown = new FakeContext();
  const doom = new FakeContext();
  assert.equal(playSting(unknown.audio, "kazoo" as StingId), playSting(doom.audio, DEFAULT_STING));
  assert.deepEqual(unknown.nodes.map((node) => node.kind), doom.nodes.map((node) => node.kind));
});

test("the old playIntroSound still plays the doom sting, at the time it's given", () => {
  const intro = new FakeContext();
  const doom = new FakeContext();
  assert.equal(playIntroSound(intro.audio, 3), 3.2);
  playSting(doom.audio, "doom", { at: 3 });
  assert.deepEqual(intro.nodes.map((node) => node.kind), doom.nodes.map((node) => node.kind));
  assert.equal(masterGain(intro), masterGain(doom));
  const starts = intro.nodes.filter((node): node is FakeSource => node instanceof FakeSource).map((source) => source.started as number);
  assert.equal(Math.min(...starts), 3);
});
