"use client";

import { useEffect, useRef } from "react";
import type { Reel } from "@/lib/types";
import { instagramCode } from "@/lib/render";

const INSTAGRAM_PROFILE = "https://www.instagram.com/pinsandneedlescomedy/reels/";

/** A reel with its own uploaded video: muted, looping, plays only while on screen. */
function VideoTile({ reel, label }: { reel: Reel; label: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? void video.play().catch(() => {}) : video.pause()),
      { rootMargin: "200% 0px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={reel.instagramUrl || INSTAGRAM_PROFILE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — open on Instagram`}
      style={{ display: "block", aspectRatio: "9 / 16", overflow: "hidden", background: "#000" }}
    >
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        tabIndex={-1}
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </a>
  );
}

/**
 * Anything else plays through Instagram's own public embed, which needs no
 * API token and no uploaded file — just the reel's link.
 */
function EmbedTile({ code, label }: { code: string; label: string }) {
  return (
    <iframe
      src={`https://www.instagram.com/reel/${code}/embed/`}
      title={label}
      loading="lazy"
      scrolling="no"
      allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
      allowFullScreen
      style={{ display: "block", width: "100%", height: 620, border: 0, background: "#fff", borderRadius: 8 }}
    />
  );
}

export default function ReelGrid({ reels, limit = 12 }: { reels: Reel[]; limit?: number }) {
  const visible = reels
    .filter((reel) => reel.published && (reel.videoUrl || instagramCode(reel.instagramUrl)))
    .sort((a, b) => a.order - b.order)
    .slice(0, limit);

  if (visible.length === 0) return null;

  return (
    <section aria-label="Instagram reels" className="reel-wall">
      <div className="reel-wall-head">
        <h2>Reels</h2>
        <a href={INSTAGRAM_PROFILE} target="_blank" rel="noopener noreferrer">
          All reels <span aria-hidden="true">/</span>
        </a>
      </div>
      <div className="reel-grid">
        {visible.map((reel, index) => {
          const label = reel.caption || `Instagram reel ${index + 1} from Pins & Needles Comedy`;
          const code = instagramCode(reel.instagramUrl);
          return (
            <div key={reel.id}>
              {reel.videoUrl ? <VideoTile reel={reel} label={label} /> : <EmbedTile code={code!} label={label} />}
            </div>
          );
        })}
      </div>
      <style>{`
        .reel-wall{padding:32px 16px;max-width:1400px;margin:0 auto}
        .reel-wall-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px}
        .reel-wall-head h2{margin:0}
        .reel-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
        @media (min-width:700px){.reel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (min-width:1050px){.reel-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (min-width:1400px){.reel-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      `}</style>
    </section>
  );
}
