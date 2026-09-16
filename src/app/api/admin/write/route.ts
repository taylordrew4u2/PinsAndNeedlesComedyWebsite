import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { getContent } from "@/lib/store";
import { nyToday } from "@/lib/shows";
import { emptySeo } from "@/lib/seo";
import { AI_MODEL, AI_UNCONFIGURED, aiClient, aiConfigured, aiErrorMessage, fetchPicture, pictureBlock } from "@/lib/ai";
import {
  brandBrief,
  normalizeSeoDraft,
  SEO_SCHEMA,
  seoPrompt,
  writerPrompt,
  writerSystem,
  type AiHint,
} from "@/lib/writer";
import type { Seo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  kind?: "text" | "seo";
  what?: unknown;
  current?: unknown;
  about?: unknown;
  image?: unknown;
  seo?: unknown;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Writes one field, or a whole SEO block, from the brand brief plus whatever
 * facts the admin's screen sent along. The brief is built here from the
 * stored content, so the browser never has to ship it.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ ok: false, error: AI_UNCONFIGURED }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const kind = body.kind === "seo" ? "seo" : "text";
  const hint: AiHint = {
    what: typeof body.what === "string" ? body.what.trim() : "",
    about: record(body.about),
    image: typeof body.image === "string" ? body.image.trim() : "",
  };
  if (kind === "text" && !hint.what) {
    return NextResponse.json({ ok: false, error: "Say what the field is" }, { status: 400 });
  }

  const today = nyToday();
  const system = writerSystem(brandBrief(await getContent(), today));
  const client = aiClient();

  try {
    if (kind === "seo") {
      const current: Seo = { ...emptySeo(), ...record(body.seo) } as Seo;
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4000,
        system,
        output_config: { format: { type: "json_schema", schema: SEO_SCHEMA } },
        messages: [{ role: "user", content: seoPrompt(hint.about ?? {}, current) }],
      });
      if (response.stop_reason === "refusal") {
        return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
      }
      const text = response.content.find((block) => block.type === "text")?.text || "{}";
      return NextResponse.json({ ok: true, seo: normalizeSeoDraft(JSON.parse(text)) });
    }

    const content: Anthropic.ContentBlockParam[] = [];
    if (hint.image) {
      const picture = await fetchPicture(hint.image, request);
      if (typeof picture === "string") {
        return NextResponse.json({ ok: false, error: picture }, { status: 400 });
      }
      content.push(pictureBlock(picture));
    }
    const current = typeof body.current === "string" ? body.current : "";
    content.push({ type: "text", text: writerPrompt(hint, current, Boolean(hint.image)) });

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
    }
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()
      // The model is told not to quote, but a stray pair of quotes is cheap to strip.
      .replace(/^["“]([\s\S]*)["”]$/, "$1");
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    console.error("[admin] write failed:", error);
    return NextResponse.json(
      { ok: false, error: aiErrorMessage(error, "Could not write that") },
      { status: 502 }
    );
  }
}
