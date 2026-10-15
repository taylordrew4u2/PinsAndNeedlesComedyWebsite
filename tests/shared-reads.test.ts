import { test } from "node:test";
import assert from "node:assert/strict";
import { SharedReads } from "../src/lib/shared-reads.ts";

/** A read that counts how often it really ran. */
function counted() {
  let runs = 0;
  return { read: async () => ++runs, runs: () => runs };
}

test("SharedReads: callers within the window share one read, per key", async () => {
  const shared = new SharedReads<number>(1_000);
  const live = counted();
  const rehearsal = counted();
  assert.equal(await shared.get("live", 0, live.read, 10_000), 1);
  assert.equal(await shared.get("live", 0, live.read, 10_999), 1);
  assert.equal(live.runs(), 1);
  // The rehearsal's screen has its own records.
  assert.equal(await shared.get("rehearsal", 0, rehearsal.read, 10_500), 1);
  assert.equal(rehearsal.runs(), 1);
  assert.equal(live.runs(), 1);
});

test("SharedReads: polls still waiting on a read share it rather than starting their own", async () => {
  const shared = new SharedReads<number>(1_000);
  const live = counted();
  const [a, b] = await Promise.all([shared.get("live", 0, live.read, 0), shared.get("live", 0, live.read, 5)]);
  assert.deepEqual([a, b, live.runs()], [1, 1, 1]);
});

test("SharedReads: a second old, or a clock gone backwards, reads afresh", async () => {
  const shared = new SharedReads<number>(1_000);
  const live = counted();
  await shared.get("live", 0, live.read, 10_000);
  assert.equal(await shared.get("live", 0, live.read, 11_000), 2);
  assert.equal(await shared.get("live", 0, live.read, 10_500), 3);
});

test("SharedReads: a write in between is never answered from reads taken before it", async () => {
  const shared = new SharedReads<number>(1_000);
  const live = counted();
  await shared.get("live", 4, live.read, 10_000);
  assert.equal(await shared.get("live", 5, live.read, 10_100), 2);
  // And the fresh read is shared from then on.
  assert.equal(await shared.get("live", 5, live.read, 10_200), 2);
});

test("SharedReads: a failed read is not kept, so the next poll tries again", async () => {
  const shared = new SharedReads<number>(1_000);
  let runs = 0;
  const flaky = async () => {
    runs += 1;
    if (runs === 1) throw new Error("GitHub said no");
    return runs;
  };
  await assert.rejects(shared.get("live", 0, flaky, 10_000));
  assert.equal(await shared.get("live", 0, flaky, 10_100), 2);
  assert.equal(await shared.get("live", 0, flaky, 10_200), 2);
});
