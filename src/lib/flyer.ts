import type { Show, ShowPerformer } from "./types";

/**
 * What a flyer can tell us about a show. Every field is optional: a poster
 * that only says "Saturday, 8pm" still fills in what it can. Names and roles
 * come back as free text; `applyFlyer` turns them into bill entries.
 */
export type FlyerRead = {
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** 24h HH:MM */
  doorsTime: string;
  startTime: string;
  venueName: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  price: string;
  ageRestriction: string;
  performers: { name: string; role: string }[];
};

/** JSON schema the model must answer with — one key per FlyerRead field. */
export const FLYER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "date",
    "doorsTime",
    "startTime",
    "venueName",
    "address",
    "city",
    "region",
    "postalCode",
    "price",
    "ageRestriction",
    "performers",
  ],
  properties: {
    title: { type: "string", description: "Show name as printed. Empty if none." },
    date: {
      type: "string",
      description:
        "Show date as yyyy-mm-dd. If the flyer has no year, pick the next time that month and day occur on or after today. Empty if no date.",
    },
    doorsTime: { type: "string", description: "Doors time as 24h HH:MM. Empty if not printed." },
    startTime: { type: "string", description: "Show start time as 24h HH:MM. Empty if not printed." },
    venueName: { type: "string", description: "Venue or bar name. Empty if none." },
    address: { type: "string", description: "Street address only, no city. Empty if none." },
    city: { type: "string", description: "City or neighborhood as printed. Empty if none." },
    region: { type: "string", description: "Two-letter state, e.g. NY. Empty if none." },
    postalCode: { type: "string", description: "ZIP code. Empty if none." },
    price: { type: "string", description: "Admission as printed, e.g. $10 or Free. Empty if none." },
    ageRestriction: { type: "string", description: "e.g. 21+. Empty if none." },
    performers: {
      type: "array",
      description: "Every person named on the bill, in the order printed.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role"],
        properties: {
          name: { type: "string", description: "Person's name, without @ handles." },
          role: {
            type: "string",
            description:
              "Host, Comedian, Headliner, Feature, Tattoo artist, Vendor, Musician, DJ or Special guest. Comedian when unclear.",
          },
        },
      },
    },
  },
} as const;

export const FLYER_PROMPT =
  "This is a flyer for a live comedy show. Read the printed text and report the show details. " +
  "Use empty strings for anything that is not on the flyer — never guess a venue, price or name. " +
  "Ignore social handles, sponsor logos, and the producer credit unless a producer is also on the bill.";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Any date a person or model would write, as yyyy-mm-dd. A month and day
 * without a year land on the next such day on or after `today`, because a
 * flyer is for something coming up. Returns "" for anything it cannot read.
 */
export function normalizeDate(raw: string, today: string): string {
  const text = (raw || "").trim();
  if (!text) return "";

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(text);
  if (slash) {
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null;
    return build(year, Number(slash[1]), Number(slash[2]), today);
  }

  const lower = text.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  const monthIndex = MONTHS.findIndex((month) => new RegExp(`\\b${month.slice(0, 3)}[a-z]*\\.?\\b`).test(lower));
  if (monthIndex === -1) return "";
  const monthName = MONTHS[monthIndex].slice(0, 3);
  const monthFirst = new RegExp(`\\b${monthName}[a-z]*\\.?\\s+(\\d{1,2})\\b`).exec(lower);
  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+${monthName}[a-z]*\\b`).exec(lower);
  const day = Number((monthFirst || dayFirst)?.[1]);
  if (!day) return "";
  const year = /\b(20\d{2})\b/.exec(lower);
  return build(year ? Number(year[1]) : null, monthIndex + 1, day, today);
}

function build(year: number | null, month: number, day: number, today = ""): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  if (year !== null) return `${year}-${pad(month)}-${pad(day)}`;
  const thisYear = Number(today.slice(0, 4)) || new Date().getUTCFullYear();
  const candidate = `${thisYear}-${pad(month)}-${pad(day)}`;
  return candidate >= today ? candidate : `${thisYear + 1}-${pad(month)}-${pad(day)}`;
}

/** "8pm", "8:30 PM", "20:00", "7:30" → 24h HH:MM. A bare hour with no am/pm reads as evening. */
export function normalizeTime(raw: string): string {
  const text = (raw || "").trim().toLowerCase();
  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/.exec(text);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3]?.[0];
  if (hours > 23 || minutes > 59) return "";
  if (meridiem === "p" && hours < 12) hours += 12;
  else if (meridiem === "a" && hours === 12) hours = 0;
  else if (!meridiem && !match[2] && hours >= 1 && hours < 12) hours += 12;
  return `${pad(hours)}:${pad(minutes)}`;
}

const ROLE_ALIASES: Record<string, string> = {
  host: "Host",
  hosts: "Host",
  hosted: "Host",
  mc: "Host",
  emcee: "Host",
  comic: "Comedian",
  comics: "Comedian",
  comedian: "Comedian",
  comedians: "Comedian",
  headliner: "Headliner",
  headlining: "Headliner",
  feature: "Feature",
  featuring: "Comedian",
  tattoo: "Tattoo artist",
  tattooer: "Tattoo artist",
  artist: "Tattoo artist",
  vendor: "Vendor",
  music: "Musician",
  musician: "Musician",
  band: "Musician",
  dj: "DJ",
  guest: "Special guest",
  special: "Special guest",
};

export function normalizeRole(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "Comedian";
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    if (ROLE_ALIASES[word]) return ROLE_ALIASES[word];
  }
  return text[0].toUpperCase() + text.slice(1);
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Whatever the model sent, as a tidy FlyerRead. Tolerates missing keys and odd formats. */
export function normalizeFlyer(raw: unknown, today: string): FlyerRead {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const performers = Array.isArray(data.performers) ? data.performers : [];
  const seen = new Set<string>();
  return {
    title: clean(data.title),
    date: normalizeDate(clean(data.date), today),
    doorsTime: normalizeTime(clean(data.doorsTime)),
    startTime: normalizeTime(clean(data.startTime)),
    venueName: clean(data.venueName),
    address: clean(data.address),
    city: clean(data.city),
    region: clean(data.region).toUpperCase().slice(0, 2),
    postalCode: clean(data.postalCode),
    price: clean(data.price),
    ageRestriction: clean(data.ageRestriction),
    performers: performers.flatMap((entry) => {
      const person = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const name = clean(person.name).replace(/^@/, "");
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return [];
      seen.add(key);
      return [{ name, role: normalizeRole(clean(person.role)) }];
    }),
  };
}

const newPerformer = (name: string, role: string): ShowPerformer => ({
  id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  name,
  role,
  note: "",
  imageUrl: "",
  imageAlt: "",
  url: "",
});

/**
 * Write what the flyer said onto a show. The flyer wins wherever it found
 * something; fields it left blank keep what was there. Performers already on
 * the bill (by name) are kept as they are, new ones are appended.
 */
export function applyFlyer(show: Show, flyer: FlyerRead): Show {
  const next = { ...show, lineup: [...show.lineup] };
  const fields = [
    "title",
    "date",
    "doorsTime",
    "startTime",
    "venueName",
    "address",
    "city",
    "region",
    "postalCode",
    "price",
    "ageRestriction",
  ] as const;
  for (const field of fields) if (flyer[field]) next[field] = flyer[field];

  const existing = new Set(show.lineup.map((person) => person.name.trim().toLowerCase()));
  for (const person of flyer.performers) {
    if (existing.has(person.name.toLowerCase())) continue;
    next.lineup.push(newPerformer(person.name, person.role));
  }
  return next;
}

/** One line for the admin: what the flyer gave us. */
export function describeFlyer(flyer: FlyerRead): string {
  const parts: string[] = [];
  if (flyer.performers.length) {
    parts.push(`${flyer.performers.length} on the bill`);
  }
  if (flyer.date) parts.push("date");
  if (flyer.startTime || flyer.doorsTime) parts.push("time");
  if (flyer.venueName || flyer.address) parts.push("venue");
  if (flyer.price) parts.push("price");
  if (!parts.length) return "Couldn’t read anything useful off that flyer.";
  return `Read ${parts.join(", ")} from the flyer. Check it over before publishing.`;
}
