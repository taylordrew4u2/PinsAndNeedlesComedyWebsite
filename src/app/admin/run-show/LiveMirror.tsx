"use client";

import { useEffect, useRef, useState } from "react";

/** The projector's own size. The mirror renders at this size and scales down, so it matches the real screen. */
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

/**
 * A live copy of what the projector is showing.
 *
 * The real live page is loaded in a frame at projector size and shrunk to
 * fit, so the layout, the QR corner and the text fitting are exactly what
 * the room sees, not a phone-sized version of it. It polls the same public
 * endpoint the projector does, so it changes when the projector does.
 */
export default function LiveMirror({ version }: { version: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    // ResizeObserver reports once on observe, which sets the first scale.
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SCREEN_WIDTH));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/20 bg-black">
      <iframe
        key={version}
        src="/bad-decisions/live"
        title="Live screen mirror"
        aria-hidden="true"
        tabIndex={-1}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left", opacity: scale ? 1 : 0 }}
        className="pointer-events-none absolute left-0 top-0 border-0"
      />
    </div>
  );
}
