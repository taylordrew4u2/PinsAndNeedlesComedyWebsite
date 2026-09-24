"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWakeLock } from "@/lib/use-wake-lock";
import { modeQuery, type Space } from "@/lib/space";

/** How long the mouse can sit still before the pointer is hidden. */
const POINTER_IDLE_MS = 2_500;
/** After a tap there is no pointer to hide, so the controls stay long enough to reach. */
const TOUCH_IDLE_MS = 5_000;

export default function LiveDisplay({ showQr, space = "live" }: { showQr: boolean; space?: Space }) {
  const [question, setQuestion] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [pointerIdle, setPointerIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Known only in the browser; the server renders without the button.
  const [canGoFullscreen, setCanGoFullscreen] = useState(false);
  useWakeLock();
  const area = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);

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
  }, [question, name]);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/decisions/live${modeQuery(space)}`, { cache: "no-store", signal: controller.signal });
        // Only a real answer changes the screen. A failed poll — venue wifi
        // dropping a request, the server briefly busy — keeps what is up, so
        // the question doesn't blink off mid-bit; the next poll catches up.
        if (!response.ok) return;
        const data = await response.json();
        if (disposed) return;
        const next = typeof data?.question === "string" ? data.question : null;
        setQuestion(next);
        setName(next && typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null);
      } catch {
        // Offline or aborted: leave the screen as it is.
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
  }, [space]);

  // The pointer vanishes when the mouse is still, so it never sits on the
  // projected screen, and comes back the moment the mouse moves.
  useEffect(() => {
    let timer = setTimeout(() => setPointerIdle(true), POINTER_IDLE_MS);
    // A mouse moving, or a finger tapping (an iPad has no pointer to move),
    // brings the controls back.
    const moved = (event: PointerEvent) => {
      setPointerIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setPointerIdle(true), event.pointerType === "mouse" ? POINTER_IDLE_MS : TOUCH_IDLE_MS);
    };
    window.addEventListener("pointermove", moved);
    window.addEventListener("pointerdown", moved);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", moved);
      window.removeEventListener("pointerdown", moved);
    };
  }, []);

  // Full screen three ways: the button (shown while the mouse moves), the F
  // key, or a double-click anywhere. Safari on iPad only has the webkit-
  // prefixed calls, so both are tried.
  useEffect(() => {
    // Reads the browser's capabilities, which the server cannot know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanGoFullscreen(canFullscreen());
    const sync = () => setFullscreen(Boolean(fullscreenElement()));
    const key = (event: KeyboardEvent) => {
      if ((event.key === "f" || event.key === "F") && !event.metaKey && !event.ctrlKey && !event.altKey) toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <>
    <main
      className={`flex h-svh select-none items-center justify-center bg-black px-6 pb-40 pt-10 text-white sm:px-12 sm:pb-56 ${pointerIdle ? "cursor-none" : ""}`}
      aria-label="Live show"
      aria-live="polite"
      aria-atomic="true"
      onDoubleClick={toggleFullscreen}
    >
      <div ref={area} className="flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
        {question ? (
          // Sized together, so a long question and its name both fit above the QR.
          <div ref={text} className="w-full text-center">
            <h1 className="whitespace-pre-wrap break-words leading-tight">{question}</h1>
            {name ? <p className="mt-[0.6em] break-words text-[0.55em] font-semibold leading-tight text-white/75">— {name}</p> : null}
          </div>
        ) : null}
      </div>
      {space === "rehearsal" ? (
        <p className="fixed left-3 top-3 rounded bg-amber-300 px-3 py-1 text-sm font-bold uppercase tracking-widest text-black sm:left-4 sm:top-4">
          Rehearsal
        </p>
      ) : null}
      {showQr ? (
        <div className="fixed bottom-3 right-3 bg-white p-3 sm:bottom-4 sm:right-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/decisions/live/qr${modeQuery(space)}`} alt="Scan to submit your question" width={160} height={160} className="h-24 w-24 sm:h-40 sm:w-40" />
        </div>
      ) : null}
    </main>
    {/* Outside <main>, so it is not read out with the question. */}
    {canGoFullscreen && !(fullscreen && pointerIdle) ? (
      <button
        type="button"
        onClick={toggleFullscreen}
        onDoubleClick={(event) => event.stopPropagation()}
        className={`fixed bottom-3 left-3 rounded-md border border-white/30 bg-black/70 px-4 py-2 text-sm text-white transition-opacity sm:bottom-4 sm:left-4 ${pointerIdle ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        {fullscreen ? "Exit full screen" : "Full screen (F)"}
      </button>
    ) : null}
    </>
  );
}

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

function fullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null;
}

function canFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement as WebkitElement;
  return Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
}

function toggleFullscreen(): void {
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  try {
    if (fullscreenElement()) {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
    } else if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
    } else {
      root.webkitRequestFullscreen?.();
    }
  } catch {
    // Refused (not triggered by a click or key): nothing to do.
  }
}
