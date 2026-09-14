"use client";

import { useState } from "react";
import type { Content, Show, ShowPerformer, ShowPhoto } from "@/lib/types";
import { aspectValue } from "@/lib/render";
import { emptySeo, slugify } from "@/lib/seo";
import { Area, Button, Card, Num, Row, Section, Select, Text, Toggle } from "../ui";
import UpcomingLineups from "../UpcomingLineups";
import MediaField from "../MediaField";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";
import { newWeeklyShow } from "@/lib/decisions";
import { nyToday } from "@/lib/shows";

const ASPECTS = [
  { value: "9:16" as const, label: "9:16 — tall (story / reel shape)" },
  { value: "4:5" as const, label: "4:5 — portrait (Instagram poster)" },
  { value: "1:1" as const, label: "1:1 — square" },
  { value: "3:2" as const, label: "3:2 — landscape" },
  { value: "16:9" as const, label: "16:9 — wide" },
];

const STATUSES = [
  { value: "scheduled" as const, label: "Scheduled — on sale / happening" },
  { value: "sold-out" as const, label: "Sold out" },
  { value: "postponed" as const, label: "Postponed" },
  { value: "cancelled" as const, label: "Cancelled" },
];

/** Roles that get their own heading on the public page. Free text is fine too. */
const ROLE_SUGGESTIONS = ["Host", "Comedian", "Tattoo artist", "Vendor", "Musician", "Special guest"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const newShow = (): Show => {
  const stamp = Date.now().toString(36);
  return {
    id: `show-${stamp}`,
    slug: `new-show-${stamp}`,
    title: "New show",
    tagline: "",
    date: today(),
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

export default function ShowsTab({ content, update }: { content: Content; update: Update }) {
  const [openedShow, setOpenedShow] = useState<string | null>(null);
  const settings = content.showsPage;
  const posterAspect = aspectValue(settings.posterAspect);

  return (
    <>
      <Section
        title={`Shows (${content.shows.length})`}
        hint="One place for each night’s lineup, tickets and details. Changes save automatically; past shows stay here for the archive."
      >
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={() => update((d) => void d.shows.unshift(newShow()))}>
            New show
          </Button>
          {content.weekly.enabled && !content.weekly.showOnShowsPage ? (
            <Button
              onClick={() =>
                update((d) => void d.shows.unshift(newWeeklyShow(d.weekly, nyToday())))
              }
            >
              New {content.weekly.title.replace(/^Pins & Needles:\s*/i, "")} night
            </Button>
          ) : null}
        </div>
        {content.weekly.enabled && !content.weekly.showOnShowsPage ? (
          <p className="-mt-2 text-[12px] text-neutral-500">
            The second button fills in next {content.weekly.weekday}&apos;s date, the venue and the
            times from the Bad Decisions tab — you add the bill and publish. That night then shows
            up as &quot;this week&quot; on /bad-decisions.
          </p>
        ) : null}

        <UpcomingLineups content={content} update={update} onCreated={setOpenedShow} />

        {content.shows.map((show, index) => (
          <Card
            key={show.id}
            defaultOpen={openedShow === show.id}
            title={show.title}
            subtitle={`${show.date}${show.venueName ? ` · ${show.venueName}` : ""}${
              show.published ? "" : " · draft"
            }`}
          >
            <Text
              label="Show title"
              hint="e.g. Pins & Needles Comedy at Secret Pour"
              value={show.title}
              onChange={(v) => update((d) => void (d.shows[index].title = v))}
            />
            <Area
              label="Tagline"
              hint="one line under the title"
              rows={2}
              value={show.tagline}
              onChange={(v) => update((d) => void (d.shows[index].tagline = v))}
            />
            <Row>
              <Text
                label="URL slug"
                hint={`/shows/${show.slug}`}
                value={show.slug}
                onChange={(v) => update((d) => void (d.shows[index].slug = slugify(v)))}
              />
              <Text
                label="Date"
                type="date"
                value={show.date}
                onChange={(v) => update((d) => void (d.shows[index].date = v))}
              />
            </Row>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  update(
                    (d) =>
                      void (d.shows[index].slug = slugify(
                        `${show.title} ${show.date}`.trim()
                      ))
                  )
                }
              >
                Slug from title + date
              </Button>
            </div>

            <Row>
              <Text
                label="Doors"
                type="time"
                value={show.doorsTime}
                onChange={(v) => update((d) => void (d.shows[index].doorsTime = v))}
              />
              <Text
                label="Show starts"
                type="time"
                value={show.startTime}
                onChange={(v) => update((d) => void (d.shows[index].startTime = v))}
              />
              <Text
                label="Ends"
                hint="optional"
                type="time"
                value={show.endTime}
                onChange={(v) => update((d) => void (d.shows[index].endTime = v))}
              />
            </Row>

            <Row>
              <Text
                label="Venue name"
                value={show.venueName}
                onChange={(v) => update((d) => void (d.shows[index].venueName = v))}
              />
              <Text
                label="Venue website"
                value={show.venueUrl}
                placeholder="https://"
                onChange={(v) => update((d) => void (d.shows[index].venueUrl = v))}
              />
            </Row>
            <Text
              label="Street address"
              value={show.address}
              onChange={(v) => update((d) => void (d.shows[index].address = v))}
            />
            <Row>
              <Text
                label="City"
                value={show.city}
                onChange={(v) => update((d) => void (d.shows[index].city = v))}
              />
              <Text
                label="State"
                value={show.region}
                onChange={(v) => update((d) => void (d.shows[index].region = v))}
              />
              <Text
                label="ZIP"
                value={show.postalCode}
                onChange={(v) => update((d) => void (d.shows[index].postalCode = v))}
              />
            </Row>
            <Row>
              <Text
                label="Map link"
                hint="Google Maps URL"
                value={show.mapUrl}
                placeholder="https://maps.google.com/..."
                onChange={(v) => update((d) => void (d.shows[index].mapUrl = v))}
              />
              <Text
                label="Room note"
                hint="e.g. downstairs, back room"
                value={show.roomNote}
                onChange={(v) => update((d) => void (d.shows[index].roomNote = v))}
              />
            </Row>

            <Row>
              <Text
                label="Ticket link"
                value={show.ticketUrl}
                placeholder="https://"
                onChange={(v) => update((d) => void (d.shows[index].ticketUrl = v))}
              />
              <Text
                label="Ticket button text"
                value={show.ticketLabel}
                onChange={(v) => update((d) => void (d.shows[index].ticketLabel = v))}
              />
            </Row>
            <Row>
              <Text
                label="Price"
                hint="e.g. $15, Free, $10 adv / $15 door"
                value={show.price}
                onChange={(v) => update((d) => void (d.shows[index].price = v))}
              />
              <Text
                label="Age"
                hint="e.g. 21+"
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

            <MediaField
              label="Poster"
              hint={`cropped to ${settings.posterAspect}`}
              value={show.posterUrl}
              onChange={(v) => update((d) => void (d.shows[index].posterUrl = v))}
              aspect={posterAspect}
              previewHeight={180}
            />
            <Text
              label="Poster alt text"
              hint="describe the poster — image SEO and accessibility"
              value={show.posterAlt}
              onChange={(v) => update((d) => void (d.shows[index].posterAlt = v))}
            />

            <Area
              label="About this show"
              hint="blank line = new paragraph · ## heading · - bullet · [text](url) · **bold**"
              rows={8}
              value={show.description}
              onChange={(v) => update((d) => void (d.shows[index].description = v))}
            />

            <div className="rounded-lg border border-neutral-800 p-3">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
                The bill ({show.lineup.length})
                <span className="ml-2 normal-case tracking-normal text-neutral-600">
                  comics, hosts, tattoo artists, vendors — grouped by role on the page
                </span>
              </p>

              <div className="mb-3 flex flex-wrap gap-2">
                {ROLE_SUGGESTIONS.map((role) => (
                  <Button
                    key={role}
                    onClick={() => update((d) => void d.shows[index].lineup.push(newPerformer(role)))}
                  >
                    + {role}
                  </Button>
                ))}
              </div>

              {show.lineup.map((person, personIndex) => (
                <div
                  key={person.id}
                  className="mb-3 grid gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-3"
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
                      value={person.role}
                      onChange={(v) =>
                        update((d) => void (d.shows[index].lineup[personIndex].role = v))
                      }
                    />
                  </Row>
                  <Row>
                    <Text
                      label="Link"
                      hint="Instagram or website"
                      value={person.url}
                      placeholder="https://"
                      onChange={(v) =>
                        update((d) => void (d.shows[index].lineup[personIndex].url = v))
                      }
                    />
                    <Text
                      label="Note"
                      hint="e.g. flash available all night"
                      value={person.note}
                      onChange={(v) =>
                        update((d) => void (d.shows[index].lineup[personIndex].note = v))
                      }
                    />
                  </Row>
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
                    label="Photo alt text"
                    value={person.imageAlt}
                    onChange={(v) =>
                      update((d) => void (d.shows[index].lineup[personIndex].imageAlt = v))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        update((d) => {
                          if (personIndex === 0) return;
                          const list = d.shows[index].lineup;
                          [list[personIndex - 1], list[personIndex]] = [
                            list[personIndex],
                            list[personIndex - 1],
                          ];
                        })
                      }
                    >
                      Move up
                    </Button>
                    <Button
                      onClick={() =>
                        update((d) => {
                          const list = d.shows[index].lineup;
                          if (personIndex >= list.length - 1) return;
                          [list[personIndex + 1], list[personIndex]] = [
                            list[personIndex],
                            list[personIndex + 1],
                          ];
                        })
                      }
                    >
                      Move down
                    </Button>
                    <Button
                      tone="danger"
                      onClick={() =>
                        update((d) => void d.shows[index].lineup.splice(personIndex, 1))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-neutral-800 p-3">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
                Photos from the night ({show.photos.length})
              </p>
              <Button onClick={() => update((d) => void d.shows[index].photos.push(newPhoto()))}>
                Add photo
              </Button>
              {show.photos.map((photo, photoIndex) => (
                <div
                  key={photo.id}
                  className="mt-3 grid gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-3"
                >
                  <MediaField
                    label="Photo"
                    value={photo.url}
                    onChange={(v) =>
                      update((d) => void (d.shows[index].photos[photoIndex].url = v))
                    }
                    aspect={1}
                    previewHeight={120}
                  />
                  <Row>
                    <Text
                      label="Alt text"
                      value={photo.alt}
                      onChange={(v) =>
                        update((d) => void (d.shows[index].photos[photoIndex].alt = v))
                      }
                    />
                    <Text
                      label="Caption"
                      value={photo.caption}
                      onChange={(v) =>
                        update((d) => void (d.shows[index].photos[photoIndex].caption = v))
                      }
                    />
                  </Row>
                  <div>
                    <Button
                      tone="danger"
                      onClick={() => update((d) => void d.shows[index].photos.splice(photoIndex, 1))}
                    >
                      Remove photo
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Row>
              <Select
                label="Link a news recap"
                hint="shows a 'Read the recap' button"
                value={show.recapSlug}
                options={[
                  { value: "", label: "None" },
                  ...content.posts.map((post) => ({ value: post.slug, label: post.title })),
                ]}
                onChange={(v) => update((d) => void (d.shows[index].recapSlug = v))}
              />
              <Text
                label="Instagram post for this show"
                value={show.instagramUrl}
                placeholder="https://www.instagram.com/p/..."
                onChange={(v) => update((d) => void (d.shows[index].instagramUrl = v))}
              />
            </Row>

            <Select
              label="Part of a weekly"
              hint="a weekly night is what /bad-decisions shows as this week's lineup"
              value={show.series || ""}
              options={[
                { value: "", label: "No — a one-off show" },
                { value: content.weekly.slug, label: content.weekly.title },
              ]}
              onChange={(v) => update((d) => void (d.shows[index].series = v))}
            />

            <Row>
              <Toggle
                label="Published"
                hint="off = only you can see it"
                value={show.published}
                onChange={(v) => update((d) => void (d.shows[index].published = v))}
              />
              <Toggle
                label="Featured"
                value={show.featured}
                onChange={(v) => update((d) => void (d.shows[index].featured = v))}
              />
            </Row>

            <SeoEditor
              title="Show SEO & AI SEO"
              seo={show.seo}
              suggestion={suggestFor(content, "show", undefined, show)}
              onChange={(seo) => update((d) => void (d.shows[index].seo = seo))}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  update((d) => {
                    if (index === 0) return;
                    [d.shows[index - 1], d.shows[index]] = [d.shows[index], d.shows[index - 1]];
                  })
                }
              >
                Move up
              </Button>
              <Button
                onClick={() =>
                  update((d) => {
                    if (index >= d.shows.length - 1) return;
                    [d.shows[index + 1], d.shows[index]] = [d.shows[index], d.shows[index + 1]];
                  })
                }
              >
                Move down
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
                Duplicate
              </Button>
              <Button tone="danger" onClick={() => update((d) => void d.shows.splice(index, 1))}>
                Delete show
              </Button>
            </div>
          </Card>
        ))}
      </Section>

      <Section
        title="Shows page"
        hint="Page heading, empty state and past-show archive settings. Manage dates and lineups in the show list above."
      >
        <Text
          label="Heading"
          value={settings.heading}
          onChange={(v) => update((d) => void (d.showsPage.heading = v))}
        />
        <Row>
          <Text
            label="Past shows heading"
            value={settings.pastHeading}
            onChange={(v) => update((d) => void (d.showsPage.pastHeading = v))}
          />
        </Row>
        <Area
          label="Text shown when nothing is announced"
          rows={2}
          value={settings.emptyText}
          onChange={(v) => update((d) => void (d.showsPage.emptyText = v))}
        />
        <Select
          label="Poster orientation (all shows)"
          hint="new uploads are cropped to this"
          value={settings.posterAspect}
          options={ASPECTS}
          onChange={(v) => update((d) => void (d.showsPage.posterAspect = v))}
        />
        <Row>
          <Num
            label="Past-show card spacing"
            value={settings.gap}
            min={0}
            max={64}
            suffix="px"
            onChange={(v) => update((d) => void (d.showsPage.gap = v))}
          />
          <Num
            label="Corner radius"
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
          label="Show the past-shows archive"
          hint="Past shows keep their own pages either way — this only hides the list."
          value={settings.showPastShows}
          onChange={(v) => update((d) => void (d.showsPage.showPastShows = v))}
        />
      </Section>

      <SeoEditor
        title="Shows page SEO & AI SEO"
        seo={settings.seo}
        suggestion={suggestFor(content, "shows")}
        onChange={(seo) => update((d) => void (d.showsPage.seo = seo))}
      />

    </>
  );
}
