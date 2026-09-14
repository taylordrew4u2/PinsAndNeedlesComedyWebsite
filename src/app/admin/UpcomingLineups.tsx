"use client";
import type { Content } from "@/lib/types";
import { unsavedWeeklyShows } from "@/lib/admin-shows";
import { formatDate } from "@/lib/render";
import { Button } from "./ui";
import type { Update } from "./types";

/** Only offer dates without a saved editor, including unpublished drafts. */
export default function UpcomingLineups({ content, update, onCreated }: {
  content: Content; update: Update; onCreated: (id: string) => void;
}) {
  const dates = unsavedWeeklyShows(content.shows, content.weekly);
  if (!dates.length) return null;
  return <div className="grid gap-2">
    <p className="text-sm text-neutral-400">Add details for an upcoming weekly date:</p>
    <div className="flex flex-wrap gap-2">
      {dates.map((occurrence) => <Button key={occurrence.id} onClick={() => {
        update((draft) => {
          if (draft.shows.some((show) => show.series === occurrence.series && show.date === occurrence.date)) return;
          draft.shows.unshift(structuredClone(occurrence));
        });
        onCreated(occurrence.id);
      }}>Add {formatDate(occurrence.date)}</Button>)}
    </div>
  </div>;
}
