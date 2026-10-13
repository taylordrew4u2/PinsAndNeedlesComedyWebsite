/**
 * Which deployment is running, so a page left open for hours (the TV on the
 * live screen above all) can tell when the site has been updated under it:
 * a browser keeps the code it loaded until it reloads, and new features
 * (the bartender's name, say) never show on a screen still running old code.
 * Empty outside Vercel, which turns the check off.
 */
export function currentBuild(): string {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "";
}

/** A different deployment is answering than the one this page was served by. */
export function isNewerBuild(pageBuild: string, serverBuild: unknown): serverBuild is string {
  return Boolean(pageBuild) && typeof serverBuild === "string" && Boolean(serverBuild) && serverBuild !== pageBuild;
}

/** What a build id may look like when a screen reports one: Vercel deployment ids and commit hashes. */
const BUILD_ID = /^[A-Za-z0-9_.-]{1,100}$/;

export function cleanBuild(raw: unknown): string {
  return typeof raw === "string" && BUILD_ID.test(raw) ? raw : "";
}

type ScreenAnswer = { menu?: unknown; question?: unknown; performer?: unknown; explainer?: unknown; segment?: unknown; message?: unknown };

/**
 * Whether the live screen can reload without the room noticing: the drink
 * menu is up, or nothing is on screen at all. Never with a question up, a
 * performer's name, the explainer, a set running or the host's message up.
 * The explainer and a set's clock are drawn over the drink menu, so they are
 * checked first.
 */
export function quietScreen(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const value = data as ScreenAnswer;
  if (value.explainer || value.segment || value.message) return false;
  if (value.menu === true) return true;
  return !value.question && !value.performer;
}

/**
 * What the room sees, as one string: two answers with the same one show the
 * same thing. The screen only reloads once this has held still for a while,
 * so it never reloads over something that has just gone up.
 */
export function screenSignature(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const value = data as ScreenAnswer & { menuCustom?: unknown };
  return JSON.stringify([value.menu === true, value.menuCustom ? "custom" : "", value.question ?? null, value.performer ?? null,
    value.explainer ?? null, Boolean(value.segment), value.message ?? null]);
}

/** How long the screen must have stayed quiet and unchanged before it reloads itself. */
export const QUIET_BEFORE_RELOAD_MS = 6_000;

/**
 * Whether an out-of-date live screen may reload itself now. Not when a
 * reload would cost something only a person at the TV can give back: full
 * screen (a browser always leaves it on reload, and only a key or click can
 * enter it again) or sound that needed a tap to start (Safari and iPads want
 * a tap on every page). Not while a countdown, intro or the explainer is
 * playing, and only once the screen has been quiet for a while. Once per
 * update: if it is still out of date after reloading, the Control Center
 * says so instead.
 */
export function maySelfReload(check: { tried: boolean; fullscreen: boolean; soundByTap: boolean; busy: boolean; quietForMs: number }): boolean {
  return !check.tried && !check.fullscreen && !check.soundByTap && !check.busy && check.quietForMs >= QUIET_BEFORE_RELOAD_MS;
}

/** A report from a live screen older than this no longer counts: the screen reports again every few minutes while it is out of date. */
export const STALE_REPORT_MS = 12 * 60_000;

/**
 * The newest report from a live screen about its own build, if it says the
 * screen is out of date: what the Control Center needs to tell the host to
 * reload the TV by hand. Null when no screen has reported lately, or the last
 * one to report was up to date.
 */
export function staleScreen(raw: unknown, build: string, now: number): { at: string } | null {
  if (!build || !raw || typeof raw !== "object") return null;
  const value = raw as { build?: unknown; at?: unknown };
  const reported = cleanBuild(value.build);
  const at = typeof value.at === "string" ? Date.parse(value.at) : NaN;
  if (!reported || reported === build || Number.isNaN(at)) return null;
  const age = now - at;
  return age >= 0 && age < STALE_REPORT_MS ? { at: value.at as string } : null;
}
