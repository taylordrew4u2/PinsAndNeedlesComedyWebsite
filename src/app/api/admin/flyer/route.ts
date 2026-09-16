import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { FLYER_PROMPT, FLYER_SCHEMA, normalizeFlyer } from "@/lib/flyer";
import { nyToday } from "@/lib/shows";
import {
  AI_MODEL,
  AI_UNCONFIGURED,
  aiClient,
  aiConfigured,
  aiErrorMessage,
  checkPicture,
  fetchPicture,
  pictureBlock,
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
    return NextResponse.json({ ok: false, error: AI_UNCONFIGURED }, { status: 503 });
  }

  const picture = await pictureFrom(request);
  if (typeof picture === "string") {
    return NextResponse.json({ ok: false, error: picture }, { status: 400 });
  }

  const today = nyToday();
  try {
    const client = aiClient();
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: `${FLYER_PROMPT} Today is ${today}.`,
      output_config: { effort: "medium", format: { type: "json_schema", schema: FLYER_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            pictureBlock(picture),
            { type: "text", text: "Read this flyer." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, error: "The model declined to read this image" }, { status: 422 });
    }
    const text = response.content.find((block) => block.type === "text")?.text || "";
    const flyer = normalizeFlyer(JSON.parse(text), today);
    return NextResponse.json({ ok: true, flyer });
  } catch (error) {
    console.error("[admin] flyer read failed:", error);
    const message = aiErrorMessage(error, "Could not read the flyer");
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
