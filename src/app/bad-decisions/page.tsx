import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DecisionForm from "@/components/DecisionForm";
import { getContent } from "@/lib/store";
import { validDecisionQrKey } from "@/lib/decision-access";
import { closedMessage, windowFor } from "@/lib/decisions";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Bad Decisions", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * The private QR opens a countdown, then a standalone prompt. With
 * `mode=rehearsal` it opens the dress rehearsal's practice form instead:
 * always open, saved to the practice pile, never the real one.
 */
export default async function WeeklyPage({ searchParams }: {
  searchParams: Promise<{ qr?: string | string[]; mode?: string | string[] }>;
}) {
  const { qr, mode } = await searchParams;
  if (!validDecisionQrKey(qr)) notFound();
  const space = spaceOf(mode);
  const { weekly, shows } = await getContent();
  if (!weekly.enabled && space === "live") notFound();
  const now = new Date();
  const gate = windowFor(space, weekly, shows, now);

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10">
      <div className="relative w-full max-w-xl">
        {space === "rehearsal" ? (
          <p role="note" className="mb-6 rounded-md bg-amber-300 px-4 py-3 text-center text-sm font-bold uppercase tracking-widest text-black">
            Rehearsal · practice only, not the real show
          </p>
        ) : null}
        <DecisionForm
          space={space}
          qrKey={qr}
          question={weekly.question}
          placeholder={weekly.placeholder}
          namePrompt={weekly.namePrompt}
          formNote={weekly.formNote}
          submitLabel={weekly.submitLabel}
          thanksText={weekly.thanksText}
          showCount={false}
          initialCount={null}
          initialOpen={gate.open}
          initialClosedText={closedMessage(weekly, gate)}
          initialOpensAt={gate.opensAt}
          initialClosesAt={gate.closesAt}
          initialServerNow={now.getTime()}
          smsNumber=""
          smsNote=""
        />
      </div>
    </main>
  );
}
