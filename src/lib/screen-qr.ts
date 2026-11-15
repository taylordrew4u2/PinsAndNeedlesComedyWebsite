/**
 * The QR codes the host can put on the screens, or a picture of their own in
 * a code's place: where one leads, how big each place draws it, and the
 * checks that keep a host's link or picture safe to draw. No imports, so the
 * live screen, the Control Center, the server and the tests all share it.
 */

/**
 * The three places a QR is drawn, each in its own units: the live screen's
 * corner (CSS pixels, from a tablet up), a drink menu's left panel (board
 * pixels, on the 1920×1080 board) and the Intro explainer (vmin).
 */
export type QrPlace = "corner" | "menu" | "explainer";

/**
 * Where a QR leads. "" is each record's own default: on the show screens
 * (screen.json) the Bad Decisions question form, as it always was; on the
 * daytime custom menu (menu.json) no QR at all.
 */
export type QrKind = "" | "link" | "picture";

export const QR_KINDS: readonly QrKind[] = ["", "link", "picture"];

export function isQrKind(raw: unknown): raw is QrKind {
  return QR_KINDS.some((kind) => kind === raw);
}

/** A QR's size is a percentage of its usual size: from half to twice it, in steps of 10. */
export const QR_SIZE_MIN = 50;
export const QR_SIZE_MAX = 200;
export const QR_SIZE_STEP = 10;
export const DEFAULT_QR_SIZE = 100;

export function isQrSize(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= QR_SIZE_MIN && raw <= QR_SIZE_MAX && raw % QR_SIZE_STEP === 0;
}

/**
 * Each place's usual side (100%) in its own units, and the largest share it
 * draws. The corner and the menus take the whole range (the questions' band
 * and the menu's left panel grow to make room); the Intro stops at 140%,
 * where the steps beside the code would run out of room.
 */
export const QR_BASE: Record<QrPlace, { normal: number; maxPercent: number }> = {
  corner: { normal: 160, maxPercent: QR_SIZE_MAX },
  menu: { normal: 220, maxPercent: QR_SIZE_MAX },
  explainer: { normal: 40, maxPercent: 140 },
};

/** The percentage a place really draws for a saved size: anything unknown is 100%, and each place stops at its own largest. */
export function qrPercent(place: QrPlace, percent: unknown): number {
  return Math.min(isQrSize(percent) ? percent : DEFAULT_QR_SIZE, QR_BASE[place].maxPercent);
}

/** The QR's side in that place's units, at the saved size: 160 px in the corner, 220 board px on a menu and 40 vmin in the Intro at 100%. */
export function qrSide(place: QrPlace, percent: unknown): number {
  return Math.round((QR_BASE[place].normal * qrPercent(place, percent)) / 100);
}

/** Longest link a code is made from: past this a code gets too dense to scan across a dark bar. */
export const QR_LINK_MAX = 200;
/** Past this the Control Center warns that the code will be dense, and suggests a short link. */
export const QR_LINK_LONG = 60;
/** Long enough for any upload address the stores hand out, short enough that the poll stays small. */
export const ASSET_URL_MAX = 500;
/** A host's picture is shrunk to this on its long side before upload: sharp on a TV, a few hundred KB. */
export const QR_IMAGE_MAX_PX = 1080;

/**
 * A link the host wants a code for, as the code will hold it (the browser's
 * own spelling of it), or "" when it can't be used. Only a secure web address
 * with a real host name (one with a dot in it): never another scheme, a name
 * and password, spaces, backslashes, or anything longer than QR_LINK_MAX.
 */
export function cleanQrLink(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || value.length > QR_LINK_MAX || /[\s\\]/.test(value)) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.username || url.password || !/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return "";
  return url.href.length <= QR_LINK_MAX ? url.href : "";
}

/**
 * What the host typed with "https://" put in front when it has no scheme of
 * its own, so "instagram.com/bar" works as typed. "localhost:3000" counts as
 * having none (that colon starts a port). Never turns "http://" into
 * "https://": the host is told to use the secure address instead.
 */
export function withHttps(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

/** A link as a person reads it under a code: no "https://", no "www.", no slash at the end, cut short with "…" past `max`. */
export function linkLabel(url: string, max = 48): string {
  const label = url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  return label.length > max ? `${label.slice(0, Math.max(1, max - 1))}…` : label;
}

/** A link long enough to make a dense code. */
export function longLink(url: string): boolean {
  return url.trim().length > QR_LINK_LONG;
}

/**
 * Where a file the screen fetches lives (the host's own sound or picture), or
 * "" for anything else. Only an address on this site (an upload, /uploads/…
 * or /api/media/…) or a secure web address: never another scheme, a
 * protocol-relative "//" address, or anything with spaces or backslashes.
 */
export function cleanAssetUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || value.length > ASSET_URL_MAX || /[\s\\]/.test(value)) return "";
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

/** A picture's size shrunk to fit `max` on its long side: whole pixels, the same shape, never made bigger, never below 1. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const w = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1;
  const h = Number.isFinite(height) ? Math.max(1, Math.round(height)) : 1;
  const limit = Math.max(1, Math.floor(max));
  if (w <= limit && h <= limit) return { width: w, height: h };
  const scale = limit / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** The live screen's own code: the Bad Decisions question form with no parameters, or a host's link with its signature. */
export const DECISIONS_QR_SRC = "/api/decisions/live/qr";

/**
 * Whether an image address is one of the live screen's own codes: the plain
 * question form, or the same route with a query (a signed host link). Nothing
 * that could lead off the site: no spaces, backslashes or "//" anywhere.
 */
export function isLiveQrSrc(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 1200) return false;
  if (raw === DECISIONS_QR_SRC) return true;
  return raw.startsWith(`${DECISIONS_QR_SRC}?`) && !/[\s\\]/.test(raw) && !raw.includes("//");
}

/** The signed-in preview of a code for a link the host has typed, saved or not. */
export function adminQrPreviewSrc(link: string): string {
  return `/api/admin/run-show/qr?to=${encodeURIComponent(link)}`;
}

/**
 * The QR as a screen draws it: the question form, the host's link (as a code
 * the site makes) or the host's picture, and its size as a percentage.
 */
export type ShownQr = { kind: "form" | "link" | "picture"; src: string; size: number };

/** The question form's code at its usual size: what the show screens draw when nothing else is chosen or usable. */
export const FORM_QR: ShownQr = { kind: "form", src: DECISIONS_QR_SRC, size: DEFAULT_QR_SIZE };

/**
 * A QR as the live screen receives it, checked: a code must be one of the
 * live screen's own (never an address from elsewhere), a picture an address
 * cleanAssetUrl accepts. Null for anything else; an odd size reads as 100%.
 */
export function readShownQr(raw: unknown): ShownQr | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const size = isQrSize(value.size) ? value.size : DEFAULT_QR_SIZE;
  if ((value.kind === "form" || value.kind === "link") && isLiveQrSrc(value.src)) return { kind: value.kind, src: value.src, size };
  if (value.kind === "picture" && typeof value.src === "string" && value.src && cleanAssetUrl(value.src) === value.src) return { kind: "picture", src: value.src, size };
  return null;
}

/**
 * A QR ready to draw in one place: its address, whether it is the host's
 * picture (drawn without the code's white frame), its side in that place's
 * units, and words for a screen reader.
 */
export type BoardQr = { src: string; picture: boolean; side: number; alt: string };

export function boardQr(qr: ShownQr | null, place: QrPlace): BoardQr | null {
  if (!qr) return null;
  const alt = qr.kind === "form" ? "Scan to submit your bad decision" : qr.kind === "link" ? "Scan me" : "";
  return { src: qr.src, picture: qr.kind === "picture", side: qrSide(place, qr.size), alt };
}

/**
 * What stops a QR choice from saving, in plain words, or "" when it can be
 * saved. `to` and `image` are what would be saved: the Control Center puts
 * "https://" in front of a bare address before asking.
 */
export function qrChoiceProblem(choice: { kind: QrKind; to: string; image: string }): string {
  if (choice.kind === "link") {
    const to = choice.to.trim();
    if (!to) return "Type the web address the code should open.";
    if (cleanQrLink(to)) return "";
    if (/^http:\/\//i.test(to)) return "Use the https:// address: plain http:// links can't go in a code.";
    if (to.length > QR_LINK_MAX) return `That address is too long for a code (${QR_LINK_MAX} characters at most). Use a short link.`;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(to)) return "Start the address with https://";
    return "That doesn't look like a web address a phone can open. It needs to start with https://";
  }
  if (choice.kind === "picture") {
    const image = choice.image.trim();
    if (!image) return "Upload a picture, or paste its https:// address.";
    if (!cleanAssetUrl(image)) return "That picture's address can't be used. Upload the picture here, or paste an https:// address.";
  }
  return "";
}
