"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";
import { useWakeLock } from "@/lib/use-wake-lock";
import LiveMirror from "./LiveMirror";

type State = {
  submissions: Submission[];
  shown: Submission[];
  archived: Submission[];
  selected: LiveSelection | null;
  /** The drink menu is up on the live screen, over any question. */
  menu: boolean;
  truncated: boolean;
  questionsOpen: boolean;
  manualOpen: boolean;
  pageLive: boolean;
};
type Change = Partial<Pick<State, "selected" | "menu" | "questionsOpen" | "manualOpen" | "pageLive">> & { drawn?: Submission; submission?: Submission };

const API = "/api/admin/run-show";
const PILE_API = "/api/admin/decisions";
/** How often the pile is checked. New questions show up within this. */
const POLL_MS = 4_000;
/** Forwarded texts are collected on the way past, but not on every poll. */
const INGEST_EVERY_MS = 30_000;
const PING_KEY = "pnc-control-center-ping";

/**
 * The show-night control center: the questions as they arrive, a mirror of
 * the live screen, and every control for the pile. Only reachable signed in.
 */
export default function ControlCenter() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const [mirrorVersion, setMirrorVersion] = useState(0);
  // Ids that arrived while this page was open and have not been looked at yet.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [texting, setTexting] = useState<{ on: boolean; error: string }>({ on: false, error: "" });
  const ping = useSyncExternalStore(subscribePing, readPing, () => false);
  useWakeLock();
  const revision = useRef(0);
  const changing = useRef(false);
  const loading = useRef(false);
  // Every id seen so far; null until the first load, so nothing already in the pile counts as new.
  const known = useRef<Set<string> | null>(null);
  const lastIngest = useRef(0);
  const pingOn = useRef(ping);
  useEffect(() => { pingOn.current = ping; }, [ping]);

  const refresh = useCallback(async () => {
    if (loading.current || changing.current) return;
    loading.current = true;
    const started = revision.current;
    try {
      if (Date.now() - lastIngest.current > INGEST_EVERY_MS) {
        lastIngest.current = Date.now();
        await collectTexts(setTexting);
      }
      const response = await fetch(API, { cache: "no-store" });
      if (response.status === 401) { setAuthLost(true); return; }
      const data = (await response.json()) as State & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load questions.");
      // A poll started before a host's change must not undo that change in the UI.
      if (started !== revision.current || changing.current) return;
      const ids = [...data.submissions, ...data.shown, ...data.archived].map((item) => item.id);
      if (known.current) {
        const arrived = data.submissions.filter((item) => !known.current?.has(item.id)).map((item) => item.id);
        if (arrived.length) {
          setFresh((current) => new Set([...current, ...arrived]));
          if (pingOn.current) playPing();
        }
      }
      known.current = new Set([...(known.current ?? []), ...ids]);
      setState(data);
      setError("");
    } catch (failure) {
      if (started === revision.current) setError(failure instanceof Error ? failure.message : "Could not load questions.");
    } finally { loading.current = false; }
  }, []);

  useEffect(() => {
    // refresh reads external server state, rather than deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [refresh]);

  // The tab shows how many new questions are waiting, even from another window.
  useEffect(() => {
    const base = "Control Center";
    document.title = fresh.size ? `(${fresh.size}) ${base}` : base;
    return () => { document.title = base; };
  }, [fresh]);

  /** One change at a time; the poll waits until it has landed. */
  const change = async (endpoint: string, body: object, done: (data: Change & Record<string, unknown>) => void, failed = "Could not update the screen.") => {
    if (changing.current) return false;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError("");
    setNotice("");
    let ok = false;
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (response.status === 401) { setAuthLost(true); return false; }
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || failed);
      done(data);
      ok = true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : failed);
    } finally {
      revision.current += 1;
      changing.current = false;
      setBusy(false);
    }
    return ok;
  };

  const forget = (id: string) => setFresh((current) => {
    if (!current.has(id)) return current;
    const next = new Set(current);
    next.delete(id);
    return next;
  });

  /** Move a question from the waiting list to the shown list, in the UI. */
  const moveToShown = (current: State, id: string, selected: LiveSelection | null): State => {
    const item = current.submissions.find((entry) => entry.id === id);
    return {
      ...current,
      selected,
      menu: selected ? false : current.menu,
      submissions: current.submissions.filter((entry) => entry.id !== id),
      shown: item ? [{ ...item, shownAt: new Date().toISOString() }, ...current.shown] : current.shown,
    };
  };

  const select = (submissionId: string | null) =>
    change(API, { submissionId }, (data) => {
      if (submissionId) forget(submissionId);
      setState((current) => current
        ? submissionId ? moveToShown(current, submissionId, data.selected ?? null) : { ...current, selected: data.selected ?? null }
        : current);
    });

  const draw = () =>
    change(API, { draw: true }, (data) => {
      const drawn = data.drawn;
      if (!drawn) return;
      forget(drawn.id);
      setState((current) => current ? moveToShown(current, drawn.id, data.selected ?? null) : current);
      setNotice(`Drawn: “${drawn.decision.slice(0, 60)}${drawn.decision.length > 60 ? "…" : ""}” is on screen.`);
    }, "Could not draw a question.");

  const setMenu = (menu: boolean) =>
    change(API, { menu }, (data) => {
      setState((current) => current ? { ...current, menu: Boolean(data.menu) } : current);
    }, "Could not update the drink menu.");

  const putBack = (id: string) =>
    change(API, { putBack: id }, (data) => {
      const item = data.submission;
      setState((current) => current ? {
        ...current,
        shown: current.shown.filter((entry) => entry.id !== id),
        submissions: item ? [item, ...current.submissions] : current.submissions,
      } : current);
    }, "Could not put that question back.");

  const setManualOpen = (manualOpen: boolean) =>
    change(API, { manualOpen }, (data) => {
      setState((current) => current ? {
        ...current, questionsOpen: Boolean(data.questionsOpen), manualOpen: Boolean(data.manualOpen), pageLive: Boolean(data.pageLive),
      } : current);
      setNotice(manualOpen ? "Questions are open now and will stay open until you return to the schedule." : "Questions are following the schedule again.");
    }, "Could not update questions.");

  const remove = async (item: Submission) => {
    if (!window.confirm(`Delete this question for good?\n\n${item.decision.slice(0, 120)}`)) return;
    forget(item.id);
    await change(PILE_API, { action: "delete", id: item.id }, () => {
      setState((current) => current ? {
        ...current,
        submissions: current.submissions.filter((entry) => entry.id !== item.id),
        shown: current.shown.filter((entry) => entry.id !== item.id),
        archived: current.archived.filter((entry) => entry.id !== item.id),
        // Deleting the question on screen clears the screen on the server too.
        selected: current.selected?.submissionId === item.id ? null : current.selected,
      } : current);
    }, "Could not delete that question.");
  };

  const archive = async () => {
    if (!window.confirm("Archive every question from tonight? The pile goes back to zero and the screen clears.")) return;
    // The server archives a batch at a time so a big pile cannot outlast one
    // request; keep asking until it says nothing is left. Bounded, so a server
    // that stopped making progress cannot spin here.
    for (let pass = 0; pass < 40; pass += 1) {
      let remaining = 0;
      const ok = await change(PILE_API, { action: "archive-all" }, (data) => { remaining = Number(data.remaining) || 0; }, "Could not archive the pile.");
      if (!ok || !remaining) break;
    }
    setFresh(new Set());
    setNotice("Tonight's pile is archived. The screen is clear.");
    await refresh();
  };

  if (authLost) return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <a href="/admin/run-show" className="underline">Sign in again to the Control Center</a>
    </main>
  );

  const waiting = state?.submissions ?? [];
  const onScreenId = state?.selected?.submissionId ?? null;

  return (
    <main className="min-h-svh bg-neutral-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Control Center</h1>
            <p className="mt-1 text-sm text-neutral-400">Bad Decisions, show night. Questions land here as they come in; the live screen follows what you pick.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin" className="rounded-md border border-white/30 px-4 py-2 text-sm">Admin</a>
            <a href="/bad-decisions/live" target="_blank" rel="noopener noreferrer" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              Open live screen
            </a>
          </div>
        </header>

        {notice ? <p role="status" className="mb-4 text-emerald-300">{notice}</p> : null}
        {error ? <p role="alert" className="mb-4 text-red-300">{error}</p> : null}
        {state?.truncated ? <p className="mb-4 text-sm text-amber-200">Showing the newest available questions. There are more stored than can be listed at once; delete some archived ones to bring the rest into view.</p> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-label="Live screen" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-400">Live screen</p>
                <p className="text-sm">{!state ? "Connecting…" : state.menu ? "Drink menu on screen" : state.selected ? "On screen" : "Screen cleared"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void setMenu(!state?.menu)}
                  disabled={busy || !state}
                  aria-pressed={Boolean(state?.menu)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${state?.menu ? "bg-amber-300 text-black" : "border border-amber-300/70 text-amber-200"}`}
                >
                  {state?.menu ? "Hide drink menu" : "Show drink menu"}
                </button>
                <button type="button" onClick={() => void draw()} disabled={busy || !waiting.length} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">🎲 Draw one</button>
                <button type="button" onClick={() => void select(null)} disabled={busy || !state?.selected} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Clear screen</button>
              </div>
            </div>
            <LiveMirror version={mirrorVersion} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <span>A copy of what the projector shows. It checks for changes every couple of seconds, same as the projector.</span>
              <button type="button" onClick={() => setMirrorVersion((value) => value + 1)} className="underline">Reload mirror</button>
            </div>
            {state?.selected ? (
              <div className="mt-4 rounded-lg border border-white/20 p-4">
                <p className="whitespace-pre-wrap break-words text-lg">{state.selected.question}</p>
                {state.selected.name ? <p className="mt-1 text-sm text-neutral-300">— {state.selected.name} (shown on screen)</p> : null}
              </div>
            ) : null}

            <div className="mt-6 rounded-lg border border-white/20 p-4">
              <p className="text-sm">{!state ? "Checking questions…" : state.questionsOpen ? "Questions are open" : "Questions are closed"}</p>
              <p className="mt-1 text-sm text-neutral-400">
                {state && !state.pageLive
                  ? "The Bad Decisions page is switched off, so the QR goes nowhere. Open questions now switches it on."
                  : "Open questions whenever you want. The live screen stays as it is."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={() => void setManualOpen(true)} disabled={busy || !state || state.manualOpen} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Open questions now</button>
                {state?.manualOpen ? <button type="button" onClick={() => void setManualOpen(false)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Use scheduled hours</button> : null}
              </div>
              {texting.on ? (
                <p className={`mt-3 text-xs ${texting.error ? "text-amber-200" : "text-neutral-500"}`}>
                  {texting.error ? `Texts aren't coming through: ${texting.error}. The form still works.` : "Collecting texts from the forwarding mailbox as well as the form."}
                </p>
              ) : null}
            </div>

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">📱 QR code for the tables</summary>
              <QrCode />
            </details>
          </section>

          <section aria-label="Question submissions" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base">Questions{state ? ` (${waiting.length})` : ""}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
                  <input type="checkbox" className="h-4 w-4 accent-white" checked={ping} onChange={(event) => writePing(event.target.checked)} />
                  Ping when one arrives
                </label>
                <button type="button" onClick={() => void refresh()} disabled={busy} className="px-3 py-2 text-sm underline disabled:opacity-40">Refresh</button>
              </div>
            </div>
            {fresh.size ? (
              <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200">
                <span>{fresh.size === 1 ? "1 new question" : `${fresh.size} new questions`} since you last looked</span>
                <button type="button" onClick={() => setFresh(new Set())} className="underline">Got it</button>
              </div>
            ) : null}
            {!state ? <p role="status" className="text-neutral-400">Loading questions…</p> : waiting.length === 0 ? <p className="text-neutral-400">No questions waiting. New submissions appear here by themselves.</p> : (
              <ul className="space-y-3">
                {waiting.map((item) => {
                  const isNew = fresh.has(item.id);
                  return (
                    <li key={item.id} className={`rounded-lg border p-4 transition-colors ${isNew ? "border-emerald-400/70 bg-emerald-950/30" : "border-white/15"}`}>
                      {isNew ? <span className="mb-2 inline-block rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">New</span> : null}
                      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{item.decision}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-neutral-400">{item.name || "Anonymous"}{item.createdAt ? ` · ${timeOf(item.createdAt)}` : ""}</span>
                        <span className="flex gap-2">
                          <button type="button" onClick={() => void remove(item)} disabled={busy} className="rounded-md px-3 py-2.5 text-sm text-neutral-400 hover:text-white disabled:opacity-50">Delete</button>
                          <button type="button" disabled={busy} onClick={() => void select(item.id)} className="shrink-0 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">Show on screen</button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <details className="mt-6 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">Already shown tonight{state ? ` (${state.shown.length})` : ""}</summary>
              {state?.shown.length ? (
                <div role="list" className="mt-3 space-y-2">
                  {state.shown.map((item) => (
                    <div role="listitem" key={item.id} className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 ${item.id === onScreenId ? "border-white bg-white/10" : "border-white/10"}`}>
                      <span className="min-w-0">
                        <span className="block whitespace-pre-wrap break-words text-sm">{item.decision}</span>
                        <span className="block text-xs text-neutral-500">{item.name || "Anonymous"}{item.id === onScreenId ? " · on screen now" : ""}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {item.id === onScreenId ? null : (
                          <button type="button" onClick={() => void putBack(item.id)} disabled={busy} className="rounded-md border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50">Put it back</button>
                        )}
                        <button type="button" onClick={() => void remove(item)} disabled={busy} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-neutral-500">Nothing has been on screen yet.</p>}
            </details>

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">End of the night</summary>
              <p className="mt-3 text-sm text-neutral-400">Archive everything so next week starts at zero. Archived questions stay here until you delete them.</p>
              <button type="button" onClick={() => void archive()} disabled={busy || !state || (!waiting.length && !state.shown.length)} className="mt-3 rounded-md border border-red-500/60 bg-red-950/40 px-4 py-2 text-sm text-red-200 disabled:opacity-40">🧹 Archive everything from tonight</button>
              {state?.archived.length ? (
                <div role="list" className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Archived ({state.archived.length})</p>
                  {state.archived.map((item) => (
                    <div role="listitem" key={item.id} className="flex items-start justify-between gap-3 text-sm text-neutral-400">
                      <span className="whitespace-pre-wrap break-words">{item.decision}{item.name ? <span className="text-neutral-600"> — {item.name}</span> : null}</span>
                      <button type="button" onClick={() => void remove(item)} disabled={busy} className="shrink-0 px-2 py-1 text-xs hover:text-white disabled:opacity-50">Delete</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * The QR code for the flyer and the table tent, generated from the site's own
 * URL so it can never point at a stale address. The cache-busting key means a
 * changed site URL shows the new code, not a browser-cached old one.
 */
function QrCode() {
  const [key] = useState(() => Date.now());
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/admin/decisions/qr?v=${key}`} alt="QR code linking to /bad-decisions" width={128} height={128} className="h-32 w-32 shrink-0 rounded-lg bg-white p-2" />
      <div className="min-w-[200px] flex-1 text-sm leading-relaxed text-neutral-300">
        <p>People scan this to send a question in. It shows a countdown until the form opens, then the question. Print this exact code; older codes pointing to the plain page no longer work.</p>
        <a href={`/api/admin/decisions/qr?v=${key}`} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">⬇️ Open full size to save</a>
      </div>
    </div>
  );
}

/**
 * Pull forwarded texts from the mailbox. This page is only open during a show,
 * which is exactly when texts need collecting, so it stands in for a scheduler.
 * A mailbox that is not set up answers instantly and says so.
 */
async function collectTexts(setTexting: (value: { on: boolean; error: string }) => void) {
  try {
    const pull = await fetch("/api/admin/decisions/ingest", { method: "POST", cache: "no-store" });
    const result = await pull.json().catch(() => ({}));
    setTexting(result?.configured ? { on: true, error: result.ok ? "" : String(result.error || "Mailbox unreachable") } : { on: false, error: "" });
  } catch {
    // A failed pull must never stop the pile from loading.
    setTexting({ on: true, error: "Mailbox unreachable" });
  }
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** A short, quiet tone. Nothing to load: the browser makes it. */
function playPing() {
  try {
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => void context.close().catch(() => {});
  } catch {
    // Audio blocked or unsupported: the "New" pill still shows.
  }
}

/**
 * The ping switch lives in this browser, not in the content: it is the
 * preference of whoever is holding this device. Read through
 * useSyncExternalStore so the server render (off) and the first client
 * render agree.
 */
function subscribePing(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PING_KEY, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PING_KEY, callback);
  };
}

function readPing(): boolean {
  try { return window.localStorage.getItem(PING_KEY) === "1"; } catch { return false; }
}

function writePing(value: boolean) {
  try { window.localStorage.setItem(PING_KEY, value ? "1" : "0"); } catch {
    // Private mode or blocked storage: the switch still works for this page load.
  }
  window.dispatchEvent(new Event(PING_KEY));
  if (value) playPing();
}
