"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Content } from "@/lib/types";
import { fillEmpty, suggestFor } from "./suggest";
import type { Update } from "./types";
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

const TABS = [
  { id: "home", label: "Home" },
  { id: "reels", label: "Reels" },
  { id: "shows", label: "Shows" },
  { id: "weekly", label: "Bad Decisions" },
  { id: "news", label: "News" },
  { id: "shop", label: "Shop" },
  { id: "hall", label: "Hall of Fame" },
  { id: "about", label: "About Us" },
  { id: "contact", label: "Contact" },
  { id: "site", label: "Site & SEO" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 700;

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
  const [tab, setTab] = useState<TabId>("home");
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState("");

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
      ? { text: "Saving…", tone: "text-amber-400" }
      : save === "error"
        ? { text: error || "Save failed — retrying", tone: "text-red-400" }
        : save === "saved"
          ? { text: "Saved", tone: "text-emerald-400" }
          : { text: "Up to date", tone: "text-neutral-500" };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] font-semibold uppercase tracking-[0.18em]">
              Pins &amp; Needles admin
            </span>
            <span className={`text-[12px] ${status.tone}`}>{status.text}</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <a href="/admin/run-show" className="rounded-md bg-white px-3 py-2 text-[12px] font-semibold text-black">Run Show</a>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 underline underline-offset-4 hover:text-white"
            >
              View site
            </a>
            <button onClick={logout} className="text-neutral-400 hover:text-white">
              Log out
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 pb-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                tab === entry.id
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {warning ? (
          <p className="mb-4 rounded-md border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-[12px] leading-relaxed text-amber-200">
            <span className="font-semibold">Saving is not set up yet. </span>
            {warning}
          </p>
        ) : null}

        <p className="mb-6 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-[12px] leading-relaxed text-neutral-400">
          Everything on this page saves itself a moment after you stop typing — there is no save
          button. SEO and AI-SEO fields come prefilled with suggestions; edit any of them.
        </p>

        {tab === "home" ? <HomeTab content={content} update={update} /> : null}
        {tab === "reels" ? <ReelsTab content={content} update={update} refresh={refresh} /> : null}
        {tab === "shows" ? <ShowsTab content={content} update={update} /> : null}
        {tab === "weekly" ? <WeeklyTab content={content} update={update} /> : null}
        {tab === "news" ? <NewsTab content={content} update={update} /> : null}
        {tab === "shop" ? <ShopTab content={content} update={update} /> : null}
        {tab === "hall" ? <HallOfFameTab content={content} update={update} /> : null}
        {tab === "about" ? <AboutTab content={content} update={update} /> : null}
        {tab === "contact" ? <ContactTab content={content} update={update} /> : null}
        {tab === "site" ? <SiteTab content={content} update={update} /> : null}
      </main>
    </div>
  );
}
