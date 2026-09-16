"use client";

import type { Content } from "@/lib/types";
import { Actions, Area, Button, Card, More, Note, Num, Row, Section, Text, confirmDelete } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

const page = { page: "about the show and the people who run it", url: "/about" };

export default function AboutTab({ content, update }: { content: Content; update: Update }) {
  const { about } = content;

  return (
    <>
      <Section icon="👋" title="About page" hint="Your story, in your words.">
        <Text
          label="Heading"
          value={about.heading}
          onChange={(v) => update((d) => void (d.about.heading = v))}
          ai={{ what: "about page heading", about: page }}
        />
        <Text
          label="Intro line"
          value={about.intro}
          onChange={(v) => update((d) => void (d.about.intro = v))}
          ai={{ what: "about page intro line", about: page }}
        />
        <Area
          label="Our story"
          hint="Blank line = new paragraph. ## for a heading, - for a bullet, **bold**"
          rows={12}
          value={about.story}
          onChange={(v) => update((d) => void (d.about.story = v))}
          ai={{ what: "our story (about page body)", about: page }}
        />
      </Section>

      <Section
        icon="🧑‍🤝‍🧑"
        title={`Producers (${about.producers.length})`}
        hint="The people who run the show. Headshot on the left, bio on the right."
      >
        <div>
          <Button size="big" tone="primary" onClick={() =>
            update((d) =>
              void d.about.producers.push({
                id: `producer-${Date.now().toString(36)}`,
                name: "",
                role: "Producer",
                headshotUrl: "",
                headshotAlt: "",
                bio: "",
                links: [],
              })
            )
          }>
            ➕ Add a producer
          </Button>
        </div>

        {about.producers.length === 0 ? <Note>No producers listed yet.</Note> : null}

        {about.producers.map((producer, index) => (
          <Card
            key={producer.id}
            title={producer.name || `Producer ${index + 1}`}
            subtitle={producer.role}
            defaultOpen={!producer.name.trim()}
          >
            <Row>
              <Text
                label="Name"
                value={producer.name}
                onChange={(v) => update((d) => void (d.about.producers[index].name = v))}
              />
              <Text
                label="Role"
                value={producer.role}
                onChange={(v) => update((d) => void (d.about.producers[index].role = v))}
                ai={{ what: "producer role title", about: { person: producer.name, bio: producer.bio } }}
              />
            </Row>
            <MediaField
              label="Headshot"
              hint="Cropped square"
              value={producer.headshotUrl}
              onChange={(v) => update((d) => void (d.about.producers[index].headshotUrl = v))}
              aspect={1}
              previewHeight={140}
            />
            <Area
              label="Bio"
              rows={6}
              value={producer.bio}
              onChange={(v) => update((d) => void (d.about.producers[index].bio = v))}
              ai={{
                what: "producer bio",
                about: { person: producer.name, role: producer.role, links: producer.links.map((l) => l.url) },
              }}
            />

            <More title={`Links (${producer.links.length}) and photo description`} hint="Instagram, website, and the headshot's description">
              <Text
                label="Headshot description"
                hint="For Google and screen readers"
                value={producer.headshotAlt}
                onChange={(v) => update((d) => void (d.about.producers[index].headshotAlt = v))}
                ai={{
                  what: "headshot alt text",
                  about: { person: producer.name, role: producer.role },
                  image: producer.headshotUrl,
                }}
              />
              {producer.links.map((link, linkIndex) => (
                <Row key={link.id}>
                  <Text
                    label="What the link says"
                    value={link.label}
                    onChange={(v) => update((d) => void (d.about.producers[index].links[linkIndex].label = v))}
                  />
                  <Text
                    label="Link"
                    placeholder="https://"
                    value={link.url}
                    onChange={(v) => update((d) => void (d.about.producers[index].links[linkIndex].url = v))}
                  />
                  <div className="flex items-end">
                    <Button
                      tone="danger"
                      onClick={() => {
                        if (!confirmDelete(`the “${link.label}” link`)) return;
                        update((d) => void d.about.producers[index].links.splice(linkIndex, 1));
                      }}
                    >
                      Remove link
                    </Button>
                  </div>
                </Row>
              ))}
              <div>
                <Button
                  onClick={() =>
                    update((d) =>
                      void d.about.producers[index].links.push({
                        id: `link-${Date.now().toString(36)}`,
                        label: "Instagram",
                        url: "",
                      })
                    )
                  }
                >
                  ➕ Add a link
                </Button>
              </div>
            </More>

            <Actions>
              <Button
                disabled={index === 0}
                onClick={() =>
                  update((d) => {
                    if (index === 0) return;
                    [d.about.producers[index - 1], d.about.producers[index]] = [
                      d.about.producers[index],
                      d.about.producers[index - 1],
                    ];
                  })
                }
              >
                ↑ Move up
              </Button>
              <Button
                disabled={index >= about.producers.length - 1}
                onClick={() =>
                  update((d) => {
                    if (index >= d.about.producers.length - 1) return;
                    [d.about.producers[index + 1], d.about.producers[index]] = [
                      d.about.producers[index],
                      d.about.producers[index + 1],
                    ];
                  })
                }
              >
                ↓ Move down
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  if (!confirmDelete(producer.name || "this producer")) return;
                  update((d) => void d.about.producers.splice(index, 1));
                }}
              >
                Remove producer
              </Button>
            </Actions>
          </Card>
        ))}

        <More title="Producers section settings" hint="The heading over this section and how zoomed the headshots are">
          <Text
            label="Section heading"
            value={about.producersHeading}
            onChange={(v) => update((d) => void (d.about.producersHeading = v))}
            ai={{ what: "heading over the producers section", about: page }}
          />
          <Num
            label="Headshot zoom"
            value={about.producerImageSize}
            min={100}
            max={200}
            suffix="%"
            onChange={(v) => update((d) => void (d.about.producerImageSize = v))}
          />
        </More>
      </Section>

      <div className="mb-6">
        <More
          title={`Logo gallery (${about.logos.length})`}
          hint="Every version of the logo on the About page, and how the grid looks"
        >
          {about.logos.map((logo, index) => (
            <Card key={logo.id} title={logo.caption || `Logo ${index + 1}`} subtitle={logo.alt}>
              <MediaField
                label="Picture"
                value={logo.url}
                onChange={(v) => update((d) => void (d.about.logos[index].url = v))}
                aspect={1}
                previewHeight={120}
              />
              <Row>
                <Text
                  label="Caption"
                  value={logo.caption}
                  onChange={(v) => update((d) => void (d.about.logos[index].caption = v))}
                  ai={{ what: "logo caption", about: { item: "one version of the brand logo" }, image: logo.url }}
                />
                <Text
                  label="Description"
                  hint="For Google and screen readers"
                  value={logo.alt}
                  onChange={(v) => update((d) => void (d.about.logos[index].alt = v))}
                  ai={{ what: "logo alt text", about: { item: "one version of the brand logo" }, image: logo.url }}
                />
              </Row>
              <Actions>
                <Button
                  disabled={index === 0}
                  onClick={() =>
                    update((d) => {
                      if (index === 0) return;
                      [d.about.logos[index - 1], d.about.logos[index]] = [d.about.logos[index], d.about.logos[index - 1]];
                    })
                  }
                >
                  ↑ Move up
                </Button>
                <Button
                  disabled={index >= about.logos.length - 1}
                  onClick={() =>
                    update((d) => {
                      if (index >= d.about.logos.length - 1) return;
                      [d.about.logos[index + 1], d.about.logos[index]] = [d.about.logos[index], d.about.logos[index + 1]];
                    })
                  }
                >
                  ↓ Move down
                </Button>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(logo.caption || `logo ${index + 1}`)) return;
                    update((d) => void d.about.logos.splice(index, 1));
                  }}
                >
                  Remove
                </Button>
              </Actions>
            </Card>
          ))}
          <div>
            <Button
              tone="primary"
              onClick={() =>
                update((d) =>
                  void d.about.logos.push({
                    id: `logo-${Date.now().toString(36)}`,
                    url: "",
                    alt: "Pins & Needles Comedy logo",
                    caption: "",
                  })
                )
              }
            >
              ➕ Add a logo
            </Button>
          </div>
          <Row>
            <Num
              label="Picture size inside each tile"
              value={about.logoSize}
              min={20}
              max={100}
              suffix="%"
              onChange={(v) => update((d) => void (d.about.logoSize = v))}
            />
            <Num
              label="Gap between tiles"
              value={about.logoGap}
              min={0}
              max={40}
              suffix="px"
              onChange={(v) => update((d) => void (d.about.logoGap = v))}
            />
            <Num
              label="Columns (at least)"
              value={about.logoColumns}
              min={1}
              max={8}
              onChange={(v) => update((d) => void (d.about.logoColumns = v))}
            />
          </Row>
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for the About page"
          seo={about.seo}
          suggestion={suggestFor(content, "about")}
          about={page}
          onChange={(seo) => update((d) => void (d.about.seo = seo))}
        />
      </div>
    </>
  );
}
