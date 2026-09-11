import type { HallOfFamePage, HallPerformer, NavItem } from "./types";

export function hallNavigation(nav: NavItem[], hall: HallOfFamePage): NavItem[] {
  if (!hall.showInNav) return nav.filter((item) => item.href !== "/hall-of-fame");
  if (nav.some((item) => item.href === "/hall-of-fame")) return nav;
  return [...nav, { id: "nav-hall-of-fame", label: "Hall of Fame", href: "/hall-of-fame" }];
}

export function alphabeticalPerformers<T extends { name: string }>(people: T[]): T[] {
  return [...people].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), "en", { sensitivity: "base", numeric: true }));
}

export function publishedPerformers(hall: HallOfFamePage) {
  return alphabeticalPerformers(hall.performers.filter((person) => person.published && person.name.trim()));
}

export function performerLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export const socialPlatforms = {
  instagram: { label: "Instagram", base: "https://www.instagram.com/" },
  tiktok: { label: "TikTok", base: "https://www.tiktok.com/@" },
  x: { label: "X", base: "https://x.com/" },
  youtube: { label: "YouTube", base: "https://www.youtube.com/@" },
  threads: { label: "Threads", base: "https://www.threads.net/@" },
  bluesky: { label: "Bluesky", base: "https://bsky.app/profile/" },
} as const;

export function performerSocial(person: HallPerformer): { url: string; label: string } | null {
  const handle = (person.socialHandle || "").trim().replace(/^@/, "");
  if (!handle) {
    const url = performerLink(person.linkUrl);
    return url ? { url, label: person.linkLabel || "Find them online" } : null;
  }
  const platform = socialPlatforms[person.socialPlatform || "instagram"];
  if (!platform || !/^[a-zA-Z0-9_.-]+$/.test(handle)) return null;
  return { url: platform.base + encodeURIComponent(handle), label: `@${handle}` };
}
