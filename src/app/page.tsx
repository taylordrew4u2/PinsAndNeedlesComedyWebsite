import type { Metadata } from "next";
import HeroPanel from "@/components/HeroPanel";
import ReelGrid from "@/components/ReelGrid";
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

      <ReelGrid reels={content.reels} settings={home.reelsTop} instagramUrl={instagramUrl} />

      {home.showMarqueeHeading ? (
        <h2 className="px-4 pb-2 pt-6 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
          {home.marqueeHeading}
        </h2>
      ) : null}
      <NewsMarquee posts={posts} settings={blogSettings} fallbackImage={site.logoUrl} />

      {content.reels.some((reel) => reel.published) || !home.reelsTop.enabled ? (
        <ReelGrid reels={content.reels} settings={home.reelsBottom} instagramUrl={instagramUrl} />
      ) : null}

    </main>
  );
}
