"use client";

import type { ScriptFontId } from "@/lib/menu-fonts";

/**
 * Tonight's bartender on the custom menu, right under the live screen's
 * mirror, so it is in reach on a phone without opening Setup. The one box
 * for the name: the custom menu card shows it and links here.
 *
 * A placeholder that draws nothing yet: its props are settled so the Control
 * Center can mount it while the menu cards build it.
 */
export default function BartenderField(props: {
  name: string;
  font: ScriptFontId;
  live: boolean;
  busy: boolean;
  save: (bartender: string) => Promise<boolean>;
}) {
  void props;
  return null;
}
