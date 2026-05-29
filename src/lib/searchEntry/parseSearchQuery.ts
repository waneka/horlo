/**
 * Phase 69 D-12 — parseSearchQuery (SRCH-26 pre-seed parser)
 *
 * Pure helper. Given a free-text query and the catalog brand list, returns
 * { brand, model, reference } suitable for pre-seeding StructuredEntryPanel
 * when the typeahead returns no matches.
 *
 * Algorithm (CONTEXT.md D-12, verbatim):
 *   1. Normalize the query: trim + collapse internal runs of whitespace to a
 *      single space + lowercase. Call this `normalizedQuery`.
 *   2. If `normalizedQuery` is empty, return all-empty.
 *   3. Build `(originalBrand, normalizedBrand)` tuples from `catalogBrands` using
 *      the same normalization, then sort by `normalizedBrand.length` DESCENDING
 *      so multi-word brands match before their prefixes (Tag Heuer before Tag).
 *   4. Find the first tuple whose `normalizedBrand` is a *whitespace-bounded*
 *      prefix of `normalizedQuery` (the char after the matched prefix must be
 *      whitespace OR end-of-string; "rolex" must NOT match a query starting
 *      with "rolexX").
 *   5. On hit: `brand` = original-case catalog value. Compute the remainder
 *      (after the matched prefix, trimmed); inside the remainder the LAST
 *      whitespace-delimited token containing a digit becomes `reference`; the
 *      remaining tokens (joined by single spaces) become `model`. If no token
 *      contains a digit, `reference = ''` and `model` is the full remainder.
 *   6. On miss: naive 3-token fallback. Split `normalizedQuery` on whitespace;
 *      first token = `brand` (PRESERVE user input casing by indexing into the
 *      trim-and-collapsed original-case form, NOT the lowercased copy); the
 *      LAST digit-bearing token becomes `reference`; tokens between (exclusive)
 *      join into `model`. Single-token-no-digit → `brand` = that token,
 *      `model = ''`, `reference = ''`.
 *
 * Memory anchor: `project_local_catalog_natural_key_drift` — D-12 trim+lower
 * normalization aligns conceptually with the catalog DAL's natural-key
 * normalization (`regexp_replace(lower(trim(...)), ...)`). Symmetric on the
 * cache-key axis.
 *
 * Year is NEVER returned — the structured panel handles year as a separate
 * field; the SRCH-26 example only pre-seeds brand/model/reference.
 *
 * Pure function: no React imports, no side effects, no client directive.
 */
export function parseSearchQuery(
  query: string,
  catalogBrands: string[],
): { brand: string; model: string; reference: string } {
  // (1) Normalize query — trim, collapse internal whitespace, lowercase.
  const originalCaseCollapsed = query.trim().replace(/\s+/g, ' ')
  const normalizedQuery = originalCaseCollapsed.toLowerCase()

  // (2) Empty input fast-path.
  if (normalizedQuery.length === 0) {
    return { brand: '', model: '', reference: '' }
  }

  // (3) Build sorted (original, normalized) tuples — length DESC so multi-word
  //     brands (e.g. "Tag Heuer") win over their single-word prefixes ("Tag").
  const brandTuples = catalogBrands
    .map((b) => ({
      original: b,
      normalized: b.trim().replace(/\s+/g, ' ').toLowerCase(),
    }))
    .filter((t) => t.normalized.length > 0)
    .sort((a, b) => b.normalized.length - a.normalized.length)

  // (4) First whitespace-bounded prefix match.
  for (const tuple of brandTuples) {
    if (!normalizedQuery.startsWith(tuple.normalized)) continue
    const charAfter = normalizedQuery.charAt(tuple.normalized.length)
    const isBounded = charAfter === '' || charAfter === ' '
    if (!isBounded) continue

    // (5) Hit branch — use original casing for brand; split remainder.
    const remainder = normalizedQuery.slice(tuple.normalized.length).trim()
    if (remainder.length === 0) {
      return { brand: tuple.original, model: '', reference: '' }
    }
    const tokens = remainder.split(/\s+/)
    return {
      brand: tuple.original,
      ...splitModelAndReference(tokens),
    }
  }

  // (6) Miss branch — naive split, preserve user input casing for brand.
  const originalTokens = originalCaseCollapsed.split(/\s+/)
  if (originalTokens.length === 1) {
    // Single token: it becomes brand regardless of whether it has a digit.
    // (Tests 5 & 6 differ on multi-token queries; single-token has no model.)
    return { brand: originalTokens[0], model: '', reference: '' }
  }

  // Multi-token miss: first token is brand (original case), last digit-bearing
  // token is reference, tokens in between join into model. Use the
  // lowercased token list for the digit check; index back into originalTokens.
  const normalizedTokens = normalizedQuery.split(/\s+/)
  const firstBrand = originalTokens[0]
  // Search for the LAST digit-bearing token AFTER index 0 (brand can't be the
  // reference even if it contains a digit — naive split assigns position 0
  // strictly to brand).
  let referenceIndex = -1
  for (let i = normalizedTokens.length - 1; i >= 1; i--) {
    if (/\d/.test(normalizedTokens[i])) {
      referenceIndex = i
      break
    }
  }
  if (referenceIndex === -1) {
    // No digit-bearing token after position 0 — everything after first token
    // joins into model; reference is empty.
    return {
      brand: firstBrand,
      model: originalTokens.slice(1).join(' '),
      reference: '',
    }
  }
  const modelTokens = originalTokens.slice(1, referenceIndex)
  return {
    brand: firstBrand,
    model: modelTokens.join(' '),
    reference: originalTokens[referenceIndex],
  }
}

/**
 * Helper for the brand-HIT branch (step 5): given the post-prefix tokens
 * (normalized, lowercased, whitespace-split), split into model/reference.
 * The LAST token containing a digit becomes reference; the rest joins into
 * model. No-digit → reference is empty, model is the full remainder.
 *
 * Brand-hit case: catalog match means the user *meant* the matched brand,
 * so we use the normalized tokens as-is for both model and reference. Model
 * is title-cased from the lowercased tokens (Test 1: "speedmaster" →
 * "Speedmaster") because the catalog hit signals "this is a known watch
 * vocabulary, give it standard casing."
 */
function splitModelAndReference(tokens: string[]): {
  model: string
  reference: string
} {
  let referenceIndex = -1
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/\d/.test(tokens[i])) {
      referenceIndex = i
      break
    }
  }
  if (referenceIndex === -1) {
    return { model: titleCaseTokens(tokens), reference: '' }
  }
  const modelTokens = tokens.filter((_, i) => i !== referenceIndex)
  return {
    model: titleCaseTokens(modelTokens),
    reference: tokens[referenceIndex],
  }
}

/**
 * Title-case helper for brand-hit model tokens. Each token's first character
 * is uppercased; remaining characters stay as the normalized (lowercased)
 * form. Empty/no-token → empty string.
 */
function titleCaseTokens(tokens: string[]): string {
  return tokens
    .map((t) => (t.length === 0 ? '' : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ')
}
