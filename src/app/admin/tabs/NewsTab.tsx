"use client";

import { useState } from "react";
import type { Content, Post } from "@/lib/types";
import { aspectValue, formatDate } from "@/lib/render";
import { emptySeo, slugify } from "@/lib/seo";
import { nyToday } from "@/lib/shows";
import {
  Actions,
  Area,
  Button,
  Card,
  Color,
  More,
  Note,
  Num,
  Pill,
  Row,
  Section,
  Select,
  Tags,
  Text,
  Toggle,
  confirmDelete,
} from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";
import { aboutPost } from "@/lib/writer";

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

export const newPost = (): Post => {
  const stamp = Date.now().toString(36);
  return {
    id: `post-${stamp}`,
    slug: `new-post-${stamp}`,
    title: "New post",
    excerpt: "",
    body: "",
    coverUrl: "",
    coverAlt: "",
    date: nyToday(),
    tags: [],
    published: false,
    featured: false,
    seo: emptySeo(),
  };
};

const newsPage = { page: "news: show recaps and announcements", url: "/news" };

export default function NewsTab({
  content,
  update,
  focus = null,
}: {
  content: Content;
  update: Update;
  /** A post id to open and scroll to. */
  focus?: string | null;
}) {
  const [opened, setOpened] = useState<string | null>(focus);
  const settings = content.blogSettings;
  const coverAspect = aspectValue(settings.coverAspect);

  const addPost = () => {
    const post = newPost();
    update((d) => void d.posts.unshift(post));
    setOpened(post.id);
  };

  return (
    <>
      <Section
        icon="📰"
        title={`Posts (${content.posts.length})`}
        hint="Recaps and announcements. Tap a post to open it."
      >
        <div>
          <Button size="big" tone="primary" onClick={addPost}>
            ✍️ Write a new post
          </Button>
        </div>

        {content.posts.length === 0 ? (
          <Note>No posts yet. Tap “Write a new post” to start one.</Note>
        ) : null}

        {content.posts.map((post, index) => (
          <Card
            key={post.id}
            title={post.title}
            subtitle={formatDate(post.date)}
            badge={post.published ? <Pill tone="live">Live</Pill> : <Pill tone="draft">Draft</Pill>}
            defaultOpen={opened === post.id}
            highlight={opened === post.id}
          >
            <Text
              label="Title"
              value={post.title}
              onChange={(v) => update((d) => void (d.posts[index].title = v))}
              ai={{ what: "article title", about: aboutPost(post) }}
            />
            <MediaField
              label="Cover picture"
              hint={`Cropped to ${settings.coverAspect}`}
              value={post.coverUrl}
              onChange={(v) => update((d) => void (d.posts[index].coverUrl = v))}
              aspect={coverAspect}
              previewHeight={150}
            />
            <Area
              label="Short summary"
              hint="One or two sentences. Shows on the card and in Google."
              rows={2}
              value={post.excerpt}
              onChange={(v) => update((d) => void (d.posts[index].excerpt = v))}
              ai={{ what: "article excerpt", about: aboutPost(post) }}
            />
            <Area
              label="The post"
              hint="Blank line = new paragraph. ## for a heading, - for a bullet, **bold**, [text](link)"
              rows={12}
              value={post.body}
              onChange={(v) => update((d) => void (d.posts[index].body = v))}
              ai={{ what: "article body", about: aboutPost(post) }}
            />
            <Toggle
              label="Show it on the website"
              hint="Off = a draft only you can see. On = it's live for everyone."
              value={post.published}
              onChange={(v) => update((d) => void (d.posts[index].published = v))}
            />

            <More
              title="Everything else about this post"
              hint="Date, web address, tags, featured, picture description, search settings"
            >
              <Row>
                <Text
                  label="Date"
                  type="date"
                  value={post.date}
                  onChange={(v) => update((d) => void (d.posts[index].date = v))}
                />
                <Text
                  label="URL slug"
                  hint={`The page will be at /news/${post.slug}`}
                  value={post.slug}
                  onChange={(v) => update((d) => void (d.posts[index].slug = slugify(v)))}
                />
              </Row>
              <Actions>
                <Button onClick={() => update((d) => void (d.posts[index].slug = slugify(post.title)))}>
                  Make one from the title
                </Button>
              </Actions>
              <Text
                label="Cover picture description"
                hint="For Google image search and screen readers"
                value={post.coverAlt}
                onChange={(v) => update((d) => void (d.posts[index].coverAlt = v))}
                ai={{ what: "cover image alt text", about: aboutPost(post), image: post.coverUrl }}
              />
              <Tags
                label="Tags"
                value={post.tags}
                onChange={(v) => update((d) => void (d.posts[index].tags = v))}
                ai={{ what: "article tags", about: aboutPost(post) }}
              />
              <Toggle
                label="Featured"
                hint="Gives it a bigger spot"
                value={post.featured}
                onChange={(v) => update((d) => void (d.posts[index].featured = v))}
              />
              <SeoEditor
                title="Search & AI settings for this post"
                seo={post.seo}
                suggestion={suggestFor(content, "post", post)}
                about={aboutPost(post)}
                onChange={(seo) => update((d) => void (d.posts[index].seo = seo))}
              />
            </More>

            <Actions>
              <Button
                disabled={index === 0}
                onClick={() =>
                  update((d) => {
                    if (index === 0) return;
                    [d.posts[index - 1], d.posts[index]] = [d.posts[index], d.posts[index - 1]];
                  })
                }
              >
                ↑ Move up
              </Button>
              <Button
                disabled={index >= content.posts.length - 1}
                onClick={() =>
                  update((d) => {
                    if (index >= d.posts.length - 1) return;
                    [d.posts[index + 1], d.posts[index]] = [d.posts[index], d.posts[index + 1]];
                  })
                }
              >
                ↓ Move down
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  if (!confirmDelete(`“${post.title}”`)) return;
                  update((d) => void d.posts.splice(index, 1));
                }}
              >
                Delete post
              </Button>
            </Actions>
          </Card>
        ))}
      </Section>

      <div className="mb-6">
        <More
          title="How news looks on the homepage"
          hint="Card size, fonts, colors and scrolling for the strip of news covers"
        >
          <p className="text-[13px] leading-relaxed text-neutral-500">
            The homepage uses a thin, 112px-high strip with cards up to 200px wide. Changing the
            cover shape re-crops new uploads; re-upload an old cover to match.
          </p>
          <Select
            label="Cover shape (all posts)"
            value={settings.coverAspect}
            options={ASPECTS}
            onChange={(v) => update((d) => void (d.blogSettings.coverAspect = v))}
          />
          <Row>
            <Num
              label="Card width"
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
              label="Rounded corners"
              value={settings.cornerRadius}
              min={0}
              max={32}
              suffix="px"
              onChange={(v) => update((d) => void (d.blogSettings.cornerRadius = v))}
            />
          </Row>
          <Select
            label="How the picture fits"
            value={settings.imageFit}
            options={[
              { value: "cover" as const, label: "Fill the card, crop the edges" },
              { value: "contain" as const, label: "Show the whole picture" },
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
                { value: "capitalize" as const, label: "Capitalize Each Word" },
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
              label="Scroll the strip by itself"
              hint="Pauses when the mouse is over it"
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
        </More>
      </div>

      <div className="mb-6">
        <More title="News page heading & search settings" hint="The words at the top of /news">
          <Text
            label="Heading"
            value={content.news.heading}
            onChange={(v) => update((d) => void (d.news.heading = v))}
            ai={{ what: "news page heading", about: newsPage }}
          />
          <Area
            label="Intro"
            rows={2}
            value={content.news.intro}
            onChange={(v) => update((d) => void (d.news.intro = v))}
            ai={{ what: "news page intro", about: newsPage }}
          />
          <SeoEditor
            title="Search & AI settings for the News page"
            seo={content.news.seo}
            suggestion={suggestFor(content, "news")}
            about={newsPage}
            onChange={(seo) => update((d) => void (d.news.seo = seo))}
          />
        </More>
      </div>
    </>
  );
}
