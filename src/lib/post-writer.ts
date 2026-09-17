import type { Post, Seo } from "./types";
import { slugify } from "./seo.ts";
import { normalizeSeoDraft, SEO_SCHEMA, type SeoDraft } from "./writer.ts";
import { formatDate } from "./render.ts";

/**
 * "Write the whole post for me": the admin types a few details, optionally
 * attaches a flyer, and gets back a finished draft — headline, summary, body,
 * tags, cover description and the search/AI block — in one pass.
 *
 * Everything here is pure so it can be tested and shared by the browser and
 * the route. The model call lives in /api/admin/post.
 */

export const POST_KINDS = [
  { value: "announcement", label: "Show announcement — a night we just booked" },
  { value: "lineup", label: "Lineup announcement — who's on the bill" },
  { value: "recap", label: "Recap — how a show that already happened went" },
  { value: "news", label: "News — something that happened off stage" },
  { value: "guide", label: "Explainer — how the show works, what to expect" },
] as const;

export type PostKind = (typeof POST_KINDS)[number]["value"];

export const isPostKind = (value: unknown): value is PostKind =>
  POST_KINDS.some((kind) => kind.value === value);

/** What the admin filled in on the "write a post" card. */
export type PostBrief = {
  kind: PostKind;
  /** The one-line subject: "Bad Decisions #12 at Lucky 13", "we're on TV". */
  topic: string;
  /** Loose notes, bullets, quotes — whatever the admin has. */
  details: string;
  /** yyyy-mm-dd the post is dated. */
  date: string;
  /** A flyer or photo to read and describe. Also becomes the cover. */
  image?: string;
};

/** What the model sends back for a whole post. */
export type PostDraft = {
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  coverAlt: string;
  seo: SeoDraft;
};

export const POST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "excerpt", "body", "tags", "coverAlt", "seo"],
  properties: {
    title: {
      type: "string",
      description:
        "The headline: 6–12 words, the specific fact first (who, what, where). No colon-subtitle, no clickbait.",
    },
    excerpt: {
      type: "string",
      description:
        "The card and search summary: one or two sentences, 120–200 characters, naming what it is and when.",
    },
    body: {
      type: "string",
      description:
        "The article in markdown-lite: paragraphs separated by blank lines, ## subheadings, - bullets, [text](url) links only to URLs given in the facts. 350–650 words. First paragraph answers what, where and when in plain sentences.",
    },
    tags: {
      type: "array",
      description: "3–6 lowercase topic tags, most specific first.",
      items: { type: "string" },
    },
    coverAlt: {
      type: "string",
      description:
        "One sentence under 125 characters describing what is literally in the attached picture. Empty string when no picture is attached.",
    },
    seo: {
      type: "object",
      additionalProperties: false,
      required: SEO_SCHEMA.required,
      properties: SEO_SCHEMA.properties,
      description: "The search and AI-answer block for this article's page.",
    },
  },
} as const;

/** The extra standing instructions for a whole article, on top of writerSystem. */
export const POST_SYSTEM = [
  "",
  "You are writing a complete news article for the site's /news section, plus its search and AI-answer block.",
  "Article rules:",
  "- Every fact comes from the notes, the attached picture or the brand brief. If a date, venue, price or name is not there, leave it out — never fill a gap with a guess.",
  "- Structure: an opening paragraph that answers what, where and when in plain sentences, then 2–4 short sections under ## subheadings, then a closing paragraph pointing at the next thing to do.",
  "- Write the way the brand talks: dry, warm, specific. Name the room, the night, the bit that actually happened. No press-release voice.",
  "- The first 60 words carry the whole story on their own, because that is what a search result and an AI answer quote.",
  "- Link only to URLs that appear in the facts or the brief. /shows and /bad-decisions are always safe to link.",
  "- A recap is past tense. An announcement is present and future tense.",
].join("\n");

const KIND_SHAPE: Record<PostKind, string> = {
  announcement:
    "An announcement of a show that has not happened yet. Lead with the date, the venue and the city. End by telling people where to get tickets or follow along.",
  lineup:
    "A lineup announcement. Name every performer given, one short line each about what they do when the notes say. Lead with the night they are on.",
  recap:
    "A recap of a show that already happened, in the past tense. Say who was on, what the room did, and one or two things that actually happened. End by pointing at the next show.",
  news: "A short news item about something off stage — press, a milestone, a change. Lead with the thing that changed.",
  guide:
    "An explainer for someone who has never been. Say what happens at the show, step by step, what it costs and how to get in.",
};

/** The user turn: the shape of post, the admin's notes, and what the picture is for. */
export function postPrompt(brief: PostBrief, hasImage: boolean): string {
  return [
    `Write this article: ${KIND_SHAPE[brief.kind]}`,
    `Subject: ${brief.topic}`,
    brief.date ? `Publishing date: ${formatDate(brief.date)} (${brief.date})` : "",
    brief.details.trim()
      ? `The notes to work from — these are the facts, use all of them:\n"""\n${brief.details.trim()}\n"""`
      : "There are no extra notes. Write it from the subject line and the brand brief, and keep it to what those two say.",
    hasImage
      ? "A flyer or photo is attached and will be this article's cover image. Read every word printed on it and treat those details — date, time, venue, price, the names on the bill — as facts for the article. Describe what is actually in the picture in coverAlt. Never identify a person from their face."
      : "No picture is attached. Answer with an empty string for coverAlt.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Whatever the model sent, as a tidy draft. Tolerates missing keys. */
export function normalizePostDraft(raw: unknown): PostDraft {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const seen = new Set<string>();
  return {
    title: clean(data.title),
    excerpt: clean(data.excerpt),
    body: clean(data.body),
    tags: tags.flatMap((entry) => {
      const tag = clean(entry).toLowerCase();
      if (!tag || seen.has(tag)) return [];
      seen.add(tag);
      return [tag];
    }),
    coverAlt: clean(data.coverAlt),
    seo: normalizeSeoDraft(data.seo),
  };
}

/**
 * Write the draft onto a post. The draft wins wherever it wrote something;
 * anything it left blank keeps what was there. The slug is rebuilt from the
 * new title so the page lands at a readable address.
 */
export function applyPostDraft(post: Post, draft: PostDraft): Post {
  const title = draft.title || post.title;
  const seo: Seo = {
    ...post.seo,
    title: draft.seo.title || post.seo.title,
    description: draft.seo.description || post.seo.description,
    keywords: draft.seo.keywords.length ? draft.seo.keywords : post.seo.keywords,
    aiSummary: draft.seo.aiSummary || post.seo.aiSummary,
    faq: draft.seo.faq.length ? draft.seo.faq : post.seo.faq,
    // The cover doubles as the social card unless one was picked already.
    ogImage: post.seo.ogImage || post.coverUrl,
  };
  return {
    ...post,
    title,
    slug: draft.title ? slugify(title) : post.slug,
    excerpt: draft.excerpt || post.excerpt,
    body: draft.body || post.body,
    tags: draft.tags.length ? draft.tags : post.tags,
    coverAlt: draft.coverAlt || post.coverAlt,
    seo,
  };
}

/** One line for the admin: what came back, and what to check. */
export function describePostDraft(draft: PostDraft): string {
  if (!draft.body && !draft.title) {
    return "Nothing came back. Add a few more details and try again.";
  }
  const words = draft.body ? draft.body.trim().split(/\s+/).length : 0;
  const parts = [
    words ? `${words} words` : "",
    draft.tags.length ? `${draft.tags.length} tags` : "",
    draft.seo.keywords.length ? `${draft.seo.keywords.length} keywords` : "",
    draft.seo.faq.length ? `${draft.seo.faq.length} FAQ answers` : "",
  ].filter(Boolean);
  return `Wrote a draft: ${parts.join(", ")}. Read it over, fix anything it got wrong, then turn on “Show it on the website”.`;
}
