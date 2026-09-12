import PageIntro from "@/components/PageIntro";
import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import styles from "./news.module.css";
import { formatDate } from "@/lib/render";
import { blogSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, news } = await getContent();
  return await toMetadata(site, news.seo, "/news");
}

export default async function NewsIndexPage() {
  const content = await getContent();
  const { site, news } = content;

  const posts = [...content.posts]
    .filter((post) => post.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const faq = faqSchema(news.seo);

  return (
    <main>
      <JsonLd data={blogSchema(content)} />
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: news.heading, path: "/news" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/news" />
      <PageIntro
        title={news.heading}
        description={news.intro}
        artwork="flash-pizza"
      />

      <section className={styles.grid} aria-label="News articles">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/news/${post.slug}`}
            className={styles.card}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverUrl || site.logoUrl}
              alt={post.coverAlt || post.title}
              className={styles.cover}
              loading="lazy"
            />
            <div className={styles.copy}>
              <time className={styles.date} dateTime={post.date}>
                {formatDate(post.date)}
              </time>
              <h2 className={styles.title}>{post.title}</h2>
            </div>
          </Link>
        ))}
      </section>

      {posts.length === 0 ? (
        <p className="mx-auto max-w-6xl px-5 py-16 text-[var(--pnc-muted)]">
          No posts yet.
        </p>
      ) : null}
      <BrandAccents names={["flash-trash-fire"]} />
    </main>
  );
}
