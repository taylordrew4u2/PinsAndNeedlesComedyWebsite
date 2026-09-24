import { closedMessage, sanitizeSubmission, submissionWindow } from "@/lib/decisions";
import { messageToDecision, verifyTwilioSignature } from "@/lib/sms";
import { getContent } from "@/lib/store";
import { addSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/**
 * Inbound texts, from Twilio.
 *
 * Point the number's "A message comes in" webhook at this route and a text
 * becomes a submission in the same pile as the web form, drawn the same way.
 * The sender's number is never stored: the form is anonymous by default and a
 * text should not be a quieter way of being identified.
 *
 * Every reply is TwiML, because the useful acknowledgement is a text back
 * rather than a status code nobody sees.
 */
function reply(message: string, status = 200): Response {
  const escaped = message.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"
  );
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status, headers: { "Content-Type": "text/xml; charset=utf-8" } }
  );
}

/** Silence, for anything that should not get a text back. */
function quiet(status: number): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status, headers: { "Content-Type": "text/xml; charset=utf-8" } }
  );
}

/**
 * The URLs Twilio might have signed.
 *
 * It signs the address it dialled, which behind a proxy is not what the server
 * sees — the forwarded protocol and host have to be put back together. An
 * explicit TWILIO_WEBHOOK_URL wins when a deployment answers to several names.
 */
function candidateUrls(request: Request): string[] {
  const urls = new Set<string>();
  const configured = process.env.TWILIO_WEBHOOK_URL;
  if (configured) urls.add(configured);

  urls.add(request.url);

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    urls.add(`${proto}://${host}${new URL(request.url).pathname}`);
  }
  return [...urls];
}

export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    // Fail closed: with no token there is nothing to verify against, and an
    // unverified endpoint that writes to the pile is an open one.
    console.error("[sms] TWILIO_AUTH_TOKEN is not set; refusing inbound messages.");
    return quiet(503);
  }

  let params: Record<string, string>;
  try {
    const form = await request.formData();
    params = Object.fromEntries(
      [...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])
    );
  } catch {
    return quiet(400);
  }

  if (
    !verifyTwilioSignature(
      token,
      request.headers.get("x-twilio-signature"),
      candidateUrls(request),
      params
    )
  ) {
    console.error("[sms] rejected a message with a bad signature.");
    return quiet(403);
  }

  const content = await getContent();
  const { weekly } = content;
  if (!weekly.enabled) return quiet(404);

  const gate = submissionWindow(weekly, content.shows);
  if (!gate.open) {
    return reply(closedMessage(weekly, gate) || "Submissions are closed right now.");
  }

  const clean = sanitizeSubmission({ decision: messageToDecision(params.Body || "") });
  if (!clean) return reply("Send the decision itself and we'll put it in the pile.");

  try {
    await addSubmission(clean.decision, "");
  } catch (error) {
    console.error("[sms] save failed:", error);
    return reply("Couldn't save that one — try sending it again.");
  }

  return reply(weekly.thanksText || "Got it — it's in the pile.");
}
