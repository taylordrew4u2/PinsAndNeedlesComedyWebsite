import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { aspectValue, formatDate } from "@/lib/render";
import { blogSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, news } = await getContent();
  return await toMetadata(site, news.seo, "/news");
}

export default async function NewsIndexPage() {
  const content = await getContent();
  const { site, news, blogSettings } = content;

  const posts = [...content.posts]
    .filter((post) => post.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const ratio = aspectValue(blogSettings.coverAspect);
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

      <section className="mx-auto max-w-6xl px-5 pb-4 pt-8">
        <h1 className="text-3xl sm:text-4xl">{news.heading}</h1>
        {news.intro ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--pnc-muted)]">
            {news.intro}
          </p>
        ) : null}
      </section>

      <section
        className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{ gap: blogSettings.gap }}
      >
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/news/${post.slug}`}
            className="group relative block overflow-hidden bg-neutral-950"
            style={{ aspectRatio: `${ratio}`, borderRadius: blogSettings.cornerRadius || undefined }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverUrl || site.logoUrl}
              alt={post.coverAlt || post.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
              style={{
                objectFit: blogSettings.imageFit,
                opacity: post.coverUrl ? 1 : 0.3,
                padding: post.coverUrl ? 0 : "20%",
              }}
            />
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ padding: blogSettings.titlePadding }}
            >
              <span
                className="mb-1 block uppercase opacity-70"
                style={{ fontSize: Math.max(9, blogSettings.titleSize - 5), letterSpacing: "0.18em" }}
              >
                {formatDate(post.date)}
              </span>
              <span
                className="block leading-tight"
                style={{
                  fontFamily: blogSettings.titleFont,
                  fontSize: blogSettings.titleSize,
                  fontWeight: blogSettings.titleWeight,
                  color: blogSettings.titleColor,
                  textAlign: blogSettings.titleAlign,
                  textTransform: blogSettings.titleTransform,
                }}
              >
                {post.title}
              </span>
            </span>
          </Link>
        ))}
      </section>

      {posts.length === 0 ? (
        <p className="mx-auto max-w-6xl px-5 py-16 text-[var(--pnc-muted)]">
          No posts yet.
        </p>
      ) : null}
    </main>
  );
}
