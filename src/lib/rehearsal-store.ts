import "server-only";
import { isAuthed } from "./auth";
import { submissionWindow, type SubmissionWindow } from "./decisions";
import { readRecord, writeRecord } from "./live-store";
import { parseRehearsal, withRehearsal, type Rehearsal } from "./rehearsal";
import type { Show, WeeklyPage } from "./types";

const KEY = "live-show/rehearsal.json";

/**
 * Every phone on the QR page polls the window, so the record is held for a
 * few seconds rather than read on every request. Starting or finishing on
 * another instance shows up here within that time.
 */
const TTL_MS = 5_000;
let cached: { value: Rehearsal | null; at: number } | null = null;

export async function readRehearsal(options: { fresh?: boolean } = {}): Promise<Rehearsal | null> {
  if (!options.fresh && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = parseRehearsal(await readRecord(KEY));
  cached = { value, at: Date.now() };
  return value;
}

export async function writeRehearsal(rehearsal: Rehearsal | null): Promise<void> {
  await writeRecord(KEY, rehearsal, rehearsal ? "Start dress rehearsal" : "Finish dress rehearsal");
  cached = { value: rehearsal, at: Date.now() };
}

/**
 * The window the QR form enforces: the real one, opened by a dress rehearsal
 * when one is running — but only for the host. A rehearsal opens the form on
 * a device signed in to the admin and nowhere else, so a guest who scanned
 * the table QR early still sees the countdown, and nothing a guest sends is
 * ever tagged as a test. Texting in always follows the real window.
 *
 * The record is read only while the real window is shut, so the show itself
 * costs nothing extra. If it cannot be read, the answer is the real window —
 * a storage hiccup must never open the form, or tag a real decision as a test.
 */
export async function submissionGate(
  weekly: WeeklyPage,
  shows: Show[],
  now: Date = new Date()
): Promise<SubmissionWindow & { rehearsal: boolean }> {
  const gate = submissionWindow(weekly, shows, now);
  if (gate.open || !(await isAuthed())) return { ...gate, rehearsal: false };
  let rehearsal: Rehearsal | null = null;
  try {
    rehearsal = await readRehearsal();
  } catch (error) {
    console.error("[rehearsal] read failed; using the real window:", error);
  }
  return withRehearsal(gate, rehearsal, now);
}
