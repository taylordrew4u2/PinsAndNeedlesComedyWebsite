"use client";

import type { Content } from "@/lib/types";
import { More, Section, Select, Text, Toggle } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import {
  homeDesignDefaults,
  homeArtworkOptions,
  type HomeDesign,
} from "@/lib/home-design";
import type { Update } from "../types";

export default function HomeTab({
  content,
  update,
}: {
  content: Content;
  update: Update;
}) {
  const { hero } = content.home;
  const editorial = {
    ...homeDesignDefaults,
    ...hero.editorial,
  };
  const setEditorial = (key: keyof HomeDesign, value: string) =>
    update((d) => {
      d.home.hero.editorial = { ...d.home.hero.editorial, [key]: value };
    });
  const page = {
    page: "home page hero",
    url: "/",
    eyebrow: editorial.eyebrow,
    headline: editorial.headline,
    accent: editorial.emphasis,
  };

  return (
    <>
      <Section icon="🏠" title="The big headline" hint="The first words people see on the homepage.">
        <Text
          label="Small line above the headline"
          value={editorial.eyebrow}
          onChange={(v) => setEditorial("eyebrow", v)}
          ai={{ what: "small heading above the home page headline", about: page }}
        />
        <Text
          label="Headline"
          value={editorial.headline}
          onChange={(v) => setEditorial("headline", v)}
          ai={{ what: "home page headline (the red accent line follows it)", about: page }}
        />
        <Text
          label="Headline — the red part"
          hint="The words that finish the headline, shown in red"
          value={editorial.emphasis}
          onChange={(v) => setEditorial("emphasis", v)}
          ai={{ what: "red accent line that completes the home page headline", about: page }}
        />
        <Select
          label="Artwork next to the headline"
          hint="Pick from your own drawings. Photos belong in News."
          value={editorial.artwork}
          options={homeArtworkOptions}
          onChange={(v) => setEditorial("artwork", v)}
        />
      </Section>

      <div className="mb-6">
        <More title="Logo and name at the top of every page" hint="The header. The menu links are under Site settings.">
          <MediaField
            label="Logo"
            value={hero.logoUrl}
            onChange={(v) => update((d) => void (d.home.hero.logoUrl = v))}
            aspect={1}
            previewHeight={140}
          />
          <Text
            label="Logo description"
            hint="For Google and screen readers"
            value={hero.logoAlt}
            onChange={(v) => update((d) => void (d.home.hero.logoAlt = v))}
            ai={{ what: "site logo alt text", about: { item: "the brand logo in the site header" }, image: hero.logoUrl }}
          />
          <Text
            label="Name shown when there is no logo"
            value={hero.wordmark}
            onChange={(v) => update((d) => void (d.home.hero.wordmark = v))}
          />
        </More>
      </div>

      <div className="mb-6">
        <More title="News strip on the homepage" hint="The row of news covers under the headline. How it looks is under News.">
          <Toggle
            label="Show a heading over the news strip"
            value={content.home.showMarqueeHeading}
            onChange={(v) => update((d) => void (d.home.showMarqueeHeading = v))}
          />
          <Text
            label="That heading"
            value={content.home.marqueeHeading}
            onChange={(v) => update((d) => void (d.home.marqueeHeading = v))}
            ai={{ what: "heading over the news strip on the home page", about: page }}
          />
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for the homepage"
          seo={content.home.seo}
          suggestion={suggestFor(content, "home")}
          about={page}
          onChange={(seo) => update((d) => void (d.home.seo = seo))}
        />
      </div>
    </>
  );
}
