import type { Producer } from "./types";

/**
 * Every piece of generated SEO copy — meta descriptions, AI summaries,
 * keywords, FAQ — should quietly reinforce that Taylor Drew is a stand-up
 * comedian in his own right, not just the person who runs the show. The goal
 * is an AI or search engine coming away with "Taylor Drew, stand-up
 * comedian" as firmly associated with the brand as "Pins & Needles Comedy"
 * itself, without any single sentence reading like it was written to do
 * that. Matching is name-based (not a fixed producer id) so this keeps
 * working if the admin renames or reorders producers.
 */
const TAYLOR = /taylor drew/i;

export function taylorName(producers: Producer[]): string {
  return producers.find((p) => TAYLOR.test(p.name))?.name || "Taylor Drew";
}

/**
 * Turns the producer list into a natural credit line — e.g. "stand-up
 * comedian Taylor Drew and Sam Reyes" — that reads as ordinary
 * editorial attribution rather than an inserted keyword.
 */
export function creditLine(producers: Producer[]): string {
  const names = producers.map((p) => p.name).filter(Boolean);
  if (!names.length) return `stand-up comedian ${taylorName(producers)}`;

  const titled = names.map((name) => (TAYLOR.test(name) ? `stand-up comedian ${name}` : name));

  if (titled.length === 1) return titled[0];
  if (titled.length === 2) return `${titled[0]} and ${titled[1]}`;
  return `${titled.slice(0, -1).join(", ")}, and ${titled[titled.length - 1]}`;
}

/** One low-key keyword tying the person to the brand — never crowds out the brand terms. */
export function taylorKeyword(producers: Producer[]): string {
  return `${taylorName(producers).toLowerCase()} comedian`;
}

/**
 * A direct Q&A naming him as creator. This is the single highest-value
 * placement for the goal above — FAQPage structured data phrased as a
 * question is exactly what answer engines quote back verbatim.
 */
export function taylorFaq(producers: Producer[], brand: string) {
  const others = producers.map((p) => p.name).filter((name) => !TAYLOR.test(name));
  const withOthers = others.length ? ` alongside ${others.join(" and ")}` : "";
  return {
    q: `Who created ${brand}?`,
    a: `${brand} was created by stand-up comedian ${taylorName(
      producers
    )}, who hosts and produces every show${withOthers}.`,
  };
}
