/**
 * Sound files the host can upload as their own question sound. Kept apart
 * from the image and video rules, and free of server code, so the Control
 * Center can check a file before sending it and the upload route and the
 * media route agree on what each file is.
 */

/** A question sound is a few seconds long: 5 MB is a generous MP3 or a short WAV, and stays quick to load over venue wifi. */
export const AUDIO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Each type a browser may report for a common sound file, and the extension
 * it is stored under. Browsers disagree (Safari says audio/x-m4a, Firefox
 * audio/wave, some audio/mp3), so every spelling is listed.
 */
const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/vnd.wave": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
};

/**
 * The type each stored sound is served as, by extension. One type per
 * extension, the standard one, so a browser decodes it whatever the
 * uploading browser called it. Audio-only WebM is stored as .weba, since
 * .webm is served as video.
 */
export const AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  weba: "audio/webm",
};

/** For the file picker: the types above, plus their extensions for a system that reports none. */
export const AUDIO_ACCEPT = [...Object.keys(AUDIO_TYPES), ...Object.keys(AUDIO_EXTENSIONS).map((extension) => `.${extension}`)].join(",");

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * The standard type of an uploaded sound, or null when it is not one. A file
 * whose type the system left blank (or called a generic download) is taken
 * by its extension instead, so an M4A from a phone still goes through.
 */
export function audioTypeOf(type: string, name: string): string | null {
  const reported = type.toLowerCase().split(";")[0].trim();
  const extension = AUDIO_TYPES[reported];
  if (extension) return AUDIO_EXTENSIONS[extension];
  if (reported && reported !== "application/octet-stream") return null;
  return AUDIO_EXTENSIONS[extensionOf(name)] ?? null;
}

/**
 * The name to store a sound under: its own, with an extension that is served
 * as `type`. A file named for video (an .mp4 that is only sound), or with no
 * extension at all, gets the right one, so every store serves it as audio.
 */
export function audioUploadName(name: string, type: string): string {
  if (AUDIO_EXTENSIONS[extensionOf(name)] === type) return name;
  const extension = Object.keys(AUDIO_EXTENSIONS).find((key) => AUDIO_EXTENSIONS[key] === type) ?? "mp3";
  const base = extensionOf(name) ? name.slice(0, name.lastIndexOf(".")) : name;
  return `${base || "sound"}.${extension}`;
}

/**
 * The file name the host gave an uploaded sound, for the Control Center to
 * show: the last part of its address without the time-and-random prefix the
 * store adds to every upload.
 */
export function uploadedFileName(url: string): string {
  const last = url.split(/[?#]/)[0].split("/").pop() ?? "";
  let name = last;
  try { name = decodeURIComponent(last); } catch { /* shown as stored */ }
  return name.replace(/^[0-9a-z]{8,9}-[0-9a-z]{1,6}-(?=.)/, "") || "your sound";
}
