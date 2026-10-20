"use client";
import { useState } from "react";
import type { ShowPerformer } from "@/lib/types";
import { addPasted, parseLineupPaste } from "@/lib/lineup-paste";
import { Area, Button, More, Note, Select } from "./ui";

/**
 * The whole bill in one go: paste or type a list of names with their
 * Instagrams, check how each one was read, and add them all. Each line
 * becomes its own person on the show, linked to their Instagram.
 */
export default function LineupPaste({ lineup, roles, onAdd }: {
  lineup: ShowPerformer[];
  roles: readonly string[];
  onAdd: (lineup: ShowPerformer[]) => void;
}) {
  const [text, setText] = useState("");
  const [role, setRole] = useState(roles.includes("Comedian") ? "Comedian" : roles[0] ?? "");
  const [done, setDone] = useState("");
  const people = parseLineupPaste(text, role);
  const onBill = new Map(lineup.map((person) => [person.name.trim().replace(/\s+/g, " ").toLowerCase(), person]));
  const fresh = people.filter((person) => !onBill.has(person.name.toLowerCase())).length;

  const add = () => {
    const result = addPasted(lineup, people, () => `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
    onAdd(result.lineup);
    setText("");
    setDone([
      result.added ? `Added ${result.added} ${result.added === 1 ? "person" : "people"} to the lineup.` : "",
      result.linked ? `Linked the Instagram for ${result.linked} already on the bill.` : "",
      result.skipped ? `${result.skipped} already on the bill ${result.skipped === 1 ? "was" : "were"} left as is.` : "",
    ].filter(Boolean).join(" "));
  };

  return (
    <More title="Add a list of people" hint="Paste or type everyone at once, each with their Instagram">
      <Area
        label="One person per line"
        hint="Their name, then their Instagram: @handle or an instagram.com link. A website works too. Put “Host:” in front of a name to give them that role."
        rows={6}
        value={text}
        placeholder={"Sam Rivera @samcomic\nHost: Jo Park instagram.com/jopark\nAlex Kim (@alexkimcomedy)"}
        onChange={(value) => { setText(value); setDone(""); }}
      />
      <Select
        label="Role for everyone in the list"
        hint="Anyone with a role in front of their name keeps that one"
        value={role}
        options={roles.map((value) => ({ value, label: value }))}
        onChange={setRole}
      />
      {people.length ? (
        <ul className="grid gap-1.5 text-[14px]" aria-label="How the list was read">
          {people.map((person) => {
            const have = onBill.get(person.name.toLowerCase());
            const handle = person.url.match(/instagram\.com\/([^/]+)\/?$/)?.[1];
            return (
              <li key={person.name} className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-neutral-800 px-3 py-2">
                <span className="font-medium text-neutral-100">{person.name}</span>
                <span className="text-neutral-500">{person.role}</span>
                <span className={person.url ? "text-sky-300" : "text-amber-200"}>{handle ? `@${handle}` : person.url || "no Instagram — add it later"}</span>
                {have ? <span className="text-neutral-500">{!have.url.trim() && person.url ? "· already on the bill, gets this link" : "· already on the bill, left as is"}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" onClick={add} disabled={!people.length}>
          {fresh ? `Add ${fresh} to the lineup` : people.length ? "Update the lineup" : "Add to the lineup"}
        </Button>
        {text.trim() ? <Button tone="ghost" onClick={() => setText("")}>Clear</Button> : null}
      </div>
      {done ? <Note tone="good">{done}</Note> : null}
    </More>
  );
}
