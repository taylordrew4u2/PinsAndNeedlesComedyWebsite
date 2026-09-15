import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { FLYER_PROMPT, FLYER_SCHEMA, normalizeFlyer } from "@/lib/flyer";
import { nyToday } from "@/lib/shows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The API accepts these four; the admin downsizes everything else to JPEG first. */
const MEDIA = /^image\/(jpeg|png|gif|webp)$/;
const MAX_BYTES = 5 * 1024 * 1024;
const MODEL = process.env.FLYER_MODEL || "claude-opus-5";

type Picture = { bytes: Buffer; type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };

/**
 * The flyer comes either as an upload (the admin already decoded and shrank
 * it) or as a URL — a poster pasted from elsewhere that the browser could not
 * draw to a canvas. Relative URLs point at this site's own media route.
 */
async function pictureFrom(request: Request): Promise<Picture | string> {
  const contentType = request.headers.get("content-type") || "";
  let bytes: Buffer;
  let type: string;

  if (contentType.includes("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return "No flyer attached";
    bytes = Buffer.from(await file.arrayBuffer());
    type = file.type;
  } else {
    const body = (await request.json().catch(() => ({}))) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return "No flyer attached";
    let target: URL;
    try {
      target = new URL(url, request.url);
    } catch {
      return "That poster URL is not valid";
    }
    if (!/^https?:$/.test(target.protocol)) return "That poster URL is not valid";
    const response = await fetch(target, { headers: { cookie: request.headers.get("cookie") || "" } });
    if (!response.ok) return `Could not fetch the poster (${response.status})`;
    bytes = Buffer.from(await response.arrayBuffer());
    type = (response.headers.get("content-type") || "").split(";")[0].trim();
  }

  if (!MEDIA.test(type)) return `Flyers need to be JPEG, PNG, GIF or WebP — this is ${type || "unknown"}`;
  if (bytes.length > MAX_BYTES) return "Flyer is over 5MB — upload a smaller copy";
  return { bytes, type: type as Picture["type"] };
}

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Reading flyers needs ANTHROPIC_API_KEY set on the server" },
      { status: 503 }
    );
  }

  const picture = await pictureFrom(request);
  if (typeof picture === "string") {
    return NextResponse.json({ ok: false, error: picture }, { status: 400 });
  }

  const today = nyToday();
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `${FLYER_PROMPT} Today is ${today}.`,
      output_config: { effort: "medium", format: { type: "json_schema", schema: FLYER_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: picture.type, data: picture.bytes.toString("base64") },
            },
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
    const message =
      error instanceof Anthropic.AuthenticationError
        ? "ANTHROPIC_API_KEY was rejected"
        : error instanceof Anthropic.RateLimitError
          ? "Rate limited — try again in a minute"
          : error instanceof Anthropic.APIError
            ? `Could not read the flyer (${error.status})`
            : "Could not read the flyer";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
