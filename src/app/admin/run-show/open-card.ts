/**
 * Opens one of the Control Center's folded cards and brings it into view:
 * the way in from the chips under the live screen, so a host on a phone
 * never scrolls past the whole question list to reach a card. `focus` is a
 * selector inside the card for what to put the cursor in (its first box,
 * say). Does nothing when there is no such card.
 */
export function openCard(id: string, focus?: string): void {
  const card = document.getElementById(id);
  if (!card) return;
  // The card itself, or the folded card it sits in.
  const details = card instanceof HTMLDetailsElement ? card : card.closest("details");
  if (details) details.open = true;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  if (focus) card.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
}
