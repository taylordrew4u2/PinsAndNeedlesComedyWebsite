import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PICTURE_MAX_BYTES, hasTransparency, isPicture, megabytes, pictureName, pictureProblem, pictureType, shrunkSize,
} from "../src/lib/picture-upload.ts";
import { QR_IMAGE_MAX_PX } from "../src/lib/screen-qr.ts";

test("a picture is known by its type, or by its ending when the phone gives no type", () => {
  assert.equal(isPicture({ type: "image/jpeg", name: "photo.jpg" }), true);
  assert.equal(isPicture({ type: "image/heic", name: "IMG_0001.HEIC" }), true);
  assert.equal(isPicture({ type: "IMAGE/PNG", name: "logo" }), true);
  assert.equal(isPicture({ type: "", name: "logo.PNG" }), true);
  assert.equal(isPicture({ type: "", name: "menu.webp" }), true);
  // The type wins over the ending: a video named like a picture is still a video.
  assert.equal(isPicture({ type: "video/mp4", name: "clip.jpg" }), false);
  assert.equal(isPicture({ type: "application/pdf", name: "menu.pdf" }), false);
  assert.equal(isPicture({ type: "", name: "menu.pdf" }), false);
  assert.equal(isPicture({ type: "", name: "" }), false);
});

test("what stops a file going up, in plain words", () => {
  assert.equal(pictureProblem({ type: "image/png", name: "logo.png", size: 120_000 }), "");
  assert.equal(pictureProblem({ type: "image/jpeg", name: "big.jpg", size: PICTURE_MAX_BYTES }), "");
  assert.match(pictureProblem({ type: "application/pdf", name: "menu.pdf", size: 1000 }), /isn't a picture/);
  const huge = pictureProblem({ type: "image/jpeg", name: "raw.jpg", size: PICTURE_MAX_BYTES + 1 });
  assert.match(huge, /too big/);
  assert.match(huge, /20\.0 MB at most/);
  assert.match(pictureProblem({ type: "image/png", name: "empty.png", size: 0 }), /empty/);
  assert.equal(megabytes(3.4 * 1024 * 1024), "3.4 MB");
});

test("a picture is shrunk to the most on its long side, same shape, never made bigger", () => {
  assert.deepEqual(shrunkSize(4032, 3024), { width: QR_IMAGE_MAX_PX, height: 810 });
  assert.deepEqual(shrunkSize(3024, 4032), { width: 810, height: QR_IMAGE_MAX_PX });
  assert.deepEqual(shrunkSize(500, 500), { width: 500, height: 500 });
  assert.deepEqual(shrunkSize(1080, 1080), { width: 1080, height: 1080 });
  // A drawing with no size of its own is drawn as a square at the most.
  assert.deepEqual(shrunkSize(0, 0), { width: QR_IMAGE_MAX_PX, height: QR_IMAGE_MAX_PX });
  assert.deepEqual(shrunkSize(300, Number.NaN), { width: QR_IMAGE_MAX_PX, height: QR_IMAGE_MAX_PX });
});

test("see-through pixels keep a PNG; a solid picture goes up as JPEG", () => {
  const solid = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const clear = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]);
  const half = new Uint8ClampedArray([10, 20, 30, 128]);
  assert.equal(hasTransparency(solid), false);
  assert.equal(hasTransparency(clear), true);
  assert.equal(hasTransparency(half), true);
  assert.equal(hasTransparency([]), false);
  assert.equal(pictureType(true), "image/png");
  assert.equal(pictureType(false), "image/jpeg");
});

test("a shrunk picture keeps its own name with the new ending", () => {
  assert.equal(pictureName("IMG_1234.HEIC", "image/jpeg"), "IMG_1234.jpg");
  assert.equal(pictureName("bar logo (final).png", "image/png"), "bar-logo-final.png");
  assert.equal(pictureName("menu.special.webp", "image/jpeg"), "menu.special.jpg");
  assert.equal(pictureName("", "image/png"), "qr-picture.png");
  assert.equal(pictureName("..png", "image/jpeg"), "qr-picture.jpg");
  assert.ok(pictureName(`${"x".repeat(200)}.jpg`, "image/jpeg").length <= 64);
});
