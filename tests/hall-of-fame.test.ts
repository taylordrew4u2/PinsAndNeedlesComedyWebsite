import { test } from "node:test";
import assert from "node:assert/strict";
import { hallNavigation, performerLink, performerSocial, publishedPerformers } from "../src/lib/hall-of-fame.ts";
import { merge } from "../src/lib/merge.ts";
import type { HallOfFamePage, HallPerformer } from "../src/lib/types.ts";
const hall = { showInNav: true, performers: [] } as unknown as HallOfFamePage;

test("old saved navigation gets one Hall link and can hide it", () => {
  const nav = [{ id: "home", label: "Home", href: "/" }];
  const next = hallNavigation(nav, hall);
  assert.equal(next.length, 2);
  assert.deepEqual(hallNavigation(next, hall), next);
  assert.deepEqual(hallNavigation(next, { ...hall, showInNav: false }), nav);
  assert.equal(nav.length, 1);
});
test("only named published performers appear, alphabetically without changing saved order", () => {
  const people = [
    { id: "b", name: "B", published: true },
    { id: "draft", name: "Draft", published: false },
    { id: "blank", name: "  ", published: true },
    { id: "a", name: "A", published: true },
  ] as HallPerformer[];
  assert.deepEqual(publishedPerformers({ ...hall, performers: people }).map((p) => p.id), ["a", "b"]);
  assert.equal(people[0].id, "b");
});
test("links only allow web URLs", () => {
  assert.equal(performerLink("https://example.com/artist"), "https://example.com/artist");
  for (const value of ["javascript:alert(1)", "data:text/html,hi", "invalid", ""]) assert.equal(performerLink(value), null);
});
test("legacy content gains hall defaults and deleting all performers persists", () => {
  const defaults = { hallOfFame: { ...hall, performers: [{ id: "first" }] } };
  assert.deepEqual(merge(defaults, { site: { name: "Saved" } }).hallOfFame, defaults.hallOfFame);
  assert.deepEqual(merge(defaults, { hallOfFame: { performers: [] } }).hallOfFame.performers, []);
});

test("social handles create profile links and preserve legacy links", () => {
  const person = { socialHandle: " @some.comic ", socialPlatform: "instagram" } as HallPerformer;
  assert.deepEqual(performerSocial(person), { url: "https://www.instagram.com/some.comic", label: "@some.comic" });
  assert.equal(performerSocial({ ...person, socialPlatform: "tiktok" })?.url, "https://www.tiktok.com/@some.comic");
  assert.equal(performerSocial({ ...person, socialHandle: "https://evil.example" }), null);
  assert.equal(performerSocial({ ...person, socialHandle: "", linkUrl: "https://example.com", linkLabel: "Website" })?.label, "Website");
});
