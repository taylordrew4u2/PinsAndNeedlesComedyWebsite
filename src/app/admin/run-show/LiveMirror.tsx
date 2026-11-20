"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The projector's own size. The mirror renders at this size and scales down, so it matches the real screen. */
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

const SMALL = "(max-width: 1023px)";
function subscribeSmall(change: () => void): () => void {
  const query = window.matchMedia(SMALL);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
/** A phone or small tablet; null while drawing on the server, where there is no screen to ask. */
const isSmall = (): boolean | null => window.matchMedia(SMALL).matches;

/**
 * A live copy of what the projector is showing.
 *
 * The real live page is loaded in a frame at projector size and shrunk to
 * fit, so the layout, the QR corner and the text fitting are exactly what
 * the room sees, not a phone-sized version of it. It polls the same public
 * endpoint the projector does (half as often, to spare GitHub reads), so it
 * changes within a few seconds of the projector.
 */
export default function LiveMirror({ version }: { version: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  // On a phone or small tablet the mirror waits for a tap: it is the whole projector page, at projector size,
  // running inside this one, and that is a lot to ask of a phone alongside the Control Center.
  const small = useSyncExternalStore(subscribeSmall, isSmall, () => null);
  const [tapped, setTapped] = useState(false);
  const show: boolean | null = small === null ? null : tapped || !small;

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
      {show === false ? (
        <button type="button" onClick={() => setTapped(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-neutral-300">
          <span className="rounded-md border border-white/30 px-4 py-2 font-semibold text-white">Show live preview</span>
          <span className="text-xs text-neutral-500">Off by default on phones, to keep this page light.</span>
        </button>
      ) : null}
      {show ? <iframe
        key={version}
        src="/bad-decisions/live"
        title="Live screen mirror"
        aria-hidden="true"
        tabIndex={-1}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left", opacity: scale ? 1 : 0 }}
        className="pointer-events-none absolute left-0 top-0 border-0"
      /> : null}
    </div>
  );
}
