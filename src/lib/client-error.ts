/**
 * A crash report from a visitor's browser, cleaned for the log.
 *
 * Phones do not show the developer console, so when a page breaks on one the
 * only trace is what the page sends home. Only what helps find the bug is
 * kept, each part cut short: no cookies, no form contents, no address beyond
 * the path.
 */
export type ClientError = { message: string; stack: string; path: string; source: string; agent: string };

const cut = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

export function cleanReport(raw: unknown, agent: string | null): ClientError | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const message = cut(value.message, 500).trim();
  if (!message) return null;
  const path = cut(value.path, 200);
  return {
    message,
    stack: cut(value.stack, 2000),
    // A path only: anything after ? or # can carry a token or a search.
    path: path.startsWith("/") ? path.split(/[?#]/)[0] : "",
    source: cut(value.source, 40) || "window",
    agent: cut(agent ?? "", 300),
  };
}
