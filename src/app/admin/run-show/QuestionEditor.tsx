"use client";

import { useState } from "react";
import { DECISION_MAX, NAME_MAX } from "@/lib/decisions";
import { isEdited, originalOf, type QuestionChange } from "@/lib/questions";
import type { Submission } from "@/lib/types";

type Props = {
  question: Submission;
  /** It is on the live screen now, so saving changes what the room sees. */
  live?: boolean;
  busy: boolean;
  save: (change: QuestionChange) => Promise<boolean>;
  close: () => void;
};

/**
 * Fix a question before or while it is on screen: a typo, a ramble trimmed,
 * the name changed or taken off. Whatever is typed here goes through the same
 * cleaning as the public form. The sender's own words are kept on the server,
 * so "Revert to original" is always one press away.
 */
export default function QuestionEditor({ question, live = false, busy, save, close }: Props) {
  // Starts from what is saved; a poll arriving mid-edit never overwrites the typing.
  const [decision, setDecision] = useState(question.decision);
  const [name, setName] = useState(question.name);
  const original = originalOf(question);
  const edited = isEdited(question);
  const changed = decision.trim() !== question.decision.trim() || name.trim() !== question.name.trim();
  const ready = changed && Boolean(decision.trim());
  const field = `edit-${question.id}`;

  const submit = async (change: QuestionChange) => {
    if (await save(change)) close();
  };

  return (
    <form
      className="mt-3 space-y-2 rounded-md border border-sky-400/50 bg-sky-950/20 p-3 text-left"
      aria-label="Edit question"
      onSubmit={(event) => { event.preventDefault(); if (ready) void submit({ decision, name }); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
    >
      <label htmlFor={`${field}-text`} className="block text-xs text-neutral-400">Question</label>
      <textarea
        id={`${field}-text`}
        value={decision}
        onChange={(event) => setDecision(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/Cmd+Enter saves; a plain Enter is a new line, as people write them.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
        }}
        rows={4}
        maxLength={DECISION_MAX}
        autoFocus
        className="w-full resize-y rounded-md border border-white/30 bg-black px-3 py-2 text-base leading-relaxed text-white"
      />
      <p className="flex justify-between gap-2 text-xs text-neutral-500">
        <span className={decision.trim() ? "" : "text-amber-200"}>{decision.trim() ? "" : "A question can't be empty. Cancel to keep it as it was."}</span>
        <span aria-live="polite">{decision.length}/{DECISION_MAX}</span>
      </p>
      <label htmlFor={`${field}-name`} className="block text-xs text-neutral-400">Name on screen</label>
      <input
        id={`${field}-name`}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={NAME_MAX}
        placeholder="Empty means no name on screen"
        className="w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
      />
      {edited ? (
        <p className="whitespace-pre-wrap break-words text-xs text-neutral-500">
          They sent: &ldquo;{original.decision}&rdquo;{original.name ? ` — ${original.name}` : " (no name)"}
        </p>
      ) : null}
      {live ? <p className="text-xs text-amber-200">This is on the live screen. Saving changes it there within a few seconds.</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={busy || !ready} className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button>
        <button type="button" onClick={close} className="rounded-md border border-white/30 px-4 py-2 text-sm">Cancel</button>
        {edited ? (
          <button type="button" onClick={() => void submit({ revert: true })} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">
            Revert to original
          </button>
        ) : null}
      </div>
    </form>
  );
}
