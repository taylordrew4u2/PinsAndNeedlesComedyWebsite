import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DecisionForm from "@/components/DecisionForm";
import { getContent } from "@/lib/store";
import { validDecisionQrKey } from "@/lib/decision-access";
import { closedMessage, submissionWindow } from "@/lib/decisions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Bad Decisions", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** The private QR opens a countdown, then a standalone prompt. */
export default async function WeeklyPage({ searchParams }: {
  searchParams: Promise<{ qr?: string | string[] }>;
}) {
  const { qr } = await searchParams;
  if (!validDecisionQrKey(qr)) notFound();
  const { weekly, shows } = await getContent();
  if (!weekly.enabled) notFound();
  const now = new Date();
  const gate = submissionWindow(weekly, shows, now);

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10">
      <div className="relative w-full max-w-xl">
        <DecisionForm
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
