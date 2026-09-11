"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export default function SiteFooter({ site }: { site: SiteSettings }) {
  const pathname = usePathname();
  if (pathname === "/bad-decisions" || pathname === "/bad-decisions/") return null;

  return (
    <footer className="border-t border-white/10 px-5 py-8 text-[11px] tracking-[0.18em] uppercase text-[var(--pnc-muted)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {site.nav.map((item) => (
            <Link key={item.id} href={item.href} className="hover:text-[var(--pnc-fg)]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {site.socials.map((social) => (
            <a
              key={social.id}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--pnc-fg)]"
            >
              {social.label}
            </a>
          ))}
        </div>
        <p className="normal-case tracking-normal">{site.footerText}</p>
      </div>
    </footer>
  );
}
