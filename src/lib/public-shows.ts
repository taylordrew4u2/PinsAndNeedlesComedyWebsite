import type { Show, WeeklyPage } from "./types";
import { newWeeklyShow, nextDateForWeekday } from "./decisions.ts";
import { nyToday } from "./shows.ts";

export type PublicShow = Show & { generated: boolean };

/** Calendar arithmetic stays in New York date strings, including across DST. */
export function upcomingPublicShows(shows: Show[], weekly: WeeklyPage, today = nyToday(), limit = 5): PublicShow[] {
  const dated = shows.filter((show) => show.published && show.date >= today);
  const entries: PublicShow[] = [];
  const recurring = weekly.enabled && weekly.showOnShowsPage;
  if (recurring) {
    const first = nextDateForWeekday(weekly.weekday, today);
    for (let index = 0; index < limit; index++) {
      const calendar = new Date(`${first}T12:00:00Z`);
      calendar.setUTCDate(calendar.getUTCDate() + index * 7);
      const date = calendar.toISOString().slice(0, 10);
      const matches = dated.filter((show) => show.series === weekly.slug && show.date === date);
      // One dated record owns this occurrence, including its status and lineup.
      const saved = matches[0];
      entries.push(saved ? { ...saved, generated: false } : {
        ...newWeeklyShow(weekly, date, calendar),
        id: `weekly-${weekly.slug}-${date}`, published: true, generated: true,
      });
    }
  }
  for (const show of dated) {
    if (entries.some((entry) => entry.id === show.id || (recurring && show.series === weekly.slug && entry.series === show.series && entry.date === show.date))) continue;
    entries.push({ ...show, generated: false });
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)).slice(0, limit);
}
