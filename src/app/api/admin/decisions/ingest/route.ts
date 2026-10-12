import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { sanitizeSubmission, submissionWindow, textIntake } from "@/lib/decisions";
import { looksLikeForwardedText, messageFromForward, textFromMime } from "@/lib/inbox";
import { eachUnseen, type MailboxClient } from "@/lib/mailbox";
import { getContent } from "@/lib/store";
import { addSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Pull texts out of the mailbox Google Voice forwards to.
 *
 * Google Voice is the only way to get a phone number for nothing, and it
 * cannot call a webhook — but it will forward every text to an email address.
 * So the site reads that mailbox instead, and a texted decision lands in the
 * same pile as one sent through the form.
 *
 * Driven by the admin's Tonight panel, which already polls while the host has
 * it open — which is exactly the hour this needs to run. That avoids a
 * scheduler entirely, and a scheduler is the part that is not free: Vercel's
 * hobby plan allows a cron job once a day, which is no use to a show.
 *
 * Requires a login, because it is the admin's own polling that calls it.
 */

/** How many unread messages to look at in one pass. */
const BATCH = 40;

type Ingested = { added: number; skipped: number; configured: boolean; error?: string };

function config() {
  const host = process.env.INBOX_IMAP_HOST || "imap.gmail.com";
  const user = process.env.INBOX_IMAP_USER;
  const pass = process.env.INBOX_IMAP_PASSWORD;
  const mailbox = process.env.INBOX_IMAP_MAILBOX || "INBOX";
  if (!user || !pass) return null;
  return { host, user, pass, mailbox, port: Number(process.env.INBOX_IMAP_PORT || 993) };
}

export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = config();
  if (!settings) {
    // Not an error: most deployments never set this up, and the panel simply
    // does not mention texting when it is off.
    return NextResponse.json<Ingested & { ok: true }>({
      ok: true,
      configured: false,
      added: 0,
      skipped: 0,
    });
  }

  const content = await getContent();
  const { weekly } = content;
  // In the window texts are added. While the host has closed questions they
  // are read and dropped, as the form turns people away; otherwise they stay
  // unread and come in once the window opens.
  const intake = textIntake(weekly, submissionWindow(weekly, content.shows));
  if (intake === "wait") {
    return NextResponse.json<Ingested & { ok: true }>({
      ok: true,
      configured: true,
      added: 0,
      skipped: 0,
    });
  }

  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: true,
    auth: { user: settings.user, pass: settings.pass },
    logger: false,
  });

  let added = 0;
  let skipped = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.mailbox);
    try {
      // eachUnseen owns the UID addressing and marks every message read.
      await eachUnseen(client as unknown as MailboxClient, BATCH, async (message) => {
        const from = message.envelope?.from?.[0]?.address || "";
        const subject = message.envelope?.subject || "";
        // Not a text, or the host has closed questions: marked read all the same, so it never comes back.
        if (intake === "drop" || !looksLikeForwardedText(from, subject)) {
          skipped += 1;
          return;
        }

        const raw = message.source?.toString("utf8") || "";
        // Voice sends multipart/alternative, so the readable part has to be
        // picked and decoded before any of it is read as a sentence.
        const clean = sanitizeSubmission({ decision: messageFromForward(textFromMime(raw)) });

        if (clean) {
          await addSubmission(clean.decision, "");
          added += 1;
        } else {
          skipped += 1;
        }
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("[ingest] mailbox read failed:", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json<Ingested & { ok: false }>(
      { ok: false, configured: true, added, skipped, error: detail || "Could not read the mailbox" },
      { status: 502 }
    );
  } finally {
    await client.logout().catch(() => {});
  }

  return NextResponse.json<Ingested & { ok: true }>({
    ok: true,
    configured: true,
    added,
    skipped,
  });
}
