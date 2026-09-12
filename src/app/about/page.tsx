import PageIntro from "@/components/PageIntro";
import BrandAccents from "@/components/BrandAccents";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/store";
import { toMetadata } from "@/lib/meta";
import { renderBody } from "@/lib/render";
import { breadcrumbSchema, faqSchema, organizationSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site, about } = await getContent();
  return await toMetadata(site, about.seo, "/about");
}

export default async function AboutPage() {
  const content = await getContent();
  const { site, about } = content;
  const faq = faqSchema(about.seo);

  return (
    <main>
      <JsonLd data={organizationSchema(content)} />
      <JsonLd
        data={breadcrumbSchema(site.url, [
          { name: "Home", path: "/" },
          { name: about.heading, path: "/about" },
        ])}
      />
      {faq ? <JsonLd data={faq} /> : null}

      <PageHeader hero={content.home.hero} nav={site.nav} active="/about" />
      <PageIntro title={about.heading} description={about.intro} artwork="pins-and-needles-heart" />

      <section className="mx-auto max-w-3xl px-5 py-14">
        <div
          className="pnc-prose text-[16px]"
          dangerouslySetInnerHTML={{ __html: renderBody(about.story) }}
        />
      </section>

      {about.logos.length ? (
        <section aria-label={about.logosHeading} className="w-full pt-4" data-logo-grid="">
          {/* Column count is admin-controlled on desktop and steps down on smaller screens. */}
          <style>{`
            [data-logo-grid] > div { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            @media (min-width: 640px) {
              [data-logo-grid] > div { grid-template-columns: repeat(${Math.min(
                3,
                about.logoColumns
              )}, minmax(0, 1fr)); }
            }
            @media (min-width: 1024px) {
              [data-logo-grid] > div { grid-template-columns: repeat(${about.logoColumns}, minmax(0, 1fr)); }
            }
          `}</style>
          <div className="grid w-full" style={{ gap: about.logoGap }}>
            {about.logos.filter((logo) => /\.svg(?:[?#]|$)/i.test(logo.url)).map((logo) => (
              <figure
                key={logo.id}
                className="relative m-0 flex aspect-square items-center justify-center bg-neutral-950"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.url}
                  alt={logo.alt || `${site.name} logo`}
                  loading="lazy"
                  decoding="async"
                  className="object-contain"
                  style={{ width: `${about.logoSize}%`, height: `${about.logoSize}%` }}
                />
                {logo.caption ? (
                  <figcaption className="absolute bottom-2 left-0 right-0 text-center text-[9px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
                    {logo.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}



      {about.producers.length ? (
        <section className="mx-auto max-w-5xl px-5 pb-24">
          <h2 className="mb-8 text-[11px] uppercase tracking-[0.32em] text-[var(--pnc-muted)]">
            {about.producersHeading}
          </h2>

          <div className="flex flex-col gap-12">
            {about.producers.map((producer) => (
              <article
                key={producer.id}
                className="border-t border-white/20 pt-6"
              >

                <div>
                  <h3 className="text-2xl">{producer.name}</h3>
                  {producer.role ? (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[var(--pnc-muted)]">
                      {producer.role}
                    </p>
                  ) : null}
                  <div
                    className="pnc-prose mt-4 text-[15px]"
                    dangerouslySetInnerHTML={{ __html: renderBody(producer.bio) }}
                  />
                  {producer.links.length ? (
                    <ul className="mt-4 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.2em]">
                      {producer.links.map((link) => (
                        <li key={link.id}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-4 hover:text-[var(--pnc-accent)]"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <BrandAccents names={["flash-heart-arrow", "flash-no-regrets-mouth", "flash-good-people"]} />
    </main>
  );
}
