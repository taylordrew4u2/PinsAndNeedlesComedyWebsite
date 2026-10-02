/**
 * The sting that plays with the Bad Decision intro: something wicked this
 * way comes. A church bell tolls, then a heavy, down-tuned guitar plays
 * "dun… dun… DUNNN", landing on the tritone (the devil's interval) and
 * left to ring out in a dark room. About three seconds, synthesized on the
 * spot so there is no audio file to load or license. A compressor caps the
 * peaks so it is loud, not painful.
 *
 * Takes any audio context, so a test can render it offline.
 */
export function playIntroSound(context: BaseAudioContext, at = context.currentTime): number {
  const master = context.createGain();
  master.gain.value = 0.55;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  master.connect(limiter).connect(context.destination);

  // A dark room: everything is sent to a long, low reverb as well as straight out.
  const room = context.createConvolver();
  room.buffer = roomImpulse(context, 2.6);
  const roomTone = context.createBiquadFilter();
  roomTone.type = "lowpass";
  roomTone.frequency.value = 2_000;
  const roomLevel = context.createGain();
  roomLevel.gain.value = 0.45;
  room.connect(roomTone).connect(roomLevel).connect(master);
  const bus = context.createGain();
  bus.connect(master);
  bus.connect(room);

  const noise = noiseBuffer(context);

  // The bell, before anything else.
  bell(context, bus, at, 130.8);

  // dun… dun… DUNNN: E, up a half step to F, then down to the tritone below E.
  const E2 = 82.41;
  const F2 = 87.31;
  const Bb1 = 58.27;
  const hits: [start: number, root: number, length: number, fifth: number][] = [
    [0.45, E2, 0.32, 1.5],
    [0.95, F2, 0.32, 1.5],
    [1.45, Bb1, 1.5, Math.SQRT2],
  ];
  for (const [start, root, length, fifth] of hits) {
    guitar(context, bus, noise, at + start, root, length, fifth);
    drum(context, bus, at + start);
  }
  // A crash on the last hit, and the bell once more as it rings out.
  cymbal(context, bus, noise, at + 1.45);
  bell(context, bus, at + 1.45, 92.5, 0.6);

  return 3.2;
}

/**
 * A down-tuned guitar chord: root, the given interval and the octave,
 * played by two slightly detuned "strings" each, driven hard, then shaped
 * like a speaker cabinet so it sounds like an amp in a room, not a synth.
 */
function guitar(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, root: number, length: number, interval: number) {
  const pre = context.createBiquadFilter();
  pre.type = "highpass";
  pre.frequency.value = 70;
  const drive = context.createWaveShaper();
  drive.curve = driveCurve();
  drive.oversample = "4x";
  // Cabinet: no fizz above 3 kHz, a growl around 700 Hz, scooped mids.
  const cab = context.createBiquadFilter();
  cab.type = "lowpass";
  cab.frequency.value = 3_000;
  cab.Q.value = 0.9;
  const growl = context.createBiquadFilter();
  growl.type = "peaking";
  growl.frequency.value = 700;
  growl.gain.value = 5;
  const scoop = context.createBiquadFilter();
  scoop.type = "peaking";
  scoop.frequency.value = 1_600;
  scoop.gain.value = -6;
  const level = context.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(0.5, at + 0.006);
  level.gain.setTargetAtTime(0.32, at + 0.06, 0.15);
  level.gain.setTargetAtTime(0, at + length, length > 1 ? 0.35 : 0.06);
  pre.connect(drive).connect(cab).connect(growl).connect(scoop).connect(level).connect(out);

  for (const ratio of [1, interval, 2]) {
    for (const detune of [-7, 6]) {
      const string = context.createOscillator();
      string.type = "sawtooth";
      string.frequency.value = root * ratio;
      string.detune.value = detune;
      const gain = context.createGain();
      gain.gain.value = ratio === 1 ? 0.5 : 0.35;
      string.connect(gain).connect(pre);
      string.start(at);
      string.stop(at + length + 1.2);
    }
  }
  // The pick hitting the strings.
  burst(context, out, noise, at, "bandpass", 2_200, 0.25, 0.03);
}

/** A tolling bell: inharmonic partials that ring and fade, the way cast metal does. */
function bell(context: BaseAudioContext, out: AudioNode, at: number, pitch: number, peak = 0.9) {
  const partials: [ratio: number, gain: number, decay: number][] = [
    [0.5, 0.5, 2.4], [1, 0.6, 2], [1.19, 0.3, 1.4], [1.5, 0.25, 1.2], [2, 0.3, 1], [2.74, 0.18, 0.7], [3.76, 0.1, 0.5],
  ];
  for (const [ratio, gain, decay] of partials) {
    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = pitch * ratio;
    const level = context.createGain();
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(gain * peak * 0.4, at + 0.004);
    level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    tone.connect(level).connect(out);
    tone.start(at);
    tone.stop(at + decay + 0.05);
  }
}

/** A deep floor-tom-and-kick thud under each hit. */
function drum(context: BaseAudioContext, out: AudioNode, at: number) {
  const body = context.createOscillator();
  body.frequency.setValueAtTime(110, at);
  body.frequency.exponentialRampToValueAtTime(42, at + 0.25);
  const level = context.createGain();
  level.gain.setValueAtTime(0.9, at);
  level.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
  body.connect(level).connect(out);
  body.start(at);
  body.stop(at + 0.5);
}

function cymbal(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  burst(context, out, noise, at, "highpass", 5_000, 0.3, 1.4);
}

/** A filtered slice of noise that decays: pick attack and cymbal wash. */
function burst(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, type: BiquadFilterType, frequency: number, peak: number, length: number) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const level = context.createGain();
  level.gain.setValueAtTime(peak, at);
  level.gain.exponentialRampToValueAtTime(0.001, at + length);
  source.connect(filter).connect(level).connect(out);
  source.start(at);
  source.stop(at + length + 0.05);
}

function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.6), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

/** Decaying stereo noise: the sound of a big, dark room. */
function roomImpulse(context: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
    }
  }
  return buffer;
}

function driveCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    // Asymmetric clipping, like an overdriven valve amp.
    curve[index] = Math.tanh(x * 9) * (x < 0 ? 0.92 : 1);
  }
  return curve;
}
