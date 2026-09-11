import type { Submission } from "./types";

export type LiveSelection = { submissionId: string; question: string };

/** Store only the question explicitly chosen by the host, never the full pile. */
export function selectionFor(submission: Submission): LiveSelection | null {
  if (submission.status === "archived") return null;
  return { submissionId: submission.id, question: submission.decision };
}

export function parseSelection(raw: unknown): LiveSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LiveSelection>;
  if (typeof value.submissionId !== "string" || !/^[A-Za-z0-9-]+$/.test(value.submissionId)) return null;
  if (typeof value.question !== "string" || !value.question.trim()) return null;
  return { submissionId: value.submissionId, question: value.question };
}

/** The public projection cannot disclose names, ids, timestamps, or other submissions. */
export function publicSelection(selection: LiveSelection | null): { question: string | null } {
  return { question: selection?.question ?? null };
}
