import type { WeeklyPage } from "./types";
import { isPlain } from "./merge.ts";

/**
 * Saving from the main admin without undoing the Control Center.
 *
 * The admin autosaves its whole copy of the content on every edit, and that
 * copy is as old as the tab: a laptop left on /admin since before the show,
 * or a Back to a cached page, still holds the question settings from when it
 * loaded. Meanwhile the host opens and closes questions from the Control
 * Center, which writes the same weekly settings. Sent whole, the admin's copy
 * would put back whatever it loaded on the next edit there, a show title or a
 * typo: questions open again mid-show after "Close questions now", or shut
 * after "Open questions now", with nobody having pressed anything.
 */

/** Written only by the Control Center. The admin has no control for these. */
const HOST_ONLY = ["closedUntil", "closedAt"] as const;

/**
 * Switches both sides flip: "The page is live" and "Keep the form open all
 * the time" here, "Open questions now" and "Close questions now" there.
 */
const SHARED = ["enabled", "alwaysOpen"] as const;

type Shared = Pick<WeeklyPage, (typeof SHARED)[number]>;

/**
 * The body of an admin save: all of `snapshot`, except a shared switch that
 * still reads as it did in `base`, the content as this tab last loaded or
 * saved it. Left out, the stored value stands, so only a switch somebody
 * actually flipped in this tab is written.
 */
export function adminSaveBody<T extends { weekly: Shared }>(
  snapshot: T,
  base: { weekly: Shared }
): Omit<T, "weekly"> & { weekly: Partial<T["weekly"]> } {
  const weekly: Partial<T["weekly"]> = { ...snapshot.weekly };
  for (const key of SHARED) {
    if (snapshot.weekly[key] === base.weekly[key]) delete weekly[key];
  }
  return { ...snapshot, weekly };
}

/**
 * An admin save, made safe to merge over what is stored.
 *
 * The Control Center's close is dropped whatever the save says about it: the
 * tab's copy may well be from before the close. Switching "Keep the form open
 * all the time" on ends a close, the way "Open questions now" does, or the
 * switch would do nothing until the night was over. After adminSaveBody, the
 * switch only arrives as true when it was just switched on.
 */
export function fromAdmin(patch: unknown): unknown {
  if (!isPlain(patch) || !isPlain(patch.weekly)) return patch;
  const weekly: Record<string, unknown> = { ...patch.weekly };
  for (const key of HOST_ONLY) delete weekly[key];
  if (weekly.alwaysOpen === true) weekly.closedUntil = "";
  return { ...patch, weekly };
}
