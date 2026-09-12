import type { Metadata } from "next";
import HallOfFameLink from "@/components/HallOfFameLink";
import PageHeader from "@/components/PageHeader";
import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";
import { homeDesignDefaults, homeArtworkOptions } from "@/lib/home-design";
import { formatDate } from "@/lib/render";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { faqSchema, organizationSchema, websiteSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, home } = await getContent();
  return await toMetadata(site, home.seo, "/");
}

export default async function HomePage() {
  const content = await getContent();
  const { site, home } = content;
  const editorial = { ...homeDesignDefaults, ...home.hero.editorial };
  const artwork =
    homeArtworkOptions.find((option) => option.value === editorial.artwork) ||
    homeArtworkOptions[0];

  const posts = [...content.posts]
    .filter((post) => post.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const instagramUrl =
    site.socials.find((social) => /instagram/i.test(social.label))?.url ||
    `https://www.instagram.com/${site.instagramHandle}/`;

  const faq = faqSchema(home.seo.faq.length ? home.seo : site.seo);

  return (
    <main>
      <JsonLd data={organizationSchema(content)} />
      <JsonLd data={websiteSchema(content)} />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={home.hero} nav={site.nav} active="/" />
      <div className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>
              <span /> {editorial.eyebrow}
            </p>
            <h1 id="home-title">
              {editorial.headline} <em>{editorial.emphasis}</em>
            </h1>
            <p className={styles.description}>{editorial.description}</p>
            <Link className={styles.button} href="/shows">
              Find your next show <span aria-hidden="true">↗</span>
            </Link>
            <p className={styles.aside}>{editorial.note}</p>
          </div>
          <div className={styles.artwork}>
            <Image
              src={
                artwork.value === "/brand/logo-white.svg"
                  ? artwork.value
                  : artwork.value.replace(".svg", "-on-dark.svg")
              }
              alt={artwork.label}
              width={512}
              height={512}
              priority
              sizes="(max-width: 760px) 85vw, 45vw"
            />
          </div>
        </section>
        <section className={styles.hall} aria-labelledby="hall-title">
          <div>
            <p className={styles.eyebrow}>The people who leave a mark</p>
            <h2 id="hall-title">
              Our stage. <em>Their legacy.</em>
            </h2>
            <p>Celebrating everyone who’s taken our stage.</p>
            <Link className={styles.textLink} href="/hall-of-fame">
              Meet our Hall of Fame <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <HallOfFameLink />
        </section>
        {posts.length > 0 ? (
          <section className={styles.news} aria-labelledby="news-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>The latest from Pins & Needles</p>
                <h2
                  id="news-title"
                  className={home.showMarqueeHeading ? undefined : "sr-only"}
                >
                  {home.marqueeHeading || "From the stage."}
                </h2>
              </div>
              <Link className={styles.textLink} href="/news">
                All stories <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.newsGrid}>
              {posts.slice(0, 3).map((post) => (
                <Link
                  className={styles.story}
                  key={post.id}
                  href={`/news/${post.slug}`}
                >
                  <div className={styles.storyImage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverUrl || site.logoUrl}
                      alt={post.coverAlt || post.title}
                      loading="lazy"
                    />
                  </div>
                  <p className={styles.date}>{formatDate(post.date)}</p>
                  <h3>{post.title}</h3>
                  <span className={styles.read}>Read story ↗</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <section className={styles.closing}>
          <p className={styles.eyebrow}>There’s more where that came from.</p>
          <h2>See you in the room.</h2>
          <div>
            <Link className={styles.button} href="/shows">
              Explore the shows <span aria-hidden="true">↗</span>
            </Link>
            <a
              className={styles.textLink}
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow on Instagram ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
