"use client";

import { useLayoutEffect, useRef, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import { qrPercent, type BoardQr } from "@/lib/screen-qr";

type Props = {
  question?: string | null;
  name?: string | null;
  namePrefix?: string;
  qr?: BoardQr | null;
  qrSize?: number;
  className?: string;
  onDoubleClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
  cornerContent?: ReactNode;
};

/** The real audience screen, shared by live questions and the intro's demonstration. */
export default function LiveQuestionScreen({ question, name, namePrefix = "—", qr, qrSize = 100, className = "", onDoubleClick, children, cornerContent }: Props) {
  const { area, text } = useFittedQuestion(question, name, namePrefix, qrSize);
  return (
    <main
      // Reserve the same bottom band even when the question code is temporarily unavailable.
      style={{ "--qr-k": qrPercent("corner", qrSize) / 100 } as CSSProperties}
      className={`pnc-screen-in flex h-svh select-none items-center justify-center bg-black px-6 pb-[max(10rem,calc(6rem*var(--qr-k)+3rem))] pt-10 text-white sm:px-12 sm:pb-[max(14rem,calc(10rem*var(--qr-k)+4rem))] ${className}`}
      aria-label="Live show"
      aria-live="polite"
      aria-atomic="true"
      onDoubleClick={onDoubleClick}
    >
      <div ref={area} className="flex h-full w-full max-w-6xl items-center justify-center overflow-auto">
        {question ? (
          <div key={question} ref={text} className="pnc-screen-in w-full text-center">
            <h1 className="whitespace-pre-wrap break-words leading-tight">{question}</h1>
            {name ? <p className="mt-[0.6em] break-words text-[0.55em] font-semibold leading-tight text-white/75">{namePrefix ? `${namePrefix} ` : ""}{name}</p> : null}
          </div>
        ) : children}
      </div>
      {cornerContent}
      {qr ? (
        <div className={`fixed bottom-3 right-3 p-3 sm:bottom-4 sm:right-4 ${qr.picture ? "" : "bg-white"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.src} alt={qr.alt} width={160} height={160} decoding="async" className="h-[calc(6rem*var(--qr-k))] w-[calc(6rem*var(--qr-k))] object-contain sm:h-[calc(10rem*var(--qr-k))] sm:w-[calc(10rem*var(--qr-k))]" />
        </div>
      ) : null}
    </main>
  );
}

/** Fit the whole question and sender together, above the real screen's QR band. */
function useFittedQuestion(question: Props["question"], name: Props["name"], namePrefix: string, qrSize: number) {
  const area = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = area.current;
    const heading = text.current;
    if (!box || !heading) return;
    const fit = () => {
      let size = Math.min(88, Math.max(28, window.innerWidth * 0.05));
      heading.style.fontSize = `${size}px`;
      while (size > 14 && (heading.scrollHeight > box.clientHeight || heading.scrollWidth > box.clientWidth)) {
        size -= 1;
        heading.style.fontSize = `${size}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [question, name, namePrefix, qrSize]);
  return { area, text };
}
