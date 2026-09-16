/** The admin's sections, in the order they appear in the menu. */
export const TABS = [
  { id: "start", icon: "🏁", label: "Start", blurb: "The usual jobs, one tap each" },
  { id: "shows", icon: "🎤", label: "Shows", blurb: "Dates, lineups and tickets" },
  { id: "weekly", icon: "🎲", label: "Bad Decisions", blurb: "The weekly show and tonight's pile" },
  { id: "news", icon: "📰", label: "News", blurb: "Recaps and announcements" },
  { id: "reels", icon: "🎬", label: "Reels", blurb: "Instagram videos on the site" },
  { id: "hall", icon: "⭐", label: "Hall of Fame", blurb: "Everyone who has performed" },
  { id: "home", icon: "🏠", label: "Homepage", blurb: "The headline and the logo" },
  { id: "about", icon: "👋", label: "About", blurb: "Your story and the producers" },
  { id: "contact", icon: "📬", label: "Contact", blurb: "Emails and links" },
  { id: "shop", icon: "🛍️", label: "Shop", blurb: "The merch page" },
  { id: "site", icon: "⚙️", label: "Site settings", blurb: "Name, colors, menu, search" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** Jump to a section, optionally opening one item in it (a show, a post, a person). */
export type Go = (tab: TabId, focus?: string) => void;
