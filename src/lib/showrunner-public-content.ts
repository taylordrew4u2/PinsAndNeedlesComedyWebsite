import "server-only";

import { cache } from "react";
import { fetchWithin } from "./fetch-within";
import { getContent } from "./store";
import {
  mergeWebsiteLineups,
  parseWebsiteLineupFeed,
  type WebsiteLineupFeed,
  type WebsiteLineupLink,
} from "./showrunner-lineups";
import type { Content } from "./types";

const FEED_URL = "https://icanrunashow.com/api/website-lineups";
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_FEED_LENGTH = 512_000;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A publication allowlist supplied only through the website's server configuration. */
function readLinks(raw: string | undefined): WebsiteLineupLink[] {
  if (!raw) return [];
  try {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > 100) return [];
    const links: WebsiteLineupLink[] = [];
    const ids = new Set<string>();
    for (const value of input) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(entry.id) || !validDate(entry.date)) return [];
      if (entry.series !== undefined && (typeof entry.series !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.series))) return [];
      const id = entry.id.trim();
      if (ids.has(id)) return [];
      ids.add(id);
      links.push({ id, date: entry.date, ...(typeof entry.series === "string" ? { series: entry.series } : {}) });
    }
    return links;
  } catch {
    return [];
  }
}

/** A config typo must never send the read token to another origin or a redirect. */
function allowedFeedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.href !== FEED_URL || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function clearManagedLineups(content: Content): Content {
  return {
    ...content,
    shows: content.shows.map((show) => {
      const marked = "showrunnerId" in show && typeof show.showrunnerId === "string" && !!show.showrunnerId.trim();
      return marked || show.id.startsWith("showrunner-") ? { ...show, lineup: [], lineupUnavailable: true } : show;
    }),
  };
}

async function readFeed(url: string, token: string): Promise<WebsiteLineupFeed | null> {
  try {
    const { response, text } = await fetchWithin(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
    }, REQUEST_TIMEOUT_MS);
    if (!response.ok || text.length > MAX_FEED_LENGTH) return null;
    const data: unknown = JSON.parse(text);
    return parseWebsiteLineupFeed(data);
  } catch {
    // Do not log request objects, headers, upstream errors, or private feed bodies.
    return null;
  }
}

/**
 * Public read overlay only; admin reads and saves continue to use the raw store.
 * React's cache shares one fresh result between metadata and page rendering in
 * a request, without retaining a lineup snapshot for later visitors.
 *
 * Server configuration: SHOWRUNNER_LINEUP_FEED_TOKEN, optional exact
 * SHOWRUNNER_LINEUP_FEED_URL, and SHOWRUNNER_SHOW_LINKS JSON [{id,date,series?}].
 */
export const getPublicContent = cache(async (): Promise<Content> => {
  const content = await getContent();
  const rawToken = process.env.SHOWRUNNER_LINEUP_FEED_TOKEN;
  const rawUrl = process.env.SHOWRUNNER_LINEUP_FEED_URL;
  const rawLinks = process.env.SHOWRUNNER_SHOW_LINKS;
  if (rawToken === undefined && rawUrl === undefined && rawLinks === undefined) return content;
  const token = rawToken?.trim();
  const configuredUrl = rawUrl?.trim();
  const configuredLinks = rawLinks?.trim();

  const links = readLinks(configuredLinks);
  // An invalid/missing allowlist must neither publish arbitrary upstream shows
  // nor restore stored names on records already managed by this integration.
  if (!links.length) {
    console.warn("[showrunner] Public lineup configuration is incomplete; managed lineups are unavailable.");
    return clearManagedLineups(content);
  }

  const url = token ? allowedFeedUrl(configuredUrl || FEED_URL) : null;
  const feed = token && url ? await readFeed(url, token) : null;
  const allowedIds = new Set(links.map((link) => link.id));
  const current: WebsiteLineupFeed = feed ? {
    ...feed,
    shows: feed.shows.filter((show) => allowedIds.has(show.id)),
  } : {
    version: 1,
    updatedAt: new Date().toISOString(),
    shows: links.map(({ id }) => ({ id, available: false })),
  };

  // A failed request clears managed bills through unavailable entries. It must
  // never revive performer names from an earlier manually saved snapshot.
  return mergeWebsiteLineups(content, current, links);
});
