import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPostDraft,
  describePostDraft,
  isPostKind,
  normalizePostDraft,
  POST_SCHEMA,
  postPrompt,
  type PostDraft,
} from "../src/lib/post-writer.ts";
import { emptySeo } from "../src/lib/seo.ts";
import type { Post } from "../src/lib/types.ts";

const post = (partial: Partial<Post> = {}): Post => ({
  id: "post-1",
  slug: "new-post-1",
  title: "New post",
  excerpt: "",
  body: "",
  coverUrl: "",
  coverAlt: "",
  date: "2026-09-17",
  tags: [],
  published: false,
  featured: false,
  seo: emptySeo(),
  ...partial,
});

const draft = (partial: Partial<PostDraft> = {}): PostDraft => ({
  title: "",
  excerpt: "",
  body: "",
  tags: [],
  coverAlt: "",
  seo: { title: "", description: "", keywords: [], aiSummary: "", faq: [] },
  ...partial,
});

test("the schema asks for every field a post needs, SEO block included", () => {
  assert.deepEqual(
    [...POST_SCHEMA.required],
    ["title", "excerpt", "body", "tags", "coverAlt", "seo"]
  );
  assert.deepEqual(
    [...POST_SCHEMA.properties.seo.required],
    ["title", "description", "keywords", "aiSummary", "faq"]
  );
});

test("only the listed kinds of post are accepted", () => {
  assert.equal(isPostKind("recap"), true);
  assert.equal(isPostKind("announcement"), true);
  assert.equal(isPostKind("sonnet"), false);
  assert.equal(isPostKind(undefined), false);
});

test("the prompt carries the kind, the subject, the date and the notes", () => {
  const text = postPrompt(
    { kind: "recap", topic: "Bad Decisions #14", details: "room was packed", date: "2026-09-17" },
    false
  );
  assert.match(text, /past tense/);
  assert.match(text, /Bad Decisions #14/);
  assert.match(text, /room was packed/);
  assert.match(text, /2026-09-17/);
  assert.match(text, /empty string for coverAlt/);
});

test("with no notes the prompt says so instead of leaving a blank", () => {
  const text = postPrompt({ kind: "news", topic: "we're on TV", details: "", date: "" }, true);
  assert.match(text, /no extra notes/);
  assert.match(text, /flyer or photo is attached/);
  assert.doesNotMatch(text, /Publishing date/);
});

test("a draft comes back trimmed, with tags lowercased and de-duplicated", () => {
  const result = normalizePostDraft({
    title: "  Bad Decisions #14  ",
    excerpt: " One line. ",
    body: "## Heading\n\nA paragraph.",
    tags: ["NYC comedy", "nyc comedy", "", "Lucky 13"],
    coverAlt: "A flyer on a brick wall",
    seo: { title: "T", description: "D", keywords: ["A", "a"], aiSummary: "S", faq: [{ q: "Q?", a: "A." }] },
  });
  assert.equal(result.title, "Bad Decisions #14");
  assert.equal(result.excerpt, "One line.");
  assert.deepEqual(result.tags, ["nyc comedy", "lucky 13"]);
  assert.deepEqual(result.seo.keywords, ["a"]);
  assert.deepEqual(result.seo.faq, [{ q: "Q?", a: "A." }]);
});

test("a draft missing everything normalizes to empty instead of throwing", () => {
  const result = normalizePostDraft(null);
  assert.deepEqual(result, draft());
});

test("the draft is written onto the post and the slug follows the new title", () => {
  const written = applyPostDraft(
    post({ coverUrl: "/media/flyer.jpg" }),
    draft({
      title: "Bad Decisions #14 at Lucky 13",
      excerpt: "One line.",
      body: "A paragraph.",
      tags: ["nyc comedy"],
      coverAlt: "A flyer on a brick wall",
      seo: { title: "T", description: "D", keywords: ["nyc comedy"], aiSummary: "S", faq: [{ q: "Q?", a: "A." }] },
    })
  );
  assert.equal(written.slug, "bad-decisions-14-at-lucky-13");
  assert.equal(written.title, "Bad Decisions #14 at Lucky 13");
  assert.equal(written.body, "A paragraph.");
  assert.equal(written.coverAlt, "A flyer on a brick wall");
  assert.equal(written.seo.description, "D");
  // The cover doubles as the social card.
  assert.equal(written.seo.ogImage, "/media/flyer.jpg");
  // Nothing goes live on its own.
  assert.equal(written.published, false);
});

test("what the model left blank keeps whatever was typed by hand", () => {
  const existing = post({
    title: "Typed title",
    slug: "typed-title",
    body: "Typed body",
    tags: ["kept"],
    seo: { ...emptySeo(), description: "Typed description", ogImage: "/media/picked.jpg" },
  });
  const written = applyPostDraft(existing, draft({ excerpt: "Only the summary came back." }));
  assert.equal(written.title, "Typed title");
  assert.equal(written.slug, "typed-title");
  assert.equal(written.body, "Typed body");
  assert.deepEqual(written.tags, ["kept"]);
  assert.equal(written.excerpt, "Only the summary came back.");
  assert.equal(written.seo.description, "Typed description");
  assert.equal(written.seo.ogImage, "/media/picked.jpg");
});

test("the note back to the admin counts what arrived, or says nothing did", () => {
  assert.match(
    describePostDraft(
      draft({ title: "T", body: "one two three", tags: ["a"], seo: { title: "", description: "", keywords: ["k"], aiSummary: "", faq: [{ q: "Q?", a: "A." }] } })
    ),
    /3 words, 1 tags, 1 keywords, 1 FAQ answers/
  );
  assert.match(describePostDraft(draft()), /Nothing came back/);
});

test("the note names the model that wrote it, when the server said which", () => {
  const written = draft({ title: "T", body: "one two three" });
  assert.match(describePostDraft(written, "llama3.1:8b"), /llama3\.1:8b wrote it\./);
  // No model named: the note just leaves it out.
  assert.doesNotMatch(describePostDraft(written), /wrote it\./);
});
