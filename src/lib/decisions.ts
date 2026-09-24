import type { Show, Submission, WeeklyPage } from "./types";
import type { Space } from "./space.ts";
import { formatTime, isUpcoming, nyInstant, nyToday } from "./shows.ts";
import { emptySeo, slugify } from "./seo.ts";

/**
 * Hard caps on what the public form accepts. Room to tell the story — people
 * want to explain themselves, and the explanation is usually the funny part —
 * while still being something a host can read aloud without losing the room.
 */
export const DECISION_MAX = 600;
export const NAME_MAX = 60;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Clean up one submission from the form. Returns null when there is nothing
 * usable, which the route turns into a 400.
 *
 * The decision keeps its line breaks — people write a short paragraph, or a
 * list of the reasons they shouldn't — but everything else is tidied: control
 * characters go, runs of spaces collapse, and a wall of blank lines becomes
 * one. The name is a single line, and is dropped entirely unless the sender
 * asked to be named: the form sends `anonymous: true` by default, so a name
 * typed and then un-ticked should not survive.
 */
export function sanitizeSubmission(input: unknown): { decision: string; name: string } | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as { decision?: unknown; name?: unknown; anonymous?: unknown };

  const decision = cleanBody(raw.decision, DECISION_MAX);
  if (!decision) return null;

  const named = raw.anonymous === false;
  const name = named ? cleanLine(raw.name, NAME_MAX) : "";
  return { decision, name };
}

/**
 * One line: every kind of whitespace becomes a single space. Control
 * characters become spaces rather than vanishing, so a name pasted across
 * two lines reads as "Sam Drew" and not "SamDrew".
 */
function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** Several lines: paragraph breaks survive, everything else is tidied away. */
function cleanBody(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    // Control characters, except the newline we just normalised.
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/ +/g, " ")
    .replace(/ *\n */g, "\n")
    // At most one blank line between paragraphs.
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * The time half of a submission id: YYYYMMDDHHMMSSmmm in UTC, fixed width so
 * ids sort by age as plain strings. Shared with the counter below, so the two
 * can never disagree about the format.
 */
export const ID_STAMP_LENGTH = 17;

export function idStamp(now: Date): string {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, ID_STAMP_LENGTH);
}

/** A sortable id: the timestamp first so a directory listing comes back in order. */
export function submissionId(now: Date = new Date()): string {
  return `${idStamp(now)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ID_SHAPE = new RegExp(`^\\d{${ID_STAMP_LENGTH}}-[a-z0-9]+$`);

/**
 * How many submissions came in since `since`, read from the ids alone.
 *
 * This is what the public count on the page is built from, and why it is a
 * single directory listing rather than a read of every file: forty phones in
 * the room polling a number must not turn into forty times five hundred reads
 * a minute. Opening the files would only tell us which have been drawn, and
 * the page says "decisions in so far" — a number that shouldn't tick backwards
 * when the host pulls one out anyway.
 */
export function countIdsSince(ids: string[], since: Date | null): number {
  const floor = since ? idStamp(since) : "";
  return ids.filter(
    (id) => ID_SHAPE.test(id) && (!floor || id.slice(0, ID_STAMP_LENGTH) >= floor)
  ).length;
}

/** The subset a host needs on stage, most recent first. */
export function sortSubmissions(list: Submission[]): Submission[] {
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** One random open submission, or null when the pile is empty. */
export function pickRandom<T>(list: T[], random: () => number = Math.random): T | null {
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/**
 * The next calendar date (yyyy-mm-dd) on or after `today` that falls on the
 * weekly's weekday. `today` is a New York date from nyToday().
 */
export function nextDateForWeekday(weekday: WeeklyPage["weekday"], today: string): string {
  const target = WEEKDAYS.indexOf(weekday);
  const base = new Date(`${today}T12:00:00Z`);
  const current = base.getUTCDay();
  const ahead = (target - current + 7) % 7;
  base.setUTCDate(base.getUTCDate() + ahead);
  return base.toISOString().slice(0, 10);
}

/**
 * The published night of this series that is coming up next, if one has been
 * entered. The page falls back to its own standing details when there isn't.
 */
export function nextWeeklyShow(shows: Show[], weekly: WeeklyPage, today: string): Show | null {
  return (
    shows
      .filter((show) => show.published && show.date && show.series === weekly.slug)
      .filter((show) => isUpcoming(show, today))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0] ?? null
  );
}

/**
 * A ready-to-edit Show for the weekly's next night: date, times, venue and
 * price copied from the standing details, so the only thing left to type is
 * the bill. Starts unpublished.
 */
export function newWeeklyShow(weekly: WeeklyPage, today: string, now: Date = new Date()): Show {
  const date = nextDateForWeekday(weekly.weekday, today);
  const stamp = now.getTime().toString(36);
  return {
    id: `show-${stamp}`,
    slug: slugify(`${weekly.slug} ${date}`),
    title: weekly.title,
    tagline: weekly.tagline,
    date,
    doorsTime: weekly.doorsTime,
    startTime: weekly.startTime,
    endTime: "",
    venueName: weekly.venueName,
    venueUrl: weekly.venueUrl,
    address: weekly.address,
    city: weekly.city,
    region: weekly.region,
    postalCode: weekly.postalCode,
    country: "US",
    mapUrl: weekly.mapUrl,
    roomNote: weekly.roomNote,
    ticketUrl: "",
    ticketLabel: "",
    price: weekly.price,
    currency: "USD",
    ageRestriction: weekly.ageRestriction,
    status: "scheduled",
    posterUrl: weekly.posterUrl,
    posterAlt: weekly.posterAlt,
    description: "",
    lineup: [],
    photos: [],
    recapSlug: "",
    instagramUrl: "",
    series: weekly.slug,
    published: false,
    featured: false,
    seo: emptySeo(),
  };
}

/** "Every Thursday · Doors 8:00 PM · Show 9:00 PM" */
export function weeklyScheduleLine(weekly: WeeklyPage): string {
  const parts = [`Every ${weekly.weekday}`];
  if (weekly.doorsTime) parts.push(`Doors ${formatTime(weekly.doorsTime)}`);
  if (weekly.startTime) parts.push(`Show ${formatTime(weekly.startTime)}`);
  return parts.join(" · ");
}

/** "Pixelated Records — 792 Onderdonk Ave, Ridgewood" */
export function weeklyVenueLine(weekly: WeeklyPage): string {
  const where = [weekly.address, weekly.city].filter(Boolean).join(", ");
  if (weekly.venueName && where) return `${weekly.venueName} — ${where}`;
  return weekly.venueName || where;
}

/** Plain-text brief for llms.txt and AI summaries. */
export function weeklySummary(weekly: WeeklyPage): string {
  return [
    `${weekly.title}: ${weekly.tagline}`,
    `${weeklyScheduleLine(weekly)} at ${weeklyVenueLine(weekly)}.`,
    weekly.price ? `${weekly.price}.` : "",
    weekly.ageRestriction ? `${weekly.ageRestriction}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * When the form is open.
 *
 * The point of the window is that the person sending a decision is in the
 * room. Leave it open all week and you collect a pile from the internet; open
 * it an hour before the show and everything in the pile belongs to someone
 * sitting there when it gets read out. `openMinutesBefore` counts back from
 * the show's start time, `closeMinutesAfter` counts forward from it, and both
 * are editable in the admin because a night that starts late shouldn't need a
 * deploy.
 */
export type SubmissionWindow = {
  open: boolean;
  /** The occurrence this window belongs to, as a New York calendar date. */
  date: string;
  /** ISO instants, or "" when the weekly has no start time set. */
  opensAt: string;
  closesAt: string;
  /** "Thursday at 8:00 PM" — for the closed panel on the page. */
  opensLabel: string;
};

/**
 * The window around the next occurrence of the weekly. Prefers a published
 * night of the series (its date and start time win, because that is the one
 * the host actually typed) and falls back to the standing details.
 *
 * Once an occurrence's window has closed, this rolls forward to the next one,
 * so the page never advertises a door that shut two hours ago.
 */
export function submissionWindow(
  weekly: WeeklyPage,
  shows: Show[],
  now: Date = new Date()
): SubmissionWindow {
  const today = nyToday(now);
  const show = nextWeeklyShow(shows, weekly, today);

  const first = occurrence(weekly, show?.date || nextDateForWeekday(weekly.weekday, today), show?.startTime);
  // Past its close? The night is over — point at next week instead.
  const current =
    first.closesAt && now.getTime() > first.closesAt.getTime()
      ? occurrence(weekly, addDays(first.date, 7), undefined)
      : first;

  const openNow = weekly.alwaysOpen
    ? true
    : Boolean(
        current.opensAt &&
          current.closesAt &&
          now.getTime() >= current.opensAt.getTime() &&
          now.getTime() <= current.closesAt.getTime()
      );

  return {
    open: openNow,
    date: current.date,
    opensAt: current.opensAt?.toISOString() ?? "",
    closesAt: current.closesAt?.toISOString() ?? "",
    opensLabel: current.opensAt
      ? labelFor(current.date, current.opensAt, weekly.weekday, today)
      : "",
  };
}

/**
 * The window for a space. The live show keeps its clock; the dress rehearsal
 * is a practice copy with no clock at all — its form is always open, so it can
 * be tried at any hour without touching the real window.
 */
export function windowFor(
  space: Space,
  weekly: WeeklyPage,
  shows: Show[],
  now: Date = new Date()
): SubmissionWindow {
  if (space === "rehearsal") return { open: true, date: "", opensAt: "", closesAt: "", opensLabel: "" };
  return submissionWindow(weekly, shows, now);
}

function occurrence(
  weekly: WeeklyPage,
  date: string,
  startTime: string | undefined
): { date: string; opensAt: Date | null; closesAt: Date | null } {
  const start = nyInstant(date, startTime || weekly.startTime);
  if (!start) return { date, opensAt: null, closesAt: null };
  return {
    date,
    opensAt: new Date(start.getTime() - clamp(weekly.openMinutesBefore, 0, 10_080) * 60_000),
    closesAt: new Date(start.getTime() + clamp(weekly.closeMinutesAfter, 0, 10_080) * 60_000),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * "Thursday at 8:00 PM", or "tonight at 8:00 PM" when that is today.
 *
 * Naming the weekday on the day itself reads as though it means next week,
 * which is exactly wrong for somebody holding a flyer in the afternoon.
 */
function labelFor(
  date: string,
  opensAt: Date,
  fallbackWeekday: WeeklyPage["weekday"],
  today: string
): string {
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(opensAt);

  if (date === today) return `tonight at ${clock}`;
  if (date === addDays(today, 1)) return `tomorrow at ${clock}`;

  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? fallbackWeekday;
  return `${weekday} at ${clock}`;
}

/**
 * The closed-panel copy with `{when}` filled in. Falls back to dropping the
 * placeholder cleanly when the weekly has no start time to count back from.
 */
export function closedMessage(weekly: WeeklyPage, window: SubmissionWindow): string {
  const text = weekly.closedText || "";
  if (!text.includes("{when}")) return text;
  if (!window.opensLabel) {
    return text.replace(/\s*—?\s*\{when\}/g, "").replace(/\s+/g, " ").trim();
  }
  return text.replace(/\{when\}/g, window.opensLabel);
}
