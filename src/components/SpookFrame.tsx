"use client";

import { memo, type CSSProperties } from "react";

/**
 * Spook mode's frame around the live screen, behind everything on it: blood
 * drips along the top, a flash-sheet border, a web in the bottom-left corner
 * with a spider on its thread, and, while nothing is up, two bats crossing.
 * Tattoo-flash motifs in the brand's red, bone and black, so the show still
 * looks like itself.
 *
 * It keeps out of the words' way. The drips hang above the area the question
 * is fitted into, the web sits in the bottom band the QR and the buttons
 * already keep clear, and the screen paints its words above all of it. Only
 * the spider moves while there is something to read, and only by transform,
 * so a TV can run it all night. Memoised on `idle` alone, so the poll every
 * two seconds never redraws it.
 */
function SpookFrame({ idle }: { idle: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 [--pnc-spook-web:min(16vmin,120px)] sm:[--pnc-spook-web:min(22vmin,210px)]" aria-hidden="true">
      <div className="pnc-spook-drips absolute inset-x-0 top-0 h-[7vmin]" />
      {/* A flash sheet's double rule: bone outside, grey inside. */}
      <div className="absolute inset-[1.5vmin] border border-[#f2eddc] outline outline-[#8a8a8a] outline-offset-[-6px]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/spook-web-corner-on-dark.svg" alt="" width={200} height={200} className="absolute bottom-0 left-0 size-[var(--pnc-spook-web)] opacity-45" />
      {/* The spider hangs from a little over halfway across the web, and is all that moves while a question is up. */}
      <div className="pnc-spook-bob absolute left-[calc(var(--pnc-spook-web)*0.55-16px)] top-[calc(100%-var(--pnc-spook-web)*0.95)] flex w-8 flex-col items-center">
        <div className="h-[9vmin] w-px bg-[#f2eddc] opacity-50" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/spook-spider-on-dark.svg" alt="" width={40} height={44} className="h-auto w-8" />
      </div>
      {idle ? (
        // Only with nothing to read: a bat crossing a question would pull eyes off it. They mount mid-flight, and never for anyone who asked for less motion.
        <>
          <div className="pnc-spook-bat pnc-spook-fly fixed left-0 top-[11vh] w-[9vmin]" style={{ "--pnc-spook-fly-s": "28s", "--pnc-spook-fly-delay": "-9s" } as CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/spook-bat-on-dark.svg" alt="" width={128} height={50} className="pnc-spook-flap h-auto w-full" />
          </div>
          <div className="pnc-spook-bat pnc-spook-fly-back fixed left-0 top-[18vh] w-[7vmin]" style={{ "--pnc-spook-fly-s": "37s", "--pnc-spook-fly-delay": "-23s" } as CSSProperties}>
            {/* Flipped with `scale`, which leaves `transform` free for the flap. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/spook-bat-on-dark.svg" alt="" width={128} height={50} className="pnc-spook-flap h-auto w-full -scale-x-100" />
          </div>
        </>
      ) : null}
    </div>
  );
}

export default memo(SpookFrame);
