/** What the Control Center knows about the live screen, to put it in words. */
export type ScreenView = {
  /** Which drink menu is up, if one is. */
  menu: "standard" | "custom" | null;
  /** The host's own message is up. */
  message: boolean;
  /** The set running now: the name on its card ("" for none) and its slot (null while the name is up). Null with no set running. */
  set: { name: string; index: number | null } | null;
  /** A question is on screen. */
  question: boolean;
};

/**
 * The status line over the mirror: what the projector shows, in a few words.
 * Checked in the order the projector stacks them: a drink menu over
 * everything, then the host's message, then a running set, which owns the
 * screen. A set shows the performer's name first (or nothing, with no name
 * on the card), then each slot's question, or nothing for an empty slot, so
 * the line never says "cleared" while a name is up.
 */
export function screenStatus(view: ScreenView): string {
  if (view.menu) return view.menu === "custom" ? "Custom drink menu on screen" : "Drink menu on screen";
  if (view.message) return "Message on screen";
  if (view.set) {
    const phase = view.set.index === null
      ? view.set.name ? "name on screen" : "blank until the first question"
      : view.question ? "question on screen" : "empty slot, nothing on screen";
    return `Set running: ${view.set.name || "no name on the card"} · ${phase}`;
  }
  return view.question ? "Question on screen" : "Screen cleared";
}
