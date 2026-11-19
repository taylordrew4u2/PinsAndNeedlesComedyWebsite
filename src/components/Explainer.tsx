import type { CSSProperties } from "react";
import BadDecisionIntro from "@/components/BadDecisionIntro";
import { EXPLAINER_MS, EXPLAINER_STEPS, type ExplainerStep } from "@/lib/explainer";
import type { BoardQr } from "@/lib/screen-qr";
import { DEFAULT_LOOK, markBadDecisions, type ScreenSettings } from "@/lib/screen-settings";
import styles from "./Explainer.module.css";

/** The live show's animated opener. Copy, QR and sound still come from the Control Center. */
export default function Explainer({ step, qr, look = DEFAULT_LOOK }: { step: ExplainerStep; qr?: BoardQr | null; look?: ScreenSettings }) {
  // Use the real question reveal: the sound and image teach the room the same cue.
  if (step === "intro") return <div className={styles.sting}><BadDecisionIntro word={look.introWord} /></div>;
  return (
    <div className={styles.screen} aria-live="polite">
      <div className={styles.texture} aria-hidden="true" />
      <div key={step} className={styles.scene}>
        {step === "title" ? <Title heading={look.howHeading} /> : (
          <>
            <header className={styles.header}>
              <span>Pins &amp; Needles Comedy</span>
              <span className={styles.headerMark} aria-hidden="true">✦</span>
              <span>Bad Decisions</span>
            </header>
            <div className={styles.stage}>
              {step === "how" ? <How qr={qr} look={look} />
                : step === "listen" ? <Listen line={look.listenLine} />
                  : step === "example" ? <Example label={look.exampleLabel} question={look.exampleQuestion} />
                    : <Send qr={qr} line={look.closingLine} call={look.closingCall} scan={look.scanLabel} />}
            </div>
          </>
        )}
      </div>
      <Progress step={step} />
    </div>
  );
}

function Title({ heading }: { heading: string }) {
  return (
    <div className={styles.titleStage}>
      <div className={styles.orbit} aria-hidden="true" />
      <span className={styles.titleBrand}>Pins &amp; Needles Comedy</span>
      <Dice className={styles.titleDice} />
      <p className={styles.titleTag}>{heading} <Arrow /></p>
      <span className={styles.cornerStar} aria-hidden="true">✦</span>
    </div>
  );
}

function How({ qr, look }: { qr?: BoardQr | null; look: ScreenSettings }) {
  return (
    <div className={`${styles.twoColumn} ${qr ? "" : styles.withoutQr}`}>
      <div className={styles.instructions}>
        <h1 className={styles.howHeading}>{look.howHeading}</h1>
        <ol className={styles.steps}>
          {[look.howStep1, look.howStep2, look.howStep3].map((text, index) => (
            <li key={index} className={styles.rule} style={{ "--rule-delay": `${0.4 + index * 1.4}s` } as CSSProperties}>
              <span className={styles.ruleNumber} aria-hidden="true">0{index + 1}</span>
              <span className={styles.ruleIcon} aria-hidden="true"><RuleIcon index={index} /></span>
              <span className={styles.ruleText}>{text}</span>
            </li>
          ))}
        </ol>
      </div>
      {qr ? <Qr qr={qr} scan={look.scanLabel} /> : <Dice className={styles.sideDice} />}
    </div>
  );
}

function Listen({ line }: { line: string }) {
  return (
    <div className={styles.listenStage}>
      <div className={styles.soundwave} aria-hidden="true">
        {[28, 58, 38, 86, 52, 100, 66, 40, 78, 48, 24].map((height, index) => (
          <span key={index} style={{ "--bar-height": `${height}%`, "--bar-delay": `${index * -0.09}s` } as CSSProperties} />
        ))}
      </div>
      <h1 className={styles.listenLine}>{line}</h1>
    </div>
  );
}

function Example({ label, question }: { label: string; question: string }) {
  return (
    <div className={styles.exampleStage}>
      <span className={styles.exampleStar} aria-hidden="true">✦</span>
      <div className={styles.questionCard}>
        <span className={styles.exampleLabel}>{label}</span>
        <span className={styles.quoteMark} aria-hidden="true">“</span>
        <h1 className={styles.question}>{question}</h1>
        <div className={styles.cardFooter} aria-hidden="true"><span>Bad Decisions</span><Arrow /></div>
      </div>
    </div>
  );
}

function Send({ qr, line, call, scan }: { qr?: BoardQr | null; line: string; call: string; scan: string }) {
  return (
    <div className={`${styles.twoColumn} ${qr ? "" : styles.withoutQr}`}>
      <div className={styles.closingCopy}>
        <h1 className={styles.closingLine}>
          {markBadDecisions(line).map((part, index) => part.mark ? <span key={index} className={styles.highlight}>{part.text}</span> : part.text)}
        </h1>
        <p className={styles.closingCall}>{call} <Arrow /></p>
      </div>
      {qr ? <Qr qr={qr} scan={scan} /> : <Dice className={styles.sideDice} />}
    </div>
  );
}

function Dice({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/bad-decisions-dice-on-dark.svg" alt="Pins & Needles Comedy: Bad Decisions" width={1620} height={1080} className={className} />;
}

/** Fit the host's QR size to the screen while preserving its quiet zone. Pictures use a dark frame. */
function Qr({ qr, scan }: { qr: BoardQr; scan: string }) {
  return (
    <div className={styles.qrBlock} style={{ "--qr-side": `calc(${qr.side} * var(--unit))` } as CSSProperties}>
      <div className={`${styles.qrFrame} ${qr.picture ? styles.pictureFrame : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.src} alt={qr.alt || "QR code to submit your bad decision"} width={400} height={400} decoding="async" className={styles.qrImage} />
      </div>
      <p className={styles.scanLabel}>{scan} <Arrow /></p>
    </div>
  );
}

function Arrow() {
  return <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" /></svg>;
}

function RuleIcon({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {index === 0 ? <><path d="M11 4H4v7m17-7h7v7M4 21v7h7m17-7v7h-7M10 10h4v4h-4zm9 0h3v4h-3zm-9 9h4v3h-4zm9 0h3v3h-3z" /><path d="M2 16h28" /></>
        : index === 1 ? <><path d="m4 14 24-10-10 24-4-10-10-4Z" /><path d="m14 18 8-8" /></>
          : <><rect x="11" y="3" width="10" height="17" rx="5" /><path d="M7 14v2a9 9 0 0 0 18 0v-2M16 25v4m-5 0h10" /></>}
    </svg>
  );
}

/** One continuous progress line; each scene picks up where the last one ended. */
function Progress({ step }: { step: ExplainerStep }) {
  let before = 0;
  for (const entry of EXPLAINER_STEPS) {
    if (entry.step === step) break;
    before += entry.ms;
  }
  const length = EXPLAINER_STEPS.find((entry) => entry.step === step)?.ms ?? 0;
  return <div key={step} className={styles.progress} style={{
    "--from": before / EXPLAINER_MS,
    "--to": (before + length) / EXPLAINER_MS,
    animationDuration: `${length}ms`,
  } as CSSProperties} aria-hidden="true" />;
}
