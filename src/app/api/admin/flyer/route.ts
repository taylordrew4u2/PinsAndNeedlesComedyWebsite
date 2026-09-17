import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { FLYER_PROMPT, FLYER_SCHEMA, normalizeFlyer } from "@/lib/flyer";
import { nyToday } from "@/lib/shows";
import {
  aiConfigured,
  aiErrorMessage,
  aiUnconfigured,
  ask,
  parseJsonAnswer,
  checkPicture,
  fetchPicture,
  type Picture,
} from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The flyer comes either as an upload (the admin already decoded and shrank
 * it) or as a URL — a poster pasted from elsewhere that the browser could not
 * draw to a canvas. Relative URLs point at this site's own media route.
 */
async function pictureFrom(request: Request): Promise<Picture | string> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return "No flyer attached";
    return checkPicture(Buffer.from(await file.arrayBuffer()), file.type);
  }
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return "No flyer attached";
  return fetchPicture(url, request);
}

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ ok: false, error: aiUnconfigured() }, { status: 503 });
  }

  const picture = await pictureFrom(request);
  if (typeof picture === "string") {
    return NextResponse.json({ ok: false, error: picture }, { status: 400 });
  }

  const today = nyToday();
  try {
    const answer = await ask({
      system: `${FLYER_PROMPT} Today is ${today}.`,
      text: "Read this flyer.",
      picture,
      schema: FLYER_SCHEMA,
      maxTokens: 4000,
      effort: "medium",
      // Reading printed words back, not writing: no room for invention.
      temperature: 0,
    });

    if (answer.refused) {
      return NextResponse.json({ ok: false, error: "The model declined to read this image" }, { status: 422 });
    }
    const flyer = normalizeFlyer(parseJsonAnswer(answer.text), today);
    return NextResponse.json({ ok: true, flyer });
  } catch (error) {
    console.error("[admin] flyer read failed:", error);
    const message = aiErrorMessage(error, "Could not read the flyer");
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
