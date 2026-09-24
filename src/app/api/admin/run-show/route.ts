import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { submissionWindow } from "@/lib/decisions";
import { getContent } from "@/lib/store";
import { deleteRehearsalSubmissions, getSubmission, listPile } from "@/lib/submissions";
import { readLiveSelection, writeLiveSelection } from "@/lib/live-store";
import { selectionFor } from "@/lib/live-selection";
import { planRehearsal, rehearsalActive } from "@/lib/rehearsal";
import { readRehearsal, writeRehearsal } from "@/lib/rehearsal-store";

export const dynamic = "force-dynamic";
// Finishing a rehearsal is one delete per test.
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** Where the rehearsal stands, for the Run Show panel. */
async function rehearsalState() {
  const { weekly, shows } = await getContent();
  const gate = submissionWindow(weekly, shows);
  const rehearsal = await readRehearsal({ fresh: true });
  return {
    rehearsal,
    rehearsing: weekly.enabled && rehearsalActive(rehearsal, gate),
    showWindowOpen: weekly.enabled && gate.open,
    enabled: weekly.enabled,
  };
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const [pile, selected, rehearsal] = await Promise.all([listPile(), readLiveSelection(), rehearsalState()]);
    return NextResponse.json({
      submissions: pile.submissions.filter((item) => item.status !== "archived"),
      truncated: pile.truncated,
      selected,
      ...rehearsal,
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
  if (body && typeof body === "object" && "rehearsal" in body) {
    return rehearse((body as { rehearsal: unknown }).rehearsal);
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

/**
 * "start" opens the QR form for a short test run. "finish" deletes every test
 * it left (clearing the projector if one is showing) and closes it again.
 */
async function rehearse(action: unknown) {
  try {
    if (action === "start") {
      const { weekly, shows } = await getContent();
      if (!weekly.enabled) {
        return NextResponse.json({ error: "Bad Decisions is switched off in the admin. Turn it on first." }, { status: 409, headers });
      }
      const plan = planRehearsal(submissionWindow(weekly, shows));
      if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 409, headers });
      await writeRehearsal(plan.rehearsal);
      return NextResponse.json({ ...(await rehearsalState()), deleted: 0 }, { headers });
    }
    if (action === "finish") {
      // Close the form first, so no new test lands after the sweep.
      await writeRehearsal(null);
      const deleted = await deleteRehearsalSubmissions();
      return NextResponse.json({ ...(await rehearsalState()), deleted }, { headers });
    }
    return NextResponse.json({ error: "Unknown rehearsal action" }, { status: 400, headers });
  } catch (error) {
    console.error("[run-show] rehearsal failed", error);
    return NextResponse.json({ error: "Could not update the rehearsal. Try again." }, { status: 503, headers });
  }
}
