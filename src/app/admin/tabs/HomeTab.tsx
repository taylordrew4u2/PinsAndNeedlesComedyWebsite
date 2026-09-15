"use client";

import type { Content } from "@/lib/types";
import { Row, Section, Select, Text, Toggle } from "../ui";
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
      <Section
        title="Homepage introduction"
        hint="Edit the headline and supporting text. Choose from your supplied vector artwork; photographs belong in News."
      >
        <Select
          label="Featured vector artwork"
          value={editorial.artwork}
          options={homeArtworkOptions}
          onChange={(v) => setEditorial("artwork", v)}
        />
        <Text
          label="Small heading"
          value={editorial.eyebrow}
          onChange={(v) => setEditorial("eyebrow", v)}
          ai={{ what: "small heading above the home page headline", about: page }}
        />
        <Row>
          <Text
            label="Headline"
            value={editorial.headline}
            onChange={(v) => setEditorial("headline", v)}
            ai={{ what: "home page headline (the red accent line follows it)", about: page }}
          />
          <Text
            label="Headline — red accent"
            value={editorial.emphasis}
            onChange={(v) => setEditorial("emphasis", v)}
            ai={{ what: "red accent line that completes the home page headline", about: page }}
          />
        </Row>
      </Section>
      <Section
        title="Header branding"
        hint="Shown across public pages. Edit navigation links under Site → Navigation."
      >
        <MediaField
          label="Logo"
          value={hero.logoUrl}
          onChange={(v) => update((d) => void (d.home.hero.logoUrl = v))}
          aspect={1}
          previewHeight={140}
        />
        <Text
          label="Logo alt text"
          value={hero.logoAlt}
          onChange={(v) => update((d) => void (d.home.hero.logoAlt = v))}
          ai={{ what: "site logo alt text", about: { item: "the brand logo in the site header" }, image: hero.logoUrl }}
        />
        <Text
          label="Name shown when no logo is selected"
          value={hero.wordmark}
          onChange={(v) => update((d) => void (d.home.hero.wordmark = v))}
        />
      </Section>

      <Section
        title="News strip"
        hint="Horizontal news covers on the homepage. Adjust the strip under News → Display."
      >
        <Toggle
          label="Show the news heading"
          value={content.home.showMarqueeHeading}
          onChange={(v) => update((d) => void (d.home.showMarqueeHeading = v))}
        />
        <Text
          label="News heading"
          value={content.home.marqueeHeading}
          onChange={(v) => update((d) => void (d.home.marqueeHeading = v))}
          ai={{ what: "heading over the news strip on the home page", about: page }}
        />
      </Section>

      <SeoEditor
        title="Home page SEO & AI SEO"
        seo={content.home.seo}
        suggestion={suggestFor(content, "home")}
        about={page}
        onChange={(seo) => update((d) => void (d.home.seo = seo))}
      />
    </>
  );
}
