"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWakeLock } from "@/lib/use-wake-lock";
import { fetchWithin } from "@/lib/fetch-within";
import { modeQuery, type Space } from "@/lib/space";
import DrinkMenu from "@/components/DrinkMenu";
import type { CustomLook } from "@/lib/drink-menu";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, isMenuFont, isScriptFont } from "@/lib/menu-fonts";
import BadDecisionIntro, { INTRO_MS } from "@/components/BadDecisionIntro";
import { playIntroSound } from "@/lib/intro-sound";
import Explainer from "@/components/Explainer";
import { EXPLAINER_STEPS, type ExplainerStep } from "@/lib/explainer";

/** How long the mouse can sit still before the pointer is hidden. */
const POINTER_IDLE_MS = 2_500;
/**
 * A poll still unanswered after this is given up, so one stalled request can
 * never stop the screen updating.
 */
const POLL_TIMEOUT_MS = 8_000;
/** After a tap there is no pointer to hide, so the controls stay long enough to reach. */
const TOUCH_IDLE_MS = 5_000;
/** A silent 3, 2, 1 before a newly picked question, so the room sees it coming. */
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 1_000;

export default function LiveDisplay({ showQr, space = "live" }: { showQr: boolean; space?: Space }) {
  const [question, setQuestion] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  // The control center can put the drink menu up over everything, between sets.
  const [menu, setMenu] = useState(false);
  // Bumped whenever the screen switches (menu on/off, screen cleared, the Intro starting or ending): plays the wipe.
  const [wipe, setWipe] = useState(0);
  // Which menu was up at the last poll ("off", "standard" or "custom"), so a switch between them wipes too.
  const menuSeen = useRef<string | undefined>(undefined);
  const [marquee, setMarquee] = useState<string | null>(null);
  // The custom menu's colour and line above the QR; null for the standard menu.
  const [menuCustom, setMenuCustom] = useState<CustomLook | null>(null);
  // A newly picked question gets a drum roll first; the screen opening on one does not.
  const [intro, setIntro] = useState(false);
  const shown = useRef<string | null | undefined>(undefined);
  const introTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The number up during the countdown before a new question; null when none is running.
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The timed segment's end, on this screen's own clock; null when none is running.
  const [segmentEnd, setSegmentEnd] = useState<number | null>(null);
  // The performer whose set is starting: their name holds the screen for its first two minutes.
  const [performer, setPerformer] = useState<string | null>(null);
  const performerSeen = useRef<string | null | undefined>(undefined);
  const [segmentLeft, setSegmentLeft] = useState(0);
  // Browsers only allow sound after someone taps or clicks the page once; until then the button below asks for it.
  const audio = useRef<AudioContext | null>(null);
  // The host's "Intro" explainer: which step is up, and the start time last acted on (undefined until the first poll).
  const [explainer, setExplainer] = useState<ExplainerStep | null>(null);
  const explainerSeen = useRef<string | null | undefined>(undefined);
  const explainerTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  // The Control Center's mirror is this page in a frame: it stays silent so the host's laptop does not echo the room.
  const [mirrored, setMirrored] = useState(true);
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
  }, [question, name, menu, intro]);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    /** Plays the sting if sound is on. A context the browser paused is asked to resume first; if it cannot, the beat passes silently. */
    const sting = () => {
      const context = audio.current;
      if (!context) return;
      if (context.state === "running") playIntroSound(context);
      else context.resume().then(() => { if (context.state === "running") playIntroSound(context); }, () => {});
    };
    /** Steps through the explainer on timers, playing the sting with its intro step. */
    const runExplainer = () => {
      explainerTimers.current.forEach(clearTimeout);
      explainerTimers.current = [];
      setWipe((count) => count + 1);
      let delay = 0;
      for (const { step, ms } of EXPLAINER_STEPS) {
        explainerTimers.current.push(setTimeout(() => {
          setExplainer(step);
          if (step === "intro") sting();
        }, delay));
        delay += ms;
      }
      explainerTimers.current.push(setTimeout(() => {
        setExplainer(null);
        setWipe((count) => count + 1);
      }, delay));
    };
    // A poll lined up for the moment the next segment slot goes up, so it lands on time rather than up to a poll late.
    let switchTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const { response, text } = await fetchWithin(`/api/decisions/live${modeQuery(space)}`, { cache: "no-store" }, POLL_TIMEOUT_MS, controller.signal);
        // Only a real answer changes the screen. A failed poll — venue wifi
        // dropping a request, the server briefly busy — keeps what is up, so
        // the question doesn't blink off mid-bit; the next poll catches up.
        if (!response.ok) return;
        const data = JSON.parse(text);
        if (disposed) return;
        const next = typeof data?.question === "string" ? data.question : null;
        const previous = shown.current;
        shown.current = next;
        if (next !== previous) {
          // A changed screen ends any countdown or intro; a newly picked question (not the one up when the screen opened) starts one.
          clearTimeout(introTimer.current);
          countdownTimers.current.forEach(clearTimeout);
          countdownTimers.current = [];
          setIntro(false);
          const fresh = previous !== undefined && next !== null;
          setCountdown(fresh ? COUNTDOWN_FROM : null);
          if (fresh) {
            // Silent 3, 2, 1; the sting and the drum roll come in on the beat after "1".
            for (let n = COUNTDOWN_FROM - 1; n >= 1; n -= 1) {
              countdownTimers.current.push(setTimeout(() => setCountdown(n), (COUNTDOWN_FROM - n) * COUNTDOWN_STEP_MS));
            }
            countdownTimers.current.push(setTimeout(() => {
              setCountdown(null);
              sting();
              const play = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              setIntro(play);
              if (play) introTimer.current = setTimeout(() => setIntro(false), INTRO_MS);
            }, COUNTDOWN_FROM * COUNTDOWN_STEP_MS));
          }
          // A cleared screen wipes; a new question has its own countdown and intro.
          if (previous && next === null) setWipe((count) => count + 1);
        }
        setQuestion(next);
        setName(next && typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null);
        const nextPerformer = typeof data?.performer === "string" && data.performer.trim() ? data.performer.trim() : null;
        // A name going up or coming down wipes, like any other screen change.
        if (performerSeen.current !== undefined && nextPerformer !== performerSeen.current && !(performerSeen.current && next)) setWipe((count) => count + 1);
        performerSeen.current = nextPerformer;
        setPerformer(nextPerformer);
        const nextMenu = data?.menu === true;
        const look = data?.menuCustom;
        const custom: CustomLook | null = nextMenu && look && typeof look.color === "string" && typeof look.headline === "string"
          ? {
            color: look.color, headline: look.headline,
            note: typeof look.note === "string" ? look.note : "",
            noteColor: typeof look.noteColor === "string" ? look.noteColor : look.color,
            font: isMenuFont(look.font) ? look.font : DEFAULT_MENU_FONT,
            bartender: typeof look.bartender === "string" ? look.bartender : "",
            bartenderFont: isScriptFont(look.bartenderFont) ? look.bartenderFont : DEFAULT_SCRIPT_FONT,
            bartenderColor: typeof look.bartenderColor === "string" ? look.bartenderColor : look.color,
          }
          : null;
        const which = nextMenu ? (custom ? "custom" : "standard") : "off";
        if (menuSeen.current !== undefined && which !== menuSeen.current) setWipe((count) => count + 1);
        menuSeen.current = which;
        // Keep the same object while nothing changed, so the board does not re-render every poll.
        setMenuCustom((current) => current && custom && JSON.stringify(current) === JSON.stringify(custom) ? current : custom);
        setMenu(nextMenu);
        setMarquee(typeof data?.marquee === "string" && data.marquee ? data.marquee : null);
        const segment = data?.segment && typeof data.segment.remainingMs === "number" ? data.segment as { remainingMs: number; nextSwitchMs: number } : null;
        setSegmentEnd(segment ? Date.now() + segment.remainingMs : null);
        clearTimeout(switchTimer);
        if (segment && segment.nextSwitchMs < 2_500) {
          // If a regular poll is still out at that moment, try again just after it.
          const onTime = () => { if (pending) switchTimer = setTimeout(onTime, 100); else void refresh(); };
          switchTimer = setTimeout(onTime, segment.nextSwitchMs + 150);
        }
        const explainerAt = typeof data?.explainer === "string" ? data.explainer : null;
        if (explainerAt !== explainerSeen.current) {
          // One that was already running when this screen opened is not replayed.
          const opening = explainerSeen.current === undefined;
          explainerSeen.current = explainerAt;
          if (explainerAt && !opening) runExplainer();
        }
      } catch {
        // Offline, timed out or aborted: leave the screen as it is.
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
      clearTimeout(introTimer.current);
      clearTimeout(switchTimer);
      countdownTimers.current.forEach(clearTimeout);
      explainerTimers.current.forEach(clearTimeout);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [space]);

  // The segment clock ticks on its own between polls.
  useEffect(() => {
    if (segmentEnd === null) return;
    const tick = () => setSegmentLeft(Math.max(0, segmentEnd - Date.now()));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [segmentEnd]);

  // Sound starts by itself where the browser allows autoplay for this site; otherwise the first tap, click or key press turns it on.
  useEffect(() => {
    const framed = window.self !== window.top;
    // Known only in the browser; the server renders as the mirror (silent, no button).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMirrored(framed);
    if (framed) return;
    const unlock = () => {
      const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      if (!audio.current) {
        const context = new Context();
        // Safari and iPads pause audio when the screen locks or the tab is hidden: the button comes back to say so.
        // Only the current context reports: a replaced or closed one must not flip the button back on.
        context.onstatechange = () => { if (audio.current === context) setSoundOn(context.state === "running"); };
        audio.current = context;
      }
      const context = audio.current;
      context.resume().then(
        () => { if (audio.current === context) setSoundOn(context.state === "running"); },
        () => { if (audio.current === context) setSoundOn(false); },
      );
    };
    // Try at once: a browser set to allow autoplay here starts sound with no tap. A blocked one just waits for the first tap.
    unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      const context = audio.current;
      audio.current = null;
      void context?.close();
    };
  }, []);

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

  const qrSrc = `/api/decisions/live/qr${modeQuery(space)}`;

  return (
    <>
    {menu ? (
      <main className={`pnc-screen-in select-none ${pointerIdle ? "cursor-none" : ""}`} aria-label="Live show" onDoubleClick={toggleFullscreen}>
        <DrinkMenu qrSrc={showQr ? qrSrc : undefined} marquee={marquee} custom={menuCustom} />
      </main>
    ) : (
    <main
      className={`pnc-screen-in flex h-svh select-none items-center justify-center bg-black px-6 pb-40 pt-10 text-white sm:px-12 sm:pb-56 ${pointerIdle ? "cursor-none" : ""}`}
      aria-label="Live show"
      aria-live="polite"
      aria-atomic="true"
      onDoubleClick={toggleFullscreen}
    >
      <div ref={area} className="flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
        {question && !intro && countdown === null ? (
          // Sized together, so a long question and its name both fit above the QR.
          <div key={question} ref={text} className="pnc-screen-in w-full text-center">
            <h1 className="whitespace-pre-wrap break-words leading-tight">{question}</h1>
            {name ? <p className="mt-[0.6em] break-words text-[0.55em] font-semibold leading-tight text-white/75">— {name}</p> : null}
          </div>
        ) : !question && performer && !intro && countdown === null ? (
          <div key={performer} className="pnc-screen-in w-full text-center">
            <p className="font-[family-name:var(--pnc-heading)] text-[min(4vw,5vh)] uppercase tracking-[0.3em] text-[#ff2e4d]">Now on stage</p>
            <h1 className="mt-[0.2em] break-words font-[family-name:var(--pnc-heading)] text-[min(11vw,20vh)] leading-none">{performer}</h1>
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
          <img src={qrSrc} alt="Scan to submit your question" width={160} height={160} className="h-24 w-24 sm:h-40 sm:w-40" />
        </div>
      ) : null}
    </main>
    )}
    {countdown !== null && !menu && !explainer ? (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black text-white" aria-hidden="true">
        <span key={countdown} className="pnc-countdown font-[family-name:var(--pnc-heading)] font-bold tabular-nums leading-none">{countdown}</span>
      </div>
    ) : null}
    {intro && !menu && !explainer ? <BadDecisionIntro /> : null}
    {explainer ? <Explainer step={explainer} qrSrc={showQr ? qrSrc : undefined} /> : null}
    {segmentEnd !== null ? (
      <p className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 font-[family-name:var(--pnc-heading)] text-lg tabular-nums text-white/80 sm:bottom-4 sm:text-2xl" aria-hidden="true">
        {segmentClock(segmentLeft)}
      </p>
    ) : null}
    {wipe ? <div key={wipe} className="pnc-wipe" aria-hidden="true" /> : null}
    {/* Outside <main>, so it is not read out with the question. */}
    {!mirrored && !soundOn ? (
      <button
        type="button"
        onDoubleClick={(event) => event.stopPropagation()}
        className={`fixed bottom-16 left-3 z-30 rounded-md border border-[#ff2e4d] bg-black/80 px-4 py-2 text-sm font-semibold text-white sm:bottom-[4.5rem] sm:left-4`}
      >
        Sound is off. Tap to turn it on
      </button>
    ) : null}
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

/** m:ss, rounded up so it reads 12:00 at the start and 0:00 only at the very end. */
function segmentClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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
