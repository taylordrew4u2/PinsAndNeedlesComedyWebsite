"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_MARQUEE_SPEED, DRINK_MENU, MENU_WORDING, SAME_PRICE_JOIN, linesOfBoxes, wrapsMore, type BartenderLook, type BoardWords, type CustomLook, type Drink, type DrinkSection } from "@/lib/drink-menu";
import { menuFontScale, scriptFontScale } from "@/lib/menu-fonts";
import type { MenuPage } from "@/lib/menu-rotation";
import { boardQr, type BoardQr } from "@/lib/screen-qr";
import { PRINTED_WORDS } from "@/lib/screen-settings";
import { MENU_FONT_FAMILY, SCRIPT_FONT_FAMILY } from "./menu-font-faces";

/** Designed at TV size and scaled as one piece, so every screen matches. */
const WIDTH = 1920;
const HEIGHT = 1080;
/** Keep the whole menu, including its marquee, clear of the screen edges. */
const SCREEN_PADDING = 48;
const BOARD_BG = "#000";
const MUTED = "#BDBDBD";
const RULE = "#6E6E6E";
/** The dots from a drink to its price: 2px as always, a little heavier with the big type of a section page. */
const LEADER = `max(2px, 0.06em) dotted ${RULE}`;
const FONT = "var(--font-poster), 'Barlow Condensed', 'Arial Narrow', sans-serif";

/** With a marquee, the menu shrinks to leave this much black band around it for the text. */
const BAND = 64;
/** The menu's frame sits inside the board's 28px padding; with a marquee it scales to clear the band. */
const FRAME_SCALE = (HEIGHT - 2 * BAND) / (HEIGHT - 2 * 28);
/** The brand red, for the marquee's separators. */
const ACCENT = "#FF2E4D";
const SEPARATOR = "\u2003\u2726\u2003";
/**
 * A list longer than the printed one sets the drinks' type (and the custom
 * menu's bartender and note under them) smaller until it fits, in these steps,
 * but never below this share of its size: past that it is too small to read
 * across a bar, and the Control Center says it is too long.
 */
const FIT_FLOOR = 0.45;
const FIT_STEP = 0.02;
/**
 * A board with room to spare sets its drinks bigger instead, in the same
 * steps, up to this share of their size: as big as fits without anything
 * spilling or a name breaking onto a second line it didn't need before.
 */
const FIT_CEILING = 1.2;
/**
 * Finds the text that should keep its lines as the drinks grow: drink names,
 * section headings and the bartender's name. A line of several drinks at one
 * price counts too: its names are marked together, so the line wrapping onto
 * a second line stops the growth like a long name would.
 */
const KEEP_LINES = "[data-keep-lines]";
/**
 * A section page's type, as a share of the full board's: a few drinks to a
 * page, so they can be read from across the room. The fit then shrinks or
 * grows it like any board.
 */
const PAGE_TYPE = 2;
/** A section page's drinks run no wider than this, centred, so the dots to each price stay short enough to follow. */
const PAGE_WIDTH = 1180;
/** A line the host wrote under the QR code: kept to the panel, broken anywhere rather than run past it, and set close when it wraps. */
const HOST_LINE = { overflowWrap: "anywhere", maxWidth: 300, lineHeight: 1.15 } as const;
/** A QR or picture that wouldn't load is tried again after this, then after twice as long each time, up to a minute. */
const IMAGE_FIRST_RETRY_MS = 5_000;
const IMAGE_RETRY_MS = 60_000;

/**
 * The between-sets screen: the venue's drink menu on black, with the show
 * screens' QR (`qr`: the Bad Decisions code, the host's link or their
 * picture, at its side in board pixels) in the left panel when there is one,
 * `words` around it (the printed wording when left out), and `marquee` text
 * running around the edge when there is one.
 *
 * `custom` makes it the custom (daytime) menu: the same board, its text in
 * the host's colour and font, its own heading and its own QR (never the show
 * screens', and none unless the host picked one), with their line above it
 * and words under it only when there is one, and, in the space under the
 * first two columns, tonight's bartender in a glowing script and their note,
 * each in a colour of its own. Nothing on it says Pins & Needles or Bad
 * Decisions unless the host wrote it. `contained` fills the nearest
 * positioned box instead of the whole window, for a preview.
 *
 * `drinks` is the host's list as it shows (the printed menu when left out),
 * with any drinks of one price already on one line (see compactSection):
 * those names are kept whole, wrapping only between them. A longer list sets
 * the drinks smaller until it fits; one with room to spare sets them bigger,
 * up to FIT_CEILING. `onFit` hears the size (1 is as designed), whether the
 * drinks fit even at the smallest, and whether the left panel does. The
 * marquee crawls at `marqueeSpeed` (board pixels per second) in
 * `marqueeColor`, the text colour when empty.
 *
 * `page` is one page of the custom menu's turning (see menu-rotation.ts):
 * left out or the full page, the whole board; a section page shows just its
 * sections in big type, fading in, with the bartender and note moved to the
 * left panel so they never leave the screen. A QR or picture that won't load
 * is left off, with its wording, rather than drawn broken.
 */
export default function DrinkMenu({ qr, words = PRINTED_WORDS, marquee, custom, bartender: standardBartender, contained, drinks = DRINK_MENU, marqueeSpeed = DEFAULT_MARQUEE_SPEED, marqueeColor, page, onFit }: {
  qr?: BoardQr | null;
  /** Tonight's bartender on the standard menu; the custom menu takes its own from `custom`. */
  bartender?: BartenderLook | null;
  words?: BoardWords;
  marquee?: string | null;
  custom?: CustomLook | null;
  contained?: boolean;
  drinks?: DrinkSection[][];
  marqueeSpeed?: number;
  marqueeColor?: string;
  page?: MenuPage | null;
  onFit?: (fit: { size: number; fits: boolean; panelFits: boolean }) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // A section page shows just its sections, one column of them, in big type.
  const sectionPage = Boolean(page?.sections.length);
  const columns = page && sectionPage ? [page.sections.map((entry) => entry.section)] : drinks;
  const note = custom?.note.trim() || "";
  // Tonight's bartender on either menu: the custom menu's own, or the one handed to the standard menu.
  const tonight: BartenderLook | null = custom
    ? (custom.bartender.trim() ? { name: custom.bartender.trim(), font: custom.bartenderFont, color: custom.bartenderColor, label: custom.bartenderLabel ?? MENU_WORDING.bartenderLabel.fallback } : null)
    : standardBartender ?? null;
  const bartender = tonight?.name ?? "";
  // On the full board they sit under the first two columns, and the last column runs down beside them; on a section page they move to the left panel.
  const below = !sectionPage && Boolean(note || bartender);
  const aside = sectionPage && Boolean(note || bartender);
  const family = custom ? MENU_FONT_FAMILY[custom.font] : FONT;
  // Wider fonts set smaller, so every drink still fits its column; the standard menu is untouched.
  const k = custom ? menuFontScale(custom.font) : 1;
  const z = (size: number) => (k === 1 ? size : Math.round(size * k * 10) / 10);
  // A size times the fit: 1, the size as given, until a list is too long (smaller) or leaves room to spare (bigger).
  const fitted = (px: number) => `calc(${px}px * var(--fit, 1))`;
  // The drinks' type: the font's size, bigger on a section page, then fitted.
  const big = sectionPage ? PAGE_TYPE : 1;
  const d = (size: number) => fitted(Math.round(z(size) * big * 10) / 10);
  // The custom menu has its own QR (or none); the standard one has the show screens'. One that won't load is left off.
  const chosen = custom ? boardQr(custom.qr, "menu") : qr ?? null;
  const broken = useBrokenImage(chosen?.src ?? null);
  const code = broken ? null : chosen;
  // A left panel wide enough for the QR: its usual 380, or the QR, its white edge and the panel's padding.
  const panelWidth = code ? Math.max(380, code.side + 28 + 80) : 380;
  // The words beside it: the custom menu's own, or the show-night menu's (the printed wording unless the host changed it).
  const heading = custom ? custom.heading : words.heading;
  const caption = custom ? custom.qrCaption : words.caption;
  const title = custom ? custom.qrTitle : words.title;
  const link = custom ? custom.qrLink : words.link;
  // The QR keeps its chosen size; the logo, wording and gaps make room around it.
  const p = (size: number) => `calc(${size}px * var(--panel-fit, 1))`;
  const bartenderLabel = tonight?.label ?? MENU_WORDING.bartenderLabel.fallback;
  const report = useRef(onFit);
  useEffect(() => { report.current = onFit; }, [onFit]);
  // Everything that changes how much room the drinks take; the fit is worked out again when it does.
  const layout = JSON.stringify([page?.key, columns, family, k, note, bartender, tonight?.font, bartenderLabel, panelWidth, code?.src, code?.side, custom?.headline, heading, caption, title, link]);

  useLayoutEffect(() => {
    const box = frame.current;
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / (WIDTH + 2 * SCREEN_PADDING), box.clientHeight / (HEIGHT + 2 * SCREEN_PADDING)));
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    return () => observer.disconnect();
  }, []);

  // Fit: from full size down in small steps until nothing would be cut off, or, with room to spare, up until the next step would cut something off; then tell whoever asked.
  useLayoutEffect(() => {
    const box = grid.current;
    const qrPanel = panel.current;
    if (!box || !qrPanel) return;
    let active = true;
    let last = "";
    // Under reduced motion the site gives every change a 0.01ms transition, so a new size
    // would only land a frame later: each step finishes them, to measure what it set.
    // A browser too old to list them skips this rather than fail (there, a long list may stay full size).
    const settle = typeof box.getAnimations === "function" && typeof CSSTransition === "function";
    const apply = (size: number, target = box, property = "--fit") => {
      target.style.setProperty(property, String(size));
      if (!settle) return;
      for (const animation of target.getAnimations({ subtree: true })) {
        if (animation instanceof CSSTransition) animation.finish();
      }
    };
    const fit = () => {
      if (!active) return;
      let size = 1;
      apply(size);
      if (overflows(box)) {
        while (size > FIT_FLOOR && overflows(box)) {
          size = Math.max(FIT_FLOOR, Math.round((size - FIT_STEP) * 100) / 100);
          apply(size);
        }
      } else {
        // Room to spare: grow into it, but stop before anything spills or a name, a same-price line, a heading or the bartender breaks onto another line.
        const lines = keptLines(box);
        while (size < FIT_CEILING) {
          const next = Math.min(FIT_CEILING, Math.round((size + FIT_STEP) * 100) / 100);
          apply(next);
          if (overflows(box) || wrapsMore(lines, keptLines(box))) {
            apply(size);
            break;
          }
          size = next;
        }
      }
      let panelSize = 1;
      apply(panelSize, qrPanel, "--panel-fit");
      while (panelSize > FIT_FLOOR && overflows(qrPanel)) {
        panelSize = Math.max(FIT_FLOOR, Math.round((panelSize - FIT_STEP) * 100) / 100);
        apply(panelSize, qrPanel, "--panel-fit");
      }
      const result = { size, fits: !overflows(box), panelFits: !overflows(qrPanel) };
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

  return (
    <div ref={frame} className={`${contained ? "absolute" : "fixed"} inset-0 flex items-center justify-center overflow-hidden bg-black`}>
      <div
        aria-label="Drink menu"
        style={{
          width: WIDTH, height: HEIGHT, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "center",
          boxSizing: "border-box", padding: 28, background: BOARD_BG, color: custom?.color ?? "#fff", fontFamily: family, position: "relative",
        }}
      >
        {marquee ? <Marquee text={marquee} color={marqueeColor || (custom?.color ?? "#fff")} speed={marqueeSpeed} family={family} fontSize={z(28)} /> : null}
        <div style={{
          width: "100%", height: "100%", boxSizing: "border-box", border: "1px solid #fff", outline: `1px solid ${RULE}`, outlineOffset: -9, display: "flex",
          transform: marquee ? `scale(${FRAME_SCALE})` : undefined, transformOrigin: "center",
        }}>
          <div ref={panel} style={{ width: panelWidth, flexShrink: 0, boxSizing: "border-box", borderRight: "1px solid #fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: p(24), padding: "80px 40px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pixelated-records-logo.png" alt="Pixelated Records" width={310} height={158} style={{ width: p(310), maxWidth: "100%", height: "auto", display: "block", flexShrink: 0 }} />
            <div style={{ fontSize: p(z(34)), fontWeight: 500, letterSpacing: "0.5em", marginRight: "-0.5em", textTransform: "uppercase", overflowWrap: "anywhere" }}>{heading}</div>
            {code ? <div style={{ width: 64, height: 1, background: RULE, margin: `${p(20)} 0 ${p(16)}`, flexShrink: 0 }} /> : null}
            {/* The custom line belongs to the QR ("scan here"): no QR, no line. */}
            {custom?.headline && code ? (
              <div style={{ fontSize: p(z(34)), fontWeight: 700, lineHeight: 1.12, letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "center", overflowWrap: "anywhere", maxWidth: 300 }}>
                {custom.headline}
              </div>
            ) : null}
            {code ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: p(18), flexShrink: 0 }}>
                {code.picture ? (
                  // The host's own picture: no white frame, fitted into the square a code would take.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={code.src} alt={code.alt} width={220} height={220} decoding="async" style={{ width: code.side + 28, height: code.side + 28, flexShrink: 0, display: "block", objectFit: "contain" }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={code.src} alt={code.alt} width={220} height={220} style={{ width: code.side, height: code.side, flexShrink: 0, display: "block", background: "#fff", padding: 14, borderRadius: 10, boxSizing: "content-box" }} />
                )}
                {/* The printed wording is set exactly as it always was; the host's own is kept to the panel, the two lines above in capitals. An empty line is left off. */}
                {caption || title || link ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
                    {caption ? <div style={{ fontSize: p(z(20)), fontWeight: 600, letterSpacing: "0.24em", marginRight: "-0.24em", color: MUTED, ...(caption === PRINTED_WORDS.caption ? {} : { ...HOST_LINE, textTransform: "uppercase" }) }}>{caption}</div> : null}
                    {title ? <div style={{ fontSize: p(z(30)), fontWeight: 700, letterSpacing: "0.06em", ...(title === PRINTED_WORDS.title ? {} : { ...HOST_LINE, textTransform: "uppercase" }) }}>{title}</div> : null}
                    {link ? <div style={{ fontSize: p(z(19)), fontWeight: 500, color: MUTED, marginTop: p(6), ...(link === PRINTED_WORDS.link ? { whiteSpace: "nowrap" } : HOST_LINE) }}>{link}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {aside ? (
              // A section page: tonight's bartender and the note stay up here, under the heading and the QR, until the full board comes back.
              <div className="pnc-page-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: p(14), textAlign: "center", width: "100%", minWidth: 0, flexShrink: 0, marginTop: p(code ? 4 : 16) }}>
                {bartender ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "100%" }}>
                    <div style={{ fontSize: p(z(16)), fontWeight: 600, letterSpacing: "0.24em", marginRight: "-0.24em", color: MUTED, textTransform: "uppercase", lineHeight: 1.2, marginBottom: p(8), overflowWrap: "anywhere" }}>{bartenderLabel}</div>
                    <div style={{
                      fontFamily: SCRIPT_FONT_FAMILY[tonight!.font], fontWeight: 400,
                      fontSize: p(Math.round((bartender.length <= 10 ? 60 : bartender.length <= 16 ? 50 : bartender.length <= 26 ? 40 : 32) * scriptFontScale(tonight!.font))),
                      lineHeight: 1.2, color: tonight!.color, padding: "0 8px", overflowWrap: "anywhere", maxWidth: "100%",
                      textShadow: `0 0 12px ${tonight!.color}aa, 0 0 30px ${tonight!.color}66`,
                    }}>
                      {bartender}
                    </div>
                  </div>
                ) : null}
                {note ? (
                  <div style={{ color: custom?.noteColor, fontSize: p(z(note.length <= 40 ? 28 : 24)), fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.03em", textTransform: "uppercase", overflowWrap: "anywhere", maxWidth: "100%" }}>
                    {note}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* A new page fades in (opacity only, so nothing moves while it is measured; still under reduced motion). */}
          <div ref={grid} key={page?.key ?? "full"} className={page ? "pnc-page-in" : undefined} style={{ flexGrow: 1, display: "grid", gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, columnGap: 56, padding: 80, alignContent: "center", alignItems: "start", overflow: "hidden" }}>
            {columns.map((column, index) => (
              // With a bartender or note, the last (longest) column runs down both rows and they sit under the others.
              <div key={index} style={{
                display: "flex", flexDirection: "column", gap: d(34), minWidth: 0,
                ...(below ? { gridColumn: index + 1, gridRow: index === columns.length - 1 ? "1 / span 2" : 1 } : {}),
                ...(sectionPage ? { width: "100%", maxWidth: PAGE_WIDTH, justifySelf: "center" } : {}),
              }}>
                {column.map((section) => <Section key={section.id ?? section.title} section={section} d={d} />)}
              </div>
            ))}
            {below ? (
              <div style={{ gridColumn: `1 / span ${columns.length - 1}`, gridRow: 2, marginTop: fitted(bartender ? 32 : 40), display: "flex", flexDirection: "column", alignItems: "center", gap: fitted(16), textAlign: "center", minWidth: 0 }}>
                {bartender ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "100%" }}>
                    <div style={{ fontSize: d(18), fontWeight: 600, letterSpacing: "0.32em", marginRight: "-0.32em", color: MUTED, textTransform: "uppercase", marginBottom: fitted(6), ...(bartenderLabel === MENU_WORDING.bartenderLabel.fallback ? {} : { overflowWrap: "anywhere" }) }}>{bartenderLabel}</div>
                    <div style={{
                      fontFamily: SCRIPT_FONT_FAMILY[tonight!.font], fontWeight: 400,
                      // Big for one name; smaller for two, so it stays on one line.
                      fontSize: fitted(Math.round((bartender.length <= 10 ? 80 : bartender.length <= 16 ? 72 : bartender.length <= 26 ? 60 : 46) * scriptFontScale(tonight!.font))),
                      lineHeight: 1.2, color: tonight!.color, padding: "0 16px", overflowWrap: "anywhere",
                      textShadow: `0 0 14px ${tonight!.color}aa, 0 0 38px ${tonight!.color}66`,
                    }}>
                      <span data-keep-lines="">{bartender}</span>
                    </div>
                  </div>
                ) : null}
                {note ? (
                  <div style={{
                    color: custom?.noteColor, fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.03em", textTransform: "uppercase", overflowWrap: "anywhere", maxWidth: "100%",
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

/** One section of drinks, its type sized by `d`. */
function Section({ section, d }: { section: DrinkSection; d: (size: number) => string }) {
  // Sections with one shared price list their drinks as names and details only.
  const shared = Boolean(section.price) || section.shared === true;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: d(13) }}>
      <h2 style={{ margin: "0 0 4px", fontFamily: "inherit", fontSize: d(30), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #fff", paddingBottom: 10, display: "flex", justifyContent: "space-between", gap: "0.5em" }}>
        <span><span data-keep-lines="">{section.title}</span></span>
        {section.price ? <span>{section.price}</span> : null}
      </h2>
      {section.drinks.map((drink) => (
        <div key={drink.id ?? drink.name} style={{ display: "flex", flexDirection: "column", gap: shared ? 4 : 0 }}>
          {shared ? (
            <div style={{ fontSize: d(29), fontWeight: 600 }}><DrinkName drink={drink} /></div>
          ) : drink.names && drink.names.length > 1 && drink.price ? (
            <JoinedLine names={drink.names} price={drink.price} size={d(28)} />
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.43em", fontSize: d(28), fontWeight: 600 }}>
              <span><DrinkName drink={drink} /></span>
              {/* A drink the host left without a price has no dots running to nothing. */}
              {drink.price ? (
                <>
                  <span style={{ flexGrow: 1, minWidth: "0.86em", borderBottom: LEADER, transform: "translateY(-0.25em)" }} />
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{drink.price}</span>
                </>
              ) : null}
            </div>
          )}
          {drink.detail ? <div style={{ fontSize: d(22), fontWeight: 500, lineHeight: 1.3, color: MUTED, overflowWrap: "anywhere" }}>{drink.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** One name of a line of several, as an unbreakable piece: only a name too long for the whole line breaks inside. */
const NAME_PIECE = { display: "inline-block", maxWidth: "100%" } as const;

/**
 * A drink's name. A line standing for several drinks keeps each name whole:
 * each is its own unbreakable piece, carrying the dot after it, so the line
 * wraps only between names ("Gimlet ·" then "Mojito"), never in the middle of
 * one.
 */
function DrinkName({ drink }: { drink: Drink }) {
  const names = drink.names && drink.names.length > 1 ? drink.names : null;
  if (!names) return <span data-keep-lines="">{drink.name}</span>;
  const dot = SAME_PRICE_JOIN.trim();
  // One mark around all the names, so growing can't wrap them onto another line unnoticed (see keptLines).
  return (
    <span data-keep-lines="">
      {names.map((name, index) => (
        <Fragment key={index}>
          {index ? " " : null}
          <span style={NAME_PIECE}>{index < names.length - 1 ? `${name}\u00a0${dot}` : name}</span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Several drinks at one price, on one line: their names joined, wrapping only
 * between names, and the dots running from the end of the last name to the
 * price beside it, on that last line.
 *
 * Plain text flow, since a flex row would stretch the names to their widest
 * line and leave the dots no room. The last name carries an invisible copy of
 * the price (and room for a few dots), so it moves down a line rather than
 * run under the price. The price floats right after it, onto that last line
 * (its negative margin lets it in however full the line is), and the dots are
 * a zero-width float there running the whole width, hidden behind the names
 * and the price where they cross. The dots are raised with vertical-align, as
 * a transform would paint them over the names.
 */
function JoinedLine({ names, price, size }: { names: string[]; price: string; size: string }) {
  const dot = SAME_PRICE_JOIN.trim();
  const last = names.length - 1;
  const priceType = { fontWeight: 700, fontVariantNumeric: "tabular-nums" } as const;
  return (
    <div style={{ overflow: "hidden", fontSize: size, fontWeight: 600 }}>
      {/* The names, marked as one, so the drinks growing can't push this line onto two, or the last name onto two inside its own box, unnoticed (see keptLines). */}
      <span data-keep-lines="">
        <span style={{ background: BOARD_BG }}>
          {names.slice(0, last).map((name, index) => (
            <Fragment key={index}>
              <span style={NAME_PIECE}>{`${name}\u00a0${dot}`}</span>{" "}
            </Fragment>
          ))}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={{ ...NAME_PIECE, maxWidth: `calc(100% - ${price.length}ch - 1.3em)`, whiteSpace: "normal", background: BOARD_BG, paddingRight: "0.43em" }}>{names[last]}</span>
          <span aria-hidden="true" style={{ ...priceType, visibility: "hidden", paddingLeft: "0.86em" }}>{price}</span>
        </span>
      </span>
      <span style={{ ...priceType, float: "right", marginLeft: "-100%", position: "relative", zIndex: 1, background: BOARD_BG, paddingLeft: "0.43em" }}>{price}</span>
      <span aria-hidden="true" style={{ float: "left", width: 0, whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-block", width: WIDTH, borderBottom: LEADER, verticalAlign: "0.25em" }} />
      </span>
    </div>
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
 * Whether the image at `src` won't load. It is tried off screen as soon as
 * it is chosen, and while it fails, again: soon at first (a server hiccup
 * passes in seconds), then every minute. So a QR or picture that won't load
 * is left off (with its wording) rather than drawn as a broken image, which
 * a browser never tries again by itself, and comes back once it loads.
 * False for no image, and while it is still loading.
 */
export function useBrokenImage(src: string | null): boolean {
  const [broken, setBroken] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let probe: HTMLImageElement | null = null;
    let wait = IMAGE_FIRST_RETRY_MS;
    const check = () => {
      probe = new Image();
      probe.onload = () => setBroken((current) => (current === src ? null : current));
      probe.onerror = () => {
        setBroken(src);
        retry = setTimeout(check, wait);
        wait = Math.min(IMAGE_RETRY_MS, wait * 2);
      };
      probe.src = src;
    };
    check();
    return () => {
      clearTimeout(retry);
      if (probe) {
        probe.onload = null;
        probe.onerror = null;
      }
    };
  }, [src]);
  return src !== null && broken === src;
}

/**
 * How many lines each piece of marked text (drink names, same-price lines,
 * section headings, the bartender) takes, in page order: growing the drinks
 * must not add one to any of them.
 */
function keptLines(grid: HTMLElement): number[] {
  return [...grid.querySelectorAll<HTMLElement>(KEEP_LINES)].map((item) => linesOfBoxes(textBoxes(item)));
}

/**
 * The boxes a mark's words are drawn in, line by line. Taken from the text
 * itself, not the mark: a same-price line's last name is a box of its own
 * (an inline-block), and a name wrapping inside it gives the mark no new box,
 * only the name's text a new line.
 */
function textBoxes(item: HTMLElement): DOMRect[] {
  const boxes: DOMRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    range.selectNodeContents(text);
    boxes.push(...range.getClientRects());
  }
  return boxes;
}

/**
 * Whether a menu area's children reach into its padding or run past their
 * own width. Used for the drinks and the QR panel. Measured on
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
  const style = getComputedStyle(grid);
  const top = box.top + parseFloat(style.paddingTop) * slack;
  const bottom = box.bottom - parseFloat(style.paddingBottom) * slack;
  const left = box.left + parseFloat(style.paddingLeft) * slack;
  const right = box.right - parseFloat(style.paddingRight) * slack;
  return items.some((item) => {
    const edge = item.getBoundingClientRect();
    return edge.top < top - slack || edge.bottom > bottom + slack || edge.left < left - slack || edge.right > right + slack || item.scrollWidth > item.clientWidth + 1;
  });
}
