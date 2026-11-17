"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 30_000;
const EVENT_DEBOUNCE_MS = 5_000;

/** Refresh public server-rendered lineups without sending the feed token to a browser. */
export default function LiveShowLineups() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  useEffect(() => {
    inFlight.current = isPending;
  }, [isPending]);

  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || inFlight.current) return;
      const now = Date.now();
      if (now - lastRefresh < EVENT_DEBOUNCE_MS) return;
      lastRefresh = now;
      inFlight.current = true;
      startTransition(() => router.refresh());
    };

    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router, startTransition]);

  return null;
}
