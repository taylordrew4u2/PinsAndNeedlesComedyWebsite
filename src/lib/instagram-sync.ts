import "server-only";
import { getContent, getContentStrict, patchContent, saveUpload } from "./store";
import { downloadAsset, fetchMediaPage, refreshTokenIfNeeded, runInstagramSync } from "./instagram";

export type SyncOutcome =
  | { ok: true; added: number; remaining: number; caughtUp: boolean; totalReels: number }
  | { ok: false; status: number; error: string };

/**
 * One sync step against the stored Instagram token. `onlyIfChanged` skips
 * the write when nothing new turned up, so background syncs on page views
 * don't commit a timestamp to storage every few minutes.
 */
export async function syncInstagram({ onlyIfChanged = false } = {}): Promise<SyncOutcome> {
  let content;
  try {
    content = await getContentStrict();
  } catch {
    return { ok: false, status: 503, error: "Storage is not reachable right now — try again shortly" };
  }

  const ig = content.instagram;
  if (!ig.accessToken) {
    return { ok: false, status: 400, error: "Paste an Instagram access token in first" };
  }

  try {
    const refreshed = await refreshTokenIfNeeded(ig.accessToken, ig.tokenExpiresAt);
    const accessToken = refreshed?.accessToken || ig.accessToken;

    const result = await runInstagramSync(
      { reels: content.reels, cursor: ig.cursor, caughtUp: ig.caughtUp },
      accessToken,
      { fetchMediaPage, downloadAsset, saveUpload }
    );

    const changed =
      Boolean(refreshed) ||
      result.addedCount > 0 ||
      result.cursor !== ig.cursor ||
      result.caughtUp !== ig.caughtUp ||
      result.remaining !== ig.remaining ||
      Boolean(ig.lastError);

    if (!onlyIfChanged || changed) {
      await patchContent({
        reels: result.reels,
        instagram: {
          ...ig,
          ...(refreshed || {}),
          cursor: result.cursor,
          caughtUp: result.caughtUp,
          lastSyncedAt: new Date().toISOString(),
          lastSyncCount: result.addedCount,
          remaining: result.remaining,
          lastError: "",
        },
      });
    }

    return {
      ok: true,
      added: result.addedCount,
      remaining: result.remaining,
      caughtUp: result.caughtUp,
      totalReels: result.reels.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[instagram sync]", error);
    if (!onlyIfChanged || message !== ig.lastError) {
      await patchContent({ instagram: { lastError: message } }).catch(() => {});
    }
    return { ok: false, status: 502, error: message };
  }
}

const AUTO_INTERVAL_MS = 10 * 60 * 1000;
let lastAutoAttempt = 0;
let running: Promise<SyncOutcome> | null = null;

/**
 * Keeps the reels current without anyone pressing "Sync now": public page
 * views and the daily cron call this, and it checks Instagram at most once
 * every ten minutes per server instance. A new reel lands on the site
 * within minutes of being posted, as long as someone is visiting.
 */
export async function autoSyncInstagram(): Promise<void> {
  if (running || Date.now() - lastAutoAttempt < AUTO_INTERVAL_MS) return;
  lastAutoAttempt = Date.now();

  const ig = (await getContent()).instagram;
  if (!ig.accessToken) return;

  running = syncInstagram({ onlyIfChanged: true });
  try {
    await running;
  } finally {
    running = null;
  }
}
