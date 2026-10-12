import { sanitizeSubmission } from "./decisions.ts";
import type { LiveSelection } from "./live-selection.ts";
import type { Lineup } from "./segment.ts";
import type { Submission } from "./types.ts";

/**
 * The host's own changes to questions in the pile: fixing the wording or the
 * name before or while a question is on screen, and finding one in a long
 * waiting list. Pure, so the server and the Control Center agree on them.
 */

const ID = /^[A-Za-z0-9-]{1,80}$/;

/** New words and a name for a question, or back to exactly what was sent. */
export type QuestionChange = { decision: string; name: string } | { revert: true };

/**
 * One edit from the Control Center, cleaned exactly the way the public form
 * cleans a new submission: the same length caps, the same tidying, line
 * breaks kept. An empty name means no name on screen. Null when no question
 * is left after cleaning, or the id is not one of ours.
 */
export function parseQuestionEdit(raw: unknown): { submissionId: string; change: QuestionChange } | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.submissionId !== "string" || !ID.test(value.submissionId)) return null;
  if (value.revert === true) return { submissionId: value.submissionId, change: { revert: true } };
  if (typeof value.decision !== "string" || (value.name !== undefined && typeof value.name !== "string")) return null;
  // A name the host types is one they want on screen, the same as a sender
  // ticking "Put my name on it".
  const clean = sanitizeSubmission({ decision: value.decision, name: value.name ?? "", anonymous: false });
  return clean ? { submissionId: value.submissionId, change: clean } : null;
}

/** What the sender sent, whether or not the host has changed it since. */
export function originalOf(submission: Submission): { decision: string; name: string } {
  return {
    decision: submission.originalDecision ?? submission.decision,
    name: submission.originalName ?? submission.name,
  };
}

/** The host has changed the wording or the name. */
export function isEdited(submission: Submission): boolean {
  const original = originalOf(submission);
  return original.decision !== submission.decision || original.name !== submission.name;
}

/**
 * The submission with the host's change applied. The sender's own words are
 * kept beside it from the first edit on, however many edits follow, and are
 * dropped once the question is back to exactly what was sent, so a record
 * nobody changed looks the way it always has.
 */
export function editedSubmission(submission: Submission, change: QuestionChange): Submission {
  const original = originalOf(submission);
  const next = "revert" in change ? original : change;
  const result: Submission = { ...submission, decision: next.decision, name: next.name };
  delete result.originalDecision;
  delete result.originalName;
  if (next.decision === original.decision && next.name === original.name) return result;
  return { ...result, originalDecision: original.decision, originalName: original.name };
}

/**
 * The projector's copy of a question brought up to date after an edit, when
 * it is that question and its words changed. Null when there is nothing to
 * write, so an edit to anything else never touches the screen.
 */
export function selectionAfterEdit(selection: LiveSelection | null, submission: Submission): LiveSelection | null {
  if (!selection || selection.submissionId !== submission.id) return null;
  // The same shape selectionFor gives a question going up.
  const question = submission.decision;
  const name = submission.name.trim();
  if (question === selection.question && name === selection.name) return null;
  return { ...selection, question, name };
}

/**
 * The lineup with every performer-card copy of a question brought up to date,
 * so a slot shows the fix when its turn comes (or now, if it is up). Null when
 * no card holds it, so the lineup is only written when something changed.
 */
export function lineupAfterEdit(lineup: Lineup, submission: Submission): Lineup | null {
  let changed = false;
  const performers = lineup.performers.map((performer) => {
    let touched = false;
    const slots = performer.slots.map((slot) => {
      const next = selectionAfterEdit(slot, submission);
      if (!next) return slot;
      touched = true;
      return next;
    });
    if (!touched) return performer;
    changed = true;
    return { ...performer, slots };
  });
  return changed ? { ...lineup, performers } : null;
}

/** The parts of the Control Center's state an edited question can appear in. */
type Board = {
  submissions: Submission[];
  shown: Submission[];
  archived: Submission[];
  selected: LiveSelection | null;
  lineup: Lineup;
};

/**
 * The Control Center's view with an edited question swapped in wherever it
 * sits: its list, the "On screen" box, and any performer card. The next poll
 * would get there too; this just lets the host see the fix at once.
 */
export function withEdit<T extends Board>(board: T, submission: Submission): T {
  const swap = (list: Submission[]) => list.map((entry) => (entry.id === submission.id ? submission : entry));
  return {
    ...board,
    submissions: swap(board.submissions),
    shown: swap(board.shown),
    archived: swap(board.archived),
    selected: selectionAfterEdit(board.selected, submission) ?? board.selected,
    lineup: lineupAfterEdit(board.lineup, submission) ?? board.lineup,
  };
}

/**
 * The question on the projector as it is stored, so its editor can offer the
 * sender's original words. Built from the screen's own copy when it sits in
 * none of the lists, which still lets the host fix what the room is reading.
 */
export function onScreenQuestion(selection: LiveSelection | null, lists: Submission[][]): Submission | null {
  if (!selection) return null;
  for (const list of lists) {
    const found = list.find((entry) => entry.id === selection.submissionId);
    if (found) return found;
  }
  return { id: selection.submissionId, decision: selection.question, name: selection.name, createdAt: "", status: "open", drawnAt: "" };
}

/** Longest search the box takes: anything longer is not looking for one question. */
export const SEARCH_MAX = 60;

/**
 * Whether a question matches what the host typed in the search box. Every
 * word has to appear somewhere in the question or the name, in any order and
 * any case, so "ex text" finds "Should I text my ex?". An empty search
 * matches everything.
 */
export function matchesSearch(submission: Pick<Submission, "decision" | "name">, query: string): boolean {
  const words = query.slice(0, SEARCH_MAX).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = `${submission.decision} ${submission.name}`.toLowerCase();
  return words.every((word) => text.includes(word));
}
