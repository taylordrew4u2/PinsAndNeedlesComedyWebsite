import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchWithin } from "../src/lib/fetch-within.ts";

/** A server that answers /ok at once, never answers /hang, and stalls /slow-body after the headers. */
async function serve(): Promise<{ url: string; server: Server }> {
  const server = createServer((request, response) => {
    if (request.url === "/ok") { response.end('{"ok":true}'); return; }
    if (request.url === "/slow-body") { response.writeHead(200); response.write('{"ok":'); return; }
    // /hang: say nothing at all.
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

test("fetchWithin: an answer comes back with its body", async () => {
  const { url, server } = await serve();
  try {
    const { response, text } = await fetchWithin(`${url}/ok`, {}, 2_000);
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(text), { ok: true });
  } finally { server.closeAllConnections(); server.close(); }
});

test("fetchWithin: a request that never answers, or a body that stalls, is given up instead of waiting forever", async () => {
  const { url, server } = await serve();
  try {
    for (const path of ["/hang", "/slow-body"]) {
      const started = Date.now();
      await assert.rejects(fetchWithin(`${url}${path}`, {}, 300));
      assert.ok(Date.now() - started < 2_000, `${path} gave up in time`);
    }
  } finally { server.closeAllConnections(); server.close(); }
});

test("fetchWithin: the outer signal aborts it too", async () => {
  const { url, server } = await serve();
  try {
    const outer = new AbortController();
    const pending = fetchWithin(`${url}/hang`, {}, 10_000, outer.signal);
    setTimeout(() => outer.abort(), 50);
    await assert.rejects(pending);
  } finally { server.closeAllConnections(); server.close(); }
});
