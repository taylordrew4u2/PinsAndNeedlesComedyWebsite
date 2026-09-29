"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/types";
import { instagramCode } from "@/lib/render";

const INSTAGRAM_PROFILE = "https://www.instagram.com/pinsandneedlescomedy/reels/";

/** Instagram's public thumbnail endpoint — used when no poster was uploaded. */
function fallbackPoster(reel: Reel): string {
  const code = instagramCode(reel.instagramUrl);
  return code ? `https://www.instagram.com/p/${code}/media/?size=l` : "";
}

function Tile({ reel, index }: { reel: Reel; index: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = reel.posterUrl || fallbackPoster(reel);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = () => void video.play().catch(() => {});
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : video.pause()),
      { rootMargin: "200% 0px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const label = reel.caption || `Instagram reel ${index + 1} from Pins & Needles Comedy`;

  return (
    <a
      href={reel.instagramUrl || INSTAGRAM_PROFILE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — open on Instagram`}
      style={{ position: "relative", display: "block", aspectRatio: "9 / 16", overflow: "hidden", background: "#000" }}
    >
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={poster && !posterFailed ? poster : undefined}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : poster && !posterFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={reel.alt || label}
          loading={index < 4 ? "eager" : "lazy"}
          onError={() => setPosterFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase" }}>
          Reel
        </span>
      )}
    </a>
  );
}

export default function ReelGrid({ reels, limit = 8 }: { reels: Reel[]; limit?: number }) {
  const visible = reels
    .filter((reel) => reel.published)
    .sort((a, b) => a.order - b.order)
    .slice(0, limit);

  if (visible.length === 0) {
    return (
      <a
        href={INSTAGRAM_PROFILE}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", padding: "40px 0", textAlign: "center", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase" }}
      >
        Watch on Instagram
      </a>
    );
  }

  return (
    <section aria-label="Instagram reels">
      <div className="reel-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {visible.map((reel, index) => (
          <Tile key={reel.id} reel={reel} index={index} />
        ))}
      </div>
      <style>{`@media (min-width: 640px){.reel-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media (min-width:1024px){.reel-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}`}</style>
    </section>
  );
}
