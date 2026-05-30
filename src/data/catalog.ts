// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { cacheLife } from 'next/cache'

import { db } from '@/db'
import { brands, watches, watchesCatalog } from '@/db/schema'
import { and, arrayOverlaps, asc, between, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'
import type { CatalogEntry, CatalogSource, ImageSourceQuality, EraSignal, CatalogTasteAttributes } from '@/lib/types'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

// ---------------------------------------------------------------------------
// Input sanitizers
// ---------------------------------------------------------------------------

/**
 * Validate that a URL is http/https before storing as image_source_url or image_url.
 * Mitigates T-17-02-01: extractor LLM could output `javascript:` / `data:` URIs that
 * subsequently flow into <img src> in /search Watches (Phase 19) — must reject at write.
 * Reuses the existing protocol allowlist pattern from src/app/api/extract-watch/route.ts.
 */
export function sanitizeHttpUrl(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * Tag arrays from URL extractor LLM output must be string[] of reasonable length.
 * Mitigates T-17-02-02: LLM could emit huge / non-string array entries that bloat
 * the catalog row.
 */
function sanitizeTagArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 64)
    .slice(0, 32)
}

// ---------------------------------------------------------------------------
// Row → CatalogEntry mapper
// ---------------------------------------------------------------------------

type CatalogRow = typeof watchesCatalog.$inferSelect

function mapRowToCatalogEntry(row: CatalogRow): CatalogEntry {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    reference: row.reference ?? null,
    source: row.source as CatalogSource,
    imageUrl: row.imageUrl ?? null,
    imageSourceUrl: row.imageSourceUrl ?? null,
    imageSourceQuality: (row.imageSourceQuality as ImageSourceQuality | null) ?? null,
    movementType: row.movementType ?? null,
    movementCaliber: row.movementCaliber ?? null,
    caseSizeMm: row.caseSizeMm ?? null,
    lugToLugMm: row.lugToLugMm ?? null,
    waterResistanceM: row.waterResistanceM ?? null,
    crystalType: row.crystalType ?? null,
    dialColor: row.dialColor ?? null,
    isChronometer: row.isChronometer ?? null,
    productionYear: row.productionYear ?? null,
    productionYearIsEstimate: row.productionYearIsEstimate,
    styleTags: row.styleTags,
    designTraits: row.designTraits,
    roleTags: row.roleTags,
    complications: row.complications,
    ownersCount: row.ownersCount,
    wishlistCount: row.wishlistCount,
    formality: row.formality !== null ? Number(row.formality) : null,
    sportiness: row.sportiness !== null ? Number(row.sportiness) : null,
    heritageScore: row.heritageScore !== null ? Number(row.heritageScore) : null,
    // Phase 49.1 D-SCOPE-01e — primaryArchetype dropped from CatalogEntry shape.
    // The DB column still exists until Plans 07/08 drop it; the mapper simply
    // ignores it.
    eraSignal: (row.eraSignal as EraSignal | null) ?? null,
    designMotifs: row.designMotifs,
    confidence: row.confidence !== null ? Number(row.confidence) : null,
    extractedFromPhoto: row.extractedFromPhoto,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface UserPromotedCatalogInput {
  brand: string
  model: string
  reference: string | null
}

export interface UrlExtractedCatalogInput {
  brand: string
  model: string
  reference: string | null
  // Phase 35 D-03: structured movement (replaces free-text movement column).
  movementType?: 'auto' | 'manual' | 'quartz' | 'spring_drive' | null
  movementCaliber?: string | null
  caseSizeMm?: number | null
  lugToLugMm?: number | null
  waterResistanceM?: number | null
  crystalType?: string | null
  dialColor?: string | null
  isChronometer?: boolean | null
  productionYear?: number | null
  imageUrl?: string | null
  imageSourceUrl?: string | null
  imageSourceQuality?: 'official' | 'retailer' | 'unknown' | 'user_uploaded' | null
  styleTags?: string[]
  designTraits?: string[]
  roleTags?: string[]
  complications?: string[]
}

// ---------------------------------------------------------------------------
// CAT-06: upsertCatalogFromUserInput
// ---------------------------------------------------------------------------

/**
 * CAT-06: Upserts a catalog row from typed user input.
 * Writes natural key only — spec columns left NULL for URL extraction to enrich (D-05).
 * Returns the catalog row id (newly inserted OR pre-existing).
 *
 * Failure semantics: caller MUST wrap in try/catch — fire-and-forget per CAT-08.
 */
export async function upsertCatalogFromUserInput(
  input: UserPromotedCatalogInput,
): Promise<string | null> {
  const { brand, model, reference } = input
  // Server Actions already validate non-empty brand/model via zod (src/app/actions/watches.ts).
  const result = await db.execute<{ id: string }>(sql`
    WITH ins AS (
      INSERT INTO watches_catalog (brand, model, reference, source)
      VALUES (${brand}, ${model}, ${reference}, 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
      RETURNING id
    )
    SELECT id FROM ins
    UNION ALL
    SELECT id FROM watches_catalog
     WHERE brand_normalized = lower(trim(${brand}))
       AND model_normalized = lower(trim(${model}))
       AND reference_normalized IS NOT DISTINCT FROM (
         CASE WHEN ${reference}::text IS NULL THEN NULL
              ELSE regexp_replace(lower(trim(${reference}::text)), '[^a-z0-9]+', '', 'g')
         END
       )
     LIMIT 1
  `)
  const rows = result as unknown as Array<{ id: string }>
  return rows[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// CAT-07: upsertCatalogFromExtractedUrl
// ---------------------------------------------------------------------------

/**
 * CAT-07: Upserts a catalog row from URL-extracted data.
 * On conflict: enriches NULL fields via COALESCE; never overwrites non-null (D-13 first-non-null wins).
 * Promotes source to 'url_extracted' unless existing row is 'admin_curated' (D-10, D-11).
 * Tag arrays only enrich when the catalog row's array is empty (Assumption A4).
 *
 * Failure semantics: caller MUST wrap in try/catch — fire-and-forget per CAT-08.
 */
export async function upsertCatalogFromExtractedUrl(
  input: UrlExtractedCatalogInput,
): Promise<string | null> {
  // T-17-02-01: sanitize image URLs before write — reject non-http/https
  const safeImageUrl = sanitizeHttpUrl(input.imageUrl)
  const safeImageSourceUrl = sanitizeHttpUrl(input.imageSourceUrl)
  // T-17-02-02: sanitize tag arrays — type-check, length-cap
  const safeStyleTags = sanitizeTagArray(input.styleTags)
  const safeDesignTraits = sanitizeTagArray(input.designTraits)
  const safeRoleTags = sanitizeTagArray(input.roleTags)
  const safeComplications = sanitizeTagArray(input.complications)

  // postgres.js renders an empty JS array as `()::text[]` which is invalid SQL.
  // Use the Postgres array literal `'{}'::text[]` for empty arrays; otherwise
  // use the `sql` helper to emit `ARRAY[$1,$2,...]::text[]` for non-empty arrays.
  const toTextArraySql = (arr: string[]) =>
    arr.length === 0
      ? sql`'{}'::text[]`
      : sql`ARRAY[${sql.join(arr.map((v) => sql`${v}`), sql`, `)}]::text[]`

  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO watches_catalog (
      brand, model, reference, source,
      movement_type, movement_caliber, case_size_mm, lug_to_lug_mm, water_resistance_m,
      crystal_type, dial_color, is_chronometer, production_year,
      image_url, image_source_url, image_source_quality,
      style_tags, design_traits, role_tags, complications
    )
    VALUES (
      ${input.brand}, ${input.model}, ${input.reference}, 'url_extracted',
      ${input.movementType ?? null}::movement_type_enum, ${input.movementCaliber ?? null},
      ${input.caseSizeMm ?? null},
      ${input.lugToLugMm ?? null}, ${input.waterResistanceM ?? null},
      ${input.crystalType ?? null}, ${input.dialColor ?? null},
      ${input.isChronometer ?? null}, ${input.productionYear ?? null},
      ${safeImageUrl}, ${safeImageSourceUrl},
      ${input.imageSourceQuality ?? null},
      ${toTextArraySql(safeStyleTags)}, ${toTextArraySql(safeDesignTraits)},
      ${toTextArraySql(safeRoleTags)}, ${toTextArraySql(safeComplications)}
    )
    ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET
      source = CASE
        WHEN watches_catalog.source = 'admin_curated' THEN watches_catalog.source
        ELSE 'url_extracted'
      END,
      movement_type    = COALESCE(watches_catalog.movement_type,    EXCLUDED.movement_type),
      movement_caliber = COALESCE(watches_catalog.movement_caliber, EXCLUDED.movement_caliber),
      case_size_mm          = COALESCE(watches_catalog.case_size_mm,          EXCLUDED.case_size_mm),
      lug_to_lug_mm         = COALESCE(watches_catalog.lug_to_lug_mm,         EXCLUDED.lug_to_lug_mm),
      water_resistance_m    = COALESCE(watches_catalog.water_resistance_m,    EXCLUDED.water_resistance_m),
      crystal_type          = COALESCE(watches_catalog.crystal_type,          EXCLUDED.crystal_type),
      dial_color            = COALESCE(watches_catalog.dial_color,            EXCLUDED.dial_color),
      is_chronometer        = COALESCE(watches_catalog.is_chronometer,        EXCLUDED.is_chronometer),
      production_year       = COALESCE(watches_catalog.production_year,       EXCLUDED.production_year),
      image_url             = COALESCE(watches_catalog.image_url,             EXCLUDED.image_url),
      image_source_url      = COALESCE(watches_catalog.image_source_url,      EXCLUDED.image_source_url),
      image_source_quality  = COALESCE(watches_catalog.image_source_quality,  EXCLUDED.image_source_quality),
      style_tags    = CASE WHEN array_length(watches_catalog.style_tags, 1)    IS NULL THEN EXCLUDED.style_tags    ELSE watches_catalog.style_tags END,
      design_traits = CASE WHEN array_length(watches_catalog.design_traits, 1) IS NULL THEN EXCLUDED.design_traits ELSE watches_catalog.design_traits END,
      role_tags     = CASE WHEN array_length(watches_catalog.role_tags, 1)     IS NULL THEN EXCLUDED.role_tags     ELSE watches_catalog.role_tags END,
      complications = CASE WHEN array_length(watches_catalog.complications, 1) IS NULL THEN EXCLUDED.complications ELSE watches_catalog.complications END,
      updated_at = now()
    RETURNING id
  `)
  const rows = result as unknown as Array<{ id: string }>
  return rows[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// CAT-11: getCatalogById
// ---------------------------------------------------------------------------

/**
 * CAT-11: Reads a single catalog row by id.
 * Public-read RLS allows this from any client context (server-only here for type safety).
 */
export async function getCatalogById(id: string): Promise<CatalogEntry | null> {
  const rows = await db.select().from(watchesCatalog).where(eq(watchesCatalog.id, id)).limit(1)
  if (rows.length === 0) return null
  return mapRowToCatalogEntry(rows[0])
}

// ---------------------------------------------------------------------------
// Phase 19 SRCH-09 + SRCH-10: searchCatalogWatches (Watches tab DAL)
// ---------------------------------------------------------------------------

const SEARCH_WATCHES_TRIM_MIN_LEN = 2
const SEARCH_WATCHES_CANDIDATE_CAP = 50
const SEARCH_WATCHES_DEFAULT_LIMIT = 20

// Phase 67 Plan 02: searchCatalogForAddFlow constants (sibling of SEARCH_WATCHES_*)
const SEARCH_ADD_FLOW_TRIM_MIN_LEN = 2
const SEARCH_ADD_FLOW_CANDIDATE_CAP = 50
const SEARCH_ADD_FLOW_DEFAULT_LIMIT = 20

// ---------------------------------------------------------------------------
// Phase 40 SRCH-16: CatalogSearchFilters + SIZE_BAND_MAP
// ---------------------------------------------------------------------------

/**
 * Optional facet filters for searchCatalogWatches (Phase 40 D-03/D-05/D-07).
 * URL values for size are ASCII-safe: lt36 / 36-39 / 40-42 / 43-45 / 46plus.
 * Phase 46 D-12: brand/era facets for Explore deep-links (D-09..D-14).
 * Phase 49.1 D-SCOPE-01f — `genre` and `archetype` filters removed; the
 * primary_archetype column is being dropped (Plans 07/08).
 */
export interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
  /** Brand slug (from brands.slug); resolved via SQL subquery → brands.id. */
  brand?: string
  /** Era signal (vintage-leaning / modern / contemporary). */
  era?: EraSignal
}

/**
 * Inclusive [min, max] bounds in mm for each case-size chip band (D-05).
 * lt36 upper bound is 35.9 to avoid overlap with 36-39 lower bound.
 * case_size_mm values in the catalog are typically integer or half-step,
 * so the 0.1mm gap is cosmetic but prevents any ambiguity.
 */
const SIZE_BAND_MAP: Record<NonNullable<CatalogSearchFilters['size']>, [number, number]> = {
  lt36: [0, 35.9],
  '36-39': [36, 39],
  '40-42': [40, 42],
  '43-45': [43, 45],
  '46plus': [46, 999],
}

/**
 * Phase 19 Watches tab DAL (SRCH-09).
 *
 * Adds an ILIKE OR predicate over the trending body of getTrendingCatalogWatches:
 *   - brand_normalized ILIKE %lowerQ%
 *   - model_normalized ILIKE %lowerQ%
 *   - reference_normalized ILIKE %refQ%   (refQ = lowerQ stripped of non-alphanumerics)
 *
 * Popularity-DESC + alphabetical tie-break in ORDER BY (D-02 / Phase 18 idiom).
 * 260513-hvu hotfix: WHERE no longer AND-gates by (owners_count + 0.5 * wishlist_count) > 0
 * — that exclusion stranded the 100 seeded catalog rows from Phase 39b-01 whose
 * pg_cron-maintained counters are still 0. Popularity stays load-bearing for ranking.
 * Pre-LIMIT 50 candidates → final slice to limit (D-04 default 20).
 *
 * Anti-N+1 viewer-state hydration (SRCH-10 / D-05): a SINGLE batched
 * inArray(watches.catalogId, topIds) keyed by viewerId — never per-row. 'owned'
 * wins over 'wishlist' for the same catalogId; 'sold' + 'grail' are NOT badged.
 *
 * Pitfall 1 (reference normalization): query string is lower(trim()) +
 * regexp-stripped to match the generated reference_normalized column. If
 * the stripped form is empty (e.g. q = '/-'), the reference branch falls
 * back to sql`false` so the OR predicate stays valid (no ILIKE %% match).
 *
 * Pitfall 4 (empty inArray): topIds.length === 0 short-circuits before
 * the inArray call.
 *
 * All `q` interpolations use Drizzle parameterized template binds — never
 * string-concatenated into SQL text (T-19-01-01 mitigation).
 */
export async function searchCatalogWatches({
  q,
  viewerId,
  limit = SEARCH_WATCHES_DEFAULT_LIMIT,
  filters,
}: {
  q: string
  viewerId: string
  limit?: number
  filters?: CatalogSearchFilters
}): Promise<SearchCatalogWatchResult[]> {
  const trimmed = q.trim()
  // Phase 40 D-01 browse-mode lift: when at least one facet is active, proceed
  // even when q is shorter than the 2-char minimum.
  // Phase 46 D-11: hasActiveFacet includes brand/era facets.
  // Phase 49.1 D-SCOPE-01f — genre/archetype removed; primary_archetype column
  // is being dropped (Plans 07/08).
  const hasActiveFacet = !!(
    filters?.movement ||
    filters?.size ||
    filters?.style?.length ||
    filters?.brand ||
    filters?.era
  )
  if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN && !hasActiveFacet) return []

  const lowerQ = trimmed.toLowerCase()
  const pattern = `%${lowerQ}%`
  const refNormalized = lowerQ.replace(/[^a-z0-9]+/g, '')
  const refPattern = refNormalized.length > 0 ? `%${refNormalized}%` : null

  // Phase 46 WR-04: resolve the brand slug → brands.id explicitly BEFORE
  // building the candidate query. Previously the brand predicate ran an inline
  // `brand_id = (SELECT id FROM brands WHERE slug = ... LIMIT 1)` subquery; on
  // an unknown/stale slug that subquery yields NULL and `brand_id = NULL` is
  // NULL (not false) in SQL three-valued logic, so the row is excluded — the
  // query silently returns zero rows, indistinguishable from "brand has no
  // catalog watches." Resolving up-front lets us short-circuit to [] on an
  // unresolved slug instead of running a guaranteed-empty query.
  let resolvedBrandId: string | null = null
  if (filters?.brand) {
    const [brandRow] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, filters.brand))
      .limit(1)
    if (!brandRow) return []
    resolvedBrandId = brandRow.id
  }

  const candidates = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    // 260513-hvu hotfix: score-zero predicate moved OUT of WHERE. The Phase 18
    // trending idiom AND-gated name-match by popularity, which excluded the 100
    // seeded catalog rows bootstrapped in Phase 39b-01 whose pg_cron-maintained
    // owners_count/wishlist_count are still 0 (no users have collected them yet).
    // ORDER BY (below) preserves the identical popularity expression so popular
    // rows still rank ahead of zero-popularity name-matches.
    //
    // Phase 40 predicate composition: build a predicates array and AND-compose.
    // Pitfall 1 guard: and(...predicates) with empty array → undefined → no WHERE.
    .where((() => {
      const predicates = []

      // ILIKE OR for text query — only when trimmed query is long enough.
      if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) {
        predicates.push(
          or(
            ilike(watchesCatalog.brandNormalized, pattern),
            ilike(watchesCatalog.modelNormalized, pattern),
            // Pitfall 1: only run reference branch when stripped query is non-empty.
            refPattern
              ? ilike(watchesCatalog.referenceNormalized, refPattern)
              : sql`false`,
          )!,
        )
      }

      // Movement Type facet — D-03/D-08: eq on pgEnum + isNotNull for NULL exclusion.
      if (filters?.movement) {
        predicates.push(isNotNull(watchesCatalog.movementType)!)
        predicates.push(eq(watchesCatalog.movementType, filters.movement)!)
      }

      // Case Size facet — D-05/D-08: between() on numeric column + isNotNull.
      if (filters?.size) {
        const [min, max] = SIZE_BAND_MAP[filters.size]
        predicates.push(isNotNull(watchesCatalog.caseSizeMm)!)
        predicates.push(between(watchesCatalog.caseSizeMm, min, max)!)
      }

      // Style facet — D-07/D-08: arrayOverlaps (OR-logic within facet).
      // No isNotNull needed: styleTags is notNull with default '{}' (D-08).
      if (filters?.style?.length) {
        predicates.push(arrayOverlaps(watchesCatalog.styleTags, filters.style)!)
      }

      // Phase 46 D-12: Era facet — eraSignal text column.
      if (filters?.era) {
        predicates.push(isNotNull(watchesCatalog.eraSignal)!)
        predicates.push(eq(watchesCatalog.eraSignal, filters.era)!)
      }

      // Phase 49.1 D-SCOPE-01f — Genre/Archetype facet block removed (the
      // primary_archetype column is being dropped in Plans 07/08). The
      // archetype-wins tiebreaker is gone with the predicate.

      // Phase 46 D-12: Brand facet — URL carries brands.slug, not brands.id.
      // Phase 46 WR-04: brand id is resolved up-front (resolvedBrandId); an
      // unresolved slug already short-circuited the whole function to [] above,
      // so reaching here with filters.brand set guarantees resolvedBrandId.
      if (resolvedBrandId) {
        predicates.push(eq(watchesCatalog.brandId, resolvedBrandId)!)
      }

      // Pitfall 1: and() with 0 args → undefined → Drizzle omits WHERE clause.
      return predicates.length > 0 ? and(...predicates) : undefined
    })())
    .orderBy(
      desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
      asc(watchesCatalog.brandNormalized),
      asc(watchesCatalog.modelNormalized),
    )
    .limit(SEARCH_WATCHES_CANDIDATE_CAP)

  if (candidates.length === 0) return []

  const top = candidates.slice(0, limit)
  const topIds = top.map((r) => r.id)

  // Pitfall 4: length-guard before inArray to skip the degenerate empty IN clause.
  const stateRows = topIds.length
    ? await db
        .select({
          catalogId: watches.catalogId,
          status: watches.status,
        })
        .from(watches)
        .where(
          and(
            eq(watches.userId, viewerId),
            inArray(watches.catalogId, topIds),
          ),
        )
    : []

  // D-05 resolution: 'owned' wins over 'wishlist' for the same catalogId.
  // 'sold' + 'grail' are NOT badged.
  const stateMap = new Map<string, 'owned' | 'wishlist'>()
  for (const row of stateRows) {
    if (!row.catalogId) continue
    const prior = stateMap.get(row.catalogId)
    if (row.status === 'owned') {
      stateMap.set(row.catalogId, 'owned')
    } else if (row.status === 'wishlist' && prior !== 'owned') {
      stateMap.set(row.catalogId, 'wishlist')
    }
    // 'sold' and 'grail' deliberately fall through — no badge.
  }

  return top.map((r) => ({
    catalogId: r.id,
    brand: r.brand,
    model: r.model,
    reference: r.reference,
    imageUrl: r.imageUrl,
    ownersCount: r.ownersCount,
    wishlistCount: r.wishlistCount,
    viewerState: stateMap.get(r.id) ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Phase 67 Plan 02: searchCatalogForAddFlow — Add Flow typeahead DAL (DUPE-01/DUPE-03)
// ---------------------------------------------------------------------------

/**
 * Phase 67 Add-Flow typeahead catalog search (D-01 sibling of searchCatalogWatches).
 *
 * Identical candidate query + anti-N+1 viewerState hydration as searchCatalogWatches,
 * with ONE intentional difference: the ORDER BY gains a boolean-DESC tier
 * `(reference_normalized = queryNormalized) DESC` above the popularity sort so
 * exact-reference matches bubble to the top (D-04/D-05).
 *
 * Phase 72 SRCH-01 fix (D-02/D-03): WHERE is AND-of-ORs over per-token ILIKE patterns.
 * Each whitespace-split token must independently match at least one of
 * (brand_normalized, model_normalized, reference_normalized), so multi-token queries
 * like "Brut Datejust" correctly return rows where brand="Brut" and model contains
 * "Datejust" — no single column needs to contain the full multi-token substring.
 *
 * D-03: no facet predicates — WHERE is per-token ILIKE AND-of-ORs over
 * brand/model/ref normalized only.
 * D-02: viewerId is always required (viewer-state hydration needs session identity).
 *
 * Pitfall 1 (empty refToken per token): when a token's alphanumeric-stripped form is
 * empty, substitute sql`false` for the reference branch so no unintended rows match.
 *
 * Pitfall 2 (empty token list): defensive `if (tokens.length === 0) return []` after
 * tokenization (impossible after the upstream early-return, but belt-and-suspenders per D-03).
 *
 * Pitfall 4 (empty inArray): topIds.length === 0 short-circuits before the inArray
 * call to avoid degenerate WHERE catalog_id IN () SQL.
 *
 * All `q` interpolations use Drizzle parameterized template binds — never
 * string-concatenated into SQL text (T-67-02-01 mitigation).
 * D-04: pattern construction (`%${token}%`) happens in TypeScript; the resulting
 * string is a bind parameter in the generated SQL — never injected SQL text.
 */
export async function searchCatalogForAddFlow({
  q,
  viewerId,
  limit = SEARCH_ADD_FLOW_DEFAULT_LIMIT,
}: {
  q: string
  viewerId: string
  limit: number
}): Promise<SearchCatalogWatchResult[]> {
  const qTrimmed = q.trim()
  if (qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN) return []

  // D-03: tokenize on whitespace; each token must independently match a column.
  const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)
  // Pitfall 2: defensive guard — impossible after early-return above, but
  // static analyzers cannot prove it; belt-and-suspenders per D-03.
  if (tokens.length === 0) return []

  const queryNormalized = qTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
  // Pitfall 1 guard (ORDER BY tier): when normalized query is empty, use sql`false`
  // so no rows receive a false exact-ref bump (mirrors searchCatalogWatches refPattern guard).
  // D-05: DESC NULLS LAST — under PostgreSQL's default DESC = NULLS FIRST,
  // rows with reference_normalized IS NULL would sort ABOVE non-matching rows.
  // Emit the NULLS LAST modifier as raw SQL since Drizzle's desc() helper does not.
  const exactRefOrderTier =
    queryNormalized.length > 0
      ? sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST`
      : sql`false DESC NULLS LAST`

  // D-02 + D-04: AND-of-ORs per token. Each token is lowercased and bound via
  // Drizzle ilike() — the pattern string is a TypeScript value, not SQL text.
  // The reference branch normalizes each token (strip non-alphanumeric) to match
  // the reference_normalized column format, mirroring the queryNormalized lane above.
  const tokenClauses = tokens.map((token) => {
    const colPattern = `%${token}%`
    const refToken = token.replace(/[^a-z0-9]+/g, '')
    return or(
      ilike(watchesCatalog.brandNormalized, colPattern),
      ilike(watchesCatalog.modelNormalized, colPattern),
      // Pitfall 1 (per-token): only run reference branch when stripped token is non-empty.
      refToken.length > 0
        ? ilike(watchesCatalog.referenceNormalized, `%${refToken}%`)
        : sql`false`,
    )
  })

  const candidates = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      reference: watchesCatalog.reference,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
      wishlistCount: watchesCatalog.wishlistCount,
    })
    .from(watchesCatalog)
    .where(
      // D-02: AND of per-token OR-groups — no facets (no movement/size/style/brand/era predicates)
      and(...tokenClauses),
    )
    .orderBy(
      // D-04/D-05 tier 1: exact-reference bump — true sorts first under DESC
      exactRefOrderTier,
      // Existing popularity + alpha tie-break (matches searchCatalogWatches)
      desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
      asc(watchesCatalog.brandNormalized),
      asc(watchesCatalog.modelNormalized),
    )
    .limit(SEARCH_ADD_FLOW_CANDIDATE_CAP)

  if (candidates.length === 0) return []

  const top = candidates.slice(0, Math.min(limit, SEARCH_ADD_FLOW_CANDIDATE_CAP))
  const topIds = top.map((r) => r.id)

  // Pitfall 4: length-guard before inArray to skip the degenerate empty IN clause.
  const stateRows = topIds.length
    ? await db
        .select({
          catalogId: watches.catalogId,
          status: watches.status,
        })
        .from(watches)
        .where(
          and(
            eq(watches.userId, viewerId),
            inArray(watches.catalogId, topIds),
          ),
        )
    : []

  // D-05 resolution: 'owned' wins over 'wishlist' for the same catalogId.
  // 'sold' + 'grail' are NOT badged.
  const stateMap = new Map<string, 'owned' | 'wishlist'>()
  for (const row of stateRows) {
    if (!row.catalogId) continue
    const prior = stateMap.get(row.catalogId)
    if (row.status === 'owned') {
      stateMap.set(row.catalogId, 'owned')
    } else if (row.status === 'wishlist' && prior !== 'owned') {
      stateMap.set(row.catalogId, 'wishlist')
    }
    // 'sold' and 'grail' deliberately fall through — no badge.
  }

  return top.map((r) => ({
    catalogId: r.id,
    brand: r.brand,
    model: r.model,
    reference: r.reference,
    imageUrl: r.imageUrl,
    ownersCount: r.ownersCount,
    wishlistCount: r.wishlistCount,
    viewerState: stateMap.get(r.id) ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Phase 40 D-06: getTopStyleTags — cached top-N style tag vocabulary
// ---------------------------------------------------------------------------

/**
 * Returns the top-N most frequent style_tags values from watches_catalog,
 * ordered by frequency DESC.
 *
 * Used to populate the Style chip group in the SRCH-16 filter sheet (D-06).
 * 'use cache' + cacheLife('hours') — catalog style_tags change only on admin
 * seed/enrichment runs, so a 1-hour TTL is appropriate. Pitfall 3 safe:
 * this function takes no user-specific inputs and is safe to cache globally.
 *
 * Called from the /search Server Component page; threaded as styleVocab prop
 * into SearchPageClient → WatchFacetSheet.
 */
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT tag, COUNT(*) AS freq
        FROM watches_catalog, unnest(style_tags) AS tag
        GROUP BY tag
        ORDER BY freq DESC
        LIMIT ${limit}`,
  )
  return (rows as unknown as Array<{ tag: string }>).map((r) => r.tag)
}

// ---------------------------------------------------------------------------
// Phase 19.1 D-13 + D-22: updateCatalogTaste — first-write-wins on taste fields
// (also persists the extracted_from_photo boolean per D-22)
// ---------------------------------------------------------------------------

/**
 * Update the 8 taste columns on a watches_catalog row.
 *
 * Default mode (D-13 first-write-wins): writes only when `confidence IS NULL`.
 * Returns `{updated: false}` if the row already has any taste data — the live
 * enrichment paths (manual entry, URL extract) call default mode.
 *
 * Force mode (script path — D-13 + D-15): writes unconditionally. The
 * `db:reenrich-taste` script passes `{force: true}` after explicit operator
 * confirmation.
 *
 * D-22: writes `extracted_from_photo` from `taste.extractedFromPhoto`. Plan 02's
 * enricher sets this true when the call ran in vision mode, false otherwise.
 *
 * Failure semantics: caller MUST wrap in try/catch — fire-and-forget per D-09.
 */
export async function updateCatalogTaste(
  catalogId: string,
  taste: CatalogTasteAttributes,
  options?: { force?: boolean },
): Promise<{ updated: boolean }> {
  const force = options?.force === true

  // D-07/D-08: downgrade guard — block a text-mode force write that would overwrite
  // a vision-derived high-confidence row. Vision-mode incoming writes bypass this guard
  // entirely. Only applies on the force path (non-force writes already check confidence IS NULL).
  if (force && !taste.extractedFromPhoto) {
    const existing = await db.execute<{
      confidence: string | null
      extracted_from_photo: boolean
    }>(sql`
      SELECT confidence, extracted_from_photo
      FROM watches_catalog
      WHERE id = ${catalogId}
    `)
    const row = (existing as unknown as Array<{
      confidence: string | null
      extracted_from_photo: boolean
    }>)[0]
    if (
      row &&
      row.extracted_from_photo === true &&
      row.confidence !== null &&
      Number(row.confidence) >= 0.7
    ) {
      console.warn(JSON.stringify({
        event: 'taste_downgrade_guard_blocked',
        catalog_id: catalogId,
        existing_confidence: row.confidence,
        timestamp: new Date().toISOString(),
      }))
      return { updated: false }
    }
  }

  // For empty arrays, postgres.js renders `()::text[]` which is invalid SQL —
  // emit `'{}'::text[]` literal instead.
  const motifsSql =
    taste.designMotifs.length === 0
      ? sql`'{}'::text[]`
      : sql`ARRAY[${sql.join(taste.designMotifs.map((v) => sql`${v}`), sql`, `)}]::text[]`

  // Phase 49.1 D-SCOPE-01e + Pitfall 4 — primary_archetype removed from the
  // UPSERT SET clause; the column is being dropped in Plans 07/08, and the
  // enricher chain no longer produces a value.
  const result = await db.execute<{ id: string }>(sql`
    UPDATE watches_catalog
       SET formality            = ${taste.formality},
           sportiness           = ${taste.sportiness},
           heritage_score       = ${taste.heritageScore},
           era_signal           = ${taste.eraSignal},
           design_motifs        = ${motifsSql},
           confidence           = ${taste.confidence},
           extracted_from_photo = ${taste.extractedFromPhoto},
           updated_at           = now()
     WHERE id = ${catalogId}
       ${force ? sql`` : sql`AND confidence IS NULL`}
     RETURNING id
  `)
  const rows = result as unknown as Array<{ id: string }>
  return { updated: rows.length > 0 }
}

// ---------------------------------------------------------------------------
// Phase 19.1 D-21: applyUserUploadedPhoto — write-through to catalog image_url
// ---------------------------------------------------------------------------

/**
 * Apply a user-uploaded reference photo to a catalog row.
 * Uses COALESCE first-non-null-wins (D-13 / Phase 17 D-13 pattern):
 *   - image_url            stays if already set; else takes the new signed URL
 *   - image_source_url     stays if already set; else takes the new bucket path
 *   - image_source_quality stays if already set; else 'user_uploaded'
 *
 * imageUrl: Supabase signed URL OR direct CDN URL — caller decides. We sanitize
 * via sanitizeHttpUrl (T-19.1-04-04 mitigation).
 *
 * Returns `{applied: boolean}` — true when the UPDATE actually changed at least
 * one of the three image_* columns (i.e., at least one was NULL beforehand).
 *
 * Failure semantics: caller wraps in try/catch — fire-and-forget per D-09.
 */
export async function applyUserUploadedPhoto(
  catalogId: string,
  input: { imageUrl: string; imageSourceUrl: string },
): Promise<{ applied: boolean }> {
  const safeImageUrl = sanitizeHttpUrl(input.imageUrl)
  if (!safeImageUrl) {
    return { applied: false }
  }
  // imageSourceUrl is a bucket path like "{userId}/{catalogId}/{file}.jpg" — NOT a URL.
  // Skip sanitizeHttpUrl on this; just length-cap defensively.
  const safeSourceUrl = input.imageSourceUrl.slice(0, 512)

  const result = await db.execute<{ id: string }>(sql`
    UPDATE watches_catalog
       SET image_url            = COALESCE(image_url,            ${safeImageUrl}),
           image_source_url     = COALESCE(image_source_url,     ${safeSourceUrl}),
           image_source_quality = COALESCE(image_source_quality, 'user_uploaded'),
           updated_at           = now()
     WHERE id = ${catalogId}
       AND (image_url IS NULL OR image_source_url IS NULL OR image_source_quality IS NULL)
     RETURNING id
  `)
  const rows = result as unknown as Array<{ id: string }>
  return { applied: rows.length > 0 }
}

// ---------------------------------------------------------------------------
// Phase 69 D-13 — listCatalogBrands: SSR-fetched brand list for SRCH-26 pre-seed
// ---------------------------------------------------------------------------

/**
 * Phase 69 D-13 — listCatalogBrands.
 *
 * Returns the DISTINCT set of brand strings present in `watches_catalog`,
 * sorted ascending. SSR-fetched at `/watch/new` render time and prop-drilled
 * through `AddWatchFlow` → `SearchEntry` → `parseSearchQuery` for the SRCH-26
 * longest-prefix brand match (D-12).
 *
 * Drizzle ORM `selectDistinct` — NOT raw `sql`. Mirror of `getTopStyleTags`
 * minus the cache wrapper.
 *
 * NO `'use cache'` / `cacheLife` — INTENTIONAL. Brand list is fetched
 * per-request at navigation-to-page cadence; the SELECT DISTINCT is cheap
 * (~100 rows in prod) and brand-list staleness has no behavioral failure
 * mode (D-12 falls back to a naive split for novel brands not yet in the
 * list — see Test case (e) `cartier` in the parser test matrix).
 *
 * Zero arguments — public-read RLS on `watches_catalog` already allows this
 * without viewer identity. The DAL stays viewer-agnostic.
 *
 * Returns original-case brand values (NOT lowercased) so the parser can
 * preserve catalog casing on a brand hit (e.g. user typed "omega", returned
 * brand is "Omega"). Aligns with the
 * `project_local_catalog_natural_key_drift` memory: D-12 normalization is
 * conceptually symmetric with the catalog DAL's natural-key
 * `regexp_replace(lower(trim(...)))` on the cache-key axis.
 */
export async function listCatalogBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: watchesCatalog.brand })
    .from(watchesCatalog)
    .orderBy(asc(watchesCatalog.brand))
  return rows.map((r) => r.brand)
}
