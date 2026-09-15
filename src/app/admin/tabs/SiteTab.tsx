"use client";

import type { Content } from "@/lib/types";
import { Area, Button, Card, Color, Row, Section, Text, Toggle } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

const FONTS = [
  "'Archivo Black', 'Arial Black', system-ui, sans-serif",
  "'Inter', system-ui, -apple-system, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Courier New', ui-monospace, monospace",
  "Impact, 'Haettenschweiler', sans-serif",
  "system-ui, sans-serif",
];

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Text label={label} value={value} onChange={onChange} hint="CSS font-family stack" />
      <div className="mt-2 flex flex-wrap gap-2">
        {FONTS.map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange(font)}
            className="rounded border border-neutral-700 px-2 py-1 text-[12px] text-neutral-300 hover:border-neutral-400"
            style={{ fontFamily: font }}
          >
            {font.split(",")[0].replace(/'/g, "")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SiteTab({ content, update }: { content: Content; update: Update }) {
  const { site } = content;

  return (
    <>
      <Section title="Identity" hint="Used across every page, the browser tab and social shares.">
        <Row>
          <Text label="Site name" value={site.name} onChange={(v) => update((d) => void (d.site.name = v))} />
          <Text label="Short name" value={site.shortName} onChange={(v) => update((d) => void (d.site.shortName = v))} />
        </Row>
        <Text
          label="Tagline"
          value={site.tagline}
          onChange={(v) => update((d) => void (d.site.tagline = v))}
          ai={{ what: "site-wide tagline", about: { page: "the whole site" } }}
        />
        <Text
          label="Public URL"
          value={site.url}
          onChange={(v) => update((d) => void (d.site.url = v.replace(/\/+$/, "")))}
          hint="no trailing slash — drives canonicals, sitemap and RSS"
        />
        <Row>
          <MediaField
            label="Logo"
            value={site.logoUrl}
            onChange={(v) => update((d) => void (d.site.logoUrl = v))}
            aspect={1}
          />
          <MediaField
            label="Favicon"
            value={site.faviconUrl}
            onChange={(v) => update((d) => void (d.site.faviconUrl = v))}
            aspect={1}
            previewHeight={64}
          />
        </Row>
        <Row>
          <Text
            label="Instagram handle"
            value={site.instagramHandle}
            onChange={(v) => update((d) => void (d.site.instagramHandle = v.replace(/^@/, "")))}
          />
          <Text
            label="Founded"
            value={site.foundingYear}
            onChange={(v) => update((d) => void (d.site.foundingYear = v))}
          />
        </Row>
      </Section>

      <Section title="Colors & type" hint="Applied site-wide as CSS variables.">
        <Row>
          <Color label="Background" value={site.background} onChange={(v) => update((d) => void (d.site.background = v))} />
          <Color label="Text" value={site.foreground} onChange={(v) => update((d) => void (d.site.foreground = v))} />
          <Color label="Accent" value={site.accent} onChange={(v) => update((d) => void (d.site.accent = v))} />
          <Color label="Muted text" value={site.muted} onChange={(v) => update((d) => void (d.site.muted = v))} />
        </Row>
        <FontPicker
          label="Heading font"
          value={site.headingFont}
          onChange={(v) => update((d) => void (d.site.headingFont = v))}
        />
        <FontPicker
          label="Body font"
          value={site.bodyFont}
          onChange={(v) => update((d) => void (d.site.bodyFont = v))}
        />
      </Section>

      <Section title="Navigation" hint="The words under the logo, in order.">
        {site.nav.map((item, index) => (
          <Card key={item.id} title={item.label} subtitle={item.href}>
            <Row>
              <Text
                label="Label"
                value={item.label}
                onChange={(v) => update((d) => void (d.site.nav[index].label = v))}
              />
              <Text
                label="Link"
                value={item.href}
                onChange={(v) => update((d) => void (d.site.nav[index].href = v))}
              />
            </Row>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  update((d) => {
                    if (index === 0) return;
                    [d.site.nav[index - 1], d.site.nav[index]] = [d.site.nav[index], d.site.nav[index - 1]];
                  })
                }
              >
                Move up
              </Button>
              <Button
                onClick={() =>
                  update((d) => {
                    if (index >= d.site.nav.length - 1) return;
                    [d.site.nav[index + 1], d.site.nav[index]] = [d.site.nav[index], d.site.nav[index + 1]];
                  })
                }
              >
                Move down
              </Button>
              <Button tone="danger" onClick={() => update((d) => void d.site.nav.splice(index, 1))}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
        <Button
          onClick={() =>
            update((d) =>
              void d.site.nav.push({ id: `nav-${Date.now().toString(36)}`, label: "New link", href: "/" })
            )
          }
        >
          Add nav item
        </Button>
      </Section>

      <Section title="Social links">
        {site.socials.map((social, index) => (
          <Card key={social.id} title={social.label} subtitle={social.url}>
            <Row>
              <Text
                label="Label"
                value={social.label}
                onChange={(v) => update((d) => void (d.site.socials[index].label = v))}
              />
              <Text
                label="URL"
                value={social.url}
                onChange={(v) => update((d) => void (d.site.socials[index].url = v))}
              />
            </Row>
            <Button tone="danger" onClick={() => update((d) => void d.site.socials.splice(index, 1))}>
              Remove
            </Button>
          </Card>
        ))}
        <Button
          onClick={() =>
            update((d) =>
              void d.site.socials.push({ id: `soc-${Date.now().toString(36)}`, label: "New", url: "" })
            )
          }
        >
          Add social link
        </Button>
      </Section>

      <Section title="Footer">
        <Toggle
          label="Show footer"
          value={site.showFooter}
          onChange={(v) => update((d) => void (d.site.showFooter = v))}
        />
        <Area
          label="Footer text"
          rows={2}
          value={site.footerText}
          onChange={(v) => update((d) => void (d.site.footerText = v))}
          ai={{ what: "footer text (one line, may include a copyright)", about: { page: "the whole site", founded: site.foundingYear } }}
        />
      </Section>

      <SeoEditor
        title="Site-wide SEO defaults"
        hint="Used anywhere a page has not set its own. Also feeds the organization structured data and llms.txt."
        seo={site.seo}
        suggestion={suggestFor(content, "site")}
        about={{ page: "site-wide defaults for every page", url: "/" }}
        onChange={(seo) => update((d) => void (d.site.seo = seo))}
      />
    </>
  );
}
