import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { fromAdmin } from "@/lib/admin-save";
import { isAuthed } from "@/lib/auth";
import { getContent, patchContent } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, content: await getContent() });
}

/** Auto-save endpoint: the admin sends a partial patch on every change. */
export async function PATCH(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let patch: unknown;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  try {
    // The admin's copy can be older than the host's last open or close.
    const content = await patchContent(fromAdmin(patch));
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, updatedAt: content.updatedAt });
  } catch (error) {
    console.error("[admin] save failed:", error);
    // Pass the store's own words back to the admin. Whoever sees this is
    // already logged in, and "Save failed" alone sends them hunting through
    // deployment logs they may not be able to reach.
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { ok: false, error: detail ? `Save failed — ${detail}` : "Save failed" },
      { status: 500 }
    );
  }
}
