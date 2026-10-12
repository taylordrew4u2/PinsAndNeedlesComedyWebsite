import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIET_BEFORE_RELOAD_MS, STALE_REPORT_MS, cleanBuild, currentBuild, isNewerBuild, maySelfReload, quietScreen, screenSignature, staleScreen } from "../src/lib/build.ts";

test("isNewerBuild: only a different, non-empty build on both sides counts", () => {
  assert.equal(isNewerBuild("dpl_a", "dpl_b"), true);
  assert.equal(isNewerBuild("dpl_a", "dpl_a"), false);
  // Off outside Vercel, and safe against old or odd answers.
  for (const server of ["", undefined, null, 42, {}]) assert.equal(isNewerBuild("dpl_a", server), false);
  assert.equal(isNewerBuild("", "dpl_b"), false);
});

test("quietScreen: reload only under the drink menu or a blank screen", () => {
  assert.equal(quietScreen({ menu: true, question: "Should I?" }), true);
  assert.equal(quietScreen({ menu: false, question: null, performer: null, explainer: null, segment: null }), true);
  assert.equal(quietScreen({ menu: false, question: "Should I?" }), false);
  assert.equal(quietScreen({ menu: false, question: null, performer: "Sam" }), false);
  assert.equal(quietScreen({ menu: false, question: null, explainer: "2026-10-09T00:00:00Z" }), false);
  assert.equal(quietScreen({ menu: false, question: null, segment: { remainingMs: 1 } }), false);
  // The host's own message is up: the room is reading it.
  assert.equal(quietScreen({ menu: false, question: null, performer: null, explainer: null, segment: null, message: { text: "Last call!", color: "#FFFFFF" } }), false);
  assert.equal(quietScreen({ menu: false, question: null, performer: null, explainer: null, segment: null, message: null }), true);
  assert.equal(quietScreen(null), false);
});

test("currentBuild: the deployment id, else the commit, else nothing", () => {
  const saved = { id: process.env.VERCEL_DEPLOYMENT_ID, sha: process.env.VERCEL_GIT_COMMIT_SHA };
  try {
    delete process.env.VERCEL_DEPLOYMENT_ID; delete process.env.VERCEL_GIT_COMMIT_SHA;
    assert.equal(currentBuild(), "");
    process.env.VERCEL_GIT_COMMIT_SHA = "abc";
    assert.equal(currentBuild(), "abc");
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_1";
    assert.equal(currentBuild(), "dpl_1");
  } finally {
    if (saved.id === undefined) delete process.env.VERCEL_DEPLOYMENT_ID; else process.env.VERCEL_DEPLOYMENT_ID = saved.id;
    if (saved.sha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA = saved.sha;
  }
});

/** What /api/decisions/live answers, in full, with nothing up. */
const blank = { question: null, name: null, menu: false, marquee: null, menuCustom: null, explainer: null, performer: null, build: "b", segment: null, screen: {}, message: null, soundTest: null };

test("quietScreen: the explainer, a set or a message over the drink menu is not quiet", () => {
  assert.equal(quietScreen({ ...blank, menu: true, marquee: "x" }), true);
  assert.equal(quietScreen({ ...blank, menu: true, explainer: "2026-10-12T00:00:00Z" }), false);
  assert.equal(quietScreen({ ...blank, menu: true, segment: { remainingMs: 1, nextSwitchMs: 1 } }), false);
  assert.equal(quietScreen({ ...blank, menu: true, message: { text: "Last call", color: "#FFFFFF" } }), false);
  assert.equal(quietScreen(blank), true);
});

test("screenSignature: the same screen gives the same string, any change a new one", () => {
  assert.equal(screenSignature({ ...blank }), screenSignature({ ...blank, soundTest: "2026-10-12T00:00:00Z", screen: { timer: false } }));
  for (const change of [{ menu: true }, { question: "Should I?" }, { performer: "Sam" }, { explainer: "x" }, { segment: { remainingMs: 1 } }, { message: { text: "Hi", color: "#FFFFFF" } }]) {
    assert.notEqual(screenSignature({ ...blank, ...change }), screenSignature(blank));
  }
  assert.notEqual(screenSignature({ ...blank, menu: true, menuCustom: { color: "#FF2E4D" } }), screenSignature({ ...blank, menu: true }));
  assert.equal(screenSignature(null), "");
});

test("maySelfReload: never in full screen, with tapped-on sound, while busy, twice, or before it has been quiet a while", () => {
  const ok = { tried: false, fullscreen: false, soundByTap: false, busy: false, quietForMs: QUIET_BEFORE_RELOAD_MS };
  assert.equal(maySelfReload(ok), true);
  assert.equal(maySelfReload({ ...ok, tried: true }), false);
  assert.equal(maySelfReload({ ...ok, fullscreen: true }), false);
  assert.equal(maySelfReload({ ...ok, soundByTap: true }), false);
  assert.equal(maySelfReload({ ...ok, busy: true }), false);
  assert.equal(maySelfReload({ ...ok, quietForMs: QUIET_BEFORE_RELOAD_MS - 1 }), false);
});

test("cleanBuild: deployment ids and commit hashes only", () => {
  assert.equal(cleanBuild("dpl_AbC123"), "dpl_AbC123");
  assert.equal(cleanBuild("4205e9af98380229864d47be1dbc9d7a536f25c0"), "4205e9af98380229864d47be1dbc9d7a536f25c0");
  for (const raw of ["", "a b", "x".repeat(101), "<script>", 42, null, undefined]) assert.equal(cleanBuild(raw), "");
});

test("staleScreen: a recent report of another build, and nothing else", () => {
  const now = Date.parse("2026-10-12T21:00:00Z");
  const at = new Date(now - 60_000).toISOString();
  assert.deepEqual(staleScreen({ build: "old", at }, "new", now), { at });
  // Up to date, too old, from the future, garbled, or off Vercel: no note.
  assert.equal(staleScreen({ build: "new", at }, "new", now), null);
  assert.equal(staleScreen({ build: "old", at: new Date(now - STALE_REPORT_MS).toISOString() }, "new", now), null);
  assert.equal(staleScreen({ build: "old", at: new Date(now + 60_000).toISOString() }, "new", now), null);
  assert.equal(staleScreen({ build: "old", at: "soon" }, "new", now), null);
  assert.equal(staleScreen({ build: "a b", at }, "new", now), null);
  assert.equal(staleScreen(null, "new", now), null);
  assert.equal(staleScreen({ build: "old", at }, "", now), null);
});
