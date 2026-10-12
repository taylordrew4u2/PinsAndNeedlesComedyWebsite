"use client";

import { SEARCH_MAX } from "@/lib/questions";

/** Below this many waiting questions the list fits on screen and a search box is only clutter. */
const SHOW_FROM = 6;

/**
 * Find one question in a long waiting list: by a word of it, or by the name
 * on it. Only narrows what this page lists; Draw one still draws from the
 * whole pile.
 */
export default function QuestionSearch({ value, onChange, total, matching }: {
  value: string;
  onChange: (value: string) => void;
  /** Questions waiting, and how many of them match what is typed. */
  total: number;
  matching: number;
}) {
  if (total < SHOW_FROM && !value) return null;
  const typed = value.trim();
  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <label htmlFor="question-search" className="sr-only">Search waiting questions</label>
        <input
          id="question-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") onChange(""); }}
          maxLength={SEARCH_MAX}
          placeholder="🔍 Search waiting questions or names"
          className="min-w-0 flex-1 rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        />
        {value ? <button type="button" onClick={() => onChange("")} className="rounded-md border border-white/30 px-3 py-2 text-sm">Clear</button> : null}
      </div>
      {typed ? (
        <p role="status" className="mt-1 text-xs text-neutral-500">
          {matching ? `Showing ${matching} of ${total} waiting.` : `Nothing waiting matches “${typed}”.`}
        </p>
      ) : null}
    </div>
  );
}
