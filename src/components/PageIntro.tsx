import Image from "next/image";
import styles from "./PageIntro.module.css";
export default function PageIntro({
  title,
  description,
  artwork,
}: {
  title: string;
  description?: string;
  artwork: string;
}) {
  return (
    <section className={styles.intro}>
      <div>
        <p className={styles.label}>Pins &amp; Needles Comedy</p>
        <h1>{title}</h1>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>
      <Image
        src={`/brand/${artwork}-on-dark.svg`}
        alt=""
        aria-hidden="true"
        width={200}
        height={180}
        className={styles.art}
        sizes="(max-width: 600px) 96px, 190px"
      />
    </section>
  );
}
