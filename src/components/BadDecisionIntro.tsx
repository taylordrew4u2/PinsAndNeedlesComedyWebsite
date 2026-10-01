/** How long the intro holds the screen before the question appears. Matches the CSS timings in globals.css. */
export const INTRO_MS = 3_200;

/**
 * The drum roll before a new question: two red flashes, the Bad Decisions
 * dice stamped onto the screen with a shake, red rays turning behind it, and
 * "Incoming" blinking underneath. Purely visual; the question follows.
 */
export default function BadDecisionIntro() {
  return (
    <div className="pnc-intro fixed inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-black" aria-hidden="true">
      <div className="pnc-intro-rays absolute left-1/2 top-1/2 aspect-square w-[160vmax]" />
      <div className="pnc-intro-flash absolute inset-0 bg-[#ff2e4d]" />
      <div className="pnc-intro-shake relative flex w-full flex-col items-center gap-[3vmin]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bad-decisions-dice-on-dark.svg" alt="" width={1620} height={1080} className="pnc-intro-stamp h-auto w-[min(58vw,96vmin)]" />
        <p className="pnc-intro-incoming font-[family-name:var(--pnc-heading)] text-[min(6vw,9vmin)] uppercase leading-none tracking-[0.3em] text-[#ff2e4d]">
          Incoming
        </p>
      </div>
    </div>
  );
}
