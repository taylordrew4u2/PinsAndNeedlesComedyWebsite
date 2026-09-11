import Link from "next/link";
import { renderBody } from "@/lib/render";
import type { Metadata } from "next";
import HeroPanel from "@/components/HeroPanel";
import ReelGrid from "@/components/ReelGrid";
import NewsMarquee from "@/components/NewsMarquee";
import WeeklyStrip from "@/components/WeeklyStrip";
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
  const { site, home, blogSettings } = content;

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

      <HeroPanel hero={home.hero} nav={site.nav} active="/" />

      <section aria-label="About Pins & Needles Comedy" className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div
          className="pnc-prose text-lg leading-relaxed sm:text-xl"
          dangerouslySetInnerHTML={{ __html: renderBody(content.about.story.split(/\n\s*\n/)[0]) }}
        />
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--pnc-muted)]">
          From our original tattoo-focused show to Bad Decisions, we’re interested in
          the version of the story you usually clean up before telling people.
        </p>
        <p className="mt-6 text-lg">You don’t need tattoos. Questionable judgment will do.</p>
        <div className="mt-8 flex flex-wrap gap-6 text-sm">
          <Link href="/shows" className="underline underline-offset-4 hover:text-[var(--pnc-accent)]">Find a show</Link>
          <Link href="/about" className="underline underline-offset-4 hover:text-[var(--pnc-accent)]">What we’re about</Link>
        </div>
      </section>

      {content.weekly.enabled && content.weekly.showOnHome ? (
        <WeeklyStrip weekly={content.weekly} text={content.weekly.homeStripText} />
      ) : null}

      <ReelGrid reels={content.reels} settings={home.reelsTop} instagramUrl={instagramUrl} />

      {home.showMarqueeHeading ? (
        <h2 className="px-4 pb-2 pt-6 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
          {home.marqueeHeading}
        </h2>
      ) : null}
      <NewsMarquee posts={posts} settings={blogSettings} fallbackImage={site.logoUrl} />

      <ReelGrid reels={content.reels} settings={home.reelsBottom} instagramUrl={instagramUrl} />
    </main>
  );
}
