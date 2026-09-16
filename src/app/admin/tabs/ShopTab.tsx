"use client";

import type { Content } from "@/lib/types";
import { Area, More, Num, Row, Section, Steps, Text } from "../ui";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

const page = { page: "merch shop", url: "/shop" };

export default function ShopTab({ content, update }: { content: Content; update: Update }) {
  const { shop } = content;

  return (
    <>
      <Section icon="🛍️" title="Shop" hint="Paste your Shopify code once and the shop shows up on /shop.">
        <Area
          label="Shopify code"
          hint="Paste the whole snippet. Scripts run, so Shopify's own Buy Button code works as-is. An iframe from any other store works too."
          rows={10}
          value={shop.embedHtml}
          placeholder='<div id="collection-component-…"></div><script type="text/javascript">…</script>'
          onChange={(v) => update((d) => void (d.shop.embedHtml = v))}
        />
        <More title="Where to get the code">
          <Steps>
            <li>
              Shopify admin → <span className="text-neutral-100">Sales channels → Buy Button</span> →
              create a collection or product button.
            </li>
            <li>
              Choose your layout, then hit <span className="text-neutral-100">Next → Copy code</span>.
            </li>
            <li>Paste the whole thing in the box above. It saves itself.</li>
          </Steps>
        </More>
        <Row>
          <Text
            label="Link to your store"
            hint="Shown under the shop as a backup"
            placeholder="https://"
            value={shop.storefrontUrl}
            onChange={(v) => update((d) => void (d.shop.storefrontUrl = v))}
          />
          <Text
            label="What that button says"
            value={shop.storefrontLabel}
            onChange={(v) => update((d) => void (d.shop.storefrontLabel = v))}
            ai={{ what: "button label linking out to the storefront", about: { ...page, storefront: shop.storefrontUrl } }}
          />
        </Row>
      </Section>

      <div className="mb-6">
        <More title="Page heading, intro and size" hint="The words at the top of /shop">
          <Text
            label="Heading"
            value={shop.heading}
            onChange={(v) => update((d) => void (d.shop.heading = v))}
            ai={{ what: "shop page heading", about: page }}
          />
          <Area
            label="Intro"
            rows={2}
            value={shop.intro}
            onChange={(v) => update((d) => void (d.shop.intro = v))}
            ai={{ what: "shop page intro", about: page }}
          />
          <Num
            label="Minimum height of the shop box"
            value={shop.embedHeight}
            min={200}
            max={4000}
            step={50}
            suffix="px"
            onChange={(v) => update((d) => void (d.shop.embedHeight = v))}
          />
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for the Shop page"
          seo={shop.seo}
          suggestion={suggestFor(content, "shop")}
          about={{ ...page, intro: shop.intro }}
          onChange={(seo) => update((d) => void (d.shop.seo = seo))}
        />
      </div>
    </>
  );
}
