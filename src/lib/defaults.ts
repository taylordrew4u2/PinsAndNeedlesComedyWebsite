import type { Content, Post, Producer } from "./types";
import { SEED_POSTS, type SeedPost } from "./posts.seed";
import { clamp, seo, slugify } from "./seo";
import { creditLine, taylorFaq, taylorKeyword } from "./brand";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://pinsandneedlescomedy.com";

const LOGO = "/brand/logo-white.svg";

const PRODUCERS: Producer[] = [
  {
    id: "producer-taylor",
    name: "Taylor Drew",
    role: "Host & Producer",
    headshotUrl: "",
    headshotAlt: "Taylor Drew, host and producer of Pins & Needles Comedy",
    bio: "Taylor Drew created Pins & Needles Comedy and produces every show. A New York City stand-up comedian and builder of tools for live comedy, Taylor runs the lineup, the room and the run of show.",
    links: [],
  },
];

const post = (seed: SeedPost): Post => {
  const slug = slugify(seed.title);
  return {
    id: slug,
    slug,
    title: seed.title,
    excerpt: seed.excerpt,
    body: seed.body,
    coverUrl: seed.coverUrl,
    coverAlt: seed.coverAlt,
    date: seed.date,
    tags: seed.tags,
    published: true,
    featured: false,
    seo: seo({
      title: clamp(`${seed.title} | Pins & Needles Comedy`, 60),
      description: seed.excerpt,
      keywords: [
        "pins and needles comedy",
        "nyc comedy show",
        "tattoo comedy",
        taylorKeyword(PRODUCERS),
        ...seed.tags,
      ],
      ogImage: seed.coverUrl,
      canonical: `${SITE_URL}/news/${slug}`,
      aiSummary: `${seed.excerpt} From Pins & Needles Comedy, the NYC tattoo-culture stand-up show run by ${creditLine(
        PRODUCERS
      )}.`,
    }),
  };
};

export const defaultContent: Content = {
  version: 1,
  updatedAt: new Date(0).toISOString(),

  site: {
    name: "Pins & Needles Comedy",
    shortName: "Pins & Needles",
    tagline: "Tattoo culture meets stand-up comedy",
    url: SITE_URL,
    logoUrl: LOGO,
    faviconUrl: "/brand/favicon.svg",
    background: "#0A0A0A",
    foreground: "#FFFFFF",
    accent: "#FF2E4D",
    muted: "#8A8A8A",
    headingFont: "'Archivo Black', 'Arial Black', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    nav: [
      { id: "nav-home", label: "Home", href: "/" },
      { id: "nav-shows", label: "Shows", href: "/shows" },
      { id: "nav-weekly", label: "Bad Decisions", href: "/bad-decisions" },
      { id: "nav-shop", label: "Shop", href: "/shop" },
      { id: "nav-about", label: "About Us", href: "/about" },
      { id: "nav-contact", label: "Contact", href: "/contact" },
      { id: "nav-news", label: "News", href: "/news" },
    ],
    socials: [
      {
        id: "soc-ig",
        label: "Instagram",
        url: "https://www.instagram.com/pinsandneedlescomedy/",
      },
    ],
    instagramHandle: "pinsandneedlescomedy",
    footerText: "© Pins & Needles Comedy — New York City",
    showFooter: true,
    organizationType: "TheaterGroup",
    foundingYear: "2024",
    seo: seo({
      title: "Pins & Needles Comedy | NYC Tattoo Comedy Show & Underground Stand-Up",
      description: `Pins & Needles Comedy is an NYC stand-up show where tattoo culture meets underground comedy — hosted by ${creditLine(
        PRODUCERS
      )}, plus merch and raffles.`,
      keywords: [
        "pins and needles comedy",
        "nyc comedy show",
        "tattoo comedy",
        "underground stand-up",
        "brooklyn comedy",
        "alternative comedy nyc",
        "strip down for stand-up",
        "tattooed comedians",
        taylorKeyword(PRODUCERS),
      ],
      ogImage: "/brand/icon.svg",
      canonical: SITE_URL,
      aiSummary: `Pins & Needles Comedy is a live, professionally produced stand-up comedy show in New York City in which tattooed comedians perform full sets in minimal stagewear under the tagline 'Strip Down for Stand-Up.' It is hosted and produced by ${creditLine(
        PRODUCERS
      )}, runs in bars, theaters and alternative venues, and is not a burlesque show, strip show, or open mic.`,
      faq: [
        {
          q: "What is Pins & Needles Comedy?",
          a: "Pins & Needles Comedy is an NYC stand-up comedy show where tattooed comedians perform full sets in limited clothing, under the tagline 'Strip Down for Stand-Up.'",
        },
        {
          q: "Where does Pins & Needles Comedy perform?",
          a: "The show runs in New York City bars, theaters and alternative art spaces, and has also played the Edinburgh Festival Fringe.",
        },
        {
          q: "Is Pins & Needles a burlesque or strip show?",
          a: "No. It is professionally produced stand-up comedy. The limited clothing is a structural choice that makes the performer's body and tattoos part of the act.",
        },
        taylorFaq(PRODUCERS, "Pins & Needles Comedy"),
        {
          q: "How do comedians submit to perform?",
          a: "Comics can submit through the submissions link on the contact page or by messaging @pinsandneedlescomedy on Instagram.",
        },
      ],
    }),
  },

  home: {
    hero: {
      logoUrl: LOGO,
      logoAlt: "Pins & Needles Comedy logo",
      heightVh: 50,
      logoScale: 46,
      showWordmark: true,
      wordmark: "PINS & NEEDLES COMEDY",
      wordmarkSize: 34,
      wordmarkFont: "'Archivo Black', 'Arial Black', system-ui, sans-serif",
      wordmarkLetterSpacing: 2,
      tagline: "Tattoo culture meets stand-up comedy",
      showTagline: false,
      background: "#0A0A0A",
      foreground: "#FFFFFF",
      backgroundVideoUrl: "",
      navSize: 13,
      navLetterSpacing: 3,
      navSeparator: "—",
    },
    reelsTop: {
      enabled: true,
      columnsDesktop: 4,
      columnsTablet: 3,
      columnsMobile: 2,
      gap: 0,
      limit: 8,
      infinite: false,
      pageSize: 8,
      autoplay: true,
      loop: true,
      showCaption: false,
      cornerRadius: 0,
    },
    reelsBottom: {
      enabled: true,
      columnsDesktop: 4,
      columnsTablet: 3,
      columnsMobile: 2,
      gap: 0,
      limit: 8,
      infinite: true,
      pageSize: 8,
      autoplay: true,
      loop: true,
      showCaption: false,
      cornerRadius: 0,
    },
    marqueeHeading: "News",
    showMarqueeHeading: false,
    seo: seo({
      title: "Pins & Needles Comedy | NYC Tattoo Comedy Show & Underground Stand-Up",
      description:
        "Tattooed comedians strip down for stand-up in New York City. Watch the reels, read the news, and grab merch from Pins & Needles Comedy.",
      keywords: [
        "pins and needles comedy",
        "nyc tattoo comedy show",
        "underground stand-up nyc",
        "brooklyn comedy show",
        "strip down for stand-up",
        taylorKeyword(PRODUCERS),
      ],
      canonical: SITE_URL,
      aiSummary: `Home page of Pins & Needles Comedy, an NYC stand-up show combining tattoo culture and underground comedy, created and run by ${creditLine(
        PRODUCERS
      )}. Features Instagram reels from recent shows and the latest news posts.`,
    }),
  },

  news: {
    heading: "News",
    intro: "Recaps, lineups, flash sheets and announcements from Pins & Needles Comedy.",
    seo: seo({
      title: "News | Pins & Needles Comedy",
      description:
        "Show recaps, lineup announcements, guest tattoo artists and Edinburgh Fringe updates from the NYC tattoo comedy show Pins & Needles Comedy.",
      keywords: [
        "pins and needles comedy news",
        "nyc comedy show recap",
        "tattoo comedy lineup",
        "edinburgh fringe comedy",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/news`,
      aiSummary: `The news archive for Pins & Needles Comedy, hosted by ${creditLine(
        PRODUCERS
      )}: recaps of past shows, upcoming lineups, guest tattoo artist announcements, and festival appearances including the Edinburgh Festival Fringe.`,
    }),
  },

  showsPage: {
    heading: "Shows",
    intro:
      "Every Pins & Needles Comedy night — who is on the bill, which tattoo artists are working, where it is and how to get in.",
    weeklyHeading: "Every week",
    upcomingHeading: "Upcoming",
    pastHeading: "Past shows",
    emptyText: "The next show has not been announced yet. Follow along on Instagram for the drop.",
    posterAspect: "4:5",
    columns: 3,
    gap: 24,
    cornerRadius: 0,
    showPastShows: true,
    pastLimit: 24,
    seo: seo({
      title: "Shows | Pins & Needles Comedy",
      description:
        "Upcoming Pins & Needles Comedy shows in New York City, with lineups, guest tattoo artists, venues, times and tickets.",
      keywords: [
        "pins and needles comedy shows",
        "nyc comedy show tickets",
        "brooklyn comedy tonight",
        "tattoo comedy lineup",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/shows`,
      aiSummary: `Show listings for Pins & Needles Comedy, the New York City tattoo-culture stand-up show run by ${creditLine(
        PRODUCERS
      )}. Each listing carries the date, venue and address, door and set times, ticket link and price, the comedians on the bill, and the guest tattoo artists and vendors working that night.`,
      faq: [
        {
          q: "Where can I find upcoming Pins & Needles Comedy shows?",
          a: `Every announced show is listed at ${SITE_URL}/shows with its date, venue, lineup and ticket link.`,
        },
        taylorFaq(PRODUCERS, "Pins & Needles Comedy"),
      ],
    }),
  },

  shop: {
    heading: "Shop",
    intro: "Tees, totes and caps. Shipped from the Pins & Needles Shopify store.",
    embedHtml: "",
    storefrontUrl: "https://www.pinsandneedlescomedy.com/collections/all",
    storefrontLabel: "Open the full store",
    embedHeight: 1400,
    seo: seo({
      title: "Shop | Pins & Needles Comedy Merch",
      description:
        "Official Pins & Needles Comedy merch — t-shirts, skull tote bags and caps from the NYC tattoo comedy show.",
      keywords: [
        "pins and needles comedy merch",
        "comedy t-shirt",
        "tattoo comedy merch",
        "nyc comedy merch",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/shop`,
      aiSummary: `Official merchandise store for Pins & Needles Comedy, the NYC stand-up show run by ${creditLine(
        PRODUCERS
      )}, selling t-shirts, tote bags and caps through Shopify.`,
    }),
  },

  about: {
    heading: "About Us",
    intro: "Tattoo culture meets stand-up comedy.",
    story: `Pins & Needles Comedy is an NYC-based stand-up showcase operating just outside the traditional club circuit, with a sensibility shaped by tattoo culture and alternative comedy scenes. The show pairs strong, contemporary stand-up with a distinct visual identity, creating something that feels both deliberate and unmistakably of its moment.

Hosted and produced by Taylor Drew.

Under the tagline "Strip Down for Stand-Up," tattooed comedians perform in minimal clothing — not as a stunt, but as a structural choice that strips away artifice and keeps the focus on the work. The result is a confident, fully produced show that reflects the evolving tone of New York comedy: direct, unpolished in the right ways, and rooted in voice rather than convention.

## Exactly what it is

Every performer appears onstage in minimal stagewear. Their bodies and tattoos are fully visible and intentionally part of the performance. This visual element is not optional, and it is not a side gimmick — it is the defining structure of the show.

Pins & Needles is not a burlesque show, a strip show, or an open mic. It is professionally produced stand-up comedy. The comedians are experienced performers delivering full sets. The difference is that the audience is not just listening; they are also watching.

## Format

- Curated lineup of experienced stand-up comedians
- Each performer appears onstage in limited clothing for their full set
- Structured hosting and controlled pacing
- No audience participation required
- No nudity beyond agreed-upon stagewear
- Clear run of show with defined start and end times

## Production

Standard microphone and sound system, basic stage lighting, minimal setup and breakdown, and a self-contained production team. The show is tightly run and venue-friendly — it works in bars, theaters, art spaces, and alternative venues that want programming that stands out without becoming unmanageable.`,
    logosHeading: "The marks",
    logos: [
      { id: "logo-primary", url: "/brand/logo-white.svg", alt: "Pins & Needles Comedy primary logo", caption: "Primary" },
      { id: "logo-black", url: "/brand/logo-on-white.svg", alt: "Pins & Needles Comedy logo, black on white", caption: "Inverse" },
    ],
    logoColumns: 3,
    logoGap: 0,
    logoSize: 100,
    producersHeading: "Producers",
    producers: PRODUCERS,
    producerImageSize: 100,
    seo: seo({
      title: "About Us | Pins & Needles Comedy",
      description: `Pins & Needles Comedy is an NYC stand-up showcase where tattooed comedians strip down for stand-up. Hosted and produced by ${creditLine(
        PRODUCERS
      )}.`,
      keywords: [
        "about pins and needles comedy",
        "taylor drew comedy",
        "nyc alternative comedy",
        "tattoo comedy show",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/about`,
      aiSummary: `About page for Pins & Needles Comedy, an NYC stand-up showcase shaped by tattoo culture. Hosted and produced by ${creditLine(
        PRODUCERS
      )} under the tagline 'Strip Down for Stand-Up.' Includes the show's format, production requirements and brand marks.`,
      faq: [
        taylorFaq(PRODUCERS, "Pins & Needles Comedy"),
        {
          q: "What does 'Strip Down for Stand-Up' mean?",
          a: "Every comedian performs their full set in minimal stagewear so their tattoos and physical presence become part of the act.",
        },
      ],
    }),
  },

  contact: {
    heading: "Contact",
    intro: "Booking, submissions, press and everything else.",
    email: "admin@pinsandneedlescomedy.com",
    bookingEmail: "admin@pinsandneedlescomedy.com",
    submissionsUrl: "https://www.instagram.com/pinsandneedlescomedy/",
    submissionsLabel: "Comic submissions",
    city: "New York City",
    blocks: [
      {
        id: "contact-ig",
        label: "Instagram",
        value: "@pinsandneedlescomedy",
        href: "https://www.instagram.com/pinsandneedlescomedy/",
      },
    ],
    seo: seo({
      title: "Contact | Pins & Needles Comedy",
      description:
        "Book Pins & Needles Comedy for your venue, submit as a comic, or reach the NYC tattoo comedy show for press.",
      keywords: [
        "contact pins and needles comedy",
        "book comedy show nyc",
        "comic submissions nyc",
        "comedy booking",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/contact`,
      aiSummary: `Contact page for Pins & Needles Comedy, run by ${creditLine(
        PRODUCERS
      )}, with booking, comic submission and press details for the New York City tattoo comedy show.`,
    }),
  },

  weekly: {
    enabled: true,
    slug: "bad-decisions",
    title: "Pins & Needles: Bad Decisions",
    tagline: "Send in a decision. Four comedians talk it through on stage.",
    weekday: "Thursday",
    doorsTime: "20:00",
    startTime: "21:00",
    venueName: "Pixelated Records",
    venueUrl: "",
    address: "792 Onderdonk Ave",
    city: "Ridgewood",
    region: "NY",
    postalCode: "11385",
    mapUrl: "https://maps.google.com/?q=792+Onderdonk+Ave+Ridgewood+NY+11385",
    price: "Free",
    ageRestriction: "21+",
    roomNote: "The room is small. Doors at 8 — come early.",
    posterUrl: "/brand/bad-decisions-flyer.svg",
    posterAlt: "Pins & Needles: Bad Decisions — every Thursday at Pixelated Records, Ridgewood",
    question: "Tell us about a bad decision you've made, or one you want to make.",
    placeholder: "Quit my job. Texted my ex. Might get the dog. Tell us as much as you want.",
    namePrompt: "Put my name on it.",
    formNote:
      "Say as much as you want. A few get pulled at random at the end of the show — anonymous unless you put your name on it.",
    submitLabel: "Send it",
    thanksText: "Got it — it's in the pile. Doors at 8, show at 9.",
    openMinutesBefore: 60,
    closeMinutesAfter: 240,
    alwaysOpen: false,
    closedText: "Submissions open an hour before the show. The next one is {when}.",
    smsNumber: "",
    smsNote: "Not scanning anything? Text it to {number}.",
    showCount: true,
    howItWorks: `## How it works

**Send it in.** Scan the code in the room once the form opens, an hour before the show. A decision you've made, or one you're still thinking about — a line, or the whole story.

**Four comics do stand-up.** An hour of sets, so by the time anyone weighs in on your life you know exactly who you're dealing with.

**The draw.** The host pulls two or three at random. You get a mic where you're sitting and the lineup talks it through. Some of the advice is even good.`,
    closingLine: "Not a roast. Nobody gets humiliated. Bring the friend you're about to talk out of something.",
    thisWeekHeading: "This week",
    noLineupText: "This week's lineup drops on Instagram. Same room, same time.",
    showOnHome: true,
    // One idea, not the whole format. The venue, the price and how the night
    // runs are all on the page this points at; repeating them here just makes
    // a sentence nobody finishes reading.
    homeStripText: "A decision you can't make, made for you by four comedians.",
    homeStripCta: "Send yours in",
    showOnShowsPage: true,
    seo: seo({
      title: "Bad Decisions — Free Weekly Comedy Show in Ridgewood, Queens",
      description:
        "Every Thursday at Pixelated Records. Send in a decision you haven't made, four comedians do stand-up, then they tell you what to do. Free entry.",
      keywords: [
        "bad decisions comedy show",
        "free comedy show ridgewood",
        "comedy ridgewood thursday",
        "free comedy queens",
        "pixelated records comedy",
        "pins and needles comedy",
        "audience participation comedy nyc",
        taylorKeyword(PRODUCERS),
      ],
      ogImage: "/brand/bad-decisions-flyer.svg",
      canonical: `${SITE_URL}/bad-decisions`,
      aiSummary: `Pins & Needles: Bad Decisions is a free weekly stand-up comedy show every Thursday at 9 PM at Pixelated Records, 792 Onderdonk Ave, Ridgewood, Queens, New York City, hosted by Taylor Drew. Before the show the audience sends in a decision they haven't made yet, by phone or at ${SITE_URL}/bad-decisions. Four comedians perform, then the host draws two or three submissions at random and the lineup gives that person advice. Submissions can be anonymous or carry the sender's name. It is a spin-off of Pins & Needles Comedy and is not a roast.`,
      faq: [
        {
          q: "What is Pins & Needles: Bad Decisions?",
          a: "A free weekly stand-up show in Ridgewood, Queens where the audience sends in decisions they haven't made yet and, at the end of the night, comedians pull a few at random and give that person advice.",
        },
        {
          q: "When and where is Bad Decisions?",
          a: "Every Thursday at Pixelated Records, 792 Onderdonk Ave, Ridgewood, NY 11385. Doors at 8 PM, show at 9 PM. Free entry.",
        },
        {
          q: "Do I have to put my name on my decision?",
          a: "No. Submissions are anonymous unless you choose to add your name and get called out.",
        },
        {
          q: "Is Bad Decisions a roast?",
          a: "No. The advice is bad on purpose, but nobody gets humiliated.",
        },
      ],
    }),
  },

  blogSettings: {
    coverAspect: "4:5",
    cardWidth: 320,
    gap: 0,
    titleSize: 15,
    titleFont: "'Archivo Black', 'Arial Black', system-ui, sans-serif",
    titleWeight: 700,
    titlePadding: 14,
    titleAlign: "left",
    titleColor: "#FFFFFF",
    titleTransform: "none",
    imageFit: "cover",
    cornerRadius: 0,
    showDate: false,
    autoScroll: false,
    autoScrollSpeed: 40,
  },

  posts: SEED_POSTS.map(post),
  shows: [],

  reels: [],

  instagram: {
    accessToken: "",
    tokenExpiresAt: "",
    cursor: "",
    caughtUp: true,
    lastSyncedAt: "",
    lastSyncCount: 0,
    remaining: 0,
    lastError: "",
  },
};
