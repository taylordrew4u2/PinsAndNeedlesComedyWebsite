"use client";

import { useState } from "react";
import type { Content, Show, ShowPerformer, ShowPhoto } from "@/lib/types";
import { aspectValue, formatDate } from "@/lib/render";
import { emptySeo, slugify } from "@/lib/seo";
import {
  Actions,
  Area,
  Button,
  Card,
  More,
  Note,
  Num,
  Pill,
  Row,
  Section,
  Select,
  Sub,
  Text,
  Toggle,
  confirmDelete,
} from "../ui";
import UpcomingLineups from "../UpcomingLineups";
import MediaField from "../MediaField";
import FlyerIntake, { ReadFlyerButton } from "../FlyerIntake";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";
import { newWeeklyShow } from "@/lib/decisions";
import { nyToday } from "@/lib/shows";
import { applyFlyer } from "@/lib/flyer";
import { aboutShow } from "@/lib/writer";

const ASPECTS = [
  { value: "9:16" as const, label: "9:16 — tall (story / reel shape)" },
  { value: "4:5" as const, label: "4:5 — portrait (Instagram poster)" },
  { value: "1:1" as const, label: "1:1 — square" },
  { value: "3:2" as const, label: "3:2 — landscape" },
  { value: "16:9" as const, label: "16:9 — wide" },
];

const STATUSES = [
  { value: "scheduled" as const, label: "Happening — tickets on sale" },
  { value: "sold-out" as const, label: "Sold out" },
  { value: "postponed" as const, label: "Postponed" },
  { value: "cancelled" as const, label: "Cancelled" },
];

/** Roles that get their own heading on the public page. Free text is fine too. */
const ROLE_SUGGESTIONS = ["Host", "Comedian", "Tattoo artist", "Vendor", "Musician", "Special guest"];

export const newShow = (): Show => {
  const stamp = Date.now().toString(36);
  return {
    id: `show-${stamp}`,
    slug: `new-show-${stamp}`,
    title: "New show",
    tagline: "",
    date: nyToday(),
    doorsTime: "",
    startTime: "",
    endTime: "",
    venueName: "",
    venueUrl: "",
    address: "",
    city: "Brooklyn",
    region: "NY",
    postalCode: "",
    country: "US",
    mapUrl: "",
    roomNote: "",
    ticketUrl: "",
    ticketLabel: "Get tickets",
    price: "",
    currency: "USD",
    ageRestriction: "21+",
    status: "scheduled",
    posterUrl: "",
    posterAlt: "",
    description: "",
    lineup: [],
    photos: [],
    recapSlug: "",
    instagramUrl: "",
    series: "",
    published: false,
    featured: false,
    seo: emptySeo(),
  };
};

const newPerformer = (role: string): ShowPerformer => ({
  id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  role,
  note: "",
  imageUrl: "",
  imageAlt: "",
  url: "",
});

const newPhoto = (): ShowPhoto => ({
  id: `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  url: "",
  alt: "",
  caption: "",
});

/** The one-word state of a show, for the pill beside its name. */
function showPill(show: Show, today: string) {
  if (!show.published) return <Pill tone="draft">Draft</Pill>;
  if (show.status === "cancelled") return <Pill tone="warn">Cancelled</Pill>;
  if (show.status === "postponed") return <Pill tone="warn">Postponed</Pill>;
  if (show.date < today) return <Pill tone="past">Past</Pill>;
  if (show.status === "sold-out") return <Pill tone="neutral">Sold out</Pill>;
  return <Pill tone="live">Live</Pill>;
}

export default function ShowsTab({
  content,
  update,
  focus = null,
}: {
  content: Content;
  update: Update;
  /** A show id to open and scroll to, or "flyer" to open the flyer box. */
  focus?: string | null;
}) {
  const [openedShow, setOpenedShow] = useState<string | null>(focus);
  const [posterLineup, setPosterLineup] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const settings = content.showsPage;
  const posterAspect = aspectValue(settings.posterAspect);
  const today = nyToday();
  const weeklyName = content.weekly.title.replace(/^Pins & Needles:\s*/i, "");
  const canAddWeekly = content.weekly.enabled && !content.weekly.showOnShowsPage;

  const addShow = () => {
    const show = newShow();
    update((d) => void d.shows.unshift(show));
    setOpenedShow(show.id);
  };
  const addWeekly = () => {
    const show = newWeeklyShow(content.weekly, today);
    update((d) => void d.shows.unshift(show));
    setOpenedShow(show.id);
  };

  const visible = content.shows.filter(
    (show) => showArchive || show.date >= today || !show.published
  );

  return (
    <>
      <Section
        icon="🎤"
        title={`Shows (${content.shows.length})`}
        hint="Every night in one list. Tap a show to open it. Past shows are tucked away but never deleted."
      >
        <div className="flex flex-wrap gap-3">
          <Button size="big" tone="primary" onClick={addShow}>
            ➕ Add a show
          </Button>
          {canAddWeekly ? (
            <Button size="big" onClick={addWeekly}>
              🎲 Add next {weeklyName} night
            </Button>
          ) : null}
        </div>
        {canAddWeekly ? (
          <p className="-mt-2 text-[13px] text-neutral-500">
            The second button fills in next {content.weekly.weekday}&apos;s date, venue and times
            from the Bad Decisions tab — you add the bill and turn it on.
          </p>
        ) : null}

        <Card
          title="📸 Start from a flyer"
          subtitle="Upload the poster and the date, venue and lineup get typed in for you"
          defaultOpen={focus === "flyer"}
          highlight={focus === "flyer"}
        >
          <FlyerIntake
            aspect={posterAspect}
            create={newShow}
            update={update}
            onCreated={(id) => {
              setOpenedShow(id);
              setPosterLineup(id);
            }}
          />
        </Card>

        <UpcomingLineups content={content} update={update} onCreated={setOpenedShow} />

        <Toggle label="Show past shows too" hint="Off keeps the list short" value={showArchive} onChange={setShowArchive} />

        {visible.length === 0 ? (
          <Note>Nothing here yet. Tap “Add a show” to put the first one on.</Note>
        ) : null}

        {content.shows.map((show, index) =>
          showArchive || show.date >= today || !show.published ? (
            <Card
              key={show.id}
              defaultOpen={openedShow === show.id}
              highlight={openedShow === show.id}
              title={show.title}
              subtitle={`${formatDate(show.date)}${show.venueName ? ` · ${show.venueName}` : ""}`}
              badge={showPill(show, today)}
            >
              <Text
                label="Show name"
                ai={{ what: "show title", about: aboutShow(show) }}
                value={show.title}
                onChange={(v) =>
                  update((d) => {
                    d.shows[index].title = v;
                    if (!show.published) d.shows[index].slug = slugify(`${v} ${show.date}`);
                  })
                }
              />
              <Row>
                <Text
                  label="Date"
                  type="date"
                  value={show.date}
                  onChange={(v) =>
                    update((d) => {
                      d.shows[index].date = v;
                      if (!show.published) d.shows[index].slug = slugify(`${show.title} ${v}`);
                    })
                  }
                />
                <Text
                  label="Start time"
                  type="time"
                  value={show.startTime}
                  onChange={(v) => update((d) => void (d.shows[index].startTime = v))}
                />
              </Row>
              <Text
                label="Venue"
                placeholder="Where is it?"
                value={show.venueName}
                onChange={(v) => update((d) => void (d.shows[index].venueName = v))}
              />
              <Text
                label="Ticket or RSVP link"
                hint="Paste your Partiful, Eventbrite or ticket link"
                placeholder="https://"
                value={show.ticketUrl}
                onChange={(v) => update((d) => void (d.shows[index].ticketUrl = v))}
              />
              <Toggle
                label="Show it on the website"
                hint="Off = a draft only you can see. On = it's live for everyone."
                value={show.published}
                onChange={(v) => update((d) => void (d.shows[index].published = v))}
              />

              <Card
                defaultOpen={posterLineup === show.id}
                title={`Lineup (${show.lineup.length})`}
                subtitle="Who's on the bill — tap a role to add someone"
              >
                <Actions>
                  {ROLE_SUGGESTIONS.map((role) => (
                    <Button
                      key={role}
                      onClick={() => update((d) => void d.shows[index].lineup.push(newPerformer(role)))}
                    >
                      + {role}
                    </Button>
                  ))}
                </Actions>
                {show.lineup.length === 0 ? (
                  <Note>Nobody on the bill yet. Tap a role above to add the first person.</Note>
                ) : null}

                {show.lineup.map((person, personIndex) => (
                  <div
                    key={person.id}
                    className="grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
                  >
                    <Row>
                      <Text
                        label="Name"
                        value={person.name}
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].name = v))
                        }
                      />
                      <Text
                        label="Role"
                        hint="Host, Comedian, Tattoo artist…"
                        value={person.role}
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].role = v))
                        }
                      />
                    </Row>
                    <More title="Photo, link and note" hint="Optional — all of it">
                      <Text
                        label="Their Instagram or website"
                        value={person.url}
                        placeholder="https://"
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].url = v))
                        }
                      />
                      <Text
                        label="One-line note"
                        hint="For example: flash available all night"
                        value={person.note}
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].note = v))
                        }
                        ai={{
                          what: "one-line note under a performer on the bill",
                          about: { person: person.name, role: person.role, link: person.url, show: aboutShow(show) },
                        }}
                      />
                      <MediaField
                        label="Photo"
                        value={person.imageUrl}
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].imageUrl = v))
                        }
                        aspect={1}
                        previewHeight={90}
                      />
                      <Text
                        label="Photo description"
                        hint="For Google and screen readers"
                        value={person.imageAlt}
                        onChange={(v) =>
                          update((d) => void (d.shows[index].lineup[personIndex].imageAlt = v))
                        }
                        ai={{
                          what: "performer photo alt text",
                          about: { person: person.name, role: person.role, show: show.title },
                          image: person.imageUrl,
                        }}
                      />
                    </More>
                    <Actions>
                      <Button
                        disabled={personIndex === 0}
                        onClick={() =>
                          update((d) => {
                            if (personIndex === 0) return;
                            const list = d.shows[index].lineup;
                            [list[personIndex - 1], list[personIndex]] = [list[personIndex], list[personIndex - 1]];
                          })
                        }
                      >
                        ↑ Move up
                      </Button>
                      <Button
                        disabled={personIndex >= show.lineup.length - 1}
                        onClick={() =>
                          update((d) => {
                            const list = d.shows[index].lineup;
                            if (personIndex >= list.length - 1) return;
                            [list[personIndex + 1], list[personIndex]] = [list[personIndex], list[personIndex + 1]];
                          })
                        }
                      >
                        ↓ Move down
                      </Button>
                      <Button
                        tone="danger"
                        onClick={() => {
                          if (!confirmDelete(person.name ? `${person.name} from the bill` : "this person from the bill")) return;
                          update((d) => void d.shows[index].lineup.splice(personIndex, 1));
                        }}
                      >
                        Remove
                      </Button>
                    </Actions>
                  </div>
                ))}
              </Card>

              <Card title="Poster" subtitle={show.posterUrl ? "Uploaded" : "Optional — upload the artwork"}>
                <MediaField
                  label="Poster picture"
                  hint={`Cropped to ${settings.posterAspect}`}
                  value={show.posterUrl}
                  onChange={(v) => update((d) => void (d.shows[index].posterUrl = v))}
                  aspect={posterAspect}
                  previewHeight={180}
                />
                <ReadFlyerButton
                  posterUrl={show.posterUrl}
                  onRead={(flyer) => {
                    update((d) => void (d.shows[index] = applyFlyer(d.shows[index], flyer)));
                    setPosterLineup(show.id);
                  }}
                />
                <More title="Poster description" hint="For Google image search and screen readers">
                  <Text
                    label="What the poster shows"
                    value={show.posterAlt}
                    onChange={(v) => update((d) => void (d.shows[index].posterAlt = v))}
                    ai={{ what: "poster alt text", about: aboutShow(show), image: show.posterUrl }}
                  />
                </More>
              </Card>

              <More
                title="Everything else about this show"
                hint="Tagline, doors, address, price, description, photos, links, search settings"
              >
                <Area
                  label="Tagline"
                  hint="One line under the title"
                  rows={2}
                  value={show.tagline}
                  onChange={(v) => update((d) => void (d.shows[index].tagline = v))}
                  ai={{ what: "show tagline", about: aboutShow(show) }}
                />
                <Row>
                  <Text
                    label="Doors open"
                    type="time"
                    value={show.doorsTime}
                    onChange={(v) => update((d) => void (d.shows[index].doorsTime = v))}
                  />
                  <Text
                    label="Ends"
                    hint="Optional"
                    type="time"
                    value={show.endTime}
                    onChange={(v) => update((d) => void (d.shows[index].endTime = v))}
                  />
                </Row>
                <Row>
                  <Text
                    label="Price"
                    hint="For example: $15, Free, $10 adv / $15 door"
                    value={show.price}
                    onChange={(v) => update((d) => void (d.shows[index].price = v))}
                  />
                  <Text
                    label="Age"
                    hint="For example: 21+"
                    value={show.ageRestriction}
                    onChange={(v) => update((d) => void (d.shows[index].ageRestriction = v))}
                  />
                  <Select
                    label="Status"
                    value={show.status}
                    options={STATUSES}
                    onChange={(v) => update((d) => void (d.shows[index].status = v))}
                  />
                </Row>
                <Area
                  label="About this show"
                  hint="Blank line = new paragraph. ## for a heading, - for a bullet, **bold**, [text](link)"
                  rows={8}
                  value={show.description}
                  onChange={(v) => update((d) => void (d.shows[index].description = v))}
                  ai={{ what: "about this show (page body)", about: aboutShow(show) }}
                />

                <Sub>Where it is</Sub>
                <Text
                  label="Venue website"
                  value={show.venueUrl}
                  placeholder="https://"
                  onChange={(v) => update((d) => void (d.shows[index].venueUrl = v))}
                />
                <Text
                  label="Street address"
                  value={show.address}
                  onChange={(v) => update((d) => void (d.shows[index].address = v))}
                />
                <Row>
                  <Text label="City" value={show.city} onChange={(v) => update((d) => void (d.shows[index].city = v))} />
                  <Text label="State" value={show.region} onChange={(v) => update((d) => void (d.shows[index].region = v))} />
                  <Text label="ZIP" value={show.postalCode} onChange={(v) => update((d) => void (d.shows[index].postalCode = v))} />
                </Row>
                <Row>
                  <Text
                    label="Map link"
                    hint="A Google Maps link"
                    value={show.mapUrl}
                    placeholder="https://maps.google.com/..."
                    onChange={(v) => update((d) => void (d.shows[index].mapUrl = v))}
                  />
                  <Text
                    label="Room note"
                    hint="For example: downstairs, back room"
                    value={show.roomNote}
                    onChange={(v) => update((d) => void (d.shows[index].roomNote = v))}
                  />
                </Row>

                <Sub>Links</Sub>
                <Row>
                  <Text
                    label="Ticket button text"
                    value={show.ticketLabel}
                    onChange={(v) => update((d) => void (d.shows[index].ticketLabel = v))}
                  />
                  <Text
                    label="Instagram post for this show"
                    value={show.instagramUrl}
                    placeholder="https://www.instagram.com/p/..."
                    onChange={(v) => update((d) => void (d.shows[index].instagramUrl = v))}
                  />
                </Row>
                <Row>
                  <Select
                    label="Link a news recap"
                    hint="Adds a “Read the recap” button"
                    value={show.recapSlug}
                    options={[
                      { value: "", label: "None" },
                      ...content.posts.map((post) => ({ value: post.slug, label: post.title })),
                    ]}
                    onChange={(v) => update((d) => void (d.shows[index].recapSlug = v))}
                  />
                  <Select
                    label="Part of the weekly show?"
                    hint="A weekly night is what /bad-decisions shows as this week's lineup"
                    value={show.series || ""}
                    options={[
                      { value: "", label: "No — a one-off show" },
                      { value: content.weekly.slug, label: content.weekly.title },
                    ]}
                    onChange={(v) => update((d) => void (d.shows[index].series = v))}
                  />
                </Row>
                <Toggle
                  label="Featured"
                  hint="Gives it a bigger spot"
                  value={show.featured}
                  onChange={(v) => update((d) => void (d.shows[index].featured = v))}
                />

                <Sub>Photos from the night ({show.photos.length})</Sub>
                <div>
                  <Button onClick={() => update((d) => void d.shows[index].photos.push(newPhoto()))}>
                    ➕ Add a photo
                  </Button>
                </div>
                {show.photos.map((photo, photoIndex) => (
                  <div
                    key={photo.id}
                    className="grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
                  >
                    <MediaField
                      label="Photo"
                      value={photo.url}
                      onChange={(v) => update((d) => void (d.shows[index].photos[photoIndex].url = v))}
                      aspect={1}
                      previewHeight={120}
                    />
                    <Row>
                      <Text
                        label="Caption"
                        value={photo.caption}
                        onChange={(v) => update((d) => void (d.shows[index].photos[photoIndex].caption = v))}
                        ai={{ what: "show photo caption", about: aboutShow(show), image: photo.url }}
                      />
                      <Text
                        label="Photo description"
                        hint="For Google and screen readers"
                        value={photo.alt}
                        onChange={(v) => update((d) => void (d.shows[index].photos[photoIndex].alt = v))}
                        ai={{ what: "show photo alt text", about: aboutShow(show), image: photo.url }}
                      />
                    </Row>
                    <Actions>
                      <Button
                        tone="danger"
                        onClick={() => {
                          if (!confirmDelete("this photo")) return;
                          update((d) => void d.shows[index].photos.splice(photoIndex, 1));
                        }}
                      >
                        Remove photo
                      </Button>
                    </Actions>
                  </div>
                ))}

                <Sub>Web address</Sub>
                <Text
                  label="URL slug"
                  hint={`The page will be at /shows/${show.slug}`}
                  value={show.slug}
                  onChange={(v) => update((d) => void (d.shows[index].slug = slugify(v)))}
                />
                <Actions>
                  <Button
                    onClick={() =>
                      update((d) => void (d.shows[index].slug = slugify(`${show.title} ${show.date}`.trim())))
                    }
                  >
                    Make one from the name and date
                  </Button>
                </Actions>

                <SeoEditor
                  title="Search & AI settings for this show"
                  seo={show.seo}
                  suggestion={suggestFor(content, "show", undefined, show)}
                  about={aboutShow(show)}
                  onChange={(seo) => update((d) => void (d.shows[index].seo = seo))}
                />
              </More>

              <Actions>
                <Button
                  disabled={index === 0}
                  onClick={() =>
                    update((d) => {
                      if (index === 0) return;
                      [d.shows[index - 1], d.shows[index]] = [d.shows[index], d.shows[index - 1]];
                    })
                  }
                >
                  ↑ Move up
                </Button>
                <Button
                  disabled={index >= content.shows.length - 1}
                  onClick={() =>
                    update((d) => {
                      if (index >= d.shows.length - 1) return;
                      [d.shows[index + 1], d.shows[index]] = [d.shows[index], d.shows[index + 1]];
                    })
                  }
                >
                  ↓ Move down
                </Button>
                <Button
                  onClick={() =>
                    update((d) => {
                      const copy = structuredClone(d.shows[index]);
                      const stamp = Date.now().toString(36);
                      copy.id = `show-${stamp}`;
                      copy.slug = `${copy.slug}-copy-${stamp}`;
                      copy.title = `${copy.title} (copy)`;
                      copy.published = false;
                      d.shows.splice(index + 1, 0, copy);
                    })
                  }
                >
                  Make a copy
                </Button>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(`“${show.title}”`)) return;
                    update((d) => void d.shows.splice(index, 1));
                  }}
                >
                  Delete show
                </Button>
              </Actions>
            </Card>
          ) : null
        )}
      </Section>

      <div className="mb-6">
        <More
          title="Shows page settings"
          hint="Headings, poster shape, how many past shows to list, search settings"
        >
          <Text
            label="Page heading"
            value={settings.heading}
            onChange={(v) => update((d) => void (d.showsPage.heading = v))}
            ai={{ what: "shows page heading", about: { page: "the list of upcoming and past shows" } }}
          />
          <Text
            label="Past shows heading"
            value={settings.pastHeading}
            onChange={(v) => update((d) => void (d.showsPage.pastHeading = v))}
            ai={{ what: "past shows archive heading", about: { page: "the list of upcoming and past shows" } }}
          />
          <Area
            label="What the page says when nothing is announced"
            rows={2}
            value={settings.emptyText}
            onChange={(v) => update((d) => void (d.showsPage.emptyText = v))}
            ai={{ what: "empty state message when no shows are announced", about: { page: "the list of upcoming and past shows" } }}
          />
          <Select
            label="Poster shape (all shows)"
            hint="New uploads are cropped to this"
            value={settings.posterAspect}
            options={ASPECTS}
            onChange={(v) => update((d) => void (d.showsPage.posterAspect = v))}
          />
          <Row>
            <Num
              label="Space between past-show cards"
              value={settings.gap}
              min={0}
              max={64}
              suffix="px"
              onChange={(v) => update((d) => void (d.showsPage.gap = v))}
            />
            <Num
              label="Rounded corners"
              value={settings.cornerRadius}
              min={0}
              max={32}
              suffix="px"
              onChange={(v) => update((d) => void (d.showsPage.cornerRadius = v))}
            />
            <Num
              label="How many past shows to list"
              value={settings.pastLimit}
              min={0}
              max={200}
              onChange={(v) => update((d) => void (d.showsPage.pastLimit = v))}
            />
          </Row>
          <Toggle
            label="Show the past-shows list"
            hint="Past shows keep their own pages either way — this only hides the list."
            value={settings.showPastShows}
            onChange={(v) => update((d) => void (d.showsPage.showPastShows = v))}
          />
          <SeoEditor
            title="Search & AI settings for the Shows page"
            seo={settings.seo}
            suggestion={suggestFor(content, "shows")}
            about={{ page: "the list of upcoming and past shows", url: "/shows" }}
            onChange={(seo) => update((d) => void (d.showsPage.seo = seo))}
          />
        </More>
      </div>
    </>
  );
}
