import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import ShowCard from "@/components/ShowCard";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { breadcrumbSchema, faqSchema, showsListSchema } from "@/lib/schema";
import { nyToday, splitShows } from "@/lib/shows";
import { formatDate } from "@/lib/render";
import { nextWeeklyShow, weeklyScheduleLine, weeklyVenueLine } from "@/lib/decisions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, showsPage } = await getContent();
  return await toMetadata(site, showsPage.seo, "/shows");
}

export default async function ShowsIndexPage() {
  const content = await getContent();
  const { site, showsPage, weekly } = content;
  const today = nyToday();
  const { upcoming, past } = splitShows(content.shows, today);
  const nextWeekly = nextWeeklyShow(content.shows, weekly, today);
  const shownPast = showsPage.showPastShows ? past.slice(0, showsPage.pastLimit) : [];
  const faq = faqSchema(showsPage.seo);

  const grid = {
    display: "grid",
    gap: showsPage.gap,
    gridTemplateColumns: `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`,
  } as const;

  return (
    <main>
      <JsonLd data={showsListSchema(content, today)} />
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: showsPage.heading, path: "/shows" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/shows" />

      <section className="mx-auto max-w-6xl px-5 pb-2 pt-8">
        <h1 className="text-3xl sm:text-4xl">{showsPage.heading}</h1>
        {showsPage.intro ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--pnc-muted)]">
            {showsPage.intro}
          </p>
        ) : null}
      </section>

      {weekly.enabled && weekly.showOnShowsPage ? (
        <section className="mx-auto max-w-6xl px-5 pt-6">
          <h2 className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
            {showsPage.weeklyHeading}
          </h2>
          <div
            className="flex flex-col gap-4 border border-white/15 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-[0.24em] text-[var(--pnc-muted)]">
                {weeklyScheduleLine(weekly)}
              </span>
              <span className="mt-1.5 block text-[20px] leading-snug">{weekly.title}</span>
              <span className="mt-1 block text-[13px] leading-snug text-[var(--pnc-muted)]">
                {weeklyVenueLine(weekly)}
                {weekly.price ? ` · ${weekly.price}` : ""}
              </span>
              {nextWeekly?.lineup.length ? (
                <span className="mt-2 block text-[13px] leading-snug">
                  {formatDate(nextWeekly.date)}:{" "}
                  {nextWeekly.lineup.map((person) => person.name).filter(Boolean).join(", ")}
                </span>
              ) : null}
            </span>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-5 pb-14 pt-10">
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
          {showsPage.upcomingHeading}
        </h2>

        {upcoming.length ? (
          <div style={grid}>
            {upcoming.map((show) => (
              <ShowCard key={show.id} show={show} settings={showsPage} fallbackImage={site.logoUrl} />
            ))}
          </div>
        ) : (
          <p className="max-w-xl text-[15px] leading-relaxed text-[var(--pnc-muted)]">
            {showsPage.emptyText}
          </p>
        )}
      </section>

      {shownPast.length ? (
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
            {showsPage.pastHeading}
          </h2>
          <div style={grid}>
            {shownPast.map((show) => (
              <ShowCard
                key={show.id}
                show={show}
                settings={showsPage}
                fallbackImage={site.logoUrl}
                dim
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <Link
          href="/contact"
          className="text-[12px] uppercase tracking-[0.22em] text-[var(--pnc-muted)] underline underline-offset-4 hover:text-[var(--pnc-fg)]"
        >
          Book the show at your venue
        </Link>
      </section>
    </main>
  );
}
