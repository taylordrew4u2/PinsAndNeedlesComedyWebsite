"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/types";
import { instagramCode } from "@/lib/render";

/** Only one reel plays sound at a time; unmuting one mutes the rest. */
const UNMUTE_EVENT = "reel-grid:unmute";

/**
 * A reel with its own video file: plays silently on its own while on screen,
 * and a tap turns the sound on (tap again to mute). No Instagram chrome.
 */
function VideoTile({ reel, label }: { reel: Reel; label: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? void video.play().catch(() => {}) : video.pause()),
      { rootMargin: "100% 0px" }
    );
    observer.observe(video);

    const onOtherUnmuted = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== reel.id) setMuted(true);
    };
    window.addEventListener(UNMUTE_EVENT, onOtherUnmuted);
    return () => {
      observer.disconnect();
      window.removeEventListener(UNMUTE_EVENT, onOtherUnmuted);
    };
  }, [reel.id]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    setMuted(next);
    if (!next) {
      window.dispatchEvent(new CustomEvent(UNMUTE_EVENT, { detail: reel.id }));
      void video.play().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={`${label} — ${muted ? "tap for sound" : "tap to mute"}`}
      aria-pressed={!muted}
      className="reel-tile"
    >
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl || undefined}
        muted={muted}
        autoPlay
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        aria-hidden="true"
      />
      <span className="reel-sound" aria-hidden="true">
        {muted ? "🔇" : "🔊"}
      </span>
    </button>
  );
}

/**
 * A reel that only has its Instagram link plays through Instagram's public
 * embed. Instagram draws its own header and footer inside that frame, so
 * this is only a stand-in until the reel has a video file.
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
      className="reel-embed"
    />
  );
}

/** Newest first: Instagram's publish time when known, else the admin order. */
function newestFirst(a: Reel, b: Reel): number {
  if (a.igTimestamp && b.igTimestamp && a.igTimestamp !== b.igTimestamp) {
    return a.igTimestamp < b.igTimestamp ? 1 : -1;
  }
  return a.order - b.order;
}

export default function ReelGrid({ reels }: { reels: Reel[] }) {
  const visible = reels
    .filter((reel) => reel.published && (reel.videoUrl || instagramCode(reel.instagramUrl)))
    .sort(newestFirst);

  if (visible.length === 0) return null;

  return (
    <section aria-label="Instagram reels" className="reel-wall">
      <div className="reel-grid">
        {visible.map((reel, index) => {
          const label = reel.caption || `Instagram reel ${index + 1} from Pins & Needles Comedy`;
          return reel.videoUrl ? (
            <VideoTile key={reel.id} reel={reel} label={label} />
          ) : (
            <EmbedTile key={reel.id} code={instagramCode(reel.instagramUrl)!} label={label} />
          );
        })}
      </div>
      <style>{`
        .reel-wall{width:100%}
        .reel-grid{display:grid;gap:0;grid-template-columns:minmax(0,1fr)}
        @media (min-width:700px){.reel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (min-width:1050px){.reel-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (min-width:1400px){.reel-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
        .reel-tile{position:relative;display:block;width:100%;aspect-ratio:9/16;margin:0;padding:0;border:0;background:#000;cursor:pointer;overflow:hidden}
        .reel-tile video{display:block;width:100%;height:100%;object-fit:cover}
        .reel-sound{position:absolute;right:10px;bottom:10px;font-size:16px;line-height:1;opacity:.75;pointer-events:none}
        .reel-embed{display:block;width:100%;height:620px;border:0;background:#fff}
      `}</style>
    </section>
  );
}
