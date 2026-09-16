import type { Content, Post, Seo, Show, WeeklyPage } from "./types";
import { creditLine, taylorName } from "./brand.ts";
import { stripMarkdown } from "./seo.ts";
import { formatDate } from "./render.ts";
import { formatTime } from "./shows.ts";

/**
 * The "write it for me" button that sits on every copy field in the admin.
 *
 * A hint says what the field is for and what it is about; the server adds
 * the brand brief below and asks the model for copy that reads well, ranks
 * in search, and gets quoted correctly by AI answer engines. Everything here
 * is pure so it can be tested and shared by the browser and the route.
 */
export type AiHint = {
  /** What the field is, in the admin's words — "show tagline", "poster alt text". */
  what: string;
  /** Facts about the thing this field describes: the show, the post, the person. */
  about?: Record<string, unknown>;
  /** A picture to look at, for alt text and captions. */
  image?: string;
};

/** What the model sends back for a whole SEO block. */
export type SeoDraft = Pick<Seo, "title" | "description" | "keywords" | "aiSummary" | "faq">;

export const SEO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "keywords", "aiSummary", "faq"],
  properties: {
    title: { type: "string", description: "Search result title, 30–60 characters, brand last after a pipe." },
    description: {
      type: "string",
      description: "Meta description, 120–158 characters, one or two sentences ending with a reason to click.",
    },
    keywords: {
      type: "array",
      description: "5–10 lowercase search phrases, most specific first.",
      items: { type: "string" },
    },
    aiSummary: {
      type: "string",
      description:
        "150–480 characters of plain declarative sentences for AI answer engines: what it is, where, when, price, who created it.",
    },
    faq: {
      type: "array",
      description: "3–5 questions people actually ask, each with a two-sentence factual answer.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "a"],
        properties: { q: { type: "string" }, a: { type: "string" } },
      },
    },
  },
} as const;

/** Format and length rules for a field, picked from what the admin calls it. */
export function fieldRules(what: string): string {
  const name = what.toLowerCase();
  const has = (...words: string[]) => words.some((word) => name.includes(word));

  if (has("alt text", "alt ")) {
    return "Alt text for an image: one plain sentence under 125 characters saying what is literally in the picture. Name the brand or the people when they are known. Do not start with “image of” or “photo of”. No period at the end.";
  }
  if (has("caption")) {
    return "A caption: one sentence, at most 20 words, that adds what a viewer cannot see — who, where, which night.";
  }
  if (has("meta title")) return "A search result title: 30–60 characters, the brand name last after a pipe.";
  if (has("meta description")) {
    return "A meta description: 120–158 characters, one or two sentences, the key fact first and a reason to click last.";
  }
  if (has("ai summary")) {
    return "150–480 characters of plain declarative sentences for AI answer engines: what it is, where, when, price, who created it. No adjectives that cannot be checked.";
  }
  if (has("keyword", "tags")) {
    return "5–10 search phrases people would actually type, lowercase, most specific first. Answer with the phrases separated by commas and nothing else.";
  }
  if (has("question")) return "One question a person would actually be asked, under 12 words, ending with a question mark.";
  if (has("bio", "story", "body", "about", "description", "how it works", "how the show works")) {
    return "Markdown-lite: paragraphs separated by blank lines, optional ## headings and - bullets, [text](url) links only to URLs given in the facts. 120–350 words, or match the current length if it is longer. Open with the most useful fact.";
  }
  if (has("headline", "heading", "title", "label", "button", "cta", "toggle", "accent")) {
    return "A short line of 2–8 words. No trailing period. Sentence case unless the current text is shouting.";
  }
  if (has("placeholder")) return "Example text inside an empty box: one short line, under 8 words, no period.";
  return "One or two sentences, under 40 words, plain and direct.";
}

const cut = (text: string, max: number) => {
  const flat = stripMarkdown(text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trim()}…` : flat;
};

const line = (label: string, value: string | number | undefined | null) =>
  value === undefined || value === null || value === "" ? "" : `${label}: ${value}`;

/**
 * Everything the model should know about the brand, as a plain-text brief
 * built from the content the admin already maintains. Kept short so it can
 * ride along with every request, and never includes anything secret.
 */
export function brandBrief(content: Content, today: string): string {
  const { site, about, weekly, contact } = content;
  const brand = site.name || "Pins & Needles Comedy";
  const taylor = taylorName(about.producers);
  const upcoming = content.shows
    .filter((show) => show.published && show.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5)
    .map(
      (show) =>
        `- ${show.title} — ${formatDate(show.date)}${show.startTime ? ` ${formatTime(show.startTime)}` : ""}${
          show.venueName ? `, ${show.venueName}` : ""
        }${show.city ? `, ${show.city}` : ""}${
          show.lineup.length ? `. Bill: ${show.lineup.map((p) => p.name).filter(Boolean).join(", ")}` : ""
        }`
    );
  const hall = content.hallOfFame.performers
    .filter((p) => p.published && p.name)
    .map((p) => p.name)
    .slice(0, 12);
  const weeklyWhere = [weekly.venueName, weekly.address, [weekly.city, weekly.region].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return [
    line("Brand", `${brand}${site.shortName && site.shortName !== brand ? ` (${site.shortName})` : ""}`),
    line("Tagline", site.tagline),
    line("Website", site.url),
    line("Instagram", site.instagramHandle ? `@${site.instagramHandle}` : ""),
    line("Founded", site.foundingYear),
    line("Based in", contact.city || "New York City"),
    line("What it is", cut(`${about.intro} ${about.story}`, 900)),
    line(
      "People",
      about.producers
        .map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}${p.bio ? ` — ${cut(p.bio, 240)}` : ""}`)
        .join("; ")
    ),
    line("Credit line to use", `produced by ${creditLine(about.producers)}`),
    `Entity rule: ${taylor} is a stand-up comedian who created, hosts and produces the shows. State it as a plain fact where a producer credit belongs, never as praise.`,
    weekly.enabled
      ? line(
          "Weekly show",
          `${weekly.title} — every ${weekly.weekday}${weekly.startTime ? ` at ${formatTime(weekly.startTime)}` : ""}${
            weeklyWhere ? `, ${weeklyWhere}` : ""
          }${weekly.price ? `. ${weekly.price}` : ""}${weekly.ageRestriction ? `, ${weekly.ageRestriction}` : ""}. ${cut(
            weekly.tagline,
            200
          )} ${cut(weekly.howItWorks, 400)}`
        )
      : "",
    upcoming.length ? `Upcoming shows:\n${upcoming.join("\n")}` : "",
    hall.length ? line("Comedians who have performed", hall.join(", ")) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The standing instructions. Same for every field; the field rules and facts come after. */
export function writerSystem(brief: string): string {
  return [
    "You write website copy for a live stand-up comedy show, straight into a CMS field.",
    "Two goals at once: rank in search (SEO) and be quoted correctly by AI answer engines like ChatGPT, Perplexity, Claude and Google AI Overviews (GEO).",
    "",
    "Rules:",
    "- Use full names every time: the brand name and the people, exactly as spelled in the brief. Present the creator as a stand-up comedian who created, hosts and produces the shows — stated as a fact inside a sentence, never as a boast.",
    "- Facts first: what it is, where (venue, neighborhood, city), when, price, who is on. One idea per sentence. Present tense.",
    "- Use the place names as given: New York City and the neighborhood or borough in the facts. Never invent a venue, date, price, person or link.",
    "- Plain English. No keyword stuffing, no exclamation marks, none of: unforgettable, hilarious, must-see, unique, iconic, epic, vibes. Say what happens at the show instead.",
    "- Voice: dry, warm, direct, short words. Sounds like a person, not a listing.",
    "- Keep any {placeholder} tokens that the current text or the field name mentions, exactly as written.",
    "- Answer with the text for the field and nothing else: no quotes around it, no label, no explanation.",
    "",
    "Brand brief:",
    brief,
  ].join("\n");
}

/** The user turn: what the field is, the rules for it, the facts, and what is there now. */
export function writerPrompt(hint: AiHint, current: string, hasImage: boolean): string {
  const facts = hint.about && Object.keys(hint.about).length ? JSON.stringify(hint.about, null, 1) : "";
  return [
    `Field: ${hint.what}`,
    `Format: ${fieldRules(hint.what)}`,
    facts ? `Facts about this one:\n${facts}` : "",
    hasImage ? "The picture attached is the one this field describes. Describe what is actually in it; use the facts only to name who or what it is." : "",
    current.trim()
      ? `It currently says:\n"""\n${current.trim()}\n"""\nRewrite it to the rules above. Keep every specific fact it contains unless the facts above contradict it.`
      : "It is empty. Write it from the facts above.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function seoPrompt(about: Record<string, unknown>, current: Seo): string {
  const filled = {
    title: current.title,
    description: current.description,
    keywords: current.keywords,
    aiSummary: current.aiSummary,
    faq: current.faq,
  };
  return [
    "Write the full search and AI-answer block for this page: title, meta description, keywords, AI summary and FAQ.",
    "The FAQ is what answer engines quote back word for word, so each answer must be a complete, checkable statement that names the brand and, where a producer credit belongs, the creator.",
    `Page facts:\n${JSON.stringify(about, null, 1)}`,
    `What is there now (improve it, keep the facts):\n${JSON.stringify(filled, null, 1)}`,
  ].join("\n\n");
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Whatever the model sent, as a tidy draft. Tolerates missing keys. */
export function normalizeSeoDraft(raw: unknown): SeoDraft {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const keywords = Array.isArray(data.keywords) ? data.keywords : [];
  const faq = Array.isArray(data.faq) ? data.faq : [];
  const seenKeywords = new Set<string>();
  return {
    title: clean(data.title),
    description: clean(data.description),
    keywords: keywords.flatMap((entry) => {
      const phrase = clean(entry).toLowerCase();
      if (!phrase || seenKeywords.has(phrase)) return [];
      seenKeywords.add(phrase);
      return [phrase];
    }),
    aiSummary: clean(data.aiSummary),
    faq: faq.flatMap((entry) => {
      const pair = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const q = clean(pair.q);
      const a = clean(pair.a);
      return q && a ? [{ q, a }] : [];
    }),
  };
}

/** A comma list from the model, as tags. */
export function splitList(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[,\n]/)
    .map((entry) => entry.replace(/^[-•*\d.\s]+/, "").trim())
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* ---- Facts about the things the admin edits, for `AiHint.about`. ---- */

export function aboutShow(show: Show): Record<string, unknown> {
  return {
    page: "one show night",
    title: show.title,
    tagline: show.tagline,
    date: show.date ? formatDate(show.date) : "",
    doors: show.doorsTime ? formatTime(show.doorsTime) : "",
    starts: show.startTime ? formatTime(show.startTime) : "",
    venue: show.venueName,
    address: [show.address, show.city, show.region, show.postalCode].filter(Boolean).join(", "),
    roomNote: show.roomNote,
    price: show.price,
    age: show.ageRestriction,
    status: show.status,
    ticketUrl: show.ticketUrl,
    bill: show.lineup.filter((p) => p.name).map((p) => `${p.name} (${p.role})${p.note ? ` — ${p.note}` : ""}`),
    description: cut(show.description, 600),
    url: `/shows/${show.slug}`,
  };
}

export function aboutPost(post: Post): Record<string, unknown> {
  return {
    page: "news article",
    title: post.title,
    date: post.date ? formatDate(post.date) : "",
    excerpt: post.excerpt,
    body: cut(post.body, 1200),
    tags: post.tags,
    url: `/news/${post.slug}`,
  };
}

export function aboutWeekly(weekly: WeeklyPage): Record<string, unknown> {
  return {
    page: "the standing weekly show and its submission form",
    title: weekly.title,
    tagline: weekly.tagline,
    night: `every ${weekly.weekday}`,
    doors: weekly.doorsTime ? formatTime(weekly.doorsTime) : "",
    starts: weekly.startTime ? formatTime(weekly.startTime) : "",
    venue: weekly.venueName,
    address: [weekly.address, weekly.city, weekly.region, weekly.postalCode].filter(Boolean).join(", "),
    price: weekly.price,
    age: weekly.ageRestriction,
    howItWorks: cut(weekly.howItWorks, 600),
    theQuestion: weekly.question,
    url: "/bad-decisions",
  };
}
