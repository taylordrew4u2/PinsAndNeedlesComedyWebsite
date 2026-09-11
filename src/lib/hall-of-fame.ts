import type { HallOfFamePage, NavItem } from "./types";

export function hallNavigation(nav: NavItem[], hall: HallOfFamePage): NavItem[] {
  if (!hall.showInNav) return nav.filter((item) => item.href !== "/hall-of-fame");
  if (nav.some((item) => item.href === "/hall-of-fame")) return nav;
  return [...nav, { id: "nav-hall-of-fame", label: "Hall of Fame", href: "/hall-of-fame" }];
}

export function publishedPerformers(hall: HallOfFamePage) {
  return hall.performers.filter((person) => person.published && person.name.trim());
}

export function performerLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
