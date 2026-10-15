/**
 * Walking an IMAP mailbox for the messages that have not been read yet.
 *
 * Kept out of the route and typed against the small shape it actually uses
 * rather than against imapflow, so the addressing can be tested with a fake
 * client. That matters more than it sounds: IMAP identifies a message two
 * different ways — by sequence number, which shifts as the mailbox changes,
 * and by UID, which does not — and every call in a pass has to agree on which
 * one it is being handed. Disagreeing marks the wrong message read and leaves
 * the real one unread, so the next poll reads it again.
 */

/** Only the parts of a fetched message this needs. */
export type MailMessage = {
  envelope?: { subject?: string; from?: { address?: string }[] };
  source?: { toString(encoding: string): string };
  /** When the message reached the mailbox. A string only when the server's date would not parse. */
  internalDate?: Date | string;
};

/**
 * What to fetch for each message. The arrival time is what tells a text sent
 * just before the host closed questions from one sent after.
 */
const FETCH = { envelope: true, source: true, internalDate: true };

export type MailboxClient = {
  search(
    query: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<number[] | false | undefined>;
  fetchOne(
    range: string,
    query: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<MailMessage | false | undefined>;
  messageFlagsAdd(
    range: string,
    flags: string[],
    options?: Record<string, unknown>
  ): Promise<unknown>;
};

/**
 * Address messages by UID everywhere.
 *
 * Passed to the search as well, which is the part that is easy to miss:
 * without it the server answers with sequence numbers, and handing one of
 * those to a call that expects a UID silently acts on a different message.
 */
const BY_UID = { uid: true };

/**
 * Hand each unread message to `handle`, newest `batch` first, marking every
 * one read afterwards so it is never processed twice — including one that
 * could not be fetched or that `handle` made nothing of, which would
 * otherwise come back on every later pass.
 */
export async function eachUnseen(
  client: MailboxClient,
  batch: number,
  handle: (message: MailMessage) => Promise<void>
): Promise<void> {
  const unseen = (await client.search({ seen: false }, BY_UID)) || [];

  for (const uid of unseen.slice(-batch)) {
    const id = String(uid);
    const message = await client.fetchOne(id, FETCH, BY_UID);
    if (message) await handle(message);
    await client.messageFlagsAdd(id, ["\\Seen"], BY_UID);
  }
}
