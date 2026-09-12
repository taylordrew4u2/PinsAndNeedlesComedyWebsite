import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import ShopEmbed from "@/components/ShopEmbed";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, shop } = await getContent();
  return await toMetadata(site, shop.seo, "/shop");
}

export default async function ShopPage() {
  const content = await getContent();
  const { site, shop } = content;
  const faq = faqSchema(shop.seo);

  return (
    <main>
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: shop.heading, path: "/shop" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/shop" />
      <BrandAccents names={["flash-lipstick"]}  />

      <section className="mx-auto max-w-6xl px-5 pb-6 pt-8">
        <h1 className="text-3xl sm:text-4xl">{shop.heading}</h1>
        {shop.intro ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--pnc-muted)]">
            {shop.intro}
          </p>
        ) : null}
      </section>

      <ShopEmbed shop={shop} />

      {shop.storefrontUrl ? (
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-8">
          <a
            href={shop.storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-white/25 px-6 py-3 text-[11px] uppercase tracking-[0.28em] transition-colors hover:border-white hover:bg-white hover:text-black"
          >
            {shop.storefrontLabel || "Open the full store"}
          </a>
        </div>
      ) : null}
      <BrandAccents names={["flash-lighter", "flash-disco-ball"]} />
    </main>
  );
}
