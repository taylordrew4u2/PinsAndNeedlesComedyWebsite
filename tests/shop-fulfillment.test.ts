import { test } from "node:test";
import assert from "node:assert/strict";
import { fulfillPrintifyOrder, PrintifyError } from "../src/lib/shop-fulfillment.ts";

function fixture() {
  let claimed = false;
  let exists = false, status = "on-hold", saved: string | undefined;
  let createCount = 0, sendCount = 0, failSave = false, loseCreate = false, failSend = false, loseSend = false;
  const events: string[] = [];
  const input = () => ({ shopId: "shop1", externalId: "cs_123", existingId: saved, body: {}, hold: false });
  const io = {
    claimProduction: async () => { if (claimed) return false; claimed = true; return true; },
    call: async (path: string, init?: RequestInit): Promise<unknown> => {
      if (path.endsWith("/send_to_production.json")) {
        events.push("send"); sendCount++;
        if (failSend) { failSend = false; throw new Error("temporary failure"); }
        status = "sending-to-production";
        if (loseSend) { loseSend = false; throw new Error("lost response"); }
        return {};
      }
      if (init?.method === "POST") {
        assert.equal(JSON.parse(String(init.body)).external_id, "cs_123");
        if (exists) throw new PrintifyError(409, { order: { id: "order1", external_id: "cs_123" } });
        exists = true; createCount++; events.push("create");
        if (loseCreate) { loseCreate = false; throw new Error("lost create response"); }
        return { id: "order1" };
      }
      return { id: "order1", status, metadata: { shop_order_id: "cs_123" } };
    },
    saveOrder: async (id: string, shop: string) => {
      assert.equal(shop, "shop1"); events.push("save");
      if (failSave) { failSave = false; throw new Error("Stripe unavailable"); }
      saved = id;
    },
  };
  return { input, io, events, counts: () => [createCount, sendCount],
    failSave: () => { failSave = true; }, loseCreate: () => { loseCreate = true; },
    failSend: () => { failSend = true; }, loseSend: () => { loseSend = true; },
    status: (s: string) => { status = s; }, };
}

test("persists order and shop before sending; duplicate delivery does not resend", async () => {
  const f = fixture(); await fulfillPrintifyOrder(f.input(), f.io);
  assert.deepEqual(f.events, ["create", "save", "send"]);
  await fulfillPrintifyOrder(f.input(), f.io); assert.deepEqual(f.counts(), [1, 1]);
});
test("metadata failure recovers via 409 without making a second order", async () => {
  const f = fixture(); f.failSave();
  await assert.rejects(fulfillPrintifyOrder(f.input(), f.io)); assert.deepEqual(f.counts(), [1, 0]);
  await fulfillPrintifyOrder(f.input(), f.io); assert.deepEqual(f.counts(), [1, 1]);
});
test("lost create response recovers the provider's existing ID", async () => {
  const f = fixture(); f.loseCreate(); await assert.rejects(fulfillPrintifyOrder(f.input(), f.io));
  await fulfillPrintifyOrder(f.input(), f.io); assert.deepEqual(f.counts(), [1, 1]);
});
test("production failure retains permanent claim and requires review rather than resending", async () => {
  const f = fixture(); f.failSend(); await assert.rejects(fulfillPrintifyOrder(f.input(), f.io));
  await assert.rejects(fulfillPrintifyOrder(f.input(), f.io), /outcome uncertain/); assert.deepEqual(f.counts(), [1, 1]);
});
test("lost production response is reconciled by reading provider state", async () => {
  const f = fixture(); f.loseSend(); await fulfillPrintifyOrder(f.input(), f.io);
  await fulfillPrintifyOrder(f.input(), f.io); assert.deepEqual(f.counts(), [1, 1]);
});
test("concurrent deliveries resolve to same unique provider order", async () => {
  const f = fixture(); const a = f.input(), b = f.input();
  const results = await Promise.allSettled([fulfillPrintifyOrder(a, f.io), fulfillPrintifyOrder(b, f.io)]);
  assert.ok(results.some(r => r.status === "fulfilled")); assert.deepEqual(f.counts(), [1, 1]);
});
test("hold persists identity without sending", async () => {
  const f = fixture(); await fulfillPrintifyOrder({ ...f.input(), hold: true }, f.io);
  assert.deepEqual(f.counts(), [1, 0]);
});
for (const status of ["canceled", "has-issues", "payment-not-received", "unknown"]) {
  test(`does not silently acknowledge or replace ${status} orders`, async () => {
    const f = fixture(); f.status(status);
    await assert.rejects(fulfillPrintifyOrder(f.input(), f.io), /needs review/);
    assert.deepEqual(f.counts(), [1, 0]);
  });
}
test("rejects malformed or unrelated duplicate responses", async () => {
  for (const order of [undefined, { id: "wrong", external_id: "other" }]) {
    const f = fixture(); f.io.call = async () => { throw new PrintifyError(409, { order }); };
    await assert.rejects(fulfillPrintifyOrder(f.input(), f.io));
  }
});
test("rejects saved ID that belongs to another checkout", async () => {
  const f = fixture(); f.io.call = async () => ({ id: "order1", status: "on-hold", metadata: { shop_order_id: "other" } });
  await assert.rejects(fulfillPrintifyOrder({ ...f.input(), existingId: "order1" }, f.io), /does not match/);
  assert.deepEqual(f.events, []);
});
test("accepted and fulfilled orders are not sent again", async () => {
  for (const status of ["sending-to-production", "in-production", "fulfilled", "partially-fulfilled"]) {
    const f = fixture(); f.status(status); await fulfillPrintifyOrder(f.input(), f.io);
    assert.deepEqual(f.counts(), [1, 0]);
  }
});

for (const status of ["pending", "cost-calculation"]) {
  test(`transient ${status} resumes when ready`, async () => {
    const f = fixture(); f.status(status);
    await assert.rejects(fulfillPrintifyOrder(f.input(), f.io), /not ready/);
    assert.deepEqual(f.counts(), [1, 0]); f.status("on-hold");
    await fulfillPrintifyOrder(f.input(), f.io); assert.deepEqual(f.counts(), [1, 1]);
  });
}
test("lost durable claim response never sends, including on retry", async () => {
  const f = fixture(); let calls = 0;
  f.io.claimProduction = async () => { if (++calls === 1) throw new Error("response lost"); return false; };
  await assert.rejects(fulfillPrintifyOrder(f.input(), f.io));
  await assert.rejects(fulfillPrintifyOrder(f.input(), f.io), /outcome uncertain/);
  assert.deepEqual(f.counts(), [1, 0]);
});
test("preexisting claim survives process restart and blocks unknown outcome", async () => {
  const f = fixture(); f.io.claimProduction = async () => false;
  await assert.rejects(fulfillPrintifyOrder(f.input(), f.io), /outcome uncertain/);
  assert.deepEqual(f.counts(), [1, 0]);
  f.status("in-production"); await fulfillPrintifyOrder(f.input(), f.io);
  assert.deepEqual(f.counts(), [1, 0]);
});
