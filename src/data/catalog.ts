// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { CatalogEntry, CatalogSource, ImageSourceQuality, PrimaryArchetype, EraSignal } from '@/lib/types'
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
function sanitizeHttpUrl(input: string | null | undefined): string | null {
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
    movement: row.movement ?? null,
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
    primaryArchetype: (row.primaryArchetype as PrimaryArchetype | null) ?? null,
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
  movement?: string | null
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
      movement, case_size_mm, lug_to_lug_mm, water_resistance_m,
      crystal_type, dial_color, is_chronometer, production_year,
      image_url, image_source_url, image_source_quality,
      style_tags, design_traits, role_tags, complications
    )
    VALUES (
      ${input.brand}, ${input.model}, ${input.reference}, 'url_extracted',
      ${input.movement ?? null}, ${input.caseSizeMm ?? null},
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
      movement              = COALESCE(watches_catalog.movement,              EXCLUDED.movement),
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

/**
 * Phase 19 Watches tab DAL (SRCH-09).
 *
 * Adds an ILIKE OR predicate over the trending body of getTrendingCatalogWatches:
 *   - brand_normalized ILIKE %lowerQ%
 *   - model_normalized ILIKE %lowerQ%
 *   - reference_normalized ILIKE %refQ%   (refQ = lowerQ stripped of non-alphanumerics)
 *
 * Score-zero exclusion + popularity-DESC + alphabetical tie-break (D-02 / Phase 18 idiom).
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
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchCatalogWatchResult[]> {
  const trimmed = q.trim()
  if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN) return []

  const lowerQ = trimmed.toLowerCase()
  const pattern = `%${lowerQ}%`
  const refNormalized = lowerQ.replace(/[^a-z0-9]+/g, '')
  const refPattern = refNormalized.length > 0 ? `%${refNormalized}%` : null

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
      and(
        // Score-zero exclusion: matches Phase 18 trending idiom (RESEARCH Pitfall reference).
        sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount}) > 0`,
        or(
          ilike(watchesCatalog.brandNormalized, pattern),
          ilike(watchesCatalog.modelNormalized, pattern),
          // Pitfall 1: only run reference branch when stripped query is non-empty.
          refPattern
            ? ilike(watchesCatalog.referenceNormalized, refPattern)
            : sql`false`,
        ),
      ),
    )
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
