"use client";

import { useState } from "react";
import type { Content, Reel } from "@/lib/types";
import { instagramCode } from "@/lib/render";
import {
  Actions,
  Area,
  Button,
  Card,
  More,
  Note,
  Pill,
  Row,
  Section,
  Steps,
  Text,
  Toggle,
  confirmDelete,
} from "../ui";
import MediaField from "../MediaField";
import InstagramSync from "../InstagramSync";
import type { Update } from "../types";

const newReel = (url = ""): Reel => ({
  id: `reel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  instagramUrl: url,
  videoUrl: "",
  posterUrl: "",
  caption: "",
  alt: "Pins & Needles Comedy Instagram reel",
  order: 0,
  published: true,
  igTimestamp: "",
  igMediaId: "",
});

export default function ReelsTab({
  content,
  update,
  refresh,
}: {
  content: Content;
  update: Update;
  refresh: () => Promise<void>;
}) {
  const [bulk, setBulk] = useState("");

  const addBulk = () => {
    const urls = bulk
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => /instagram\.com/i.test(entry));
    if (!urls.length) return;
    update((draft) => {
      for (const url of urls) {
        if (draft.reels.some((reel) => reel.instagramUrl === url)) continue;
        draft.reels.push(newReel(url));
      }
      draft.reels.forEach((reel, index) => (reel.order = index));
    });
    setBulk("");
  };

  return (
    <>
      <InstagramSync
        instagram={content.instagram}
        totalReels={content.reels.length}
        onTokenChange={(token) => update((d) => void (d.instagram.accessToken = token))}
        onSynced={refresh}
      />

      <Section
        icon="🎬"
        title={`Reels (${content.reels.length})`}
        hint="The top of this list is the top of the grid on the site. Tap a reel to open it."
      >
        <Card title="➕ Add reels by pasting Instagram links" subtitle="One link per line — as many as you like">
          <Area
            label="Instagram links"
            rows={4}
            value={bulk}
            placeholder={"https://www.instagram.com/reel/ABC123/\nhttps://www.instagram.com/reel/DEF456/"}
            onChange={setBulk}
          />
          <Actions>
            <Button tone="primary" onClick={addBulk} disabled={!bulk.trim()}>
              Add these reels
            </Button>
            <Button onClick={() => update((d) => void d.reels.push(newReel()))}>Add one blank reel</Button>
          </Actions>
        </Card>

        <More title="How the reel grid works" hint="Why each reel wants its own video file">
          <Steps>
            <li>Paste the Instagram link — that is where a tap sends people.</li>
            <li>
              Upload the reel&apos;s video file (download it from Instagram, or use your original
              export). Instagram blocks silent autoplay inside its own embed, so the site plays
              this file instead, muted and looping.
            </li>
            <li>Optionally upload a poster frame. Without one, the first frame of the video is used.</li>
          </Steps>
        </More>

        {content.reels.length === 0 ? (
          <Note>No reels yet. Connect Instagram above, or paste some links.</Note>
        ) : null}

        {content.reels.map((reel, index) => {
          const code = instagramCode(reel.instagramUrl);
          return (
            <Card
              key={reel.id}
              title={reel.caption || (code ? `Reel ${code}` : `Reel ${index + 1}`)}
              subtitle={reel.videoUrl ? "Has a video" : "No video yet"}
              badge={reel.published ? <Pill tone="live">Live</Pill> : <Pill tone="past">Hidden</Pill>}
            >
              <Text
                label="Instagram link"
                value={reel.instagramUrl}
                onChange={(v) => update((d) => void (d.reels[index].instagramUrl = v))}
                placeholder="https://www.instagram.com/reel/…"
              />
              <MediaField
                label="The video"
                hint="mp4 or webm, tall (9:16)"
                accept="video/*"
                value={reel.videoUrl}
                onChange={(v) => update((d) => void (d.reels[index].videoUrl = v))}
                previewHeight={140}
              />
              <Toggle
                label="Show it on the website"
                value={reel.published}
                onChange={(v) => update((d) => void (d.reels[index].published = v))}
              />
              <More title="Poster frame, caption and description" hint="Optional">
                <MediaField
                  label="Poster frame"
                  hint="The still shown before the video plays. Cropped to 9:16."
                  value={reel.posterUrl}
                  onChange={(v) => update((d) => void (d.reels[index].posterUrl = v))}
                  aspect={9 / 16}
                  previewHeight={140}
                />
                <Row>
                  <Text
                    label="Caption"
                    value={reel.caption}
                    onChange={(v) => update((d) => void (d.reels[index].caption = v))}
                    ai={{ what: "reel caption", about: { item: "an Instagram reel from the show", link: reel.instagramUrl }, image: reel.posterUrl }}
                  />
                  <Text
                    label="Description"
                    hint="For Google and screen readers"
                    value={reel.alt}
                    onChange={(v) => update((d) => void (d.reels[index].alt = v))}
                    ai={{ what: "reel poster alt text", about: { item: "an Instagram reel from the show", caption: reel.caption }, image: reel.posterUrl }}
                  />
                </Row>
              </More>
              <Actions>
                <Button
                  disabled={index === 0}
                  onClick={() =>
                    update((d) => {
                      if (index === 0) return;
                      [d.reels[index - 1], d.reels[index]] = [d.reels[index], d.reels[index - 1]];
                      d.reels.forEach((entry, i) => (entry.order = i));
                    })
                  }
                >
                  ↑ Move up
                </Button>
                <Button
                  disabled={index >= content.reels.length - 1}
                  onClick={() =>
                    update((d) => {
                      if (index >= d.reels.length - 1) return;
                      [d.reels[index + 1], d.reels[index]] = [d.reels[index], d.reels[index + 1]];
                      d.reels.forEach((entry, i) => (entry.order = i));
                    })
                  }
                >
                  ↓ Move down
                </Button>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete("this reel")) return;
                    update((d) => void d.reels.splice(index, 1));
                  }}
                >
                  Delete
                </Button>
              </Actions>
            </Card>
          );
        })}
      </Section>
    </>
  );
}
