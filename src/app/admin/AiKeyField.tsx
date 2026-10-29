"use client";
import { useEffect, useState } from "react";
import type { AiKeyStatus } from "@/lib/ai-key";
import { Button, Note } from "./ui";

const API = "/api/admin/ai-key";

/**
 * Where the host pastes the Anthropic API key the blog and post writer use.
 * The key is checked with Anthropic before it is saved, saved locked away on
 * the server, and never shown again: only its last four characters, so the
 * host can tell which key is in use.
 */
export default function AiKeyField() {
  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"" | "saving" | "removing">("");
  const [result, setResult] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(API, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active && data?.ok) setStatus(data.status); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const send = async (method: "POST" | "DELETE", done: string, replace = false) => {
    setBusy(method === "POST" ? "saving" : "removing");
    setResult(null);
    try {
      const response = await fetch(API, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ key, replace }) : undefined,
      });
      const data = await response.json().catch(() => null);
      // A key another server saved is in the way: replacing it is the host's call.
      if (response.status === 409 && data?.confirm && !replace) {
        setBusy("");
        if (window.confirm(`${data.error} Replace it?`)) await send(method, done, true);
        return;
      }
      if (!response.ok || !data?.ok) {
        setResult({ tone: "bad", text: data?.error || "That didn’t work. Try again." });
        return;
      }
      setStatus(data.status);
      setKey("");
      setResult({ tone: "good", text: done });
    } catch {
      setResult({ tone: "bad", text: "Couldn’t reach the site. Check the connection and try again." });
    } finally {
      setBusy("");
    }
  };

  const remove = () => {
    if (!window.confirm("Remove the key saved here? The AI writer goes back to the server’s key, or stops if there isn’t one. If the key might have leaked, also delete it at console.anthropic.com: removing it here doesn’t stop the key working.")) return;
    void send("DELETE", "✓ Removed. Every part of the site stops using it within a few seconds.");
  };

  const ollama = status?.provider === "ollama";
  const now = !status
    ? "Checking which key is in use…"
    : ollama
      ? "This server’s AI writer runs on an Ollama server (OLLAMA_URL), so it doesn’t use an Anthropic key. A key saved here is used wherever Anthropic answers instead."
      : status.source === "admin"
      ? `✓ Using the key you saved here, ending in …${status.hint}${status.savedAt ? `, saved ${new Date(status.savedAt).toLocaleDateString()}` : ""}.`
      : status.source === "server"
        ? `Using the key set on the server${status.hint ? `, ending in …${status.hint}` : ""}. Paste one here to use yours instead.`
        : "No key yet, so the AI writer is off until you add one.";

  return (
    <div className="grid gap-3">
      <p className={`text-sm ${status?.source === "admin" && !ollama ? "text-emerald-300" : "text-neutral-300"}`}>{now}</p>
      {status?.unreadable ? (
        <Note tone="warn">A key is saved here that this server can’t open: it was saved by a server with a different ADMIN_SECRET, or before this one’s changed. Paste the key again, or remove it.</Note>
      ) : null}
      <label className="block min-w-0">
        <span className="mb-1 block text-sm text-neutral-300">Anthropic API key</span>
        <input
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white placeholder:text-neutral-600"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          placeholder="sk-ant-…"
          onChange={(event) => { setKey(event.target.value); setResult(null); }}
        />
        <span className="mt-1 block text-xs text-neutral-500">From console.anthropic.com → API keys. It’s checked with Anthropic before it’s saved, and never shown again.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" onClick={() => void send("POST", ollama ? "✓ Saved, and Anthropic says it works. It’s used wherever Anthropic answers the AI writer." : "✓ Saved, and Anthropic says it works. The AI writer uses it from now on.")} disabled={!key.trim() || Boolean(busy)}>
          {busy === "saving" ? "Checking with Anthropic…" : "Save key"}
        </Button>
        {status?.source === "admin" || status?.unreadable ? (
          <Button tone="ghost" onClick={remove} disabled={Boolean(busy)}>{busy === "removing" ? "Removing…" : "Remove saved key"}</Button>
        ) : null}
      </div>
      {result ? <Note tone={result.tone}>{result.text}</Note> : null}
    </div>
  );
}
