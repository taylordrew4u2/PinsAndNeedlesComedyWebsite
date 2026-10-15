import { test } from "node:test";
import assert from "node:assert/strict";
import { eachUnseen, type MailMessage, type MailboxClient } from "../src/lib/mailbox.ts";

type Call = { method: string; range?: string; options?: Record<string, unknown> };

/**
 * A mailbox that records how each call addressed its messages.
 *
 * The bug this guards against was invisible to any test of the parsing: the
 * search asked for sequence numbers while the flag update read the same
 * numbers as UIDs, so the message just ingested stayed unread and a different
 * one was marked read. During a show the panel polls every fifteen seconds,
 * so one text would have been added to the pile again and again.
 */
function fakeMailbox(uids: number[], bodies: Record<number, string> = {}) {
  const calls: Call[] = [];
  const client: MailboxClient = {
    async search(_query, options) {
      calls.push({ method: "search", options });
      return uids;
    },
    async fetchOne(range, _query, options) {
      calls.push({ method: "fetchOne", range, options });
      const source = bodies[Number(range)];
      if (source === undefined) return false;
      return { envelope: { subject: "s" }, source: { toString: () => source } } as MailMessage;
    },
    async messageFlagsAdd(range, flags, options) {
      calls.push({ method: `flags:${flags.join(",")}`, range, options });
      return true;
    },
  };
  return { client, calls };
}

test("every call in a pass addresses messages by UID", () => {
  const { client, calls } = fakeMailbox([11, 12], { 11: "a", 12: "b" });
  return eachUnseen(client, 10, async () => {}).then(() => {
    for (const call of calls) {
      assert.deepEqual(call.options, { uid: true }, `${call.method} did not ask for UIDs`);
    }
    // The search must ask for UIDs too — without it the server answers with
    // sequence numbers and every later call is addressing something else.
    assert.equal(calls[0].method, "search");
    assert.deepEqual(calls[0].options, { uid: true });
  });
});

test("the message marked read is the one that was just fetched", async () => {
  const { client, calls } = fakeMailbox([11, 12], { 11: "a", 12: "b" });
  await eachUnseen(client, 10, async () => {});

  const fetched = calls.filter((c) => c.method === "fetchOne").map((c) => c.range);
  const marked = calls.filter((c) => c.method.startsWith("flags:")).map((c) => c.range);
  assert.deepEqual(fetched, ["11", "12"]);
  assert.deepEqual(marked, ["11", "12"]);
});

test("each message is handled once and then marked read", async () => {
  const { client, calls } = fakeMailbox([7], { 7: "only" });
  const seen: string[] = [];
  await eachUnseen(client, 10, async (message) => {
    seen.push(message.source?.toString("utf8") || "");
  });

  assert.deepEqual(seen, ["only"]);
  // Marking read is what stops the next poll re-adding the same decision.
  assert.equal(calls.filter((c) => c.method === "flags:\\Seen").length, 1);
});

test("only the newest batch is taken, and all of it is marked read", async () => {
  const uids = [1, 2, 3, 4, 5];
  const { client, calls } = fakeMailbox(uids, Object.fromEntries(uids.map((u) => [u, "x"])));
  await eachUnseen(client, 2, async () => {});

  assert.deepEqual(
    calls.filter((c) => c.method === "fetchOne").map((c) => c.range),
    ["4", "5"]
  );
  assert.deepEqual(
    calls.filter((c) => c.method.startsWith("flags:")).map((c) => c.range),
    ["4", "5"]
  );
});

test("a message that cannot be fetched is still marked read", async () => {
  // Otherwise one unreadable message is retried on every single poll.
  const { client, calls } = fakeMailbox([3], {});
  let handled = 0;
  await eachUnseen(client, 10, async () => {
    handled += 1;
  });

  assert.equal(handled, 0);
  assert.deepEqual(
    calls.filter((c) => c.method.startsWith("flags:")).map((c) => c.range),
    ["3"]
  );
});

test("an empty or refused search does nothing at all", async () => {
  const answers: (number[] | false | undefined)[] = [[], false, undefined];
  for (const answer of answers) {
    const calls: Call[] = [];
    const client: MailboxClient = {
      async search() {
        return answer;
      },
      async fetchOne(range) {
        calls.push({ method: "fetchOne", range });
        return false;
      },
      async messageFlagsAdd(range) {
        calls.push({ method: "flags", range });
        return true;
      },
    };
    await eachUnseen(client, 10, async () => {});
    assert.deepEqual(calls, [], String(answer));
  }
});

test("each fetch asks when the message arrived, as well as what it says", async () => {
  // Without the arrival time, a text sent just before the host closed
  // questions cannot be told from one sent after.
  const queries: Record<string, unknown>[] = [];
  const client: MailboxClient = {
    async search() {
      return [5];
    },
    async fetchOne(_range, query) {
      queries.push(query);
      return { internalDate: new Date("2026-09-04T01:29:40Z") };
    },
    async messageFlagsAdd() {
      return true;
    },
  };
  const arrived: unknown[] = [];
  await eachUnseen(client, 10, async (message) => {
    arrived.push(message.internalDate);
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].internalDate, true);
  assert.equal(queries[0].envelope, true);
  assert.equal(queries[0].source, true);
  assert.deepEqual(arrived, [new Date("2026-09-04T01:29:40Z")]);
});
