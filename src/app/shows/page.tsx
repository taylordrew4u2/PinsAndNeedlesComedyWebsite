import PageIntro from "@/components/PageIntro";
import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import ShowCard from "@/components/ShowCard";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { formatTime, nyToday, splitShows } from "@/lib/shows";
import { formatDate } from "@/lib/render";
import { upcomingPublicShows } from "@/lib/public-shows";
import styles from "./shows.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, showsPage } = await getContent();
  return await toMetadata(site, showsPage.seo, "/shows");
}

export default async function ShowsIndexPage() {
  const content = await getContent();
  const { site, showsPage, weekly } = content;
  const today = nyToday();
  const { past } = splitShows(content.shows, today);
  const upcoming = upcomingPublicShows(content.shows, weekly, today);
  const shownPast = showsPage.showPastShows ? past.slice(0, showsPage.pastLimit) : [];
  const faq = faqSchema(showsPage.seo);

  const grid = {
    display: "grid",
    gap: showsPage.gap,
    gridTemplateColumns: `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`,
  } as const;

  return (
    <main>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", itemListElement: upcoming.map((show, index) => ({ "@type": "ListItem", position: index + 1, name: `${show.title} — ${show.date}`, url: `${site.url.replace(/\/$/, "")}${show.generated ? `/shows#${show.id}` : `/shows/${show.slug}`}` })) }} />
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: showsPage.heading, path: "/shows" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/shows" />
      <PageIntro title={showsPage.heading} description="The next five shows. Pick a night and see who’s on." artwork="bad-decisions-dice" />

      <section className="mx-auto max-w-6xl px-5 pb-14 pt-8" aria-label="Upcoming shows">
        {upcoming.length ? (
          <div className={styles.list}>
            {upcoming.map((show) => {
              const names = show.lineup.map((person) => person.name.trim()).filter(Boolean);
              const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${show.date}T12:00:00Z`));
              const status = show.status === "scheduled" ? "" : { "sold-out": "Sold out", postponed: "Postponed", cancelled: "Cancelled" }[show.status];
              return <article key={show.id} id={show.id} className={styles.show}>
                <div>
                  <h2 className={styles.title}>{show.title}</h2>
                  <p className={styles.format}>{show.series === weekly.slug ? "Stand-up comedy + audience participation" : "Live stand-up comedy"}</p>
                  <p className={styles.date}><time dateTime={show.date}>{weekday}, {formatDate(show.date)}</time></p>
                  <p className={styles.time}>{show.startTime ? formatTime(show.startTime) : "Time to be announced"}{show.venueName ? ` · ${show.venueName}` : ""}</p>
                  {status ? <p className={styles.status}>{status}</p> : null}
                  {show.ticketUrl && show.status === "scheduled" ? <a className={styles.rsvp} href={show.ticketUrl}>{show.ticketLabel || "RSVP"}</a> : null}
                </div>
                <div className={styles.lineup}>
                  <h3 className={styles.label}>Lineup</h3>
                  {names.length ? <ul className={styles.names}>{names.map((name, index) => <li key={index}>{name}</li>)}</ul> : <p className={styles.pending}>Lineup to be announced</p>}
                  {!show.generated ? <Link className={styles.details} href={`/shows/${show.slug}`}>Show details </Link> : null}
                </div>
              </article>;
            })}
          </div>
        ) : <p className="text-[var(--pnc-muted)]">{showsPage.emptyText}</p>}
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
      <BrandAccents names={["flash-martini", "flash-spilled-drink"]} />
    </main>
  );
}
