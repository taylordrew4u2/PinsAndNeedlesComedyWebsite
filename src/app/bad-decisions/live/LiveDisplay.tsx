"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWakeLock } from "@/lib/use-wake-lock";
import { fetchWithin } from "@/lib/fetch-within";
import { isNewerBuild, maySelfReload, quietScreen, screenSignature, soundNeededTap } from "@/lib/build";
import { modeQuery, type Space } from "@/lib/space";
import DrinkMenu from "@/components/DrinkMenu";
import type { CustomLook } from "@/lib/drink-menu";
import { customWording } from "@/lib/drink-menu";
import { parseLiveBoard, type LiveBoard } from "@/lib/drink-list";
import { DEFAULT_MENU_FONT, DEFAULT_SCRIPT_FONT, isMenuFont, isScriptFont } from "@/lib/menu-fonts";
import BadDecisionIntro, { INTRO_MS } from "@/components/BadDecisionIntro";
import { customStingCache, loadCustomSting, pickQuestionSound, playCustomSting } from "@/lib/custom-sting";
import Explainer from "@/components/Explainer";
import { EXPLAINER_MS, EXPLAINER_STEPS, type ExplainerStep } from "@/lib/explainer";
import { DEFAULT_LOOK, screenLook, soundUrl, type ScreenSettings } from "@/lib/screen-settings";
import { DEFAULT_SOUND, soundFile } from "@/lib/question-sounds";
import { readPublicMessage } from "@/lib/screen-message";
import ScreenMessage from "@/components/ScreenMessage";

/** How long the mouse can sit still before the pointer is hidden. */
const POINTER_IDLE_MS = 2_500;
/**
 * A poll still unanswered after this is given up, so one stalled request can
 * never stop the screen updating.
 */
const POLL_TIMEOUT_MS = 8_000;
/** Remembers which update this screen last reloaded itself for, so it never reloads twice for the same one. */
const RELOAD_KEY = "pnc-live-reloaded-for";
/** What was on screen just before a reload of its own, so whatever goes up meanwhile still gets its countdown, sting or Intro. */
const CARRY_KEY = "pnc-live-carry";
/** Set once this screen has told the site it is out of date, so it says so again when it is up to date. */
const REPORTED_KEY = "pnc-live-reported-old";
/** How often an out-of-date screen that cannot reload itself reminds the Control Center. */
const REPORT_EVERY_MS = 5 * 60_000;
/** The page is fetched before a reload, to be sure it answers; that check counts for this long. */
const PAGE_READY_MS = 30_000;
/** After a tap there is no pointer to hide, so the controls stay long enough to reach. */
const TOUCH_IDLE_MS = 5_000;
/** A silent 3, 2, 1 before a newly picked question, so the room sees it coming (the host can change the number or turn it off). */
const COUNTDOWN_STEP_MS = 1_000;
/** A sting still waiting on paused sound after this has missed its beat: it is dropped, never played late. */
const STING_LATE_MS = 1_500;
/** How often the screen asks what is up. The Control Center's mirror is only a glance for the host, so it asks half as often: every poll costs reads against GitHub's limit. */
const POLL_MS = 2_000;
const MIRROR_POLL_MS = 4_000;

export default function LiveDisplay({ showQr, space = "live", build = "" }: { showQr: boolean; space?: Space; build?: string }) {
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
  // The host's drinks and the marquee's speed and colour; the printed menu at the usual pace until the first poll says otherwise.
  const [board, setBoard] = useState<LiveBoard>(() => parseLiveBoard(null));
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
  // Sound that only started after a tap: a reload could lose it (Safari and iPads want a tap on every page), so the screen won't reload itself.
  const soundByTap = useRef(false);
  // Until then, a countdown, intro, explainer or sound test is playing: no reload over it.
  const busyUntil = useRef(0);
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
  // The host's settings from the Control Center (the defaults until a poll says otherwise), whether they muted the sting, and which sound plays how loud.
  const [settings, setSettings] = useState<ScreenSettings>(DEFAULT_LOOK);
  const muted = useRef(false);
  const soundChoice = useRef<{ volume: number; url: string }>({ volume: DEFAULT_LOOK.stingVolume, url: soundUrl(DEFAULT_LOOK) });
  // Starts loading the chosen sound and the default; the screen's audio calls it the moment it exists, before any poll.
  const preloadSounds = useRef(() => {});
  // The host's own message, over the question or set until they take it down; and the last "Test sound" acted on.
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);
  const messageSeen = useRef<boolean | undefined>(undefined);
  const soundTestSeen = useRef<string | null | undefined>(undefined);
  // The message or the drink menu is over the question (as of the last poll), and a new question is waiting under them for its countdown.
  const covered = useRef(false);
  const held = useRef(false);
  // The Intro explainer is playing here, on this screen's own timers: a new question waits under it too.
  const explaining = useRef(false);
  // How the latest poll brings in a held question, so the explainer ending can start it in the same moment it goes.
  const arriveHeld = useRef<(() => void) | null>(null);
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
  }, [question, name, menu, intro, countdown, message]);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    // The chosen sound and the default, fetched and decoded on this screen's audio as soon as a poll names them, so they are ready by the time a question goes up.
    const sounds = customStingCache((url) => {
      const context = audio.current;
      return context ? loadCustomSting(context, url, controller.signal) : Promise.reject(new Error("No audio yet"));
    });
    const defaultSound = soundFile(DEFAULT_SOUND);
    // Only a screen with sound loads them: the Control Center's mirror never plays one.
    const preload = () => {
      if (!audio.current) return;
      sounds.want(soundChoice.current.url);
      sounds.want(defaultSound);
    };
    preloadSounds.current = preload;
    /**
     * Plays the sting if sound is on: the sound the host picked, at their
     * volume. Ready and with sound running, it plays at once. Otherwise it
     * waits, up to STING_LATE_MS: for a context the browser paused to
     * resume, and for a sound still loading (just picked, or the screen
     * only just opened), with the default standing in for one that failed
     * or is slow. Past that the beat passes silently. A browser that wants
     * a tap first holds every resume until then and lets them all go at
     * once, so only a sting asked for just now plays then, and none the host
     * has muted since: no pile of stings in one blast mid-set.
     */
    const sting = () => {
      const context = audio.current;
      if (!context || muted.current) return;
      const { volume, url } = soundChoice.current;
      const play = (sound: AudioBuffer) => {
        const length = playCustomSting(context, sound, { volume: volume / 100 });
        // A long sound keeps the screen from reloading itself over its tail.
        busyUntil.current = Math.max(busyUntil.current, Date.now() + (length + 0.5) * 1_000);
      };
      const ready = sounds.ready(url);
      if (ready && context.state === "running") {
        play(ready);
        return;
      }
      const asked = Date.now();
      void Promise.all([
        pickQuestionSound(sounds, url, defaultSound, STING_LATE_MS),
        context.state === "running" ? null : context.resume().catch(() => {}),
      ]).then(([sound]) => {
        if (sound && context.state === "running" && !muted.current && Date.now() - asked < STING_LATE_MS) play(sound);
      });
    };
    /** Steps through the explainer on timers, playing the sting with its intro step. */
    const runExplainer = () => {
      explainerTimers.current.forEach(clearTimeout);
      explainerTimers.current = [];
      explaining.current = true;
      busyUntil.current = Date.now() + EXPLAINER_MS + 1_000;
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
        explaining.current = false;
        setExplainer(null);
        setWipe((count) => count + 1);
        // A question picked while it played comes in now, in this same update, so it never shows bare first.
        if (held.current && !covered.current) arriveHeld.current?.();
      }, delay));
    };
    // A poll lined up for the moment the next segment slot goes up, so it lands on time rather than up to a poll late.
    let switchTimer: ReturnType<typeof setTimeout> | undefined;
    // Out of date: since when the screen has been quiet and unchanged, and when the page last answered a check.
    let quiet: { signature: string; since: number } | null = null;
    let pageReadyAt = 0;
    let lastPageCheck = 0;
    let lastReport = 0;
    let noStorage = false;
    // Set once it has called reload(): the old page keeps polling until the new one arrives, but says and writes nothing more about its build.
    let reloading = false;
    // Just reloaded itself: pick up what was on screen before, so anything that went up during the reload is still new.
    try {
      const carried = JSON.parse(sessionStorage.getItem(CARRY_KEY) || "null");
      sessionStorage.removeItem(CARRY_KEY);
      if (carried && Date.now() - carried.at < 60_000) {
        shown.current = carried.question ?? null;
        performerSeen.current = carried.performer ?? null;
        explainerSeen.current = carried.explainer ?? null;
        messageSeen.current = Boolean(carried.message);
        soundTestSeen.current = carried.soundTest ?? null;
        menuSeen.current = typeof carried.menu === "string" ? carried.menu : undefined;
        held.current = carried.held === true;
      }
    } catch { /* storage blocked or garbled: start fresh */ }
    // The Control Center's mirror is not the TV: it never reports, and leaves the TV's note alone.
    const framed = window.self !== window.top;
    /** Tell the site which build this screen runs, for the Control Center. */
    const report = (running: string) => {
      void fetch(`/api/decisions/live${modeQuery(space)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ build: running }),
      }).catch(() => {});
    };
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
        // The host's settings, missing from an older server's answer: then the defaults, the screen as it always was.
        const setup = screenLook(data?.screen);
        muted.current = !setup.sound;
        soundChoice.current = { volume: setup.stingVolume, url: soundUrl(setup) };
        preload();
        setSettings((current) => JSON.stringify(current) === JSON.stringify(setup) ? current : setup);
        const countFrom = setup.countdown ? setup.countdownFrom : 0;
        const nextMenu = data?.menu === true;
        const nextMessage = readPublicMessage(data?.message);
        covered.current = nextMenu || nextMessage !== null;
        // The Intro first, so a question picked in the same moment waits under it rather than playing its sting beneath it.
        const explainerAt = typeof data?.explainer === "string" ? data.explainer : null;
        if (explainerAt !== explainerSeen.current) {
          // One that was already running when this screen opened is not replayed.
          const opening = explainerSeen.current === undefined;
          explainerSeen.current = explainerAt;
          if (explainerAt && !opening) runExplainer();
        }
        const next = typeof data?.question === "string" ? data.question : null;
        // Which question it is, not its words: the host fixing a typo on screen is the same question, with no second countdown or sting.
        const nextKey = next === null ? null : typeof data?.questionKey === "string" && data.questionKey ? data.questionKey : next;
        const previous = shown.current;
        shown.current = nextKey;
        /** The countdown, then the sting and the drum roll: a new question arriving where the room can see it. */
        const arrive = () => {
          held.current = false;
          busyUntil.current = Date.now() + countFrom * COUNTDOWN_STEP_MS + INTRO_MS + 1_000;
          setCountdown(countFrom || null);
          // Silent 3, 2, 1; the sting and the drum roll come in on the beat after "1".
          for (let n = countFrom - 1; n >= 1; n -= 1) {
            countdownTimers.current.push(setTimeout(() => setCountdown(n), (countFrom - n) * COUNTDOWN_STEP_MS));
          }
          const reveal = () => {
            setCountdown(null);
            // The host put a message or the menu up, or started the Intro, during the countdown: no sting under it; it all starts again when they come down.
            if (covered.current || explaining.current) { held.current = true; return; }
            sting();
            const play = setup.intro && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            setIntro(play);
            if (play) introTimer.current = setTimeout(() => setIntro(false), INTRO_MS);
          };
          // With the countdown off, straight in, in this same update, so the question never flashes up before its intro.
          if (countFrom) countdownTimers.current.push(setTimeout(reveal, countFrom * COUNTDOWN_STEP_MS));
          else reveal();
        };
        arriveHeld.current = next !== null ? arrive : null;
        if (nextKey !== previous) {
          // A changed screen ends any countdown or intro; a newly picked question (not the one up when the screen opened) starts one.
          clearTimeout(introTimer.current);
          countdownTimers.current.forEach(clearTimeout);
          countdownTimers.current = [];
          setIntro(false);
          setCountdown(null);
          held.current = false;
          // One that comes up under the host's message, the drink menu or the Intro (a set moving on, or the moment before they come down) waits for them.
          if (previous !== undefined && next !== null) {
            if (covered.current || explaining.current) held.current = true;
            else arrive();
          }
          // A cleared screen wipes; a new question has its own countdown and intro.
          if (previous && next === null) setWipe((count) => count + 1);
        } else if (held.current && next !== null && !covered.current && !explaining.current) {
          // What covered it came down: now its countdown and sting, as the room first sees it.
          arrive();
        }
        setQuestion(next);
        setName(next && setup.names && typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null);
        const nextPerformer = typeof data?.performer === "string" && data.performer.trim() ? data.performer.trim() : null;
        // A name going up or coming down wipes, like any other screen change.
        if (performerSeen.current !== undefined && nextPerformer !== performerSeen.current && !(performerSeen.current && next)) setWipe((count) => count + 1);
        performerSeen.current = nextPerformer;
        setPerformer(nextPerformer);
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
            ...customWording(look),
          }
          : null;
        const which = nextMenu ? (custom ? "custom" : "standard") : "off";
        if (menuSeen.current !== undefined && which !== menuSeen.current) setWipe((count) => count + 1);
        menuSeen.current = which;
        // Keep the same object while nothing changed, so the board does not re-render every poll.
        setMenuCustom((current) => current && custom && JSON.stringify(current) === JSON.stringify(custom) ? current : custom);
        setMenu(nextMenu);
        setMarquee(typeof data?.marquee === "string" && data.marquee ? data.marquee : null);
        const nextBoard = parseLiveBoard(data);
        setBoard((current) => (JSON.stringify(current) === JSON.stringify(nextBoard) ? current : nextBoard));
        const segment = data?.segment && typeof data.segment.remainingMs === "number" ? data.segment as { remainingMs: number; nextSwitchMs: number } : null;
        setSegmentEnd(segment ? Date.now() + segment.remainingMs : null);
        clearTimeout(switchTimer);
        if (segment && segment.nextSwitchMs < 2_500) {
          // If a regular poll is still out at that moment, try again just after it.
          const onTime = () => { if (pending) switchTimer = setTimeout(onTime, 100); else void refresh(); };
          switchTimer = setTimeout(onTime, segment.nextSwitchMs + 150);
        }
        // The host's message going up or coming down wipes, like the drink menu; new words while it is up just fade in.
        if (messageSeen.current !== undefined && (nextMessage !== null) !== messageSeen.current) setWipe((count) => count + 1);
        messageSeen.current = nextMessage !== null;
        setMessage((current) => current && nextMessage && current.text === nextMessage.text && current.color === nextMessage.color ? current : nextMessage);
        const soundTestAt = typeof data?.soundTest === "string" ? data.soundTest : null;
        if (soundTestAt !== soundTestSeen.current) {
          // "Test sound" plays the sting once, nothing else; like the Intro, a tap from before this screen opened is not replayed.
          const opening = soundTestSeen.current === undefined;
          soundTestSeen.current = soundTestAt;
          if (soundTestAt && !opening) {
            busyUntil.current = Date.now() + 4_000;
            sting();
          }
        }
        // The site was updated while this screen was open: its code is old, and new features would never show.
        if (isNewerBuild(build, data?.build)) {
          if (reloading) return;
          const now = Date.now();
          const signature = screenSignature(data);
          if (!quietScreen(data)) quiet = null;
          else if (quiet?.signature !== signature) quiet = { signature, since: now };
          // Without storage there is no guard against reloading over and over: then it never reloads itself, and the Control Center says so.
          let tried = noStorage;
          try { tried ||= sessionStorage.getItem(RELOAD_KEY) === data.build; } catch { tried = noStorage = true; }
          const fullscreen = Boolean(fullscreenElement());
          const may = maySelfReload({ tried, fullscreen, soundByTap: soundByTap.current, busy: now < busyUntil.current, quietForMs: quiet ? now - quiet.since : 0 });
          if (may && now - pageReadyAt < PAGE_READY_MS) {
            // Reload at a moment the room won't notice, carrying what is up now so nothing that goes up meanwhile loses its intro.
            try {
              sessionStorage.setItem(RELOAD_KEY, data.build);
              sessionStorage.setItem(CARRY_KEY, JSON.stringify({
                at: now, question: shown.current ?? null, performer: performerSeen.current ?? null, explainer: explainerSeen.current ?? null,
                message: messageSeen.current ?? false, soundTest: soundTestSeen.current ?? null, menu: menuSeen.current ?? null, held: held.current,
              }));
              reloading = true;
              window.location.reload();
              return;
            } catch { noStorage = true; }
          }
          if (may && now - lastPageCheck > PAGE_READY_MS) {
            // First make sure the page answers, so a wifi drop can't leave an error page up; the reload waits for a later poll.
            lastPageCheck = now;
            void fetchWithin(window.location.href, { cache: "no-store" }, POLL_TIMEOUT_MS, controller.signal)
              .then(({ response }) => { if (response.ok) pageReadyAt = Date.now(); }, () => {});
          }
          // It won't reload itself: in full screen, sound that needed a tap, or already tried. The Control Center tells the host.
          if (!framed && (tried || fullscreen || soundByTap.current) && now - lastReport > REPORT_EVERY_MS) {
            lastReport = now;
            report(build);
            try { localStorage.setItem(REPORTED_KEY, "1"); } catch { /* the reminder fades from the Control Center on its own */ }
          }
        } else if (!framed && build && data?.build === build) {
          quiet = null;
          // Up to date again after saying it was not: say so, and the Control Center's reminder goes away.
          let reported = false;
          try { reported = localStorage.getItem(REPORTED_KEY) === "1"; if (reported) localStorage.removeItem(REPORTED_KEY); } catch { /* nothing to clear */ }
          if (reported) report(build);
        }
      } catch {
        // Offline, timed out or aborted: leave the screen as it is.
      } finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), framed ? MIRROR_POLL_MS : POLL_MS);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      preloadSounds.current = () => {};
      controller.abort();
      clearTimeout(introTimer.current);
      clearTimeout(switchTimer);
      countdownTimers.current.forEach(clearTimeout);
      explainerTimers.current.forEach(clearTimeout);
      explaining.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [space, build]);

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
        preloadSounds.current();
      }
      const context = audio.current;
      // Already on before this, a tap is not what started it: then the browser allows sound here by itself.
      const wasRunning = context.state === "running";
      context.resume().then(
        () => {
          if (audio.current !== context) return;
          setSoundOn(context.state === "running");
          // Sound started only once someone touched the page: a reload could lose it, so the screen leaves reloading to the host.
          if (soundNeededTap({ tapped, wasRunning, running: context.state === "running" })) soundByTap.current = true;
        },
        () => { if (audio.current === context) setSoundOn(false); },
      );
    };
    // Try at once: a browser set to allow autoplay here starts sound with no tap. A blocked one just waits for the first tap.
    let tapped = false;
    const tap = () => { tapped = true; unlock(); };
    unlock();
    window.addEventListener("pointerdown", tap);
    window.addEventListener("keydown", tap);
    return () => {
      window.removeEventListener("pointerdown", tap);
      window.removeEventListener("keydown", tap);
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
        <DrinkMenu qrSrc={showQr ? qrSrc : undefined} marquee={marquee} custom={menuCustom} drinks={board.drinks ?? undefined} marqueeSpeed={board.marqueeSpeed} marqueeColor={board.marqueeColor} />
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
        {message ? (
          // The host's own message goes over the question or the set until they take it down.
          <div key={`${message.color}${message.text}`} className="pnc-screen-in h-full w-full">
            <ScreenMessage text={message.text} color={message.color} />
          </div>
        ) : question && !intro && countdown === null ? (
          // Sized together, so a long question and its name both fit above the QR.
          <div key={question} ref={text} className="pnc-screen-in w-full text-center">
            <h1 className="whitespace-pre-wrap break-words leading-tight">{question}</h1>
            {name ? <p className="mt-[0.6em] break-words text-[0.55em] font-semibold leading-tight text-white/75">— {name}</p> : null}
          </div>
        ) : !question && performer && !intro && countdown === null ? (
          <div key={performer} className="pnc-screen-in w-full text-center">
            <p className="font-[family-name:var(--pnc-heading)] text-[min(4vw,5vh)] uppercase tracking-[0.3em] text-[#ff2e4d]">{settings.stageLabel}</p>
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
    {countdown !== null && !menu && !message && !explainer ? (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black text-white" aria-hidden="true">
        <span key={countdown} className="pnc-countdown font-[family-name:var(--pnc-heading)] font-bold tabular-nums leading-none">{countdown}</span>
      </div>
    ) : null}
    {intro && !menu && !message && !explainer ? <BadDecisionIntro word={settings.introWord} /> : null}
    {explainer ? <Explainer step={explainer} qrSrc={showQr ? qrSrc : undefined} look={settings} /> : null}
    {segmentEnd !== null && settings.timer ? (
      <p className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 font-[family-name:var(--pnc-heading)] text-lg tabular-nums text-white/80 sm:bottom-4 sm:text-2xl" aria-hidden="true">
        {segmentClock(segmentLeft)}
      </p>
    ) : null}
    {wipe ? <div key={wipe} className="pnc-wipe" aria-hidden="true" /> : null}
    {/* Outside <main>, so it is not read out with the question. Not while the host has muted the sound on purpose. */}
    {!mirrored && !soundOn && settings.sound ? (
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
