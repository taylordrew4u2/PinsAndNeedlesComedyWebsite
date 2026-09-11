import FameStar from "./FameStar";
import styles from "./hall.module.css";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import PageHeader from "@/components/PageHeader";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { performerSocial, publishedPerformers } from "@/lib/hall-of-fame";

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
    <main className={styles.hall}>
      <JsonLd data={breadcrumbSchema(site.url, [{ name: "Home", path: "/" }, { name: hall.heading, path: "/hall-of-fame" }])} />
      {faq ? <JsonLd data={faq} /> : null}
      <PageHeader hero={home.hero} nav={site.nav} active="/hall-of-fame" />
      <section className={styles.gallery}>
        <div className={styles.intro}>
          <svg className={styles.crest} viewBox="0 0 100 100" aria-hidden="true" fill="none">
            <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth=".7" />
            <circle cx="50" cy="50" r="23" stroke="currentColor" strokeWidth=".4" />
            <path d="M46 87C9 72 7 35 27 14M54 87C91 72 93 35 73 14" stroke="currentColor" strokeWidth="1.1" />
            {[0, 1, 2, 3, 4].map((leaf) => (
              <g key={leaf} fill="currentColor">
                <ellipse cx={18 + (leaf > 2 ? (leaf - 2) * 4 : 0)} cy={27 + leaf * 11} rx="3" ry="7" transform={`rotate(-35 18 ${27 + leaf * 11})`} />
                <ellipse cx={82 - (leaf > 2 ? (leaf - 2) * 4 : 0)} cy={27 + leaf * 11} rx="3" ry="7" transform={`rotate(35 82 ${27 + leaf * 11})`} />
              </g>
            ))}
            <path d="m50 34 4.5 10 11 1-8.3 7.4 2.5 10.6L50 57.5 40.3 63l2.5-10.6L34.5 45l11-1Z" fill="currentColor" />
          </svg>
          <p className={styles.eyebrow}>Pins &amp; Needles Comedy</p>
          <h1 className={styles.title}>{hall.heading}</h1>
          <div className={styles.rule} aria-hidden="true">✦</div>
          <p className={styles.description}>{hall.intro}</p>
        </div>
        {performers.length ? (
          <div className={styles.grid}>
            {performers.map((person) => {
              const link = performerSocial(person);
              return (
                <article key={person.id} className={styles.card}>
                  <FameStar name={person.name} />
                  {person.credit ? <p className={styles.credit}>{person.credit}</p> : null}
                    {person.bio ? <p className={styles.bio}>{person.bio}</p> : null}
                    {link ? <a href={link.url} aria-label={`Visit ${person.name} on social media`} target="_blank" rel="noopener noreferrer" className={styles.link}>{link.label} <span aria-hidden="true">↗</span></a> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyStar} aria-hidden="true"><FameStar name="Pins & Needles" /></div>
            <p className={styles.emptyText}>{hall.emptyText}</p>
          </div>
        )}
      </section>
    </main>
  );
}
