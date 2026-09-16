"use client";

import { useState, type ReactNode } from "react";
import type { AiHint } from "@/lib/writer";
import { splitList } from "@/lib/writer";
import { writeField } from "./write-client";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 rounded-lg border border-neutral-800 bg-neutral-950">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-neutral-200">
          {title}
        </h2>
        {hint ? <p className="mt-1 text-[12px] text-neutral-500">{hint}</p> : null}
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-4 p-4">{children}</div>
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
    <span className={`${bare ? "" : "mb-1.5 "}block text-[11px] uppercase tracking-[0.14em] text-neutral-400`}>
      {children}
      {hint ? <span className="ml-2 normal-case tracking-normal text-neutral-600">{hint}</span> : null}
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
      {error ? <span className="max-w-[240px] truncate text-[11px] normal-case tracking-normal text-red-400" title={error}>{error}</span> : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title={hint.image ? "Look at the picture and write this" : "Write this for search and AI answer engines"}
        className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] normal-case tracking-normal text-neutral-300 transition-colors hover:border-neutral-400 hover:text-white disabled:cursor-wait disabled:opacity-50"
      >
        {busy ? "Writing…" : current.trim() ? "✦ Rewrite" : "✦ Write"}
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
    <span className="mb-1.5 flex items-start justify-between gap-3">
      <Label hint={hint} bare>
        {label}
      </Label>
      <WriteButton hint={ai} current={current} onWrite={onWrite} />
    </span>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-[14px] text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-neutral-400";

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
    <label className="block">
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
    <label className="block">
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <Label>
        {label}
        <span className="ml-2 text-neutral-500">
          {value}
          {suffix ?? ""}
        </span>
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="h-1 w-full accent-white"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[13px] text-neutral-100 outline-none focus:border-neutral-400"
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
    <label className="block">
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
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5">
      <span>
        <span className="block text-[13px] text-neutral-200">{label}</span>
        {hint ? <span className="block text-[11px] text-neutral-500">{hint}</span> : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-white" : "bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
            value ? "left-[18px] bg-black" : "left-0.5 bg-neutral-300"
          }`}
        />
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
    <label className="block">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-12 cursor-pointer rounded border border-neutral-700 bg-neutral-900"
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

export function Button({
  children,
  onClick,
  tone = "default",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "ghost" | "danger" | "primary";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const tones = {
    default: "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500",
    ghost: "border-transparent bg-transparent text-neutral-400 hover:text-neutral-100",
    danger: "border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-600",
    primary: "border-white bg-white text-black hover:bg-neutral-200",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group min-w-0 rounded-lg border border-neutral-800 bg-neutral-950 open:bg-neutral-900/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-[14px] text-neutral-100">{title || "Untitled"}</span>
          {subtitle ? (
            <span className="block truncate text-[11px] text-neutral-500">{subtitle}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {actions}
          <span className="text-[11px] text-neutral-500">Details</span>
        </span>
      </summary>
      <div className="grid min-w-0 grid-cols-1 gap-4 border-t border-neutral-800 p-4">{children}</div>
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
    <label className="block">
      <Head
        label={label}
        hint={hint ?? "comma separated"}
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
