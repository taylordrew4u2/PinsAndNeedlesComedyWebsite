import { screenFallback } from "@/lib/screen-settings";

/** How long the intro holds the screen before the question appears. Matches the CSS timings in globals.css. */
export const INTRO_MS = 3_200;

/**
 * The drum roll before a new question: two red flashes, the Bad Decisions
 * dice stamped onto the screen with a shake, red rays turning behind it, and
 * "Incoming" (or the host's own word) blinking underneath. Purely visual; the
 * question follows.
 *
 * `spook` is spook mode's roll, on exactly the same beats: softer flashes, a
 * bone web wheel where the rays were, a drip growing under the dice once the
 * stamp lands, one bat gliding across behind the dice, and "It’s alive!"
 * unless the host wrote their own word.
 */
export default function BadDecisionIntro({ spook = false, word = screenFallback("introWord", spook) }: { spook?: boolean; word?: string }) {
  return (
    <div className="pnc-intro fixed inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-black" aria-hidden="true">
      <div className={spook ? "pnc-intro-rays pnc-intro-rays-spook absolute left-1/2 top-1/2 aspect-square w-[160vmax]" : "pnc-intro-rays absolute left-1/2 top-1/2 aspect-square w-[160vmax]"} />
      <div className={spook ? "pnc-intro-flash-spook absolute inset-0 bg-[#ff2e4d]" : "pnc-intro-flash absolute inset-0 bg-[#ff2e4d]"} />
      {/* Before the dice in the page, so it flies behind the art rather than over it. */}
      {spook ? (
        <div className="pnc-spook-bat pnc-spook-glide pointer-events-none absolute left-0 top-[9vh] w-[18vmin]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/spook-bat-on-dark.svg" alt="" width={128} height={50} className="pnc-spook-flap block h-auto w-full" />
        </div>
      ) : null}
      <div className="pnc-intro-shake relative flex w-full flex-col items-center gap-[3vmin]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bad-decisions-dice-on-dark.svg" alt="" width={1620} height={1080} className="pnc-intro-stamp h-auto w-[min(58vw,96vmin)]" />
        {/*
          Exactly two drip tiles wide (each is six times its height), so at any screen shape the strip
          ends on plain band, never on a drip cut in half. Tucked up into the art's empty margin, so it
          hangs from the line under the dice rather than floating free.
        */}
        {spook ? <div className="pnc-spook-drips pnc-spook-dice-drip pointer-events-none -mt-[4vmin] aspect-[12/1] w-[min(40vw,66vmin)]" /> : null}
        <p className="pnc-intro-incoming font-[family-name:var(--pnc-heading)] text-[min(6vw,9vmin)] uppercase leading-none tracking-[0.3em] text-[#ff2e4d]">
          {word}
        </p>
      </div>
    </div>
  );
}
