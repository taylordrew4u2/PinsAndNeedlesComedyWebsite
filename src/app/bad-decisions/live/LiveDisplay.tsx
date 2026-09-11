"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function LiveDisplay({ showQr }: { showQr: boolean }) {
  const [question, setQuestion] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLHeadingElement>(null);

  // Fit a full audience submission into the projector area without covering the QR.
  useLayoutEffect(() => {
    const box = area.current;
    const heading = text.current;
    if (!box || !heading) return;
    const fit = () => {
      let size = Math.min(88, Math.max(28, window.innerWidth * 0.05));
      heading.style.fontSize = `${size}px`;
      while (size > 14 && (heading.scrollHeight > box.clientHeight || heading.scrollWidth > box.clientWidth)) {
        size -= 1;
        heading.style.fontSize = `${size}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [question]);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/decisions/live", { cache: "no-store", signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (!disposed) setQuestion(typeof data?.question === "string" ? data.question : null);
      } catch {
        if (!disposed) setQuestion(null);
      } finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2_000);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, []);

  return (
    <main className="flex h-svh items-center justify-center bg-black px-6 pb-40 pt-10 text-white sm:px-12 sm:pb-56" aria-label="Live show" aria-live="polite" aria-atomic="true">
      <div ref={area} className="flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
        {question ? <h1 ref={text} className="w-full whitespace-pre-wrap break-words text-center leading-tight">{question}</h1> : null}
      </div>
      {showQr ? (
        <div className="fixed bottom-3 right-3 bg-white p-3 sm:bottom-4 sm:right-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/decisions/live/qr" alt="Scan to submit your question" width={160} height={160} className="h-24 w-24 sm:h-40 sm:w-40" />
        </div>
      ) : null}
    </main>
  );
}
