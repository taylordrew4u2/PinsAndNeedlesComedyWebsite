import { test } from "node:test";
import assert from "node:assert/strict";
import { newWeeklyShow } from "../src/lib/decisions.ts";
import { upcomingPublicShows } from "../src/lib/public-shows.ts";
import {
  mergeWebsiteLineups,
  parseWebsiteLineupFeed,
  type WebsiteLineupFeed,
  type WebsiteLineupLink,
} from "../src/lib/showrunner-lineups.ts";
import type { Content, Show, WeeklyPage } from "../src/lib/types.ts";

const weekly = {
  enabled: true, showOnShowsPage: true, weekday: "Thursday", everyWeeks: 2,
  anchorDate: "2026-11-19", slug: "bad-decisions", title: "Bad Decisions",
  tagline: "Keep the standing copy", doorsTime: "20:00", startTime: "21:00",
  venueName: "Original venue", venueUrl: "https://venue.test",
  address: "Original street", city: "Brooklyn", region: "NY", postalCode: "11201",
  mapUrl: "https://maps.test", price: "$15", ageRestriction: "21+",
  roomNote: "Original room note", posterUrl: "/poster.webp", posterAlt: "Poster",
} as WeeklyPage;
const link: WebsiteLineupLink = { id: "source-1", date: "2026-11-19", series: weekly.slug };

function content(shows: Show[] = []): Content {
  return { version: 1, updatedAt: "2026-01-01T00:00:00Z", shows, weekly,
    site: { name: "Keep this site" } } as Content;
}

function available(overrides: Record<string, unknown> = {}) {
  return {
    id: link.id, available: true, name: "Bad Decisions: Nov 19th",
    date: link.date, time: "Doors 8:30 Show 9:00pm",
    venueName: "Pixelated Records", location: "792 Onderdonk Ave, Ridgewood 11385",
    ticketLink: "https://tickets.test/nov19", status: "upcoming",
    lineup: [
      { id: "comic-b", name: "Second alphabetically", credits: "A public credit" },
      { id: "comic-a", name: "First alphabetically" },
    ],
    ...overrides,
  };
}

function feed(shows: unknown[] = [available()]): WebsiteLineupFeed {
  const parsed = parseWebsiteLineupFeed({
    version: 1, updatedAt: "2026-11-17T03:00:00Z", shows,
  });
  assert.ok(parsed);
  return parsed;
}

function manual(overrides: Partial<Show> = {}): Show {
  return {
    ...newWeeklyShow(weekly, link.date, new Date("2026-01-01T00:00:00Z")),
    id: "manual-show", slug: "my-existing-public-link", date: link.date,
    published: true, title: "A carefully written website title",
    description: "Keep my description", ticketUrl: "https://manual-tickets.test",
    ticketLabel: "My button label", featured: true,
    lineup: [{ id: "stale", name: "An old name", role: "Host", note: "",
      imageUrl: "/old.webp", imageAlt: "Old", url: "https://old.test" }],
    ...overrides,
  };
}

test("parser strips unknown private data and surprise guests while preserving lineup order", () => {
  const result = feed([available({
    email: "producer-private", notes: "Private show notes",
    lineup: [
      { id: "b", name: "B", credits: "Public credit", email: "comic-private",
        phone: "private-phone", socialMedia: "private-social" },
      { id: "secret", name: "A secret performer", surpriseGuest: true, credits: "Secret credit" },
      { id: "a", name: "A", viewerKey: "private-viewer-key" },
    ],
  })]);
  assert.equal(result.shows[0].available, true);
  const entry = result.shows[0];
  assert.ok(entry.available);
  assert.deepEqual(entry.lineup, [
    { id: "b", name: "B", credits: "Public credit" }, { id: "a", name: "A" },
  ]);
  const serialized = JSON.stringify(result);
  for (const secret of ["producer-private", "Private show notes", "comic-private",
    "private-phone", "private-social", "A secret performer", "Secret credit",
    "private-viewer-key"]) assert.ok(!serialized.includes(secret));
  assert.deepEqual(feed([{ id: link.id, available: false, lineup: [{ name: "stale" }] }]).shows,
    [{ id: link.id, available: false }]);
});

test("malformed feed fields are rejected without coercion", () => {
  const invalidShows = [
    available({ id: "../private" }), available({ date: "2026-02-30" }),
    available({ date: "next Thursday" }), available({ date: null }),
    available({ time: null }), available({ venueName: null }),
    available({ lineup: null }), available({ lineup: [null] }),
    available({ lineup: [{ name: "" }] }),
    available({ lineup: [{ name: "Hidden", surpriseGuest: "true" }] }),
    available({ lineup: [{ id: "same", name: "One" }, { id: "same", name: "Two" }] }),
    available({ status: "unknown" }), available({ ticketLink: "javascript:alert(1)" }),
    available({ ticketLink: "https://user:password@tickets.test" }),
  ];
  for (const show of invalidShows) {
    assert.equal(parseWebsiteLineupFeed({
      version: 1, updatedAt: "2026-11-17T03:00:00Z", shows: [show],
    }), null);
  }
  assert.equal(parseWebsiteLineupFeed({ version: 2, updatedAt: "2026-11-17T03:00:00Z", shows: [] }), null);
  assert.equal(parseWebsiteLineupFeed({ version: 1, updatedAt: "yesterday", shows: [] }), null);
  assert.equal(parseWebsiteLineupFeed({ version: 1, updatedAt: "2026-11-17T03:00:00Z", shows: {} }), null);
  assert.equal(parseWebsiteLineupFeed({ version: 1, updatedAt: "2026-11-17T03:00:00Z",
    shows: [available(), available()] }), null);
});

test("legal multiline public text is normalized within backend field limits", () => {
  const credits = "First credit\nSecond credit\tThird credit\r\n" + "C".repeat(3000);
  const venueName = "Venue\n" + "V".repeat(700);
  const current = feed([available({
    name: "Bad Decisions\tLive",
    venueName,
    lineup: [{ id: "comic", name: "First\r\nLast", credits }],
  })]);
  const entry = current.shows[0];
  assert.ok(entry.available);
  assert.equal(entry.name, "Bad Decisions Live");
  assert.equal(entry.venueName, "Venue " + "V".repeat(700));
  assert.deepEqual(entry.lineup, [{
    id: "comic", name: "First Last",
    credits: "First credit Second credit Third credit " + "C".repeat(3000),
  }]);
  for (const control of ["\u0000", "\u000b", "\u001f", "\u007f"]) {
    assert.equal(parseWebsiteLineupFeed({
      version: 1, updatedAt: "2026-11-17T03:00:00Z",
      shows: [available({ lineup: [{ name: "Comic", credits: "Credit" + control }] })],
    }), null);
  }
  for (const invalid of [
    available({ venueName: "V".repeat(1001) }),
    available({ lineup: [{ name: "Comic", credits: "C".repeat(4001) }] }),
  ]) {
    assert.equal(parseWebsiteLineupFeed({
      version: 1, updatedAt: "2026-11-17T03:00:00Z", shows: [invalid],
    }), null);
  }
});

test("unique manual night keeps its public identity, copy, design and ticket settings", () => {
  const saved = manual();
  const original = content([saved]);
  const before = structuredClone(original);
  Object.freeze(saved);
  Object.freeze(saved.lineup);
  const result = mergeWebsiteLineups(original, feed(), [link]);
  const show = result.shows[0];
  assert.equal(result.shows.length, 1);
  assert.equal(show.id, saved.id);
  assert.equal(show.slug, saved.slug);
  assert.equal(show.showrunnerId, link.id);
  for (const key of ["title", "tagline", "description", "posterUrl", "posterAlt",
    "ticketUrl", "ticketLabel", "price", "roomNote", "featured"] as const) {
    assert.equal(show[key], saved[key]);
  }
  assert.deepEqual(show.lineup.map(person => person.name),
    ["Second alphabetically", "First alphabetically"]);
  assert.equal(show.lineup[0].note, "A public credit");
  assert.equal(show.doorsTime, "20:30");
  assert.equal(show.startTime, "21:00");
  assert.equal(show.venueName, "Pixelated Records");
  assert.equal(show.address, "792 Onderdonk Ave, Ridgewood 11385");
  assert.equal(show.city, "");
  assert.equal(show.region, "");
  assert.equal(show.postalCode, "");
  assert.equal(result.updatedAt, original.updatedAt);
  assert.deepEqual(original, before);
});

test("a successful empty lineup and unavailable or missing records all clear old names", () => {
  const original = content([manual()]);
  for (const current of [feed([available({ lineup: [] })]),
    feed([{ id: link.id, available: false }]), feed([])]) {
    const show = mergeWebsiteLineups(original, current, [link]).shows[0];
    assert.deepEqual(show.lineup, []);
    assert.equal(show.slug, original.shows[0].slug);
    assert.equal(show.showrunnerId, link.id);
  }
  assert.equal(original.shows[0].lineup[0].name, "An old name");
});

test("unreadable linked lineups are distinct from successful empty lineups", () => {
  const original = content([manual()]);
  assert.equal(mergeWebsiteLineups(original, feed([available({ lineup: [] })]), [link])
    .shows[0].lineupUnavailable, false);
  assert.equal(mergeWebsiteLineups(original, feed([{ id: link.id, available: false }]), [link])
    .shows[0].lineupUnavailable, true);
  assert.equal(mergeWebsiteLineups(original, feed([]), [link])
    .shows[0].lineupUnavailable, true);
});

test("generated linked shows have stable source-based routes and fill the right recurring nights", () => {
  const dates = ["2026-11-19", "2026-12-03", "2026-12-17", "2026-12-31"];
  const links = dates.map((date, index) => ({ id: "source-" + index, date, series: weekly.slug }));
  const current = feed(links.map((item, index) =>
    available({ id: item.id, date: item.date, lineup: [{ name: "Comic " + index }] })));
  const past = manual({ id: "archive", slug: "archive", date: "2026-09-03" });
  const result = mergeWebsiteLineups(content([past]), current, links);
  assert.equal(result.shows.length, 5);
  for (const item of links) {
    const show = result.shows.find(show => show.showrunnerId === item.id);
    assert.ok(show);
    assert.equal(show.id, "showrunner-" + item.id);
    assert.equal(show.slug, "showrunner-" + item.id);
    assert.equal(show.date, item.date);
    assert.equal(show.series, weekly.slug);
    assert.equal(show.published, true);
  }
  const publicShows = upcomingPublicShows(result.shows, weekly, "2026-11-16");
  assert.deepEqual(publicShows.slice(0, 4).map(show => show.lineup[0]?.name),
    ["Comic 0", "Comic 1", "Comic 2", "Comic 3"]);
  assert.equal(publicShows[4].lineup.length, 0);
  assert.ok(result.shows.includes(past));
});

test("source rename and date move keep generated routes stable and adopt by original linked date", () => {
  const original = content([manual()]);
  const moved = mergeWebsiteLineups(original,
    feed([available({ date: "2026-11-20", name: "Renamed source" })]), [link]);
  assert.equal(moved.shows.length, 1);
  assert.equal(moved.shows[0].date, "2026-11-20");
  assert.equal(moved.shows[0].slug, "my-existing-public-link");
  const first = mergeWebsiteLineups(content(), feed(), [link]);
  const next = mergeWebsiteLineups(first,
    feed([available({ date: "2026-11-20", name: "Renamed source" })]), [link]);
  assert.equal(next.shows.length, 1);
  assert.equal(next.shows[0].slug, first.shows[0].slug);
  assert.equal(next.shows[0].title, "Renamed source");
  assert.equal(next.shows[0].date, "2026-11-20");
});

test("unrelated one-offs and ambiguous matching manual records are preserved", () => {
  const oneOff = manual({ id: "one-off", series: "", slug: "one-off" });
  const first = manual();
  const second = manual({ id: "second", slug: "second" });
  const result = mergeWebsiteLineups(content([oneOff, first, second]), feed(), [link]);
  assert.equal(result.shows.length, 4);
  assert.equal(result.shows[0].id, "showrunner-" + link.id);
  assert.ok(result.shows.includes(oneOff));
  assert.ok(result.shows.includes(first));
  assert.ok(result.shows.includes(second));
  assert.equal(upcomingPublicShows(result.shows, weekly, "2026-11-16")
    .find(show => show.series === weekly.slug)?.showrunnerId, link.id);
});

test("cancelled source stays cancelled and completed source is not republished as cancelled", () => {
  const cancelled = mergeWebsiteLineups(content(),
    feed([available({ status: "cancelled" })]), [link]).shows[0];
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.published, true);
  assert.equal(upcomingPublicShows([cancelled], weekly, "2026-11-16")[0].status, "cancelled");
  const completed = mergeWebsiteLineups(content(),
    feed([available({ status: "completed" })]), [link]).shows[0];
  assert.equal(completed.status, "scheduled");
  assert.equal(completed.published, false);
  const reopened = mergeWebsiteLineups(content([completed]), feed(), [link]).shows[0];
  assert.equal(reopened.published, true);
});

test("empty source date and malformed clocks clear old confirmed date and time", () => {
  for (const time of ["", "later tonight", "Doors 25:00 Show 9:00pm",
    "Doors 8:99 Show 9:00pm", "Doors 11:30 Show 12:00am"]) {
    const show = mergeWebsiteLineups(content([manual()]),
      feed([available({ date: "", time })]), [link]).shows[0];
    assert.equal(show.date, "");
    assert.equal(show.doorsTime, "");
    assert.equal(show.startTime, "");
  }
});

test("only configured source IDs can add public show data", () => {
  const result = mergeWebsiteLineups(content(),
    feed([available({ id: "not-configured", lineup: [{ name: "Not for this website" }] })]), [link]);
  assert.equal(result.shows.length, 1);
  assert.equal(result.shows[0].id, "showrunner-" + link.id);
  assert.deepEqual(result.shows[0].lineup, []);
});
