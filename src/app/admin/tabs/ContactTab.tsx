"use client";

import type { Content } from "@/lib/types";
import { Area, Button, Card, Row, Section, Text } from "../ui";
import SeoEditor from "../SeoEditor";
import { suggestFor } from "../suggest";
import type { Update } from "../types";

export default function ContactTab({ content, update }: { content: Content; update: Update }) {
  const { contact } = content;
  const page = {
    page: "contact: bookings, performer submissions, press",
    url: "/contact",
    email: contact.email,
    bookingEmail: contact.bookingEmail,
    city: contact.city,
  };

  return (
    <>
      <Section title="Contact page">
        <Text
          label="Heading"
          value={contact.heading}
          onChange={(v) => update((d) => void (d.contact.heading = v))}
          ai={{ what: "contact page heading", about: page }}
        />
        <Area
          label="Intro"
          rows={2}
          value={contact.intro}
          onChange={(v) => update((d) => void (d.contact.intro = v))}
          ai={{ what: "contact page intro", about: page }}
        />
        <Row>
          <Text
            label="General email"
            value={contact.email}
            onChange={(v) => update((d) => void (d.contact.email = v))}
          />
          <Text
            label="Booking email"
            value={contact.bookingEmail}
            onChange={(v) => update((d) => void (d.contact.bookingEmail = v))}
          />
        </Row>
        <Row>
          <Text
            label="Submissions link"
            value={contact.submissionsUrl}
            onChange={(v) => update((d) => void (d.contact.submissionsUrl = v))}
          />
          <Text
            label="Submissions label"
            value={contact.submissionsLabel}
            onChange={(v) => update((d) => void (d.contact.submissionsLabel = v))}
          />
        </Row>
        <Text
          label="City"
          value={contact.city}
          onChange={(v) => update((d) => void (d.contact.city = v))}
        />
      </Section>

      <Section title="Extra contact rows">
        {contact.blocks.map((block, index) => (
          <Card key={block.id} title={block.label} subtitle={block.value}>
            <Row>
              <Text
                label="Label"
                value={block.label}
                onChange={(v) => update((d) => void (d.contact.blocks[index].label = v))}
              />
              <Text
                label="Text"
                value={block.value}
                onChange={(v) => update((d) => void (d.contact.blocks[index].value = v))}
              />
              <Text
                label="Link"
                value={block.href}
                onChange={(v) => update((d) => void (d.contact.blocks[index].href = v))}
              />
            </Row>
            <Button tone="danger" onClick={() => update((d) => void d.contact.blocks.splice(index, 1))}>
              Remove
            </Button>
          </Card>
        ))}
        <Button
          onClick={() =>
            update((d) =>
              void d.contact.blocks.push({
                id: `contact-${Date.now().toString(36)}`,
                label: "New",
                value: "",
                href: "",
              })
            )
          }
        >
          Add a row
        </Button>
      </Section>

      <SeoEditor
        title="Contact SEO & AI SEO"
        seo={contact.seo}
        suggestion={suggestFor(content, "contact")}
        about={page}
        onChange={(seo) => update((d) => void (d.contact.seo = seo))}
      />
    </>
  );
}
