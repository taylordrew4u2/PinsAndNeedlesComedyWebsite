import type { Show, WeeklyPage } from "./types";
import { upcomingPublicShows } from "./public-shows.ts";

/** Saved drafts and published nights both already have an admin editor. */
export function unsavedWeeklyShows(shows: Show[], weekly: WeeklyPage, today?: string): Show[] {
  return upcomingPublicShows([], weekly, today)
    .filter((date) => !shows.some((show) => show.series === date.series && show.date === date.date))
    .map((occurrence) => {
      const saved: Show & { generated?: boolean } = { ...occurrence };
      delete saved.generated;
      return saved;
    });
}
