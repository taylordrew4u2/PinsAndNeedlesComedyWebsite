"use client";

import { useState } from "react";
import type { Content, HallPerformer } from "@/lib/types";
import {
  Actions,
  Area,
  Button,
  Card,
  LinkButton,
  More,
  Note,
  Pill,
  Row,
  Section,
  Select,
  Text,
  Toggle,
  confirmDelete,
} from "../ui";
import { alphabeticalPerformers, performerSocial, socialPlatforms } from "@/lib/hall-of-fame";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

type SocialPlatform = NonNullable<HallPerformer["socialPlatform"]>;

const PLATFORMS = Object.entries(socialPlatforms).map(([key, platform]) => ({
  value: key as SocialPlatform,
  label: platform.label,
}));

export const newHallPerformer = (): HallPerformer => ({
  socialPlatform: "instagram",
  socialHandle: "",
  id: crypto.randomUUID(),
  name: "",
  credit: "",
  bio: "",
  linkUrl: "",
  linkLabel: "Instagram",
  published: false,
});

const page = { page: "hall of fame: every comedian who has performed at the show", url: "/hall-of-fame" };

export default function HallOfFameTab({
  content,
  update,
  focus = null,
}: {
  content: Content;
  update: Update;
  /** A performer id to open and scroll to. */
  focus?: string | null;
}) {
  const [opened, setOpened] = useState<string | null>(focus);
  const hall = content.hallOfFame;
  const setPerson = (index: number, patch: Partial<HallPerformer>) =>
    update((d) => {
      Object.assign(d.hallOfFame.performers[index], patch);
    });

  const addPerformer = () => {
    const person = newHallPerformer();
    update((d) => void d.hallOfFame.performers.push(person));
    setOpened(person.id);
  };

  return (
    <>
      <Section
        icon="⭐"
        title={`Hall of Fame (${hall.performers.length})`}
        hint="Everyone who has performed with you, listed A–Z on the site. New people start hidden until you turn them on."
      >
        <Actions>
          <Button size="big" tone="primary" onClick={addPerformer}>
            ⭐ Add a performer
          </Button>
          <LinkButton size="big" href="/hall-of-fame" external>
            See the page
          </LinkButton>
        </Actions>

        {hall.performers.length === 0 ? (
          <Note>Nobody in the Hall of Fame yet. Tap “Add a performer” to start.</Note>
        ) : null}

        {alphabeticalPerformers(hall.performers).map((person) => {
          const index = hall.performers.findIndex((p) => p.id === person.id);
          const social = performerSocial(person);
          const isNew = !person.name.trim();
          return (
            <Card
              key={person.id}
              title={person.name || "New performer"}
              subtitle={person.credit}
              badge={person.published ? <Pill tone="live">Live</Pill> : <Pill tone="past">Hidden</Pill>}
              defaultOpen={opened === person.id || isNew}
              highlight={opened === person.id}
            >
              <Text label="Name" value={person.name} onChange={(v) => setPerson(index, { name: v })} />
              <Text
                label="Credit or show"
                hint="For example: Headliner · September 2026"
                value={person.credit}
                onChange={(v) => setPerson(index, { credit: v })}
              />
              <Row>
                <Select
                  label="Where to find them"
                  value={(person.socialPlatform || "instagram") as SocialPlatform}
                  options={PLATFORMS}
                  onChange={(v) => setPerson(index, { socialPlatform: v })}
                />
                <Text
                  label="Their handle"
                  placeholder="@theirhandle"
                  hint="With or without the @"
                  value={person.socialHandle || ""}
                  onChange={(v) => setPerson(index, { socialHandle: v })}
                />
              </Row>
              {social ? (
                <a
                  className="text-[14px] underline underline-offset-4"
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check their profile: {social.label} ↗
                </a>
              ) : person.socialHandle ? (
                <Note tone="warn">A handle can only have letters, numbers, dots, underscores or hyphens.</Note>
              ) : null}
              <Toggle
                label="Show them on the website"
                value={person.published}
                onChange={(v) => setPerson(index, { published: v })}
              />
              {isNew && person.published ? (
                <Note tone="warn">Add a name before this card can appear on the public page.</Note>
              ) : null}

              <More title="Bio and other links" hint="Optional">
                <Area
                  label="Short bio"
                  rows={3}
                  value={person.bio}
                  onChange={(v) => setPerson(index, { bio: v })}
                  ai={{
                    what: "short bio of a comedian who performed at the show (two sentences)",
                    about: { person: person.name, credit: person.credit, social: social?.url || person.linkUrl },
                  }}
                />
                <Row>
                  <Text
                    label="A different profile link"
                    hint="Only used when the handle above is empty"
                    placeholder="https://www.instagram.com/..."
                    value={person.linkUrl}
                    onChange={(v) => setPerson(index, { linkUrl: v })}
                  />
                  <Text label="What that link says" value={person.linkLabel} onChange={(v) => setPerson(index, { linkLabel: v })} />
                </Row>
              </More>

              <Actions>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(`${person.name || "this performer"} from the Hall of Fame`)) return;
                    update((d) => void d.hallOfFame.performers.splice(index, 1));
                  }}
                >
                  Remove performer
                </Button>
              </Actions>
            </Card>
          );
        })}
      </Section>

      <div className="mb-6">
        <More title="Hall of Fame page words & search settings" hint="The heading, intro and menu link">
          <Text
            label="Page heading"
            value={hall.heading}
            onChange={(v) => update((d) => void (d.hallOfFame.heading = v))}
            ai={{ what: "hall of fame page heading", about: page }}
          />
          <Area
            label="Introduction"
            rows={3}
            value={hall.intro}
            onChange={(v) => update((d) => void (d.hallOfFame.intro = v))}
            ai={{ what: "hall of fame introduction", about: page }}
          />
          <Text
            label="What the page says when nobody is listed"
            value={hall.emptyText}
            onChange={(v) => update((d) => void (d.hallOfFame.emptyText = v))}
            ai={{ what: "empty state message when no performers are listed", about: page }}
          />
          <Toggle
            label="Show Hall of Fame in the site menu"
            value={hall.showInNav}
            onChange={(v) => update((d) => void (d.hallOfFame.showInNav = v))}
          />
          <SeoEditor
            title="Search & AI settings for the Hall of Fame"
            seo={hall.seo}
            suggestion={suggestFor(content, "hall")}
            about={page}
            onChange={(v) => update((d) => void (d.hallOfFame.seo = v))}
          />
        </More>
      </div>
    </>
  );
}
