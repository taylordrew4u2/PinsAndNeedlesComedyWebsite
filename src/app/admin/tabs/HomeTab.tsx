"use client";

import type { Content, ReelGridSettings } from "@/lib/types";
import { Num, Row, Section, Text, Toggle } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import { homeDesignDefaults, type HomeDesign } from "@/lib/home-design";
import type { Update } from "../types";

export function GridSettings({
  title,
  hint,
  settings,
  onChange,
}: {
  title: string;
  hint: string;
  settings: ReelGridSettings;
  onChange: (patch: Partial<ReelGridSettings>) => void;
}) {
  return (
    <Section title={title} hint={hint}>
      <Toggle
        label="Show this grid"
        value={settings.enabled}
        onChange={(v) => onChange({ enabled: v })}
      />
      <Row>
        <Num
          label="Columns — desktop"
          value={settings.columnsDesktop}
          min={1}
          max={10}
          onChange={(v) => onChange({ columnsDesktop: v })}
        />
        <Num
          label="Columns — tablet"
          value={settings.columnsTablet}
          min={1}
          max={8}
          onChange={(v) => onChange({ columnsTablet: v })}
        />
        <Num
          label="Columns — mobile"
          value={settings.columnsMobile}
          min={1}
          max={4}
          onChange={(v) => onChange({ columnsMobile: v })}
        />
      </Row>
      <Row>
        <Num
          label="Gap between tiles"
          value={settings.gap}
          min={0}
          max={40}
          suffix="px"
          onChange={(v) => onChange({ gap: v })}
        />
        <Num
          label="Corner radius"
          value={settings.cornerRadius}
          min={0}
          max={32}
          suffix="px"
          onChange={(v) => onChange({ cornerRadius: v })}
        />
      </Row>
      <Toggle
        label="Infinite scroll"
        hint="Keeps loading more reels as you scroll until they run out."
        value={settings.infinite}
        onChange={(v) => onChange({ infinite: v })}
      />
      {settings.infinite ? (
        <Num
          label="Reels loaded per scroll"
          value={settings.pageSize}
          min={2}
          max={40}
          onChange={(v) => onChange({ pageSize: v })}
        />
      ) : (
        <Num
          label="How many reels to show"
          value={settings.limit}
          min={1}
          max={60}
          onChange={(v) => onChange({ limit: v })}
        />
      )}
      <Row>
        <Toggle
          label="Autoplay (always muted)"
          value={settings.autoplay}
          onChange={(v) => onChange({ autoplay: v })}
        />
        <Toggle
          label="Loop"
          value={settings.loop}
          onChange={(v) => onChange({ loop: v })}
        />
        <Toggle
          label="Show captions"
          value={settings.showCaption}
          onChange={(v) => onChange({ showCaption: v })}
        />
      </Row>
    </Section>
  );
}

export default function HomeTab({
  content,
  update,
}: {
  content: Content;
  update: Update;
}) {
  const { hero } = content.home;
  const editorial = { ...homeDesignDefaults, ...hero.editorial };
  const setEditorial = (key: keyof HomeDesign, value: string) =>
    update((d) => {
      d.home.hero.editorial = { ...d.home.hero.editorial, [key]: value };
    });

  return (
    <>
      <Section
        title="Homepage introduction"
        hint="Edit the headline, supporting text, and original photo. Layout and spacing adapt automatically to phones and desktops."
      >
        <Text
          label="Small heading"
          value={editorial.eyebrow}
          onChange={(v) => setEditorial("eyebrow", v)}
        />
        <Row>
          <Text
            label="Headline"
            value={editorial.headline}
            onChange={(v) => setEditorial("headline", v)}
          />
          <Text
            label="Headline — italic accent"
            value={editorial.emphasis}
            onChange={(v) => setEditorial("emphasis", v)}
          />
        </Row>
        <Text
          label="Description"
          value={editorial.description}
          onChange={(v) => setEditorial("description", v)}
        />
        <Text
          label="Note below the show button"
          value={editorial.note}
          onChange={(v) => setEditorial("note", v)}
        />
        <MediaField
          label="Featured photo"
          value={editorial.imageUrl}
          onChange={(v) => setEditorial("imageUrl", v)}
          aspect={1}
          previewHeight={240}
        />
        <Text
          label="Photo description for screen readers"
          value={editorial.imageAlt}
          onChange={(v) => setEditorial("imageAlt", v)}
        />
        <Text
          label="Photo caption"
          value={editorial.caption}
          onChange={(v) => setEditorial("caption", v)}
        />
        <MediaField
          label="Featured video (optional)"
          hint="Replaces the photo with a video visitors can play. Clear this field to show the photo."
          accept="video/*"
          value={hero.backgroundVideoUrl}
          onChange={(v) =>
            update((d) => void (d.home.hero.backgroundVideoUrl = v))
          }
        />
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
        />
        <Text
          label="Name shown when no logo is selected"
          value={hero.wordmark}
          onChange={(v) => update((d) => void (d.home.hero.wordmark = v))}
        />
      </Section>

      <GridSettings
        title="Reels grid — above the news"
        hint="9:16 tiles that autoplay muted. Clicking one opens Instagram."
        settings={content.home.reelsTop}
        onChange={(patch) =>
          update((d) => void Object.assign(d.home.reelsTop, patch))
        }
      />

      <Section
        title="Latest stories"
        hint="The three newest published posts appear on the homepage. All posts remain available on the News page."
      >
        <Toggle
          label="Show the stories heading"
          value={content.home.showMarqueeHeading}
          onChange={(v) => update((d) => void (d.home.showMarqueeHeading = v))}
        />
        <Text
          label="Heading"
          value={content.home.marqueeHeading}
          onChange={(v) => update((d) => void (d.home.marqueeHeading = v))}
        />
      </Section>

      <GridSettings
        title="Reels grid — below the news"
        hint="Same tiles, set to infinite scroll so it keeps loading until you run out of reels."
        settings={content.home.reelsBottom}
        onChange={(patch) =>
          update((d) => void Object.assign(d.home.reelsBottom, patch))
        }
      />

      <SeoEditor
        title="Home page SEO & AI SEO"
        seo={content.home.seo}
        suggestion={suggestFor(content, "home")}
        onChange={(seo) => update((d) => void (d.home.seo = seo))}
      />
    </>
  );
}
