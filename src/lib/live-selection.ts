import type { Submission } from "./types";

/**
 * What the projector shows. `name` is empty unless the sender ticked "Put my
 * name on it": the form only ever stores a name when they did, so a name here
 * is one its owner asked to see on screen.
 */
export type LiveSelection = { submissionId: string; question: string; name: string };

/** Store only the question explicitly chosen by the host, never the full pile. */
export function selectionFor(submission: Submission): LiveSelection | null {
  if (submission.status === "archived") return null;
  return { submissionId: submission.id, question: submission.decision, name: submission.name.trim() };
}

export function parseSelection(raw: unknown): LiveSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LiveSelection>;
  if (typeof value.submissionId !== "string" || !/^[A-Za-z0-9-]+$/.test(value.submissionId)) return null;
  if (typeof value.question !== "string" || !value.question.trim()) return null;
  // Selections saved before names were shown have none: they stay anonymous.
  const name = typeof value.name === "string" ? value.name.trim() : "";
  return { submissionId: value.submissionId, question: value.question, name };
}

/**
 * The public projection: the chosen question, and its sender's name only when
 * they asked to be named. Never ids, timestamps, or other submissions.
 */
export function publicSelection(selection: LiveSelection | null): { question: string | null; name: string | null } {
  return { question: selection?.question ?? null, name: selection?.name || null };
}
