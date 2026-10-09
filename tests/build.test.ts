import { test } from "node:test";
import assert from "node:assert/strict";
import { currentBuild, isNewerBuild, quietScreen } from "../src/lib/build.ts";

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
