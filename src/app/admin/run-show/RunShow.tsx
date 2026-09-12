"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";

type State = { submissions: Submission[]; selected: LiveSelection | null; truncated: boolean };

export default function RunShow() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const revision = useRef(0);
  const changing = useRef(false);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current || changing.current) return;
    loading.current = true;
    const started = revision.current;
    try {
      const response = await fetch("/api/admin/run-show", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    // refresh reads external server state, rather than deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), 10_000);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);

  const select = async (submissionId: string | null) => {
    if (changing.current) return;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/run-show", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      if (response.status === 401) { setAuthLost(true); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the live screen.");
      setState((current) => current ? { ...current, selected: data.selected } : current);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the live screen.");
    } finally {
      revision.current += 1;
      changing.current = false;
      setBusy(false);
    }
  };

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
          <a href="/bad-decisions/live" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/30 px-4 py-2 text-sm">Open live screen </a>
        </header>
        <div className="mb-6 rounded-lg border border-white/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-neutral-400">{!state ? "Connecting…" : state.selected ? "On screen" : "Screen cleared"}</p>
            <button type="button" onClick={() => void select(null)} disabled={busy || !state?.selected} className="rounded border border-white/30 px-3 py-2 text-sm disabled:opacity-40">Clear screen</button>
          </div>
          {state?.selected ? <p className="mt-3 whitespace-pre-wrap break-words text-lg">{state.selected.question}</p> : null}
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
