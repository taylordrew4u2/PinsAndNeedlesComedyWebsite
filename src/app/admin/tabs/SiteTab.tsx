"use client";

import type { Content } from "@/lib/types";
import { Actions, Area, Button, Card, Color, More, Row, Section, Text, Toggle, confirmDelete } from "../ui";
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
    <div className="min-w-0">
      <Text label={label} value={value} onChange={onChange} hint="Tap one below, or type a CSS font-family" />
      <div className="mt-2 flex flex-wrap gap-2">
        {FONTS.map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange(font)}
            aria-pressed={font === value}
            className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-[15px] transition-colors ${
              font === value
                ? "border-white bg-white text-black"
                : "border-neutral-700 text-neutral-200 hover:border-neutral-400"
            }`}
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
      <Section icon="⚙️" title="Site settings" hint="Things that apply to every page.">
        <Row>
          <Text label="Site name" value={site.name} onChange={(v) => update((d) => void (d.site.name = v))} />
          <Text
            label="Instagram handle"
            hint="Without the @"
            value={site.instagramHandle}
            onChange={(v) => update((d) => void (d.site.instagramHandle = v.replace(/^@/, "")))}
          />
        </Row>
        <Text
          label="Tagline"
          hint="One line that says what the show is"
          value={site.tagline}
          onChange={(v) => update((d) => void (d.site.tagline = v))}
          ai={{ what: "site-wide tagline", about: { page: "the whole site" } }}
        />
        <MediaField
          label="Logo"
          value={site.logoUrl}
          onChange={(v) => update((d) => void (d.site.logoUrl = v))}
          aspect={1}
        />
      </Section>

      <div className="mb-6">
        <More title="Colors & fonts" hint="Applied to every page">
          <Row>
            <Color label="Background" value={site.background} onChange={(v) => update((d) => void (d.site.background = v))} />
            <Color label="Text" value={site.foreground} onChange={(v) => update((d) => void (d.site.foreground = v))} />
            <Color label="Accent (the red)" value={site.accent} onChange={(v) => update((d) => void (d.site.accent = v))} />
            <Color label="Quieter text" value={site.muted} onChange={(v) => update((d) => void (d.site.muted = v))} />
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
        </More>
      </div>

      <div className="mb-6">
        <More title={`Menu at the top of the site (${site.nav.length})`} hint="The words under the logo, in order">
          {site.nav.map((item, index) => (
            <Card key={item.id} title={item.label} subtitle={item.href}>
              <Row>
                <Text
                  label="Words"
                  value={item.label}
                  onChange={(v) => update((d) => void (d.site.nav[index].label = v))}
                />
                <Text
                  label="Goes to"
                  hint="For example: /shows"
                  value={item.href}
                  onChange={(v) => update((d) => void (d.site.nav[index].href = v))}
                />
              </Row>
              <Actions>
                <Button
                  disabled={index === 0}
                  onClick={() =>
                    update((d) => {
                      if (index === 0) return;
                      [d.site.nav[index - 1], d.site.nav[index]] = [d.site.nav[index], d.site.nav[index - 1]];
                    })
                  }
                >
                  ↑ Move up
                </Button>
                <Button
                  disabled={index >= site.nav.length - 1}
                  onClick={() =>
                    update((d) => {
                      if (index >= d.site.nav.length - 1) return;
                      [d.site.nav[index + 1], d.site.nav[index]] = [d.site.nav[index], d.site.nav[index + 1]];
                    })
                  }
                >
                  ↓ Move down
                </Button>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(`the “${item.label}” menu link`)) return;
                    update((d) => void d.site.nav.splice(index, 1));
                  }}
                >
                  Remove
                </Button>
              </Actions>
            </Card>
          ))}
          <div>
            <Button
              onClick={() =>
                update((d) =>
                  void d.site.nav.push({ id: `nav-${Date.now().toString(36)}`, label: "New link", href: "/" })
                )
              }
            >
              ➕ Add a menu link
            </Button>
          </div>
        </More>
      </div>

      <div className="mb-6">
        <More title={`Social links (${site.socials.length})`} hint="Shown in the footer">
          {site.socials.map((social, index) => (
            <Card key={social.id} title={social.label} subtitle={social.url}>
              <Row>
                <Text
                  label="Words"
                  value={social.label}
                  onChange={(v) => update((d) => void (d.site.socials[index].label = v))}
                />
                <Text
                  label="Link"
                  placeholder="https://"
                  value={social.url}
                  onChange={(v) => update((d) => void (d.site.socials[index].url = v))}
                />
              </Row>
              <Actions>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(`the “${social.label}” link`)) return;
                    update((d) => void d.site.socials.splice(index, 1));
                  }}
                >
                  Remove
                </Button>
              </Actions>
            </Card>
          ))}
          <div>
            <Button
              onClick={() =>
                update((d) =>
                  void d.site.socials.push({ id: `soc-${Date.now().toString(36)}`, label: "New", url: "" })
                )
              }
            >
              ➕ Add a social link
            </Button>
          </div>
        </More>
      </div>

      <div className="mb-6">
        <More title="Footer" hint="The line at the very bottom of every page">
          <Toggle
            label="Show the footer"
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
        </More>
      </div>

      <div className="mb-6">
        <More title="Technical details" hint="Short name, web address, browser-tab icon, year founded">
          <Row>
            <Text
              label="Short name"
              hint="For the phone home screen"
              value={site.shortName}
              onChange={(v) => update((d) => void (d.site.shortName = v))}
            />
            <Text
              label="Year founded"
              value={site.foundingYear}
              onChange={(v) => update((d) => void (d.site.foundingYear = v))}
            />
          </Row>
          <Text
            label="Public web address"
            value={site.url}
            onChange={(v) => update((d) => void (d.site.url = v.replace(/\/+$/, "")))}
            hint="No slash at the end. Used for Google, the sitemap and RSS."
          />
          <MediaField
            label="Browser-tab icon (favicon)"
            value={site.faviconUrl}
            onChange={(v) => update((d) => void (d.site.faviconUrl = v))}
            aspect={1}
            previewHeight={64}
          />
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for the whole site"
          hint="Used anywhere a page has not set its own. Also feeds the organization data and llms.txt."
          seo={site.seo}
          suggestion={suggestFor(content, "site")}
          about={{ page: "site-wide defaults for every page", url: "/" }}
          onChange={(seo) => update((d) => void (d.site.seo = seo))}
        />
      </div>
    </>
  );
}
