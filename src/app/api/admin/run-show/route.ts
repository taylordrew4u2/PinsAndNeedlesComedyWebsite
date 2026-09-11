import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSubmission, listPile } from "@/lib/submissions";
import { readLiveSelection, writeLiveSelection } from "@/lib/live-store";
import { selectionFor } from "@/lib/live-selection";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const [pile, selected] = await Promise.all([listPile(), readLiveSelection()]);
    return NextResponse.json({
      submissions: pile.submissions.filter((item) => item.status !== "archived"),
      truncated: pile.truncated,
      selected,
    }, { headers });
  } catch (error) {
    console.error("[run-show] load failed", error);
    return NextResponse.json({ error: "Could not load questions. Try again." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || !("submissionId" in body)) {
    return NextResponse.json({ error: "Choose a question or clear the screen." }, { status: 400, headers });
  }
  const id = body.submissionId;
  if (id !== null && (typeof id !== "string" || !/^[A-Za-z0-9-]+$/.test(id))) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400, headers });
  }
  try {
    const submission = id === null ? null : await getSubmission(id);
    const selected = submission ? selectionFor(submission) : null;
    if (id !== null && !selected) {
      return NextResponse.json({ error: "That question is no longer available." }, { status: 404, headers });
    }
    await writeLiveSelection(selected);
    return NextResponse.json({ selected }, { headers });
  } catch (error) {
    console.error("[run-show] selection failed", error);
    return NextResponse.json({ error: "Could not update the live screen. Try again." }, { status: 503, headers });
  }
}
