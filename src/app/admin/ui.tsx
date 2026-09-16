"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AiHint } from "@/lib/writer";
import { splitList } from "@/lib/writer";
import { writeField } from "./write-client";

/**
 * The admin's building blocks.
 *
 * Sized for a comedian on a phone after a show: 16px inputs so iOS does not
 * zoom, tap targets you cannot miss, labels in plain sentences, and help text
 * under the label instead of squeezed beside it. The rule every tab follows
 * with these: the handful of fields someone touches every week sit in the
 * open, and everything else waits behind a <More> — never in the way, never
 * gone.
 */

/** True when "Show everything" is on: every <More> then starts open. */
export const Everything = createContext(false);

export function Section({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-950">
      <header className="border-b border-neutral-800 px-5 py-4">
        <h2 className="flex items-center gap-2.5 text-[19px] font-semibold text-neutral-50">
          {icon ? (
            <span aria-hidden="true" className="text-[22px] leading-none">
              {icon}
            </span>
          ) : null}
          {title}
        </h2>
        {hint ? <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-400">{hint}</p> : null}
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-5 p-5">{children}</div>
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}
    >
      {children}
    </div>
  );
}

export function Label({
  children,
  hint,
  bare,
}: {
  children: ReactNode;
  hint?: string;
  /** No bottom margin — for when the label sits in a row with a button. */
  bare?: boolean;
}) {
  return (
    <span className={`${bare ? "" : "mb-2 "}block`}>
      <span className="block text-[15px] font-medium text-neutral-100">{children}</span>
      {hint ? <span className="mt-0.5 block text-[13px] leading-snug text-neutral-500">{hint}</span> : null}
    </span>
  );
}

/**
 * The "write it for me" control on a copy field. Sends what the field is and
 * what it is about to the server, which answers with copy tuned for search
 * and AI answer engines; the result lands in the field like typing would.
 */
export function WriteButton({
  hint,
  current,
  onWrite,
}: {
  hint: AiHint;
  current: string;
  onWrite: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      onWrite(await writeField(hint, current));
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Could not write that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      {error ? (
        <span className="max-w-[200px] truncate text-[12px] text-red-400" title={error}>
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title={hint.image ? "Look at the picture and write this" : "Write this for search and AI answer engines"}
        className="min-h-[36px] rounded-lg border border-neutral-700 px-3 py-1.5 text-[13px] font-medium text-neutral-200 transition-colors hover:border-white hover:text-white disabled:cursor-wait disabled:opacity-50"
      >
        {busy ? "Writing…" : current.trim() ? "✦ Rewrite for me" : "✦ Write it for me"}
      </button>
    </span>
  );
}

/** Label row for a field: the label on the left, the write button on the right when there is one. */
function Head({
  label,
  hint,
  ai,
  current,
  onWrite,
}: {
  label: ReactNode;
  hint?: string;
  ai?: AiHint;
  current: string;
  onWrite: (text: string) => void;
}) {
  if (!ai) return <Label hint={hint}>{label}</Label>;
  return (
    <span className="mb-2 flex items-start justify-between gap-3">
      <Label hint={hint} bare>
        {label}
      </Label>
      <WriteButton hint={ai} current={current} onWrite={onWrite} />
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-[16px] text-neutral-50 outline-none transition-colors placeholder:text-neutral-600 focus:border-white focus:ring-2 focus:ring-white/15";

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  ai,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  /** Adds a Write button that fills the field with search- and AI-tuned copy. */
  ai?: AiHint;
}) {
  return (
    <label className="block min-w-0">
      <Head label={label} hint={hint} ai={ai} current={value} onWrite={onChange} />
      <input
        className={inputClass}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 5,
  placeholder,
  hint,
  ai,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  /** Adds a Write button that fills the field with search- and AI-tuned copy. */
  ai?: AiHint;
}) {
  return (
    <label className="block min-w-0">
      <Head label={label} hint={hint} ai={ai} current={value} onWrite={onChange} />
      <textarea
        className={`${inputClass} resize-y leading-relaxed`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <Label hint={hint}>
        {label}
        <span className="ml-2 font-normal text-neutral-500">
          {value}
          {suffix ?? ""}
        </span>
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="h-1.5 w-full accent-white"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          className="w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-[16px] text-neutral-50 outline-none focus:border-white"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <Label hint={hint}>{label}</Label>
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-neutral-50">{label}</span>
        {hint ? <span className="block text-[13px] leading-snug text-neutral-500">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-[12px] font-medium ${value ? "text-emerald-400" : "text-neutral-500"}`}>
          {value ? "On" : "Off"}
        </span>
        <span
          className={`relative h-7 w-12 rounded-full transition-colors ${
            value ? "bg-emerald-500" : "bg-neutral-700"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              value ? "left-6" : "left-1"
            }`}
          />
        </span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

type Tone = "default" | "ghost" | "danger" | "primary";
type Size = "normal" | "big";

const buttonTones: Record<Tone, string> = {
  default: "border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-neutral-400",
  ghost: "border-transparent bg-transparent text-neutral-400 hover:text-white",
  danger: "border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-500",
  primary: "border-white bg-white text-black hover:bg-neutral-200",
};

const buttonSizes: Record<Size, string> = {
  normal: "min-h-[42px] rounded-lg px-3.5 py-2 text-[14px]",
  big: "min-h-[54px] rounded-xl px-5 py-3 text-[16px]",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function Button({
  children,
  onClick,
  tone = "default",
  size = "normal",
  type = "button",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  size?: Size;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${buttonBase} ${buttonSizes[size]} ${buttonTones[tone]}`}
    >
      {children}
    </button>
  );
}

/** A link that looks like a button — for pages and the public site. */
export function LinkButton({
  href,
  children,
  tone = "default",
  size = "normal",
  external,
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  /** Opens in a new tab. */
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={`${buttonBase} ${buttonSizes[size]} ${buttonTones[tone]}`}
    >
      {children}
    </a>
  );
}

/** A row of small buttons under a thing: move up, move down, delete. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/** Autosave makes a delete final within a second, so every one asks first. */
export function confirmDelete(what: string): boolean {
  return window.confirm(`Delete ${what}? This can't be undone.`);
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "live" | "draft" | "past" | "warn" | "neutral";
}) {
  const tones = {
    live: "border-emerald-800 bg-emerald-950 text-emerald-300",
    draft: "border-amber-800 bg-amber-950 text-amber-300",
    past: "border-neutral-700 bg-neutral-900 text-neutral-400",
    warn: "border-red-800 bg-red-950 text-red-300",
    neutral: "border-neutral-700 bg-neutral-900 text-neutral-300",
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A friendly box of words: what something is, or what just happened. */
export function Note({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "good" | "warn" | "bad";
}) {
  const tones = {
    info: "border-neutral-800 bg-neutral-900 text-neutral-300",
    good: "border-emerald-800/60 bg-emerald-950/40 text-emerald-200",
    warn: "border-amber-800/60 bg-amber-950/40 text-amber-200",
    bad: "border-red-800/60 bg-red-950/40 text-red-200",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Numbered instructions. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="ml-5 list-decimal space-y-1.5 text-[14px] leading-relaxed text-neutral-300">
      {children}
    </ol>
  );
}

/**
 * Where the rarely-touched fields live. Closed by default, so a page shows
 * only what matters most; "Show everything" in the header opens all of them.
 */
export function More({
  title = "More options",
  hint,
  children,
  defaultOpen,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const everything = useContext(Everything);
  const [open, setOpen] = useState(defaultOpen ?? everything);
  return (
    <div className="min-w-0 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/30">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-neutral-200">
            <span aria-hidden="true" className="mr-2 text-neutral-500">
              {open ? "▾" : "▸"}
            </span>
            {title}
          </span>
          {hint ? <span className="block pl-5 text-[13px] leading-snug text-neutral-500">{hint}</span> : null}
        </span>
        <span className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-[12px] text-neutral-400">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="grid min-w-0 grid-cols-1 gap-5 border-t border-neutral-800 p-4">{children}</div>
      ) : null}
    </div>
  );
}

/** One item in a list — a show, a post, a person. Tap the top to open it. */
export function Card({
  title,
  subtitle,
  badge,
  actions,
  children,
  defaultOpen = false,
  highlight = false,
}: {
  title: string;
  subtitle?: string;
  /** A status pill shown at the right of the title. */
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Scroll this card into view when it appears — for "I just made this, show me". */
  highlight?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement | null>(null);
  // Tracked here rather than read off the DOM: a CSS `[open]` ancestor
  // selector would also match an open card wrapped around this one, and
  // the marker must follow this card alone.
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [highlight]);
  return (
    <details
      ref={ref}
      open={open}
      onToggle={(event) => {
        // React bubbles toggle synthetically, so a nested card's toggle
        // lands here too; only this element's own state counts.
        if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
      }}
      className="min-w-0 scroll-mt-44 rounded-xl border border-neutral-800 bg-neutral-950 open:border-neutral-600 open:bg-neutral-900/40"
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={`shrink-0 text-[11px] text-neutral-500 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-medium text-neutral-50">{title || "Untitled"}</span>
            {subtitle ? (
              <span className="block truncate text-[13px] text-neutral-500">{subtitle}</span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          {actions}
        </span>
      </summary>
      <div className="grid min-w-0 grid-cols-1 gap-5 border-t border-neutral-800 p-4">{children}</div>
    </details>
  );
}

export function Tags({
  label,
  value,
  onChange,
  hint,
  ai,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  hint?: string;
  /** Adds a Write button that fills the list with search phrases. */
  ai?: AiHint;
}) {
  return (
    <label className="block min-w-0">
      <Head
        label={label}
        hint={hint ?? "Separate each one with a comma"}
        ai={ai}
        current={value.join(", ")}
        onWrite={(text) => onChange(splitList(text))}
      />
      <input
        className={inputClass}
        value={value.join(", ")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        }
      />
    </label>
  );
}

/** A small heading that groups a few fields inside a panel. */
export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="-mb-2 text-[15px] font-semibold text-neutral-200">{children}</h3>;
}
