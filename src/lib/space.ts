/**
 * Public requests now use only the live show. Keep the legacy storage namespace
 * so existing practice records remain separate and no live data needs to move.
 */
export type Space = "live" | "rehearsal";

/** All current URLs use the live show. Legacy practice data stays isolated below. */
export function spaceOf(_value: unknown): Space {
  void _value;
  return "live";
}

/** Where a space keeps its files, relative to the content store's root. */
export function storagePrefix(space: Space): string {
  return space === "rehearsal" ? "rehearsal/" : "";
}

/** `?mode=rehearsal` for rehearsal links, nothing for live ones. */
export function modeQuery(space: Space, joiner: "?" | "&" = "?"): string {
  return space === "rehearsal" ? `${joiner}mode=rehearsal` : "";
}
