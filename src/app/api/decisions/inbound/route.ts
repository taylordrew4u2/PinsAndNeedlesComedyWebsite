import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sanitizeSubmission, submissionWindow } from "@/lib/decisions";
import { looseText, readInbound, senderAllowed } from "@/lib/inbound";
import { messageFromForward, textFromMime } from "@/lib/inbox";
import { getContent } from "@/lib/store";
import { addSubmission } from "@/lib/submissions";
import { Throttle, clientAddress } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/**
 * A decision delivered by something else.
 *
 * The other way round from the mailbox reader: instead of the site holding a
 * password to somebody's inbox and polling it, whatever is forwarding the mail
 * posts here. That matters because the domain's own mail is on a plan that
 * opens neither IMAP nor POP, so there is nothing to poll — and because a
 * shared secret scoped to one endpoint is a much smaller thing to hand out
 * than the keys to a mailbox.
 *
 * Anything can be the sender: a mail relay, an automation, a shortcut on a
 * phone. It only has to know the secret and post the message.
 *
 * The sender's address is read to decide whether to accept the message, and
 * then dropped. It is never stored, same as every other way in.
 */

/** One address gets a burst, not a firehose. Relays retry; scripts do not. */
const posts = new Throttle(30, 60_000);

/** Refuses everything until this is set, like the Twilio route. */
function secret(): string {
  return process.env.DECISIONS_INBOUND_SECRET || "";
}

/**
 * The secret from wherever a relay can put it. Some can set headers, some can
 * only append to a URL, so both work.
 */
function presented(request: Request): string {
  const header =
    request.headers.get("x-inbound-secret") ||
    request.headers.get("x-webhook-secret") ||
    "";
  if (header) return header;

  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return new URL(request.url).searchParams.get("key") || "";
}

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** JSON or a form post, whichever the relay speaks. */
async function payloadOf(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  if (type.includes("form")) {
    const form = await request.formData();
    return Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""])
    );
  }
  // No usable content type: take it as the message itself.
  return request.text();
}

export async function POST(request: Request) {
  const expected = secret();
  if (!expected) {
    console.error("[inbound] DECISIONS_INBOUND_SECRET is not set; refusing deliveries.");
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  }

  const address = clientAddress(request);
  const wait = posts.retryAfter(address);
  if (wait) {
    return NextResponse.json(
      { ok: false, error: "Too many deliveries." },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }
  posts.record(address);

  if (!matches(presented(request), expected)) {
    console.error("[inbound] rejected a delivery with a bad secret.");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const content = await getContent();
  const { weekly } = content;
  if (!weekly.enabled) {
    return NextResponse.json({ ok: false, error: "Submissions are closed." }, { status: 404 });
  }

  // Enforced here as everywhere else: the point of the window is that whoever
  // sent this is in the room.
  const gate = submissionWindow(weekly, content.shows);
  if (!gate.open) {
    return NextResponse.json({ ok: true, accepted: false, reason: "closed" });
  }

  let payload: unknown;
  try {
    payload = await payloadOf(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const delivered = readInbound(payload);
  if (!senderAllowed(delivered.from, process.env.DECISIONS_INBOUND_FROM || "")) {
    // Not an error: a relay pointed at a whole inbox will deliver plenty that
    // is not a decision, and it should not be told it is broken.
    return NextResponse.json({ ok: true, accepted: false, reason: "sender" });
  }

  // textFromMime returns anything that was never MIME untouched, so a raw
  // forward and a one-line post both come out as the words somebody typed.
  const body = delivered.body.trim() || looseText(payload);
  const decision = messageFromForward(textFromMime(body));
  const clean = sanitizeSubmission({ decision });
  if (!clean) {
    return NextResponse.json({ ok: true, accepted: false, reason: "empty" });
  }

  try {
    await addSubmission(clean.decision, "");
  } catch (error) {
    console.error("[inbound] save failed:", error);
    return NextResponse.json({ ok: false, error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accepted: true });
}
