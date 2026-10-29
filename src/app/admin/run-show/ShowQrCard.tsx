"use client";

import type { ScreenSettings } from "@/lib/screen-settings";

/**
 * "🔳 QR code on the show screens": where the show screens' QR leads (the
 * question form, the host's link or their picture) and its size. Saves only
 * the QR's own settings that changed (screenChanges with QR_KEYS).
 *
 * A placeholder that draws nothing yet: its props are settled so the Control
 * Center can mount it while the show-screen cards build it.
 */
export default function ShowQrCard(props: {
  saved: ScreenSettings;
  busy: boolean;
  pageLive: boolean;
  save: (change: Partial<ScreenSettings>) => Promise<boolean>;
}) {
  void props;
  return null;
}
