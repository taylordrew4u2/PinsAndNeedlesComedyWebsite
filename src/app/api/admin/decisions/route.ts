import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { pickRandom } from "@/lib/decisions";
import {
  archiveAll,
  deleteSubmission,
  listPile,
  listSubmissions,
  setStatus,
} from "@/lib/submissions";

export const dynamic = "force-dynamic";
// Archiving a full pile is one write per submission; the default budget is
// not enough for a busy night.
export const maxDuration = 60;

/** The whole pile, newest first. The admin's "Tonight" panel reads this. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // `truncated` says the store held more than one listing can return, so the
    // panel can say so rather than quietly showing a partial pile.
    const { submissions, truncated } = await listPile();
    return NextResponse.json({ ok: true, submissions, truncated });
  } catch (error) {
    console.error("[admin/decisions] list failed:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: detail || "Could not read submissions" }, { status: 500 });
  }
}

type Action =
  | { action: "draw" }
  | { action: "reopen"; id: string }
  | { action: "delete"; id: string }
  | { action: "archive-all" };

/**
 * Stage actions. "draw" is the one that matters: it picks one open
 * submission at random on the server, marks it drawn, and sends it back —
 * so two phones in the room can never pull the same one.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Action;
  try {
    body = (await request.json()) as Action;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  try {
    if (body.action === "draw") {
      // Read past the cache: drawing from a pile even slightly behind could
      // hand the host something already read out on stage.
      const open = (await listSubmissions({ fresh: true })).filter(
        (entry) => entry.status === "open"
      );
      const picked = pickRandom(open);
      if (!picked) return NextResponse.json({ ok: true, drawn: null, remaining: 0 });
      const drawn = await setStatus(picked.id, "drawn");
      return NextResponse.json({ ok: true, drawn, remaining: open.length - 1 });
    }
    if (body.action === "reopen") {
      return NextResponse.json({ ok: true, submission: await setStatus(body.id, "open") });
    }
    if (body.action === "delete") {
      await deleteSubmission(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "archive-all") {
      // Returns what is left so the panel can finish the job across calls
      // rather than the request dying half way through a big pile.
      return NextResponse.json({ ok: true, ...(await archiveAll()) });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/decisions] action failed:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: detail || "Action failed" }, { status: 500 });
  }
}
