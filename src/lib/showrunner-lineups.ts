import { newWeeklyShow } from "./decisions.ts";
import type { Content, Show, ShowPerformer } from "./types.ts";

export type WebsiteLineupLink = { id: string; date: string; series?: string };
export type WebsiteLineupPerformer = { id?: string; name: string; credits?: string };
export type WebsiteLineupEntry =
  | { id: string; available: false }
  | {
      id: string;
      available: true;
      name: string;
      date: string;
      time: string;
      venueName: string;
      location: string;
      ticketLink: string;
      status: "upcoming" | "in-progress" | "completed" | "cancelled";
      lineup: WebsiteLineupPerformer[];
    };
export type WebsiteLineupFeed = {
  version: 1;
  updatedAt: string;
  shows: WebsiteLineupEntry[];
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const STATUSES = new Set(["upcoming", "in-progress", "completed", "cancelled"]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max
    && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
}

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(value + "T12:00:00Z");
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function publicUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Strict projection: only public feed fields survive this boundary. */
export function parseWebsiteLineupFeed(input: unknown): WebsiteLineupFeed | null {
  const feed = record(input);
  if (!feed || feed.version !== 1 || !timestamp(feed.updatedAt)
    || !Array.isArray(feed.shows) || feed.shows.length > 1000) return null;

  const ids = new Set<string>();
  const shows: WebsiteLineupEntry[] = [];
  for (const value of feed.shows) {
    const show = record(value);
    if (!show || typeof show.id !== "string" || !ID.test(show.id)
      || ids.has(show.id)) return null;
    ids.add(show.id);
    if (show.available === false) {
      shows.push({ id: show.id, available: false });
      continue;
    }
    if (show.available !== true || !Array.isArray(show.lineup)
      || show.lineup.length > 500 || typeof show.status !== "string"
      || !STATUSES.has(show.status)) return null;

    const name = text(show.name, 300);
    const date = text(show.date, 10);
    const time = text(show.time, 200);
    const venueName = text(show.venueName, 300);
    const location = text(show.location, 1000);
    const ticketLink = text(show.ticketLink, 2048);
    if (name === null || date === null || time === null || venueName === null
      || location === null || ticketLink === null || (date && !calendarDate(date))
      || !publicUrl(ticketLink)) return null;

    const lineup: WebsiteLineupPerformer[] = [];
    const personIds = new Set<string>();
    for (const item of show.lineup) {
      const person = record(item);
      if (!person) return null;
      // A malformed privacy flag fails closed rather than exposing a name.
      if ("surpriseGuest" in person && typeof person.surpriseGuest !== "boolean") return null;
      if (person.surpriseGuest === true) continue;
      const personName = text(person.name, 200);
      if (!personName) return null;
      const projected: WebsiteLineupPerformer = { name: personName };
      if ("id" in person) {
        if (typeof person.id !== "string" || !ID.test(person.id)
          || personIds.has(person.id)) return null;
        personIds.add(person.id);
        projected.id = person.id;
      }
      if ("credits" in person) {
        const credits = text(person.credits, 2000);
        if (credits === null) return null;
        projected.credits = credits;
      }
      lineup.push(projected);
    }
    shows.push({
      id: show.id, available: true, name, date, time, venueName, location, ticketLink,
      status: show.status as Extract<WebsiteLineupEntry, { available: true }>["status"],
      lineup,
    });
  }
  return { version: 1, updatedAt: feed.updatedAt, shows };
}

/** The feed's combined doors/show format; ambiguous clocks stay unannounced. */
function sourceTimes(value: string): { doorsTime: string; startTime: string } {
  const match = /^Doors\s+(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:[·,|]\s*)?Show\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(value);
  if (!match) return { doorsTime: "", startTime: "" };
  const doorHour = Number(match[1]);
  const doorMinute = Number(match[2]);
  const showHour = Number(match[4]);
  const showMinute = Number(match[5]);
  if (doorHour < 1 || doorHour > 12 || showHour < 1 || showHour > 12
    || doorMinute > 59 || showMinute > 59) return { doorsTime: "", startTime: "" };
  const minutes = (hour: number, minute: number, meridiem: string) =>
    (hour % 12 + (meridiem.toLowerCase() === "pm" ? 12 : 0)) * 60 + minute;
  const start = minutes(showHour, showMinute, match[6]);
  const doors = minutes(doorHour, doorMinute, match[3] || match[6]);
  // A trailing suffix can apply to both clocks, but never infer an overnight
  // date change from a suffix that was omitted on the doors time.
  if (!match[3] && doors > start) return { doorsTime: "", startTime: "" };
  const clock = (number: number) =>
    String(Math.floor(number / 60)).padStart(2, "0") + ":" + String(number % 60).padStart(2, "0");
  return { doorsTime: clock(doors), startTime: clock(start) };
}

function publicLineup(source: Extract<WebsiteLineupEntry, { available: true }>): ShowPerformer[] {
  return source.lineup.map((person, index) => ({
    id: "showrunner-" + source.id + "-" + (person.id === undefined ? "index-" + index : "id-" + person.id),
    name: person.name,
    role: "",
    note: person.credits || "",
    imageUrl: "",
    imageAlt: "",
    url: "",
  }));
}

/**
 * Request-time public overlay. Never save this derived result into admin
 * content: the producer's original copy and manual show records stay intact.
 */
export function mergeWebsiteLineups(
  content: Content,
  feed: WebsiteLineupFeed,
  links: readonly WebsiteLineupLink[],
): Content {
  const byId = new Map(feed.shows.map((show) => [show.id, show]));
  const claimed = new Set<number>();
  const managed: Show[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    if (seen.has(link.id) || !ID.test(link.id) || !calendarDate(link.date)) continue;
    seen.add(link.id);
    const series = link.series ?? content.weekly.slug;
    const generatedId = "showrunner-" + link.id;
    const marked = content.shows
      .map((show, index) => ({ show, index }))
      .filter(({ show, index }) => !claimed.has(index)
        && (show.showrunnerId === link.id || show.id === generatedId));
    const matching = marked.length ? marked : content.shows
      .map((show, index) => ({ show, index }))
      .filter(({ show, index }) => !claimed.has(index)
        && !show.showrunnerId && show.date === link.date && show.series === series);
    // Ambiguous manually authored nights are never guessed at or overwritten.
    const adopted = marked[0] ?? (matching.length === 1 ? matching[0] : undefined);
    if (marked.length) for (const entry of marked) claimed.add(entry.index);
    else if (adopted) claimed.add(adopted.index);

    const existing = adopted?.show;
    const template = newWeeklyShow(content.weekly, link.date, new Date("2000-01-01T12:00:00Z"));
    const base: Show = existing ?? {
      ...template, id: generatedId, slug: generatedId, date: link.date, published: true,
    };
    const source = byId.get(link.id);
    const show: Show = {
      ...base, showrunnerId: link.id, series, lineup: [],
      lineupUnavailable: source?.available !== true,
    };
    if (source?.available) {
      show.lineup = publicLineup(source);
      show.date = source.date;
      Object.assign(show, sourceTimes(source.time));
      show.venueName = source.venueName;
      if (source.location !== base.address || source.location === "") {
        show.address = source.location;
        show.city = "";
        show.region = "";
        show.postalCode = "";
      }
      if (!existing || existing.id === generatedId) {
        show.title = source.name || template.title;
        show.ticketUrl = source.ticketLink;
        show.published = source.status !== "completed";
      }
      show.status = source.status === "cancelled" ? "cancelled"
        : base.status === "sold-out" || base.status === "postponed" ? base.status : "scheduled";
      if (source.status === "completed") show.published = false;
    }
    managed.push(show);
  }
  // Managed occurrences precede ambiguous manual duplicates so recurring-page
  // selection cannot accidentally choose an old manual lineup first.
  return { ...content, shows: [
    ...managed,
    ...content.shows.filter((_show, index) => !claimed.has(index)),
  ] };
}
