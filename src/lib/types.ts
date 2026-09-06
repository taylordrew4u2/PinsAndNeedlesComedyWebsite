/** Content model for the whole site. Everything here is editable from /admin. */

export type Seo = {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  canonical: string;
  /** Plain-language summary written for AI crawlers / answer engines. */
  aiSummary: string;
  /** Q&A pairs rendered as FAQPage JSON-LD — strong for AI SEO. */
  faq: { q: string; a: string }[];
  noindex: boolean;
};

export type NavItem = { id: string; label: string; href: string };
export type SocialLink = { id: string; label: string; url: string };

export type Reel = {
  id: string;
  /** Public Instagram permalink — clicking the tile opens this. */
  instagramUrl: string;
  /** Direct .mp4 for muted autoplay. Falls back to poster if empty. */
  videoUrl: string;
  posterUrl: string;
  caption: string;
  alt: string;
  order: number;
  published: boolean;
  /** When Instagram published it, ISO timestamp. Empty for a manually added reel. */
  igTimestamp: string;
  /** The Instagram media id it was synced from. Empty for a manually added reel. */
  igMediaId: string;
};

export type InstagramSync = {
  /** A long-lived Instagram access token, pasted in by the admin. Never sent to the browser. */
  accessToken: string;
  /** ISO timestamp; the token is refreshed automatically once this gets close. */
  tokenExpiresAt: string;
  /** Graph API pagination cursor to resume from. Empty means "start from the newest post". */
  cursor: string;
  /** True once a walk has reached either a known post or the end of the account's history. */
  caughtUp: boolean;
  lastSyncedAt: string;
  lastSyncCount: number;
  /** Items still waiting on the current page as of the last sync — 0 once that page is drained. */
  remaining: number;
  lastError: string;
};

export type ReelGridSettings = {
  enabled: boolean;
  columnsDesktop: number;
  columnsTablet: number;
  columnsMobile: number;
  /** px gap between tiles. 0 = edge-to-edge, which is the design default. */
  gap: number;
  /** How many tiles the first (non-infinite) grid shows. */
  limit: number;
  infinite: boolean;
  /** Tiles added per infinite-scroll page. */
  pageSize: number;
  autoplay: boolean;
  loop: boolean;
  showCaption: boolean;
  cornerRadius: number;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown-lite body: blank-line separated paragraphs, ## headings, - lists. */
  body: string;
  coverUrl: string;
  coverAlt: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  published: boolean;
  featured: boolean;
  seo: Seo;
};

export type BlogSettings = {
  /** Crop orientation applied to every blog cover image. */
  coverAspect: "9:16" | "4:5" | "1:1" | "3:2" | "16:9";
  /** Marquee card width in px (height derives from the aspect ratio). */
  cardWidth: number;
  gap: number;
  titleSize: number;
  titleFont: string;
  titleWeight: number;
  titlePadding: number;
  titleAlign: "left" | "center" | "right";
  titleColor: string;
  titleTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  imageFit: "cover" | "contain";
  cornerRadius: number;
  showDate: boolean;
  autoScroll: boolean;
  autoScrollSpeed: number;
};

export type Hero = {
  logoUrl: string;
  logoAlt: string;
  /** Panel height as a % of the viewport. */
  heightVh: number;
  /** Logo width as a % of the panel. */
  logoScale: number;
  showWordmark: boolean;
  wordmark: string;
  wordmarkSize: number;
  wordmarkFont: string;
  wordmarkLetterSpacing: number;
  tagline: string;
  showTagline: boolean;
  background: string;
  foreground: string;
  /** Optional looping background video behind the logo. */
  backgroundVideoUrl: string;
  navSize: number;
  navLetterSpacing: number;
  navSeparator: string;
};

export type LogoItem = { id: string; url: string; alt: string; caption: string };

export type Producer = {
  id: string;
  name: string;
  role: string;
  headshotUrl: string;
  headshotAlt: string;
  bio: string;
  links: SocialLink[];
};

export type AboutPage = {
  heading: string;
  intro: string;
  story: string;
  logosHeading: string;
  logos: LogoItem[];
  logoColumns: number;
  logoGap: number;
  logoSize: number;
  producersHeading: string;
  producers: Producer[];
  producerImageSize: number;
  seo: Seo;
};

export type ShopPage = {
  heading: string;
  intro: string;
  /** Paste a Shopify Buy Button / iframe snippet here. Rendered as-is. */
  embedHtml: string;
  /** Fallback: a plain link out to the Shopify storefront. */
  storefrontUrl: string;
  storefrontLabel: string;
  embedHeight: number;
  seo: Seo;
};

export type ContactPage = {
  heading: string;
  intro: string;
  email: string;
  bookingEmail: string;
  submissionsUrl: string;
  submissionsLabel: string;
  city: string;
  blocks: { id: string; label: string; value: string; href: string }[];
  seo: Seo;
};

/** One person or business on a show bill: comic, host, tattoo artist, vendor, DJ. */
export type ShowPerformer = {
  id: string;
  name: string;
  /** Free text — "Comedian", "Host", "Tattoo artist", "Vendor". Used to group the bill. */
  role: string;
  note: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
};

export type ShowPhoto = { id: string; url: string; alt: string; caption: string };

export type ShowStatus = "scheduled" | "sold-out" | "postponed" | "cancelled";

/** Everything about one night: when, where, who, how to get in, and what happened. */
export type Show = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  /** ISO yyyy-mm-dd, in New York time. Drives upcoming vs. past. */
  date: string;
  /** 24h HH:MM. Empty means "not announced". */
  doorsTime: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueUrl: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  mapUrl: string;
  roomNote: string;
  ticketUrl: string;
  ticketLabel: string;
  price: string;
  currency: string;
  ageRestriction: string;
  status: ShowStatus;
  posterUrl: string;
  posterAlt: string;
  /** Markdown-lite, same as a blog post body. */
  description: string;
  lineup: ShowPerformer[];
  photos: ShowPhoto[];
  /** Slug of the /news post recapping this show, if there is one. */
  recapSlug: string;
  instagramUrl: string;
  /**
   * Which recurring show this night belongs to. Empty for a one-off. The
   * weekly page (/bad-decisions) finds its "this week" lineup by matching
   * this against its own slug.
   */
  series: string;
  published: boolean;
  featured: boolean;
  seo: Seo;
};

/**
 * The weekly show and its submission form, at /bad-decisions.
 *
 * Deliberately its own page rather than a Show entry: a Show is one night,
 * and this is a standing Thursday. The weekly's individual nights still live
 * in `shows` (tagged with `series`) so each one gets a lineup and a page.
 */
export type WeeklyPage = {
  enabled: boolean;
  /** Matches Show.series. */
  slug: string;
  title: string;
  tagline: string;
  /** "Every Thursday" — shown in the header and used for the event schedule. */
  weekday: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  doorsTime: string;
  startTime: string;
  venueName: string;
  venueUrl: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  mapUrl: string;
  price: string;
  ageRestriction: string;
  roomNote: string;
  posterUrl: string;
  posterAlt: string;
  /** The one question the form asks. */
  question: string;
  /** Placeholder inside the decision field. */
  placeholder: string;
  /** Label on the "put my name on it" toggle. */
  namePrompt: string;
  /** Small print under the form. */
  formNote: string;
  submitLabel: string;
  /** Shown after a successful send. */
  thanksText: string;
  /**
   * The form only opens around the show, so whoever sends a decision is in
   * the room to hear it read out. Minutes either side of the start time.
   */
  openMinutesBefore: number;
  closeMinutesAfter: number;
  /** Host override: keep the form open regardless of the clock. */
  alwaysOpen: boolean;
  /** Shown in place of the form outside the window. */
  closedText: string;
  /**
   * A number people can text a decision to instead of using the form. Blank
   * hides the whole option. Inbound texts arrive through /api/decisions/sms.
   */
  smsNumber: string;
  /** The line offering it, with {number} standing in for the number. */
  smsNote: string;
  /** Whether the public page shows how many decisions are in this week. */
  showCount: boolean;
  /** Markdown-lite, same as a blog post body. */
  howItWorks: string;
  /** One line at the bottom of the page. */
  closingLine: string;
  thisWeekHeading: string;
  /** Shown under "this week" when no night is published yet. */
  noLineupText: string;
  /** A one-line strip under the home hero. */
  showOnHome: boolean;
  homeStripText: string;
  homeStripCta: string;
  /** A strip at the top of /shows. */
  showOnShowsPage: boolean;
  seo: Seo;
};

export type SubmissionStatus = "open" | "drawn" | "archived";

/** One decision someone sent in. Stored one file per submission, never inside content.json. */
export type Submission = {
  id: string;
  decision: string;
  /** Empty when the sender chose to stay anonymous. */
  name: string;
  createdAt: string;
  status: SubmissionStatus;
  drawnAt: string;
};

export type ShowsPage = {
  heading: string;
  intro: string;
  /** Heading over the standing weekly block at the top of /shows. */
  weeklyHeading: string;
  upcomingHeading: string;
  pastHeading: string;
  emptyText: string;
  /** Crop orientation applied to every show poster. */
  posterAspect: "9:16" | "4:5" | "1:1" | "3:2" | "16:9";
  columns: number;
  gap: number;
  cornerRadius: number;
  showPastShows: boolean;
  pastLimit: number;
  seo: Seo;
};

export type NewsPage = {
  heading: string;
  intro: string;
  seo: Seo;
};

export type HomePage = {
  hero: Hero;
  reelsTop: ReelGridSettings;
  reelsBottom: ReelGridSettings;
  marqueeHeading: string;
  showMarqueeHeading: boolean;
  seo: Seo;
};

export type SiteSettings = {
  name: string;
  shortName: string;
  tagline: string;
  url: string;
  logoUrl: string;
  faviconUrl: string;
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
  nav: NavItem[];
  socials: SocialLink[];
  instagramHandle: string;
  footerText: string;
  showFooter: boolean;
  /** Organization-level JSON-LD + AI crawler guidance. */
  organizationType: string;
  foundingYear: string;
  seo: Seo;
};

export type Content = {
  version: number;
  updatedAt: string;
  site: SiteSettings;
  home: HomePage;
  news: NewsPage;
  showsPage: ShowsPage;
  shop: ShopPage;
  about: AboutPage;
  contact: ContactPage;
  weekly: WeeklyPage;
  blogSettings: BlogSettings;
  posts: Post[];
  shows: Show[];
  reels: Reel[];
  instagram: InstagramSync;
};
