import type { Metadata } from "next";
import { getContent } from "@/lib/store";
import { decisionQrKey } from "@/lib/decision-access";
import { spaceOf } from "@/lib/space";
import LiveDisplay from "./LiveDisplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bad Decisions Live", robots: { index: false, follow: false }, referrer: "no-referrer",
  // Added to an iPad or iPhone home screen, the live screen opens without
  // Safari's bars: full screen even where the browser's full-screen call is missing.
  appleWebApp: { capable: true, title: "Bad Decisions Live", statusBarStyle: "black-translucent" },
  // Next writes the newer tag; older iPads only read the apple- one.
  other: { "apple-mobile-web-app-capable": "yes" },
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
