"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";
import {
  applyPostDraft,
  describePostDraft,
  POST_KINDS,
  type PostKind,
} from "@/lib/post-writer";
import { nyToday } from "@/lib/shows";
import MediaField from "./MediaField";
import { Area, Button, Note, Row, Select, Text } from "./ui";
import { writePost } from "./write-client";
import type { Update } from "./types";

/**
 * "Write a whole post for me": a few details and, if there is one, a flyer,
 * and the post comes back finished — headline, summary, body, tags, cover
 * description and the search/AI block — as a draft nobody can see yet.
 */
export default function PostWriter({
  coverAspect,
  create,
  update,
  onCreated,
}: {
  /** width / height the cover is cropped to */
  coverAspect: number;
  create: () => Post;
  update: Update;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<PostKind>("announcement");
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(nyToday());
  const [coverUrl, setCoverUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const ready = Boolean(topic.trim() || details.trim() || coverUrl);

  const run = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const { draft, model } = await writePost({ kind, topic, details, date, image: coverUrl });
      const post = create();
      post.date = date;
      post.coverUrl = coverUrl;
      const written = applyPostDraft(post, draft);
      update((d) => void d.posts.unshift(written));
      onCreated(written.id);
      setNote(describePostDraft(draft, model));
      setTopic("");
      setDetails("");
      setCoverUrl("");
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Could not write the post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-[13px] leading-relaxed text-neutral-500">
        Fill in what you know — a line about it, any notes, and the flyer if there is one. You get
        back a finished draft written for Google and for the AI answer engines, with the tags,
        keywords and FAQ already done. Nothing goes live until you switch it on.
      </p>

      <Select
        label="What kind of post is it?"
        value={kind}
        options={POST_KINDS}
        onChange={setKind}
      />
      <Text
        label="What's it about?"
        hint="One line is enough — “Bad Decisions #14 at Lucky 13 with Sam Morril”"
        placeholder="Bad Decisions #14 at Lucky 13"
        value={topic}
        onChange={setTopic}
      />
      <Area
        label="Anything else worth knowing"
        hint="Notes, bullets, quotes, who was there, what happened. Whatever you type here gets used as fact."
        rows={6}
        placeholder={"Doors at 7:30, show at 8\n$10 at the door, 21+\nRoom was packed, the third guy bombed on purpose\nNext one is Nov 14"}
        value={details}
        onChange={setDetails}
      />
      <Row>
        <Text label="Date on the post" type="date" value={date} onChange={setDate} />
      </Row>
      <MediaField
        label="Flyer or photo (optional)"
        hint="Read for the date, venue, price and lineup, and used as the cover picture. Zoom out when you crop so none of the printed words get cut off."
        value={coverUrl}
        onChange={setCoverUrl}
        aspect={coverAspect}
        previewHeight={150}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="big" tone="primary" onClick={() => void run()} disabled={busy || !ready}>
          {busy ? "Writing the post…" : "✦ Write the whole post"}
        </Button>
        {busy ? (
          <span className="text-[12px] text-neutral-500">
            This takes up to a minute — it’s writing the article and the search settings.
          </span>
        ) : null}
      </div>

      {error ? <Note tone="warn">{error}</Note> : null}
      {note ? <Note>{note}</Note> : null}
    </div>
  );
}
