import type { Content, Post, Seo, Show } from "./types";
import { absoluteUrl, siteBase, stripMarkdown, clamp } from "./seo";
import { eventStatusUrl, isoDateTime, showSummary } from "./shows";

export function organizationSchema(content: Content) {
  const { site, about } = content;
  const base = site.url;
  return {
    "@context": "https://schema.org",
    "@type": site.organizationType || "Organization",
    "@id": `${base}#organization`,
    name: site.name,
    alternateName: site.shortName,
    url: base,
    logo: absoluteUrl(base, site.logoUrl),
    image: absoluteUrl(base, site.seo.ogImage || site.logoUrl),
    description: site.seo.aiSummary || site.seo.description,
    slogan: site.tagline,
    foundingDate: site.foundingYear,
    areaServed: "New York City",
    sameAs: site.socials.map((social) => social.url).filter(Boolean),
    member: about.producers.map((producer) => ({
      "@type": "Person",
      name: producer.name,
      jobTitle: producer.role,
      description: clamp(producer.bio, 300),
    })),
  };
}

export function websiteSchema(content: Content) {
  const { site } = content;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}#website`,
    url: site.url,
    name: site.name,
    description: site.seo.description,
    inLanguage: "en-US",
    publisher: { "@id": `${site.url}#organization` },
  };
}

export function faqSchema(seo: Seo) {
  if (!seo.faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seo.faq.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: { "@type": "Answer", text: entry.a },
    })),
  };
}

export function breadcrumbSchema(base: string, trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(base, crumb.path),
    })),
  };
}

export function postSchema(content: Content, post: Post) {
  const { site } = content;
  const base = site.url;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${base}/news/${post.slug}#post`,
    headline: clamp(post.title, 110),
    description: post.seo.description || post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "en-US",
    keywords: (post.seo.keywords?.length ? post.seo.keywords : post.tags).join(", "),
    articleBody: clamp(stripMarkdown(post.body), 5000),
    image: post.coverUrl ? [absoluteUrl(base, post.coverUrl)] : [absoluteUrl(base, site.logoUrl)],
    mainEntityOfPage: { "@type": "WebPage", "@id": `${base}/news/${post.slug}` },
    author: { "@type": "Organization", name: site.name, url: base },
    publisher: { "@id": `${base}#organization` },
  };
}

export function blogSchema(content: Content) {
  const { site, posts } = content;
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${site.url}/news#blog`,
    name: `${site.name} News`,
    url: `${site.url}/news`,
    description: content.news.seo.description,
    publisher: { "@id": `${site.url}#organization` },
    blogPost: posts
      .filter((post) => post.published)
      .slice(0, 20)
      .map((post) => ({
        "@type": "BlogPosting",
        headline: clamp(post.title, 110),
        url: `${site.url}/news/${post.slug}`,
        datePublished: post.date,
      })),
  };
}

/**
 * Event JSON-LD for one show. This is the highest-value structured data on
 * the site: it is what puts a date into Google's event results and what an
 * answer engine reads when someone asks when the next show is.
 */
export function eventSchema(content: Content, show: Show) {
  const { site } = content;
  const base = siteBase(site.url);
  const url = `${base}/shows/${show.slug}`;

  const performers = show.lineup
    .filter((person) => person.name.trim())
    .map((person) => ({
      "@type": "Person",
      name: person.name,
      ...(person.url ? { sameAs: person.url } : {}),
      ...(person.role ? { jobTitle: person.role } : {}),
    }));

  const address = {
    "@type": "PostalAddress",
    ...(show.address ? { streetAddress: show.address } : {}),
    ...(show.city ? { addressLocality: show.city } : {}),
    ...(show.region ? { addressRegion: show.region } : {}),
    ...(show.postalCode ? { postalCode: show.postalCode } : {}),
    addressCountry: show.country || "US",
  };

  return {
    "@context": "https://schema.org",
    "@type": "ComedyEvent",
    "@id": `${url}#event`,
    name: show.title,
    url,
    startDate: isoDateTime(show.date, show.startTime || show.doorsTime),
    ...(show.endTime ? { endDate: isoDateTime(show.date, show.endTime) } : {}),
    eventStatus: eventStatusUrl(show.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: clamp(
      show.seo.aiSummary || show.seo.description || stripMarkdown(show.description) || showSummary(show),
      600
    ),
    image: [absoluteUrl(base, show.posterUrl || site.logoUrl)],
    ...(show.venueName || show.address
      ? {
          location: {
            "@type": "Place",
            name: show.venueName || show.city,
            address,
            ...(show.venueUrl ? { url: show.venueUrl } : {}),
            ...(show.mapUrl ? { hasMap: show.mapUrl } : {}),
          },
        }
      : {}),
    ...(performers.length ? { performer: performers } : {}),
    organizer: { "@id": `${base}#organization` },
    ...(show.ticketUrl
      ? {
          offers: {
            "@type": "Offer",
            url: show.ticketUrl,
            ...(show.price ? { price: show.price.replace(/[^0-9.]/g, "") || show.price } : {}),
            priceCurrency: show.currency || "USD",
            availability:
              show.status === "sold-out"
                ? "https://schema.org/SoldOut"
                : "https://schema.org/InStock",
          },
        }
      : {}),
    ...(show.ageRestriction ? { typicalAgeRange: show.ageRestriction } : {}),
    isAccessibleForFree: /free|\$0\b/i.test(show.price),
  };
}
