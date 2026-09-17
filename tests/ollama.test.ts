import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  askOllama,
  ollamaBody,
  ollamaSettings,
  pickProvider,
  ollamaChatUrl,
  ollamaErrorMessage,
  ollamaText,
  ollamaTruncated,
  schemaHint,
  unfence,
  type OllamaConfig,
} from "../src/lib/ollama.ts";

const config: OllamaConfig = {
  base: "http://127.0.0.1:11434",
  model: "llama3.1:8b",
  context: 16384,
  timeoutMs: 180000,
};

const ask = {
  system: "You write website copy.",
  text: "Write the tagline.",
  maxTokens: 4000,
  temperature: 0.7,
};

const SCHEMA = {
  type: "object",
  required: ["title"],
  properties: { title: { type: "string", description: "6-12 words, the fact first." } },
};

test("an Anthropic key alone keeps the hosted provider", () => {
  assert.equal(pickProvider({ ANTHROPIC_API_KEY: "sk-ant-x" }), "anthropic");
  assert.equal(pickProvider({}), "anthropic");
});

test("setting OLLAMA_URL is taken as meaning it, even alongside a key", () => {
  assert.equal(pickProvider({ OLLAMA_URL: "http://box:11434" }), "ollama");
  assert.equal(
    pickProvider({ OLLAMA_URL: "http://box:11434", ANTHROPIC_API_KEY: "sk-ant-x" }),
    "ollama"
  );
  // A blank value is not a choice.
  assert.equal(pickProvider({ OLLAMA_URL: "  " }), "anthropic");
});

test("AI_PROVIDER overrides the guess either way", () => {
  assert.equal(pickProvider({ AI_PROVIDER: "ollama" }), "ollama");
  assert.equal(pickProvider({ AI_PROVIDER: "Ollama" }), "ollama");
  assert.equal(
    pickProvider({ AI_PROVIDER: "anthropic", OLLAMA_URL: "http://box:11434" }),
    "anthropic"
  );
  // Nonsense falls back to the guess rather than breaking.
  assert.equal(pickProvider({ AI_PROVIDER: "llamafile" }), "anthropic");
});

test("settings default to a local server and a text model", () => {
  assert.deepEqual(ollamaSettings({}, false), {
    base: "http://127.0.0.1:11434",
    model: "llama3.1:8b",
    context: 16384,
    timeoutMs: 180000,
  });
});

test("the vision model is only used for pictures, and falls back to the everyday one", () => {
  const env = { OLLAMA_MODEL: "qwen2.5:14b", OLLAMA_VISION_MODEL: "llama3.2-vision" };
  assert.equal(ollamaSettings(env, false).model, "qwen2.5:14b");
  assert.equal(ollamaSettings(env, true).model, "llama3.2-vision");
  // One model configured: it answers both kinds of ask.
  assert.equal(ollamaSettings({ OLLAMA_MODEL: "gemma3" }, true).model, "gemma3");
});

test("context and timeout are overridable, and junk does not become zero", () => {
  assert.equal(ollamaSettings({ OLLAMA_CONTEXT: "32768" }, false).context, 32768);
  assert.equal(ollamaSettings({ OLLAMA_CONTEXT: "lots" }, false).context, 16384);
  assert.equal(ollamaSettings({ OLLAMA_TIMEOUT_MS: "600000" }, false).timeoutMs, 600000);
  assert.equal(ollamaSettings({ OLLAMA_TIMEOUT_MS: "0" }, false).timeoutMs, 180000);
});

test("the chat endpoint is found however the base URL was typed", () => {
  assert.equal(ollamaChatUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434/api/chat");
  assert.equal(ollamaChatUrl("http://127.0.0.1:11434/"), "http://127.0.0.1:11434/api/chat");
  assert.equal(ollamaChatUrl("  https://ollama.example.com//  "), "https://ollama.example.com/api/chat");
});

test("a plain ask carries the system turn, the user turn and the context size", () => {
  const body = ollamaBody(config, ask) as Record<string, never>;
  assert.equal(body.model, "llama3.1:8b");
  assert.equal(body.stream, false);
  assert.equal(body.format, undefined);
  assert.deepEqual(body.options, { num_ctx: 16384, num_predict: 4000, temperature: 0.7 });
  assert.deepEqual(body.messages, [
    { role: "system", content: "You write website copy." },
    { role: "user", content: "Write the tagline." },
  ]);
});

test("a schema is sent as `format` and repeated in the prompt, because the grammar drops descriptions", () => {
  const body = ollamaBody(config, { ...ask, schema: SCHEMA }) as Record<string, never>;
  assert.deepEqual(body.format, SCHEMA);
  const user = (body.messages as unknown as { role: string; content: string }[])[1];
  assert.match(user.content, /^Write the tagline\./);
  // The description is an instruction, so the model has to actually see it.
  assert.match(user.content, /6-12 words, the fact first\./);
  assert.match(user.content, /JSON only/);
});

test("a picture rides as bare base64 on the user turn, no data: prefix", () => {
  const body = ollamaBody(config, {
    ...ask,
    picture: { bytes: Buffer.from("flyer"), type: "image/jpeg" },
  }) as Record<string, never>;
  const user = (body.messages as unknown as { images: string[] }[])[1];
  assert.deepEqual(user.images, [Buffer.from("flyer").toString("base64")]);
  assert.doesNotMatch(user.images[0], /^data:/);
});

test("the schema hint tells the model the descriptions are instructions", () => {
  const hint = schemaHint(SCHEMA);
  assert.match(hint, /no markdown fence/);
  assert.match(hint, /`description` on each field is an instruction/);
  assert.match(hint, /"title"/);
});

test("the answer is read off the message, trimmed, and empty when there is none", () => {
  assert.equal(ollamaText({ message: { role: "assistant", content: "  Done.  " } }), "Done.");
  assert.equal(ollamaText({ message: {} }), "");
  assert.equal(ollamaText({}), "");
  assert.equal(ollamaText(null), "");
});

test("hitting the token ceiling is visible in the answer", () => {
  assert.equal(ollamaTruncated({ done_reason: "length" }), true);
  assert.equal(ollamaTruncated({ done_reason: "stop" }), false);
  assert.equal(ollamaTruncated({}), false);
});

test("a missing model turns into the pull command that fixes it", () => {
  assert.match(
    ollamaErrorMessage(404, { error: "model 'llama3.1:8b' not found, try pulling it first" }, "llama3.1:8b"),
    /ollama pull llama3\.1:8b/
  );
  assert.match(ollamaErrorMessage(404, {}, "gemma3"), /ollama pull gemma3/);
});

test("a text-only model asked to look at a picture says which env var to set", () => {
  assert.match(
    ollamaErrorMessage(400, { error: "this model does not support images" }, "llama3.1:8b"),
    /OLLAMA_VISION_MODEL/
  );
});

test("anything else Ollama says is passed along, and a bare status is not hidden", () => {
  assert.equal(ollamaErrorMessage(500, { error: "out of memory" }, "x"), "Ollama said: out of memory");
  assert.equal(ollamaErrorMessage(502, {}, "x"), "Ollama answered 502");
});

test("a fenced answer is unwrapped, a bare one is left alone", () => {
  assert.equal(unfence('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(unfence('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(unfence('{"a":1}'), '{"a":1}');
  assert.equal(unfence('  {"a":1}  '), '{"a":1}');
  // Prose gets fenced too, but a body that merely contains a fence is left whole.
  assert.equal(unfence("```\nDoors at 7:30.\n```"), "Doors at 7:30.");
  assert.equal(unfence("A paragraph.\n\n```\ncode\n```\n\nAnother."), "A paragraph.\n\n```\ncode\n```\n\nAnother.");
});

/** A stand-in Ollama server, so the transport is exercised for real. */
async function fakeOllama(handler: (body: Record<string, unknown>) => { status: number; payload: unknown }) {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      seen.push({ url: request.url || "", body });
      const { status, payload } = handler(body);
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });
  const seen: { url: string; body: Record<string, unknown> }[] = [];
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, seen, close: () => server.close() };
}

test("a real round trip hits /api/chat and hands back the assistant's text", async () => {
  const fake = await fakeOllama(() => ({
    status: 200,
    payload: { message: { role: "assistant", content: '```json\n{"title":"It went fine"}\n```' }, done_reason: "stop" },
  }));
  try {
    const text = await askOllama(
      { ...config, base: fake.base },
      { ...ask, schema: SCHEMA }
    );
    assert.equal(text, '```json\n{"title":"It went fine"}\n```');
    assert.equal(fake.seen[0].url, "/api/chat");
    assert.equal(fake.seen[0].body.model, "llama3.1:8b");
    assert.deepEqual(fake.seen[0].body.format, SCHEMA);
  } finally {
    fake.close();
  }
});

test("an error from the server becomes a sentence, not a stack trace", async () => {
  const fake = await fakeOllama(() => ({
    status: 404,
    payload: { error: "model 'llama3.1:8b' not found, try pulling it first" },
  }));
  try {
    await assert.rejects(
      askOllama({ ...config, base: fake.base }, ask),
      /ollama pull llama3\.1:8b/
    );
  } finally {
    fake.close();
  }
});

test("a model that answers with nothing says so, rather than looking like success", async () => {
  const fake = await fakeOllama(() => ({ status: 200, payload: { message: { content: "  " } } }));
  try {
    await assert.rejects(askOllama({ ...config, base: fake.base }, ask), /answered with nothing/);
  } finally {
    fake.close();
  }
});

test("a server that is not there names the address that failed", async () => {
  await assert.rejects(
    // Port 1 is never listening.
    askOllama({ ...config, base: "http://127.0.0.1:1" }, ask),
    /Could not reach the Ollama server at http:\/\/127\.0\.0\.1:1/
  );
});
