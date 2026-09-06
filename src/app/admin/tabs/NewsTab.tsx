"use client";

import type { Content, Post } from "@/lib/types";
import { aspectValue } from "@/lib/render";
import { slugify } from "@/lib/seo";
import { emptySeo } from "@/lib/seo";
import { Area, Button, Card, Color, Num, Row, Section, Select, Tags, Text, Toggle } from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

const ASPECTS = [
  { value: "9:16" as const, label: "9:16 — tall (reel shape)" },
  { value: "4:5" as const, label: "4:5 — portrait (Instagram)" },
  { value: "1:1" as const, label: "1:1 — square" },
  { value: "3:2" as const, label: "3:2 — landscape" },
  { value: "16:9" as const, label: "16:9 — wide" },
];

const FONTS = [
  { value: "'Archivo Black', 'Arial Black', system-ui, sans-serif", label: "Archivo Black" },
  { value: "'Inter', system-ui, -apple-system, sans-serif", label: "Inter" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Courier New', ui-monospace, monospace", label: "Courier" },
  { value: "Impact, 'Haettenschweiler', sans-serif", label: "Impact" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const newPost = (): Post => {
  const stamp = Date.now().toString(36);
  return {
    id: `post-${stamp}`,
    slug: `new-post-${stamp}`,
    title: "New post",
    excerpt: "",
    body: "",
    coverUrl: "",
    coverAlt: "",
    date: today(),
    tags: [],
    published: false,
    featured: false,
    seo: emptySeo(),
  };
};

export default function NewsTab({ content, update }: { content: Content; update: Update }) {
  const settings = content.blogSettings;
  const coverAspect = aspectValue(settings.coverAspect);

  return (
    <>
      <Section
        title="Display — applies to every post"
        hint="Cover orientation, card size, and how the title sits on the image. Changing the orientation re-crops new uploads; re-upload an old cover to match."
      >
        <Select
          label="Cover orientation (all posts)"
          value={settings.coverAspect}
          options={ASPECTS}
          onChange={(v) => update((d) => void (d.blogSettings.coverAspect = v))}
        />
        <Row>
          <Num
            label="Card width in the news strip"
            value={settings.cardWidth}
            min={140}
            max={720}
            step={10}
            suffix="px"
            onChange={(v) => update((d) => void (d.blogSettings.cardWidth = v))}
          />
          <Num
            label="Gap between cards"
            value={settings.gap}
            min={0}
            max={40}
            suffix="px"
            onChange={(v) => update((d) => void (d.blogSettings.gap = v))}
          />
          <Num
            label="Corner radius"
            value={settings.cornerRadius}
            min={0}
            max={32}
            suffix="px"
            onChange={(v) => update((d) => void (d.blogSettings.cornerRadius = v))}
          />
        </Row>
        <Select
          label="Image fit"
          value={settings.imageFit}
          options={[
            { value: "cover" as const, label: "Cover — fill the card, crop the overflow" },
            { value: "contain" as const, label: "Contain — show the whole image" },
          ]}
          onChange={(v) => update((d) => void (d.blogSettings.imageFit = v))}
        />

        <Select
          label="Title font"
          value={settings.titleFont}
          options={FONTS}
          onChange={(v) => update((d) => void (d.blogSettings.titleFont = v))}
        />
        <Row>
          <Num
            label="Title size"
            value={settings.titleSize}
            min={9}
            max={44}
            suffix="px"
            onChange={(v) => update((d) => void (d.blogSettings.titleSize = v))}
          />
          <Num
            label="Title weight"
            value={settings.titleWeight}
            min={300}
            max={900}
            step={100}
            onChange={(v) => update((d) => void (d.blogSettings.titleWeight = v))}
          />
          <Num
            label="Title padding"
            value={settings.titlePadding}
            min={0}
            max={48}
            suffix="px"
            onChange={(v) => update((d) => void (d.blogSettings.titlePadding = v))}
          />
        </Row>
        <Row>
          <Select
            label="Title alignment"
            value={settings.titleAlign}
            options={[
              { value: "left" as const, label: "Left" },
              { value: "center" as const, label: "Center" },
              { value: "right" as const, label: "Right" },
            ]}
            onChange={(v) => update((d) => void (d.blogSettings.titleAlign = v))}
          />
          <Select
            label="Title case"
            value={settings.titleTransform}
            options={[
              { value: "none" as const, label: "As typed" },
              { value: "uppercase" as const, label: "UPPERCASE" },
              { value: "capitalize" as const, label: "Capitalize" },
              { value: "lowercase" as const, label: "lowercase" },
            ]}
            onChange={(v) => update((d) => void (d.blogSettings.titleTransform = v))}
          />
          <Color
            label="Title color"
            value={settings.titleColor}
            onChange={(v) => update((d) => void (d.blogSettings.titleColor = v))}
          />
        </Row>
        <Row>
          <Toggle
            label="Show the date on cards"
            value={settings.showDate}
            onChange={(v) => update((d) => void (d.blogSettings.showDate = v))}
          />
          <Toggle
            label="Auto-scroll the news strip"
            hint="Pauses on hover"
            value={settings.autoScroll}
            onChange={(v) => update((d) => void (d.blogSettings.autoScroll = v))}
          />
        </Row>
        {settings.autoScroll ? (
          <Num
            label="Scroll speed"
            value={settings.autoScrollSpeed}
            min={10}
            max={200}
            suffix="px/s"
            onChange={(v) => update((d) => void (d.blogSettings.autoScrollSpeed = v))}
          />
        ) : null}
      </Section>

      <Section title="News page">
        <Text
          label="Heading"
          value={content.news.heading}
          onChange={(v) => update((d) => void (d.news.heading = v))}
        />
        <Area
          label="Intro"
          rows={2}
          value={content.news.intro}
          onChange={(v) => update((d) => void (d.news.intro = v))}
        />
      </Section>

      <SeoEditor
        title="News page SEO & AI SEO"
        seo={content.news.seo}
        suggestion={suggestFor(content, "news")}
        onChange={(seo) => update((d) => void (d.news.seo = seo))}
      />

      <Section title={`Posts (${content.posts.length})`}>
        <Button
          tone="primary"
          onClick={() => update((d) => void d.posts.unshift(newPost()))}
        >
          New post
        </Button>

        {content.posts.map((post, index) => (
          <Card
            key={post.id}
            title={post.title}
            subtitle={`${post.date}${post.published ? "" : " · draft"}`}
          >
            <Text
              label="Title"
              value={post.title}
              onChange={(v) => update((d) => void (d.posts[index].title = v))}
            />
            <Row>
              <Text
                label="URL slug"
                hint={`/news/${post.slug}`}
                value={post.slug}
                onChange={(v) => update((d) => void (d.posts[index].slug = slugify(v)))}
              />
              <Text
                label="Date"
                type="date"
                value={post.date}
                onChange={(v) => update((d) => void (d.posts[index].date = v))}
              />
            </Row>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => update((d) => void (d.posts[index].slug = slugify(post.title)))}>
                Slug from title
              </Button>
            </div>

            <MediaField
              label="Cover image"
              hint={`cropped to ${settings.coverAspect}`}
              value={post.coverUrl}
              onChange={(v) => update((d) => void (d.posts[index].coverUrl = v))}
              aspect={coverAspect}
              previewHeight={150}
            />
            <Text
              label="Cover alt text"
              hint="describe the image — image SEO and accessibility"
              value={post.coverAlt}
              onChange={(v) => update((d) => void (d.posts[index].coverAlt = v))}
            />

            <Area
              label="Excerpt"
              hint="one or two sentences — also used as the meta description"
              rows={2}
              value={post.excerpt}
              onChange={(v) => update((d) => void (d.posts[index].excerpt = v))}
            />
            <Area
              label="Body"
              hint="blank line = new paragraph · ## heading · - bullet · [text](url) · **bold**"
              rows={12}
              value={post.body}
              onChange={(v) => update((d) => void (d.posts[index].body = v))}
            />
            <Tags
              label="Tags"
              value={post.tags}
              onChange={(v) => update((d) => void (d.posts[index].tags = v))}
            />
            <Row>
              <Toggle
                label="Published"
                value={post.published}
                onChange={(v) => update((d) => void (d.posts[index].published = v))}
              />
              <Toggle
                label="Featured"
                value={post.featured}
                onChange={(v) => update((d) => void (d.posts[index].featured = v))}
              />
            </Row>

            <SeoEditor
              title="Post SEO & AI SEO"
              seo={post.seo}
              suggestion={suggestFor(content, "post", post)}
              onChange={(seo) => update((d) => void (d.posts[index].seo = seo))}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  update((d) => {
                    if (index === 0) return;
                    [d.posts[index - 1], d.posts[index]] = [d.posts[index], d.posts[index - 1]];
                  })
                }
              >
                Move up
              </Button>
              <Button
                onClick={() =>
                  update((d) => {
                    if (index >= d.posts.length - 1) return;
                    [d.posts[index + 1], d.posts[index]] = [d.posts[index], d.posts[index + 1]];
                  })
                }
              >
                Move down
              </Button>
              <Button tone="danger" onClick={() => update((d) => void d.posts.splice(index, 1))}>
                Delete post
              </Button>
            </div>
          </Card>
        ))}
      </Section>
    </>
  );
}
