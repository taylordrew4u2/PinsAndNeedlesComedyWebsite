import { test } from "node:test";
import assert from "node:assert/strict";
import { openSecret, sealSecret } from "../src/lib/secret-box.ts";
import { cleanApiKey, keyHint } from "../src/lib/ai-key.ts";

const SECRET = "a-long-random-server-secret-for-tests-0123456789";
const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789_-ABCD";

test("a sealed key opens again with the same server secret, and only with it", () => {
  const box = sealSecret(KEY, SECRET);
  assert.equal(openSecret(box, SECRET), KEY);
  assert.equal(openSecret(box, `${SECRET}x`), null, "another server's secret");
  assert.equal(openSecret(box, ""), null, "no secret at all");
  assert.ok(!JSON.stringify(box).includes("abcdefghij"), "nothing of the key shows in what is stored");
  assert.notDeepEqual(sealSecret(KEY, SECRET), box, "each seal is different, so two saves of one key don't match");
});

test("a box altered in any part, cut short, or not a box at all opens to nothing", () => {
  const box = sealSecret(KEY, SECRET);
  const flip = (text: string) => {
    const bytes = Buffer.from(text, "base64");
    bytes[0] ^= 1;
    return bytes.toString("base64");
  };
  assert.equal(openSecret({ ...box, data: flip(box.data) }, SECRET), null);
  assert.equal(openSecret({ ...box, tag: flip(box.tag) }, SECRET), null);
  assert.equal(openSecret({ ...box, iv: flip(box.iv) }, SECRET), null);
  assert.equal(openSecret({ ...box, tag: Buffer.from(box.tag, "base64").subarray(0, 4).toString("base64") }, SECRET), null, "a shortened tag");
  for (const junk of [null, "box", 3, {}, { ...box, v: 2 }, { ...box, data: 7 }]) assert.equal(openSecret(junk, SECRET), null, JSON.stringify(junk));
  assert.throws(() => sealSecret(KEY, ""));
});

test("a pasted key is tidied and checked; only its last four characters are ever shown", () => {
  assert.equal(cleanApiKey(`  ${KEY}\n`), KEY);
  assert.equal(cleanApiKey(`${KEY.slice(0, 20)}\n${KEY.slice(20)}`), KEY, "a line break picked up in the copy");
  for (const junk of ["", "sk-ant-short", "sk-proj-abcdefghijklmnopqrstuvwxyz", `${KEY}!`, 42, null]) assert.equal(cleanApiKey(junk), "", String(junk));
  assert.equal(keyHint(KEY), "ABCD");
  assert.equal(keyHint("short"), "");
});
