"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "@/lib/types";

/** Only one reel plays sound at a time; unmuting one mutes the rest. */
const UNMUTE_EVENT = "reel-grid:unmute";

/**
 * A reel with its own video file: plays silently on its own while on screen,
 * and a tap turns the sound on (tap again to mute). No Instagram chrome.
 * Playback is started by the observer rather than the autoplay attribute,
 * which would make browsers download every video on the page up front.
 */
function VideoTile({ reel, label, eager }: { reel: Reel; label: string; eager: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { rootMargin: "50% 0px" }
    );
    observer.observe(video);

    // The element is the source of truth: the OS can pause or mute it too.
    const syncMuted = () => setMuted(video.muted);
    const muteForOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== reel.id) video.muted = true;
    };
    video.addEventListener("volumechange", syncMuted);
    window.addEventListener(UNMUTE_EVENT, muteForOther);
    return () => {
      observer.disconnect();
      video.removeEventListener("volumechange", syncMuted);
      window.removeEventListener(UNMUTE_EVENT, muteForOther);
    };
  }, [reel.id]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) window.dispatchEvent(new CustomEvent(UNMUTE_EVENT, { detail: reel.id }));
    if (video.paused) {
      void video.play().catch(() => {
        video.muted = true;
      });
    }
  };

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={`${label}, sound`}
      aria-pressed={!muted}
      className="reel-tile"
    >
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl || undefined}
        muted
        loop
        playsInline
        preload={eager ? "auto" : "none"}
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
 * Newest first by Instagram's publish time. Reels without one (pasted links)
 * come after, in admin order, so the ordering stays consistent.
 */
function newestFirst(a: Reel, b: Reel): number {
  const ta = a.igTimestamp || "";
  const tb = b.igTimestamp || "";
  if (ta !== tb) return ta < tb ? 1 : -1;
  return a.order - b.order;
}

export default function ReelGrid({ reels }: { reels: Reel[] }) {
  const visible = reels
    .filter((reel) => reel.published && reel.videoUrl)
    .sort(newestFirst);

  if (visible.length === 0) return null;

  return (
    <section aria-label="Instagram reels" className="reel-wall">
      <div className="reel-grid">
        {visible.map((reel, index) => {
          const label = reel.caption || `Instagram reel ${index + 1} from Pins & Needles Comedy`;
          return <VideoTile key={reel.id} reel={reel} label={label} eager={index < 2} />;
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
      `}</style>
    </section>
  );
}
