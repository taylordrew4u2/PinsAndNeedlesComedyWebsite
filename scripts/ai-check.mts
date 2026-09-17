/**
 * `npm run ai:check` — says which model the admin's AI helpers will ask, and
 * whether it can actually be reached.
 *
 * Worth having because every failure mode looks the same from inside the
 * admin: a button that says it cannot do it. This names which of the four
 * things is wrong — nothing configured, the server is not running, the model
 * is not pulled, or no vision model for flyers — and prints the command that
 * fixes it.
 */
import { ollamaChatUrl, ollamaSettings, pickProvider } from "../src/lib/ollama.ts";

// Next loads these for the app; a standalone script has to ask. Later files
// do not overwrite what is already set, so .env.local wins, as it does in Next.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not there, which is fine — the variables may come from the shell.
  }
}

const ok = (line: string) => console.log(`  ✓ ${line}`);
const bad = (line: string) => console.log(`  ✗ ${line}`);
const fix = (line: string) => console.log(`    → ${line}`);

/** The models an Ollama server has pulled. A sentence instead, when it cannot say. */
async function installed(base: string): Promise<string[] | string> {
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return `answered ${response.status}`;
    const payload = (await response.json()) as { models?: { name?: string }[] };
    return (payload.models ?? []).flatMap((model) => (model.name ? [model.name] : []));
  } catch (error) {
    return error instanceof Error && error.name === "TimeoutError"
      ? "did not answer within 5s"
      : "is not running";
  }
}

/** Ollama tags are "name:tag"; asking for "llama3.1" should match "llama3.1:latest". */
const has = (models: string[], wanted: string) =>
  models.some((name) => name === wanted || name.split(":")[0] === wanted.split(":")[0]);

async function main() {
  const provider = pickProvider(process.env);
  console.log(`\nAI helpers: ${provider}\n`);

  if (provider === "anthropic") {
    const key = (process.env.ANTHROPIC_API_KEY || "").trim();
    const model = (process.env.ANTHROPIC_MODEL || "").trim() || "claude-opus-5";
    if (key) {
      ok(`ANTHROPIC_API_KEY is set, model ${model}`);
      console.log("\nThe Write buttons, flyer reading and the post writer will work.\n");
      return;
    }
    bad("ANTHROPIC_API_KEY is not set, and no OLLAMA_URL either");
    fix("get a key at console.anthropic.com and put it in .env.local");
    fix("or run a model locally: see the Ollama block in .env.example");
    console.log("");
    process.exitCode = 1;
    return;
  }

  const write = ollamaSettings(process.env, false);
  const vision = ollamaSettings(process.env, true);
  console.log(`  server   ${write.base}`);
  console.log(`  writing  ${write.model}`);
  console.log(`  pictures ${vision.model}${vision.model === write.model ? " (same model)" : ""}`);
  console.log(`  context  ${write.context} tokens, ${Math.round(write.timeoutMs / 1000)}s timeout\n`);

  const models = await installed(write.base);
  if (typeof models === "string") {
    bad(`The Ollama server at ${write.base} ${models}`);
    fix("start it with:  ollama serve");
    fix(`or check the address:  curl ${write.base}/api/tags`);
    console.log("");
    process.exitCode = 1;
    return;
  }
  ok(`Reachable at ${ollamaChatUrl(write.base)}`);

  let problems = 0;
  if (has(models, write.model)) {
    ok(`“${write.model}” is pulled — the Write buttons and the post writer will work`);
  } else {
    problems += 1;
    bad(`“${write.model}” is not pulled`);
    fix(`ollama pull ${write.model}`);
  }

  if (vision.model === write.model) {
    console.log(
      `  · No OLLAMA_VISION_MODEL set, so flyers go to “${write.model}”. If that is a\n` +
        "    text-only model it will refuse or ignore the picture — pull one that can\n" +
        "    see (ollama pull llama3.2-vision) and set OLLAMA_VISION_MODEL."
    );
  } else if (has(models, vision.model)) {
    ok(`“${vision.model}” is pulled — reading flyers will work`);
  } else {
    problems += 1;
    bad(`“${vision.model}” is not pulled, so flyer reading will fail`);
    fix(`ollama pull ${vision.model}`);
  }

  if (models.length) console.log(`\n  Pulled: ${models.join(", ")}`);
  console.log("");
  if (problems) process.exitCode = 1;
}

await main();
