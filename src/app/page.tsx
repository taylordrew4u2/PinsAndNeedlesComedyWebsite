import Link from "next/link";
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

      <section aria-labelledby="home-brand-heading" className="border-t border-white/10 px-5 py-8 sm:py-10">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 sm:gap-12">
          <h2 id="home-brand-heading" className="max-w-sm text-xl leading-tight sm:text-2xl">
            Comedy about the things<br className="hidden sm:block" /> that leave a mark.
          </h2>
          <div className="max-w-lg text-sm leading-relaxed text-[var(--pnc-muted)]">
            <p>Original stand-up shows in New York City. You don’t need tattoos. Questionable judgment will do.</p>
            <Link href="/about" className="mt-3 inline-block text-[var(--pnc-fg)] underline underline-offset-4 hover:text-[var(--pnc-accent)]">
              More about Pins &amp; Needles <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
