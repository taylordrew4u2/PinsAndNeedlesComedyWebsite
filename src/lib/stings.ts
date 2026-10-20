/**
 * The stings: the short sounds the projector plays as a new Bad Decision
 * comes up (and with the Intro explainer, and on the Control Center's "Test
 * sound"), so the room knows to look up. The host picks which one.
 *
 * Every one is synthesized on the spot with Web Audio, so there is no audio
 * file to load, cache or license, and each takes any audio context, so a
 * test can render it offline. Each one starts at once (the screen's drum
 * roll is already running), lasts one to four seconds and goes through its
 * own limiter, so it is loud but never clips. They are levelled to about the
 * same loudness as the original doom sting, so switching sounds mid-show
 * doesn't mean reaching for the volume.
 */

export type StingId =
  | "doom"
  | "sad-trombone"
  | "air-horn"
  | "record-scratch"
  | "rimshot"
  | "wrong-buzzer"
  | "ding-ding"
  | "siren"
  | "gong"
  | "dramatic"
  | "boing"
  | "soft-chime";

/** What the host sees when choosing: a short plain name, an emoji and one line on what it sounds like. */
export const STINGS: readonly { id: StingId; label: string; emoji: string; blurb: string }[] = [
  { id: "doom", label: "Doom", emoji: "😈", blurb: "A church bell, then heavy guitar: dun… dun… DUNNN." },
  { id: "sad-trombone", label: "Sad trombone", emoji: "🎺", blurb: "Wah, wah, wah, waaah." },
  { id: "air-horn", label: "Air horn", emoji: "📯", blurb: "Two short blasts and a long one." },
  { id: "record-scratch", label: "Record scratch", emoji: "💿", blurb: "The music stops. Wait, what?" },
  { id: "rimshot", label: "Rimshot", emoji: "🥁", blurb: "Ba-dum, tss." },
  { id: "wrong-buzzer", label: "Wrong buzzer", emoji: "❌", blurb: "The game-show wrong-answer buzz." },
  { id: "ding-ding", label: "Ding ding", emoji: "🛎️", blurb: "Game-show bells: we have a winner." },
  { id: "siren", label: "Siren", emoji: "🚨", blurb: "A short nee-naw alarm." },
  { id: "gong", label: "Gong", emoji: "🔔", blurb: "One big gong that swells and rings out." },
  { id: "dramatic", label: "Dramatic", emoji: "😱", blurb: "The orchestra goes dun, dun, DUNNN." },
  { id: "boing", label: "Boing", emoji: "🦘", blurb: "A cartoon spring: boi-oi-oing." },
  { id: "soft-chime", label: "Soft chime", emoji: "🎐", blurb: "A gentle chime for a quiet room." },
];

/** The sound the show has always had. */
export const DEFAULT_STING: StingId = "doom";

/** True for one of the stings above, so a stored or posted choice can be trusted. */
export function isStingId(value: unknown): value is StingId {
  return typeof value === "string" && STINGS.some((sting) => sting.id === value);
}

/**
 * Plays it on the context at `at` (default context.currentTime), volume
 * 0..1.5 where 1 is as designed, through its own limiter into
 * context.destination. Returns its length in seconds.
 *
 * The volume goes in ahead of the limiter, so turning it up past 1 makes it
 * louder (1.5 is about 3 dB) but can never make it clip. Anything that isn't
 * a sting (a setting saved by an older version, say) plays the default
 * rather than nothing: a silent beat mid-show is worse than the wrong sound.
 *
 * The limiter is two stages. A compressor does the real work, holding the
 * peaks down so it is loud, not painful; but a browser's compressor lets the
 * sharpest peaks through, and turned up it would put the doom sting itself
 * over full scale. So a ceiling after it rounds off anything still over
 * the top. At the designed volume it only grazes the odd drum hit or the
 * buzzer's edges (the doom sting never reaches it); it is there for when a
 * sting is turned up.
 */
export function playSting(context: BaseAudioContext, id: StingId, options: { at?: number; volume?: number } = {}): number {
  const sound = SOUNDS[isStingId(id) ? id : DEFAULT_STING];
  const at = typeof options.at === "number" && Number.isFinite(options.at) ? options.at : context.currentTime;
  const volume = typeof options.volume === "number" && Number.isFinite(options.volume) ? Math.min(1.5, Math.max(0, options.volume)) : 1;
  const master = context.createGain();
  master.gain.value = sound.level * volume;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  // The ceiling's curve covers four times full scale, so the signal goes in at a quarter (exactly, so it is untouched below the knee).
  const scale = gainOf(context, 1 / CEILING_RANGE);
  const ceiling = context.createWaveShaper();
  ceiling.curve = ceilingCurve();
  master.connect(limiter).connect(scale).connect(ceiling).connect(context.destination);
  return sound.play(context, master, at);
}

/** How far over full scale the ceiling can take a peak and still round it off rather than flatten it. */
const CEILING_RANGE = 4;
/** Below this the ceiling passes the sound through untouched; above it, peaks are bent smoothly to stay under {@link CEILING_TOP}. */
const CEILING_KNEE = 0.93;
const CEILING_TOP = 0.99;

let ceilingShape: Float32Array<ArrayBuffer> | undefined;

/** The ceiling's transfer curve: a straight line through the middle, bending over at the knee so no peak can pass the top. Made once; a shaper copies it. */
function ceilingCurve(): Float32Array<ArrayBuffer> {
  if (ceilingShape) return ceilingShape;
  const points = 8_193;
  const curve = new Float32Array(points);
  const room = CEILING_TOP - CEILING_KNEE;
  for (let index = 0; index < points; index += 1) {
    const x = ((index / (points - 1)) * 2 - 1) * CEILING_RANGE;
    const size = Math.abs(x);
    curve[index] = size <= CEILING_KNEE ? x : Math.sign(x) * (CEILING_KNEE + room * Math.tanh((size - CEILING_KNEE) / room));
  }
  ceilingShape = curve;
  return curve;
}

/** Builds one sting into `out` starting at `at`, and says how long it lasts. */
type Play = (context: BaseAudioContext, out: AudioNode, at: number) => number;

/**
 * Each sting, and how hard it goes into its limiter. The doom sting's level
 * is the one it always had; every other level was set by rendering it
 * offline and matching its loudest moment (momentary loudness, the way
 * broadcasters measure it) to the doom sting's, so they all hit the room
 * about as hard. The soft chime sits a couple of decibels under, as befits
 * it.
 */
const SOUNDS: Record<StingId, { level: number; play: Play }> = {
  doom: { level: 0.55, play: doom },
  "sad-trombone": { level: 0.88, play: sadTrombone },
  "air-horn": { level: 0.26, play: airHorn },
  "record-scratch": { level: 0.59, play: recordScratch },
  rimshot: { level: 0.97, play: rimshot },
  "wrong-buzzer": { level: 0.34, play: wrongBuzzer },
  "ding-ding": { level: 0.68, play: dingDing },
  siren: { level: 0.4, play: siren },
  gong: { level: 0.52, play: gong },
  dramatic: { level: 0.56, play: dramatic },
  boing: { level: 0.9, play: boing },
  "soft-chime": { level: 0.41, play: softChime },
};

// ---------------------------------------------------------------------------
// Doom: the original sting, unchanged.

/**
 * Something wicked this way comes. A church bell tolls, then a heavy,
 * down-tuned guitar plays "dun… dun… DUNNN", landing on the tritone (the
 * devil's interval) and left to ring out in a dark room. About three
 * seconds.
 */
function doom(context: BaseAudioContext, out: AudioNode, at: number): number {
  // A dark room: everything is sent to a long, low reverb as well as straight out.
  const room = context.createConvolver();
  room.buffer = roomImpulse(context, 2.6);
  const roomTone = context.createBiquadFilter();
  roomTone.type = "lowpass";
  roomTone.frequency.value = 2_000;
  const roomLevel = context.createGain();
  roomLevel.gain.value = 0.45;
  room.connect(roomTone).connect(roomLevel).connect(out);
  const bus = context.createGain();
  bus.connect(out);
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

// ---------------------------------------------------------------------------
// Sad trombone.

/**
 * Wah, wah, wah, waaah: four muted trombone notes, each a half step lower,
 * the last one held, sagging and wobbling more and more.
 */
function sadTrombone(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 1.4, 3_000, 0.2);
  const noise = noiseBuffer(context);
  // B flat, A, A flat, then G.
  const notes: [start: number, pitch: number, length: number][] = [
    [0, 233.08, 0.34], [0.43, 220, 0.34], [0.86, 207.65, 0.34], [1.29, 196, 1.45],
  ];
  for (const [start, pitch, length] of notes) trombone(context, bus, noise, at + start, pitch, length, length > 1);
  return 3.1;
}

/**
 * One muted trombone note: two buzzing reeds through a plunger mute, a
 * resonant filter that opens as the note starts ("wah") and closes as it
 * ends. The last note's vibrato swings the mute too, which is what makes
 * the final "waaah-ah-ah" so mournful.
 */
function trombone(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, pitch: number, length: number, last: boolean) {
  const end = at + length;
  const mute = filter(context, "lowpass", 300, 6);
  mute.frequency.setValueAtTime(300, at);
  mute.frequency.exponentialRampToValueAtTime(1_600, at + 0.13);
  mute.frequency.setValueAtTime(1_600, end - 0.06);
  mute.frequency.exponentialRampToValueAtTime(350, end + 0.1);
  // The brassy honk of the bell of the horn.
  const honk = filter(context, "peaking", 1_100, 1, 4);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(1, at + 0.03);
  amp.gain.linearRampToValueAtTime(0.75, at + 0.16);
  amp.gain.setValueAtTime(0.75, end);
  amp.gain.linearRampToValueAtTime(0, end + 0.12);
  mute.connect(honk).connect(amp).connect(out);

  const reeds = [-6, 5].map((detune) => {
    const reed = oscillator(context, "sawtooth", pitch, at, end + 0.2, detune);
    // Slides up into the note, the way a lip finds it.
    reed.frequency.setValueAtTime(pitch * 0.94, at);
    reed.frequency.exponentialRampToValueAtTime(pitch, at + 0.08);
    reed.connect(gainOf(context, 0.35)).connect(mute);
    return reed;
  });
  // A puff of breath on each attack.
  burst(context, out, noise, at, "bandpass", 1_400, 0.06, 0.08);
  if (!last) return;

  for (const reed of reeds) {
    reed.frequency.setValueAtTime(pitch, end - 0.45);
    reed.frequency.exponentialRampToValueAtTime(pitch * 0.94, end + 0.12);
  }
  const wobble = oscillator(context, "sine", 5.5, at, end + 0.2);
  const vibrato = context.createGain();
  vibrato.gain.setValueAtTime(0, at + 0.2);
  vibrato.gain.linearRampToValueAtTime(50, end);
  wobble.connect(vibrato);
  for (const reed of reeds) vibrato.connect(reed.detune);
  const wah = context.createGain();
  wah.gain.setValueAtTime(0, at + 0.2);
  wah.gain.linearRampToValueAtTime(700, end);
  wah.gain.linearRampToValueAtTime(0, end + 0.1);
  wobble.connect(wah).connect(mute.frequency);
}

// ---------------------------------------------------------------------------
// Air horn.

/** The note the horn's reeds are tuned around. */
const HORN = 440;

/** BAAP, BAAP, BAAAAAP: a stadium air horn, two short blasts and a long one. */
function airHorn(context: BaseAudioContext, out: AudioNode, at: number): number {
  // The horn's flare: no rumble, a hard bite around 2–3 kHz, nothing fizzy on top.
  const flare = filter(context, "highpass", 220);
  flare
    .connect(filter(context, "peaking", 2_600, 0.8, 6))
    .connect(filter(context, "lowpass", 7_000))
    .connect(out);
  const blasts: [start: number, length: number][] = [[0, 0.16], [0.25, 0.16], [0.5, 1.05]];
  for (const [start, length] of blasts) hornBlast(context, flare, at + start, length);
  return 1.65;
}

/**
 * One blast: a stack of slightly out-of-tune reeds (a chord, really) driven
 * into distortion. Each blast scoops up to pitch as the air arrives, and the
 * long one sags as the can runs out.
 */
function hornBlast(context: BaseAudioContext, out: AudioNode, at: number, length: number) {
  const end = at + length;
  const drive = context.createWaveShaper();
  drive.curve = softClip(3);
  const amp = context.createGain();
  hold(amp.gain, at, 0.01, 1, end, 0.04);
  drive.connect(amp).connect(out);
  const reeds: [ratio: number, detune: number, share: number][] = [
    [1, 0, 0.3], [1, 12, 0.25], [1, -10, 0.25], [1.26, 5, 0.18], [1.26, -7, 0.18], [0.5, 0, 0.2],
  ];
  for (const [ratio, detune, share] of reeds) {
    const pitch = HORN * ratio;
    const reed = oscillator(context, "sawtooth", pitch, at, end + 0.08, detune);
    reed.frequency.setValueAtTime(pitch * 0.8, at);
    reed.frequency.exponentialRampToValueAtTime(pitch, at + 0.05);
    if (length > 0.5) {
      reed.frequency.setValueAtTime(pitch, end - 0.15);
      reed.frequency.exponentialRampToValueAtTime(pitch * 0.96, end + 0.04);
    }
    reed.connect(gainOf(context, share)).connect(drive);
  }
}

// ---------------------------------------------------------------------------
// Record scratch.

/** How long the scratch itself runs, in seconds. */
const SCRATCH_LENGTH = 1;

/** The hand's quick back-and-forth strokes: when each starts, how long it lasts and how fast it goes at its height (1 is normal speed, negative is backwards). */
const STROKES: [start: number, length: number, speed: number][] = [
  [0, 0.1, 2.4], [0.1, 0.09, -2], [0.19, 0.08, 2.6], [0.27, 0.09, -2.2],
];
/** Then one long drag backwards that slows to a dead stop. */
const DRAG: [start: number, length: number, speed: number] = [0.38, 0.55, -3];

/**
 * The needle drags across the record: wicka-wicka, zzzzip, silence. A
 * record played at the wrong speed is just its sound sped up, slowed down
 * or reversed, so this works out what the record would say at each moment
 * of a scratch, sample by sample, rather than bending a live oscillator.
 */
function recordScratch(context: BaseAudioContext, out: AudioNode, at: number): number {
  const record = context.createBufferSource();
  record.buffer = scratchBuffer(context);
  // Cut the rumble a slow-moving stylus makes, keep the rasp.
  record.connect(filter(context, "highpass", 100)).connect(out);
  record.start(at);
  record.stop(at + SCRATCH_LENGTH + 0.05);
  return 1;
}

/** How fast the record turns `time` seconds into the scratch: nought between strokes, 1 at normal speed, negative backwards. */
function handSpeed(time: number): number {
  for (const [start, length, speed] of STROKES) {
    if (time >= start && time < start + length) return speed * Math.sin((Math.PI * (time - start)) / length);
  }
  const [start, length, speed] = DRAG;
  if (time >= start && time < start + length) {
    const through = (time - start) / length;
    return speed * Math.min(1, through * 12) * (1 - through) ** 2;
  }
  return 0;
}

/**
 * The scratched record, as a buffer. What's on the record is a sung "ahh"
 * (a buzz shaped by the formants of an open mouth, the classic thing to
 * scratch) over the hiss of the groove. Each harmonic is dropped before it
 * would go past what the context can play, so fast strokes don't alias.
 */
function scratchBuffer(context: BaseAudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(rate * SCRATCH_LENGTH), rate);
  const data = buffer.getChannelData(0);

  const voice = 150;
  const formants: [frequency: number, width: number, gain: number][] = [[730, 100, 1], [1_090, 120, 0.7], [2_440, 170, 0.35], [3_400, 250, 0.2]];
  const harmonics = Math.floor(5_000 / voice);
  const loudness = new Float64Array(harmonics + 1);
  for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
    let shape = 0.03;
    for (const [frequency, width, gain] of formants) shape += gain / (1 + ((harmonic * voice - frequency) / (width / 2)) ** 2);
    loudness[harmonic] = shape / harmonic;
  }
  const groove = new Float32Array(rate);
  for (let index = 0; index < groove.length; index += 1) groove[index] = Math.random() * 2 - 1;

  const ceiling = rate * 0.45;
  let position = 0.3;
  let peak = 0;
  for (let index = 0; index < data.length; index += 1) {
    const speed = handSpeed(index / rate);
    position += speed / rate;
    const pace = Math.abs(speed);
    // Every harmonic at once: sin(kθ) by the recurrence sin((k+1)θ) = 2cos θ·sin kθ − sin((k−1)θ).
    const angle = 2 * Math.PI * voice * position;
    const twice = 2 * Math.cos(angle);
    let previous = 0;
    let current = Math.sin(angle);
    let sample = 0;
    for (let harmonic = 1; harmonic <= harmonics && harmonic * voice * pace < ceiling; harmonic += 1) {
      sample += loudness[harmonic] * current;
      const next = twice * current - previous;
      previous = current;
      current = next;
    }
    const spot = (((position * rate) % groove.length) + groove.length) % groove.length;
    const low = Math.floor(spot);
    const hiss = groove[low] + (groove[(low + 1) % groove.length] - groove[low]) * (spot - low);
    // Hardly moving, it hardly makes a sound: fade in and out with the speed, so strokes don't click.
    const value = (sample + hiss * 0.12) * Math.min(1, pace / 0.3);
    data[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak > 0) for (let index = 0; index < data.length; index += 1) data[index] *= 0.9 / peak;
  return buffer;
}

// ---------------------------------------------------------------------------
// Rimshot.

/** Ba-dum, tss: snare, tom, then a splash cymbal over a kick. */
function rimshot(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 0.9, 6_000, 0.12);
  const noise = noiseBuffer(context);
  snare(context, bus, noise, at);
  tom(context, bus, noise, at + 0.17);
  kick(context, bus, at + 0.44);
  splash(context, bus, noise, at + 0.44);
  return 1.3;
}

/** The wires' hiss, brightest at the hit, over a short knock of the shell dropping a little in pitch. */
function snare(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  burst(context, out, noise, at, "highpass", 1_800, 0.7, 0.2);
  const shell = oscillator(context, "triangle", 230, at, at + 0.2);
  shell.frequency.setValueAtTime(230, at);
  shell.frequency.exponentialRampToValueAtTime(170, at + 0.08);
  const level = context.createGain();
  strike(level.gain, at, 0.002, 0.8, at + 0.15);
  shell.connect(level).connect(out);
}

/** A round, low "dum" that sinks as it rings. */
function tom(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  const head = oscillator(context, "sine", 165, at, at + 0.55);
  head.frequency.setValueAtTime(165, at);
  head.frequency.exponentialRampToValueAtTime(105, at + 0.25);
  const level = context.createGain();
  strike(level.gain, at, 0.002, 1, at + 0.5);
  head.connect(level).connect(out);
  burst(context, out, noise, at, "lowpass", 1_500, 0.25, 0.05);
}

function kick(context: BaseAudioContext, out: AudioNode, at: number) {
  const body = oscillator(context, "sine", 130, at, at + 0.45);
  body.frequency.setValueAtTime(130, at);
  body.frequency.exponentialRampToValueAtTime(45, at + 0.15);
  const level = context.createGain();
  strike(level.gain, at, 0.002, 1, at + 0.4);
  body.connect(level).connect(out);
}

/** "Tss": six clashing square waves, the way the old drum machines made cymbals, kept only up high, with a hiss. */
function splash(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number) {
  const high = filter(context, "highpass", 7_000);
  const level = context.createGain();
  strike(level.gain, at, 0.002, 0.35, at + 0.9);
  high.connect(level).connect(out);
  for (const pitch of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    oscillator(context, "square", pitch, at, at + 0.95).connect(gainOf(context, 0.2)).connect(high);
  }
  burst(context, out, noise, at, "highpass", 8_000, 0.25, 0.7);
}

// ---------------------------------------------------------------------------
// Wrong buzzer.

/**
 * The game-show "wrong!" buzz: two low square waves a half step apart, so
 * they grind against each other, clipped and squeezed through a cheap
 * speaker, with the rattle of an electric buzzer.
 */
function wrongBuzzer(context: BaseAudioContext, out: AudioNode, at: number): number {
  const end = at + 1;
  const drive = context.createWaveShaper();
  drive.curve = softClip(4);
  const amp = context.createGain();
  hold(amp.gain, at, 0.006, 1, end, 0.04);
  const rattle = gainOf(context, 0.75);
  const buzz = oscillator(context, "square", 30, at, end + 0.1);
  buzz.connect(gainOf(context, 0.25)).connect(rattle.gain);
  // A cheap speaker: no deep bass, an ugly honk around 1 kHz, nothing sweet on top.
  drive
    .connect(filter(context, "highpass", 110))
    .connect(filter(context, "peaking", 1_000, 1.2, 8))
    .connect(filter(context, "lowpass", 3_500))
    .connect(amp)
    .connect(rattle)
    .connect(out);
  const tones: [type: OscillatorType, pitch: number, share: number][] = [["square", 110, 0.4], ["square", 116.54, 0.4], ["sawtooth", 55, 0.3]];
  for (const [type, pitch, share] of tones) oscillator(context, type, pitch, at, end + 0.1).connect(gainOf(context, share)).connect(drive);
  return 1.1;
}

// ---------------------------------------------------------------------------
// Ding ding.

/** Ding, ding, ding… DING! Three quick strikes of a bright little bell, then a higher one left to ring: the winner's bell. */
function dingDing(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 1.4, 9_000, 0.18);
  const noise = noiseBuffer(context);
  const C6 = 1_046.5;
  const G6 = 1_568;
  const dings: [start: number, pitch: number, ring: number][] = [[0, C6, 0.6], [0.15, C6, 0.6], [0.3, C6, 0.6], [0.5, G6, 1.6]];
  for (const [start, pitch, ring] of dings) ding(context, bus, noise, at + start, pitch, ring);
  return 2;
}

/** A small bright bell: the partials of a struck bar, the high ones dying first, and two at the bottom a hair apart so it shimmers. */
function ding(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, pitch: number, ring: number) {
  const partials: [ratio: number, share: number, decay: number][] = [[1, 0.5, 1], [1.003, 0.3, 1], [2.76, 0.22, 0.5], [5.4, 0.1, 0.25], [8.93, 0.05, 0.12]];
  for (const [ratio, share, decay] of partials) {
    const tone = oscillator(context, "sine", pitch * ratio, at, at + ring * decay + 0.05);
    const level = context.createGain();
    strike(level.gain, at, 0.0015, share, at + ring * decay);
    tone.connect(level).connect(out);
  }
  // The clapper's tick.
  burst(context, out, noise, at, "highpass", 7_000, 0.12, 0.012);
}

// ---------------------------------------------------------------------------
// Siren.

/** Nee-naw, nee-naw: a short two-tone alarm through a horn speaker. */
function siren(context: BaseAudioContext, out: AudioNode, at: number): number {
  const high = 880;
  const low = 660;
  const step = 0.4;
  const calls = 4;
  const end = at + step * calls;
  const amp = context.createGain();
  hold(amp.gain, at, 0.012, 1, end, 0.06);
  const horn = filter(context, "lowpass", 3_800);
  horn.connect(filter(context, "peaking", 1_600, 1, 4)).connect(amp).connect(out);
  for (const type of ["square", "sawtooth"] as const) {
    const tone = oscillator(context, type, high, at, end + 0.1);
    tone.frequency.setValueAtTime(high, at);
    for (let call = 1; call < calls; call += 1) {
      const [from, to] = call % 2 ? [high, low] : [low, high];
      // A quick slide between the two notes, not a jump: a real siren can't change pitch instantly.
      tone.frequency.setValueAtTime(from, at + call * step - 0.03);
      tone.frequency.exponentialRampToValueAtTime(to, at + call * step);
    }
    tone.connect(gainOf(context, 0.3)).connect(horn);
  }
  return 1.7;
}

// ---------------------------------------------------------------------------
// Gong.

/** The gong's partials, as multiples of its lowest note: unevenly spaced, as metal plates ring. */
const GONG_PARTIALS = [
  1, 1.52, 1.97, 2.48, 2.97, 3.53, 4.07, 4.68, 5.31, 6.02, 6.83, 7.66, 8.71, 9.84, 11.2, 12.7, 14.5, 16.6, 19.1, 22, 25.4, 29.3, 33.8, 39,
];

/**
 * One big gong. A soft, deep mallet thump, then the plate: its low partials
 * sound at once and hang on, while the high ones bloom a moment later and
 * fade first, which is the swell a gong is known for, with a hiss up top
 * that swells along with them. Left to ring out in a big hall.
 */
function gong(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 3.4, 4_000, 0.4);
  const noise = noiseBuffer(context);
  const thump = oscillator(context, "sine", 80, at, at + 0.8);
  thump.frequency.setValueAtTime(80, at);
  thump.frequency.exponentialRampToValueAtTime(52, at + 0.5);
  const thumpLevel = context.createGain();
  strike(thumpLevel.gain, at, 0.005, 0.7, at + 0.7);
  thump.connect(thumpLevel).connect(bus);
  burst(context, bus, noise, at, "lowpass", 700, 0.3, 0.25);

  const root = 66;
  GONG_PARTIALS.forEach((ratio, index) => {
    const height = index / (GONG_PARTIALS.length - 1);
    const peak = 0.2 / (1 + index * 0.05);
    const bloom = 0.006 + height ** 1.2 * 1.1;
    const gone = at + 3.85 - height * 1.9;
    // Each partial is a pair a few cents apart, so the plate shimmers.
    for (const detune of [-4, 4]) {
      const tone = oscillator(context, "sine", root * ratio, at, gone + 0.1, detune);
      const level = context.createGain();
      ring(level.gain, at, bloom, peak, gone, 0.01);
      tone.connect(level).connect(bus);
    }
  });

  const wash = context.createBufferSource();
  wash.buffer = noise;
  wash.loop = true;
  const washLevel = context.createGain();
  strike(washLevel.gain, at, 0.8, 0.12, at + 3.4);
  wash.connect(filter(context, "bandpass", 3_200, 0.6)).connect(washLevel).connect(bus);
  wash.start(at);
  wash.stop(at + 3.5);
  return 4;
}

// ---------------------------------------------------------------------------
// Dramatic.

/**
 * The orchestra's "dun, dun, DUNNN!": brass and strings stab G, then A flat,
 * then crash down onto a held F sharp minor chord with the strings
 * trembling, timpani under every hit and a bass drum under the last, in a
 * concert hall.
 */
function dramatic(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 2.4, 5_000, 0.32);
  const noise = noiseBuffer(context);
  const hits: [start: number, chord: number[], length: number, drum: number][] = [
    [0, [98, 146.83, 196, 293.66], 0.2, 98],
    [0.3, [103.83, 155.56, 207.65, 311.13], 0.2, 103.83],
    [0.6, [92.5, 138.59, 185, 220, 277.18], 1.5, 92.5],
  ];
  for (const [start, chord, length, drum] of hits) {
    const last = length > 1;
    brass(context, bus, at + start, chord, length, last);
    strings(context, bus, at + start, chord, length, last);
    timpani(context, bus, noise, at + start, drum, last ? 2.2 : 0.7, last ? 1 : 0.7);
  }
  const boom = oscillator(context, "sine", 65, at + 0.6, at + 1.85);
  boom.frequency.setValueAtTime(65, at + 0.6);
  boom.frequency.exponentialRampToValueAtTime(38, at + 1.2);
  const boomLevel = context.createGain();
  strike(boomLevel.gain, at + 0.6, 0.004, 0.9, at + 1.8);
  boom.connect(boomLevel).connect(bus);
  return 3.3;
}

/** A brass section on one chord. Brass gets brighter the harder it's blown, so the tone opens with the attack, then settles. */
function brass(context: BaseAudioContext, out: AudioNode, at: number, chord: number[], length: number, last: boolean) {
  const end = at + length;
  const release = last ? 0.6 : 0.1;
  const tone = filter(context, "lowpass", 500, 1.2);
  tone.frequency.setValueAtTime(500, at);
  tone.frequency.exponentialRampToValueAtTime(3_500, at + 0.035);
  tone.frequency.setTargetAtTime(last ? 1_100 : 1_800, at + 0.05, last ? 0.6 : 0.08);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(1, at + 0.012);
  amp.gain.linearRampToValueAtTime(0.75, at + 0.12);
  amp.gain.setValueAtTime(0.75, end);
  amp.gain.linearRampToValueAtTime(0, end + release);
  tone.connect(amp).connect(out);
  for (const pitch of chord) {
    for (const detune of [-5, 6]) {
      oscillator(context, "sawtooth", pitch, at, end + release + 0.05, detune).connect(gainOf(context, 0.12)).connect(tone);
    }
  }
}

/** A string section an octave above the brass, three players to a note. On the held chord the bows tremble: the sound of dread. */
function strings(context: BaseAudioContext, out: AudioNode, at: number, chord: number[], length: number, last: boolean) {
  const end = at + length;
  const release = last ? 0.7 : 0.12;
  const tone = filter(context, "lowpass", 3_200);
  const amp = context.createGain();
  hold(amp.gain, at, 0.02, 1, end, release);
  tone.connect(filter(context, "highpass", 180)).connect(amp);
  if (last) {
    const tremble = gainOf(context, 0.7);
    const bows = oscillator(context, "triangle", 9, at, end + release + 0.05);
    bows.connect(gainOf(context, 0.3)).connect(tremble.gain);
    amp.connect(tremble).connect(out);
  } else {
    amp.connect(out);
  }
  for (const pitch of chord) {
    for (const detune of [-11, 0, 10]) {
      oscillator(context, "sawtooth", pitch * 2, at, end + release + 0.05, detune).connect(gainOf(context, last ? 0.06 : 0.045)).connect(tone);
    }
  }
}

/** A timpani hit: struck hard the head goes a touch sharp, then settles, with the felt mallet's thud on top. */
function timpani(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, pitch: number, ring: number, peak: number) {
  const modes: [ratio: number, share: number][] = [[1, 1], [1.5, 0.4], [1.98, 0.25]];
  for (const [ratio, share] of modes) {
    const head = oscillator(context, "sine", pitch * ratio, at, at + ring + 0.05);
    head.frequency.setValueAtTime(pitch * ratio * 1.03, at);
    head.frequency.exponentialRampToValueAtTime(pitch * ratio, at + 0.08);
    const level = context.createGain();
    strike(level.gain, at, 0.003, peak * share * 0.8, at + ring * (ratio === 1 ? 1 : 0.6));
    head.connect(level).connect(out);
  }
  burst(context, out, noise, at, "lowpass", 1_000, 0.3 * peak, 0.06);
}

// ---------------------------------------------------------------------------
// Boing.

/**
 * A cartoon spring: b-oi-oi-oi-oing. A twangy tone leaps up to pitch, then
 * wobbles wildly, the wobble dying away as the spring settles, after the
 * knock of it being let go.
 */
function boing(context: BaseAudioContext, out: AudioNode, at: number): number {
  const end = at + 1.1;
  const amp = context.createGain();
  ring(amp.gain, at, 0.004, 1, end, 0.03);
  amp.connect(out);
  const wobble = oscillator(context, "sine", 15, at, end + 0.1);
  wobble.frequency.setValueAtTime(15, at);
  wobble.frequency.linearRampToValueAtTime(11, end);
  // How far it wobbles, in cents: wide at first, settling to nothing.
  const depth = context.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(320, at + 0.06);
  depth.gain.exponentialRampToValueAtTime(8, end);
  wobble.connect(depth);
  const twang = filter(context, "lowpass", 1_400, 5);
  twang.connect(amp);
  const voices: [type: OscillatorType, share: number, into: AudioNode][] = [["triangle", 0.8, amp], ["sawtooth", 0.25, twang]];
  for (const [type, share, into] of voices) {
    const spring = oscillator(context, type, 330, at, end + 0.1);
    spring.frequency.setValueAtTime(150, at);
    spring.frequency.exponentialRampToValueAtTime(330, at + 0.07);
    depth.connect(spring.detune);
    spring.connect(gainOf(context, share)).connect(into);
  }
  const knock = oscillator(context, "sine", 220, at, at + 0.1);
  knock.frequency.setValueAtTime(220, at);
  knock.frequency.exponentialRampToValueAtTime(70, at + 0.05);
  const knockLevel = context.createGain();
  strike(knockLevel.gain, at, 0.002, 0.6, at + 0.08);
  knock.connect(knockLevel).connect(out);
  return 1.2;
}

// ---------------------------------------------------------------------------
// Soft chime.

/** C, E, G, rising, each left to ring: a gentle "here comes one" for a quiet room. */
function softChime(context: BaseAudioContext, out: AudioNode, at: number): number {
  const bus = inRoom(context, out, 2, 3_500, 0.3);
  const notes: [start: number, pitch: number][] = [[0, 523.25], [0.26, 659.25], [0.52, 783.99]];
  for (const [start, pitch] of notes) chime(context, bus, at + start, pitch, 1.9);
  return 2.6;
}

/** A soft mallet on a tuned bar: nearly pure, with a quiet octave and twelfth that fade first, and a twin a hair sharp so it breathes. */
function chime(context: BaseAudioContext, out: AudioNode, at: number, pitch: number, seconds: number) {
  const warm = filter(context, "lowpass", 3_000);
  warm.connect(out);
  const partials: [ratio: number, share: number, length: number][] = [[1, 0.5, 1], [1.002, 0.25, 1], [2, 0.12, 0.5], [3, 0.04, 0.3]];
  for (const [ratio, share, length] of partials) {
    const bar = oscillator(context, "sine", pitch * ratio, at, at + seconds * length + 0.1);
    const level = context.createGain();
    ring(level.gain, at, 0.008, share, at + seconds * length, 0.01);
    bar.connect(level).connect(warm);
  }
}

// ---------------------------------------------------------------------------
// Shared pieces.

function oscillator(context: BaseAudioContext, type: OscillatorType, frequency: number, at: number, end: number, detune = 0): OscillatorNode {
  const node = context.createOscillator();
  node.type = type;
  node.frequency.value = frequency;
  node.detune.value = detune;
  node.start(at);
  node.stop(end);
  return node;
}

function gainOf(context: BaseAudioContext, value: number): GainNode {
  const node = context.createGain();
  node.gain.value = value;
  return node;
}

function filter(context: BaseAudioContext, type: BiquadFilterType, frequency: number, q?: number, gain?: number): BiquadFilterNode {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  if (q !== undefined) node.Q.value = q;
  if (gain !== undefined) node.gain.value = gain;
  return node;
}

/** Anything struck or plucked: silent at `at`, up to `peak` over `attack` seconds, then dying away to nothing by `end`. */
function strike(param: AudioParam, at: number, attack: number, peak: number, end: number) {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(0.0001, end);
}

/**
 * Like {@link strike}, for something that rings on: it dies away only to
 * `quiet` (a fraction of the peak) by `end`, then fades out over a moment.
 * Dying all the way to nothing sounds clipped short, because the last
 * stretch of a natural decay is the part still heard in the room.
 */
function ring(param: AudioParam, at: number, attack: number, peak: number, end: number, quiet: number) {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(peak * quiet, end);
  param.linearRampToValueAtTime(0, end + 0.05);
}

/** Anything blown or held: up to `peak` over `attack` seconds, steady until `until`, then off over `release`. */
function hold(param: AudioParam, at: number, attack: number, peak: number, until: number, release: number) {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.setValueAtTime(peak, until);
  param.linearRampToValueAtTime(0, until + release);
}

/** Sends sounds both straight out and into a room of the given length and brightness; returns where to plug them in. */
function inRoom(context: BaseAudioContext, out: AudioNode, seconds: number, brightness: number, wet: number): AudioNode {
  const bus = context.createGain();
  bus.connect(out);
  const room = context.createConvolver();
  room.buffer = roomImpulse(context, seconds);
  bus.connect(room).connect(filter(context, "lowpass", brightness)).connect(gainOf(context, wet)).connect(out);
  return bus;
}

/** A filtered slice of noise that decays: pick attack and cymbal wash. */
function burst(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, at: number, type: BiquadFilterType, frequency: number, peak: number, length: number) {
  const source = context.createBufferSource();
  source.buffer = noise;
  const band = context.createBiquadFilter();
  band.type = type;
  band.frequency.value = frequency;
  const level = context.createGain();
  level.gain.setValueAtTime(peak, at);
  level.gain.exponentialRampToValueAtTime(0.001, at + length);
  source.connect(band).connect(level).connect(out);
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

/** Gentler, even clipping: rounds off the peaks of a horn or buzzer so it rasps rather than fizzes. */
function softClip(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}
