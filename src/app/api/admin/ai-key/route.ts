import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { cleanApiKey } from "@/lib/ai-key";
import { aiKeyStatus, clearAiKey, saveAiKey } from "@/lib/ai-key-store";
import { sealingSecret } from "@/lib/session";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

const unauthorized = () => NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });

/** Which key the AI writer uses: the last four characters only, never the key. */
export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  try {
    return NextResponse.json({ ok: true, status: await aiKeyStatus() }, { headers });
  } catch (error) {
    console.error("[ai-key] status failed", error);
    return NextResponse.json({ ok: false, error: "Could not read the key settings. Try again." }, { status: 503, headers });
  }
}

/**
 * Saves a pasted key, but only once Anthropic has said it works, so a typo
 * never replaces a key that did. Checking it costs nothing: it lists the
 * models the key can use.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  if (!sealingSecret()) {
    return NextResponse.json({ ok: false, error: "This server has no ADMIN_SECRET to lock a key with." }, { status: 503, headers });
  }
  const body = await request.json().catch(() => null);
  const key = cleanApiKey(body && typeof body === "object" ? (body as { key?: unknown }).key : undefined);
  if (!key) {
    return NextResponse.json({ ok: false, error: "That doesn’t look like an Anthropic API key. They start with sk-ant-." }, { status: 400, headers });
  }
  try {
    await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 }).models.list({ limit: 1 });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ ok: false, error: "Anthropic turned this key down. Check you copied all of it, and that it hasn’t been deleted." }, { status: 400, headers });
    }
    console.error("[ai-key] could not check the key", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Couldn’t reach Anthropic to check the key, so it wasn’t saved. Try again in a minute." }, { status: 502, headers });
  }
  try {
    await saveAiKey(key);
    return NextResponse.json({ ok: true, status: await aiKeyStatus() }, { headers });
  } catch (error) {
    console.error("[ai-key] save failed", error);
    return NextResponse.json({ ok: false, error: "The key works, but saving it failed. Try again." }, { status: 503, headers });
  }
}

/** Forgets the saved key; the server's own, if it has one, takes over. */
export async function DELETE() {
  if (!(await isAuthed())) return unauthorized();
  try {
    await clearAiKey();
    return NextResponse.json({ ok: true, status: await aiKeyStatus() }, { headers });
  } catch (error) {
    console.error("[ai-key] remove failed", error);
    return NextResponse.json({ ok: false, error: "Could not remove the key. Try again." }, { status: 503, headers });
  }
}
