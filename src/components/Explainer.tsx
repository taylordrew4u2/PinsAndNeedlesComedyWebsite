import type { CSSProperties } from "react";
import BadDecisionIntro from "@/components/BadDecisionIntro";
import { EXPLAINER_MS, EXPLAINER_STEPS, type ExplainerStep } from "@/lib/explainer";
import { DEFAULT_LOOK, markBadDecisions, type ScreenSettings } from "@/lib/screen-settings";

/** The brand's cream (the flash art's ink) and red. */
const CREAM = "#f2eddc";
const RED = "#ff2e4d";
const HEADING = "font-[family-name:var(--pnc-heading)] uppercase leading-[1.02]";
const POSTER = "font-[family-name:var(--font-poster)] uppercase";

/**
 * One step of the "Intro" explainer, full screen over whatever is up. Every
 * step shares one stage: the same margins, cream type on black, red accents,
 * and a thin progress line along the bottom. The intro step is the real
 * intro, so the room sees and hears exactly what a new question looks like.
 * The words are the host's from the Control Center, the defaults until they
 * change them; the timings never change.
 */
export default function Explainer({ step, qrSrc, qrScale = 1, look = DEFAULT_LOOK }: { step: ExplainerStep; qrSrc?: string; qrScale?: number; look?: ScreenSettings }) {
  if (step === "intro") return <BadDecisionIntro word={look.introWord} />;
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black" style={{ color: CREAM }} aria-live="polite">
      <div key={step} className="pnc-screen-in absolute inset-[6vmin] flex items-center justify-center">
        {step === "how" ? <How qrSrc={qrSrc} qrScale={qrScale} look={look} /> : step === "listen" ? <Listen line={look.listenLine} /> : step === "example" ? <Example question={look.exampleQuestion} /> : <Send qrSrc={qrSrc} qrScale={qrScale} line={look.closingLine} call={look.closingCall} />}
      </div>
      <Progress step={step} />
    </div>
  );
}

function How({ qrSrc, qrScale, look }: { qrSrc?: string; qrScale: number; look: ScreenSettings }) {
  const steps = [look.howStep1, look.howStep2, look.howStep3];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[5vmin]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/bad-decisions-dice-on-dark.svg" alt="Pins & Needles Comedy: Bad Decisions" width={1620} height={1080} className="h-[24vmin] w-auto" />
      <div className="flex w-full max-w-[150vmin] items-center justify-center gap-[7vmin]">
        <div className="flex min-w-0 flex-col gap-[3.2vmin]">
          <h1 className={`${HEADING} text-[8vmin]`}>{look.howHeading}</h1>
          <ol className="flex flex-col gap-[2.6vmin]">
            {steps.map((text, index) => (
              <li key={index} className="pnc-rise flex items-center gap-[2.4vmin]" style={{ animationDelay: `${0.35 + index * 0.35}s` } as CSSProperties}>
                <span className={`${HEADING} flex h-[7vmin] w-[7vmin] shrink-0 items-center justify-center rounded-full text-[4vmin] text-black`} style={{ background: RED }}>
                  {index + 1}
                </span>
                <span className={`${POSTER} text-[5.8vmin] font-semibold leading-tight tracking-wide`}>{text}</span>
              </li>
            ))}
          </ol>
        </div>
        {qrSrc ? <Qr src={qrSrc} scale={qrScale} /> : null}
      </div>
    </div>
  );
}

function Listen({ line }: { line: string }) {
  return (
    <p className={`pnc-snap-in ${HEADING} text-center text-[13vmin]`} style={{ color: RED }}>
      {line}
    </p>
  );
}

function Example({ question }: { question: string }) {
  return (
    <div className="flex max-w-[150vmin] flex-col items-center gap-[5vmin] text-center">
      <p className={`${POSTER} rounded-full px-[3vmin] py-[0.8vmin] text-[3.4vmin] font-bold tracking-[0.35em] text-black`} style={{ background: RED }}>
        Example
      </p>
      <h1 className="break-words font-[family-name:var(--pnc-heading)] text-[9vmin] leading-[1.08]">{question}</h1>
    </div>
  );
}

/** The closing lines. "Bad decision" stays red wherever it falls in the host's words. */
function Send({ qrSrc, qrScale, line, call }: { qrSrc?: string; qrScale: number; line: string; call: string }) {
  return (
    <div className="flex w-full max-w-[150vmin] items-center justify-center gap-[7vmin]">
      <div className="flex min-w-0 max-w-[95vmin] flex-col gap-[4vmin]">
        <p className={`${HEADING} break-words text-[7.6vmin]`}>
          {markBadDecisions(line).map((part, index) => part.mark ? <span key={index} style={{ color: RED }}>{part.text}</span> : part.text)}
        </p>
        <p className={`${POSTER} pnc-rise text-[5.4vmin] font-semibold tracking-wide`} style={{ color: RED, animationDelay: "0.5s" }}>
          {call}
        </p>
      </div>
      {qrSrc ? <Qr src={qrSrc} scale={qrScale} /> : null}
    </div>
  );
}

/** The QR at the host's size, up to 1.4 times the usual: past that the steps beside it would have no room. */
function Qr({ src, scale }: { src: string; scale: number }) {
  const side = `${Math.round(40 * Math.min(scale, 1.4) * 10) / 10}vmin`;
  return (
    <div className="flex shrink-0 flex-col items-center gap-[2vmin]">
      <div className="rounded-[2.4vmin] p-[1vmin]" style={{ background: RED }}>
        <div className="rounded-[1.6vmin] bg-white p-[2vmin]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="QR code to submit your bad decision" width={400} height={400} className="block" style={{ width: side, height: side }} />
        </div>
      </div>
      <p className={`${POSTER} text-[3.6vmin] font-bold tracking-[0.3em]`}>Scan me</p>
    </div>
  );
}

/** A thin red line along the bottom that fills across the whole explainer, step by step. */
function Progress({ step }: { step: ExplainerStep }) {
  let before = 0;
  for (const entry of EXPLAINER_STEPS) {
    if (entry.step === step) break;
    before += entry.ms;
  }
  const length = EXPLAINER_STEPS.find((entry) => entry.step === step)?.ms ?? 0;
  const style = {
    "--from": `${(before / EXPLAINER_MS) * 100}%`,
    "--to": `${((before + length) / EXPLAINER_MS) * 100}%`,
    animationDuration: `${length}ms`,
    background: RED,
  } as CSSProperties;
  return <div key={step} className="pnc-progress absolute bottom-0 left-0 h-[0.8vmin]" style={style} aria-hidden="true" />;
}
