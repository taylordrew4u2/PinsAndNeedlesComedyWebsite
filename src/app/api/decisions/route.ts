import { validDecisionQrKey } from "@/lib/decision-access";
import { NextResponse } from "next/server";
import { closedMessage, sanitizeSubmission, submissionWindow } from "@/lib/decisions";
import { getContent } from "@/lib/store";
import { addSubmission, countSince } from "@/lib/submissions";
import { Throttle, clientAddress } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/**
 * One address gets a handful of sends a minute. Enough to stop a script from
 * filling the pile, loose enough that a table of six on the same bar wifi all
 * get through. Resets on every cold start, which is fine — it only needs to
 * hold for the length of one bar hour.
 */
const sends = new Throttle(8, 60_000);

/**
 * The public count, cached for a few seconds.
 *
 * The listing behind it is already one call, but a full room polling every
 * half-minute is still forty of them; this collapses those into one. Keyed by
 * the window it counts, so a new night never inherits the last one's number,
 * and dropped whenever a submission lands so the sender sees their own.
 */
const COUNT_TTL_MS = 10_000;
let counted: { key: string; at: number; value: number | null } | null = null;

async function roomCount(since: string): Promise<number | null> {
  const now = Date.now();
  if (counted && counted.key === since && now - counted.at < COUNT_TTL_MS) return counted.value;
  let value: number | null = null;
  try {
    value = await countSince(since ? new Date(since) : null);
  } catch (error) {
    console.error("[decisions] count failed:", error);
  }
  counted = { key: since, at: now, value };
  return value;
}

/**
 * Whether the form is open, and how many decisions are in. The page polls
 * this so a phone left open on the table flips to the form by itself when
 * the window opens, without anyone reloading.
 */
export async function GET(request: Request) {
  if (!validDecisionQrKey(request.headers.get("X-Decisions-QR"))) {
    return NextResponse.json({ ok: false, error: "Scan the show QR code to enter." }, { status: 403 });
  }
  const content = await getContent();
  const { weekly } = content;
  const gate = submissionWindow(weekly, content.shows);
  const state = {
    ok: true,
    open: weekly.enabled && gate.open,
    opensLabel: gate.opensLabel,
    opensAt: weekly.enabled ? gate.opensAt : "",
    closesAt: weekly.enabled ? gate.closesAt : "",
    serverNow: Date.now(),
    closedText: closedMessage(weekly, gate),
  };

  if (!weekly.enabled || !weekly.showCount || !gate.open) {
    return NextResponse.json({ ...state, count: null });
  }
  return NextResponse.json({ ...state, count: await roomCount(gate.opensAt) });
}

export async function POST(request: Request) {
  if (!validDecisionQrKey(request.headers.get("X-Decisions-QR"))) {
    return NextResponse.json({ ok: false, error: "Scan the show QR code to enter." }, { status: 403 });
  }
  const content = await getContent();
  const { weekly } = content;
  if (!weekly.enabled) {
    return NextResponse.json({ ok: false, error: "Submissions are closed." }, { status: 404 });
  }

  // The window is enforced here, not only in the form: the endpoint is the
  // thing a QR code points at, and it is open to anyone who has the URL.
  const gate = submissionWindow(weekly, content.shows);
  if (!gate.open) {
    return NextResponse.json(
      { ok: false, open: false, error: closedMessage(weekly, gate) || "Submissions are closed." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Honeypot: the form has a hidden field a person never sees. A bot fills it.
  if (typeof body === "object" && body !== null && (body as { website?: unknown }).website) {
    return NextResponse.json({ ok: true });
  }

  const address = clientAddress(request);
  const wait = sends.retryAfter(address);
  if (wait) {
    return NextResponse.json(
      { ok: false, error: "That's plenty for now. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }
  sends.record(address);

  const clean = sanitizeSubmission(body);
  if (!clean) {
    return NextResponse.json({ ok: false, error: "Write the decision first." }, { status: 400 });
  }

  try {
    await addSubmission(clean.decision, clean.name);
  } catch (error) {
    console.error("[decisions] save failed:", error);
    return NextResponse.json(
      { ok: false, error: "Couldn't save that. Try once more." },
      { status: 500 }
    );
  }

  // The sender should see their own decision in the number.
  counted = null;
  const count = weekly.showCount ? await roomCount(gate.opensAt) : null;
  return NextResponse.json({ ok: true, count });
}
