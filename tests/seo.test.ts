import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, slugify, stripMarkdown, suggestKeywords, absoluteUrl } from "../src/lib/seo.ts";

test("clamp leaves short text alone", () => {
  assert.equal(clamp("Pins & Needles", 60), "Pins & Needles");
});

test("clamp cuts on a word boundary and marks the cut", () => {
  const result = clamp("Pins and Needles Comedy is a New York City stand-up show", 30);
  assert.ok(result.length <= 30, `got ${result.length} chars: ${result}`);
  assert.ok(result.endsWith("…"));
  assert.ok(!result.includes("  "));
});

test("clamp collapses whitespace", () => {
  assert.equal(clamp("a  \n  b", 60), "a b");
});

test("slugify handles ampersands, apostrophes and punctuation", () => {
  assert.equal(slugify("Pins & Needles — Brooklyn's Wildest Night!"), "pins-and-needles-brooklyns-wildest-night");
});

test("slugify never ends mid-word or on a stray dash", () => {
  const long =
    "Rob White Dropped the Flash Sheet for Pins and Needles Comedy Tattoos Available Tomorrow Night";
  const slug = slugify(long);
  assert.ok(slug.length <= 80, `got ${slug.length}`);
  assert.ok(!slug.endsWith("-"), slug);
  // Every segment is a whole word from the source.
  const words = new Set(long.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/));
  for (const part of slug.split("-")) assert.ok(words.has(part), `truncated word: ${part}`);
});

test("slugify collapses runs of separators", () => {
  assert.equal(slugify("  July 30th --- Recap  "), "july-30th-recap");
});

test("stripMarkdown removes images, links and formatting", () => {
  assert.equal(
    stripMarkdown("## Heading\n\n![alt](img.png) See [the show](https://x.com) **now**"),
    "Heading See the show now"
  );
});

test("suggestKeywords puts the supplied brand terms first", () => {
  const keywords = suggestKeywords("comedy comedy tattoo", ["pins and needles comedy"], 5);
  assert.equal(keywords[0], "pins and needles comedy");
});

test("suggestKeywords drops stop words and short words", () => {
  const keywords = suggestKeywords("the and a of comedy comedy", [], 5);
  assert.ok(!keywords.includes("the"));
  assert.ok(keywords.includes("comedy"));
});

test("suggestKeywords de-duplicates case-insensitively and honours the cap", () => {
  const keywords = suggestKeywords("Comedy comedy tattoo brooklyn", ["COMEDY"], 3);
  assert.equal(keywords.length, 3);
  assert.equal(new Set(keywords.map((k) => k.toLowerCase())).size, 3);
});

test("absoluteUrl leaves absolute URLs alone and joins relative ones once", () => {
  assert.equal(absoluteUrl("https://x.com/", "https://cdn.com/a.png"), "https://cdn.com/a.png");
  assert.equal(absoluteUrl("https://x.com/", "/news"), "https://x.com/news");
  assert.equal(absoluteUrl("https://x.com", "news"), "https://x.com/news");
});

test("summaries stop after complete sentences instead of cutting the next thought", async () => {
  const { sentenceSummary } = await import("../src/lib/seo.ts");
  assert.equal(sentenceSummary("Meet our performers. Read about the comedians who have taken our stage.", 35), "Meet our performers.");
  const sentence = "This is a complete sentence that exceeds a short search preview target.";
  assert.equal(sentenceSummary(sentence, 20), sentence);
  assert.equal(sentenceSummary("   ", 158), "");
  assert.equal(sentenceSummary("Read **show news**", 158), "Read show news.");
  assert.equal(sentenceSummary("Who took the stage? Meet them here.", 25), "Who took the stage?");
});

test("admission suggestions handle free entry, prices and missing values", async () => {
  const { admissionSentence } = await import("../src/lib/seo.ts");
  assert.equal(admissionSentence("Free"), "Admission is free.");
  assert.equal(admissionSentence(" free entry. "), "Admission is free.");
  assert.equal(admissionSentence("$15"), "Admission: $15.");
  assert.equal(admissionSentence(""), "");
});

test("FAQ generation preserves edited answers and does not duplicate questions", async () => {
  const { addSuggestedFaqs } = await import("../src/lib/seo.ts");
  const current = [{ q: "Where is the show?", a: "My edited answer." }];
  const suggested = [{ q: " where IS the show ", a: "Generated answer." }, { q: "Who performs?", a: "Our lineup." }];
  const result = addSuggestedFaqs(current, suggested);
  assert.deepEqual(result, [...current, suggested[1]]);
  assert.deepEqual(addSuggestedFaqs(result, suggested), result);
  assert.equal(current.length, 1);
  assert.deepEqual(addSuggestedFaqs([], suggested), suggested);
});
