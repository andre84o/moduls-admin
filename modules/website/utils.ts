/**
 * Pure helpers for the Website content module. No database, no auth, no
 * server-only imports — these are unit-testable in isolation (see
 * tests/website-content.test.ts) and shared by the queries/actions layer.
 */

/**
 * Normalise a page `key` to a stable, URL-safe, lowercase slug-like token.
 * Keys identify a page within a business and must be deterministic, so this
 * lowercases, trims, and collapses any run of non-alphanumerics into a single
 * hyphen. Returns "" when nothing usable remains (callers reject empty keys).
 */
export function normalizeKey(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (å -> a, ö -> o)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalise an optional public route slug. Same shape as a key, but a blank or
 * unusable input maps to `null` (slug is optional and stored as NULL), never "".
 */
export function normalizeSlug(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const slug = normalizeKey(raw);
  return slug.length > 0 ? slug : null;
}

/**
 * Next sort order given the sort orders already in use. Appends to the end:
 * max(existing) + 1, or 0 when there are none. Ignores non-finite values.
 */
export function nextSortOrder(existing: ReadonlyArray<number>): number {
  let max = -1;
  for (const n of existing) {
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}
