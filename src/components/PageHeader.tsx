import Image from "next/image";
import Link from "next/link";
import type { Hero, NavItem } from "@/lib/types";
import styles from "./PageHeader.module.css";

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
      className={styles.header}
      style={{ background: hero.background, color: hero.foreground }}
    >
      <div className={styles.inner}>
        <Link
          href="/"
          aria-label="Pins & Needles Comedy — home"
          className={styles.brand}
        >
          {hero.logoUrl ? (
            <Image
              src={hero.logoUrl}
              alt={hero.logoAlt}
              width={84}
              height={84}
              priority
            />
          ) : (
            hero.wordmark
          )}
        </Link>
        <nav aria-label="Primary" className={styles.nav}>
          {nav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
