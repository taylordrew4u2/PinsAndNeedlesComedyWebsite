"use client";

import type { ScreenSettings } from "@/lib/screen-settings";

/**
 * "✏️ Words on the screen": every word the show screens draw, in one card,
 * laid out from SCREEN_TEXT_GROUPS. Saves only the words that changed
 * (screenChanges with TEXT_KEYS).
 *
 * A placeholder that draws nothing yet: its props are settled so the Control
 * Center can mount it while the show-screen cards build it.
 */
export default function ScreenWordsCard(props: {
  saved: ScreenSettings;
  busy: boolean;
  pageLive: boolean;
  save: (change: Partial<ScreenSettings>) => Promise<boolean>;
}) {
  void props;
  return null;
}
