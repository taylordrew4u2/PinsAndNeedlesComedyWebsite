import type { Metadata, Viewport } from "next";
import { Archivo_Black, Barlow_Condensed, Inter } from "next/font/google";
import { getContent } from "@/lib/store";
import { absoluteUrl } from "@/lib/seo";
import { socialImage } from "@/lib/assets";
import { onCanonicalHost } from "@/lib/host";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const poster = Barlow_Condensed({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-poster",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContent();
  const base = site.url || "https://pinsandneedlescomedy.com";
  const card = socialImage(base, absoluteUrl(base, site.seo.ogImage || "/brand/icon.svg"), "/");
  const indexable = (await onCanonicalHost(base)) && !site.seo.noindex;
  return {
    metadataBase: new URL(base),
    title: {
      default: site.seo.title || site.name,
      template: `%s | ${site.shortName || site.name}`,
    },
    description: site.seo.description,
    keywords: site.seo.keywords,
    applicationName: site.name,
    alternates: {
      canonical: site.seo.canonical || base,
      types: { "application/rss+xml": `${base}/rss.xml` },
    },
    icons: { icon: site.faviconUrl || "/brand/icon.svg", apple: site.faviconUrl || "/brand/icon.svg" },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: site.seo.title || site.name,
      description: site.seo.description,
      url: site.seo.canonical || base,
      images: [card],
    },
    twitter: {
      card: "summary_large_image",
      title: site.seo.title || site.name,
      description: site.seo.description,
      images: [card],
    },
    robots: indexable
      ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
      : { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { site } = await getContent();
  return { themeColor: site.background, colorScheme: "dark" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getContent();
  const { site } = content;

  const themeVars = [
    `--pnc-bg:${site.background}`,
    `--pnc-fg:${site.foreground}`,
    `--pnc-accent:${site.accent}`,
    `--pnc-muted:${site.muted}`,
    `--pnc-heading:${site.headingFont}`,
    `--pnc-body:${site.bodyFont}`,
  ].join(";");

  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${poster.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${themeVars}}` }} />
      </head>
      <body>
        {children}
        {site.showFooter ? <SiteFooter site={site} /> : null}
      </body>
    </html>
  );
}
