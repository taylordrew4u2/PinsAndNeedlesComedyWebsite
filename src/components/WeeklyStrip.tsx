import type { WeeklyPage } from "@/lib/types";
import { weeklyScheduleLine } from "@/lib/decisions";

/**
 * One line about the weekly, for the home page and the top of /shows.
 * Short on purpose: the page does the explaining, this just points at it.
 *
 * It used to be a solid slab of the accent colour across the full width. Next
 * to a black page and one piece of white line art that reads as an ad someone
 * else bought — the loudest thing on the page, and the least considered. The
 * accent now draws the eye without shouting: a rule down the left edge, the
 * night in accent type, and a filled button that is actually legible. Same
 * pull, a tenth of the paint.
 */
export default function WeeklyStrip({ weekly, text }: { weekly: WeeklyPage; text: string }) {
  const night = weeklyScheduleLine(weekly).split(" · ")[0];

  return (
    <section className="border-y border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <div className="flex flex-col gap-4 border-l-2 border-[var(--pnc-accent)] pl-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-[15px] leading-snug text-white">
            <span className="mr-2 text-[10px] uppercase tracking-[0.28em] text-[var(--pnc-accent)]">
              {night}
            </span>
            {text}
          </p>

        </div>
      </div>
    </section>
  );
}
