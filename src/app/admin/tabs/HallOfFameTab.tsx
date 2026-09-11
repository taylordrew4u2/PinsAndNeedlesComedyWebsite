"use client";
import type { Content, HallPerformer } from "@/lib/types";
import { Area, Button, Card, Row, Section, Text, Toggle } from "../ui";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

export default function HallOfFameTab({ content, update }: { content: Content; update: Update }) {
  const hall = content.hallOfFame;
  const setPerson = (index: number, patch: Partial<HallPerformer>) => update((d) => {
    Object.assign(d.hallOfFame.performers[index], patch);
  });
  const move = (index: number, direction: number) => update((d) => {
    const list = d.hallOfFame.performers;
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
  });
  return <>
    <Section title="Hall of Fame" hint="Celebrate everyone who has taken your stage. Changes save automatically.">
      <a href="/hall-of-fame" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Preview Hall of Fame ↗</a>
      <Text label="Page heading" value={hall.heading} onChange={(v) => update((d) => void (d.hallOfFame.heading = v))} />
      <Area label="Introduction" rows={3} value={hall.intro} onChange={(v) => update((d) => void (d.hallOfFame.intro = v))} />
      <Text label="Empty page message" value={hall.emptyText} onChange={(v) => update((d) => void (d.hallOfFame.emptyText = v))} />
      <Toggle label="Show Hall of Fame in navigation" value={hall.showInNav} onChange={(v) => update((d) => void (d.hallOfFame.showInNav = v))} />
    </Section>
    <Section title={`Performers (${hall.performers.length})`} hint="Stars appear in this order. No photo needed. New entries stay unpublished until you are ready.">
      <Button tone="primary" onClick={() => update((d) => void d.hallOfFame.performers.push({
        id: crypto.randomUUID(), name: "", credit: "", bio: "", linkUrl: "", linkLabel: "Instagram", published: false,
      }))}>Add performer</Button>
      {hall.performers.map((person, index) => <Card key={person.id} title={person.name || "New performer"} subtitle={person.published ? "Published" : "Draft"} defaultOpen={true}>
        <Text label="Name" value={person.name} onChange={(v) => setPerson(index, { name: v })} />
        <Text label="Credit or show" hint="For example: Headliner · September 2026" value={person.credit} onChange={(v) => setPerson(index, { credit: v })} />
        <Area label="Short bio" rows={3} value={person.bio} onChange={(v) => setPerson(index, { bio: v })} />
        <Row>
          <Text label="Link URL" placeholder="https://www.instagram.com/..." value={person.linkUrl} onChange={(v) => setPerson(index, { linkUrl: v })} />
          <Text label="Link label" value={person.linkLabel} onChange={(v) => setPerson(index, { linkLabel: v })} />
        </Row>
        <Toggle label="Published" value={person.published} onChange={(v) => setPerson(index, { published: v })} />
        {!person.name.trim() && person.published ? <p className="text-sm text-amber-400">Add a name before this card can appear on the public page.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => move(index, -1)}>Move up</Button>
          <Button onClick={() => move(index, 1)}>Move down</Button>
          <Button tone="danger" onClick={() => { if (window.confirm(`Remove ${person.name || "this performer"} from the Hall of Fame?`)) update((d) => void d.hallOfFame.performers.splice(index, 1)); }}>Remove performer</Button>
        </div>
      </Card>)}
    </Section>
    <SeoEditor title="Hall of Fame SEO" seo={hall.seo} suggestion={suggestFor(content, "hall")} onChange={(v) => update((d) => void (d.hallOfFame.seo = v))} />
  </>;
}
