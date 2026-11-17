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
      <Section
        icon="🛍️"
        title="Shop"
        hint="Products come straight from Printify. Add, price or hide a product in Printify and /shop updates within 5 minutes."
      >
        <More title="How the shop works">
          <Steps>
            <li>
              Every visible product in your Printify <span className="text-neutral-100">API shop</span> shows on /shop
              with its Printify price.
            </li>
            <li>People pay with a card through Stripe on this site.</li>
            <li>Once paid, the order goes to Printify automatically, gets printed and ships to them.</li>
          </Steps>
        </More>
        <More title="Backup: paste embed code" hint="Only shown if Printify isn't connected">
          <Area
            label="Embed code"
            hint="An iframe or HTML snippet from another store. Scripts run."
            rows={8}
            value={shop.embedHtml}
            placeholder="<iframe …></iframe>"
            onChange={(v) => update((d) => void (d.shop.embedHtml = v))}
          />
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
