"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { BlogSettings, Post } from "@/lib/types";
import { aspectValue, formatDate } from "@/lib/render";

export default function NewsMarquee({
  posts,
  settings,
  fallbackImage,
  compact = false,
}: {
  posts: Post[];
  settings: BlogSettings;
  fallbackImage: string;
  compact?: boolean;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Optional slow drift. Pauses on hover/touch so it never fights the reader.
  useEffect(() => {
    if (!settings.autoScroll) return;
    const strip = stripRef.current;
    if (!strip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    let raf = 0;
    let last = performance.now();

    const pause = () => (paused = true);
    const resume = () => (paused = false);
    strip.addEventListener("pointerenter", pause);
    strip.addEventListener("pointerleave", resume);
    strip.addEventListener("pointerdown", pause);

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) {
        strip.scrollLeft += settings.autoScrollSpeed * dt;
        if (strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1)
          strip.scrollLeft = 0;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      strip.removeEventListener("pointerenter", pause);
      strip.removeEventListener("pointerleave", resume);
      strip.removeEventListener("pointerdown", pause);
    };
  }, [settings.autoScroll, settings.autoScrollSpeed]);

  if (posts.length === 0) return null;

  const ratio = aspectValue(settings.coverAspect);
  const cardWidth = compact
    ? Math.min(settings.cardWidth, 200)
    : settings.cardWidth;
  const cardHeight = compact ? 112 : Math.round(settings.cardWidth / ratio);

  // Horizontal wheel scrolling on a trackpad-less mouse.
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    if (!strip) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    strip.scrollLeft += event.deltaY;
  };

  return (
    <section aria-label="News" className="w-full">
      <div
        ref={stripRef}
        onWheel={onWheel}
        className="pnc-strip flex w-full"
        style={{ gap: settings.gap }}
      >
        {posts.map((post) => {
          const cover = post.coverUrl || fallbackImage;
          return (
            <Link
              key={post.id}
              href={`/news/${post.slug}`}
              className="group relative block shrink-0 overflow-hidden bg-neutral-950"
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius: settings.cornerRadius || undefined,
                scrollSnapAlign: "start",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={post.coverAlt || post.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                style={{
                  objectFit: settings.imageFit,
                  opacity: post.coverUrl ? 1 : 0.35,
                  padding: post.coverUrl ? 0 : "18%",
                }}
              />

              <span
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  padding: compact ? "5px 7px" : settings.titlePadding,
                  background: compact ? "#0a0a0a" : undefined,
                }}
              >
                {settings.showDate && !compact ? (
                  <span
                    className="mb-1 block uppercase opacity-70"
                    style={{
                      fontSize: Math.max(9, settings.titleSize - 5),
                      letterSpacing: "0.18em",
                    }}
                  >
                    {formatDate(post.date)}
                  </span>
                ) : null}
                <span
                  className={
                    compact
                      ? "line-clamp-2 leading-tight"
                      : "block leading-tight"
                  }
                  style={{
                    fontFamily: settings.titleFont,
                    fontSize: compact ? 11 : settings.titleSize,
                    fontWeight: settings.titleWeight,
                    color: compact ? "#f2eddc" : settings.titleColor,
                    textAlign: settings.titleAlign,
                    textTransform: settings.titleTransform,
                  }}
                >
                  {post.title}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
