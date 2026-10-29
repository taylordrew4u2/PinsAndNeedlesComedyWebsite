"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RotationTiming } from "@/lib/drink-menu";
import { FULL_PAGE, holdMs, keepPage, nextPage, rearmMs, type MenuPage } from "@/lib/menu-rotation";

/**
 * Turns the custom menu's pages on this screen's own clock: one timer at a
 * time, no polling, nothing asked of the server. Shared by the live screen
 * and the Control Center's preview, which each turn their own copy.
 *
 * While `run` is on (and there is more than the full board, and a timing):
 * each page stays up for its hold, then the next, back to the full board
 * after the last. New pages (an edit to the drinks) keep the same page up,
 * still on its first timer, or go back to the full board when that page is
 * gone. A new timing counts from when the page went up, so a shorter one
 * takes effect at once. Stopped, it shows the page pinned with `pin` (the
 * preview's page chips), or the full board, and the next run starts from the
 * full board.
 */
export function useMenuRotation(pages: readonly MenuPage[], timing: RotationTiming | null, run: boolean): {
  page: MenuPage;
  index: number;
  pin: (key: string | null) => void;
} {
  const fullMs = timing?.fullMs ?? 0;
  const sectionMs = timing?.sectionMs ?? 0;
  const running = run && timing !== null && pages.length > 1;
  // The page the turning is on, by key, and the page pinned while stopped.
  const [turnedTo, setTurnedTo] = useState(FULL_PAGE.key);
  const [pinned, setPinned] = useState<string | null>(null);
  // Stopping puts the turning back to the full board, for the next time it runs (adjusted while rendering, as React suggests, so no stale page flashes up).
  const [wasRunning, setWasRunning] = useState(running);
  if (wasRunning !== running) {
    setWasRunning(running);
    if (!running) setTurnedTo(FULL_PAGE.key);
  }
  const index = keepPage(running ? turnedTo : pinned, pages);
  const page = pages[index] ?? FULL_PAGE;
  // When the page up now went up: kept across re-renders and new timings, started again for a new page.
  const started = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!running) {
      started.current = null;
      return;
    }
    const now = Date.now();
    if (started.current?.key !== page.key) started.current = { key: page.key, at: now };
    const wait = rearmMs(started.current.at, now, holdMs(page, { fullMs, sectionMs }));
    const timer = setTimeout(() => setTurnedTo(pages[nextPage(index, pages)].key), wait);
    return () => clearTimeout(timer);
  }, [running, page, index, pages, fullMs, sectionMs]);

  const pin = useCallback((key: string | null) => {
    setPinned(key);
    // Running, a chip jumps the turning to that page, which then gets its whole hold.
    started.current = null;
    setTurnedTo(key ?? FULL_PAGE.key);
  }, []);

  return { page, index, pin };
}
