"use client";

import { useState } from "react";
import type { Content, Reel } from "@/lib/types";
import { instagramCode } from "@/lib/render";
import { Area, Button, Card, Row, Section, Text, Toggle } from "../ui";
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
        title="How the reel grid works"
        hint="Instagram blocks silent autoplay inside its own embed, so each tile plays a video file you upload here and links out to the real post when clicked."
      >
        <ol className="ml-4 list-decimal space-y-1 text-[13px] leading-relaxed text-neutral-400">
          <li>Paste the Instagram permalink — that is where a click sends people.</li>
          <li>
            Upload the reel&apos;s video file (download it from Instagram, or use your original
            export). It plays muted and looping.
          </li>
          <li>Optionally upload a poster frame. Without one, the first video frame is used.</li>
        </ol>
      </Section>

      <Section title="Add reels in bulk" hint="Paste any number of Instagram links — one per line.">
        <Area
          label="Instagram links"
          rows={4}
          value={bulk}
          placeholder={"https://www.instagram.com/reel/ABC123/\nhttps://www.instagram.com/reel/DEF456/"}
          onChange={setBulk}
        />
        <div>
          <Button tone="primary" onClick={addBulk}>
            Add these reels
          </Button>
        </div>
      </Section>

      <Section title={`Reels (${content.reels.length})`} hint="Drag order is set with the move buttons. The first grid shows the top of this list.">
        {content.reels.map((reel, index) => {
          const code = instagramCode(reel.instagramUrl);
          return (
            <Card
              key={reel.id}
              title={reel.caption || (code ? `Reel ${code}` : `Reel ${index + 1}`)}
              subtitle={`${reel.published ? "Live" : "Hidden"}${reel.videoUrl ? " · video" : " · no video"}`}
            >
              <Text
                label="Instagram link"
                value={reel.instagramUrl}
                onChange={(v) => update((d) => void (d.reels[index].instagramUrl = v))}
                placeholder="https://www.instagram.com/reel/…"
              />
              <MediaField
                label="Reel video"
                hint="mp4 or webm, 9:16"
                accept="video/*"
                value={reel.videoUrl}
                onChange={(v) => update((d) => void (d.reels[index].videoUrl = v))}
                previewHeight={140}
              />
              <MediaField
                label="Poster frame"
                hint="cropped to 9:16"
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
                  label="Alt text"
                  hint="helps image search and screen readers"
                  value={reel.alt}
                  onChange={(v) => update((d) => void (d.reels[index].alt = v))}
                  ai={{ what: "reel poster alt text", about: { item: "an Instagram reel from the show", caption: reel.caption }, image: reel.posterUrl }}
                />
              </Row>
              <Toggle
                label="Published"
                value={reel.published}
                onChange={(v) => update((d) => void (d.reels[index].published = v))}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    update((d) => {
                      if (index === 0) return;
                      [d.reels[index - 1], d.reels[index]] = [d.reels[index], d.reels[index - 1]];
                      d.reels.forEach((entry, i) => (entry.order = i));
                    })
                  }
                >
                  Move up
                </Button>
                <Button
                  onClick={() =>
                    update((d) => {
                      if (index >= d.reels.length - 1) return;
                      [d.reels[index + 1], d.reels[index]] = [d.reels[index], d.reels[index + 1]];
                      d.reels.forEach((entry, i) => (entry.order = i));
                    })
                  }
                >
                  Move down
                </Button>
                <Button tone="danger" onClick={() => update((d) => void d.reels.splice(index, 1))}>
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}

        <Button tone="primary" onClick={() => update((d) => void d.reels.push(newReel()))}>
          Add an empty reel
        </Button>
      </Section>
    </>
  );
}
