"use client";

import { useCallback, useEffect, useState } from "react";
import type { Content, Submission, WeeklyPage } from "@/lib/types";
import { aspectValue } from "@/lib/render";
import {
  Actions,
  Area,
  Button,
  Card,
  LinkButton,
  More,
  Note,
  Row,
  Section,
  Select,
  Text,
  Toggle,
} from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";
import { aboutWeekly } from "@/lib/writer";

const WEEKDAYS = (
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
).map((day) => ({ value: day, label: `Every ${day}` }));

export default function WeeklyTab({ content, update }: { content: Content; update: Update }) {
  const weekly = content.weekly;
  const posterAspect = aspectValue(content.showsPage.posterAspect);
  const set = <K extends keyof WeeklyPage>(key: K) => (value: WeeklyPage[K]) =>
    update((d) => void (d.weekly[key] = value));
  const about = aboutWeekly(weekly);
  const ai = (what: string) => ({ what, about });

  return (
    <>
      <Section
        icon="🎲"
        title={weekly.title || "Bad Decisions"}
        hint="The weekly show. Each week's lineup is a show in the Shows tab marked as part of this weekly."
      >
        <Actions>
          <LinkButton size="big" tone="primary" href="/admin/run-show">
            🎲 Run tonight&apos;s show
          </LinkButton>
        </Actions>
        <Toggle
          label="The page is live"
          hint="Off = the QR code goes nowhere and the form stops taking decisions"
          value={weekly.enabled}
          onChange={set("enabled")}
        />
        <Card title="🎟️ Tonight's pile — draw a decision" subtitle="Open this on your phone during the show">
          <StagePanel enabled={weekly.enabled} />
        </Card>
        <Card title="📱 QR code for the tables" subtitle="Download it for flyers and table tents">
          <QrCode />
        </Card>
      </Section>

      <Section
        icon="📍"
        title="When and where"
        hint="The standing details. A night you've published in Shows uses its own time instead."
      >
        <Text label="Name of the show" value={weekly.title} onChange={set("title")} ai={ai("weekly show title")} />
        <Row>
          <Select label="Which night" value={weekly.weekday} options={WEEKDAYS} onChange={set("weekday")} />
          <Text label="Doors open" type="time" value={weekly.doorsTime} onChange={set("doorsTime")} />
          <Text label="Show starts" type="time" value={weekly.startTime} onChange={set("startTime")} />
        </Row>
        <Row>
          <Text label="Venue" value={weekly.venueName} onChange={set("venueName")} />
          <Text label="Price" hint="For example: Free" value={weekly.price} onChange={set("price")} />
          <Text label="Age" hint="For example: 21+" value={weekly.ageRestriction} onChange={set("ageRestriction")} />
        </Row>

        <More title="Address, map and venue website">
          <Text label="Venue website" value={weekly.venueUrl} placeholder="https://" onChange={set("venueUrl")} />
          <Text label="Street address" value={weekly.address} onChange={set("address")} />
          <Row>
            <Text label="City" value={weekly.city} onChange={set("city")} />
            <Text label="State" value={weekly.region} onChange={set("region")} />
            <Text label="ZIP" value={weekly.postalCode} onChange={set("postalCode")} />
          </Row>
          <Text label="Map link" hint="A Google Maps link" value={weekly.mapUrl} placeholder="https://maps.google.com/..." onChange={set("mapUrl")} />
          <Text
            label="Room note"
            hint="Copied onto each night's page — for example: the room is small, come early"
            value={weekly.roomNote}
            onChange={set("roomNote")}
          />
        </More>

        <More title="Tagline and poster">
          <Area label="Tagline" rows={2} value={weekly.tagline} onChange={set("tagline")} ai={ai("weekly show tagline")} />
          <MediaField
            label="Poster"
            hint={`Cropped to ${content.showsPage.posterAspect}, same as show posters`}
            value={weekly.posterUrl}
            onChange={set("posterUrl")}
            aspect={posterAspect}
            previewHeight={180}
          />
          <Text
            label="What the poster shows"
            hint="For Google image search and screen readers"
            value={weekly.posterAlt}
            onChange={set("posterAlt")}
            ai={{ what: "poster alt text", about, image: weekly.posterUrl }}
          />
        </More>
      </Section>

      <div className="mb-6">
        <More title="Words on the submission form" hint="What people see on their phone. Keep every line short.">
          <Text label="The question" value={weekly.question} onChange={set("question")} ai={ai("the question the submission form asks the audience")} />
          <Text label="Grey text inside the box" value={weekly.placeholder} onChange={set("placeholder")} ai={ai("placeholder inside the decision box")} />
          <Text label="The “put my name on it” switch" value={weekly.namePrompt} onChange={set("namePrompt")} ai={ai("label on the toggle to put your name on your decision")} />
          <Area label="Small print under the form" rows={2} value={weekly.formNote} onChange={set("formNote")} ai={ai("small print under the submission form")} />
          <Text label="The send button" value={weekly.submitLabel} onChange={set("submitLabel")} ai={ai("submit button text")} />
          <Area label="What it says after they send" rows={2} value={weekly.thanksText} onChange={set("thanksText")} ai={ai("thank-you message after a decision is sent")} />
          <Text
            label="A number people can text instead"
            hint="Optional — leave blank to hide it. A free Google Voice number works; texts land in your Google Voice inbox."
            placeholder="(929) 555-0143"
            value={weekly.smsNumber}
            onChange={set("smsNumber")}
          />
          {weekly.smsNumber ? (
            <Text
              label="How the number is offered"
              hint="{number} is replaced with the number above"
              value={weekly.smsNote}
              onChange={set("smsNote")}
              ai={ai("one line offering the text-in number, containing the literal token {number}")}
            />
          ) : null}
          <Toggle
            label="Show how many decisions are in"
            hint="The count climbs on the page during the bar hour"
            value={weekly.showCount}
            onChange={set("showCount")}
          />
        </More>
      </div>

      <div className="mb-6">
        <More
          title="When the form opens and closes"
          hint="Counted from the show's start time, New York time. A tight window means whoever sends one is in the room to hear it."
        >
          <Row>
            <Text
              label="Opens this many minutes before"
              type="number"
              hint="60 = an hour before the show"
              value={String(weekly.openMinutesBefore)}
              onChange={(value) => set("openMinutesBefore")(Math.max(0, Number(value) || 0))}
            />
            <Text
              label="Closes this many minutes after"
              type="number"
              hint="240 = four hours after it starts, so the pile stays open through the show"
              value={String(weekly.closeMinutesAfter)}
              onChange={(value) => set("closeMinutesAfter")(Math.max(0, Number(value) || 0))}
            />
          </Row>
          <Area
            label="What the page says while it's shut"
            rows={2}
            hint="{when} becomes the night and time it opens — for example: Thursday at 8:00 PM"
            value={weekly.closedText}
            onChange={set("closedText")}
            ai={ai("message shown while the form is shut, containing the literal token {when}")}
          />
          <Toggle
            label="Keep the form open all the time"
            hint="Ignores the window above — for testing, or a night that runs to its own clock"
            value={weekly.alwaysOpen}
            onChange={set("alwaysOpen")}
          />
        </More>
      </div>

      <div className="mb-6">
        <More title="How it works, and the Shows page" hint="The description of the show, and whether weekly dates appear on /shows">
          <Area
            label="How it works"
            hint="The show format, in a paragraph or two. Also feeds the search suggestions."
            rows={5}
            value={weekly.howItWorks}
            onChange={set("howItWorks")}
            ai={ai("how the show works (page body)")}
          />
          <Toggle
            label="List upcoming nights on the Shows page"
            hint="Shows the next five nights on the public Shows page"
            value={weekly.showOnShowsPage}
            onChange={set("showOnShowsPage")}
          />
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for Bad Decisions"
          seo={weekly.seo}
          suggestion={suggestFor(content, "weekly")}
          about={about}
          onChange={set("seo")}
        />
      </div>
    </>
  );
}

/**
 * The QR code for the flyer and the table tent.
 *
 * Generated from the site's own URL rather than checked in as a file, so it
 * can never point at a stale address. A cache-busting query string means
 * editing the site URL and coming back here shows the new code, not a
 * browser-cached old one.
 */
function QrCode() {
  const [key] = useState(() => Date.now());
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/admin/decisions/qr?v=${key}`}
        alt="QR code linking to /bad-decisions"
        width={128}
        height={128}
        className="h-32 w-32 shrink-0 rounded-lg bg-white p-2"
      />
      <div className="min-w-[200px] flex-1 text-[14px] leading-relaxed text-neutral-300">
        <p>
          People scan this to send a decision in. It shows a countdown until the form opens, then
          the question. Print this exact code — older codes pointing to the plain page no longer
          work.
        </p>
        <div className="mt-3">
          <LinkButton href={`/api/admin/decisions/qr?v=${key}`} external>
            ⬇️ Open full size to save
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

/**
 * The stage panel: what the host holds during the draw.
 *
 * Big text, few buttons. "Draw one" asks the server for a random open
 * submission and marks it drawn, so the same one can never come up twice
 * even with two phones open. "Archive everything" is the last tap of the
 * night; it clears the pile so next week starts at zero.
 */
function StagePanel({ enabled }: { enabled: boolean }) {
  const [list, setList] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Whether the forwarded-text mailbox is set up, and whether it is answering.
  const [texting, setTexting] = useState<{ on: boolean; error: string }>({ on: false, error: "" });
  // The store holds more than one listing can return, so the pile below is
  // only part of it. Silently showing part of it is the thing to avoid.
  const [truncated, setTruncated] = useState(false);
  const [drawn, setDrawn] = useState<Submission[]>([]);
  const [showPile, setShowPile] = useState(false);

  const load = useCallback(async () => {
    // Check the forwarded-text mailbox on the way past. This panel is only
    // open during a show, which is exactly when texts need collecting, so it
    // stands in for a scheduler — and a scheduler is the part that costs
    // money. A mailbox that is not set up answers instantly and says so.
    try {
      const pull = await fetch("/api/admin/decisions/ingest", {
        method: "POST",
        cache: "no-store",
      });
      const result = await pull.json().catch(() => ({}));
      setTexting(
        result?.configured
          ? { on: true, error: result.ok ? "" : String(result.error || "Mailbox unreachable") }
          : { on: false, error: "" }
      );
    } catch {
      // A failed pull must never stop the pile from loading below.
      setTexting({ on: true, error: "Mailbox unreachable" });
    }

    try {
      const response = await fetch("/api/admin/decisions", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load submissions");
      setList(data.submissions as Submission[]);
      setTruncated(Boolean(data.truncated));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load submissions");
    }
  }, []);

  // Fetching from the server and polling it: the state this sets comes from
  // outside React, so there is nothing to derive during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "That didn't work");
      setError("");
      return data;
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : "That didn't work");
      return null;
    } finally {
      setBusy(false);
      void load();
    }
  };

  const draw = async () => {
    const data = await act({ action: "draw" });
    if (data?.drawn) setDrawn((previous) => [data.drawn as Submission, ...previous]);
  };

  const archive = async () => {
    if (!window.confirm("Archive every submission from tonight? The page count goes back to zero.")) return;
    // The server archives a batch at a time so a big pile cannot outlast one
    // request; keep asking until it says nothing is left. The passes are
    // bounded so a server that stopped making progress cannot spin here.
    for (let pass = 0; pass < 40; pass += 1) {
      const data = await act({ action: "archive-all" });
      if (!data || !Number(data.remaining)) break;
    }
    setDrawn([]);
  };

  const open = (list ?? []).filter((entry) => entry.status === "open");
  const drawnStored = (list ?? []).filter((entry) => entry.status === "drawn");
  const archived = (list ?? []).filter((entry) => entry.status === "archived");
  const onStage = drawn.length ? drawn : drawnStored;

  return (
    <>
      <p className="text-[14px] leading-relaxed text-neutral-400">
        {enabled
          ? "“Draw one” pulls at random and shows it big enough to read out loud."
          : "The page is switched off, so nothing new comes in — but anything already sent is still here."}
      </p>
      {error ? <Note tone="bad">{error}</Note> : null}
      {truncated ? (
        <Note tone="warn">
          There are more stored submissions than can be listed at once, so this is only the most
          recent of them. Delete some archived ones to bring the rest back into view.
        </Note>
      ) : null}
      {texting.on ? (
        texting.error ? (
          <Note tone="warn">Texts aren&apos;t coming through: {texting.error}. The form still works.</Note>
        ) : (
          <p className="text-[13px] text-neutral-500">
            Collecting texts from the forwarding mailbox as well as the form.
          </p>
        )
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-neutral-400">Decisions in</p>
          <p className="text-6xl font-semibold text-white">{list ? open.length : "…"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="big" tone="primary" onClick={draw} disabled={busy || !open.length}>
            🎲 Draw one
          </Button>
          <Button size="big" onClick={() => void load()} disabled={busy}>
            Refresh
          </Button>
        </div>
      </div>

      {onStage.length ? (
        <div className="grid gap-3">
          {onStage.map((entry, index) => (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 ${
                index === 0 ? "border-white bg-white text-black" : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <p className={`text-[12px] font-medium uppercase tracking-[0.14em] ${index === 0 ? "text-neutral-600" : "text-neutral-500"}`}>
                {entry.rehearsal ? "TEST · " : ""}
                {entry.name ? `Called out: ${entry.name}` : "Anonymous"}
              </p>
              <p className={`mt-2 whitespace-pre-line leading-snug ${index === 0 ? "text-2xl sm:text-3xl" : "text-[16px]"}`}>{entry.decision}</p>
              <div className="mt-3 flex gap-2">
                <Button tone={index === 0 ? "default" : "ghost"} onClick={() => act({ action: "reopen", id: entry.id })} disabled={busy}>
                  Put it back
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-neutral-500">Nothing drawn yet.</p>
      )}

      <Card title={`The pile (${open.length} waiting)`} subtitle="Everything waiting to be drawn, newest first">
        {open.length ? (
          <ul className="grid gap-2">
            {open.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-2">
                <span className="min-w-0">
                  <span className="block whitespace-pre-line text-[15px] leading-snug text-neutral-50">
                    {entry.rehearsal ? <span className="mr-2 rounded bg-amber-300 px-1.5 text-[11px] font-bold tracking-widest text-black">TEST</span> : null}
                    {entry.decision}
                  </span>
                  <span className="block text-[12px] text-neutral-500">
                    {entry.name ? entry.name : "anonymous"}
                    {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
                  </span>
                </span>
                <Button tone="ghost" onClick={() => act({ action: "delete", id: entry.id })} disabled={busy}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-neutral-500">Empty.</p>
        )}
      </Card>

      <More title="End of the night" hint="Archive everything so next week starts at zero, and look back at old ones">
        <Actions>
          <Button tone="danger" onClick={archive} disabled={busy || !(list ?? []).some((e) => e.status !== "archived")}>
            🧹 Archive everything from tonight
          </Button>
        </Actions>
        {archived.length ? (
          <div>
            <Button tone="ghost" onClick={() => setShowPile((value) => !value)}>
              {showPile ? "Hide" : "Show"} archived ({archived.length})
            </Button>
            {showPile ? (
              <ul className="mt-2 grid gap-1">
                {archived.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 text-[14px] text-neutral-400">
                    <span className="whitespace-pre-line">
                      {entry.decision}
                      {entry.name ? <span className="text-neutral-600"> — {entry.name}</span> : null}
                    </span>
                    <Button tone="ghost" onClick={() => act({ action: "delete", id: entry.id })} disabled={busy}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-neutral-500">Nothing archived yet.</p>
        )}
      </More>
    </>
  );
}
