import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DecisionForm from "@/components/DecisionForm";
import { getContent } from "@/lib/store";
import { readScreen } from "@/lib/live-store";
import { closedMessage, windowFor } from "@/lib/decisions";
import { spaceOf, type Space } from "@/lib/space";

export const dynamic = "force-dynamic";

/** How long the page waits for the live screen's settings before it draws the usual look. */
const SPOOK_WAIT_MS = 800;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Bad Decisions", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Whether the host has spook mode on for this show, read once as the page
 * loads. A slow or failed read just gives the usual page: the look is never
 * worth holding up the form. A phone already open keeps its look until it
 * reloads, so nothing new polls.
 */
async function spookOn(space: Space): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SPOOK_WAIT_MS);
  });
  const screen = await Promise.race([readScreen(space), slow]).catch(() => null);
  clearTimeout(timer);
  return screen?.spook === true;
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
  // Each space has its own switch, so a rehearsal QR follows the rehearsal screen.
  const [{ weekly, shows }, spook] = await Promise.all([getContent(), spookOn(space)]);
  if (!weekly.enabled && space === "live") notFound();
  const now = new Date();
  const gate = windowFor(space, weekly, shows, now);

  return (
    <main data-spook={spook ? "on" : undefined} className={`${spook ? "relative " : ""}flex min-h-svh items-center justify-center px-5 py-10`}>
      {spook ? (
        <>
          {/* Blood drips along the very top, inside main's top padding so they never reach the words. Absolute, so they scroll away. */}
          <div aria-hidden="true" className="pnc-spook-drips pointer-events-none absolute inset-x-0 top-0 h-7" />
          {/* A faint web in the bottom corner. The form sits above it (z-10), so on a short phone it is behind the form, never in front. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/spook-web-corner-on-dark.svg" alt="" aria-hidden="true" width={200} height={200} className="pointer-events-none absolute bottom-0 left-0 z-0 h-24 w-24 opacity-25" />
        </>
      ) : null}
      <div className={`relative ${spook ? "z-10 " : ""}w-full max-w-xl`}>
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
          spook={spook}
        />
      </div>
    </main>
  );
}
