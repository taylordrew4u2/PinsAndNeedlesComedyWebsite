import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getContent } from "@/lib/store";
import { nyToday } from "@/lib/shows";
import {
  aiConfigured,
  aiErrorMessage,
  aiModel,
  aiUnconfigured,
  ask,
  fetchPicture,
  parseJsonAnswer,
} from "@/lib/ai";
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
    return NextResponse.json({ ok: false, error: aiUnconfigured() }, { status: 503 });
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

  const picture = brief.image ? await fetchPicture(brief.image, request) : undefined;
  if (typeof picture === "string") {
    return NextResponse.json({ ok: false, error: picture }, { status: 400 });
  }

  try {
    const answer = await ask({
      system: `${writerSystem(brandBrief(await getContent(), today))}\n${POST_SYSTEM}\nToday is ${today}.`,
      text: postPrompt(brief, Boolean(brief.image)),
      picture,
      schema: POST_SCHEMA,
      maxTokens: 8000,
      effort: "high",
      temperature: 0.7,
    });

    if (answer.refused) {
      return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      post: normalizePostDraft(parseJsonAnswer(answer.text)),
      // Which model wrote it, so the admin can tell at a glance.
      model: aiModel(Boolean(brief.image)),
    });
  } catch (error) {
    console.error("[admin] post write failed:", error);
    return NextResponse.json(
      { ok: false, error: aiErrorMessage(error, "Could not write the post") },
      { status: 502 }
    );
  }
}
