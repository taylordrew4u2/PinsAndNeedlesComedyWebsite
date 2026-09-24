"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";
import type { Rehearsal } from "@/lib/rehearsal";

type RehearsalState = {
  rehearsal: Rehearsal | null;
  rehearsing: boolean;
  showWindowOpen: boolean;
  enabled: boolean;
};
type State = RehearsalState & { submissions: Submission[]; selected: LiveSelection | null; truncated: boolean };

const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function RunShow() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const [notice, setNotice] = useState("");
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

  const rehearse = async (action: "start" | "finish") => {
    if (changing.current) return;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/run-show", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rehearsal: action }),
      });
      if (response.status === 401) { setAuthLost(true); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the rehearsal.");
      if (action === "finish") {
        setNotice(`Rehearsal finished. ${data.deleted === 1 ? "1 test question" : `${data.deleted} test questions`} deleted.`);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the rehearsal.");
    } finally {
      revision.current += 1;
      changing.current = false;
      setBusy(false);
    }
    await refresh();
  };

  const tests = state ? state.submissions.filter((item) => item.rehearsal).length : 0;

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
        {state ? (
          <section aria-label="Dress rehearsal" className={`mb-6 rounded-lg border p-4 ${state.rehearsing ? "border-amber-300 bg-amber-300/10" : "border-white/20"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs uppercase tracking-widest text-neutral-400">
                {state.rehearsing && state.rehearsal ? <span className="text-amber-200">Rehearsal on · form open until {clock(state.rehearsal.endsAt)}</span> : "Dress rehearsal"}
              </h2>
              {state.rehearsing || state.rehearsal || tests > 0 ? (
                <button type="button" onClick={() => void rehearse("finish")} disabled={busy} className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                  {tests > 0 ? `Finish & delete ${tests === 1 ? "1 test" : `${tests} tests`}` : "Finish rehearsal"}
                </button>
              ) : (
                <button type="button" onClick={() => void rehearse("start")} disabled={busy || state.showWindowOpen || !state.enabled} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Start rehearsal</button>
              )}
            </div>
            {state.rehearsing ? (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-300">
                <li>Scan the printed QR code with <b>this phone</b> (the one signed in here) and send a test. Guests still see the countdown.</li>
                <li>It shows up below tagged TEST. Tap <b>Show on screen</b>.</li>
                <li>Check it on the projector, then tap <b>Clear screen</b>.</li>
                <li>Tap <b>Finish</b>. Only the tests are deleted.</li>
              </ol>
            ) : state.showWindowOpen ? (
              <p className="mt-2 text-sm text-neutral-400">The real submission window is open, so the form is already live.</p>
            ) : !state.enabled ? (
              <p className="mt-2 text-sm text-neutral-400">Bad Decisions is switched off in the admin.</p>
            ) : state.rehearsal || tests > 0 ? (
              <p className="mt-2 text-sm text-neutral-400">The rehearsal has ended. Finish it to delete the test questions before the show.</p>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">Opens the QR form on this phone only, for 30 minutes (never past the real opening), so you can run the whole show once. Guests keep seeing the countdown. Everything you send is tagged TEST and deleted when you finish.</p>
            )}
          </section>
        ) : null}
        {notice ? <p role="status" className="mb-4 text-emerald-300">{notice}</p> : null}
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
                  {item.rehearsal ? <span className="mb-2 inline-block rounded bg-amber-300 px-2 py-0.5 text-xs font-bold tracking-widest text-black">TEST</span> : null}
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
