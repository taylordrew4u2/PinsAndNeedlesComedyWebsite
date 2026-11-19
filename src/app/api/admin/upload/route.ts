import { NextResponse } from "next/server";
import { currentRole } from "@/lib/auth";
import { saveUpload } from "@/lib/store";
import { AUDIO_MAX_BYTES, audioTypeOf, audioUploadName } from "@/lib/audio-upload";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|webp|gif|avif|svg\+xml)|video\/(mp4|webm|quicktime))$/;
const PRODUCER_ALLOWED = /^image\/(png|jpeg|webp|gif|avif)$/;

export async function POST(request: Request) {
  const role = await currentRole();
  if (!role) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
  }
  // A sound (the host's own question sound) is stored under its standard type and an extension that serves as it.
  const audio = audioTypeOf(file.type, file.name);
  // A producer uploads only what the Control Center takes (a QR picture, a question sound): no SVG,
  // which can carry script on this site's own address, and no video.
  if (role === "producer" && !audio && !PRODUCER_ALLOWED.test(file.type)) {
    return NextResponse.json(
      { ok: false, error: `Producers can upload pictures (PNG, JPEG, WebP, GIF, AVIF) and sounds only.` },
      { status: 415 }
    );
  }
  if (!audio && !ALLOWED.test(file.type)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` },
      { status: 415 }
    );
  }
  const limit = audio ? AUDIO_MAX_BYTES : MAX_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { ok: false, error: `File is ${(file.size / 1e6).toFixed(1)}MB — the limit${audio ? " for a sound" : ""} is ${Math.round(limit / 1024 / 1024)}MB` },
      { status: 413 }
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = audio
      ? await saveUpload(audioUploadName(file.name || "sound", audio), bytes, audio)
      : await saveUpload(file.name || "upload", bytes, file.type);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("[admin] upload failed:", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
