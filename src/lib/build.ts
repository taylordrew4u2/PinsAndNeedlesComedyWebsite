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

/**
 * Whether the live screen can reload without the room noticing: the drink
 * menu is up, or nothing is on screen at all. Never with a question up, a
 * performer's name, the explainer or a set running.
 */
export function quietScreen(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const value = data as { menu?: unknown; question?: unknown; performer?: unknown; explainer?: unknown; segment?: unknown };
  if (value.menu === true) return true;
  return !value.question && !value.performer && !value.explainer && !value.segment;
}
