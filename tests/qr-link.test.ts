import { test } from "node:test";
import assert from "node:assert/strict";
import { QR_LINK_LABEL, qrLinkSig, signedQrSrc, validQrLinkSig } from "../src/lib/qr-link.ts";
import { DECISIONS_QR_SRC, isLiveQrSrc } from "../src/lib/screen-qr.ts";

const SECRET = "test-secret";
const LINK = "https://www.instagram.com/pixelatedrecords/";

test("a link's signature is the same every time, and different for another link or another secret", () => {
  const sig = qrLinkSig(LINK, SECRET);
  assert.match(sig, /^[a-f0-9]{32}$/);
  assert.equal(qrLinkSig(LINK, SECRET), sig);
  assert.notEqual(qrLinkSig("https://example.com/", SECRET), sig);
  assert.notEqual(qrLinkSig(LINK, "another-secret"), sig);
  // Its own label, so it can never stand in for the Bad Decisions signatures.
  assert.equal(QR_LINK_LABEL, "screen-qr-link-v1");
});

test("nothing is signed without a secret, or for a link that isn't exactly as it would be saved", () => {
  assert.equal(qrLinkSig(LINK, ""), "");
  assert.equal(qrLinkSig("http://example.com/", SECRET), "");
  assert.equal(qrLinkSig("https://Example.com", SECRET), "", "the browser would spell it https://example.com/");
  assert.equal(qrLinkSig("", SECRET), "");
  assert.equal(signedQrSrc(LINK, ""), null);
  assert.equal(signedQrSrc("javascript:alert(1)", SECRET), null);
});

test("a signature is only good for its own link", () => {
  const sig = qrLinkSig(LINK, SECRET);
  assert.ok(validQrLinkSig(LINK, sig, SECRET));
  assert.ok(!validQrLinkSig("https://www.instagram.com/someoneelse/", sig, SECRET), "a changed link");
  assert.ok(!validQrLinkSig(LINK, `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`, SECRET), "a changed signature");
  assert.ok(!validQrLinkSig(LINK, sig.slice(0, 31), SECRET), "too short");
  assert.ok(!validQrLinkSig(LINK, `${sig}0`, SECRET), "too long");
  assert.ok(!validQrLinkSig(LINK, sig.toUpperCase(), SECRET));
  assert.ok(!validQrLinkSig(LINK, sig, "another-secret"));
  assert.ok(!validQrLinkSig(LINK, sig, ""));
  for (const [link, signature] of [[null, sig], [LINK, null], [42, sig], [LINK, 42], [[LINK], sig]] as const) {
    assert.ok(!validQrLinkSig(link, signature, SECRET), JSON.stringify([link, signature]));
  }
});

test("the screen's image address for a link carries it and its signature, and reads back through a URL", () => {
  const src = signedQrSrc(LINK, SECRET);
  assert.ok(src);
  assert.ok(src.startsWith(`${DECISIONS_QR_SRC}?`));
  assert.ok(isLiveQrSrc(src));
  const params = new URL(src, "https://pinsandneedlescomedy.com").searchParams;
  assert.equal(params.get("to"), LINK);
  assert.ok(validQrLinkSig(params.get("to"), params.get("sig"), SECRET));
});
