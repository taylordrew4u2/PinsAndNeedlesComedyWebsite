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
      aiSummary: `${seed.excerpt} From Pins & Needles Comedy, the NYC comedy brand creating original stand-up shows run by ${creditLine(
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
    tagline: "Comedy about the things that leave a mark.",
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
      title: "Pins & Needles Comedy | Original NYC Stand-Up Shows",
      description: "Original stand-up shows in New York City about the choices we make, the things we reveal, and what stays with us. Comedy about the things that leave a mark.",
      keywords: [
        "pins and needles comedy",
        "nyc comedy show",
        "tattoo comedy",
        "underground stand-up",
        "brooklyn comedy",
        "alternative comedy nyc",
        "audience participation comedy",
        "original comedy shows",
        taylorKeyword(PRODUCERS),
      ],
      ogImage: "/brand/icon.svg",
      canonical: SITE_URL,
      aiSummary: `Pins & Needles Comedy creates original stand-up shows in New York City about choices, vulnerability and what stays with us. Its formats include the original tattoo-focused show and Bad Decisions, bringing together stand-up and audience participation. Tattoos are part of its roots, not a requirement. Created and produced by ${creditLine(PRODUCERS)}.`,
      faq: [
        {
          q: "What is Pins & Needles Comedy?",
          a: "Pins & Needles Comedy creates original stand-up shows in New York City about the choices we make, the things we reveal, and what stays with us afterward.",
        },
        {
          q: "Where does Pins & Needles Comedy perform?",
          a: "The show runs in New York City bars, theaters and alternative art spaces, and has also played the Edinburgh Festival Fringe.",
        },
        {
          q: "Do I need tattoos to enjoy Pins & Needles Comedy?",
          a: "No. Tattoos are part of our roots, but they aren’t the whole story. You don’t need tattoos. Questionable judgment will do.",
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
      tagline: "Comedy about the things that leave a mark.",
      showTagline: true,
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
      title: "Pins & Needles Comedy | Original NYC Stand-Up Shows",
      description:
        "Comedy about the things that leave a mark. Original NYC stand-up shows about choices, vulnerability and what stays with us. You don’t need tattoos.",
      keywords: [
        "pins and needles comedy",
        "nyc stand-up comedy shows",
        "underground stand-up nyc",
        "brooklyn comedy show",
        "audience participation comedy",
        taylorKeyword(PRODUCERS),
      ],
      canonical: SITE_URL,
      aiSummary: `Home page of Pins & Needles Comedy, a brand creating original NYC stand-up shows about choices, vulnerability and what stays with us, created and run by ${creditLine(
        PRODUCERS
      )}. Features Instagram reels from recent shows and the latest news posts.`,
    }),
  },

  hallOfFame: {
    heading: "Hall of Fame",
    intro: "The people who left a mark. A little love for everyone who’s taken the stage with Pins & Needles Comedy.",
    emptyText: "The wall is taking shape. Our performers will be up here soon.",
    showInNav: true,
    performers: [],
    seo: seo({
      title: "Hall of Fame | Pins & Needles Comedy",
      description: "Meet the performers who have taken the stage with Pins & Needles Comedy in New York City. The people who left a mark.",
      canonical: `${SITE_URL}/hall-of-fame`,
      keywords: ["pins and needles comedy", "nyc stand-up comedians", "comedy hall of fame"],
      aiSummary: "The Pins & Needles Comedy Hall of Fame celebrates the performers who have appeared at its original stand-up shows in New York City.",
    }),
  },

  news: {
    heading: "News",
    intro: "Recaps, lineups, flash sheets and announcements from Pins & Needles Comedy.",
    seo: seo({
      title: "News | Pins & Needles Comedy",
      description:
        "Show recaps, lineup announcements, guest tattoo artists and Edinburgh Fringe updates from the NYC comedy brand Pins & Needles Comedy.",
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
      "From our original tattoo-focused show to Bad Decisions: original stand-up shows about the things that leave a mark. Find lineups, venues and tickets here.",
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
        "Upcoming Pins & Needles Comedy shows in New York City, with lineups, venues, times and tickets for our original formats, including Bad Decisions.",
      keywords: [
        "pins and needles comedy shows",
        "nyc comedy show tickets",
        "brooklyn comedy tonight",
        "tattoo comedy lineup",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/shows`,
      aiSummary: `Show listings for Pins & Needles Comedy, the New York City comedy brand creating original stand-up shows run by ${creditLine(
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
        "Official Pins & Needles Comedy merch — t-shirts, skull tote bags and caps from the NYC comedy brand.",
      keywords: [
        "pins and needles comedy merch",
        "comedy t-shirt",
        "tattoo comedy merch",
        "nyc comedy merch",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/shop`,
      aiSummary: `Official merchandise store for Pins & Needles Comedy, the NYC comedy brand run by ${creditLine(
        PRODUCERS
      )}, selling t-shirts, tote bags and caps through Shopify.`,
    }),
  },

  about: {
    heading: "About Us",
    intro: "Comedy about the things that leave a mark.",
    story: `Pins & Needles Comedy creates original stand-up comedy shows in New York City about the choices we make, the things we reveal, and what stays with us afterward.

We’re interested in the version of the story you usually clean up before telling people. The questionable judgment. The confidence you had before you knew better. The part you normally leave out so everyone stays on your side.

Our shows bring together stand-up and audience participation to make room for those stories without requiring a moral at the end. Not every mistake makes you a better person. Sometimes it just gives you something funny to talk about. And not every choice that other people question is one you regret.

Vulnerability doesn’t have to mean a serious confession. Sometimes it’s admitting you were the problem. Sometimes it’s defending something nobody else understands. Sometimes it’s getting onstage without pretending you’ve figured everything out. We’re interested in what happens when people stop managing how they look long enough to say something honest.

Tattoos are part of our roots, but they aren’t the whole story. They’re one expression of a bigger idea: making a choice and carrying it with you. That might be something on your skin, a relationship you stayed in, a belief you outgrew, or a sentence you wish you could pull back into your mouth. Some things are permanent. Others just feel permanent when you remember them at three in the morning.

From our original tattoo-focused show to **Bad Decisions**, our formats approach that idea differently. What connects them is a willingness to be seen without editing out every unflattering part—and to find the comedy there.

**You don’t need tattoos. Questionable judgment will do.**`,
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
      description: "Original stand-up shows in New York City about the choices we make, the things we reveal, and what stays with us. Comedy about the things that leave a mark.",
      keywords: [
        "about pins and needles comedy",
        "taylor drew comedy",
        "nyc alternative comedy",
        "tattoo comedy show",
        taylorKeyword(PRODUCERS),
      ],
      canonical: `${SITE_URL}/about`,
      aiSummary: `Pins & Needles Comedy creates original NYC stand-up shows about choices, vulnerability and what stays with us. Tattoos are one expression of making a choice and carrying it with you. The original tattoo-focused show and Bad Decisions explore that idea differently. Created and produced by ${creditLine(PRODUCERS)}.`,
      faq: [
        taylorFaq(PRODUCERS, "Pins & Needles Comedy"),
        {
          q: "What connects the different Pins & Needles Comedy shows?",
          a: "From the original tattoo-focused show to Bad Decisions, our formats find comedy in choices, vulnerability and being seen without editing out every unflattering part. You don’t need tattoos.",
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
        "Book Pins & Needles Comedy for your venue, submit as a comic, or reach the NYC comedy brand for press.",
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
      )}, with booking, comic submission and press details for the New York City comedy brand.`,
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
        "Every Thursday at Pixelated Records. Send in a past or possible decision, four comedians do stand-up, then they tell you what to do. Free entry.",
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
      aiSummary: `Pins & Needles: Bad Decisions is a free weekly stand-up comedy show every Thursday at 9 PM at Pixelated Records, 792 Onderdonk Ave, Ridgewood, Queens, New York City, hosted by Taylor Drew. Before the show the audience sends in a decision they have made or are thinking about making, by phone or at ${SITE_URL}/bad-decisions. Four comedians perform, then the host draws two or three submissions at random and the lineup gives that person advice. Submissions can be anonymous or carry the sender's name. It is one of the original formats from Pins & Needles Comedy and is not a roast.`,
      faq: [
        {
          q: "What is Pins & Needles: Bad Decisions?",
          a: "A free weekly stand-up show in Ridgewood, Queens where the audience sends in decisions they have made or are thinking about making and, at the end of the night, comedians pull a few at random and give that person advice.",
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
