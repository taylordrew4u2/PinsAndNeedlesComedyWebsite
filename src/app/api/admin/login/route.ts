import { NextResponse } from "next/server";
import { COOKIE, cookieOptions, issueToken, passwordRole } from "@/lib/auth";
import { Throttle, clientAddress } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/**
 * Guessing the admin password.
 *
 * A delay on a wrong answer is not a limit: each request waits on its own
 * timer, so a hundred sent at once still all finish in one delay. That caps
 * how fast one caller can guess in a line and does nothing about a caller
 * guessing in parallel, which is how it would actually be done.
 *
 * So failures are counted. Per address, tightly — nobody types their own
 * password ten times in a quarter of an hour. And across everyone, loosely,
 * because an address is the one thing an attacker can change for free.
 */
const WINDOW_MS = 15 * 60_000;
const perAddress = new Throttle(10, WINDOW_MS);
const everyone = new Throttle(60, WINDOW_MS);

/** Shared by both limits so one caller cannot be refused while the other allows. */
const ALL = "*";

function refuse(seconds: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Too many attempts. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

export async function POST(request: Request) {
  const address = clientAddress(request);
  const wait = Math.max(perAddress.retryAfter(address), everyone.retryAfter(ALL));
  if (wait) return refuse(wait);

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const role = passwordRole(password);
  if (!role) {
    perAddress.record(address);
    everyone.record(ALL);
    // Still worth the pause: it costs a patient attacker real time, and a
    // person who mistyped cannot tell the difference.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  // Getting in clears the earlier typos, so a bad day at the keyboard does not
  // lock out the person who owns the site.
  perAddress.clear(address);

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(COOKIE, issueToken(role), cookieOptions);
  return response;
}
