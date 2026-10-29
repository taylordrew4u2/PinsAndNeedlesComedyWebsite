import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DecisionForm from "@/components/DecisionForm";
import { getContent } from "@/lib/store";
import { closedMessage, windowFor } from "@/lib/decisions";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Bad Decisions", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * The audience submission page. /bad-decisions opens it for anyone (the show
 * window still decides when it takes submissions), and the printed QR's
 * ?qr= link lands here too.
 */
export default async function WeeklyPage({ searchParams }: {
  searchParams: Promise<{ qr?: string | string[]; mode?: string | string[] }>;
}) {
  const { qr, mode } = await searchParams;
  const space = spaceOf(mode);
  const qrKey = typeof qr === "string" ? qr : "";
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
          qrKey={qrKey}
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
