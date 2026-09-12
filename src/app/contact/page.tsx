import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, contact } = await getContent();
  return await toMetadata(site, contact.seo, "/contact");
}

export default async function ContactPage() {
  const content = await getContent();
  const { site, contact } = content;
  const faq = faqSchema(contact.seo);

  const rows = [
    contact.email ? { id: "email", label: "General", value: contact.email, href: `mailto:${contact.email}` } : null,
    contact.bookingEmail && contact.bookingEmail !== contact.email
      ? { id: "booking", label: "Booking", value: contact.bookingEmail, href: `mailto:${contact.bookingEmail}` }
      : null,
    contact.submissionsUrl
      ? {
          id: "submissions",
          label: contact.submissionsLabel || "Comic submissions",
          value: "Submit",
          href: contact.submissionsUrl,
        }
      : null,
    ...contact.blocks,
  ].filter(Boolean) as { id: string; label: string; value: string; href: string }[];

  return (
    <main>
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: contact.heading, path: "/contact" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/contact" />
      <BrandAccents names={["flash-telephone"]}  />

      <section className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        <h1 className="text-3xl sm:text-4xl">{contact.heading}</h1>
        {contact.intro ? (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--pnc-muted)]">{contact.intro}</p>
        ) : null}

        <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 py-5">
              <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
                {row.label}
              </span>
              <a
                href={row.href}
                target={row.href.startsWith("http") ? "_blank" : undefined}
                rel={row.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-[16px] underline underline-offset-4 hover:text-[var(--pnc-accent)]"
              >
                {row.value}
              </a>
            </li>
          ))}
        </ul>

        {contact.city ? (
          <p className="mt-8 text-[10px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
            {contact.city}
          </p>
        ) : null}
      </section>
      <BrandAccents names={["flash-smoking-heart"]} />
    </main>
  );
}
