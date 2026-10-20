import { test } from "node:test";
import assert from "node:assert/strict";
import { PASTE_MAX, addPasted, instagramUrl, parseLineupPaste } from "../src/lib/lineup-paste.ts";
import type { ShowPerformer } from "../src/lib/types.ts";

const ig = instagramUrl;

test("parseLineupPaste: one person per line, each linked to their Instagram however it was typed", () => {
  const people = parseLineupPaste([
    "Sam Rivera @samcomic",
    "Jo Park - instagram.com/jopark",
    "Alex Kim (@alexkimcomedy)",
    "Dana Lee, https://www.instagram.com/danalee.laughs/?hl=en",
    "Chris Wu IG: chriswu_jokes",
    "Morgan Hale | www.morganhale.com",
    "Pat Doe",
  ].join("\n"), "Comedian");
  assert.deepEqual(people, [
    { name: "Sam Rivera", url: ig("samcomic"), role: "Comedian" },
    { name: "Jo Park", url: ig("jopark"), role: "Comedian" },
    { name: "Alex Kim", url: ig("alexkimcomedy"), role: "Comedian" },
    { name: "Dana Lee", url: ig("danalee.laughs"), role: "Comedian" },
    { name: "Chris Wu", url: ig("chriswu_jokes"), role: "Comedian" },
    { name: "Morgan Hale", url: "https://www.morganhale.com", role: "Comedian" },
    { name: "Pat Doe", url: "", role: "Comedian" },
  ]);
});

test("parseLineupPaste: a handle on its own line belongs to the name above it", () => {
  assert.deepEqual(parseLineupPaste("Priya Shah\n@priya.funny\nLee\n\nhttps://instagram.com/lee.does.comedy", "Comedian"), [
    { name: "Priya Shah", url: ig("priya.funny"), role: "Comedian" },
    { name: "Lee", url: ig("lee.does.comedy"), role: "Comedian" },
  ]);
});

test("parseLineupPaste: roles in front of a name, bullets, and several people on one line", () => {
  assert.deepEqual(parseLineupPaste("Host: Jo Park @jopark\n- Sam @sam, Alex @alex\n2. Special guest: Kim (@kim)", "Comedian"), [
    { name: "Jo Park", url: ig("jopark"), role: "Host" },
    { name: "Sam", url: ig("sam"), role: "Comedian" },
    { name: "Alex", url: ig("alex"), role: "Comedian" },
    { name: "Kim", url: ig("kim"), role: "Special guest" },
  ]);
  // "Name: @handle" is a name, not a role.
  assert.deepEqual(parseLineupPaste("Sam Rivera: @samcomic\nInstagram: @nobody", "Comedian"), [
    { name: "Sam Rivera", url: ig("samcomic"), role: "Comedian" },
    { name: "nobody", url: ig("nobody"), role: "Comedian" },
  ]);
});

test("parseLineupPaste: odd input stays sensible", () => {
  // A handle alone with nobody above it becomes the name; repeats are dropped; blank lines ignored.
  assert.deepEqual(parseLineupPaste("@solo\n\nSam @sam\nsam @sam2", "Host"), [
    { name: "solo", url: ig("solo"), role: "Host" },
    { name: "Sam", url: ig("sam"), role: "Host" },
  ]);
  // A post link is not anyone's account; a trailing full stop is not part of a handle; an email is not a handle.
  assert.deepEqual(parseLineupPaste("Jo https://www.instagram.com/p/Cx1/\nAl @al.\nBo bo@mail.com", "Comedian").map((p) => p.url), ["", ig("al"), ""]);
  assert.equal(parseLineupPaste(Array.from({ length: 100 }, (_, i) => `Person ${i} @p${i}`).join("\n"), "Comedian").length, PASTE_MAX);
  assert.deepEqual(parseLineupPaste("   \n\n", "Comedian"), []);
});

test("addPasted: new people are added; someone already on the bill only gets a missing link", () => {
  const lineup: ShowPerformer[] = [
    { id: "a", name: "Sam Rivera", role: "Host", note: "", imageUrl: "", imageAlt: "", url: "" },
    { id: "b", name: "Jo Park", role: "Comedian", note: "n", imageUrl: "", imageAlt: "", url: "https://jo.com" },
  ];
  let n = 0;
  const result = addPasted(lineup, [
    { name: "sam rivera", url: ig("samcomic"), role: "Comedian" },
    { name: "Jo Park", url: ig("jopark"), role: "Comedian" },
    { name: "Alex Kim", url: ig("alex"), role: "Comedian" },
  ], () => `new-${(n += 1)}`);
  assert.equal(result.added, 1);
  assert.equal(result.linked, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.lineup[0].url, ig("samcomic"));
  assert.equal(result.lineup[0].role, "Host", "their role stays");
  assert.equal(result.lineup[1].url, "https://jo.com", "an existing link is never replaced");
  assert.deepEqual(result.lineup[2], { id: "new-1", name: "Alex Kim", role: "Comedian", note: "", imageUrl: "", imageAlt: "", url: ig("alex") });
  assert.equal(lineup[0].url, "", "the old lineup is not changed in place");
});
