import { NextResponse } from "next/server";
import { getContentStrict, patchContent } from "@/lib/store";
import { submissionWindow } from "@/lib/decisions";
import { isAuthed } from "@/lib/auth";
import { getSubmission, listPile } from "@/lib/submissions";
import { readLiveSelection, writeLiveSelection } from "@/lib/live-store";
import { selectionFor } from "@/lib/live-selection";
import { spaceOf, type Space } from "@/lib/space";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** Legacy mode parameters also use the live show. */
function spaceFrom(request: Request): Space {
  return spaceOf(new URL(request.url).searchParams.get("mode"));
}

export async function GET(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const space = spaceFrom(request);
  try {
    const [pile, selected, content] = await Promise.all([listPile({}, space), readLiveSelection(space), getContentStrict()]);
    return NextResponse.json({
      submissions: pile.submissions.filter((item) => item.status !== "archived"),
      truncated: pile.truncated,
      selected,
      questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
      manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
    }, { headers });
  } catch (error) {
    console.error("[run-show] load failed", error);
    return NextResponse.json({ error: "Could not load questions. Try again." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const space = spaceFrom(request);
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  if (body && typeof body === "object" && "manualOpen" in body) {
    if (typeof body.manualOpen !== "boolean") {
      return NextResponse.json({ error: "Invalid question setting" }, { status: 400, headers });
    }
    try {
      // Only change question availability. Never write the projector selection or other page settings.
      const content = await patchContent({ weekly: {
        alwaysOpen: body.manualOpen,
        ...(body.manualOpen ? { enabled: true } : {}),
      } });
      return NextResponse.json({
        questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
        manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
      }, { headers });
    } catch (error) {
      console.error("[run-show] question setting failed", error);
      return NextResponse.json({ error: "Could not update questions. Try again." }, { status: 503, headers });
    }
  }
  if (!body || typeof body !== "object" || !("submissionId" in body)) {
    return NextResponse.json({ error: "Choose a question or clear the screen." }, { status: 400, headers });
  }
  const id = body.submissionId;
  if (id !== null && (typeof id !== "string" || !/^[A-Za-z0-9-]+$/.test(id))) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400, headers });
  }
  try {
    const submission = id === null ? null : await getSubmission(id, space);
    const selected = submission ? selectionFor(submission) : null;
    if (id !== null && !selected) {
      return NextResponse.json({ error: "That question is no longer available." }, { status: 404, headers });
    }
    await writeLiveSelection(selected, space);
    return NextResponse.json({ selected }, { headers });
  } catch (error) {
    console.error("[run-show] selection failed", error);
    return NextResponse.json({ error: "Could not update the live screen. Try again." }, { status: 503, headers });
  }
}
