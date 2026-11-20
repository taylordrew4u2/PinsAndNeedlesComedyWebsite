"use client";

import { useEffect } from "react";

/** Send one crash report home. A beacon survives the page being closed or reloaded straight after. */
export function reportClientError(error: unknown, source: string): void {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const body = JSON.stringify({ message: err.message || String(error), stack: err.stack ?? "", path: window.location.pathname, source });
    if (navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    // Reporting must never be the thing that breaks the page.
  }
}

/**
 * Listens for errors no code caught, on every page, and reports each distinct
 * one once (at most five a page load), so a crash on a phone shows up in the
 * server's log with its message and stack.
 */
export default function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const send = (error: unknown, source: string) => {
      const key = error instanceof Error ? error.message : String(error);
      if (seen.has(key) || seen.size >= 5) return;
      seen.add(key);
      reportClientError(error, source);
    };
    const onError = (event: ErrorEvent) => send(event.error ?? event.message, "window");
    const onRejection = (event: PromiseRejectionEvent) => send(event.reason, "promise");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
