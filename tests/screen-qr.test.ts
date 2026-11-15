import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASSET_URL_MAX, DECISIONS_QR_SRC, DEFAULT_QR_SIZE, FORM_QR, QR_BASE, QR_KINDS, QR_LINK_LONG, QR_LINK_MAX, QR_SIZE_MAX, QR_SIZE_MIN, adminQrPreviewSrc, boardQr,
  cleanAssetUrl, cleanQrLink, fitWithin, isLiveQrSrc, isQrKind, isQrSize, linkLabel, longLink, qrChoiceProblem, qrPercent, qrSide, readShownQr, withHttps,
} from "../src/lib/screen-qr.ts";

test("a QR's link: a secure web address with a real host name, kept as the browser spells it", () => {
  assert.equal(cleanQrLink("https://www.instagram.com/pixelatedrecords/"), "https://www.instagram.com/pixelatedrecords/");
  assert.equal(cleanQrLink(" https://Example.com "), "https://example.com/");
  assert.equal(cleanQrLink("https://example.com/menu?table=4#drinks"), "https://example.com/menu?table=4#drinks");
  for (const raw of [
    "http://example.com", "javascript:alert(1)", "data:text/html,hi", "//example.com/x", "https://user:pw@example.com", "https://user@example.com",
    "https://exa mple.com", "https://example.com/a b", "https://example.com\\evil", "https://localhost/x", "https://example", "ftp://example.com",
    `https://example.com/${"x".repeat(QR_LINK_MAX)}`, "", "   ", 42, null, { href: "https://example.com" },
  ]) {
    assert.equal(cleanQrLink(raw), "", JSON.stringify(raw));
  }
  // Exactly at the limit is fine; one past it is not.
  const at = `https://example.com/${"x".repeat(QR_LINK_MAX - "https://example.com/".length)}`;
  assert.equal(cleanQrLink(at), at);
  assert.equal(cleanQrLink(`${at}y`), "");
});

test("https:// goes in front of a bare address, never in place of http://", () => {
  assert.equal(withHttps(" instagram.com/bar "), "https://instagram.com/bar");
  assert.equal(withHttps("//instagram.com/bar"), "https://instagram.com/bar");
  assert.equal(withHttps("localhost:3000/x"), "https://localhost:3000/x");
  assert.equal(withHttps("https://example.com"), "https://example.com");
  assert.equal(withHttps("http://example.com"), "http://example.com");
  assert.equal(withHttps("mailto:a@b.com"), "mailto:a@b.com");
  assert.equal(withHttps("   "), "");
});

test("a link as a person reads it under a code, and when it is long enough to make a dense code", () => {
  assert.equal(linkLabel("https://www.instagram.com/pixelatedrecords/"), "instagram.com/pixelatedrecords");
  assert.equal(linkLabel("https://example.com"), "example.com");
  assert.equal(linkLabel(`https://example.com/${"x".repeat(80)}`, 20), `example.com/${"x".repeat(7)}…`);
  assert.equal(linkLabel(`https://example.com/${"x".repeat(80)}`, 20).length, 20);
  assert.equal(longLink(`https://example.com/${"x".repeat(QR_LINK_LONG)}`), true);
  assert.equal(longLink("https://example.com/menu"), false);
});

test("a picture's or sound's address: on this site or a secure one, and nothing else", () => {
  assert.equal(cleanAssetUrl("/uploads/a.webp"), "/uploads/a.webp");
  assert.equal(cleanAssetUrl(" /api/media/a.png "), "/api/media/a.png");
  assert.equal(cleanAssetUrl("https://store.public.blob.vercel-storage.com/uploads/a.webp"), "https://store.public.blob.vercel-storage.com/uploads/a.webp");
  for (const raw of [
    "", "http://example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "//example.com/a.png", "/\\example.com/a.png",
    "uploads/a.png", "/uploads/my a.png", "https://", `/${"x".repeat(ASSET_URL_MAX)}`, 42, null,
  ]) {
    assert.equal(cleanAssetUrl(raw), "", JSON.stringify(raw));
  }
});

test("a QR's size is a whole step of 10 from 50% to 200%, and each place draws it up to its own largest", () => {
  for (const size of [QR_SIZE_MIN, 60, DEFAULT_QR_SIZE, 150, QR_SIZE_MAX]) assert.ok(isQrSize(size), String(size));
  for (const size of [40, 45, 105, 210, 99.9, "100", null, Number.NaN]) assert.ok(!isQrSize(size), String(size));
  // At 100%: today's corner, menu and Intro codes.
  assert.equal(qrSide("corner", 100), 160);
  assert.equal(qrSide("menu", 100), 220);
  assert.equal(qrSide("explainer", 100), 40);
  assert.equal(qrSide("corner", 50), 80);
  assert.equal(qrSide("menu", 200), 440);
  // The Intro stops at 140%, where the steps beside the code would run out of room.
  assert.equal(QR_BASE.explainer.maxPercent, 140);
  assert.equal(qrPercent("explainer", 200), 140);
  assert.equal(qrSide("explainer", 200), 56);
  assert.equal(qrPercent("corner", 200), 200);
  // Anything unknown is the usual size.
  for (const size of [undefined, "big", 105, 0]) assert.equal(qrSide("menu", size), 220, String(size));
});

test("where a QR leads: the record's default, a link or a picture, and nothing else", () => {
  assert.deepEqual(QR_KINDS, ["", "link", "picture"]);
  for (const kind of QR_KINDS) assert.ok(isQrKind(kind));
  for (const kind of ["form", "LINK", null, 0]) assert.ok(!isQrKind(kind), String(kind));
});

test("a picture shrinks to fit its long side, keeps its shape, and is never made bigger", () => {
  assert.deepEqual(fitWithin(4032, 3024, 1080), { width: 1080, height: 810 });
  assert.deepEqual(fitWithin(3024, 4032, 1080), { width: 810, height: 1080 });
  assert.deepEqual(fitWithin(600, 400, 1080), { width: 600, height: 400 });
  assert.deepEqual(fitWithin(5000, 1, 1080), { width: 1080, height: 1 });
  assert.deepEqual(fitWithin(0, 0, 1080), { width: 1, height: 1 });
  assert.deepEqual(fitWithin(Number.NaN, 200, 100), { width: 1, height: 100 });
});

test("the live screen's own codes: the question form, or the same route with a signed link, and nothing from elsewhere", () => {
  assert.ok(isLiveQrSrc(DECISIONS_QR_SRC));
  assert.ok(isLiveQrSrc(`${DECISIONS_QR_SRC}?to=${encodeURIComponent("https://example.com/x")}&sig=${"a".repeat(32)}`));
  assert.ok(isLiveQrSrc(`${DECISIONS_QR_SRC}?mode=rehearsal`));
  for (const raw of [
    "//evil.example/api/decisions/live/qr", "https://evil.example/api/decisions/live/qr", `${DECISIONS_QR_SRC}x`, `${DECISIONS_QR_SRC}?to=https://evil.example`,
    `${DECISIONS_QR_SRC}?to=a b`, `${DECISIONS_QR_SRC}?to=a\\b`, `${DECISIONS_QR_SRC}?${"x".repeat(1200)}`, "/api/admin/run-show/qr?to=x", 42, null,
  ]) {
    assert.ok(!isLiveQrSrc(raw), JSON.stringify(raw)?.slice(0, 60));
  }
  assert.equal(adminQrPreviewSrc("https://example.com/a b"), "/api/admin/run-show/qr?to=https%3A%2F%2Fexample.com%2Fa%20b");
});

test("a QR as the live screen receives it is checked, and drawn in each place at its size", () => {
  assert.deepEqual(readShownQr(FORM_QR), FORM_QR);
  const signed = `${DECISIONS_QR_SRC}?to=x&sig=${"a".repeat(32)}`;
  assert.deepEqual(readShownQr({ kind: "link", src: signed, size: 150 }), { kind: "link", src: signed, size: 150 });
  assert.deepEqual(readShownQr({ kind: "picture", src: "/uploads/a.webp", size: 105 }), { kind: "picture", src: "/uploads/a.webp", size: 100 });
  for (const raw of [
    null, "form", {}, { kind: "link", src: "https://evil.example/qr.svg" }, { kind: "form", src: "//evil.example" }, { kind: "picture", src: "javascript:alert(1)" },
    { kind: "picture", src: "" }, { kind: "video", src: DECISIONS_QR_SRC },
  ]) {
    assert.equal(readShownQr(raw), null, JSON.stringify(raw));
  }
  assert.equal(boardQr(null, "menu"), null);
  assert.deepEqual(boardQr(FORM_QR, "menu"), { src: DECISIONS_QR_SRC, picture: false, side: 220, alt: "Scan to submit your bad decision" });
  assert.deepEqual(boardQr({ kind: "link", src: signed, size: 200 }, "explainer"), { src: signed, picture: false, side: 56, alt: "Scan me" });
  assert.deepEqual(boardQr({ kind: "picture", src: "/uploads/a.webp", size: 50 }, "corner"), { src: "/uploads/a.webp", picture: true, side: 80, alt: "" });
});

test("what stops a QR choice from saving, in plain words", () => {
  assert.equal(qrChoiceProblem({ kind: "", to: "", image: "" }), "");
  assert.equal(qrChoiceProblem({ kind: "link", to: "https://example.com", image: "" }), "");
  assert.equal(qrChoiceProblem({ kind: "picture", to: "", image: "/uploads/a.webp" }), "");
  assert.match(qrChoiceProblem({ kind: "link", to: " ", image: "" }), /web address/);
  assert.match(qrChoiceProblem({ kind: "link", to: "http://example.com", image: "" }), /https:\/\//);
  assert.match(qrChoiceProblem({ kind: "link", to: `https://example.com/${"x".repeat(QR_LINK_MAX)}`, image: "" }), /too long/);
  assert.match(qrChoiceProblem({ kind: "link", to: "example.com", image: "" }), /https:\/\//);
  assert.match(qrChoiceProblem({ kind: "link", to: "javascript:alert(1)", image: "" }), /https:\/\//);
  assert.match(qrChoiceProblem({ kind: "picture", to: "", image: "" }), /Upload/);
  assert.match(qrChoiceProblem({ kind: "picture", to: "", image: "//evil.example/a.png" }), /can.t be used/);
  // A link left behind while the picture is picked doesn't matter, and the other way round.
  assert.equal(qrChoiceProblem({ kind: "picture", to: "http://old", image: "/uploads/a.webp" }), "");
  assert.equal(qrChoiceProblem({ kind: "", to: "http://old", image: "junk" }), "");
});
