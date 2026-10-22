/**
 * The question sounds: the short sounds the projector plays as a new Bad
 * Decision comes up (and with the Intro explainer, and on the Control
 * Center's "Test sound"), so the room knows to look up. The host picks which
 * one.
 *
 * Every one is a real recording, public domain (CC0, from freesound.org:
 * public/sounds/question/CREDITS.txt says whose), and chosen so it never
 * startles a room: no horns, sirens, buzzers or bangs, nothing that jumps
 * out of silence at full blast. Each was trimmed to one to four seconds,
 * given a short fade-in and levelled to the same loudness (-20 LUFS, peaks
 * under -4 dBTP), so switching sounds mid-show doesn't mean reaching for the
 * volume.
 */

export type SoundId =
  | "desk-bell" | "triangle" | "wind-chimes" | "sparkle-chimes" | "music-box" | "kalimba" | "xylophone" | "toy-xylophone"
  | "harp" | "dream-harp" | "piano-sweep"
  | "rimshot" | "drum-roll" | "bongos" | "cowbell"
  | "slide-whistle" | "boing" | "wood-blocks" | "ukulele" | "guitar" | "whoosh"
  | "ooh" | "gameshow-ooh" | "big-ooh" | "aww" | "chuckle" | "applause";

export type SoundGroup = "Bells and chimes" | "Instruments" | "Drums" | "Playful" | "Crowd";

/** What the host sees when choosing: a short plain name, an emoji, one line on what it sounds like, and where it sits in the list. */
export const QUESTION_SOUNDS: readonly { id: SoundId; label: string; emoji: string; blurb: string; group: SoundGroup }[] = [
  { id: "ooh", label: "Ooooh", emoji: "😮", blurb: "A small crowd going “ooooh” together.", group: "Crowd" },
  { id: "gameshow-ooh", label: "Game-show ooh", emoji: "📺", blurb: "The studio audience: “oooooh!”", group: "Crowd" },
  { id: "big-ooh", label: "Big ooh", emoji: "🏟️", blurb: "A big crowd’s “ooooh” that builds slowly.", group: "Crowd" },
  { id: "aww", label: "Awww", emoji: "🥺", blurb: "A warm, sympathetic “awww”.", group: "Crowd" },
  { id: "chuckle", label: "Chuckle", emoji: "😄", blurb: "A room chuckling softly.", group: "Crowd" },
  { id: "applause", label: "Applause", emoji: "👏", blurb: "Polite applause that patters in.", group: "Crowd" },
  { id: "desk-bell", label: "Desk bell", emoji: "🛎️", blurb: "One soft ding that rings out: order up.", group: "Bells and chimes" },
  { id: "triangle", label: "Triangle", emoji: "🔺", blurb: "One gentle ding with a long, pure ring.", group: "Bells and chimes" },
  { id: "wind-chimes", label: "Wind chimes", emoji: "🎐", blurb: "A soft shimmer that swells in and fades.", group: "Bells and chimes" },
  { id: "sparkle-chimes", label: "Sparkle chimes", emoji: "✨", blurb: "A hand swept across bar chimes.", group: "Bells and chimes" },
  { id: "music-box", label: "Music box", emoji: "🎶", blurb: "A twinkly music-box run, low to high.", group: "Bells and chimes" },
  { id: "kalimba", label: "Kalimba", emoji: "🎵", blurb: "A thumb-piano run that rings out.", group: "Instruments" },
  { id: "xylophone", label: "Xylophone ta-da", emoji: "🎼", blurb: "A quick run of notes going up.", group: "Instruments" },
  { id: "toy-xylophone", label: "Toy xylophone", emoji: "🧸", blurb: "A mallet swiped up a child’s xylophone.", group: "Instruments" },
  { id: "harp", label: "Harp", emoji: "😇", blurb: "A warm harp flourish going up.", group: "Instruments" },
  { id: "dream-harp", label: "Dream sequence", emoji: "💭", blurb: "A hand swept up a piano’s strings, like a harp.", group: "Instruments" },
  { id: "piano-sweep", label: "Piano sweep", emoji: "🎹", blurb: "A real piano glissando, sweeping up.", group: "Instruments" },
  { id: "ukulele", label: "Ukulele ta-da", emoji: "🌺", blurb: "Two cheerful strums: ta-daa.", group: "Instruments" },
  { id: "guitar", label: "Guitar strum", emoji: "🎸", blurb: "One slow acoustic strum that rings out.", group: "Instruments" },
  { id: "rimshot", label: "Rimshot", emoji: "🥁", blurb: "Ba-dum-tss, softly, on brushes.", group: "Drums" },
  { id: "drum-roll", label: "Drum roll", emoji: "🪘", blurb: "A brush roll that builds into a soft cymbal swell.", group: "Drums" },
  { id: "bongos", label: "Bongos", emoji: "🌴", blurb: "A quick bongo roll and one last bop.", group: "Drums" },
  { id: "cowbell", label: "Cowbell", emoji: "🐄", blurb: "Two light taps: tonk-tonk.", group: "Drums" },
  { id: "slide-whistle", label: "Slide whistle", emoji: "🎈", blurb: "One smooth slide up: wheee.", group: "Playful" },
  { id: "boing", label: "Boing", emoji: "🦘", blurb: "A cartoon boing, on a real jaw harp.", group: "Playful" },
  { id: "wood-blocks", label: "Wood blocks", emoji: "🪵", blurb: "Two temple blocks: tik-tok.", group: "Playful" },
  { id: "whoosh", label: "Whoosh", emoji: "💨", blurb: "A soft, airy swoosh.", group: "Playful" },
];

/** The groups in the order the list shows them. */
export const SOUND_GROUPS: readonly SoundGroup[] = ["Crowd", "Bells and chimes", "Instruments", "Drums", "Playful"];

/** A small crowd's "ooooh": the room reacting to a bad decision, and it swells in rather than jumping out. */
export const DEFAULT_SOUND: SoundId = "ooh";

/** True for one of the sounds above, so a stored or posted choice can be trusted. */
export function isSoundId(value: unknown): value is SoundId {
  return typeof value === "string" && QUESTION_SOUNDS.some((sound) => sound.id === value);
}

/** Where a sound's recording is served from. */
export function soundFile(id: SoundId): string {
  return `/sounds/question/${id}.mp3`;
}
