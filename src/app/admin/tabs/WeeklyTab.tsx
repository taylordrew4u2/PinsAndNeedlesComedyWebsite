"use client";

import type { Content, WeeklyPage } from "@/lib/types";
import { aspectValue } from "@/lib/render";
import {
  Actions,
  Area,
  LinkButton,
  More,
  Row,
  Section,
  Select,
  Text,
  Toggle,
} from "../ui";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";
import { aboutWeekly } from "@/lib/writer";

const WEEKDAYS = (
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
).map((day) => ({ value: day, label: `Every ${day}` }));

export default function WeeklyTab({ content, update }: { content: Content; update: Update }) {
  const weekly = content.weekly;
  const posterAspect = aspectValue(content.showsPage.posterAspect);
  const set = <K extends keyof WeeklyPage>(key: K) => (value: WeeklyPage[K]) =>
    update((d) => void (d.weekly[key] = value));
  const about = aboutWeekly(weekly);
  const ai = (what: string) => ({ what, about });

  return (
    <>
      <Section
        icon="🎲"
        title={weekly.title || "Bad Decisions"}
        hint="The weekly show. Each week's lineup is a show in the Shows tab marked as part of this weekly."
      >
        <Actions>
          <LinkButton size="big" tone="primary" href="/admin/run-show">
            🎛️ Open the control center
          </LinkButton>
        </Actions>
        <p className="text-[14px] leading-relaxed text-neutral-400">
          Show night runs from its own page: the questions as they come in, a mirror of the live
          screen, Draw one, the QR code for the tables, and Archive at the end. Only someone signed
          in here can open it. Everything below is the page&apos;s own settings.
        </p>
        <Toggle
          label="The page is live"
          hint="Off = the QR code goes nowhere and the form stops taking decisions"
          value={weekly.enabled}
          onChange={set("enabled")}
        />
      </Section>

      <Section
        icon="📍"
        title="When and where"
        hint="The standing details. A night you've published in Shows uses its own time instead."
      >
        <Text label="Name of the show" value={weekly.title} onChange={set("title")} ai={ai("weekly show title")} />
        <Row>
          <Select label="Which night" value={weekly.weekday} options={WEEKDAYS} onChange={set("weekday")} />
          <Text label="Doors open" type="time" value={weekly.doorsTime} onChange={set("doorsTime")} />
          <Text label="Show starts" type="time" value={weekly.startTime} onChange={set("startTime")} />
        </Row>
        <Row>
          <Text label="Venue" value={weekly.venueName} onChange={set("venueName")} />
          <Text label="Price" hint="For example: Free" value={weekly.price} onChange={set("price")} />
          <Text label="Age" hint="For example: 21+" value={weekly.ageRestriction} onChange={set("ageRestriction")} />
        </Row>

        <More title="Address, map and venue website">
          <Text label="Venue website" value={weekly.venueUrl} placeholder="https://" onChange={set("venueUrl")} />
          <Text label="Street address" value={weekly.address} onChange={set("address")} />
          <Row>
            <Text label="City" value={weekly.city} onChange={set("city")} />
            <Text label="State" value={weekly.region} onChange={set("region")} />
            <Text label="ZIP" value={weekly.postalCode} onChange={set("postalCode")} />
          </Row>
          <Text label="Map link" hint="A Google Maps link" value={weekly.mapUrl} placeholder="https://maps.google.com/..." onChange={set("mapUrl")} />
          <Text
            label="Room note"
            hint="Copied onto each night's page — for example: the room is small, come early"
            value={weekly.roomNote}
            onChange={set("roomNote")}
          />
        </More>

        <More title="Tagline and poster">
          <Area label="Tagline" rows={2} value={weekly.tagline} onChange={set("tagline")} ai={ai("weekly show tagline")} />
          <MediaField
            label="Poster"
            hint={`Cropped to ${content.showsPage.posterAspect}, same as show posters`}
            value={weekly.posterUrl}
            onChange={set("posterUrl")}
            aspect={posterAspect}
            previewHeight={180}
          />
          <Text
            label="What the poster shows"
            hint="For Google image search and screen readers"
            value={weekly.posterAlt}
            onChange={set("posterAlt")}
            ai={{ what: "poster alt text", about, image: weekly.posterUrl }}
          />
        </More>
      </Section>

      <div className="mb-6">
        <More title="Words on the submission form" hint="What people see on their phone. Keep every line short.">
          <Text label="The question" value={weekly.question} onChange={set("question")} ai={ai("the question the submission form asks the audience")} />
          <Text label="Grey text inside the box" value={weekly.placeholder} onChange={set("placeholder")} ai={ai("placeholder inside the decision box")} />
          <Text label="The “put my name on it” switch" value={weekly.namePrompt} onChange={set("namePrompt")} ai={ai("label on the toggle to put your name on your decision")} />
          <Area label="Small print under the form" rows={2} value={weekly.formNote} onChange={set("formNote")} ai={ai("small print under the submission form")} />
          <Text label="The send button" value={weekly.submitLabel} onChange={set("submitLabel")} ai={ai("submit button text")} />
          <Area label="What it says after they send" rows={2} value={weekly.thanksText} onChange={set("thanksText")} ai={ai("thank-you message after a decision is sent")} />
          <Text
            label="A number people can text instead"
            hint="Optional — leave blank to hide it. A free Google Voice number works; texts land in your Google Voice inbox."
            placeholder="(929) 555-0143"
            value={weekly.smsNumber}
            onChange={set("smsNumber")}
          />
          {weekly.smsNumber ? (
            <Text
              label="How the number is offered"
              hint="{number} is replaced with the number above"
              value={weekly.smsNote}
              onChange={set("smsNote")}
              ai={ai("one line offering the text-in number, containing the literal token {number}")}
            />
          ) : null}
          <Toggle
            label="Show how many decisions are in"
            hint="The count climbs on the page during the bar hour"
            value={weekly.showCount}
            onChange={set("showCount")}
          />
        </More>
      </div>

      <div className="mb-6">
        <More
          title="When the form opens and closes"
          hint="Counted from the show's start time, New York time. A tight window means whoever sends one is in the room to hear it."
        >
          <Row>
            <Text
              label="Opens this many minutes before"
              type="number"
              hint="60 = an hour before the show"
              value={String(weekly.openMinutesBefore)}
              onChange={(value) => set("openMinutesBefore")(Math.max(0, Number(value) || 0))}
            />
            <Text
              label="Closes this many minutes after"
              type="number"
              hint="240 = four hours after it starts, so the pile stays open through the show"
              value={String(weekly.closeMinutesAfter)}
              onChange={(value) => set("closeMinutesAfter")(Math.max(0, Number(value) || 0))}
            />
          </Row>
          <Area
            label="What the page says while it's shut"
            rows={2}
            hint="{when} becomes the night and time it opens — for example: Thursday at 8:00 PM"
            value={weekly.closedText}
            onChange={set("closedText")}
            ai={ai("message shown while the form is shut, containing the literal token {when}")}
          />
          <Toggle
            label="Keep the form open all the time"
            hint="Ignores the window above — for testing, or a night that runs to its own clock"
            value={weekly.alwaysOpen}
            onChange={set("alwaysOpen")}
          />
        </More>
      </div>

      <div className="mb-6">
        <More title="How it works, and the Shows page" hint="The description of the show, and whether weekly dates appear on /shows">
          <Area
            label="How it works"
            hint="The show format, in a paragraph or two. Also feeds the search suggestions."
            rows={5}
            value={weekly.howItWorks}
            onChange={set("howItWorks")}
            ai={ai("how the show works (page body)")}
          />
          <Toggle
            label="List upcoming nights on the Shows page"
            hint="Shows the next five nights on the public Shows page"
            value={weekly.showOnShowsPage}
            onChange={set("showOnShowsPage")}
          />
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for Bad Decisions"
          seo={weekly.seo}
          suggestion={suggestFor(content, "weekly")}
          about={about}
          onChange={set("seo")}
        />
      </div>
    </>
  );
}
