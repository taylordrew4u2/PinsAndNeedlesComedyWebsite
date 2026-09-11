import styles from "./hall.module.css";

/** A name set into a brass-edged terrazzo star; no photograph is used. */
export default function FameStar({ name }: { name: string }) {
  const lines = name.trim().split(/\s+/).filter(Boolean);
  const fontSize = Math.min(5.8, 13 / Math.max(lines.length, 1), 75 / Math.max(...lines.map((line) => line.length), 1));
  return (
    <div className={styles.tile}>
      <div className={styles.starBorder} aria-hidden="true"><div className={styles.starStone} /></div>
      <h2 className={styles.starName} aria-label={name} style={{ fontSize: `${fontSize}cqw` }}>
        {lines.map((line, index) => <span className={styles.nameLine} key={index}>{line}</span>)}
      </h2>
      <svg className={styles.medallion} viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="28" fill="#bd995c" stroke="#765b31" strokeWidth="1.5" />
        <circle cx="30" cy="30" r="24" fill="none" stroke="#ead8a8" strokeWidth=".8" />
        <g fill="none" stroke="#32291c" strokeWidth="2.5" strokeLinecap="round">
          <rect x="23" y="12" width="14" height="24" rx="7" />
          <path d="M18 28v2a12 12 0 0 0 24 0v-2M30 42v7M24 49h12M24 20h5M31 20h5M24 26h5M31 26h5" />
        </g>
      </svg>
    </div>
  );
}
