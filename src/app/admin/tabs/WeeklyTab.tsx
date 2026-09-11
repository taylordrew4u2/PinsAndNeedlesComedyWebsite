"use client";

import { useCallback, useEffect, useState } from "react";
import type { Content, Submission, WeeklyPage } from "@/lib/types";
import { aspectValue } from "@/lib/render";
import { Area, Button, Card, Row, Section, Select, Text, Toggle } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

const WEEKDAYS = (
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
).map((day) => ({ value: day, label: `Every ${day}` }));

export default function WeeklyTab({ content, update }: { content: Content; update: Update }) {
  const weekly = content.weekly;
  const posterAspect = aspectValue(content.showsPage.posterAspect);
  const set = <K extends keyof WeeklyPage>(key: K) => (value: WeeklyPage[K]) =>
    update((d) => void (d.weekly[key] = value));

  return (
    <>
      <a href="/admin/run-show" className="block rounded-lg bg-white px-5 py-4 text-center text-lg font-semibold text-black">Run Show</a>
      <StagePanel enabled={weekly.enabled} />

      <Section
        title="Bad Decisions page"
        hint="Private submission screen: accessible through the QR code, with no public menu link. Everything here is the standing detail; each week's bill is a show in the Shows tab marked as part of this weekly."
      >
        <QrCode />
        <Toggle
          label="Page is live"
          hint="off = the QR entry is a 404 and the form stops taking submissions"
          value={weekly.enabled}
          onChange={set("enabled")}
        />
        <Text label="Title" value={weekly.title} onChange={set("title")} />
        <Area label="Tagline" rows={2} value={weekly.tagline} onChange={set("tagline")} />
        <Row>
          <Select label="Night" value={weekly.weekday} options={WEEKDAYS} onChange={set("weekday")} />
          <Text label="Doors" type="time" value={weekly.doorsTime} onChange={set("doorsTime")} />
          <Text label="Show starts" type="time" value={weekly.startTime} onChange={set("startTime")} />
        </Row>
        <Row>
          <Text label="Venue name" value={weekly.venueName} onChange={set("venueName")} />
          <Text label="Venue website" value={weekly.venueUrl} placeholder="https://" onChange={set("venueUrl")} />
        </Row>
        <Text label="Street address" value={weekly.address} onChange={set("address")} />
        <Row>
          <Text label="City" value={weekly.city} onChange={set("city")} />
          <Text label="State" value={weekly.region} onChange={set("region")} />
          <Text label="ZIP" value={weekly.postalCode} onChange={set("postalCode")} />
        </Row>
        <Row>
          <Text label="Map link" value={weekly.mapUrl} placeholder="https://maps.google.com/..." onChange={set("mapUrl")} />
          <Text label="Price" hint="e.g. Free" value={weekly.price} onChange={set("price")} />
          <Text label="Age" hint="e.g. 21+" value={weekly.ageRestriction} onChange={set("ageRestriction")} />
        </Row>
        <Text
          label="Room note"
          hint="under the form — e.g. the room is small, come early"
          value={weekly.roomNote}
          onChange={set("roomNote")}
        />
        <MediaField
          label="Poster"
          hint={`cropped to ${content.showsPage.posterAspect}, same as show posters`}
          value={weekly.posterUrl}
          onChange={set("posterUrl")}
          aspect={posterAspect}
          previewHeight={180}
        />
        <Text label="Poster alt text" value={weekly.posterAlt} onChange={set("posterAlt")} />
      </Section>

      <Section title="The form" hint="What people see on their phone. Keep every line short.">
        <Text label="The question" value={weekly.question} onChange={set("question")} />
        <Text label="Placeholder inside the box" value={weekly.placeholder} onChange={set("placeholder")} />
        <Text label="Name toggle label" value={weekly.namePrompt} onChange={set("namePrompt")} />
        <Area label="Small print under the form" rows={2} value={weekly.formNote} onChange={set("formNote")} />
        <Row>
          <Text label="Button text" value={weekly.submitLabel} onChange={set("submitLabel")} />
        </Row>
        <Area label="After they send" rows={2} value={weekly.thanksText} onChange={set("thanksText")} />
        <Text
          label="Text-in number"
          hint="optional — leave blank to hide it. A free Google Voice number works; texts land in your Google Voice inbox."
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
          />
        ) : null}
        <Toggle
          label="Show how many decisions are in"
          hint="the count climbs on the page during the bar hour"
          value={weekly.showCount}
          onChange={set("showCount")}
        />
      </Section>

      <Section
        title="When the form opens"
        hint="Counted from the show's start time, in New York. Keeping the window tight is the point: whoever sends a decision is in the room to hear it read out. A published night in the Shows tab uses its own start time; otherwise it's the standing one above."
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
          hint="{when} becomes the night and time it opens — e.g. Thursday at 8:00 PM"
          value={weekly.closedText}
          onChange={set("closedText")}
        />
        <Toggle
          label="Keep the form open all the time"
          hint="ignores the window above — for testing, or a night that runs to its own clock"
          value={weekly.alwaysOpen}
          onChange={set("alwaysOpen")}
        />
      </Section>

      <Section title="The rest of the page">
        <Area
          label="How it works"
          hint="blank line = new paragraph · ## heading · **bold**"
          rows={8}
          value={weekly.howItWorks}
          onChange={set("howItWorks")}
        />
        <Row>
          <Text label="This week heading" value={weekly.thisWeekHeading} onChange={set("thisWeekHeading")} />
        </Row>
        <Area
          label="When no night is entered yet"
          rows={2}
          value={weekly.noLineupText}
          onChange={set("noLineupText")}
        />
        <Area label="Last line on the page" rows={2} value={weekly.closingLine} onChange={set("closingLine")} />
      </Section>

      <Section title="Where else it shows up">
        <Toggle
          label="Strip on the home page"
          hint="one line under the logo, in the accent colour"
          value={weekly.showOnHome}
          onChange={set("showOnHome")}
        />
        <Area label="Home strip text" rows={2} value={weekly.homeStripText} onChange={set("homeStripText")} />
        <Text label="Home strip button" value={weekly.homeStripCta} onChange={set("homeStripCta")} />
        <Toggle
          label="Block at the top of /shows"
          hint={`under the heading "${content.showsPage.weeklyHeading}" — edit that in the Shows tab`}
          value={weekly.showOnShowsPage}
          onChange={set("showOnShowsPage")}
        />
        <p className="text-[12px] text-neutral-500">
          The nav link is under Site &amp; SEO → Navigation, like every other page.
        </p>
      </Section>

      <SeoEditor
        title="Bad Decisions SEO & AI SEO"
        seo={weekly.seo}
        suggestion={suggestFor(content, "weekly")}
        onChange={set("seo")}
      />
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
    <div className="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/admin/decisions/qr?v=${key}`}
        alt="QR code linking to /bad-decisions"
        width={112}
        height={112}
        className="h-28 w-28 shrink-0 rounded bg-white p-2"
      />
      <div className="text-[12px] text-neutral-400">
        <p>Private QR entry: countdown until submissions open, then the prompt. Download this new code for flyers and table tents; older codes pointing to the plain page will not work.</p>
        <a
          href={`/api/admin/decisions/qr?v=${key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block underline underline-offset-4 hover:text-white"
        >
          Open full size to save
        </a>
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
  const onStage = drawn.length ? drawn : drawnStored;

  return (
    <Section
      title="Tonight"
      hint={
        enabled
          ? "Open this on your phone during the show. Draw one pulls at random and reads it back big enough to read out loud."
          : "The page is switched off, so nothing new comes in — but anything already sent is still here."
      }
    >
      {error ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{error}</p>
      ) : null}
      {truncated ? (
        <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-[12px] text-amber-300">
          There are more stored submissions than can be listed at once, so this
          is only the most recent of them. Delete some archived ones to bring
          the rest back into view.
        </p>
      ) : null}
      {texting.on ? (
        texting.error ? (
          <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-[12px] text-amber-300">
            Texts aren&apos;t coming through: {texting.error}. The form still works.
          </p>
        ) : (
          <p className="text-[12px] text-neutral-500">
            Collecting texts from the forwarding mailbox as well as the form.
          </p>
        )
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Decisions in</p>
          <p className="text-5xl font-semibold text-white">{list ? open.length : "…"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={draw} disabled={busy || !open.length}>
            Draw one
          </Button>
          <Button onClick={() => void load()} disabled={busy}>
            Refresh
          </Button>
          <Button tone="danger" onClick={archive} disabled={busy || !(list ?? []).some((e) => e.status !== "archived")}>
            Archive everything
          </Button>
        </div>
      </div>

      {onStage.length ? (
        <div className="grid gap-3">
          {onStage.map((entry, index) => (
            <div
              key={entry.id}
              className={`rounded-lg border p-4 ${
                index === 0 ? "border-white bg-white text-black" : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <p className={`text-[11px] uppercase tracking-[0.18em] ${index === 0 ? "text-neutral-600" : "text-neutral-500"}`}>
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
        <p className="text-[13px] text-neutral-500">Nothing drawn yet.</p>
      )}

      <Card title={`The pile (${open.length} open)`} subtitle="everything waiting to be drawn, newest first">
        {open.length ? (
          <ul className="grid gap-2">
            {open.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2">
                <span className="min-w-0">
                  <span className="block whitespace-pre-line text-[14px] leading-snug text-neutral-100">{entry.decision}</span>
                  <span className="block text-[11px] text-neutral-500">
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
          <p className="text-[13px] text-neutral-500">Empty.</p>
        )}
      </Card>

      {(list ?? []).some((entry) => entry.status === "archived") ? (
        <div>
          <Button tone="ghost" onClick={() => setShowPile((value) => !value)}>
            {showPile ? "Hide" : "Show"} archived ({(list ?? []).filter((e) => e.status === "archived").length})
          </Button>
          {showPile ? (
            <ul className="mt-2 grid gap-1">
              {(list ?? [])
                .filter((entry) => entry.status === "archived")
                .map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 text-[13px] text-neutral-400">
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
      ) : null}
    </Section>
  );
}
