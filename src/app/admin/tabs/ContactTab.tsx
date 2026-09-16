"use client";

import type { Content } from "@/lib/types";
import { Actions, Area, Button, Card, More, Row, Section, Text, confirmDelete } from "../ui";
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
      <Section icon="📬" title="How people reach you" hint="What shows on the Contact page.">
        <Row>
          <Text
            label="General email"
            type="email"
            value={contact.email}
            onChange={(v) => update((d) => void (d.contact.email = v))}
          />
          <Text
            label="Booking email"
            type="email"
            value={contact.bookingEmail}
            onChange={(v) => update((d) => void (d.contact.bookingEmail = v))}
          />
        </Row>
        <Row>
          <Text
            label="Where performers apply"
            hint="A link to a form or a page"
            placeholder="https://"
            value={contact.submissionsUrl}
            onChange={(v) => update((d) => void (d.contact.submissionsUrl = v))}
          />
          <Text
            label="What that link says"
            value={contact.submissionsLabel}
            onChange={(v) => update((d) => void (d.contact.submissionsLabel = v))}
          />
        </Row>
        <Text label="City" value={contact.city} onChange={(v) => update((d) => void (d.contact.city = v))} />
      </Section>

      <div className="mb-6">
        <More title="Page heading and intro" hint="The words at the top of /contact">
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
        </More>
      </div>

      <div className="mb-6">
        <More
          title={`Extra contact rows (${contact.blocks.length})`}
          hint="Anything else: press, a phone number, a Discord"
        >
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
                  hint="Optional"
                  value={block.href}
                  onChange={(v) => update((d) => void (d.contact.blocks[index].href = v))}
                />
              </Row>
              <Actions>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (!confirmDelete(`the “${block.label}” row`)) return;
                    update((d) => void d.contact.blocks.splice(index, 1));
                  }}
                >
                  Remove
                </Button>
              </Actions>
            </Card>
          ))}
          <div>
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
              ➕ Add a row
            </Button>
          </div>
        </More>
      </div>

      <div className="mb-6">
        <SeoEditor
          title="Search & AI settings for the Contact page"
          seo={contact.seo}
          suggestion={suggestFor(content, "contact")}
          about={page}
          onChange={(seo) => update((d) => void (d.contact.seo = seo))}
        />
      </div>
    </>
  );
}
