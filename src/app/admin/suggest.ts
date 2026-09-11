import type { Content, Post, Seo, Show } from "@/lib/types";
import { clamp, stripMarkdown, suggestKeywords } from "@/lib/seo";
import { creditLine, taylorFaq, taylorKeyword } from "@/lib/brand";
import { formatDate } from "@/lib/render";
import { formatTime, showSummary, venueLine } from "@/lib/shows";
import { weeklyScheduleLine, weeklySummary, weeklyVenueLine } from "@/lib/decisions";

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
  key: "site" | "home" | "news" | "shows" | "show" | "shop" | "about" | "contact" | "post" | "weekly",
  post?: Post,
  show?: Show
): Suggestion {
  const site = content.site;
  const brand = site.name || "Pins & Needles Comedy";
  const root = base(content);
  const fallbackImage = site.seo.ogImage || site.logoUrl || "/brand/icon.svg";

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
    description: clamp(description, 158),
    keywords: suggestKeywords(source, [...extraTerms, ...BRAND_TERMS], 10),
    aiSummary: clamp(aiSummary, 480),
    ogImage: image,
    canonical: `${root}${path}`,
    faq,
  });

  switch (key) {
    case "post": {
      if (!post) break;
      const text = stripMarkdown(post.body);
      return make(
        `${post.title} | ${site.shortName || brand}`,
        post.excerpt || text,
        `${post.title}. ${post.excerpt || clamp(text, 320)} Published ${post.date} by ${brand}, an NYC comedy brand run by ${creditLine(
          content.about.producers
        )}.`,
        `${post.title} ${post.excerpt} ${text}`,
        `/news/${post.slug}`,
        [...post.tags, taylorKeyword(content.about.producers)],
        post.coverUrl || fallbackImage,
        [
          {
            q: `What is "${clamp(post.title, 70)}" about?`,
            a: post.excerpt || clamp(text, 220),
          },
        ]
      );
    }
    case "show": {
      if (!show) break;
      const where = venueLine(show);
      const names = show.lineup.map((person) => person.name).filter(Boolean);
      const when = `${formatDate(show.date)}${
        show.startTime ? ` at ${formatTime(show.startTime)}` : ""
      }`;
      return make(
        `${show.title} | ${when}`,
        [
          show.tagline || `${brand} live${where ? ` at ${show.venueName || where}` : ""}`,
          where,
          show.price ? `Tickets ${show.price}.` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        `${show.title} is a live stand-up comedy show by ${brand}${
          where ? ` at ${where}` : ""
        } on ${when}. ${showSummary(show)} Produced by ${creditLine(content.about.producers)}.`,
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
            a: `${when}${where ? ` at ${where}` : ""}.${
              show.price ? ` Tickets are ${show.price}.` : ""
            }${show.ageRestriction ? ` ${show.ageRestriction}.` : ""}`,
          },
          ...(names.length
            ? [{ q: `Who is performing at ${show.title}?`, a: `${names.join(", ")}.` }]
            : []),
        ]
      );
    }
    case "shows":
      return make(
        `Shows | ${brand}`,
        `Upcoming ${brand} shows in New York City — lineups, venues, times and tickets for original formats including Bad Decisions.`,
        `Show listings for ${brand}, the NYC comedy brand creating original stand-up shows run by ${creditLine(
          content.about.producers
        )}. Each listing carries the date, venue and address, door and set times, ticket link and price, the comedians on the bill, and the guest tattoo artists and vendors working that night.`,
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
        `${site.tagline.replace(/[.!?]+$/, "")}. Watch reels from recent shows, read the latest news, and grab merch from ${brand}.`,
        `Home page of ${brand}, a brand creating original New York City stand-up comedy shows, created and run by ${creditLine(
          content.about.producers
        )}. Shows Instagram reels from recent nights and the latest news posts.`,
        `${brand} ${site.tagline} ${content.about.story}`,
        "/",
        ["nyc comedy tonight", "brooklyn comedy show", "alternative comedy nyc", taylorKeyword(content.about.producers)]
      );
    case "news":
      return make(
        `News | ${brand}`,
        `Show recaps, lineup announcements and guest tattoo artists from ${brand}, the NYC comedy brand.`,
        `The news archive for ${brand}, hosted by ${creditLine(
          content.about.producers
        )}: recaps of past shows, upcoming lineups, guest tattoo artist announcements and festival appearances.`,
        content.posts.map((entry) => `${entry.title} ${entry.excerpt}`).join(" "),
        "/news",
        ["comedy show recap", "comedy lineup nyc", taylorKeyword(content.about.producers)]
      );
    case "shop":
      return make(
        `Shop | ${brand} Merch`,
        `Official ${brand} merch — t-shirts, tote bags and caps from the NYC comedy brand.`,
        `Official merchandise store for ${brand}, the NYC comedy brand run by ${creditLine(
          content.about.producers
        )}, selling t-shirts, tote bags and caps.`,
        `${content.shop.heading} ${content.shop.intro} merch t-shirt tote cap`,
        "/shop",
        ["comedy merch", "tattoo comedy t-shirt", taylorKeyword(content.about.producers)]
      );
    case "about":
      return make(
        `About Us | ${brand}`,
        `${brand} creates original NYC stand-up shows about choices, vulnerability and what stays with us. ${site.tagline}`,
        `About page for ${brand}, hosted by ${creditLine(content.about.producers)}. ${clamp(
          stripMarkdown(content.about.story),
          320
        )}`,
        `${content.about.story} ${content.about.producers.map((p) => `${p.name} ${p.bio}`).join(" ")}`,
        "/about",
        [...content.about.producers.map((producer) => producer.name.toLowerCase()), taylorKeyword(content.about.producers)],
        fallbackImage,
        [
          taylorFaq(content.about.producers, brand),
          {
            q: `Do I need tattoos to enjoy ${brand}?`,
            a: "No. Tattoos are part of our roots, but they aren’t the whole story. You don’t need tattoos. Questionable judgment will do.",
          },
        ]
      );
    case "weekly": {
      const weekly = content.weekly;
      const where = weeklyVenueLine(weekly);
      const when = weeklyScheduleLine(weekly);
      return make(
        `${weekly.title.replace(/^Pins & Needles:\s*/i, "")} — Free Weekly Comedy in ${weekly.city || "Queens"}`,
        `${when} at ${weekly.venueName || where}. ${weekly.tagline} ${weekly.price ? `${weekly.price} entry.` : ""}`,
        `${weeklySummary(weekly)} Before the show the audience sends in a decision they have made or are thinking about making at ${root}/bad-decisions; after four comedians perform, the host draws a few at random and the lineup gives that person advice. Submissions can be anonymous or named. An original format from ${brand}, hosted by ${creditLine(
          content.about.producers
        )}. Not a roast.`,
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
            a: `A ${weekly.price ? `${weekly.price.toLowerCase()} ` : ""}weekly stand-up show${where ? ` at ${where}` : ""} where the audience sends in decisions they have made or are thinking about making and comedians pull a few at random and give that person advice.`,
          },
          { q: `When is ${weekly.title}?`, a: `${when}${where ? ` at ${where}` : ""}.` },
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
        `Book ${brand} for your venue, submit as a comic, or reach the NYC comedy brand for press.`,
        `Contact page for ${brand}, run by ${creditLine(
          content.about.producers
        )}, with booking, comic submission and press details.`,
        `${content.contact.heading} ${content.contact.intro} booking submissions press venue`,
        "/contact",
        ["book comedy show nyc", "comic submissions"]
      );
    case "site":
    default:
      return make(
        `${brand} | Original NYC Stand-Up Shows`,
        `${brand} creates original NYC stand-up shows about choices, vulnerability and what stays with us. ${site.tagline}`,
        `${brand} creates original stand-up shows in New York City about choices, vulnerability and what stays with us. Its formats include the original tattoo-focused show and Bad Decisions, with stand-up and audience participation. Tattoos are part of its roots, not a requirement. Produced by ${creditLine(content.about.producers)}.`,
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
