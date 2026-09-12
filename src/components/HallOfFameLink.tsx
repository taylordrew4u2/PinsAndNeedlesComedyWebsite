import Link from "next/link";
import styles from "./HallOfFameLink.module.css";

export default function HallOfFameLink({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className={`${styles.section} ${compact ? styles.compact : ""}`}>
      <Link
        href="/hall-of-fame"
        className={styles.link}
        aria-label="Visit the Hall of Fame"
      >
        <svg viewBox="0 0 200 200" className={styles.star} aria-hidden="true">
          <defs>
            <linearGradient id="hall-star-gold" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff8d7" />
              <stop offset=".28" stopColor="#e9c56a" />
              <stop offset=".46" stopColor="#fff0ac" />
              <stop offset=".51" stopColor="#d2a33e" />
              <stop offset=".78" stopColor="#a87524" />
              <stop offset="1" stopColor="#fce9a4" />
            </linearGradient>
            <linearGradient id="hall-star-edge" x1="0" y1="0" x2=".8" y2="1">
              <stop stopColor="#fff9d9" />
              <stop offset=".3" stopColor="#b58028" />
              <stop offset=".5" stopColor="#fff0b3" />
              <stop offset=".75" stopColor="#6f4814" />
              <stop offset="1" stopColor="#e8c677" />
            </linearGradient>
          </defs>
          <path
            d="m100 8 23 63 67 2-52 42 18 67-56-39-56 39 18-67L10 73l67-2Z"
            fill="url(#hall-star-edge)"
            stroke="#f6df9e"
            strokeWidth=".7"
          />
          <path
            d="m100 8 23 63 67 2-52 42 18 67-56-39-56 39 18-67L10 73l67-2Z"
            transform="translate(9 9) scale(.91)"
            fill="url(#hall-star-gold)"
            stroke="#fff0b3"
            strokeWidth=".6"
          />
          <path
            d="M100 8v26M10 73l25 9M190 73l-25 9M44 182l15-24M156 182l-15-24"
            stroke="#fff4cc"
            strokeWidth=".8"
            opacity=".75"
          />
          <path
            d="m100 125 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5Z"
            fill="#674514"
          />
        </svg>
        <span className={styles.sparkleOne} aria-hidden="true">
          ✦
        </span>
        <span className={styles.sparkleTwo} aria-hidden="true">
          ✦
        </span>
        <span className={styles.name}>
          <span className={styles.small}>Hall of</span>
          <br />
          Fame
        </span>
      </Link>
    </div>
  );
}
