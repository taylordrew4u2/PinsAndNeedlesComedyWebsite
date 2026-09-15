import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * One place for everything the admin's AI helpers share: the client, the
 * model, turning SDK errors into a sentence an admin can act on, and pulling
 * a stored picture back out so the model can look at it.
 */

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const AI_UNCONFIGURED = "This needs ANTHROPIC_API_KEY set on the server";

export function aiClient(): Anthropic {
  return new Anthropic();
}

/** A sentence for the admin. The full error goes to the server log. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY was rejected";
  if (error instanceof Anthropic.RateLimitError) return "Rate limited — try again in a minute";
  if (error instanceof Anthropic.APIError) return `${fallback} (${error.status})`;
  return fallback;
}

export type PictureType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export type Picture = { bytes: Buffer; type: PictureType };

/** The API accepts these four; anything else has to be converted first. */
const MEDIA = /^image\/(jpeg|png|gif|webp)$/;
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

export function checkPicture(bytes: Buffer, type: string): Picture | string {
  if (!MEDIA.test(type)) return `Pictures need to be JPEG, PNG, GIF or WebP — this is ${type || "unknown"}`;
  if (bytes.length > PICTURE_MAX_BYTES) return "Picture is over 5MB — upload a smaller copy";
  return { bytes, type: type as PictureType };
}

/**
 * Fetch a picture by URL. Relative URLs point at this site's own media
 * route, which is why the admin's cookie rides along. Returns a sentence
 * instead of a picture when it cannot be used.
 */
export async function fetchPicture(url: string, request: Request): Promise<Picture | string> {
  let target: URL;
  try {
    target = new URL(url.trim(), request.url);
  } catch {
    return "That picture URL is not valid";
  }
  if (!/^https?:$/.test(target.protocol)) return "That picture URL is not valid";
  const response = await fetch(target, { headers: { cookie: request.headers.get("cookie") || "" } });
  if (!response.ok) return `Could not fetch the picture (${response.status})`;
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = (response.headers.get("content-type") || "").split(";")[0].trim();
  return checkPicture(bytes, type);
}

export function pictureBlock(picture: Picture): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: picture.type, data: picture.bytes.toString("base64") },
  };
}
