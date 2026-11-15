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
  // The card itself and every folded card it sits in: a group of words inside the words card opens the card too,
  // or it would scroll to a box the host can't see.
  for (let fold = card.closest("details"); fold; fold = fold.parentElement?.closest("details") ?? null) fold.open = true;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  if (focus) card.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
}
