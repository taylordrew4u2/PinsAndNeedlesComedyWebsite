import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import PageHeader from "@/components/PageHeader";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { performerLink, publishedPerformers } from "@/lib/hall-of-fame";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { site, hallOfFame } = await getContent();
  return toMetadata(site, hallOfFame.seo, "/hall-of-fame");
}

export default async function HallOfFamePage() {
  const { site, home, hallOfFame: hall } = await getContent();
  const performers = publishedPerformers(hall);
  const faq = faqSchema(hall.seo);
  return (
    <main>
      <JsonLd data={breadcrumbSchema(site.url, [{ name: "Home", path: "/" }, { name: hall.heading, path: "/hall-of-fame" }])} />
      {faq ? <JsonLd data={faq} /> : null}
      <PageHeader hero={home.hero} nav={site.nav} active="/hall-of-fame" />
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:pt-16">
        <div className="mb-10 border-b border-white/15 pb-8 sm:mb-12">
          <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-[var(--pnc-accent)]">Pins &amp; Needles Comedy · Alumni</p>
          <h1 className="text-4xl leading-none sm:text-6xl lg:text-7xl">{hall.heading}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--pnc-muted)]">{hall.intro}</p>
        </div>
        {performers.length ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[400px]:grid-cols-2 lg:grid-cols-3">
            {performers.map((person, index) => {
              const link = performerLink(person.linkUrl);
              return (
                <article key={person.id} className="group min-w-0">
                  <div className="relative aspect-[4/5] overflow-hidden border border-white/15 bg-neutral-900">
                    {person.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={person.photoUrl} alt={person.photoAlt || person.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div aria-hidden="true" className="flex h-full items-center justify-center text-6xl font-bold text-white/20 sm:text-8xl">
                        {person.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
                      </div>
                    )}
                    <span aria-hidden="true" className="absolute left-3 top-3 bg-[var(--pnc-bg)] px-2 py-1 text-[10px] tracking-[0.18em] text-[var(--pnc-accent)]">№ {String(index + 1).padStart(3, "0")}</span>
                  </div>
                  <div className="border-b border-white/15 py-4">
                    <h2 className="break-words text-xl leading-tight sm:text-2xl">{person.name}</h2>
                    {person.credit ? <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-[var(--pnc-accent)]">{person.credit}</p> : null}
                    {person.bio ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--pnc-muted)]">{person.bio}</p> : null}
                    {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs underline underline-offset-4 hover:text-[var(--pnc-accent)]">{person.linkLabel || "Find them online"} <span aria-hidden="true">↗</span></a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-white/20 px-6 py-16 text-center">
            <span aria-hidden="true" className="text-3xl text-[var(--pnc-accent)]">✦</span>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[var(--pnc-muted)]">{hall.emptyText}</p>
          </div>
        )}
      </section>
    </main>
  );
}
