import { test } from "node:test";
import assert from "node:assert/strict";
import legacyFields from "../src/lib/brand-copy-legacy.json" with { type: "json" };
import { upgradeBrandCopy } from "../src/lib/brand-copy.ts";
import type { Content } from "../src/lib/types.ts";

function fixture(legacy: boolean): Content {
  const result: Record<string, unknown> = {};
  for (const field of legacyFields) {
    let target = result;
    for (const key of field.path.slice(0, -1)) {
      target[key] ??= {};
      target = target[key] as Record<string, unknown>;
    }
    target[field.path.at(-1)!] = legacy ? structuredClone(field.previous) : `Updated ${field.path.join(".")}`;
  }
  return result as unknown as Content;
}

test("saved legacy copy upgrades without mutating storage or unrelated content", () => {
  const saved = fixture(true);
  saved.contact.email = "booking@example.com";
  saved.shows = [{ id: "custom-show" }] as Content["shows"];
  const snapshot = structuredClone(saved);
  const defaults = fixture(false);
  const result = upgradeBrandCopy(saved, defaults);
  assert.equal(result.about.story, defaults.about.story);
  assert.equal(result.site.seo.description, defaults.site.seo.description);
  assert.equal(result.home.hero.showTagline, true);
  assert.equal(result.contact.email, saved.contact.email);
  assert.deepEqual(result.shows, saved.shows);
  assert.deepEqual(saved, snapshot);
});

test("custom text, FAQ and visibility settings survive repeated reads", () => {
  const saved = fixture(true);
  saved.about.story = "Our custom story";
  saved.site.seo.faq = [{ q: "Custom?", a: "Yes." }];
  saved.home.hero.tagline = "Our custom tagline";
  saved.home.hero.showTagline = false;
  const defaults = fixture(false);
  const result = upgradeBrandCopy(saved, defaults);
  assert.equal(result.about.story, saved.about.story);
  assert.deepEqual(result.site.seo.faq, saved.site.seo.faq);
  assert.equal(result.home.hero.showTagline, false);
  assert.deepEqual(upgradeBrandCopy(result, defaults), result);
});
