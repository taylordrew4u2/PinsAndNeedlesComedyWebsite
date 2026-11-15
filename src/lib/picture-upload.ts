/**
 * The host's own picture in a QR code's place: the checks before it goes up
 * and the sums for shrinking it. The Control Center draws the picture on a
 * canvas at the size `shrunkSize` gives and saves it as `pictureType` says,
 * so a 12 MB phone photo goes up as a few hundred KB that still looks sharp
 * on a TV. Pure, so the rules are tested; QrChooser.tsx does the drawing.
 */
import { QR_IMAGE_MAX_PX, fitWithin } from "./screen-qr.ts";

/**
 * The biggest file the Control Center will try to shrink. Past this a phone
 * can run out of memory drawing it, and no screenshot or saved photo is this
 * big: it is a camera's raw file, or not a picture at all.
 */
export const PICTURE_MAX_BYTES = 20 * 1024 * 1024;

/** How sharp a photo is kept: high enough that edges and text stay crisp on a TV, low enough to stay small. */
export const JPEG_QUALITY = 0.88;

/** File endings that are pictures, for a phone that hands over a file without saying what it is. */
const PICTURE_ENDING = /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|svg)$/i;

/** Whether a file is a picture: by the type the browser gives it, or its ending when the browser gives none. */
export function isPicture(file: { type: string; name: string }): boolean {
  if (file.type) return /^image\//i.test(file.type);
  return PICTURE_ENDING.test(file.name);
}

/** How a file's size reads to a person: "3.4 MB". */
export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What stops a file going up as the QR's picture, in plain words, or "" when it can. */
export function pictureProblem(file: { type: string; name: string; size: number }): string {
  if (!isPicture(file)) return "That isn't a picture. Pick a photo, a screenshot or a logo (JPEG, PNG, WebP or GIF).";
  if (file.size > PICTURE_MAX_BYTES) {
    return `That picture is ${megabytes(file.size)}, too big to go up from here (${megabytes(PICTURE_MAX_BYTES)} at most). Take a screenshot of it, or save it smaller, and try that.`;
  }
  if (file.size === 0) return "That file is empty. Pick the picture again.";
  return "";
}

/**
 * The size a picture is drawn at before it goes up: at most QR_IMAGE_MAX_PX
 * on its long side, never made bigger. A picture with no size of its own
 * (some drawings say none) is drawn as a square at the most.
 */
export function shrunkSize(width: number, height: number): { width: number; height: number } {
  const known = (side: number) => Number.isFinite(side) && side > 0;
  if (!known(width) || !known(height)) return { width: QR_IMAGE_MAX_PX, height: QR_IMAGE_MAX_PX };
  return fitWithin(width, height, QR_IMAGE_MAX_PX);
}

/**
 * Whether any pixel is see-through, from a canvas's pixels (four numbers a
 * pixel, the fourth its opacity). A logo with a clear background keeps it;
 * a photo has none.
 */
export function hasTransparency(pixels: ArrayLike<number>): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true;
  }
  return false;
}

/** A picture with see-through parts goes up as PNG, which keeps them; anything else as JPEG, which is far smaller for a photo. */
export function pictureType(transparent: boolean): "image/png" | "image/jpeg" {
  return transparent ? "image/png" : "image/jpeg";
}

/** The name a shrunk picture goes up under: its own name with the new type's ending, or "qr-picture" when it has none. */
export function pictureName(name: string, type: "image/png" | "image/jpeg"): string {
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60);
  return `${base || "qr-picture"}.${type === "image/png" ? "png" : "jpg"}`;
}
