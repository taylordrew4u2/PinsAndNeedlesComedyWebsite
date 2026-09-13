"use client";
import type { Content, Show } from "@/lib/types";
import { upcomingPublicShows } from "@/lib/public-shows";
import { formatDate } from "@/lib/render";
import { formatTime } from "@/lib/shows";
import { Button, Card, Section, Text, Toggle } from "./ui";
import type { Update } from "./types";

export default function UpcomingLineups({ content, update }: { content: Content; update: Update }) {
  if (!content.weekly.enabled || !content.weekly.showOnShowsPage) return null;
  const dates = upcomingPublicShows([], content.weekly);
  const change = (occurrence: Show, edit: (show: Show) => void) => update((draft) => {
    let show = draft.shows.find((item) => item.series === draft.weekly.slug && item.date === occurrence.date && item.published)
      || draft.shows.find((item) => item.series === draft.weekly.slug && item.date === occurrence.date);
    if (!show) {
      const saved = structuredClone(occurrence) as Show & { generated?: boolean };
      delete saved.generated;
      show = saved;
      draft.shows.push(show);
    }
    edit(show);
  });
  return <Section title="Upcoming weekly lineups" hint="Add confirmed names for each date. Changes save automatically. Each lineup belongs only to that night; saved nights remain in the show archive as dates roll forward.">
    {dates.map((occurrence) => {
      const saved = content.shows.find((show) => show.series === content.weekly.slug && show.date === occurrence.date && show.published)
        || content.shows.find((show) => show.series === content.weekly.slug && show.date === occurrence.date);
      const show = saved || occurrence;
      return <Card key={occurrence.date} title={`${content.weekly.weekday}, ${formatDate(occurrence.date)}`} subtitle={`${show.title} · ${formatTime(show.startTime)}`} defaultOpen>
        {show.lineup.length ? show.lineup.map((person, index) => <div key={person.id} className="flex items-end gap-3">
          <div className="flex-1"><Text label={`Performer ${index + 1}`} value={person.name} onChange={(name) => change(occurrence, (entry) => { entry.lineup[index].name = name; })} /></div>
          <Button tone="danger" onClick={() => change(occurrence, (entry) => { entry.lineup.splice(index, 1); })}>Remove</Button>
        </div>) : <p className="text-sm text-neutral-400">Lineup to be announced</p>}
        <Button onClick={() => change(occurrence, (entry) => { entry.lineup.push({ id: crypto.randomUUID(), name: "", role: "Comedian", note: "", imageUrl: "", imageAlt: "", url: "" }); })}>Add performer</Button>
        <Text label="RSVP / ticket URL" value={show.ticketUrl} onChange={(ticketUrl) => change(occurrence, (entry) => { entry.ticketUrl = ticketUrl; })} />
        <Text label="RSVP button label" value={show.ticketLabel} onChange={(ticketLabel) => change(occurrence, (entry) => { entry.ticketLabel = ticketLabel; })} />
        {saved ? <Toggle label="Publish this date’s details and lineup" value={saved.published} onChange={(published) => change(occurrence, (entry) => { entry.published = published; })} /> : null}
      </Card>;
    })}
  </Section>;
}
