"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/ErrorReporter";

/**
 * Shown instead of Next's bare "Application error" when a page breaks while
 * drawing: says so plainly, offers a retry, and reports what broke.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, error.digest ? `render ${error.digest}` : "render");
  }, [error]);
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">Something went wrong on this page.</h1>
      <p className="max-w-md text-sm text-neutral-400">It has been reported. Try again, or reload the page.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="min-h-11 rounded-md bg-white px-5 py-2 text-sm font-semibold text-black">Try again</button>
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-md border border-white/30 px-5 py-2 text-sm">Reload</button>
      </div>
    </main>
  );
}
