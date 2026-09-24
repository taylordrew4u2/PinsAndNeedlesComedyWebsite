import type { Metadata } from "next";
import { getContent } from "@/lib/store";
import { decisionQrKey } from "@/lib/decision-access";
import { spaceOf } from "@/lib/space";
import LiveDisplay from "./LiveDisplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bad Decisions Live", robots: { index: false, follow: false }, referrer: "no-referrer",
};

/** `?mode=rehearsal` is the dress rehearsal's own screen, separate from the show's. */
export default async function LiveShowPage({ searchParams }: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const space = spaceOf((await searchParams).mode);
  const { weekly } = await getContent();
  // No serialized pile or admin state is ever sent to the display browser.
  return <LiveDisplay space={space} showQr={(weekly.enabled || space === "rehearsal") && Boolean(decisionQrKey())} />;
}
