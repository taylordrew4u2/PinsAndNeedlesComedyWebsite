import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getContent } from "@/lib/store";
import { nyToday } from "@/lib/shows";
import { emptySeo } from "@/lib/seo";
import { aiConfigured, aiErrorMessage, aiUnconfigured, ask, fetchPicture, parseJsonAnswer } from "@/lib/ai";
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
    return NextResponse.json({ ok: false, error: aiUnconfigured() }, { status: 503 });
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

  try {
    if (kind === "seo") {
      const current: Seo = { ...emptySeo(), ...record(body.seo) } as Seo;
      const answer = await ask({
        system,
        text: seoPrompt(hint.about ?? {}, current),
        schema: SEO_SCHEMA,
        maxTokens: 4000,
        temperature: 0.4,
      });
      if (answer.refused) {
        return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
      }
      return NextResponse.json({ ok: true, seo: normalizeSeoDraft(parseJsonAnswer(answer.text)) });
    }

    const picture = hint.image ? await fetchPicture(hint.image, request) : undefined;
    if (typeof picture === "string") {
      return NextResponse.json({ ok: false, error: picture }, { status: 400 });
    }
    const current = typeof body.current === "string" ? body.current : "";

    const answer = await ask({
      system,
      text: writerPrompt(hint, current, Boolean(hint.image)),
      picture,
      maxTokens: 4000,
      effort: "medium",
      temperature: 0.7,
    });
    if (answer.refused) {
      return NextResponse.json({ ok: false, error: "The model declined this request" }, { status: 422 });
    }
    const text = answer.text
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
