"use client";

import { QUESTIONS_MAX, SET_MINUTES_MAX, SET_MINUTES_MIN, clockText, parseTiming, scheduleText, type SetTiming } from "@/lib/segment";

const MINUTES = Array.from({ length: SET_MINUTES_MAX - SET_MINUTES_MIN + 1 }, (_, i) => SET_MINUTES_MIN + i);
const QUESTIONS = Array.from({ length: QUESTIONS_MAX }, (_, i) => i + 1);
/** How long the name can hold the screen: none, quarter minutes to a minute, then half minutes to five. */
const NAME_CHOICES = [0, 15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300].map((seconds) => seconds * 1_000);

type Props = {
  /** Keeps the labels of two editors on one page apart. */
  id: string;
  value: SetTiming;
  onChange: (next: SetTiming) => void;
  disabled?: boolean;
};

/**
 * A set's timing as three dropdowns: how long it runs, how long the name is
 * up first, and how many questions share the rest. Dropdowns, so nothing can
 * be typed that the server would refuse. Under them, when each question goes
 * up; or, when the mix leaves a question less than 30 seconds, what to change.
 */
export default function TimingFields({ id, value, onChange, disabled = false }: Props) {
  const valid = parseTiming(value) !== null;
  // A saved name time that is not one of the choices still shows as itself.
  const names = NAME_CHOICES.includes(value.nameMs) ? NAME_CHOICES : [...NAME_CHOICES, value.nameMs].sort((a, b) => a - b);
  const select = "mt-1 block rounded-md border border-white/30 bg-black px-2 py-1.5 text-sm text-white disabled:opacity-50";
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-3">
        <label htmlFor={`${id}-length`} className="text-xs text-neutral-400">
          Set length
          <select id={`${id}-length`} value={value.setMs} onChange={(event) => onChange({ ...value, setMs: Number(event.target.value) })} disabled={disabled} className={select}>
            {MINUTES.map((minutes) => <option key={minutes} value={minutes * 60_000}>{minutes} min</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-name`} className="text-xs text-neutral-400">
          Name on screen
          <select id={`${id}-name`} value={value.nameMs} onChange={(event) => onChange({ ...value, nameMs: Number(event.target.value) })} disabled={disabled} className={select}>
            {names.map((ms) => <option key={ms} value={ms}>{ms ? clockText(ms) : "No name"}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-questions`} className="text-xs text-neutral-400">
          Questions
          <select id={`${id}-questions`} value={value.questions} onChange={(event) => onChange({ ...value, questions: Number(event.target.value) })} disabled={disabled} className={select}>
            {QUESTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      </div>
      <p className={`mt-2 text-xs ${valid ? "text-neutral-400" : "text-amber-200"}`} aria-live="polite">
        {valid ? scheduleText(value) : "Too tight: each question needs at least 30 seconds. Make the set longer, the name shorter, or ask fewer questions."}
      </p>
    </div>
  );
}
