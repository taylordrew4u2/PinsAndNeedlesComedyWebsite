"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_MARQUEE_SPEED, DRINK_MENU, MENU_WORDING, type CustomLook, type DrinkSection } from "@/lib/drink-menu";
import { menuFontScale, scriptFontScale } from "@/lib/menu-fonts";
import { MENU_FONT_FAMILY, SCRIPT_FONT_FAMILY } from "./menu-font-faces";

/** Designed at TV size and scaled as one piece, so every screen matches. */
const WIDTH = 1920;
const HEIGHT = 1080;
const MUTED = "#BDBDBD";
const RULE = "#6E6E6E";
const FONT = "var(--font-poster), 'Barlow Condensed', 'Arial Narrow', sans-serif";

/** With a marquee, the menu shrinks to leave this much black band around it for the text. */
const BAND = 64;
/** The menu's frame sits inside the board's 28px padding; with a marquee it scales to clear the band. */
const FRAME_SCALE = (HEIGHT - 2 * BAND) / (HEIGHT - 2 * 28);
/** The brand red, for the marquee's separators and the SOLD OUT tag. */
const ACCENT = "#FF2E4D";
const SEPARATOR = "\u2003\u2726\u2003";
/**
 * A list longer than the printed one sets the drinks' type (and the custom
 * menu's bartender and note under them) smaller until it fits, in these steps,
 * but never below this share of its size: past that it is too small to read
 * across a bar, and the Control Center says it is too long.
 */
const FIT_FLOOR = 0.6;
const FIT_STEP = 0.02;
/** A line the host wrote under the QR code: kept to the panel, broken anywhere rather than run past it, and set close when it wraps. */
const HOST_LINE = { overflowWrap: "anywhere", maxWidth: 300, lineHeight: 1.15 } as const;

/**
 * The between-sets screen: the venue's drink menu on black, with the Bad
 * Decisions QR in the left panel when `qrSrc` is given, and `marquee` text
 * running around the edge when there is one.
 *
 * `custom` makes it the custom menu: the same board, its text in the host's
 * colour and font, with their line above the QR code (and so only when there
 * is one), and, in the space under the first two columns, tonight's bartender
 * in a glowing script and their note, each in a colour of its own.
 * `contained` fills the nearest positioned box instead of the whole window,
 * for a preview.
 *
 * `drinks` is the host's list as it shows (the printed menu when left out);
 * a longer one sets the drinks smaller until it fits, and `onFit` hears how
 * small and whether it fits even then. The printed menu, and any board that
 * fits as it is, stays exactly at its own size. The marquee crawls at
 * `marqueeSpeed` (board pixels per second) in `marqueeColor`, the text colour
 * when empty.
 *
 * `spook` dresses the frame for spook mode: drips hanging from its top edge
 * and two small webs in its corners, all in the padding around the drinks
 * and the QR, so the menu itself reads exactly as it always does.
 */
export default function DrinkMenu({ qrSrc, marquee, custom, contained, drinks = DRINK_MENU, marqueeSpeed = DEFAULT_MARQUEE_SPEED, marqueeColor, onFit, spook = false }: {
  qrSrc?: string;
  marquee?: string | null;
  custom?: CustomLook | null;
  contained?: boolean;
  drinks?: DrinkSection[][];
  marqueeSpeed?: number;
  marqueeColor?: string;
  onFit?: (fit: { size: number; fits: boolean }) => void;
  spook?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [drips, setDrips] = useState(DRIPS);
  const note = custom?.note.trim() || "";
  const bartender = custom?.bartender.trim() || "";
  // Anything under the first two columns: the last column then runs down beside it.
  const below = Boolean(note || bartender);
  const family = custom ? MENU_FONT_FAMILY[custom.font] : FONT;
  // Wider fonts set smaller, so every drink still fits its column; the standard menu is untouched.
  const k = custom ? menuFontScale(custom.font) : 1;
  const z = (size: number) => (k === 1 ? size : Math.round(size * k * 10) / 10);
  // A size times the shrink-to-fit share: 1, the size as given, until a list is too long.
  const fitted = (px: number) => `calc(${px}px * var(--fit, 1))`;
  // The drinks' type: the font's size, then shrunk to fit.
  const d = (size: number) => fitted(z(size));
  // The custom menu's wording; the standard menu always has the printed wording.
  const caption = custom?.qrCaption ?? MENU_WORDING.qrCaption.fallback;
  const title = custom?.qrTitle ?? MENU_WORDING.qrTitle.fallback;
  const link = custom?.qrLink ?? MENU_WORDING.qrLink.fallback;
  const bartenderLabel = custom?.bartenderLabel ?? MENU_WORDING.bartenderLabel.fallback;
  const report = useRef(onFit);
  useEffect(() => { report.current = onFit; }, [onFit]);
  // Everything that changes how much room the drinks take; the fit is worked out again when it does.
  const layout = JSON.stringify([drinks, family, k, note, bartender, custom?.bartenderFont, bartenderLabel]);
  // The same for the QR panel's lines, which spook mode's drips also keep clear of.
  const panelLayout = JSON.stringify([qrSrc, custom?.headline, caption, title, link]);

  useLayoutEffect(() => {
    const box = frame.current;
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / WIDTH, box.clientHeight / HEIGHT));
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    return () => observer.disconnect();
  }, []);

  // Shrink to fit: from full size down in small steps until nothing would be cut off, then tell whoever asked.
  useLayoutEffect(() => {
    const box = grid.current;
    if (!box) return;
    let active = true;
    let last = "";
    // Under reduced motion the site gives every change a 0.01ms transition, so a new size
    // would only land a frame later: each step finishes them, to measure what it set.
    // A browser too old to list them skips this rather than fail (there, a long list may stay full size).
    const settle = typeof box.getAnimations === "function" && typeof CSSTransition === "function";
    const apply = (size: number) => {
      box.style.setProperty("--fit", String(size));
      if (!settle) return;
      for (const animation of box.getAnimations({ subtree: true })) {
        if (animation instanceof CSSTransition) animation.finish();
      }
    };
    const fit = () => {
      if (!active) return;
      let size = 1;
      apply(size);
      while (size > FIT_FLOOR && overflows(box)) {
        size = Math.max(FIT_FLOOR, Math.round((size - FIT_STEP) * 100) / 100);
        apply(size);
      }
      const result = { size, fits: !overflows(box) };
      if (JSON.stringify(result) !== last) {
        last = JSON.stringify(result);
        report.current?.(result);
      }
    };
    // Measured again as the fonts come in, and when a hidden preview opens (until then it has no size to measure).
    // And again whenever the board's scale changes: the live screen can first lay the board out at no size at all,
    // where nothing seems to overflow, and the grid's own box doesn't change size when it is then scaled up.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [layout, scale]);

  // Spook mode's drips hang only as far as the menu leaves room above its first line: a long
  // list, or a custom menu's bartender and note, starts higher, and the drips shorten to match.
  // After the fit above, and again whenever a line changes size, as the fit or the fonts land.
  useLayoutEffect(() => {
    const left = panel.current;
    const right = grid.current;
    if (!spook || !left || !right) return;
    const measure = () => setDrips(dripLength(headroom([left, right])));
    const observer = new ResizeObserver(measure);
    for (const box of [left, right]) for (const item of box.children) observer.observe(item);
    measure();
    return () => observer.disconnect();
  }, [spook, layout, panelLayout]);

  return (
    <div ref={frame} className={`${contained ? "absolute" : "fixed"} inset-0 flex items-center justify-center overflow-hidden bg-black`}>
      <div
        aria-label="Drink menu"
        style={{
          width: WIDTH, height: HEIGHT, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "center",
          boxSizing: "border-box", padding: 28, background: "#000", color: custom?.color ?? "#fff", fontFamily: family, position: "relative",
        }}
      >
        {marquee ? <Marquee text={marquee} color={marqueeColor || (custom?.color ?? "#fff")} speed={marqueeSpeed} family={family} fontSize={z(28)} /> : null}
        <div style={{
          width: "100%", height: "100%", boxSizing: "border-box", border: "1px solid #fff", outline: `1px solid ${RULE}`, outlineOffset: -9, display: "flex",
          transform: marquee ? `scale(${FRAME_SCALE})` : undefined, transformOrigin: "center",
          // Holds spook mode's trim, so it scales with the frame when a marquee runs.
          position: spook ? "relative" : undefined,
        }}>
          {spook ? <SpookTrim drips={drips} /> : null}
          <div ref={panel} style={{ width: 380, flexShrink: 0, boxSizing: "border-box", borderRight: "1px solid #fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "64px 40px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pixelated-records-logo.png" alt="Pixelated Records" width={310} height={158} style={{ width: 310, height: "auto", display: "block" }} />
            <div style={{ fontSize: z(34), fontWeight: 500, letterSpacing: "0.5em", marginRight: "-0.5em" }}>MENU</div>
            {qrSrc ? <div style={{ width: 64, height: 1, background: RULE, margin: "20px 0 16px" }} /> : null}
            {/* The custom line belongs to the QR ("scan here"): no QR, no line. */}
            {custom && qrSrc ? (
              <div style={{ fontSize: z(34), fontWeight: 700, lineHeight: 1.12, letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "center", overflowWrap: "anywhere", maxWidth: 300 }}>
                {custom.headline}
              </div>
            ) : null}
            {qrSrc ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="Scan to submit your bad decision" width={220} height={220} style={{ width: 220, height: 220, display: "block", background: "#fff", padding: 14, borderRadius: 10, boxSizing: "content-box" }} />
                  {/* The printed wording is set exactly as it always was; the host's own is kept to the panel, the two lines above in capitals. */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
                    <div style={{ fontSize: z(20), fontWeight: 600, letterSpacing: "0.24em", marginRight: "-0.24em", color: MUTED, ...(caption === MENU_WORDING.qrCaption.fallback ? {} : { ...HOST_LINE, textTransform: "uppercase" }) }}>{caption}</div>
                    <div style={{ fontSize: z(30), fontWeight: 700, letterSpacing: "0.06em", ...(title === MENU_WORDING.qrTitle.fallback ? {} : { ...HOST_LINE, textTransform: "uppercase" }) }}>{title}</div>
                    <div style={{ fontSize: z(19), fontWeight: 500, color: MUTED, marginTop: 6, ...(link === MENU_WORDING.qrLink.fallback ? { whiteSpace: "nowrap" } : HOST_LINE) }}>{link}</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div ref={grid} style={{ flexGrow: 1, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 56, padding: 64, alignContent: "center", alignItems: "start", overflow: "hidden" }}>
            {drinks.map((column, index) => (
              // With a bartender or note, the last (longest) column runs down both rows and they sit under the others.
              <div key={index} style={{ display: "flex", flexDirection: "column", gap: d(34), minWidth: 0, ...(below ? { gridColumn: index + 1, gridRow: index === drinks.length - 1 ? "1 / span 2" : 1 } : {}) }}>
                {column.map((section) => <Section key={section.id ?? section.title} section={section} d={d} />)}
              </div>
            ))}
            {custom && below ? (
              <div style={{ gridColumn: `1 / span ${drinks.length - 1}`, gridRow: 2, marginTop: fitted(bartender ? 32 : 40), display: "flex", flexDirection: "column", alignItems: "center", gap: fitted(16), textAlign: "center", minWidth: 0 }}>
                {bartender ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "100%" }}>
                    <div style={{ fontSize: d(18), fontWeight: 600, letterSpacing: "0.32em", marginRight: "-0.32em", color: MUTED, textTransform: "uppercase", ...(bartenderLabel === MENU_WORDING.bartenderLabel.fallback ? {} : { overflowWrap: "anywhere" }) }}>{bartenderLabel}</div>
                    <div style={{
                      fontFamily: SCRIPT_FONT_FAMILY[custom.bartenderFont], fontWeight: 400,
                      // Big for one name; smaller for two, so it stays on one line.
                      fontSize: fitted(Math.round((bartender.length <= 10 ? 80 : bartender.length <= 16 ? 72 : bartender.length <= 26 ? 60 : 46) * scriptFontScale(custom.bartenderFont))),
                      lineHeight: 1.2, color: custom.bartenderColor, padding: "0 16px", overflowWrap: "anywhere",
                      textShadow: `0 0 14px ${custom.bartenderColor}aa, 0 0 38px ${custom.bartenderColor}66`,
                    }}>
                      {bartender}
                    </div>
                  </div>
                ) : null}
                {note ? (
                  <div style={{
                    color: custom.noteColor, fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.03em", textTransform: "uppercase", overflowWrap: "anywhere", maxWidth: "100%",
                    // Sharing the space with the bartender, the note sets a size smaller.
                    fontSize: d(bartender ? (note.length <= 32 ? 40 : note.length <= 70 ? 32 : 28) : (note.length <= 32 ? 48 : note.length <= 70 ? 40 : 34)),
                  }}>
                    {note}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Spook mode's corner webs: small enough to stay inside the padding around the drinks and the QR. */
const WEB = 52;
/** Spook mode's drips at their longest. The longest drip reaches this share of the way down its strip (see spook-drips.svg). */
const DRIPS = 40;
const DRIP_REACH = 74 / 80;
/** The clear space always left between the drips and the menu's first line, and the shortest drips worth hanging: with less room, none hang. */
const DRIP_GAP = 8;
const DRIP_MIN = 12;

/** How long the drips can hang with this much room above the menu's first line (0 for none). */
function dripLength(room: number): number {
  const length = Math.min(DRIPS, Math.floor((room - DRIP_GAP) / DRIP_REACH));
  return length >= DRIP_MIN ? length : 0;
}

/**
 * Spook mode's trim: a strip of drips hanging `drips` pixels from the
 * frame's top edge, a web in its top-right corner and another at the foot
 * of the QR panel, each 10px in. Static, and drawn under everything in the
 * frame, so even if they ever met, every drink and the QR stay on top.
 */
function SpookTrim({ drips }: { drips: number }) {
  const web = { position: "absolute", width: WEB, height: WEB, opacity: 0.45, zIndex: -1, pointerEvents: "none" } as const;
  return (
    <>
      {/* The web is drawn anchored bottom-left: turned half round, it hangs in the top-right corner, the drips running over it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/spook-web-corner-on-dark.svg" alt="" aria-hidden="true" width={WEB} height={WEB} style={{ ...web, top: 10, right: 10, transform: "rotate(180deg)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/spook-web-corner-on-dark.svg" alt="" aria-hidden="true" width={WEB} height={WEB} style={{ ...web, bottom: 10, left: 10 }} />
      {drips ? <div className="pnc-spook-drips" aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: drips, zIndex: -1, pointerEvents: "none" }} /> : null}
    </>
  );
}

/**
 * One section of drinks, its type sized by `d`. A sold-out drink stays where
 * it is, struck through and dimmed with a SOLD OUT tag, so the room can see it
 * is gone rather than wonder where it went.
 */
function Section({ section, d }: { section: DrinkSection; d: (size: number) => string }) {
  // Sections with one shared price list their drinks as names and details only.
  const shared = Boolean(section.price) || section.shared === true;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: d(13) }}>
      <h2 style={{ margin: "0 0 4px", fontFamily: "inherit", fontSize: d(30), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #fff", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
        <span>{section.title}</span>
        {section.price ? <span>{section.price}</span> : null}
      </h2>
      {section.drinks.map((drink) => {
        const gone = drink.soldOut ? SOLD_OUT_TEXT : undefined;
        return (
          <div key={drink.id ?? drink.name} style={{ display: "flex", flexDirection: "column", gap: shared ? 4 : 0 }}>
            {shared ? (
              drink.soldOut ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: d(29), fontWeight: 600 }}>
                  <span style={gone}>{drink.name}</span>
                  <SoldOut d={d} />
                </div>
              ) : <div style={{ fontSize: d(29), fontWeight: 600 }}>{drink.name}</div>
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: d(28), fontWeight: 600 }}>
                <span style={gone}>{drink.name}</span>
                {drink.soldOut ? <SoldOut d={d} /> : null}
                {/* A drink the host left without a price has no dots running to nothing. */}
                {drink.price ? (
                  <>
                    <span style={{ flexGrow: 1, minWidth: 24, borderBottom: `2px dotted ${RULE}`, transform: "translateY(-7px)" }} />
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", ...gone }}>{drink.price}</span>
                  </>
                ) : null}
              </div>
            )}
            {drink.detail ? <div style={{ fontSize: d(22), fontWeight: 500, lineHeight: 1.3, color: MUTED, overflowWrap: "anywhere", ...(drink.soldOut ? { opacity: 0.55 } : {}) }}>{drink.detail}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** A sold-out drink's name and price: struck through and dimmed, still readable. */
const SOLD_OUT_TEXT = { textDecoration: "line-through", textDecorationThickness: 3, opacity: 0.55 } as const;

/** The small red tag beside a sold-out drink. */
function SoldOut({ d }: { d: (size: number) => string }) {
  return (
    <span style={{
      alignSelf: "center", flexShrink: 0, fontSize: d(16), fontWeight: 700, letterSpacing: "0.12em", lineHeight: 1.2,
      padding: "0.2em 0.5em 0.15em", borderRadius: 4, background: ACCENT, color: "#fff", whiteSpace: "nowrap",
    }}>
      SOLD OUT
    </span>
  );
}

/**
 * The marquee: the text, repeated, crawling clockwise along a rounded track
 * in the black band around the menu. The copies are spaced to fill the track
 * exactly, and a second run follows the first one lap behind, so every glyph
 * is drawn once and the loop has no seam. Still under reduced motion. A new
 * `speed` (board pixels per second) carries on from where the text is, so
 * changing it mid-show never jumps the crawl back to the start.
 */
function Marquee({ text, color, speed, family, fontSize }: { text: string; color: string; speed: number; family: string; fontSize: number }) {
  const id = useId();
  const track = useRef<SVGPathElement>(null);
  const probe = useRef<SVGTextElement>(null);
  const runners = useRef<(SVGTextPathElement | null)[]>([]);
  const [size, setSize] = useState({ track: 0, copies: 0 });
  const pace = useRef(speed);
  useEffect(() => { pace.current = speed; }, [speed]);
  const words = text.toUpperCase();
  const inset = BAND / 2;
  const radius = 44;
  const right = WIDTH - inset;
  const bottom = HEIGHT - inset;
  const path = `M ${inset + radius} ${inset} H ${right - radius} A ${radius} ${radius} 0 0 1 ${right} ${inset + radius}`
    + ` V ${bottom - radius} A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom} H ${inset + radius}`
    + ` A ${radius} ${radius} 0 0 1 ${inset} ${bottom - radius} V ${inset + radius} A ${radius} ${radius} 0 0 1 ${inset + radius} ${inset} Z`;

  // Measure once the font is in: how many copies fit the track at their natural width.
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !track.current || !probe.current) return;
      const length = track.current.getTotalLength();
      const chunk = probe.current.getComputedTextLength();
      if (chunk <= 0) return;
      const copies = Math.max(1, Math.round(length / chunk));
      // Same measure, same object: a new one would restart the crawl from the top.
      setSize((current) => (current.track === length && current.copies === copies ? current : { track: length, copies }));
    };
    measure();
    void document.fonts.ready.then(measure);
    // A custom font is fetched only once it is used, after the first measure: measure again when it lands.
    document.fonts.addEventListener("loadingdone", measure);
    return () => { active = false; document.fonts.removeEventListener("loadingdone", measure); };
  }, [words, family, fontSize]);

  useEffect(() => {
    const [lead, follow] = runners.current;
    if (!lead || !follow || !size.copies || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const step = size.track / size.copies;
    let frame = 0;
    // How far the text has crawled, added up a frame at a time at whatever the speed is then.
    let travelled = 0;
    let last = performance.now();
    const tick = (now: number) => {
      travelled = (travelled + (Math.max(0, now - last) / 1000) * pace.current) % step;
      last = now;
      const offset = -travelled;
      lead.setAttribute("startOffset", String(offset));
      follow.setAttribute("startOffset", String(offset + size.track));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  const type = { fontFamily: family, fontSize, fontWeight: 700, letterSpacing: "0.12em", whiteSpace: "pre" } as const;
  const run = (key: string) => Array.from({ length: size.copies }, (_, index) => (
    <tspan key={`${key}-${index}`}>
      {words}<tspan fill={ACCENT}>{SEPARATOR}</tspan>
    </tspan>
  ));

  return (
    <svg aria-label={text} role="img" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <path id={id} ref={track} d={path} fill="none" />
      <text ref={probe} style={{ ...type, visibility: "hidden" }}>{words}{SEPARATOR}</text>
      {size.copies ? (
        <text fill={color} dominantBaseline="central" style={type}>
          {["lead", "follow"].map((key, index) => (
            <textPath
              key={key}
              ref={(node) => { runners.current[index] = node; }}
              href={`#${id}`}
              startOffset={index ? size.track : 0}
              textLength={size.track}
              lengthAdjust="spacing"
            >
              {run(key)}
            </textPath>
          ))}
        </text>
      ) : null}
    </svg>
  );
}

/**
 * Whether the board would cut anything off on the drinks side: the columns
 * (and the bartender and note under them) reaching past the drinks area's
 * edge, padding included, or anything running past its column's side.
 * Content that only reaches into the padding fits, as some custom menus
 * always have, so a menu that fits today keeps today's size. Measured on
 * screen, so it holds however the browser centres what is too tall; the
 * board's own scaling is taken out by comparing within it.
 */
function overflows(grid: HTMLElement): boolean {
  const items = [...grid.children] as HTMLElement[];
  const box = grid.getBoundingClientRect();
  // Not laid out yet, or scaled down to nothing: there is nothing to measure, and the fit runs again once there is.
  if (!items.length || !grid.clientHeight || !box.height) return false;
  // One board pixel on screen, as slack for rounding.
  const slack = box.height / grid.offsetHeight;
  return items.some((item) => {
    const edge = item.getBoundingClientRect();
    return edge.top < box.top - slack || edge.bottom > box.bottom + slack || item.scrollWidth > item.clientWidth + 1;
  });
}

/**
 * How far below the top of these boxes their first line starts, the least of
 * them, in board pixels: the room spook mode's drips have to hang in. Measured
 * on screen like `overflows`, with the board's scaling taken out.
 */
function headroom(boxes: HTMLElement[]): number {
  let room = Infinity;
  for (const box of boxes) {
    const edge = box.getBoundingClientRect();
    if (!edge.height) continue;
    const ratio = box.offsetHeight / edge.height;
    for (const item of box.children) room = Math.min(room, (item.getBoundingClientRect().top - edge.top) * ratio);
  }
  return room;
}
