/**
 * The live show and the dress rehearsal are two separate spaces.
 *
 * A rehearsal is a practice copy of the whole show: its own pile, its own
 * projector selection, its own always-open form, stored under its own prefix.
 * Nothing done in it reaches the live show — not the pile, not the projector,
 * not the window — and it can run at any time, including during the show.
 *
 * Live storage paths are unprefixed, exactly as they were before rehearsals
 * existed, so the real show's data never moves.
 */
export type Space = "live" | "rehearsal";

/** The URL's `mode=rehearsal` (or a header) selects the rehearsal; anything else is live. */
export function spaceOf(value: unknown): Space {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "rehearsal" ? "rehearsal" : "live";
}

/** Where a space keeps its files, relative to the content store's root. */
export function storagePrefix(space: Space): string {
  return space === "rehearsal" ? "rehearsal/" : "";
}

/** `?mode=rehearsal` for rehearsal links, nothing for live ones. */
export function modeQuery(space: Space, joiner: "?" | "&" = "?"): string {
  return space === "rehearsal" ? `${joiner}mode=rehearsal` : "";
}
