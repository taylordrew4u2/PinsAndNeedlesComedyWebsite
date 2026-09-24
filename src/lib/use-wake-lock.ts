"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while the page is open: the projector laptop must not
 * dim or sleep mid-set, and the host's phone should not lock between bits.
 *
 * Browsers drop the lock whenever the tab is hidden, so it is taken again each
 * time the page comes back. Where the Screen Wake Lock API is missing (older
 * browsers, plain http), this does nothing and the page still works.
 */
export function useWakeLock(): void {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    }).wakeLock;
    if (!wakeLock) return;
    let lock: { release(): Promise<void> } | null = null;
    let disposed = false;
    const take = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        const next = await wakeLock.request("screen");
        if (disposed) void next.release().catch(() => {});
        else lock = next;
      } catch {
        // Refused (battery saver, no user gesture yet): the screen just
        // follows its usual timeout.
      }
    };
    void take();
    document.addEventListener("visibilitychange", take);
    // Some browsers only grant the lock after the page has been touched.
    window.addEventListener("pointerdown", take, { once: true });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", take);
      window.removeEventListener("pointerdown", take);
      void lock?.release().catch(() => {});
    };
  }, []);
}
