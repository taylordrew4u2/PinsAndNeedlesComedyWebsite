import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyFlyer,
  describeFlyer,
  normalizeDate,
  normalizeFlyer,
  normalizeRole,
  normalizeTime,
} from "../src/lib/flyer.ts";
import { emptySeo } from "../src/lib/seo.ts";
import type { Show } from "../src/lib/types.ts";

const TODAY = "2026-09-15";

const show = (partial: Partial<Show> = {}): Show => ({
  id: "show",
  slug: "new-show",
  title: "New show",
  tagline: "",
  date: TODAY,
  doorsTime: "",
  startTime: "",
  endTime: "",
  venueName: "",
  venueUrl: "",
  address: "",
  city: "Brooklyn",
  region: "NY",
  postalCode: "",
  country: "US",
  mapUrl: "",
  roomNote: "",
  ticketUrl: "",
  ticketLabel: "Get tickets",
  price: "",
  currency: "USD",
  ageRestriction: "21+",
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

test("dates in any flyer style land on yyyy-mm-dd, rolling forward when the year is missing", () => {
  assert.equal(normalizeDate("2026-10-03", TODAY), "2026-10-03");
  assert.equal(normalizeDate("Saturday, October 3rd", TODAY), "2026-10-03");
  assert.equal(normalizeDate("SEPT 12", TODAY), "2027-09-12");
  assert.equal(normalizeDate("12 Sept 2026", TODAY), "2026-09-12");
  assert.equal(normalizeDate("10/3", TODAY), "2026-10-03");
  assert.equal(normalizeDate("1/2/27", TODAY), "2027-01-02");
  assert.equal(normalizeDate("Friday", TODAY), "");
  assert.equal(normalizeDate("", TODAY), "");
});

test("times become 24h HH:MM and bare evening hours read as pm", () => {
  assert.equal(normalizeTime("8pm"), "20:00");
  assert.equal(normalizeTime("8:30 PM"), "20:30");
  assert.equal(normalizeTime("20:00"), "20:00");
  assert.equal(normalizeTime("7"), "19:00");
  assert.equal(normalizeTime("12am"), "00:00");
  assert.equal(normalizeTime("12 pm"), "12:00");
  assert.equal(normalizeTime("11:15am"), "11:15");
  assert.equal(normalizeTime(""), "");
});

test("roles collapse onto the site's headings", () => {
  assert.equal(normalizeRole("hosted by"), "Host");
  assert.equal(normalizeRole("MC"), "Host");
  assert.equal(normalizeRole("comics"), "Comedian");
  assert.equal(normalizeRole(""), "Comedian");
  assert.equal(normalizeRole("tattoo artist"), "Tattoo artist");
  assert.equal(normalizeRole("puppeteer"), "Puppeteer");
});

test("a raw model answer is tidied and deduplicated", () => {
  const flyer = normalizeFlyer(
    {
      title: " Pins & Needles ",
      date: "Oct 3",
      startTime: "8pm",
      region: "ny",
      performers: [
        { name: "@Jane Doe", role: "host" },
        { name: "jane doe", role: "comedian" },
        { name: "", role: "comedian" },
        { name: "Sam Ash" },
        "garbage",
      ],
    },
    TODAY
  );
  assert.equal(flyer.title, "Pins & Needles");
  assert.equal(flyer.date, "2026-10-03");
  assert.equal(flyer.startTime, "20:00");
  assert.equal(flyer.doorsTime, "");
  assert.equal(flyer.region, "NY");
  assert.deepEqual(flyer.performers, [
    { name: "Jane Doe", role: "Host" },
    { name: "Sam Ash", role: "Comedian" },
  ]);
  assert.deepEqual(normalizeFlyer(null, TODAY).performers, []);
});

test("the flyer fills a show without wiping what it did not mention", () => {
  const before = show({
    lineup: [{ id: "a", name: "Jane Doe", role: "Host", note: "", imageUrl: "", imageAlt: "", url: "" }],
  });
  const after = applyFlyer(
    before,
    normalizeFlyer(
      {
        date: "2026-10-03",
        startTime: "20:00",
        venueName: "Secret Pour",
        city: "Ridgewood",
        performers: [{ name: "jane doe", role: "Host" }, { name: "Sam Ash", role: "Comedian" }],
      },
      TODAY
    )
  );
  assert.equal(after.title, "New show");
  assert.equal(after.date, "2026-10-03");
  assert.equal(after.startTime, "20:00");
  assert.equal(after.venueName, "Secret Pour");
  assert.equal(after.city, "Ridgewood");
  assert.equal(after.ageRestriction, "21+");
  assert.equal(after.lineup.length, 2);
  assert.equal(after.lineup[0].id, "a");
  assert.equal(after.lineup[1].name, "Sam Ash");
  assert.equal(after.lineup[1].role, "Comedian");
  assert.equal(before.lineup.length, 1);
});

test("the summary line says what was found", () => {
  const flyer = normalizeFlyer(
    { date: "2026-10-03", venueName: "Secret Pour", performers: [{ name: "Sam Ash", role: "" }] },
    TODAY
  );
  assert.match(describeFlyer(flyer), /1 on the bill, date, venue/);
  assert.match(describeFlyer(normalizeFlyer({}, TODAY)), /Couldn’t read/);
});
