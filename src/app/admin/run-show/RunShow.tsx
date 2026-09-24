"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";
import { useWakeLock } from "@/lib/use-wake-lock";

type State = { submissions: Submission[]; selected: LiveSelection | null; truncated: boolean; questionsOpen: boolean; manualOpen: boolean };

/** The host's controls for the live show. */
export default function RunShow() {
  const api = "/api/admin/run-show";
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  useWakeLock();
  const revision = useRef(0);
  const changing = useRef(false);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current || changing.current) return;
    loading.current = true;
    const started = revision.current;
    try {
      const response = await fetch(api, { cache: "no-store" });
      if (response.status === 401) { setAuthLost(true); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load questions.");
      // A poll started before a host's selection must not undo that selection in the UI.
      if (started === revision.current && !changing.current) {
        setState(data);
        setError("");
      }
    } catch (failure) {
      if (started === revision.current) setError(failure instanceof Error ? failure.message : "Could not load questions.");
    } finally { loading.current = false; }
  }, [api]);

  useEffect(() => {
    // refresh reads external server state, rather than deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), 10_000);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);

  /** One change at a time; the poll waits until it has landed. */
  const change = async (body: object, done: (data: { selected?: LiveSelection | null; questionsOpen?: boolean; manualOpen?: boolean }) => void) => {
    if (changing.current) return;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(api, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (response.status === 401) { setAuthLost(true); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the screen.");
      done(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the screen.");
    } finally {
      revision.current += 1;
      changing.current = false;
      setBusy(false);
    }
  };

  const select = (submissionId: string | null) =>
    change({ submissionId }, (data) => setState((current) => current ? { ...current, selected: data.selected ?? null } : current));

  const setManualOpen = (manualOpen: boolean) =>
    change({ manualOpen }, (data) => {
      setState((current) => current ? { ...current, questionsOpen: Boolean(data.questionsOpen), manualOpen: Boolean(data.manualOpen) } : current);
      setNotice(manualOpen ? "Questions are open now and will stay open until you return to the schedule." : "Questions are following the schedule again.");
    });

  if (authLost) return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <a href="/admin/run-show" className="underline">Sign in again to Run Show</a>
    </main>
  );

  return (
    <main className="min-h-svh bg-neutral-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl">Run Show</h1>
          <a href="/bad-decisions/live" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/30 px-4 py-2 text-sm">
            Open live screen
          </a>
        </header>

        <section aria-label="Question submissions" className="mb-6 rounded-lg border border-white/20 p-4">
          <p className="text-sm">{!state ? "Checking questions…" : state.questionsOpen ? "Questions are open" : "Questions are closed"}</p>
          <p className="mt-1 text-sm text-neutral-400">Open questions whenever you want. The live screen stays as it is.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void setManualOpen(true)} disabled={busy || !state || state.manualOpen} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Open questions now</button>
            {state?.manualOpen ? <button type="button" onClick={() => void setManualOpen(false)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Use scheduled hours</button> : null}
          </div>
        </section>

        {notice ? <p role="status" className="mb-4 text-emerald-300">{notice}</p> : null}
        <div className="mb-6 rounded-lg border border-white/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-neutral-400">{!state ? "Connecting…" : state.selected ? "On screen" : "Screen cleared"}</p>
            <button type="button" onClick={() => void select(null)} disabled={busy || !state?.selected} className="rounded border border-white/30 px-3 py-2 text-sm disabled:opacity-40">Clear screen</button>
          </div>
          {state?.selected ? <p className="mt-3 whitespace-pre-wrap break-words text-lg">{state.selected.question}</p> : null}
          {state?.selected?.name ? <p className="mt-1 text-sm text-neutral-300">— {state.selected.name} (shown on screen)</p> : null}
        </div>
        {error ? <p role="alert" className="mb-4 text-red-300">{error}</p> : null}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base">Questions{state ? ` (${state.submissions.length})` : ""}</h2>
          <button type="button" onClick={() => void refresh()} disabled={busy} className="px-3 py-2 text-sm underline disabled:opacity-40">Refresh</button>
        </div>
        {state?.truncated ? <p className="mb-3 text-sm text-amber-200">Showing the newest available questions. Older entries can be managed in the main admin.</p> : null}
        {!state ? <p role="status" className="text-neutral-400">Loading questions…</p> : state.submissions.length === 0 ? <p className="text-neutral-400">No questions yet. New submissions appear here automatically.</p> : (
          <ul className="space-y-3">
            {state.submissions.map((item) => {
              const selected = state.selected?.submissionId === item.id;
              return (
                <li key={item.id} className={`rounded-lg border p-4 ${selected ? "border-white bg-white/10" : "border-white/15"}`}>
                  <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{item.decision}</p>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-sm text-neutral-400">{item.name || "Anonymous"}</span>
                    <button type="button" aria-pressed={selected} disabled={busy || selected} onClick={() => void select(item.id)} className="shrink-0 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{selected ? "On screen" : "Show on screen"}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
