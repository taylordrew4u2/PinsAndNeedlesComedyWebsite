import Link from "next/link";
import type { Show, ShowsPage } from "@/lib/types";
import { aspectValue, formatDate } from "@/lib/render";
import { timeLine, venueLine } from "@/lib/shows";

const STATUS_LABEL: Record<string, string> = {
  "sold-out": "Sold out",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export default function ShowCard({
  show,
  settings,
  fallbackImage,
  dim = false,
}: {
  show: Show;
  settings: ShowsPage;
  fallbackImage: string;
  dim?: boolean;
}) {
  const artwork = /\.svg(?:[?#]|$)/i.test(show.posterUrl) ? show.posterUrl : /\.svg(?:[?#]|$)/i.test(fallbackImage) ? fallbackImage : "/brand/logo-white.svg";
  const ratio = aspectValue(settings.posterAspect);
  const status = STATUS_LABEL[show.status];
  const times = timeLine(show);
  const where = venueLine(show);

  return (
    <Link href={`/shows/${show.slug}`} className="group block">
      <div
        className="relative w-full overflow-hidden bg-neutral-950"
        style={{
          aspectRatio: `${ratio}`,
          borderRadius: settings.cornerRadius || undefined,
          opacity: dim ? 0.75 : 1,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork}
          alt={show.posterAlt || show.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          style={{
            opacity: 1,
            padding: artwork === show.posterUrl ? 0 : "12%",
            objectFit: "contain",
          }}
        />
        {status ? (
          <span className="absolute left-0 top-0 bg-[var(--pnc-accent)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
            {status}
          </span>
        ) : null}
      </div>

      <div className="pt-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--pnc-muted)]">
          {formatDate(show.date)}
          {times ? <span className="opacity-60"> · {times}</span> : null}
        </p>
        <h3 className="mt-1.5 text-[16px] leading-snug group-hover:underline">{show.title}</h3>
        {where ? (
          <p className="mt-1 text-[13px] leading-snug text-[var(--pnc-muted)]">{where}</p>
        ) : null}
      </div>
    </Link>
  );
}
