import type { Picture } from "./ai";

/**
 * Talking to an Ollama server instead of a hosted API, so the admin's AI
 * helpers can run on a model you host yourself.
 *
 * Ollama's /api/chat is close to the shape we already use — a system string
 * plus one user turn — with two differences worth knowing:
 *
 * - Pictures ride as bare base64 on the message, not as content blocks.
 * - `format` takes a JSON schema, but it is compiled to a grammar that only
 *   constrains the *shape*: the `description` on each property is dropped.
 *   Ours carry most of the instructions, so `schemaHint` puts the schema back
 *   into the prompt in words the model actually reads.
 *
 * No `server-only` marker here so the request shaping can be tested; `ai.ts`
 * is the boundary that holds it, and nothing else imports this file.
 */

export type OllamaConfig = {
  /** Base URL of the server, no trailing slash. */
  base: string;
  model: string;
  /** Context window to load the model with. Small defaults silently truncate. */
  context: number;
  timeoutMs: number;
};

export type OllamaAsk = {
  system: string;
  text: string;
  picture?: Picture;
  schema?: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
};

export type Env = Record<string, string | undefined>;

const read = (env: Env, name: string) => (env[name] || "").trim();

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

/**
 * Which provider answers. An explicit AI_PROVIDER wins; otherwise setting
 * OLLAMA_URL is taken as meaning it, because nobody sets that by accident.
 */
export function pickProvider(env: Env): "anthropic" | "ollama" {
  const named = read(env, "AI_PROVIDER").toLowerCase();
  if (named === "ollama" || named === "anthropic") return named;
  return read(env, "OLLAMA_URL") ? "ollama" : "anthropic";
}

/**
 * How to reach the server and which model to ask. `vision` picks the model
 * that can look at a flyer, falling back to the everyday one so a
 * single-model setup still works.
 */
export function ollamaSettings(env: Env, vision: boolean): OllamaConfig {
  return {
    base: read(env, "OLLAMA_URL") || DEFAULT_OLLAMA_URL,
    model:
      (vision ? read(env, "OLLAMA_VISION_MODEL") : "") ||
      read(env, "OLLAMA_MODEL") ||
      DEFAULT_OLLAMA_MODEL,
    context: Number(read(env, "OLLAMA_CONTEXT")) || 16384,
    timeoutMs: Number(read(env, "OLLAMA_TIMEOUT_MS")) || 180000,
  };
}

/**
 * ```json … ``` around an answer, taken back off. Smaller models fence their
 * JSON however firmly you ask them not to.
 */
export function unfence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  return (fenced ? fenced[1] : text).trim();
}

/** The chat endpoint for a base URL, however the admin typed it. */
export function ollamaChatUrl(base: string): string {
  return `${base.trim().replace(/\/+$/, "")}/api/chat`;
}

/**
 * The schema in words, because Ollama's grammar throws the descriptions
 * away. Without this the model returns the right keys full of the wrong
 * thing — a 6-word headline where a 400-word body belongs.
 */
export function schemaHint(schema: Record<string, unknown>): string {
  return [
    "Answer with JSON only — no prose before or after it, no markdown fence.",
    "It must match this schema, and the `description` on each field is an instruction you follow:",
    JSON.stringify(schema, null, 1),
  ].join("\n");
}

/** The request body for one ask. */
export function ollamaBody(config: OllamaConfig, ask: OllamaAsk): Record<string, unknown> {
  const text = ask.schema ? `${ask.text}\n\n${schemaHint(ask.schema)}` : ask.text;
  return {
    model: config.model,
    stream: false,
    ...(ask.schema ? { format: ask.schema } : {}),
    options: {
      num_ctx: config.context,
      num_predict: ask.maxTokens,
      temperature: ask.temperature,
    },
    messages: [
      { role: "system", content: ask.system },
      {
        role: "user",
        content: text,
        // Ollama wants raw base64 with no data: prefix and no media type.
        ...(ask.picture ? { images: [ask.picture.bytes.toString("base64")] } : {}),
      },
    ],
  };
}

const errorFrom = (payload: unknown): string => {
  const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return typeof data.error === "string" ? data.error.trim() : "";
};

/** A sentence for the admin. The full response goes to the server log. */
export function ollamaErrorMessage(status: number, payload: unknown, model: string): string {
  const reported = errorFrom(payload);
  if (/not found|no such model|try pulling/i.test(reported)) {
    return `The Ollama server has no model called “${model}” — run: ollama pull ${model}`;
  }
  if (/does not support (images|vision)|image input/i.test(reported)) {
    return `“${model}” cannot look at pictures — set OLLAMA_VISION_MODEL to a vision model like llama3.2-vision`;
  }
  if (reported) return `Ollama said: ${reported}`;
  if (status === 404) return `Ollama has no model called “${model}” — run: ollama pull ${model}`;
  return `Ollama answered ${status}`;
}

/** The assistant's text out of a /api/chat answer. "" when there is none. */
export function ollamaText(payload: unknown): string {
  const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : {}) as Record<
    string,
    unknown
  >;
  return typeof message.content === "string" ? message.content.trim() : "";
}

/** True when the model stopped because it hit the token ceiling. */
export function ollamaTruncated(payload: unknown): boolean {
  const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return data.done_reason === "length";
}

/** Ask an Ollama server one question. Throws an Error carrying a sentence for the admin. */
export async function askOllama(config: OllamaConfig, ask: OllamaAsk): Promise<string> {
  let response: Response;
  try {
    response = await fetch(ollamaChatUrl(config.base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ollamaBody(config, ask)),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    console.error("[admin] ollama unreachable:", error);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new Error(
      timedOut
        ? `Ollama did not answer within ${Math.round(config.timeoutMs / 1000)}s — a bigger model may need a longer OLLAMA_TIMEOUT_MS`
        : `Could not reach the Ollama server at ${config.base}`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[admin] ollama error:", response.status, payload);
    throw new Error(ollamaErrorMessage(response.status, payload, config.model));
  }

  const text = ollamaText(payload);
  if (!text) {
    console.error("[admin] ollama returned nothing:", payload);
    throw new Error(`“${config.model}” answered with nothing — try a larger model`);
  }
  if (ollamaTruncated(payload)) {
    console.warn("[admin] ollama hit the token ceiling; answer may be cut off");
  }
  return text;
}
