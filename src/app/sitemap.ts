import type { MetadataRoute } from "next";
import { getContent } from "@/lib/store";
import { nyToday, splitShows } from "@/lib/shows";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getContent();
  const base = content.site.url.replace(/\/+$/, "");
  const now = new Date(content.updatedAt || Date.now());

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/news`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/shows`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...(content.weekly.enabled && !content.weekly.seo.noindex
      ? [{ url: `${base}/bad-decisions`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 }]
      : []),
    ...(!content.hallOfFame.seo.noindex ? [{ url: `${base}/hall-of-fame`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 }] : []),
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const posts: MetadataRoute.Sitemap = content.posts
    .filter((post) => post.published && !post.seo.noindex)
    .map((post) => ({
      url: `${base}/news/${post.slug}`,
      lastModified: new Date(`${post.date}T12:00:00Z`),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    }));

  const { upcoming } = splitShows(content.shows, nyToday());
  const upcomingSlugs = new Set(upcoming.map((show) => show.slug));

  const shows: MetadataRoute.Sitemap = content.shows
    .filter((show) => show.published && !show.seo.noindex)
    .map((show) => ({
      url: `${base}/shows/${show.slug}`,
      lastModified: new Date(`${show.date}T12:00:00Z`),
      // An announced show changes right up to the night; an old one never does.
      changeFrequency: upcomingSlugs.has(show.slug) ? ("daily" as const) : ("yearly" as const),
      priority: upcomingSlugs.has(show.slug) ? 0.9 : 0.5,
    }));

  return [...staticPages, ...shows, ...posts];
}
