"use client";

import type { Content } from "@/lib/types";
import { Area, Num, Section, Text } from "../ui";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

export default function ShopTab({ content, update }: { content: Content; update: Update }) {
  const { shop } = content;

  return (
    <>
      <Section title="Shop page">
        <Text
          label="Heading"
          value={shop.heading}
          onChange={(v) => update((d) => void (d.shop.heading = v))}
          ai={{ what: "shop page heading", about: { page: "merch shop", url: "/shop" } }}
        />
        <Area
          label="Intro"
          rows={2}
          value={shop.intro}
          onChange={(v) => update((d) => void (d.shop.intro = v))}
          ai={{ what: "shop page intro", about: { page: "merch shop", url: "/shop" } }}
        />
      </Section>

      <Section
        title="Shopify embed"
        hint="Paste your embed code here and it renders on /shop. Scripts are executed, so Shopify's own Buy Button snippet works as-is."
      >
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-[13px] leading-relaxed text-neutral-400">
          <p className="mb-2 text-neutral-200">Where to get the code</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Shopify admin → <span className="text-neutral-200">Sales channels → Buy Button</span> →
              create a collection or product button.
            </li>
            <li>
              Choose your layout, then hit <span className="text-neutral-200">Next → Copy code</span>.
            </li>
            <li>Paste the whole snippet below. It saves itself.</li>
          </ol>
          <p className="mt-3">
            An <code className="text-neutral-200">&lt;iframe&gt;</code> from any other storefront works
            here too.
          </p>
        </div>
        <Area
          label="Embed code"
          rows={12}
          value={shop.embedHtml}
          placeholder='<div id="collection-component-…"></div><script type="text/javascript">…</script>'
          onChange={(v) => update((d) => void (d.shop.embedHtml = v))}
        />
        <Num
          label="Minimum embed height"
          value={shop.embedHeight}
          min={200}
          max={4000}
          step={50}
          suffix="px"
          onChange={(v) => update((d) => void (d.shop.embedHeight = v))}
        />
      </Section>

      <Section title="Link out" hint="Shown under the embed as a fallback.">
        <Text
          label="Storefront URL"
          value={shop.storefrontUrl}
          onChange={(v) => update((d) => void (d.shop.storefrontUrl = v))}
        />
        <Text
          label="Button label"
          value={shop.storefrontLabel}
          onChange={(v) => update((d) => void (d.shop.storefrontLabel = v))}
          ai={{ what: "button label linking out to the storefront", about: { page: "merch shop", storefront: shop.storefrontUrl } }}
        />
      </Section>

      <SeoEditor
        title="Shop SEO & AI SEO"
        seo={shop.seo}
        suggestion={suggestFor(content, "shop")}
        about={{ page: "merch shop", url: "/shop", intro: shop.intro }}
        onChange={(seo) => update((d) => void (d.shop.seo = seo))}
      />
    </>
  );
}
