/**
 * The sting that plays with the Bad Decision intro, built to cut through a
 * loud room: a pick scrape, a crash and a distorted power-chord
 * "dun-dun-DUN" over a kick, then a rimshot ("ba-dum-tss") for the laugh.
 * About two and a half seconds, synthesized on the spot so there is no audio
 * file to load or license. A compressor caps the peaks so it is loud, not
 * painful.
 *
 * Takes any audio context, so a test can render it offline.
 */
export function playIntroSound(context: BaseAudioContext, at = context.currentTime): number {
  const master = context.createGain();
  master.gain.setValueAtTime(0, at);
  master.gain.linearRampToValueAtTime(0.6, at + 0.005);
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.002;
  master.connect(limiter).connect(context.destination);

  const noise = noiseBuffer(context);
  const E2 = 82.41;
  const G2 = 98;
  const A2 = 110;

  // A pick dragged down the strings: the "here it comes" before the first hit.
  scrape(context, master, noise, at);
  const hit = at + 0.28;
  cymbal(context, master, noise, hit, 0.9);

  // The riff: two quick stabs, a step up, and a held chord that sags flat at the end.
  const riff: [start: number, root: number, length: number, sag?: boolean][] = [
    [0, E2, 0.13],
    [0.17, E2, 0.13],
    [0.34, G2, 0.13],
    [0.51, A2, 0.62, true],
  ];
  for (const [start, root, length, sag] of riff) {
    powerChord(context, master, hit + start, root, length, sag);
    kick(context, master, hit + start);
  }
  snare(context, master, noise, hit + 0.51);

  // The rimshot.
  const rim = hit + 1.32;
  tom(context, master, rim, 196, 0.12);
  tom(context, master, rim + 0.16, 147, 0.16);
  cymbal(context, master, noise, rim + 0.36);

  return 2.5;
}

/** Root, fifth and octave through a soft-clipping drive: a guitar playing a power chord. */
function powerChord(context: BaseAudioContext, out: AudioNode, at: number, root: number, length: number, sag = false) {
  const drive = context.createWaveShaper();
  drive.curve = driveCurve();
  drive.oversample = "4x";
  const tone = context.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4_200;
  const level = context.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(0.42, at + 0.004);
  level.gain.setTargetAtTime(0.26, at + 0.05, 0.1);
  level.gain.setTargetAtTime(0, at + length, 0.05);
  drive.connect(tone).connect(level).connect(out);

  for (const [ratio, detune] of [[1, -9], [1.5, 6], [2, 11], [3, -5]]) {
    const voice = context.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(root * ratio, at);
    voice.detune.value = detune;
    // The held chord droops at the end, for the joke.
    if (sag) {
      // A wobble, then a long sad-trombone droop.
      const wobble = context.createOscillator();
      wobble.frequency.value = 6;
      const depth = context.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(root * ratio * 0.03, at + length - 0.3);
      wobble.connect(depth).connect(voice.frequency);
      wobble.start(at);
      wobble.stop(at + length + 0.4);
      voice.frequency.setTargetAtTime(root * ratio * 0.7, at + length - 0.3, 0.18);
    }
    const gain = context.createGain();
    gain.gain.value = 0.5;
    voice.connect(gain).connect(drive);
    voice.start(at);
    voice.stop(at + length + 0.4);
  }
}

function kick(context: BaseAudioContext, out: AudioNode, at: number) {
  const body = context.createOscillator();
  body.frequency.setValueAtTime(140, at);
  body.frequency.exponentialRampToValueAtTime(48, at + 0.12);
  const level = context.createGain();
  level.gain.setValueAtTime(0.7, at);
  level.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
  body.connect(level).connect(out);
  body.start(at);
  body.stop(at + 0.25);
}

function snare(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  burst(context, out, noise, at, "bandpass", 1_800, 0.35, 0.16);
}

function tom(context: BaseAudioContext, out: AudioNode, at: number, pitch: number, length: number) {
  const body = context.createOscillator();
  body.frequency.setValueAtTime(pitch, at);
  body.frequency.exponentialRampToValueAtTime(pitch * 0.7, at + length);
  const level = context.createGain();
  level.gain.setValueAtTime(0.55, at);
  level.gain.exponentialRampToValueAtTime(0.001, at + length + 0.08);
  body.connect(level).connect(out);
  body.start(at);
  body.stop(at + length + 0.1);
  burst(context, out, noiseBuffer(context), at, "bandpass", 2_500, 0.12, 0.04);
}

function cymbal(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, length = 0.5) {
  burst(context, out, noise, at, "highpass", 6_000, 0.4, length);
}

/** A rising, scratchy sweep of filtered noise, like a pick scraped along a wound string. */
function scrape(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.exponentialRampToValueAtTime(5_000, at + 0.26);
  const level = context.createGain();
  level.gain.setValueAtTime(0.05, at);
  level.gain.linearRampToValueAtTime(0.9, at + 0.24);
  level.gain.linearRampToValueAtTime(0, at + 0.28);
  source.connect(filter).connect(level).connect(out);
  source.start(at);
  source.stop(at + 0.3);
}

/** A filtered slice of noise that decays: the body of snares, stick hits and cymbals. */
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
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 1), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function driveCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 14);
  }
  return curve;
}
