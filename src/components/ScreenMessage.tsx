"use client";

import { useLayoutEffect, useRef } from "react";

/** The largest the words get, as a share of the box's width and of its height: a short message fills the screen. */
const MAX_OF_WIDTH = 0.16;
const MAX_OF_HEIGHT = 0.42;
const MIN_SIZE = 12;

/**
 * The host's message, big and centred in the colour they picked, sized to
 * the largest that fits its box the way questions are: a two-word "Last
 * call!" fills the screen, a longer line steps down until it fits. The same
 * component draws the Control Center's preview, in a smaller box.
 */
export default function ScreenMessage({ text, color }: { text: string; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const area = box.current;
    const line = words.current;
    if (!area || !line) return;
    const fits = (size: number) => {
      line.style.fontSize = `${size}px`;
      return line.scrollHeight <= area.clientHeight && line.scrollWidth <= area.clientWidth;
    };
    const fit = () => {
      // Measured without breaking inside words, so a long one ("@pinsandneedles") shrinks to fit its line instead of splitting.
      line.style.overflowWrap = "normal";
      // The biggest size that fits, found by halving the gap rather than a pixel at a time.
      let low = MIN_SIZE;
      let high = Math.max(MIN_SIZE, Math.floor(Math.min(area.clientWidth * MAX_OF_WIDTH, area.clientHeight * MAX_OF_HEIGHT)));
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle)) low = middle;
        else high = middle - 1;
      }
      // Only a word too long for the box even at the smallest size may break.
      if (!fits(low)) line.style.overflowWrap = "";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [text]);

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center overflow-hidden">
      <p ref={words} className="w-full whitespace-pre-wrap break-words text-center font-[family-name:var(--pnc-heading)] leading-tight" style={{ color }}>
        {text}
      </p>
    </div>
  );
}
