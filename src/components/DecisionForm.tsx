"use client";

import { useEffect, useRef, useState } from "react";
import { DECISION_MAX, NAME_MAX } from "@/lib/decisions";
import { countdownParts } from "@/lib/countdown";
import { formatPhone, smsHref } from "@/lib/sms";

/**
 * The submission form. Built for a phone in a bar: one field, one choice,
 * one button, and a thank-you that replaces the form so nobody sends twice
 * by accident.
 *
 * Outside the show's window the form is replaced by a countdown. The poll that keeps the count moving also watches for the window
 * opening, so a phone left face-up on the table turns into a live form on
 * its own.
 */
export default function DecisionForm({
  qrKey,
  question,
  placeholder,
  namePrompt,
  formNote,
  submitLabel,
  thanksText,
  showCount,
  initialCount,
  initialOpen,
  initialClosedText,
  initialOpensAt,
  initialClosesAt,
  initialServerNow,
  smsNumber,
  smsNote,
}: {
  qrKey: string;
  question: string;
  placeholder: string;
  namePrompt: string;
  formNote: string;
  submitLabel: string;
  thanksText: string;
  showCount: boolean;
  initialCount: number | null;
  initialOpen: boolean;
  initialClosedText: string;
  initialOpensAt: string;
  initialClosesAt: string;
  initialServerNow: number;
  smsNumber: string;
  smsNote: string;
}) {
  const [decision, setDecision] = useState("");
  const [named, setNamed] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(initialCount);
  const [open, setOpen] = useState(initialOpen);
  const [closedText, setClosedText] = useState(initialClosedText);

  const [opensAt, setOpensAt] = useState(initialOpensAt);
  const [now, setNow] = useState(initialServerNow);
  const heading = useRef<HTMLHeadingElement>(null);

  // The server owns the gate. Refresh at its boundary and on return to the tab;
  // a slow or disconnected phone must never open the form on its clock alone.
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let serverTime = initialServerNow;
    let syncedAt = performance.now();
    let boundary = Date.parse(initialOpen ? initialClosesAt : initialOpensAt);
    let nextPoll = 0;
    const controller = new AbortController();
    const tick = async () => {
      const current = serverTime + performance.now() - syncedAt;
      setNow(current);
      if (pending || (current < nextPoll && (!Number.isFinite(boundary) || current < boundary))) return;
      pending = true;
      nextPoll = current + 30_000;
      boundary = NaN;
      try {
        const response = await fetch("/api/decisions", { cache: "no-store", headers: { "X-Decisions-QR": qrKey }, signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        if (disposed || typeof data.open !== "boolean") return;
        if (typeof data.serverNow === "number") {
          serverTime = data.serverNow;
          syncedAt = performance.now();
          setNow(serverTime);
        }
        setOpen(data.open);
        if (!data.open) {
          setDone(false);
          setDecision("");
          setName("");
          setNamed(false);
        }
        if (typeof data.opensAt === "string") setOpensAt(data.opensAt);
        if (typeof data.closedText === "string") setClosedText(data.closedText);
        setCount(typeof data.count === "number" ? data.count : null);
        const target = Date.parse(data.open ? data.closesAt : data.opensAt);
        boundary = target > serverTime ? target : NaN;
        nextPoll = serverTime + 30_000;
      } catch {
        // Retry soon at zero rather than opening a form the server cannot accept.
        nextPoll = current + 5_000;
      } finally {
        pending = false;
      }
    };
    const resume = () => {
      if (document.visibilityState === "visible") {
        nextPoll = 0;
        void tick();
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 1_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [initialOpen, initialOpensAt, initialClosesAt, initialServerNow, qrKey]);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Decisions-QR": qrKey },
        body: JSON.stringify({ decision, name, anonymous: !named, website }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.open === false) {
        setOpen(false);
        setClosedText(data.error || "Submissions are closed.");
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "Couldn't send that.");
      if (typeof data.count === "number") setCount(data.count);
      setDone(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Couldn't send that.");
    } finally {
      setBusy(false);
    }
  };

  const remaining = DECISION_MAX - decision.length;

  // Some people will never scan a code. The number is a link so that tapping
  // it on a phone opens a composed message rather than making them copy it.
  const texting = smsNumber ? (
    <p className="text-[13px] leading-relaxed text-[var(--pnc-muted)]">
      {(smsNote || "Or text it to {number}.").split("{number}").flatMap((part, index) =>
        index === 0
          ? [part]
          : [
              <a
                key="number"
                href={smsHref(smsNumber)}
                className="whitespace-nowrap underline underline-offset-4 hover:text-[var(--pnc-fg)]"
              >
                {formatPhone(smsNumber)}
              </a>,
              part,
            ]
      )}
    </p>
  ) : null;

  const counter =
    showCount && count !== null ? (
      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
        {count === 0 ? "No decisions in yet. Be first." : `${count} ${count === 1 ? "decision" : "decisions"} in tonight`}
      </p>
    ) : null;

  if (!open) {
    const parts = countdownParts(opensAt, now);
    return (
      <section className="text-center" aria-label="Countdown to Bad Decisions submissions">
        {parts ? (
          <>
            <h1 className="text-[11px] uppercase tracking-[0.24em] text-[var(--pnc-muted)]">Next show · submissions open in</h1>
            <div role="timer" aria-live="off" className="mt-6 grid grid-cols-4 gap-2 sm:gap-5">
              {Object.entries(parts).map(([unit, value]) => (
                <div key={unit}>
                  <span className="block text-4xl tabular-nums sm:text-6xl">{String(value).padStart(2, "0")}</span>
                  <span className="mt-2 block text-[10px] uppercase tracking-[0.15em] text-[var(--pnc-muted)]">{unit}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p role="status">{closedText || "The next show will be announced soon."}</p>}
      </section>
    );
  }

  if (done) {
    return (
      <div className="border border-white/15 p-5 sm:p-6">
        <p className="text-[17px] leading-relaxed">{thanksText}</p>
        <div className="mt-4">{counter}</div>
        <button
          type="button"
          onClick={() => {
            setDecision("");
            setName("");
            setNamed(false);
            setDone(false);
          }}
          className="mt-5 text-[12px] uppercase tracking-[0.22em] text-[var(--pnc-muted)] underline underline-offset-4 hover:text-[var(--pnc-fg)]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 ref={heading} tabIndex={-1} id="decision-question" className="text-3xl leading-tight outline-none sm:text-4xl">{question}</h1>
      <label className="block">
        <span className="sr-only">Your decision</span>
        <textarea
          required
          aria-describedby="decision-question"
          rows={6}
          maxLength={DECISION_MAX}
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="mt-4 w-full resize-y border border-white/25 bg-transparent px-3 py-3 text-[17px] leading-relaxed outline-none placeholder:text-white/30 focus:border-[var(--pnc-accent)]"
        />
      </label>

      {/* Only appears once the cap is close, so it never reads as a target. */}
      {remaining <= 100 ? (
        <p className="mt-2 text-right text-[12px] text-[var(--pnc-muted)]">
          {remaining} character{remaining === 1 ? "" : "s"} left
        </p>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={named}
          onChange={(event) => setNamed(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--pnc-accent)]"
        />
        <span className="text-[15px] leading-snug">
          {namePrompt}
          <span className="mt-1 block text-[13px] text-[var(--pnc-muted)]">
            {named ? "We'll read your name out with it." : "You'll stay anonymous."}
          </span>
        </span>
      </label>

      {named ? (
        <input
          type="text"
          maxLength={NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="mt-3 w-full border border-white/25 bg-transparent px-3 py-2.5 text-[16px] outline-none placeholder:text-white/30 focus:border-[var(--pnc-accent)]"
        />
      ) : null}

      {/* Honeypot — hidden from people, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy || !decision.trim()}
        className="mt-5 block w-full bg-[var(--pnc-fg)] px-5 py-3.5 text-center text-[13px] uppercase tracking-[0.22em] text-[var(--pnc-bg)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Sending…" : submitLabel}
      </button>

      {error ? <p className="mt-3 text-[13px] text-[var(--pnc-accent)]">{error}</p> : null}

      {formNote ? (
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--pnc-muted)]">{formNote}</p>
      ) : null}
      {texting ? <div className="mt-2">{texting}</div> : null}
      <div className="mt-3">{counter}</div>
    </form>
  );
}
