import Image from "next/image";
import styles from "./BrandAccents.module.css";

/** Original brand illustrations, decorative and never placed over page controls. */
export default function BrandAccents({
  names,
  prominent = false,
}: {
  names: string[];
  prominent?: boolean;
}) {
  return (
    <div
      className={`${styles.row} ${prominent ? styles.prominent : ""}`}
      aria-hidden="true"
    >
      {names.map((name) => (
        <Image
          key={name}
          src={`/brand/${name}-on-dark.svg`}
          alt=""
          width={220}
          height={240}
          sizes={
            prominent
              ? "(max-width: 600px) 150px, 220px"
              : "(max-width: 600px) 88px, 130px"
          }
          className={styles.art}
        />
      ))}
    </div>
  );
}
