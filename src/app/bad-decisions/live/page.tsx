import type { Metadata } from "next";
import { getContent } from "@/lib/store";
import { decisionQrKey } from "@/lib/decision-access";
import LiveDisplay from "./LiveDisplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bad Decisions Live", robots: { index: false, follow: false }, referrer: "no-referrer",
};

export default async function LiveShowPage() {
  const { weekly } = await getContent();
  // No serialized pile or admin state is ever sent to the display browser.
  return <LiveDisplay showQr={weekly.enabled && Boolean(decisionQrKey())} />;
}
