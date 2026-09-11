import { test } from "node:test";
import assert from "node:assert/strict";
import { healAssetPaths, restoredAssetPath } from "../src/lib/assets.ts";

test("saved traced covers resolve to original photographs", () => {
  const path = "/posts/pins-and-needles-edinburgh-fringe-2026";
  assert.equal(restoredAssetPath(`${path}.svg`), `${path}.webp`);
  assert.equal(restoredAssetPath(`${path}.webp`), `${path}.webp`);
  const saved = { posts: [{ coverUrl: `${path}.svg` }] };
  assert.equal(healAssetPaths(saved).posts[0].coverUrl, `${path}.webp`);
  assert.equal(saved.posts[0].coverUrl, `${path}.svg`);
});

test("brand marks still resolve to vector; custom images are untouched", () => {
  assert.equal(restoredAssetPath("/brand/logo-white.png"), "/brand/logo-white.svg");
  for (const path of ["/uploads/photo.svg", "/posts/custom.svg", "/posts/custom.webp", "https://example.com/posts/photo.svg"]) {
    assert.equal(restoredAssetPath(path), path);
  }
});
