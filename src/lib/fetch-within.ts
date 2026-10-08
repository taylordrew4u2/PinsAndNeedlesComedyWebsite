/**
 * A request, body and all, given up after `ms`.
 *
 * The live screen and the control center poll one request at a time and skip
 * a turn while the last is still out. A request that never answers — venue
 * wifi dropping a connection without closing it — would otherwise hold that
 * turn forever, and the screen would sit on whatever it last showed until
 * someone reloaded it. Giving up throws, like any failed request, so callers
 * keep what is up and the next poll goes out.
 *
 * `outer` aborts it too, for a page that is leaving.
 */
export async function fetchWithin(url: string, init: RequestInit, ms: number, outer?: AbortSignal): Promise<{ response: Response; text: string }> {
  const request = new AbortController();
  const abort = () => request.abort();
  if (outer?.aborted) abort();
  outer?.addEventListener("abort", abort);
  const timer = setTimeout(abort, ms);
  try {
    const response = await fetch(url, { ...init, signal: request.signal });
    // The body is read inside the time limit as well: a stalled body hangs just like a stalled request.
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", abort);
  }
}
