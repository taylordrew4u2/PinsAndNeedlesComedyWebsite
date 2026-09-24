import { validDecisionQrKey } from "@/lib/decision-access";
import { NextResponse } from "next/server";
import { closedMessage, sanitizeSubmission, windowFor } from "@/lib/decisions";
import { spaceOf, type Space } from "@/lib/space";
import { getContent } from "@/lib/store";
import { addSubmission, countSince } from "@/lib/submissions";
import { Throttle, clientAddress } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/**
 * One address gets a minute's worth of sends. The whole room can share one:
 * everyone on the bar's wifi, and whole neighbourhoods behind a carrier's
 * NAT, so this is sized for "the host says scan now" rather than for one
 * phone — it only stops a script from flooding the pile. The QR key, the
 * window and the honeypot do the rest. Resets on every cold start, which is
 * fine — it only needs to hold for the length of one bar hour.
 */
const sends = new Throttle(60, 60_000);
/** The rehearsal counts separately, so practising never uses up the room's sends. */
const rehearsalSends = new Throttle(60, 60_000);

/** The form says which show it belongs to; anything but "rehearsal" is live. */
function spaceFrom(request: Request): Space {
  return spaceOf(request.headers.get("X-Decisions-Space"));
}

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

async function roomCount(since: string, space: Space): Promise<number | null> {
  const now = Date.now();
  const key = `${space}:${since}`;
  if (counted && counted.key === key && now - counted.at < COUNT_TTL_MS) return counted.value;
  let value: number | null = null;
  try {
    value = await countSince(since ? new Date(since) : null, space);
  } catch (error) {
    console.error("[decisions] count failed:", error);
  }
  counted = { key, at: now, value };
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
  const space = spaceFrom(request);
  const content = await getContent();
  const { weekly } = content;
  const enabled = weekly.enabled || space === "rehearsal";
  const gate = windowFor(space, weekly, content.shows);
  const state = {
    ok: true,
    open: enabled && gate.open,
    opensLabel: gate.opensLabel,
    opensAt: enabled ? gate.opensAt : "",
    closesAt: enabled ? gate.closesAt : "",
    serverNow: Date.now(),
    closedText: closedMessage(weekly, gate),
  };

  if (!enabled || !weekly.showCount || !gate.open) {
    return NextResponse.json({ ...state, count: null });
  }
  return NextResponse.json({ ...state, count: await roomCount(gate.opensAt, space) });
}

export async function POST(request: Request) {
  if (!validDecisionQrKey(request.headers.get("X-Decisions-QR"))) {
    return NextResponse.json({ ok: false, error: "Scan the show QR code to enter." }, { status: 403 });
  }
  const space = spaceFrom(request);
  const content = await getContent();
  const { weekly } = content;
  if (!weekly.enabled && space === "live") {
    return NextResponse.json({ ok: false, error: "Submissions are closed." }, { status: 404 });
  }

  // The window is enforced here, not only in the form: the endpoint is the
  // thing a QR code points at, and it is open to anyone who has the URL.
  const gate = windowFor(space, weekly, content.shows);
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
  const throttle = space === "rehearsal" ? rehearsalSends : sends;
  const wait = throttle.retryAfter(address);
  if (wait) {
    return NextResponse.json(
      { ok: false, error: "That's plenty for now. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }
  throttle.record(address);

  const clean = sanitizeSubmission(body);
  if (!clean) {
    return NextResponse.json({ ok: false, error: "Write the decision first." }, { status: 400 });
  }

  try {
    await addSubmission(clean.decision, clean.name, space);
  } catch (error) {
    console.error("[decisions] save failed:", error);
    return NextResponse.json(
      { ok: false, error: "Couldn't save that. Try once more." },
      { status: 500 }
    );
  }

  // The sender should see their own decision in the number.
  counted = null;
  const count = weekly.showCount ? await roomCount(gate.opensAt, space) : null;
  return NextResponse.json({ ok: true, count });
}
