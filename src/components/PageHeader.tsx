import Image from "next/image";
import Link from "next/link";
import type { Hero, NavItem } from "@/lib/types";

/** Compact version of the home hero for interior pages. */
export default function PageHeader({
  hero,
  nav,
  active,
}: {
  hero: Hero;
  nav: NavItem[];
  active: string;
}) {
  return (
    <header
      className="flex w-full flex-col items-center gap-4 px-5 pb-5 pt-8"
      style={{ background: hero.background, color: hero.foreground }}
    >
      <Link href="/" aria-label="Pins & Needles Comedy — home" className="flex flex-col items-center gap-2">
        {hero.logoUrl ? (
          <Image
            src={hero.logoUrl}
            alt={hero.logoAlt}
            width={512}
            height={512}
            sizes="140px"
            style={{ width: "min(120px, 34vw)", height: "auto" }}
            priority
          />
        ) : null}
        <span
          className={hero.logoUrl ? "sr-only" : "text-center leading-none"}
          style={{
            fontFamily: hero.wordmarkFont,
            fontSize: 15,
            letterSpacing: `${hero.wordmarkLetterSpacing / 100}em`,
          }}
        >
          {hero.wordmark}
        </span>
      </Link>

      <nav
        aria-label="Primary"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 uppercase"
        style={{ fontSize: hero.navSize, letterSpacing: `${hero.navLetterSpacing / 100}em` }}
      >
        {nav.map((item, index) => (
          <span key={item.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="opacity-40">
                {hero.navSeparator}
              </span>
            ) : null}
            <Link
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={
                active === item.href
                  ? "opacity-100 underline underline-offset-[6px]"
                  : "opacity-70 transition-opacity hover:opacity-100"
              }
            >
              {item.label}
            </Link>
          </span>
        ))}
      </nav>
    </header>
  );
}
