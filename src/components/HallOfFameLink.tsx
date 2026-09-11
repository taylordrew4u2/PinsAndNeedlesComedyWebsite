import Link from "next/link";
import styles from "./HallOfFameLink.module.css";

export default function HallOfFameLink() {
  return (
    <div className={styles.section}>
      <Link href="/hall-of-fame" className={styles.link} aria-label="Visit the Hall of Fame">
        <svg viewBox="0 0 200 200" className={styles.star} aria-hidden="true">
          <defs>
            <linearGradient id="hall-star-gold" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff1c4" />
              <stop offset=".4" stopColor="#d9b765" />
              <stop offset=".7" stopColor="#b58b3d" />
              <stop offset="1" stopColor="#f2d991" />
            </linearGradient>
          </defs>
          <path d="m100 8 23 63 67 2-52 42 18 67-56-39-56 39 18-67L10 73l67-2Z" fill="url(#hall-star-gold)" stroke="#f6df9e" strokeWidth="1.5" />
        </svg>
        <span className={styles.name}>Hall of<br />Fame</span>
      </Link>
    </div>
  );
}
