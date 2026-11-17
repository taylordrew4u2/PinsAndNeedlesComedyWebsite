import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageIntro from "@/components/PageIntro";
import { getContent } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanks for your order | Pins & Needles Comedy",
  robots: { index: false, follow: false },
};

export default async function ShopThanksPage() {
  const content = await getContent();
  return (
    <main>
      <PageHeader hero={content.home.hero} nav={content.site.nav} active="/shop" />
      <PageIntro
        title="Order in. Thank you."
        description="Payment went through. Your merch is being printed now — a receipt is on its way to your email, and you'll get tracking once it ships."
        artwork="flash-lipstick"
      />
      <div className="mx-auto max-w-6xl px-5 pb-20">
        <Link
          href="/shop"
          className="inline-block border border-white/25 px-6 py-3 text-[11px] uppercase tracking-[0.28em] transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          Back to the shop
        </Link>
      </div>
    </main>
  );
}
