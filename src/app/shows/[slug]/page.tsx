import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { aspectValue, formatDate, renderBody } from "@/lib/render";
import { breadcrumbSchema, eventSchema, faqSchema } from "@/lib/schema";
import { groupByRole, nyToday, splitShows, timeLine } from "@/lib/shows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const STATUS_NOTE: Record<string, string> = {
  "sold-out": "This show is sold out.",
  postponed: "This show has been postponed.",
  cancelled: "This show has been cancelled.",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { site, shows } = await getContent();
  const show = shows.find((entry) => entry.slug === slug);
  if (!show) return { title: "Not found" };

  const meta = await toMetadata(site, show.seo, `/shows/${show.slug}`);
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: show.date } };
}

/** One labelled fact in the details panel. Renders nothing when empty. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-t border-white/10 py-3">
      <dt className="text-[10px] uppercase tracking-[0.24em] text-[var(--pnc-muted)]">{label}</dt>
      <dd className="mt-1 text-[15px] leading-snug">{children}</dd>
    </div>
  );
}

export default async function ShowPage({ params }: Params) {
  const { slug } = await params;
  const content = await getContent();
  const show = content.shows.find((entry) => entry.slug === slug && entry.published);
  if (!show) notFound();

  const { site, showsPage } = content;
  const today = nyToday();
  const isPast = show.date < today;
  const ratio = aspectValue(showsPage.posterAspect);
  const faq = faqSchema(show.seo);
  const bill = groupByRole(show.lineup);
  const times = timeLine(show);
  const statusNote = STATUS_NOTE[show.status];
  const recap = show.recapSlug
    ? content.posts.find((post) => post.slug === show.recapSlug && post.published)
    : undefined;

  const { upcoming } = splitShows(content.shows, today);
  const others = upcoming.filter((entry) => entry.slug !== show.slug).slice(0, 3);

  const address = [show.address, show.city, show.region, show.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <main>
      <JsonLd data={eventSchema(content, show)} />
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: showsPage.heading, path: "/shows" },
          { name: show.title, path: `/shows/${show.slug}` },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/shows" />

      <article className="mx-auto max-w-5xl px-5 pb-20 pt-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
          <Link href="/shows" className="hover:text-[var(--pnc-fg)]">
            {showsPage.heading}
          </Link>
          <span className="px-2 opacity-40">/</span>
          {formatDate(show.date)}
          {isPast ? <span className="ml-2 opacity-60">· past show</span> : null}
        </p>

        <h1 className="mt-4 text-3xl leading-[1.1] sm:text-4xl">{show.title}</h1>
        {show.tagline ? (
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[var(--pnc-muted)]">
            {show.tagline}
          </p>
        ) : null}

        {statusNote ? (
          <p className="mt-5 inline-block border border-[var(--pnc-accent)] px-3 py-1.5 text-[12px] uppercase tracking-[0.18em]">
            {statusNote}
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {/\.svg(?:[?#]|$)/i.test(show.posterUrl) ? (
              <div
                className="w-full overflow-hidden bg-neutral-950"
                style={{ aspectRatio: `${ratio}`, borderRadius: showsPage.cornerRadius || undefined }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={show.posterUrl}
                  alt={show.posterAlt || show.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            {show.description ? (
              <div
                className="pnc-prose mt-8 text-[16px]"
                dangerouslySetInnerHTML={{ __html: renderBody(show.description) }}
              />
            ) : null}

            {bill.length ? (
              <section className="mt-10">
                <h2 className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
                  The bill
                </h2>
                {bill.map((group) => (
                  <div key={group.role || "cast"} className="mb-6">
                    {group.role ? (
                      <h3 className="mb-2 text-[12px] uppercase tracking-[0.18em]">{group.role}</h3>
                    ) : null}
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {group.people.map((person) => (
                        <li key={person.id} className="flex items-center gap-3">
                          <span className="min-w-0">
                            <span className="block text-[15px] leading-snug">
                              {person.url ? (
                                <a
                                  href={person.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline underline-offset-4 hover:text-[var(--pnc-accent)]"
                                >
                                  {person.name}
                                </a>
                              ) : (
                                person.name
                              )}
                            </span>
                            {person.note ? (
                              <span className="block text-[13px] leading-snug text-[var(--pnc-muted)]">
                                {person.note}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}


          </div>

          <aside>
            <dl className="border-b border-white/10">
              <Fact label="Date">{formatDate(show.date)}</Fact>
              <Fact label="Time">{times}</Fact>
              <Fact label="Venue">
                {show.venueUrl ? (
                  <a
                    href={show.venueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {show.venueName}
                  </a>
                ) : (
                  show.venueName
                )}
              </Fact>
              <Fact label="Address">
                {show.mapUrl ? (
                  <a
                    href={show.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {address}
                  </a>
                ) : (
                  address
                )}
              </Fact>
              <Fact label="Room">{show.roomNote}</Fact>
              <Fact label="Price">{show.price}</Fact>
              <Fact label="Age">{show.ageRestriction}</Fact>
            </dl>

            {show.ticketUrl && show.status !== "cancelled" ? (
              <a
                href={show.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 block bg-[var(--pnc-fg)] px-5 py-3 text-center text-[13px] uppercase tracking-[0.2em] text-[var(--pnc-bg)] transition-opacity hover:opacity-80"
              >
                {show.ticketLabel || "Get tickets"}
              </a>
            ) : null}

            {show.instagramUrl ? (
              <a
                href={show.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block border border-white/20 px-5 py-3 text-center text-[13px] uppercase tracking-[0.2em] transition-colors hover:border-white/60"
              >
                See it on Instagram
              </a>
            ) : null}

            {recap ? (
              <Link
                href={`/news/${recap.slug}`}
                className="mt-3 block border border-white/20 px-5 py-3 text-center text-[13px] uppercase tracking-[0.2em] transition-colors hover:border-white/60"
              >
                Read the recap
              </Link>
            ) : null}
          </aside>
        </div>
      </article>

      {others.length ? (
        <section className="mx-auto max-w-5xl px-5 pb-20">
          <h2 className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
            Also coming up
          </h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {others.map((entry) => (
              <li key={entry.id}>
                <Link href={`/shows/${entry.slug}`} className="group block">
                  <span className="block text-[10px] uppercase tracking-[0.22em] text-[var(--pnc-muted)]">
                    {formatDate(entry.date)}
                  </span>
                  <span className="mt-2 block text-[15px] leading-snug group-hover:underline">
                    {entry.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
