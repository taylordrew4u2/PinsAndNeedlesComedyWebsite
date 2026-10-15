type Plain = Record<string, unknown>;

export const isPlain = (value: unknown): value is Plain =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-merge `patch` over `base`.
 *
 * Objects merge key by key; everything else — arrays included — replaces
 * wholesale, so removing an item from a list actually removes it. `undefined`
 * in the patch means "leave the base value alone".
 *
 * Stored content is merged over the defaults on every read, which is what lets
 * a new field in the content model appear without a migration.
 */
export function merge<T>(base: T, patch: unknown): T {
  if (!isPlain(patch)) return patch === undefined ? base : (patch as T);
  if (!isPlain(base)) return patch as T;

  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    // Anything not already in the model still gets carried through, so a
    // partial patch never silently drops a field the defaults do not know.
    out[key] = key in (base as Plain) ? merge((base as Plain)[key], value) : value;
  }
  return out as T;
}
