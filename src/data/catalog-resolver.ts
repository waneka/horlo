// DAL is server-only — importing this from a client component is a build-time error.
// T-80-03: server-only import is the trust boundary; the resolver itself does NOT check auth.
import 'server-only'

import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { slugifyWithRandomSuffix } from '@/lib/slug'

// ---------------------------------------------------------------------------
// Module constants (D-80-01, D-80-02)
// ---------------------------------------------------------------------------

export const BRAND_FUZZY_MIN_SCORE = 0.6
export const BRAND_FUZZY_CLEAR_GAP = 0.1
export const FAMILY_FUZZY_MIN_SCORE = 0.6
export const UNSPECIFIED_FAMILY_NAME = '(unspecified)'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolveDecision =
  | { tier: 'exact'; decision: 'matched' }
  | { tier: 'alias'; decision: 'matched' }
  | { tier: 'fuzzy'; decision: 'matched'; score: number; runnerUp?: { id: string; name: string; score: number } }
  | { tier: 'auto_create'; decision: 'no_candidates_auto_create' }
  | { tier: 'auto_create'; decision: 'tied_auto_create'; runnerUp?: { id: string; name: string; score: number } }

export interface BrandResolution {
  brandId: string
  decision: ResolveDecision
}

export interface FamilyResolution {
  familyId: string
  decision: ResolveDecision
}

// ---------------------------------------------------------------------------
// Brand resolver — 3-tier: exact → fuzzy-clear-gap → auto-create
// ---------------------------------------------------------------------------

/**
 * Resolves a raw brand string to an existing or newly-created brands.id.
 *
 * Tier 1 — Exact match on name_normalized (INGEST-01).
 * Tier 2 — Fuzzy match via word_similarity >= 0.6 with D-80-01 clear-gap rule (INGEST-02).
 *           Top score wins ONLY when it beats runner-up by >= 0.1. Otherwise falls through.
 * Tier 3 — Atomic auto-create with needs_review = true (INGEST-03).
 *
 * D-80-04: Emits structured console.log events for fuzzy and auto-create paths only.
 * T-80-01: All SQL uses parameterized sql`...` binding — never sql.raw.
 */
export async function resolveBrandId(rawBrand: string): Promise<BrandResolution> {
  // --- Tier 1: Exact match on name_normalized ---
  const exactResult = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM brands
    WHERE name_normalized = lower(trim(${rawBrand}))
    LIMIT 1
  `)
  const exactRows = exactResult as unknown as Array<{ id: string; name: string }>
  if (exactRows.length > 0) {
    // No console.log for exact match — D-80-04 only emits on fuzzy + auto-create.
    return {
      brandId: exactRows[0].id,
      decision: { tier: 'exact', decision: 'matched' },
    }
  }

  // --- Tier 2: Fuzzy match with clear-gap rule (D-80-01) ---
  // LIMIT 2 captures both top + runner-up in a single round-trip.
  // word_similarity (not similarity) per [[pg-trgm-word-similarity-for-brand-typos]].
  // public.f_unaccent on both sides per Open Question #4 / Pattern Analog 3.
  const fuzzyResult = await db.execute<{ id: string; name: string; score: number }>(sql`
    SELECT id, name,
           word_similarity(lower(public.f_unaccent(${rawBrand})), lower(public.f_unaccent(name_normalized))) AS score
    FROM brands
    WHERE word_similarity(lower(public.f_unaccent(${rawBrand})), lower(public.f_unaccent(name_normalized))) >= ${BRAND_FUZZY_MIN_SCORE}
    ORDER BY score DESC
    LIMIT 2
  `)
  const fuzzyRows = fuzzyResult as unknown as Array<{ id: string; name: string; score: number }>

  if (fuzzyRows.length === 1) {
    // Single candidate above threshold — clear pick, no runner-up to compare against.
    const top = fuzzyRows[0]
    console.log('[extract-watch] fuzzy_brand_match', {
      input_raw: rawBrand,
      decision: 'matched',
      matched_id: top.id,
      matched_name: top.name,
      score: top.score,
      runner_up_id: null,
      runner_up_name: null,
      runner_up_score: null,
    })
    return {
      brandId: top.id,
      decision: {
        tier: 'fuzzy',
        decision: 'matched',
        score: top.score,
      },
    }
  }

  if (fuzzyRows.length >= 2) {
    const [top, runnerUp] = fuzzyRows
    const gap = top.score - runnerUp.score

    if (gap >= BRAND_FUZZY_CLEAR_GAP) {
      // Clear gap — top candidate wins.
      console.log('[extract-watch] fuzzy_brand_match', {
        input_raw: rawBrand,
        decision: 'matched',
        matched_id: top.id,
        matched_name: top.name,
        score: top.score,
        runner_up_id: runnerUp.id,
        runner_up_name: runnerUp.name,
        runner_up_score: runnerUp.score,
      })
      return {
        brandId: top.id,
        decision: {
          tier: 'fuzzy',
          decision: 'matched',
          score: top.score,
          runnerUp: { id: runnerUp.id, name: runnerUp.name, score: runnerUp.score },
        },
      }
    } else {
      // Ambiguous tie — emit fuzzy event with tied_auto_create decision, then fall through.
      console.log('[extract-watch] fuzzy_brand_match', {
        input_raw: rawBrand,
        decision: 'tied_auto_create',
        matched_id: top.id,
        matched_name: top.name,
        score: top.score,
        runner_up_id: runnerUp.id,
        runner_up_name: runnerUp.name,
        runner_up_score: runnerUp.score,
      })
      // Fall through to Tier 3 with runnerUp preserved.
      return await _brandAutoCreate(rawBrand, 'tied_auto_create', {
        id: runnerUp.id,
        name: runnerUp.name,
        score: runnerUp.score,
      })
    }
  }

  // --- Tier 3: No candidates above threshold — auto-create ---
  return await _brandAutoCreate(rawBrand, 'no_candidates_auto_create', undefined)
}

/**
 * Atomic brand auto-create helper.
 *
 * Uses ON CONFLICT ON CONSTRAINT brands_name_normalized_unique for race safety.
 * (xmax = 0) AS was_created distinguishes INSERT from race-lost UPDATE.
 * Emits brand_auto_created event only on actual insertion (was_created = true).
 */
async function _brandAutoCreate(
  rawBrand: string,
  fallThroughDecision: 'no_candidates_auto_create' | 'tied_auto_create',
  runnerUp?: { id: string; name: string; score: number },
): Promise<BrandResolution> {
  // slugifyWithRandomSuffix pre-empts brands_slug_unique collisions (Open Q #8).
  const autoCreateResult = await db.execute<{ id: string; was_created: boolean }>(sql`
    INSERT INTO brands (name, slug, needs_review)
    VALUES (${rawBrand}, ${slugifyWithRandomSuffix(rawBrand)}, true)
    ON CONFLICT ON CONSTRAINT brands_name_normalized_unique
      DO UPDATE SET needs_review = brands.needs_review
    RETURNING id, (xmax = 0) AS was_created
  `)
  const autoCreateRows = autoCreateResult as unknown as Array<{ id: string; was_created: boolean }>
  const row = autoCreateRows[0]

  if (row.was_created) {
    // Emit brand_auto_created event with unified D-80-04 8-key payload.
    // score + runner_up_* are null for auto-create events (not omitted — T-80-06).
    console.log('[extract-watch] brand_auto_created', {
      input_raw: rawBrand,
      decision: fallThroughDecision,
      matched_id: row.id,
      matched_name: rawBrand,
      score: null,
      runner_up_id: runnerUp?.id ?? null,
      runner_up_name: runnerUp?.name ?? null,
      runner_up_score: runnerUp?.score ?? null,
    })
  }

  return {
    brandId: row.id,
    decision: {
      tier: 'auto_create',
      decision: fallThroughDecision,
      ...(runnerUp ? { runnerUp } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Family resolver — 4-tier: exact → alias → fuzzy → auto-create
// ---------------------------------------------------------------------------

/**
 * Resolves a raw model string (scoped to a brand) to an existing or newly-created
 * watch_families.id.
 *
 * Step 0 — Empty model coercion: whitespace-only rawModel → '(unspecified)' (CONTEXT Discretion ii-b).
 * Tier 1 — Exact match on name_normalized, brand-scoped (INGEST-04).
 * Tier 2 — Alias containment via aliases @> ARRAY[...]::text[], brand-scoped (D-80-02 before fuzzy).
 * Tier 3 — Fuzzy via word_similarity >= 0.6, brand-scoped, LIMIT 1 no clear-gap rule (D-80-02).
 * Tier 4 — Atomic auto-create with needs_review = true, brand-scoped (INGEST-04).
 *
 * D-80-04: family events include brand_id as scope marker.
 */
export async function resolveFamilyId(brandId: string, rawModel: string): Promise<FamilyResolution> {
  // Step 0 — Empty-model placeholder (Discretion ii, recommendation b).
  const effectiveModel = rawModel.trim() === '' ? UNSPECIFIED_FAMILY_NAME : rawModel

  // --- Tier 1: Exact match on name_normalized, brand-scoped ---
  const exactResult = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM watch_families
    WHERE brand_id = ${brandId}
      AND name_normalized = lower(trim(${effectiveModel}))
    LIMIT 1
  `)
  const exactRows = exactResult as unknown as Array<{ id: string; name: string }>
  if (exactRows.length > 0) {
    return {
      familyId: exactRows[0].id,
      decision: { tier: 'exact', decision: 'matched' },
    }
  }

  // --- Tier 2: Alias containment — single-element ARRAY literal (NOT spread) ---
  // [[drizzle-sql-any-array-pitfall]] does NOT apply — this is ARRAY[value]::text[], not = ANY(${arr}).
  // D-80-02: alias tier runs BEFORE fuzzy — operator-curated merges win over fuzzy guesses.
  const aliasResult = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name
    FROM watch_families
    WHERE brand_id = ${brandId}
      AND aliases @> ARRAY[lower(trim(${effectiveModel}))]::text[]
    ORDER BY created_at ASC
    LIMIT 1
  `)
  const aliasRows = aliasResult as unknown as Array<{ id: string; name: string }>
  if (aliasRows.length > 0) {
    // No log for alias hit — alias is operator-curated; not a fuzzy guess.
    return {
      familyId: aliasRows[0].id,
      decision: { tier: 'alias', decision: 'matched' },
    }
  }

  // --- Tier 3: Fuzzy match scoped to brand — LIMIT 1, no clear-gap rule (D-80-02) ---
  const fuzzyResult = await db.execute<{ id: string; name: string; score: number }>(sql`
    SELECT id, name,
           word_similarity(lower(public.f_unaccent(${effectiveModel})), lower(public.f_unaccent(name_normalized))) AS score
    FROM watch_families
    WHERE brand_id = ${brandId}
      AND word_similarity(lower(public.f_unaccent(${effectiveModel})), lower(public.f_unaccent(name_normalized))) >= ${FAMILY_FUZZY_MIN_SCORE}
    ORDER BY score DESC
    LIMIT 1
  `)
  const fuzzyRows = fuzzyResult as unknown as Array<{ id: string; name: string; score: number }>
  if (fuzzyRows.length > 0) {
    const row = fuzzyRows[0]
    // Emit fuzzy_family_match with brand_id scope marker (D-80-04) + unified 8-key payload.
    console.log('[extract-watch] fuzzy_family_match', {
      brand_id: brandId,
      input_raw: rawModel,
      decision: 'matched',
      matched_id: row.id,
      matched_name: row.name,
      score: row.score,
      runner_up_id: null,
      runner_up_name: null,
      runner_up_score: null,
    })
    return {
      familyId: row.id,
      decision: {
        tier: 'fuzzy',
        decision: 'matched',
        score: row.score,
      },
    }
  }

  // --- Tier 4: Atomic auto-create, brand-scoped ---
  // watch_families.slug is nullable — no slug provided for auto-create rows (operator adds via Phase 82).
  // '{}'::text[] empty alias literal — NOT an array spread ([[drizzle-sql-any-array-pitfall]] does NOT apply).
  const autoCreateResult = await db.execute<{ id: string; was_created: boolean }>(sql`
    INSERT INTO watch_families (brand_id, name, needs_review, aliases)
    VALUES (${brandId}, ${effectiveModel}, true, '{}'::text[])
    ON CONFLICT ON CONSTRAINT watch_families_brand_name_unique
      DO UPDATE SET needs_review = watch_families.needs_review
    RETURNING id, (xmax = 0) AS was_created
  `)
  const autoCreateRows = autoCreateResult as unknown as Array<{ id: string; was_created: boolean }>
  const row = autoCreateRows[0]

  if (row.was_created) {
    // Emit family_auto_created with brand_id scope marker (D-80-04) + unified 8-key payload.
    // score + runner_up_* are null for auto-create events (not omitted — T-80-06).
    console.log('[extract-watch] family_auto_created', {
      brand_id: brandId,
      input_raw: rawModel,
      decision: 'no_candidates_auto_create',
      matched_id: row.id,
      matched_name: effectiveModel,
      score: null,
      runner_up_id: null,
      runner_up_name: null,
      runner_up_score: null,
    })
  }

  return {
    familyId: row.id,
    decision: {
      tier: 'auto_create',
      decision: 'no_candidates_auto_create',
    },
  }
}
