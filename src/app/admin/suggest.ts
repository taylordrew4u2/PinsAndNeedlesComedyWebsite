import type { Content, Post, Seo, Show } from "@/lib/types";
import { admissionSentence, clamp, sentenceSummary, stripMarkdown, suggestKeywords } from "@/lib/seo";
import { creditLine, taylorFaq, taylorKeyword } from "@/lib/brand";
import { formatDate } from "@/lib/render";
import { formatTime, venueLine } from "@/lib/shows";
import { weeklyVenueLine } from "@/lib/decisions";

export type Suggestion = {
  title: string;
  description: string;
  keywords: string[];
  aiSummary: string;
  ogImage: string;
  canonical: string;
  faq: { q: string; a: string }[];
};

const BRAND_TERMS = [
  "pins and needles comedy",
  "nyc comedy show",
  "audience participation comedy",
  "underground stand-up",
];

function base(content: Content) {
  return (content.site.url || "https://pinsandneedlescomedy.com").replace(/\/+$/, "");
}

/** Build an SEO suggestion for one page or post. All of it is editable afterwards. */
export function suggestFor(
  content: Content,
  key: "hall" | "site" | "home" | "news" | "shows" | "show" | "shop" | "about" | "contact" | "post" | "weekly",
  post?: Post,
  show?: Show
): Suggestion {
  const site = content.site;
  const brand = site.name || "Pins & Needles Comedy";
  const root = base(content);
  const fallbackImage = site.seo.ogImage || site.logoUrl || "/brand/icon.svg";

  const pageFaqs: Partial<Record<typeof key, Suggestion["faq"]>> = {
    home: [
      { q: `What is ${brand}?`, a: `${brand} creates original stand-up comedy shows in New York City about choices, vulnerability and what stays with us.` },
      { q: "Where can I find upcoming shows?", a: `Visit ${root}/shows for announced dates, venues, lineups and ticket information.` },
    ],
    hall: [
      { q: `Who is in the ${brand} Hall of Fame?`, a: `The Hall of Fame celebrates comedians who have performed with ${brand}. Performers are listed alphabetically by display name.` },
      { q: "How can I follow a performer?", a: "Use the social profile link beneath their star when one is available." },
    ],
    news: [
      { q: "What can I find in the news section?", a: `Read show recaps, lineup announcements and updates from ${brand}.` },
      { q: "Where can I find upcoming show details?", a: `Visit ${root}/shows for dates, venues, lineups and ticket information.` },
    ],
    shop: [
      { q: `Where can I find official ${brand} merchandise?`, a: `Browse the official shop at ${root}/shop. Check individual product listings for details.` },
    ],
    contact: [
      { q: `How can I contact ${brand}?`, a: `Use the contact information at ${root}/contact for venue bookings, performer submissions and press inquiries.` },
    ],
  };

  const make = (
    title: string,
    description: string,
    aiSummary: string,
    source: string,
    path: string,
    extraTerms: string[] = [],
    image = fallbackImage,
    faq: { q: string; a: string }[] = []
  ): Suggestion => ({
    title: clamp(title, 60),
    description: sentenceSummary(description, 158),
    keywords: suggestKeywords(source, [...extraTerms, ...BRAND_TERMS], 10),
    aiSummary: sentenceSummary(aiSummary, 480),
    ogImage: image,
    canonical: `${root}${path}`,
    faq: faq.length ? faq : pageFaqs[key] || [{ q: `What is ${brand}?`, a: `${brand} creates original stand-up comedy shows in New York City.` }],
  });

  switch (key) {
    case "post": {
      if (!post) break;
      const text = stripMarkdown(post.body);
      return make(
        `${post.title} | ${site.shortName || brand}`,
        post.excerpt || text,
        `${sentenceSummary(post.excerpt || text, 320)} This article was published by ${brand}${post.date ? ` on ${formatDate(post.date)}` : ""}.`,
        `${post.title} ${post.excerpt} ${text}`,
        `/news/${post.slug}`,
        [...post.tags, taylorKeyword(content.about.producers)],
        post.coverUrl || fallbackImage,
        [
          {
            q: `What is "${clamp(post.title, 70)}" about?`,
            a: sentenceSummary(post.excerpt || text, 220),
          },
        ]
      );
    }
    case "show": {
      if (!show) break;
      const where = venueLine(show).replace(" — ", ", ");
      const names = show.lineup.map((person) => person.name).filter(Boolean);
      const when = [show.date ? `on ${formatDate(show.date)}` : "", show.startTime ? `at ${formatTime(show.startTime)}` : ""].filter(Boolean).join(" ");
      const eventSentence = `${show.title || "This show"} is a live stand-up comedy show${where ? ` at ${where}` : ""}${when ? ` ${when}` : ""}.`;
      return make(
        `${show.title} | ${brand}`,
        `${eventSentence} ${admissionSentence(show.price)}`,
        `${eventSentence} ${admissionSentence(show.price)} ${names.length ? `The lineup includes ${new Intl.ListFormat("en").format(names)}.` : ""} The shows are produced by ${creditLine(content.about.producers)}.`,
        `${show.title} ${show.tagline} ${show.description} ${where} ${names.join(" ")}`,
        `/shows/${show.slug}`,
        [
          "nyc comedy show tickets",
          show.city ? `${show.city.toLowerCase()} comedy show` : "",
          ...names.map((name) => name.toLowerCase()),
          taylorKeyword(content.about.producers),
        ].filter(Boolean),
        show.posterUrl || fallbackImage,
        [
          {
            q: `When and where is ${show.title}?`,
            a: `${eventSentence} ${admissionSentence(show.price)}${show.ageRestriction ? ` Age restriction: ${show.ageRestriction.replace(/[.!]+$/, "")}.` : ""}`.trim(),
          },
          ...(names.length
            ? [{ q: `Who is performing at ${show.title}?`, a: `${names.join(", ")}.` }]
            : []),
        ]
      );
    }
    case "hall":
      return make(
        `Hall of Fame | ${brand}`,
        `Meet the comedians who have performed with ${brand} in New York City.`,
        `The ${brand} Hall of Fame celebrates the comedians who have performed at its shows. Explore their profiles and find links to their social media.`,
        `${content.hallOfFame.heading} ${content.hallOfFame.intro}`,
        "/hall-of-fame",
        ["nyc stand-up comedians", "comedy performers"]
      );
    case "shows":
      return make(
        `Shows | ${brand}`,
        `Explore upcoming ${brand} shows in New York City. Find lineups, venues, times and tickets.`,
        `Explore upcoming shows from ${brand}. Find dates, venues, lineups and ticket information for each event. The shows are produced by ${creditLine(content.about.producers)}.`,
        content.shows.map((entry) => `${entry.title} ${entry.tagline} ${entry.venueName}`).join(" "),
        "/shows",
        ["nyc comedy show tickets", "comedy tonight brooklyn", taylorKeyword(content.about.producers)],
        fallbackImage,
        [
          {
            q: `Where can I find upcoming ${brand} shows?`,
            a: `Every announced show is listed at ${root}/shows with its date, venue, lineup and ticket link.`,
          },
        ]
      );
    case "home":
      return make(
        `${brand} | Original NYC Stand-Up Shows`,
        `${brand} creates original stand-up comedy shows in New York City. Explore upcoming shows, watch clips and read the latest news.`,
        `${brand} creates original stand-up comedy shows in New York City about choices, vulnerability and what stays with us. Explore upcoming shows, comedy clips and news. The shows are produced by ${creditLine(content.about.producers)}.`,
        `${brand} ${site.tagline} ${content.about.story}`,
        "/",
        ["nyc comedy tonight", "brooklyn comedy show", "alternative comedy nyc", taylorKeyword(content.about.producers)]
      );
    case "news":
      return make(
        `News | ${brand}`,
        `Read show recaps, lineup announcements and updates from ${brand}.`,
        `Read the latest news from ${brand}, including show recaps, lineup announcements and festival updates.`,
        content.posts.map((entry) => `${entry.title} ${entry.excerpt}`).join(" "),
        "/news",
        ["comedy show recap", "comedy lineup nyc", taylorKeyword(content.about.producers)]
      );
    case "shop":
      return make(
        `Shop | ${brand} Merch`,
        `Shop official merchandise from ${brand}.`,
        `Browse the official ${brand} shop for merchandise and product details.`,
        `${content.shop.heading} ${content.shop.intro} merch t-shirt tote cap`,
        "/shop",
        ["comedy merch", "tattoo comedy t-shirt", taylorKeyword(content.about.producers)]
      );
    case "about":
      return make(
        `About Us | ${brand}`,
        `${brand} creates original NYC stand-up shows about choices, vulnerability and what stays with us.`,
        `Learn about ${brand} and the people behind its original stand-up comedy shows. The shows explore choices, vulnerability and the stories we usually leave out.`,
        `${content.about.story} ${content.about.producers.map((p) => `${p.name} ${p.bio}`).join(" ")}`,
        "/about",
        [...content.about.producers.map((producer) => producer.name.toLowerCase()), taylorKeyword(content.about.producers)],
        fallbackImage,
        [
          taylorFaq(content.about.producers, brand),
          {
            q: `Do I need tattoos to enjoy ${brand}?`,
            a: "No. Tattoos are part of our roots, but they aren’t the whole story. You don’t need tattoos. Questionable choices will do.",
          },
        ]
      );
    case "weekly": {
      const weekly = content.weekly;
      const where = weeklyVenueLine(weekly).replace(" — ", ", ");
      const when = [weekly.weekday ? `every ${weekly.weekday}` : "", weekly.startTime ? `at ${formatTime(weekly.startTime)}` : ""].filter(Boolean).join(" ");
      const eventSentence = `${weekly.title} is a stand-up comedy show${where ? ` at ${where}` : ""}${when ? ` ${when}` : ""}.`;
      return make(
        `${weekly.title.replace(/^Pins & Needles:\s*/i, "")} | ${brand}`,
        `${eventSentence} ${admissionSentence(weekly.price)}`,
        `${eventSentence} ${admissionSentence(weekly.price)} Audience members submit decisions they have made or are considering. The comedians discuss selected submissions and offer advice. Submissions can be anonymous. The shows are produced by ${creditLine(content.about.producers)}.`,
        `${weekly.title} ${weekly.tagline} ${weekly.howItWorks} ${where} ${weekly.city} free weekly comedy`,
        "/bad-decisions",
        [
          `free comedy ${(weekly.city || "queens").toLowerCase()}`,
          `comedy ${(weekly.city || "queens").toLowerCase()} ${weekly.weekday.toLowerCase()}`,
          `${(weekly.venueName || "").toLowerCase()} comedy`.trim(),
          "audience participation comedy nyc",
          taylorKeyword(content.about.producers),
        ].filter(Boolean),
        weekly.posterUrl || fallbackImage,
        [
          {
            q: `What is ${weekly.title}?`,
            a: `${weekly.title} combines stand-up with audience participation. Audience members submit decisions, and the comedians discuss selected submissions and offer advice. ${admissionSentence(weekly.price)}`.trim(),
          },
          { q: `When is ${weekly.title}?`, a: eventSentence },
          {
            q: "Do I have to put my name on my decision?",
            a: "No. Submissions are anonymous unless you choose to add your name and get called out.",
          },
        ]
      );
    }
    case "contact":
      return make(
        `Contact | ${brand}`,
        `Contact ${brand} about venue bookings, performer submissions and press inquiries.`,
        `Find contact information for ${brand}, including venue bookings, performer submissions and press inquiries.`,
        `${content.contact.heading} ${content.contact.intro} booking submissions press venue`,
        "/contact",
        ["book comedy show nyc", "comic submissions"]
      );
    case "site":
    default:
      return make(
        `${brand} | Original NYC Stand-Up Shows`,
        `${brand} creates original NYC stand-up shows about choices, vulnerability and what stays with us.`,
        `${brand} creates original stand-up shows in New York City about choices, vulnerability and what stays with us. Its formats include the original tattoo-focused show and Bad Decisions, with stand-up and audience participation. Tattoos are part of its roots, not a requirement. The shows are produced by ${creditLine(content.about.producers)}.`,
        `${brand} ${site.tagline} ${content.about.story}`,
        "/",
        ["original comedy shows", "audience participation comedy", taylorKeyword(content.about.producers)],
        fallbackImage,
        [taylorFaq(content.about.producers, brand)]
      );
  }

  return make(brand, site.tagline, site.tagline, brand, "/");
}

/** Copy any suggested value into an SEO block wherever the field is still empty. */
export function fillEmpty(seo: Seo, suggestion: Suggestion): Seo {
  return {
    ...seo,
    title: seo.title || suggestion.title,
    description: seo.description || suggestion.description,
    keywords: seo.keywords.length ? seo.keywords : suggestion.keywords,
    aiSummary: seo.aiSummary || suggestion.aiSummary,
    ogImage: seo.ogImage || suggestion.ogImage,
    canonical: seo.canonical || suggestion.canonical,
    faq: seo.faq.length ? seo.faq : suggestion.faq,
  };
}
