/**
 * Resolve saved references to the shipped assets. Brand marks remain vector;
 * news covers use their original photographs rather than flattened SVG traces.
 * Uploaded and external assets are preserved.
 */

/** The brand marks, which did not all keep their old names. */
const BRAND: Record<string, string> = {
  "/brand/logo-black.png": "/brand/logo-black.svg",
  "/brand/logo-white.png": "/brand/logo-white.svg",
  "/brand/logo-on-white.png": "/brand/logo-on-white.svg",
  "/brand/icon.png": "/brand/icon.svg",
  // The 32px favicon had no usable trace; the 512px icon stands in for it.
  "/brand/favicon-32.png": "/brand/favicon.svg",
  "/brand/bad-decisions-flyer.png": "/brand/bad-decisions-flyer.svg",
};

/** Only the known traced covers have restored originals. */
const ORIGINAL_COVERS: Record<string, string> = {
  "/posts/1-2-2025.svg": "/posts/1-2-2025.webp",
  "/posts/about-us-pins-needles-comedy.svg": "/posts/about-us-pins-needles-comedy.webp",
  "/posts/jul7-30th-recap-ink-laughs-and-brooklyns-wildest-night-at-pi.svg": "/posts/jul7-30th-recap-ink-laughs-and-brooklyns-wildest-night-at-pi.webp",
  "/posts/l-train-productions-brings-comic-books-shirts-and-stickers-t.svg": "/posts/l-train-productions-brings-comic-books-shirts-and-stickers-t.webp",
  "/posts/mark-vegas-featured-artist-pins-and-needles-comedy-march-26.svg": "/posts/mark-vegas-featured-artist-pins-and-needles-comedy-march-26.webp",
  "/posts/may-28th-deven-pagliaro-brings-abstract-and-character-painti.svg": "/posts/may-28th-deven-pagliaro-brings-abstract-and-character-painti.webp",
  "/posts/mr-stitch-makes-his-pins-needles-debut-july-30-at-secret-pou.svg": "/posts/mr-stitch-makes-his-pins-needles-debut-july-30-at-secret-pou.webp",
  "/posts/pins-amp-needles-comedy-a-new-york-city-stand-up-show-where.svg": "/posts/pins-amp-needles-comedy-a-new-york-city-stand-up-show-where.webp",
  "/posts/pins-amp-needles-comedy-adds-a-secret-screening-of-two-short.svg": "/posts/pins-amp-needles-comedy-adds-a-secret-screening-of-two-short.webp",
  "/posts/pins-amp-needles-comedy-announces-may-28-lineup-at-secret-po.svg": "/posts/pins-amp-needles-comedy-announces-may-28-lineup-at-secret-po.webp",
  "/posts/pins-amp-needles-comedy-brings-tattooed-stand-up-to-the-edin.svg": "/posts/pins-amp-needles-comedy-brings-tattooed-stand-up-to-the-edin.webp",
  "/posts/pins-amp-needles-comedy-holiday-show-nyc-stand-up-live-tatto.svg": "/posts/pins-amp-needles-comedy-holiday-show-nyc-stand-up-live-tatto.webp",
  "/posts/pins-amp-needles-comedy-nyc-live-stand-up-amp-tattoo-culture.svg": "/posts/pins-amp-needles-comedy-nyc-live-stand-up-amp-tattoo-culture.webp",
  "/posts/pins-amp-needles-comedy-returns-july-30-with-flash-tattoos-a.svg": "/posts/pins-amp-needles-comedy-returns-july-30-with-flash-tattoos-a.webp",
  "/posts/pins-and-needles-comedy-secret-pour-may-28-recap.svg": "/posts/pins-and-needles-comedy-secret-pour-may-28-recap.webp",
  "/posts/pins-and-needles-edinburgh-fringe-2026.svg": "/posts/pins-and-needles-edinburgh-fringe-2026.webp",
  "/posts/pins-needles-comedy-audition-open-mic-june-25th-at-9-pm.svg": "/posts/pins-needles-comedy-audition-open-mic-june-25th-at-9-pm.webp",
  "/posts/pins-needles-comedy-in-bushwick-on-march-26-featured-mark-ve.svg": "/posts/pins-needles-comedy-in-bushwick-on-march-26-featured-mark-ve.webp",
  "/posts/pins-needles-comedy-is-looking-for-scotland-comedians-for-ed.svg": "/posts/pins-needles-comedy-is-looking-for-scotland-comedians-for-ed.webp",
  "/posts/pins-needles-comedy-recap-tattoo-comedy-night-at-secret-pour.svg": "/posts/pins-needles-comedy-recap-tattoo-comedy-night-at-secret-pour.webp",
  "/posts/pins-needles-comedy-returns-to-secret-pour-on-may-28-with-st.svg": "/posts/pins-needles-comedy-returns-to-secret-pour-on-may-28-with-st.webp",
  "/posts/pins-needles-comedy-x-taylor-drew-roast-recap-feb-26.svg": "/posts/pins-needles-comedy-x-taylor-drew-roast-recap-feb-26.webp",
  "/posts/pins-needles-comedy-x-the-roast-of-taylor-drew-february-26-a.svg": "/posts/pins-needles-comedy-x-the-roast-of-taylor-drew-february-26-a.webp",
  "/posts/rob-white-brings-comedy-custom-portraits-and-fresh-ink.svg": "/posts/rob-white-brings-comedy-custom-portraits-and-fresh-ink.webp",
  "/posts/rob-white-dropped-the-flash-sheet-for-pins-needles-comedy-ta.svg": "/posts/rob-white-dropped-the-flash-sheet-for-pins-needles-comedy-ta.webp",
  "/posts/rob-white-featured-artist-at-pins-needles-comedy-tattoo-arti.svg": "/posts/rob-white-featured-artist-at-pins-needles-comedy-tattoo-arti.webp",
  "/posts/rob-white-turned-the-pins-needles-comedy-lineup-into-tattoo.svg": "/posts/rob-white-turned-the-pins-needles-comedy-lineup-into-tattoo.webp",
  "/posts/submissions-are-now-open-for-pins-amp-needles-at-edinburgh-f.svg": "/posts/submissions-are-now-open-for-pins-amp-needles-at-edinburgh-f.webp",
  "/posts/tonight-in-brooklyn-pins-needles-takes-over-secret-pour-and.svg": "/posts/tonight-in-brooklyn-pins-needles-takes-over-secret-pour-and.webp"
};

/** Repair known legacy paths without changing uploaded or external images. */
export function restoredAssetPath(value: string): string {
  return BRAND[value] || ORIGINAL_COVERS[value] || value;
}

/**
 * Every string in a content tree, resolved to its current shipped asset. Objects and
 * arrays are rebuilt; anything that is not a string is passed through
 * untouched, so numbers, booleans and nulls survive as themselves.
 */
export function healAssetPaths<T>(value: T): T {
  if (typeof value === "string") return restoredAssetPath(value) as unknown as T;
  if (Array.isArray(value)) return value.map(healAssetPaths) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = healAssetPaths(inner);
    }
    return out as T;
  }
  return value;
}

/**
 * The image a social crawler should be handed.
 *
 * Facebook, X, Slack and iMessage all decline to render an SVG preview, and
 * every mark this site ships is now an SVG — so a card pointing at one shows
 * nothing at all. When the chosen image is a vector, the crawler is sent to
 * /api/og instead, which draws a PNG at request time. A raster image set by
 * hand in the admin still wins, because somebody chose it on purpose.
 *
 * The card is asked for by path, not by title — the route looks up the words
 * itself, so the URL cannot be used to put arbitrary text on the brand.
 */
export function socialImage(base: string, chosen: string, path?: string): string {
  if (chosen && !/\.svg(\?|#|$)/i.test(chosen)) return chosen;
  const card = `${base.replace(/\/+$/, "")}/api/og`;
  const page = (path || "").trim();
  return page && page !== "/" ? `${card}?path=${encodeURIComponent(page)}` : card;
}

/**
 * The headline half of a page title.
 *
 * SEO titles carry a keyword tail after a separator — "Pins & Needles Comedy
 * | NYC Tattoo Comedy Show & Underground Stand-Up" — which is right for a
 * search result and wrong for a card, where it fills three lines and reads
 * like a billboard. The card takes what comes before the first separator.
 */
export function cardTitle(title?: string): string {
  return (title || "").split(/\s+[|·—–]\s+/)[0].trim();
}
