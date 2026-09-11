import legacyFields from "./brand-copy-legacy.json" with { type: "json" };
import type { Content } from "./types";

/** Upgrade only exact legacy defaults; custom copy and unrelated content survive. */
export function upgradeBrandCopy(content: Content, defaults: Content): Content {
  const result = structuredClone(content);
  // Reveal the new tagline only while upgrading the original hero copy.
  if (content.home.hero.tagline === "Tattoo culture meets stand-up comedy") {
    result.home.hero.showTagline = true;
  }
  for (const field of legacyFields) {
    if (field.path.join(".") === "home.hero.showTagline") continue;
    let target = result as unknown as Record<string, unknown>;
    let source = defaults as unknown as Record<string, unknown>;
    for (const key of field.path.slice(0, -1)) {
      target = target[key] as Record<string, unknown>;
      source = source[key] as Record<string, unknown>;
    }
    const key = field.path[field.path.length - 1];
    if (JSON.stringify(target[key]) === JSON.stringify(field.previous)) {
      target[key] = structuredClone(source[key]);
    }
  }
  return result;
}
