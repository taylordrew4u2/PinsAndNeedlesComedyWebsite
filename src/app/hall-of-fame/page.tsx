import BrandAccents from "@/components/BrandAccents";
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
          <p className={styles.eyebrow}>Pins &amp; Needles Comedy</p>
          <h1 className={styles.title}>{hall.heading}</h1>
          <p className={styles.description}>{hall.intro}</p>
        </div>
        {performers.length ? (
          <>
          <div className={styles.rosterHeading}><span>The performers</span><span>Alphabetical · A–Z</span></div>
          <div className={styles.grid}>
            {performers.map((person) => {
              const link = performerSocial(person);
              return (
                <article key={person.id} className={styles.card}>
                  <FameStar name={person.name} />
                  {person.credit ? <p className={styles.credit}>{person.credit}</p> : null}
                    {person.bio ? <p className={styles.bio}>{person.bio}</p> : null}
                    {link ? <a href={link.url} aria-label={`Visit ${person.name} on social media`} target="_blank" rel="noopener noreferrer" className={styles.link}>{link.label}</a> : null}
                </article>
              );
            })}
          </div>
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyStar} aria-hidden="true"><FameStar name="Pins & Needles" /></div>
            <p className={styles.emptyText}>{hall.emptyText}</p>
          </div>
        )}
      </section>
      <div className={styles.accents}><BrandAccents names={["flash-handcuffs", "flash-dice-logo"]} /></div>
    </main>
  );
}
