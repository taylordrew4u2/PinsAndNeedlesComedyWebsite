import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import HallOfFameLink from "@/components/HallOfFameLink";
import PageHeader from "@/components/PageHeader";
import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";
import { homeDesignDefaults, homeArtworkOptions } from "@/lib/home-design";
import NewsMarquee from "@/components/NewsMarquee";
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

  const faq = faqSchema(home.seo.faq.length ? home.seo : site.seo);

  return (
    <main>
      <JsonLd data={organizationSchema(content)} />
      <JsonLd data={websiteSchema(content)} />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={home.hero} nav={site.nav} active="/" navigationOnly />
      <section className={styles.landing} aria-labelledby="home-title">
        <Image
          className={styles.artwork}
          src={
            artwork.value === "/brand/logo-white.svg"
              ? artwork.value
              : artwork.value.replace(".svg", "-on-dark.svg")
          }
          alt={artwork.label}
          width={512}
          height={512}
          priority
          sizes="(max-width: 760px) 83vw, 480px"
        />
        <div className={styles.copy}>
        <p className={styles.eyebrow}>{editorial.eyebrow}</p>
        <h1 id="home-title">
          {editorial.headline} <span>{editorial.emphasis}</span>
        </h1>
        <div className={styles.actions}>
          <Link className={styles.button} href="/shows">
            Find a show
          </Link>
          <HallOfFameLink compact />
        </div>
        </div>
      </section>
      <div className={styles.news}>
      <div className={styles.newsBar}><h2>{home.showMarqueeHeading ? home.marqueeHeading : "News"}</h2><Link href="/news">All stories <span aria-hidden="true">/</span></Link></div>
      <NewsMarquee
        compact
        posts={posts}
        settings={content.blogSettings}
        fallbackImage={site.logoUrl}
      />
      </div>
      <div className={styles.signoff}>
        <BrandAccents names={["flash-signpost", "flash-smiley"]} />
        <p>You don’t need tattoos.<br /><span>Questionable judgment will do.</span></p>
      </div>
    </main>
  );
}
