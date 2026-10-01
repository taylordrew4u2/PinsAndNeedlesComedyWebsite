import BadDecisionIntro from "@/components/BadDecisionIntro";
import { EXAMPLE_QUESTION, type ExplainerStep } from "@/lib/explainer";

const HEADING = "font-[family-name:var(--pnc-heading)] uppercase leading-[1.05]";

/**
 * One step of the "Intro" explainer, full screen over whatever is up. Each
 * step fades in on its own; the intro step is the real intro, so the room
 * sees and hears exactly what a new question will look like.
 */
export default function Explainer({ step, qrSrc }: { step: ExplainerStep; qrSrc?: string }) {
  if (step === "intro") return <BadDecisionIntro />;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black px-[6vw] text-white" aria-live="polite">
      <div key={step} className="pnc-screen-in flex w-full items-center justify-center gap-[5vw]">
        {step === "how" ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-[3vmin]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/bad-decisions-dice-on-dark.svg" alt="Pins & Needles Comedy: Bad Decisions" width={1620} height={1080} className="h-auto w-[min(34vw,52vmin)]" />
              <h1 className={`${HEADING} text-[min(5.5vw,9vmin)]`}>How it works</h1>
              <ol className="flex flex-col gap-[2vmin] text-[min(3vw,5vmin)] font-semibold leading-tight">
                <li><span className="text-[#ff2e4d]">1.</span> Scan the QR</li>
                <li><span className="text-[#ff2e4d]">2.</span> Tell us your bad decision</li>
                <li><span className="text-[#ff2e4d]">3.</span> A comedian weighs in, live</li>
              </ol>
            </div>
            {qrSrc ? <Qr src={qrSrc} /> : null}
          </>
        ) : step === "listen" ? (
          <p className={`pnc-snap-in ${HEADING} text-center text-[min(8vw,14vmin)] text-[#ff2e4d]`}>When you hear this…</p>
        ) : step === "example" ? (
          <div className="flex flex-col items-center gap-[4vmin] text-center">
            <p className="rounded bg-[#ff2e4d] px-[2vmin] py-[0.6vmin] text-[min(2.4vw,4vmin)] font-bold uppercase tracking-[0.3em] text-black">Example</p>
            <h1 className={`${HEADING} text-[min(6vw,10vmin)] normal-case`}>{EXAMPLE_QUESTION}</h1>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-[3vmin]">
              <p className={`${HEADING} text-[min(4.6vw,8vmin)]`}>That sound means a bad decision just hit the screen.</p>
              <p className="text-[min(3vw,5vmin)] font-semibold text-[#ff2e4d]">Scan to send yours.</p>
            </div>
            {qrSrc ? <Qr src={qrSrc} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function Qr({ src }: { src: string }) {
  return (
    <div className="shrink-0 rounded-xl bg-white p-[2vmin]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR code to submit your bad decision" width={400} height={400} className="block h-[min(30vw,46vmin)] w-[min(30vw,46vmin)]" />
    </div>
  );
}
