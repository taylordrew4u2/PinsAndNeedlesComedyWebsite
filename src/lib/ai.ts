import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { askOllama, ollamaSettings, pickProvider, unfence, type OllamaConfig } from "./ollama.ts";

/**
 * One place for everything the admin's AI helpers share: which model
 * answers, asking it, turning errors into a sentence an admin can act on,
 * and pulling a stored picture back out so the model can look at it.
 *
 * Two providers, one `ask`. Set OLLAMA_URL and the helpers run against a
 * model you host yourself; otherwise they use the Anthropic API. Nothing
 * above this file knows which one answered.
 */

export type AiProvider = "anthropic" | "ollama";

const env = (name: string) => (process.env[name] || "").trim();

export function aiProvider(): AiProvider {
  return pickProvider(process.env);
}

export function ollamaConfig(vision: boolean): OllamaConfig {
  return ollamaSettings(process.env, vision);
}

/** The model that will answer, for the admin to see. */
export function aiModel(vision = false): string {
  return aiProvider() === "ollama"
    ? ollamaConfig(vision).model
    : env("ANTHROPIC_MODEL") || "claude-opus-5";
}

export function aiConfigured(): boolean {
  // An Ollama server needs no key, so having somewhere to send the request
  // is the whole of the configuration.
  return aiProvider() === "ollama" ? true : Boolean(env("ANTHROPIC_API_KEY"));
}

/** What to tell the admin when nothing is set up to answer. */
export function aiUnconfigured(): string {
  return "This needs ANTHROPIC_API_KEY set on the server, or OLLAMA_URL pointing at an Ollama server";
}

export function aiClient(): Anthropic {
  return new Anthropic();
}

/** A sentence for the admin. The full error goes to the server log. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY was rejected";
  if (error instanceof Anthropic.RateLimitError) return "Rate limited — try again in a minute";
  if (error instanceof Anthropic.APIError) return `${fallback} (${error.status})`;
  // Ollama's failures already arrive as a sentence worth showing.
  if (error instanceof Error && error.message) return error.message;
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

/** One question for whichever model is configured. */
export type AiAsk = {
  /** The standing instructions. */
  system: string;
  /** The one user turn. */
  text: string;
  /** A picture for the model to look at. Needs a vision model on Ollama. */
  picture?: Picture;
  /** Ask for JSON in this shape instead of prose. */
  schema?: Record<string, unknown>;
  maxTokens: number;
  /** Anthropic only — how long it may think. */
  effort?: "low" | "medium" | "high";
  /** Ollama only — 0 to read something back verbatim, higher to write prose. */
  temperature?: number;
};

export type AiAnswer = { text: string; refused: boolean };

/**
 * Ask the configured model one question and get its text back. JSON comes
 * back as a string either way, for the caller to parse and normalize —
 * neither provider's structured output is trustworthy enough to skip that.
 */
export async function ask(input: AiAsk): Promise<AiAnswer> {
  if (aiProvider() === "ollama") {
    const config = ollamaConfig(Boolean(input.picture));
    const text = await askOllama(config, {
      system: input.system,
      text: input.text,
      picture: input.picture,
      schema: input.schema,
      maxTokens: input.maxTokens,
      temperature: input.temperature ?? 0.7,
    });
    // Smaller models fence their answer however much you ask them not to,
    // and they do it to prose as readily as to JSON.
    return { text: unfence(text), refused: false };
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.picture) content.push(pictureBlock(input.picture));
  content.push({ type: "text", text: input.text });

  const response = await aiClient().messages.create({
    model: aiModel(),
    max_tokens: input.maxTokens,
    system: input.system,
    output_config: {
      ...(input.effort ? { effort: input.effort } : {}),
      ...(input.schema ? { format: { type: "json_schema" as const, schema: input.schema } } : {}),
    },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") return { text: "", refused: true };
  return {
    text: response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim(),
    refused: false,
  };
}


/**
 * A model's JSON answer, parsed. Throws a sentence the admin can act on
 * rather than a parser error: a small local model that ignores the schema
 * is a thing that happens, and "Unexpected token <" helps nobody.
 */
export function parseJsonAnswer(text: string): unknown {
  try {
    return JSON.parse(unfence(text));
  } catch {
    throw new Error(`“${aiModel()}” did not answer with usable JSON — try again, or use a bigger model`);
  }
}
