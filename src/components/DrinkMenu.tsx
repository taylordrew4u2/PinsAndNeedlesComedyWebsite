"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { DRINK_MENU, type DrinkSection } from "@/lib/drink-menu";

/** Designed at TV size and scaled as one piece, so every screen matches. */
const WIDTH = 1920;
const HEIGHT = 1080;
const MUTED = "#BDBDBD";
const RULE = "#6E6E6E";
const FONT = "var(--font-poster), 'Barlow Condensed', 'Arial Narrow', sans-serif";

/**
 * The between-sets screen: the venue's drink menu on black, with the Bad
 * Decisions QR in the left panel when `qrSrc` is given.
 */
export default function DrinkMenu({ qrSrc }: { qrSrc?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = frame.current;
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / WIDTH, box.clientHeight / HEIGHT));
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div
        aria-label="Drink menu"
        style={{
          width: WIDTH, height: HEIGHT, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "center",
          boxSizing: "border-box", padding: 28, background: "#000", color: "#fff", fontFamily: FONT,
        }}
      >
        <div style={{ width: "100%", height: "100%", boxSizing: "border-box", border: "1px solid #fff", outline: `1px solid ${RULE}`, outlineOffset: -9, display: "flex" }}>
          <div style={{ width: 380, flexShrink: 0, boxSizing: "border-box", borderRight: "1px solid #fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "64px 40px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/pixelated-records-logo.png" alt="Pixelated Records" width={310} height={158} style={{ width: 310, height: "auto", display: "block" }} />
            <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: "0.5em", marginRight: "-0.5em" }}>MENU</div>
            {qrSrc ? (
              <>
                <div style={{ width: 64, height: 1, background: RULE, margin: "20px 0 16px" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="Scan to submit your bad decision" width={220} height={220} style={{ width: 220, height: 220, display: "block", background: "#fff", padding: 14, borderRadius: 10, boxSizing: "content-box" }} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.24em", marginRight: "-0.24em", color: MUTED }}>SCAN TO SUBMIT</div>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.06em" }}>YOUR BAD DECISIONS</div>
                    <div style={{ fontSize: 19, fontWeight: 500, color: MUTED, marginTop: 6, whiteSpace: "nowrap" }}>pinsandneedlescomedy.com/bad-decisions</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div style={{ flexGrow: 1, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", columnGap: 56, padding: 64, alignContent: "center", alignItems: "start", overflow: "hidden" }}>
            {DRINK_MENU.map((column, index) => (
              <div key={index} style={{ display: "flex", flexDirection: "column", gap: 34, minWidth: 0 }}>
                {column.map((section) => <Section key={section.title} section={section} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ section }: { section: DrinkSection }) {
  // Sections with one shared price list their drinks as names and details only.
  const shared = Boolean(section.price);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <h2 style={{ margin: "0 0 4px", fontFamily: FONT, fontSize: 30, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #fff", paddingBottom: 10, display: "flex", justifyContent: "space-between" }}>
        <span>{section.title}</span>
        {section.price ? <span>{section.price}</span> : null}
      </h2>
      {section.drinks.map((drink) => (
        <div key={drink.name} style={{ display: "flex", flexDirection: "column", gap: shared ? 4 : 0 }}>
          {shared ? (
            <div style={{ fontSize: 29, fontWeight: 600 }}>{drink.name}</div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 28, fontWeight: 600 }}>
              <span>{drink.name}</span>
              <span style={{ flexGrow: 1, minWidth: 24, borderBottom: `2px dotted ${RULE}`, transform: "translateY(-7px)" }} />
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{drink.price}</span>
            </div>
          )}
          {drink.detail ? <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, color: MUTED }}>{drink.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}
