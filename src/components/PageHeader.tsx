import Image from "next/image";
import Link from "next/link";
import type { Hero, NavItem } from "@/lib/types";
import styles from "./PageHeader.module.css";
export default function PageHeader({
  hero,
  nav,
  active,
  navigationOnly = false,
}: {
  hero: Hero;
  nav: NavItem[];
  active: string;
  navigationOnly?: boolean;
}) {
  const links = nav.map((item) => (
    <Link
      key={item.id}
      href={item.href}
      aria-current={active === item.href ? "page" : undefined}
    >
      {item.label}
    </Link>
  ));
  return (
    <header
      className={styles.header}
      style={{ background: hero.background, color: hero.foreground }}
    >
      <div
        className={`${styles.inner} ${navigationOnly ? styles.navigationOnly : ""}`}
      >
        <Link
          href="/"
          aria-label="Pins & Needles Comedy home"
          className={`${styles.brand} ${navigationOnly ? styles.homeBrand : ""}`}
        >
          {hero.logoUrl ? (
            <Image
              src={hero.logoUrl}
              alt={hero.logoAlt}
              width={80}
              height={80}
              priority
            />
          ) : (
            hero.wordmark
          )}
        </Link>
        <nav className={styles.desktop} aria-label="Primary">
          {links}
        </nav>
        <details className={styles.mobile}>
          <summary>
            Menu <span className={styles.menuLines} aria-hidden="true" />
          </summary>
          <nav aria-label="Mobile navigation">{links}</nav>
        </details>
      </div>
    </header>
  );
}
