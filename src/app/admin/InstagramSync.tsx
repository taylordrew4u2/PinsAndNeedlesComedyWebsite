"use client";

import { useEffect, useState } from "react";
import type { InstagramSync as InstagramSyncState } from "@/lib/types";
import { Button, More, Note, Section, Steps, Text } from "./ui";

/** Safety valve only — forward progress each call means this almost never gets close. */
const MAX_ROUNDS = 60;
const DELAY_MS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatWhen(iso: string): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/** Read ?instagram=connected|error once, then scrub it so a refresh doesn't re-show the banner. */
function useOAuthResult() {
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  // Reads the OAuth result Instagram put in the query string, then wipes it
  // from the address bar. It has to be an effect: this component renders on
  // the server too, where there is no window to read, and a lazy initialiser
  // would hydrate to a different value.
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("instagram");
    if (!status) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult({ status, message: url.searchParams.get("message") || "" });
    url.searchParams.delete("instagram");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return result;
}

export default function InstagramSync({
  instagram,
  totalReels,
  onTokenChange,
  onSynced,
}: {
  instagram: InstagramSyncState;
  totalReels: number;
  onTokenChange: (token: string) => void;
  onSynced: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [roundError, setRoundError] = useState("");
  const oauthResult = useOAuthResult();

  // Instagram just redirected back — the token is already saved server-side,
  // so this is the same "reload, don't autosave a stale snapshot" rule the
  // sync button follows below.
  useEffect(() => {
    if (oauthResult?.status === "connected") void onSynced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthResult]);

  const runFullSync = async () => {
    setRunning(true);
    setRoundError("");
    setProgress(0);
    try {
      let added = 0;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const response = await fetch("/api/admin/instagram/sync", { method: "POST" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Sync failed");

        added += data.added ?? 0;
        setProgress(added);

        if (data.caughtUp && !data.remaining) break;
        await sleep(DELAY_MS);
      }
    } catch (error) {
      setRoundError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      await onSynced();
      setRunning(false);
    }
  };

  const connected = Boolean(instagram.accessToken);

  return (
    <Section
      icon="📲"
      title="Pull reels in from Instagram"
      hint="Connect once, then one tap grabs every reel from @pinsandneedlescomedy."
    >
      {oauthResult?.status === "connected" ? (
        <Note tone="good">
          Instagram is connected. Now tap <strong>Get my reels from Instagram</strong>.
        </Note>
      ) : null}
      {oauthResult?.status === "error" ? (
        <Note tone="bad">{oauthResult.message || "Connecting to Instagram failed."}</Note>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          size="big"
          tone={connected ? "default" : "primary"}
          onClick={() => {
            // Resolved against the current origin: assigning a bare relative
            // path is ambiguous, and this one starts an OAuth redirect.
            window.location.assign(new URL("/api/admin/instagram/authorize", window.location.origin));
          }}
        >
          {connected ? "🔗 Reconnect Instagram" : "🔗 Connect Instagram"}
        </Button>
        <Button
          size="big"
          tone={connected ? "primary" : "default"}
          onClick={() => void runFullSync()}
          disabled={running || !connected}
        >
          {running ? `Getting reels… ${progress ? `(${progress} so far)` : ""}` : "⬇️ Get my reels from Instagram"}
        </Button>
      </div>
      {roundError ? <Note tone="bad">{roundError}</Note> : null}

      <Note>
        <span className="font-medium text-neutral-100">{connected ? "Connected ✓" : "Not connected yet"}</span>
        {" · "}
        {totalReels} reel{totalReels === 1 ? "" : "s"} on the site
        {" · "}last pulled {formatWhen(instagram.lastSyncedAt)}
        {instagram.lastError ? (
          <span className="mt-1 block text-red-300">Last problem: {instagram.lastError}</span>
        ) : null}
        <span className="mt-1 block text-neutral-500">
          Safe to tap any time — it only adds reels it hasn&apos;t seen, and never touches ones
          you&apos;ve reordered or hidden.
        </span>
      </Note>

      <More
        title="One-time setup on Instagram's side"
        hint="Only needed the very first time, or if connecting fails"
      >
        <p className="text-[14px] leading-relaxed text-neutral-300">
          Meta requires this — there is no way around it for anyone. It is how Instagram confirms
          the account owner approved the connection:
        </p>
        <Steps>
          <li>
            Switch the Instagram account to Professional (Business or Creator) — free, in the
            Instagram app under Settings → Account type.
          </li>
          <li>
            Create a free app at{" "}
            <a
              href="https://developers.facebook.com/docs/instagram-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-white"
            >
              developers.facebook.com
            </a>
            , add the Instagram product to it, and add an OAuth redirect URI of{" "}
            <code className="text-neutral-100">{"<your site>"}/api/admin/instagram/callback</code>.
          </li>
          <li>
            Add the Instagram account as a tester on that app — the app can stay in Development
            mode, no review needed for one account.
          </li>
          <li>
            Copy the app&apos;s <strong>App ID</strong> and <strong>App Secret</strong> into this
            deployment&apos;s environment variables as{" "}
            <code className="text-neutral-100">INSTAGRAM_APP_ID</code> and{" "}
            <code className="text-neutral-100">INSTAGRAM_APP_SECRET</code>, then redeploy.
          </li>
        </Steps>
        <p className="text-[14px] leading-relaxed text-neutral-300">
          After that, connecting is one tap above — a real Instagram login and approval screen,
          not a token to copy anywhere. It refreshes itself before its ~60-day expiry.
        </p>
        <Text
          label="Access token (advanced)"
          type="password"
          value={instagram.accessToken}
          onChange={onTokenChange}
          hint="Only if you generated one directly in Meta's console instead of using the Connect button."
        />
      </More>
    </Section>
  );
}
