import { getContent } from "@/lib/store";
import { clamp, siteBase, stripMarkdown } from "@/lib/seo";

export const dynamic = "force-dynamic";

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET() {
  const content = await getContent();
  const base = siteBase(content.site.url);

  const items = content.posts
    .filter((post) => post.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((post) => {
      const url = `${base}/news/${post.slug}`;
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(post.excerpt || clamp(stripMarkdown(post.body), 300))}</description>
      ${post.tags.map((tag) => `<category>${escape(tag)}</category>`).join("\n      ")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(content.site.name)} — News</title>
    <link>${base}/news</link>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(content.news.seo.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(content.updatedAt || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}
