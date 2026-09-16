"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Content } from "@/lib/types";
import { fillEmpty, suggestFor } from "./suggest";
import { TABS, type Go, type TabId } from "./tabs";
import type { Update } from "./types";
import { Everything, Note } from "./ui";
import StartTab from "./tabs/StartTab";
import SiteTab from "./tabs/SiteTab";
import HomeTab from "./tabs/HomeTab";
import ReelsTab from "./tabs/ReelsTab";
import NewsTab from "./tabs/NewsTab";
import ShowsTab from "./tabs/ShowsTab";
import WeeklyTab from "./tabs/WeeklyTab";
import ShopTab from "./tabs/ShopTab";
import HallOfFameTab from "./tabs/HallOfFameTab";
import AboutTab from "./tabs/AboutTab";
import ContactTab from "./tabs/ContactTab";

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 700;

/**
 * "Show everything" lives in this browser, not in the content: it is a
 * preference of whoever is holding the phone, and it must not follow them
 * onto the other producer's screen. Read through useSyncExternalStore so the
 * server render (always off) and the first client render agree.
 */
const EVERYTHING_KEY = "pnc-admin-everything";

function subscribeEverything(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVERYTHING_KEY, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVERYTHING_KEY, callback);
  };
}

function readEverything(): boolean {
  try {
    return window.localStorage.getItem(EVERYTHING_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEverything(value: boolean) {
  try {
    window.localStorage.setItem(EVERYTHING_KEY, value ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the switch still works for this page load.
  }
  window.dispatchEvent(new Event(EVERYTHING_KEY));
}

/** Prefill every empty SEO field with a suggestion, exactly once per load. */
function prefillSeo(content: Content): Content {
  const next = structuredClone(content);
  next.site.seo = fillEmpty(next.site.seo, suggestFor(next, "site"));
  next.home.seo = fillEmpty(next.home.seo, suggestFor(next, "home"));
  next.news.seo = fillEmpty(next.news.seo, suggestFor(next, "news"));
  next.showsPage.seo = fillEmpty(next.showsPage.seo, suggestFor(next, "shows"));
  next.shop.seo = fillEmpty(next.shop.seo, suggestFor(next, "shop"));
  next.about.seo = fillEmpty(next.about.seo, suggestFor(next, "about"));
  next.contact.seo = fillEmpty(next.contact.seo, suggestFor(next, "contact"));
  next.weekly.seo = fillEmpty(next.weekly.seo, suggestFor(next, "weekly"));
  next.posts = next.posts.map((post) => ({
    ...post,
    seo: fillEmpty(post.seo, suggestFor(next, "post", post)),
  }));
  next.shows = next.shows.map((show) => ({
    ...show,
    seo: fillEmpty(show.seo, suggestFor(next, "show", undefined, show)),
  }));
  return next;
}

export default function AdminApp({
  initial,
  warning,
}: {
  initial: Content;
  warning: string | null;
}) {
  const [content, setContent] = useState<Content>(() => prefillSeo(initial));
  const [tab, setTab] = useState<TabId>("start");
  // The one item the current tab should open and scroll to, if any.
  const [focus, setFocus] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const everything = useSyncExternalStore(subscribeEverything, readEverything, () => false);

  // If prefilling filled anything in, persist it on load so the public pages
  // pick up the suggestions without the user having to touch a field.
  const dirtyRef = useRef(JSON.stringify(content) !== JSON.stringify(initial));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const latestRef = useRef(content);
  // Kept current in an effect rather than during render: a save is always
  // kicked off from a timer or an event, so it never needs this before the
  // commit that set it.
  useEffect(() => {
    latestRef.current = content;
  });

  // The retry below re-enters flush, so it reaches itself through a ref
  // instead of closing over a binding that does not exist yet.
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSave("saving");
    const snapshot = latestRef.current;
    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `Save failed (${response.status})`);
      setSave("saved");
      setError("");
      dirtyRef.current = latestRef.current !== snapshot;
    } catch (saveError) {
      setSave("error");
      setError(saveError instanceof Error ? saveError.message : "Save failed");
      // Try again shortly — a dropped connection should not lose an edit.
      timerRef.current = setTimeout(() => flushRef.current(), 4000);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  // Auto-save: no save button anywhere in this admin.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, flush]);

  // Warn before leaving with an edit still in the debounce window.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (save === "saving" || (dirtyRef.current && save !== "saved")) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [save]);

  const update = useCallback<Update>((mutate) => {
    dirtyRef.current = true;
    setContent((previous) => {
      const draft = structuredClone(previous);
      mutate(draft);
      return draft;
    });
  }, []);

  const go = useCallback<Go>((next, id) => {
    setFocus(id ?? null);
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  };

  /**
   * Reload straight from storage and replace local state with it.
   *
   * The Instagram sync route writes directly to storage on the server, so
   * this browser's in-memory copy is stale the moment a sync finishes. If
   * that stale copy were left to autosave later — the normal flow always
   * sends a full snapshot — it would silently overwrite everything the sync
   * just added. Anything that changes content from outside this component's
   * own state must call this afterward.
   */
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/content", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      dirtyRef.current = false;
      setContent(data.content as Content);
      setSave("saved");
    }
  }, []);

  const status =
    save === "saving"
      ? { text: "Saving…", tone: "border-amber-800 bg-amber-950 text-amber-300", icon: "●" }
      : save === "error"
        ? { text: "Couldn't save — trying again", tone: "border-red-800 bg-red-950 text-red-300", icon: "⚠" }
        : { text: "Saved", tone: "border-emerald-800 bg-emerald-950 text-emerald-300", icon: "✓" };

  const current = TABS.find((entry) => entry.id === tab) ?? TABS[0];

  return (
    <Everything.Provider value={everything}>
      <div className="min-h-screen bg-neutral-950 text-neutral-200">
        <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go("start")}
                className="text-[14px] font-semibold uppercase tracking-[0.16em] text-neutral-100"
              >
                Pins &amp; Needles
              </button>
              <span
                title={save === "error" ? error : "Everything saves by itself"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${status.tone}`}
              >
                <span aria-hidden="true">{status.icon}</span>
                {status.text}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/admin/run-show"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3.5 text-[14px] font-semibold text-black hover:bg-neutral-200"
              >
                🎲 Run show
              </a>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-neutral-700 px-3.5 text-[14px] text-neutral-200 hover:border-neutral-400"
              >
                See the site
              </a>
              <button
                onClick={logout}
                className="inline-flex min-h-[40px] items-center px-2 text-[14px] text-neutral-400 hover:text-white"
              >
                Log out
              </button>
            </div>
          </div>

          <nav
            aria-label="Sections"
            className="mx-auto flex max-w-4xl gap-1.5 overflow-x-auto px-3 pb-3 sm:flex-wrap"
          >
            {TABS.map((entry) => (
              <button
                key={entry.id}
                onClick={() => go(entry.id)}
                aria-current={tab === entry.id ? "page" : undefined}
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium transition-colors ${
                  tab === entry.id
                    ? "bg-white text-black"
                    : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span aria-hidden="true">{entry.icon}</span>
                {entry.label}
              </button>
            ))}
          </nav>
        </header>

        {/*
          Keyed on the switch so flipping it remounts the page: every <More>
          reads the new default on mount, which is simpler than teaching each
          one to react to a change.
        */}
        <main key={everything ? "everything" : "simple"} className="mx-auto max-w-4xl px-4 py-6">
          {warning ? (
            <div className="mb-4">
              <Note tone="warn">
                <span className="font-semibold">Saving is not set up yet. </span>
                {warning}
              </Note>
            </div>
          ) : null}

          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-semibold text-neutral-50">
                <span aria-hidden="true" className="mr-2">
                  {current.icon}
                </span>
                {current.label}
              </h1>
              <p className="text-[14px] text-neutral-400">{current.blurb}</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-white"
                checked={everything}
                onChange={(event) => writeEverything(event.target.checked)}
              />
              Show everything
              <span className="hidden text-neutral-500 sm:inline">— opens every “More options”</span>
            </label>
          </div>

          {tab === "start" ? <StartTab content={content} update={update} go={go} /> : null}
          {tab === "home" ? <HomeTab content={content} update={update} /> : null}
          {tab === "reels" ? <ReelsTab content={content} update={update} refresh={refresh} /> : null}
          {tab === "shows" ? <ShowsTab content={content} update={update} focus={focus} /> : null}
          {tab === "weekly" ? <WeeklyTab content={content} update={update} /> : null}
          {tab === "news" ? <NewsTab content={content} update={update} focus={focus} /> : null}
          {tab === "shop" ? <ShopTab content={content} update={update} /> : null}
          {tab === "hall" ? <HallOfFameTab content={content} update={update} focus={focus} /> : null}
          {tab === "about" ? <AboutTab content={content} update={update} /> : null}
          {tab === "contact" ? <ContactTab content={content} update={update} /> : null}
          {tab === "site" ? <SiteTab content={content} update={update} /> : null}

          {tab !== "start" ? (
            <p className="mt-8 text-center text-[13px] text-neutral-500">
              No save button needed — everything saves itself a moment after you stop typing.
            </p>
          ) : null}
        </main>
      </div>
    </Everything.Provider>
  );
}
