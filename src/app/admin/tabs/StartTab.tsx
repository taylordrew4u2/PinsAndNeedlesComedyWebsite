"use client";

import type { ReactNode } from "react";
import type { Content } from "@/lib/types";
import { formatDate } from "@/lib/render";
import { nyToday } from "@/lib/shows";
import { newShow } from "./ShowsTab";
import { newHallPerformer } from "./HallOfFameTab";
import { Button, Note, Pill, Section } from "../ui";
import type { Go, Update } from "../types";

/** One big tappable job. A link when it goes to another page, a button otherwise. */
function Job({
  icon,
  title,
  hint,
  onClick,
  href,
  external,
}: {
  icon: string;
  title: string;
  hint: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span aria-hidden="true" className="text-[30px] leading-none">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold text-neutral-50">{title}</span>
        <span className="block text-[13px] leading-snug text-neutral-400">{hint}</span>
      </span>
    </>
  );
  const className =
    "flex min-h-[84px] w-full items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-left transition-colors hover:border-white hover:bg-neutral-800";
  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * The first screen after logging in: the jobs people actually come here to
 * do, what is coming up, and anything that looks half-finished. Nothing on
 * it is a setting — it only points at the tabs.
 */
export default function StartTab({
  content,
  update,
  go,
}: {
  content: Content;
  update: Update;
  go: Go;
}) {
  const today = nyToday();
  const upcoming = content.shows
    .filter((show) => show.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const addShow = () => {
    const show = newShow();
    update((draft) => void draft.shows.unshift(show));
    go("shows", show.id);
  };
  const addPerformer = () => {
    const person = newHallPerformer();
    update((draft) => void draft.hallOfFame.performers.push(person));
    go("hall", person.id);
  };

  // Gentle nudges: things that are probably not what you meant. Each one
  // opens the exact place to fix it.
  const nudges: { text: string; label: string; onClick: () => void }[] = [];
  const draftShows = upcoming.filter((show) => !show.published);
  if (draftShows.length) {
    nudges.push({
      text:
        draftShows.length === 1
          ? `“${draftShows[0].title}” is still a draft — nobody can see it on the site yet.`
          : `${draftShows.length} upcoming shows are still drafts — nobody can see them on the site yet.`,
      label: "Open it",
      onClick: () => go("shows", draftShows[0].id),
    });
  }
  const noTickets = upcoming.filter((show) => show.published && !show.ticketUrl);
  if (noTickets.length) {
    nudges.push({
      text:
        noTickets.length === 1
          ? `“${noTickets[0].title}” is live but has no ticket or RSVP link.`
          : `${noTickets.length} live shows have no ticket or RSVP link.`,
      label: "Add a link",
      onClick: () => go("shows", noTickets[0].id),
    });
  }
  if (!content.weekly.enabled) {
    nudges.push({
      text: "The Bad Decisions page is switched off, so the QR code on the tables goes nowhere.",
      label: "Turn it on",
      onClick: () => go("weekly"),
    });
  }
  const blankReels = content.reels.filter((reel) => reel.published && !reel.videoUrl && !reel.posterUrl);
  if (blankReels.length) {
    nudges.push({
      text: `${blankReels.length} reel${blankReels.length === 1 ? " has" : "s have"} no video or picture, so ${
        blankReels.length === 1 ? "it shows" : "they show"
      } up blank.`,
      label: "Fix reels",
      onClick: () => go("reels"),
    });
  }

  return (
    <>
      <Section icon="👋" title="What do you want to do?" hint="Tap one. You can always come back here by tapping Start.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Job icon="🎤" title="Add a show" hint="A new night: date, venue, lineup, tickets" onClick={addShow} />
          <Job
            icon="📸"
            title="Add a show from a flyer"
            hint="Upload the poster and the details get typed in for you"
            onClick={() => go("shows", "flyer")}
          />
          <Job icon="🎲" title="Run tonight's show" hint="Pick decisions and put them on the big screen" href="/admin/run-show" />
          <Job
            icon="✍️"
            title="Write a news post"
            hint="Type a few details, add the flyer, get a finished post back"
            onClick={() => go("news", "write")}
          />
          <Job icon="🎬" title="Add reels" hint="Pull videos in from Instagram" onClick={() => go("reels")} />
          <Job icon="⭐" title="Add someone to the Hall of Fame" hint="A comic who performed with you" onClick={addPerformer} />
          <Job icon="👀" title="Look at the website" hint="Opens in a new tab" href="/" external />
          <Job icon="⚙️" title="Change how the site looks" hint="Name, colors, fonts, menu" onClick={() => go("site")} />
        </div>
      </Section>

      <Section icon="📅" title="Coming up" hint="Your next shows. Tap one to open it.">
        {upcoming.length ? (
          <ul className="grid gap-2">
            {upcoming.map((show) => (
              <li key={show.id}>
                <button
                  type="button"
                  onClick={() => go("shows", show.id)}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left hover:border-neutral-400"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium text-neutral-50">{show.title}</span>
                    <span className="block truncate text-[13px] text-neutral-400">
                      {formatDate(show.date)}
                      {show.venueName ? ` · ${show.venueName}` : ""}
                    </span>
                  </span>
                  {show.published ? <Pill tone="live">Live</Pill> : <Pill tone="draft">Draft</Pill>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Note>Nothing on the calendar yet. Tap “Add a show” above to put one on.</Note>
        )}
        <div>
          <Button onClick={() => go("shows")}>See all shows</Button>
        </div>
      </Section>

      {nudges.length ? (
        <Section icon="💡" title="Worth a look" hint="Not errors — just things that might not be what you meant.">
          {nudges.map((nudge) => (
            <NudgeRow key={nudge.text} label={nudge.label} onClick={nudge.onClick}>
              {nudge.text}
            </NudgeRow>
          ))}
        </Section>
      ) : null}

      <Note>
        <span className="font-semibold text-neutral-100">How this works. </span>
        Every page shows the few things you change most. Anything technical waits under a
        dashed <span className="font-medium text-neutral-100">“More options”</span> box — tap
        “Show” to open it. Tick <span className="font-medium text-neutral-100">Show everything</span>{" "}
        at the top if you would rather see it all at once. And there is no save button: it
        saves by itself.
      </Note>
    </>
  );
}

function NudgeRow({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3">
      <p className="min-w-0 flex-1 text-[14px] leading-snug text-amber-100">{children}</p>
      <Button onClick={onClick}>{label}</Button>
    </div>
  );
}
