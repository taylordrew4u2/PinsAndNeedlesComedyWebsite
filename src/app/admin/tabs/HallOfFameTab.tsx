"use client";
import type { Content, HallPerformer } from "@/lib/types";
import { Area, Button, Card, Row, Section, Text, Toggle } from "../ui";
import { alphabeticalPerformers, performerSocial, socialPlatforms } from "@/lib/hall-of-fame";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

export default function HallOfFameTab({ content, update }: { content: Content; update: Update }) {
  const hall = content.hallOfFame;
  const setPerson = (index: number, patch: Partial<HallPerformer>) => update((d) => {
    Object.assign(d.hallOfFame.performers[index], patch);
  });
  return <>
    <Section title="Hall of Fame" hint="Celebrate everyone who has taken your stage. Changes save automatically.">
      <a href="/hall-of-fame" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Preview Hall of Fame </a>
      <Text label="Page heading" value={hall.heading} onChange={(v) => update((d) => void (d.hallOfFame.heading = v))} />
      <Area label="Introduction" rows={3} value={hall.intro} onChange={(v) => update((d) => void (d.hallOfFame.intro = v))} />
      <Text label="Empty page message" value={hall.emptyText} onChange={(v) => update((d) => void (d.hallOfFame.emptyText = v))} />
      <Toggle label="Show Hall of Fame in navigation" value={hall.showInNav} onChange={(v) => update((d) => void (d.hallOfFame.showInNav = v))} />
    </Section>
    <Section title={`Performers (${hall.performers.length})`} hint="Every performer gets an equally sized star, ordered A–Z by display name. No photo needed. New entries start as drafts.">
      <Button tone="primary" onClick={() => update((d) => void d.hallOfFame.performers.push({
        socialPlatform: "instagram", socialHandle: "", id: crypto.randomUUID(), name: "", credit: "", bio: "", linkUrl: "", linkLabel: "Instagram", published: false,
      }))}>Add performer</Button>
      {alphabeticalPerformers(hall.performers).map((person) => {
        const index = hall.performers.findIndex((p) => p.id === person.id);
        const social = performerSocial(person);
        return <Card key={person.id} title={person.name || "New performer"} subtitle={person.published ? "Published" : "Draft"} defaultOpen={true}>
        <Text label="Name" value={person.name} onChange={(v) => setPerson(index, { name: v })} />
        <Text label="Credit or show" hint="For example: Headliner · September 2026" value={person.credit} onChange={(v) => setPerson(index, { credit: v })} />
        <Area label="Short bio" rows={3} value={person.bio} onChange={(v) => setPerson(index, { bio: v })} />
        <Row>
          <label className="grid gap-2 text-sm">Social platform
            <select className="rounded border border-white/20 bg-neutral-900 p-2" value={person.socialPlatform || "instagram"} onChange={(e) => setPerson(index, { socialPlatform: e.target.value as HallPerformer["socialPlatform"] })}>
              {Object.entries(socialPlatforms).map(([key, platform]) => <option key={key} value={key}>{platform.label}</option>)}
            </select>
          </label>
          <Text label="Social handle" placeholder="@theirhandle" hint="Enter their username, with or without @." value={person.socialHandle || ""} onChange={(v) => setPerson(index, { socialHandle: v })} />
        </Row>
        {social ? <a className="text-sm underline underline-offset-4" href={social.url} target="_blank" rel="noopener noreferrer">Check profile: {social.label} </a> : person.socialHandle ? <p className="text-sm text-amber-400">Use a handle containing letters, numbers, dots, underscores or hyphens.</p> : null}
        <Row>
          <Text label="Alternative profile URL" hint="Optional. Used when the social handle is empty." placeholder="https://www.instagram.com/..." value={person.linkUrl} onChange={(v) => setPerson(index, { linkUrl: v })} />
          <Text label="Link label" value={person.linkLabel} onChange={(v) => setPerson(index, { linkLabel: v })} />
        </Row>
        <Toggle label="Published" value={person.published} onChange={(v) => setPerson(index, { published: v })} />
        {!person.name.trim() && person.published ? <p className="text-sm text-amber-400">Add a name before this card can appear on the public page.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button tone="danger" onClick={() => { if (window.confirm(`Remove ${person.name || "this performer"} from the Hall of Fame?`)) update((d) => void d.hallOfFame.performers.splice(index, 1)); }}>Remove performer</Button>
        </div>
      </Card>; })}
    </Section>
    <SeoEditor title="Hall of Fame SEO" seo={hall.seo} suggestion={suggestFor(content, "hall")} onChange={(v) => update((d) => void (d.hallOfFame.seo = v))} />
  </>;
}
