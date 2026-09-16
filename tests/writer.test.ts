import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aboutShow,
  brandBrief,
  fieldRules,
  normalizeSeoDraft,
  splitList,
  writerPrompt,
  writerSystem,
} from "../src/lib/writer.ts";
import { emptySeo } from "../src/lib/seo.ts";
import type { Content, Show } from "../src/lib/types.ts";

const TODAY = "2026-09-15";

const show = (partial: Partial<Show>): Show => ({
  id: "s",
  slug: "s",
  title: "Show",
  tagline: "",
  date: "2026-10-03",
  doorsTime: "",
  startTime: "",
  endTime: "",
  venueName: "",
  venueUrl: "",
  address: "",
  city: "",
  region: "NY",
  postalCode: "",
  country: "US",
  mapUrl: "",
  roomNote: "",
  ticketUrl: "",
  ticketLabel: "",
  price: "",
  currency: "USD",
  ageRestriction: "",
  status: "scheduled",
  posterUrl: "",
  posterAlt: "",
  description: "",
  lineup: [],
  photos: [],
  recapSlug: "",
  instagramUrl: "",
  series: "",
  published: false,
  featured: false,
  seo: emptySeo(),
  ...partial,
});

test("field rules follow what the admin calls the field", () => {
  assert.match(fieldRules("Poster alt text"), /under 125 characters/);
  assert.match(fieldRules("show photo caption"), /one sentence/i);
  assert.match(fieldRules("meta title"), /30–60/);
  assert.match(fieldRules("meta description"), /120–158/);
  assert.match(fieldRules("AI summary"), /answer engines/);
  assert.match(fieldRules("article tags"), /commas/);
  assert.match(fieldRules("the question the form asks"), /question mark/);
  assert.match(fieldRules("producer bio"), /Markdown-lite/);
  assert.match(fieldRules("home page headline"), /2–8 words/);
  assert.match(fieldRules("placeholder inside the box"), /under 8 words/);
  assert.match(fieldRules("small print under the form"), /under 40 words/);
});

const content = (): Content =>
  ({
    site: {
      name: "Pins & Needles Comedy",
      shortName: "Pins & Needles",
      tagline: "Questionable choices",
      url: "https://pinsandneedlescomedy.com",
      instagramHandle: "pinsandneedlescomedy",
      foundingYear: "2023",
    },
    about: {
      intro: "Original stand-up in New York City.",
      story: "It started in a **tattoo shop**.",
      producers: [{ id: "p", name: "Taylor Drew", role: "Creator", bio: "Comedian.", links: [], headshotUrl: "", headshotAlt: "" }],
    },
    weekly: {
      enabled: true,
      title: "Bad Decisions",
      weekday: "Thursday",
      startTime: "21:00",
      doorsTime: "",
      venueName: "The Bar",
      address: "1 Main St",
      city: "Ridgewood",
      region: "NY",
      price: "Free",
      ageRestriction: "21+",
      tagline: "Send in a decision.",
      howItWorks: "We read them out.",
    },
    contact: { city: "Queens, NY" },
    hallOfFame: { performers: [{ name: "Jane Doe", published: true }] },
    shows: [show({ title: "Secret Pour night", date: "2026-10-03", venueName: "Secret Pour", published: true })],
    instagram: { accessToken: "IGQVJ-secret" },
  }) as unknown as Content;

test("the brand brief names the brand, the creator and the weekly show, and never the token", () => {
  const brief = brandBrief(content(), TODAY);
  assert.match(brief, /Bad Decisions — every Thursday at 9:00 PM, The Bar/);
  assert.match(brief, /Jane Doe/);
  assert.match(brief, /Brand: /);
  assert.match(brief, /Taylor Drew is a stand-up comedian/);
  assert.match(brief, /Secret Pour night/);
  assert.doesNotMatch(brief, /IGQVJ/);
  assert.ok(brief.length < 6000, `brief is ${brief.length} chars`);
});

test("the system prompt carries the brief and the GEO rules", () => {
  const system = writerSystem("Brand: Test");
  assert.match(system, /Brand: Test/);
  assert.match(system, /answer engines/);
  assert.match(system, /Never invent a venue/);
});

test("the field prompt says what the field is, its rules, the facts and the current text", () => {
  const prompt = writerPrompt(
    { what: "show tagline", about: { title: "Pins & Needles at Secret Pour" } },
    "Old line",
    false
  );
  assert.match(prompt, /Field: show tagline/);
  assert.match(prompt, /Format: One or two sentences/);
  assert.match(prompt, /Secret Pour/);
  assert.match(prompt, /Old line/);
  assert.match(prompt, /Rewrite it/);
  assert.match(writerPrompt({ what: "alt text" }, "", true), /picture attached/);
  assert.match(writerPrompt({ what: "alt text" }, "", false), /It is empty/);
});

test("a raw SEO answer is tidied and deduplicated", () => {
  const draft = normalizeSeoDraft({
    title: " A | B ",
    keywords: ["NYC comedy", "nyc comedy", "", 3, "brooklyn comedy show"],
    faq: [{ q: "Who?", a: "Taylor Drew." }, { q: "", a: "x" }, "junk"],
  });
  assert.equal(draft.title, "A | B");
  assert.equal(draft.description, "");
  assert.deepEqual(draft.keywords, ["nyc comedy", "brooklyn comedy show"]);
  assert.deepEqual(draft.faq, [{ q: "Who?", a: "Taylor Drew." }]);
});

test("a comma or line list becomes tags without bullets or duplicates", () => {
  assert.deepEqual(splitList("nyc comedy, Brooklyn comedy show,\n- nyc comedy\n2. tattoo comedy"), [
    "nyc comedy",
    "Brooklyn comedy show",
    "tattoo comedy",
  ]);
});

test("show facts are readable, not raw", () => {
  const facts = aboutShow(
    show({
      title: "Pins & Needles",
      date: "2026-10-03",
      startTime: "20:00",
      venueName: "Secret Pour",
      city: "Ridgewood",
      lineup: [{ id: "a", name: "Jane Doe", role: "Host", note: "", imageUrl: "", imageAlt: "", url: "" }],
    })
  );
  assert.equal(facts.venue, "Secret Pour");
  assert.equal(facts.starts, "8:00 PM");
  assert.deepEqual(facts.bill, ["Jane Doe (Host)"]);
  assert.match(String(facts.date), /Oct 3, 2026/);
});
