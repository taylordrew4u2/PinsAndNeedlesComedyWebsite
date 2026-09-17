import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { getContent } from "@/lib/store";
import { nyToday } from "@/lib/shows";
import { AI_MODEL, AI_UNCONFIGURED, aiClient, aiConfigured, aiErrorMessage, fetchPicture, pictureBlock } from "@/lib/ai";
import { brandBrief, writerSystem } from "@/lib/writer";
import {
  isPostKind,
  normalizePostDraft,
  POST_SCHEMA,
  POST_SYSTEM,
  postPrompt,
  type PostBrief,
} from "@/lib/post-writer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  kind?: unknown;
  topic?: unknown;
  details?: unknown;
  date?: unknown;
  image?: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Writes a whole news post — headline, summary, body, tags, cover
 * description and the search/AI block — from a few details the admin typed
 * and, when there is one, the flyer they attached. The brand brief is built
 * here from the stored content, so the browser never has to ship it.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ ok: false, error: AI_UNCONFIGURED }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const today = nyToday();
  const brief: PostBrief = {
    kind: isPostKind(body.kind) ? body.kind : "news",
    topic: text(body.topic),
    details: text(body.details),
    date: /^\d{4}-\d{2}-\d{2}$/.test(text(body.date)) ? text(body.date) : today,
    image: text(body.image),
  };
  if (!brief.topic && !brief.details && !brief.image) {
    return NextResponse.json(
      { ok: false, error: "Say what the post is about, or attach a flyer" },
      { status: 400 }
    );
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (brief.image) {
    const picture = await fetchPicture(brief.image, request);
    if (typeof picture === "string") {
      return NextResponse.json({ ok: false, error: picture }, { status: 400 });
    }
    content.push(pictureBlock(picture));
  }
  content.push({ type: "text", text: postPrompt(brief, Boolean(brief.image)) });

  try {
    const client = aiClient();
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: `${writerSystem(brandBrief(await getContent(), today))}\n${POST_SYSTEM}\nToday is ${today}.`,
      output_config: { effort: "high", format: { type: "json_schema", schema: POST_SCHEMA } },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
    }
    const answer = response.content.find((block) => block.type === "text")?.text || "{}";
    return NextResponse.json({ ok: true, post: normalizePostDraft(JSON.parse(answer)) });
  } catch (error) {
    console.error("[admin] post write failed:", error);
    return NextResponse.json(
      { ok: false, error: aiErrorMessage(error, "Could not write the post") },
      { status: 502 }
    );
  }
}
