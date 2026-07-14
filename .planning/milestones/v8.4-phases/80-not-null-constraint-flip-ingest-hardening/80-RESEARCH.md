# Phase 80: NOT NULL Constraint Flip + Ingest Hardening - Research

**Researched:** 2026-06-25
**Domain:** Postgres DDL constraint flip + Drizzle resolver inside `/api/extract-watch` DAL (Next 16 / pg_trgm / Supabase)
**Confidence:** HIGH

## Summary

Phase 80 ships two tightly coupled deliverables: (1) a 3-tier brand resolver + 4-tier family resolver wired into both `/api/extract-watch` upsert helpers (`upsertCatalogFromExtractedUrl` + `upsertCatalogFromUserInput`), and (2) a hand-written SQL migration that flips `watches_catalog.brand_id` and `family_id` to `NOT NULL`. The deploy sequence is non-negotiable per D-80-03: code ships first, manual extract proves the wire-up, then the constraint migration is pushed.

Research confirms the resolver lands cleanly inside `src/data/catalog.ts` (or a sibling `src/data/catalog-resolver.ts`) using Drizzle's `sql` template tag, the same connection model already in use for both upsert helpers. All SQL primitives required are already in place: `brands.name_normalized` is GENERATED + UNIQUE (`brands_name_normalized_unique`); `watch_families` has UNIQUE `(brand_id, name_normalized)` (`watch_families_brand_name_unique`); `aliases text[]` has a GIN containment index (`watch_families_aliases_gin_idx`); `extensions.word_similarity` is available via the Phase 79-precedent search_path setup; the `watches_catalog_natural_key` UNIQUE constraint on `(brand_normalized, model_normalized, reference_normalized) NULLS NOT DISTINCT` is the existing ON CONFLICT target. The Phase 79 `--apply` script already encodes the exact INSERT shape for brands + families with `needs_review` semantics, providing a verified reference implementation.

**Primary recommendation:** Build the resolver as two pure async helpers (`resolveBrandId`, `resolveFamilyId`) in `src/data/catalog-resolver.ts`, call them from BOTH upsert helpers before the existing INSERT, use `INSERT ... ON CONFLICT ON CONSTRAINT ... DO UPDATE ... RETURNING id` for race-safe auto-create, ship the NOT NULL migration as `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` AFTER manual prod proof, and omit `brand_id` + `family_id` from the existing `ON CONFLICT DO UPDATE SET` clause on conflict (silent reuse of existing FKs).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brand resolver (3-tier: exact → fuzzy clear-gap → auto-create) | API / Backend (DAL) | Database (Postgres + pg_trgm) | Resolver runs inside `src/data/catalog.ts` upsert helpers under service-role; brand lookup, fuzzy match, and atomic auto-create are all SQL ops |
| Family resolver (4-tier: exact → alias → fuzzy → auto-create) | API / Backend (DAL) | Database (Postgres + GIN) | Same as brand; alias containment is a GIN index lookup; family fuzzy is brand-scoped pg_trgm |
| Structured log events (`fuzzy_brand_match`, etc.) | API / Backend (DAL) | — | `console.log` JSON inside resolver; Vercel log explorer is the audit surface |
| NOT NULL constraint flip on `brand_id` / `family_id` | Database / Storage | — | DDL migration; ALTER TABLE ... SET NOT NULL |
| `/api/extract-watch` route handler | API / Backend (Route) | — | Phase 80 ships ZERO route changes; resolver is downstream of the route |
| AddWatchFlow / `<ExtractErrorCard>` | Frontend Server (SSR) | — | UNCHANGED per D-80-04 silent-response decision |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-80-01: Clear-gap fuzzy tie-break.** Brand fuzzy lookup runs `pg_trgm` against `brands.name_normalized` with threshold 0.6. The resolver picks the top match ONLY when it beats the runner-up by at least 0.1. Ambiguous ties fall through to auto-create with `needs_review = true`. Both picked match AND runner-up logged in `fuzzy_brand_match` event.
- **D-80-02: Exact → alias → fuzzy → auto-create.** Family lookup, scoped to the resolved brand: (1) exact match on `name_normalized`, (2) alias containment via `aliases @>`, (3) fuzzy `word_similarity ≥ 0.6` (top score wins, no clear-gap rule), (4) auto-create with `needs_review = true`. Aliases come second so Phase 79's operator-decided merges win over fuzzy guesses.
- **D-80-03: Staged deploy.** Three ordered steps: (1) Vercel deploys ingest code with constraint still nullable, (2) operator runs ONE manual URL extract and verifies via SQL, (3) THEN `supabase db push --linked` for the NOT NULL migration.
- **D-80-04: Structured `console.log` events; response shape silent.** Event types: `fuzzy_brand_match`, `fuzzy_family_match`, `brand_auto_created`, `family_auto_created`. Payload: `input_raw`, `decision`, `matched_id`, `matched_name`, `score`, `runner_up_*` (for fuzzy), `brand_id` (for family events). API response envelope UNCHANGED.

### Claude's Discretion

- **Resolver location** — single helper module, planner picks file layout. Contract: pure async function, brand-then-family ordering, all logging contained inside helper.
- **Empty/whitespace `model_raw` handling** — options (a) NULL family path [NOT POSSIBLE after NOT NULL flip], (b) auto-create `(unspecified)` placeholder + `needs_review=true`, (c) extend route empty-gate to fail on empty model. Recommend (b).
- **Re-extract behavior on ON CONFLICT** — options (i) leave `brand_id`/`family_id` alone, (ii) re-run resolver and UPDATE, (iii) UPDATE only if NULL. Recommend (i).
- **Idempotency + tests** — vitest unit vs integration split; planner picks. Re-running same fixture must produce identical FK ids.
- **Trigram GIN index on `brands.name_normalized`** — currently ~50 brand rows, sequential scan fine at v8.4 scale. Defer index, document.
- **Migration filename** — `supabase/migrations/{timestamp}_phase80_catalog_brand_family_not_null.sql` where timestamp sorts after `20260624000000`. Verify ordering at write time.
- **Tone** — Tyler asked for plain-English in operator-facing artifacts (POST-DEPLOY.md, README comments). Technical artifacts (CONTEXT/RESEARCH/PLAN) stay precise.

### Deferred Ideas (OUT OF SCOPE)

- Threshold tuning UI / config table (planner ships 0.6 + 0.1 as module constants)
- Telemetry table (`catalog_resolution_log`) — Vercel logs cover audit at v8.4 scale
- `brandResolution` / `familyResolution` fields on API response (silent per D-80-04)
- Re-extract resolver re-run + UPDATE FKs on conflict (race vs operator merges)
- Symmetric clear-gap rule on family fuzzy (asymmetric is fine; lookup is brand-scoped)
- Bundled deploy (D-80-03 staged is the chosen pattern)
- Pre-emptive trigram GIN on `brands.name_normalized` (~50 rows; defer)
- Per-row `needs_review` extended grammar (Phase 82 queue UI is the surface)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANON-01 | `watches_catalog.brand_id` is `NOT NULL` after migration | Postgres `ALTER TABLE ... ALTER COLUMN brand_id SET NOT NULL` validates existing rows at constraint-add time. Phase 79 MIG-04 already proved zero NULLs (precondition met). See § Migration Plan. |
| CANON-02 | `watches_catalog.family_id` is `NOT NULL` after migration | Same DDL pattern as CANON-01. Both columns flipped in one transaction. See § Migration Plan. |
| INGEST-01 | Exact-match brand lookup attaches `brand_id` | Tier 1 brand resolver: `SELECT id FROM brands WHERE name_normalized = lower(trim($1)) LIMIT 1`. See § Resolver SQL Shapes (Brand Tier 1). |
| INGEST-02 | Fuzzy-match brand attaches `brand_id` + logs `fuzzy_brand_match` | Tier 2 brand resolver: single CTE-style query returning top + runner-up `word_similarity` scores; clear-gap evaluated in TypeScript. See § Resolver SQL Shapes (Brand Tier 2). |
| INGEST-03 | Auto-create new brand with `needs_review=true` + attach `brand_id` | Tier 3 brand resolver: atomic `INSERT ... ON CONFLICT ON CONSTRAINT brands_name_normalized_unique DO UPDATE SET needs_review = brands.needs_review RETURNING id`. See § Atomic Auto-Create Pattern. |
| INGEST-04 | Family lookup with alias containment check before fuzzy | 4-tier family resolver: exact → `aliases @>` (uses existing `watch_families_aliases_gin_idx`) → fuzzy → auto-create. See § Resolver SQL Shapes (Family Tiers). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.45.2 (existing) | DAL query builder + `sql` template tag | Already used by both upsert helpers; resolver inherits same `db` client and connection |
| postgres.js | (existing, via Drizzle client) | Postgres client | Configured with `{ prepare: false }` in `src/db/index.ts` for Supabase pooler |
| pg_trgm | extensions schema (prod), public (local) | `word_similarity()` for fuzzy match | Memory [[pg-trgm-word-similarity-for-brand-typos]] — `word_similarity` NOT `similarity` (suffix dilution) |
| unaccent + `public.f_unaccent` | extensions + public wrapper (existing) | Optional diacritic folding for fuzzy match | Available via Phase 79 quick-260623-uua migration; functional indexes already exist on `watches_catalog.brand` / `model` |
| Zod v4 | existing | Body validation at route boundary | NOT touched by Phase 80 (resolver is downstream of validation) |
| Vitest 3.x | existing | Unit + integration tests | Existing config supports both `jsdom` (default) + `node` (via `// @vitest-environment node` pragma) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `postgres` lib (direct) | existing | Migration tests — raw `sql` tag connection | For tests in `tests/integration/migrations/` that introspect schema via `pg_catalog` / `information_schema` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `INSERT ... ON CONFLICT DO UPDATE RETURNING id` | `INSERT ... ON CONFLICT DO NOTHING` + follow-up `SELECT` | DO NOTHING returns no rows on conflict — would require an extra SELECT round-trip. DO UPDATE with a no-op SET preserves single-statement atomicity and always returns id. |
| TypeScript clear-gap evaluation | SQL `CASE WHEN top - runner_up >= 0.1 THEN ...` | Pushing to SQL adds query complexity for marginal benefit; TypeScript path is easier to test in isolation |
| SAVEPOINT + retry for race-safe auto-create | `ON CONFLICT DO UPDATE` | SAVEPOINT works but adds a code path and isn't necessary when a UNIQUE constraint already exists (which it does, on both `brands.name_normalized` and `(brand_id, name_normalized)`) |

**Installation:** No new packages.

**Version verification:** None needed — all dependencies already locked.

## Resolver SQL Shapes

> All snippets use the existing Drizzle `sql` template tag from `src/data/catalog.ts`. Parameters are bound (never string-concatenated). The resolver runs INSIDE the existing `db.execute<{...}>(sql\`...\`)` pattern.

### Brand Tier 1 — exact match on `name_normalized`

```typescript
const brandRows = await db.execute<{ id: string; name: string }>(sql`
  SELECT id, name
  FROM brands
  WHERE name_normalized = lower(trim(${rawBrand}))
  LIMIT 1
`)
```

**Notes:**
- `name_normalized` is a GENERATED column (Phase 17 / 34) — no runtime normalization needed.
- `brands_name_normalized_unique` constraint guarantees at most one row.
- LIMIT 1 is defensive (constraint already enforces uniqueness).
- **Pitfall check:** No array spread — `[[drizzle-sql-any-array-pitfall]]` does not apply.

### Brand Tier 2 — fuzzy match with top + runner-up in ONE query

```typescript
const fuzzyRows = await db.execute<{
  id: string
  name: string
  score: number
}>(sql`
  SELECT id, name,
         word_similarity(lower(trim(${rawBrand})), name_normalized) AS score
  FROM brands
  WHERE word_similarity(lower(trim(${rawBrand})), name_normalized) >= 0.6
  ORDER BY score DESC
  LIMIT 2
`)
```

**Clear-gap evaluation in TypeScript:**

```typescript
if (fuzzyRows.length === 0) {
  // No candidates above 0.6 — fall through to Tier 3 (auto-create)
} else if (fuzzyRows.length === 1) {
  // Single candidate — clear pick, no runner-up to compare against
  return { brandId: fuzzyRows[0].id, decision: 'matched', score: fuzzyRows[0].score }
} else {
  const [top, runnerUp] = fuzzyRows
  if (top.score - runnerUp.score >= 0.1) {
    return { brandId: top.id, decision: 'matched', score: top.score, runnerUp }
  } else {
    // Ambiguous tie — fall through to Tier 3 with tied_auto_create decision
  }
}
```

**Notes:**
- `word_similarity()` is unqualified — works in BOTH local (public) and prod (extensions) because Phase 79's migration sets up the session search_path AND the operator OID is resolved at query plan time (memories [[supabase-extension-schema-function-pin]] + [[pg-trgm-word-similarity-for-brand-typos]]). For the resolver running inside a Vercel request lifecycle (not inside a migration), the prod connection uses `prepare: false` and search_path = `public, extensions` from the Supabase default; `word_similarity` resolves correctly. **VERIFY** with a local-first test that calls `word_similarity` from the resolver and inspects the result.
- LIMIT 2 captures both top + runner-up in a single round-trip (no separate "best score" / "second-best score" queries).
- `runnerUp` may be undefined when only one row clears 0.6 — D-80-01 logs only what exists.
- **Optional diacritic folding:** could wrap both sides in `lower(public.f_unaccent(...))` to match the existing `searchCatalogWatches` pattern. Recommend YES — the GIN trigram index on `watches_catalog` is already on `lower(public.f_unaccent(brand))`, and a brand-level resolver should be at least as forgiving. Add it as a planner discretion item.

### Brand Tier 3 — atomic auto-create

See § Atomic Auto-Create Pattern below.

### Family Tier 1 — exact match on `name_normalized`, brand-scoped

```typescript
const familyRows = await db.execute<{ id: string; name: string }>(sql`
  SELECT id, name
  FROM watch_families
  WHERE brand_id = ${resolvedBrandId}
    AND name_normalized = lower(trim(${rawModel}))
  LIMIT 1
`)
```

**Notes:**
- `(brand_id, name_normalized)` is a UNIQUE constraint — at most one row.
- `watch_families_brand_id_idx` supports the brand_id filter.

### Family Tier 2 — alias containment via `aliases @>`

```typescript
const aliasRows = await db.execute<{ id: string; name: string }>(sql`
  SELECT id, name
  FROM watch_families
  WHERE brand_id = ${resolvedBrandId}
    AND aliases @> ARRAY[lower(trim(${rawModel}))]::text[]
  ORDER BY created_at ASC
  LIMIT 1
`)
```

**Notes:**
- `watch_families_aliases_gin_idx` (default `array_ops` opclass from Phase 78) supports `@>` containment lookup (GIN strategy 2).
- Single-element `ARRAY[...]::text[]` literal — NOT an array spread, [[drizzle-sql-any-array-pitfall]] does NOT apply.
- `ORDER BY created_at ASC LIMIT 1` is the deterministic tiebreaker if multiple families in the same brand share an alias (shouldn't happen — Phase 79 `--apply` deduped, and any duplicate alias would be an operator data-entry bug; LIMIT 1 stays defensive).
- The alias source string is `lower(trim(rawModel))` — matches Phase 79's `lower().trim()` normalization for appended aliases (see `scripts/v8.4-brand-canonicalization.ts` L1155).

### Family Tier 3 — fuzzy match scoped to brand

```typescript
const familyFuzzyRows = await db.execute<{
  id: string
  name: string
  score: number
}>(sql`
  SELECT id, name,
         word_similarity(lower(trim(${rawModel})), name_normalized) AS score
  FROM watch_families
  WHERE brand_id = ${resolvedBrandId}
    AND word_similarity(lower(trim(${rawModel})), name_normalized) >= 0.6
  ORDER BY score DESC
  LIMIT 1
`)
```

**Notes:**
- Per D-80-02, family fuzzy does NOT inherit the clear-gap rule — top score wins.
- Brand-scoped (`brand_id = $1`) means the row count is typically single-digit-to-low-dozens.
- No supporting trigram index needed at v8.4 scale (planner can defer per discretion item).

### Family Tier 4 — atomic auto-create

See § Atomic Auto-Create Pattern below.

## Atomic Auto-Create Pattern

> The trap: two concurrent ingests for the same novel brand could produce two rows, one with `needs_review = true` and another with conflicting state, unless the INSERT is race-safe.

**Recommended pattern: `INSERT ... ON CONFLICT ON CONSTRAINT ... DO UPDATE ... RETURNING id`**

### Brand auto-create

```typescript
const [brandRow] = await db.execute<{ id: string; was_created: boolean }>(sql`
  INSERT INTO brands (name, slug, needs_review)
  VALUES (${rawBrand}, ${slugify(rawBrand)}, true)
  ON CONFLICT ON CONSTRAINT brands_name_normalized_unique
    DO UPDATE SET needs_review = brands.needs_review
  RETURNING id, (xmax = 0) AS was_created
`)
```

**Notes:**
- **Constraint name verified:** `brands_name_normalized_unique` (added in `20260510000000_phase34_brands_families.sql` line 22-24, also declared in schema.ts L535).
- **`brands.slug` is `NOT NULL UNIQUE` (line 21 Phase 34 migration)** — auto-create MUST provide a slug. Use the same `slugify(rawName)` helper Phase 79 uses (see `scripts/v8.4-brand-canonicalization.ts` L982). If `slugify` lives in the script and not in src, planner extracts it.
  - **Slug collision risk:** unlikely at v8.4 scale (~50 brands, novel brand strings); if two brands normalize to different `name_normalized` but produce the same slug (e.g., emoji-handling), the slug UNIQUE constraint would throw. The resolver MUST also handle `brands_slug_unique` violations — fallback: append a short hash. Document in Open Questions.
- **`needs_review = brands.needs_review` is a no-op UPDATE** — required because `DO NOTHING` returns no rows on conflict. The no-op SET preserves the existing value while ensuring the row is returned.
- **`xmax = 0 AS was_created`** is the standard Postgres trick to distinguish INSERT from UPDATE for the structured log event (`brand_auto_created` vs `matched`). On INSERT, xmax is 0; on UPDATE, xmax is the transaction ID.
- **Race safety:** if two transactions try to insert the same `name_normalized` simultaneously, exactly one wins; the loser's DO UPDATE runs and returns the same `id`. Both callers get the same `brand_id`. The UNIQUE constraint is the synchronization primitive.
- **Pitfall check:** No array spread — [[drizzle-sql-any-array-pitfall]] does NOT apply.

### Family auto-create

```typescript
const [familyRow] = await db.execute<{ id: string; was_created: boolean }>(sql`
  INSERT INTO watch_families (brand_id, name, needs_review, aliases)
  VALUES (${resolvedBrandId}, ${rawModel}, true, '{}'::text[])
  ON CONFLICT ON CONSTRAINT watch_families_brand_name_unique
    DO UPDATE SET needs_review = watch_families.needs_review
  RETURNING id, (xmax = 0) AS was_created
`)
```

**Notes:**
- **Constraint name verified:** `watch_families_brand_name_unique` on `(brand_id, name_normalized)` (added in `20260510000000_phase34_brands_families.sql` line 47-50, also declared in schema.ts L561).
- `watch_families.slug` is nullable per D-01a — no slug provided on auto-create (operator can add via Phase 82 UI).
- `aliases` ships empty per shape; not appended on auto-create (operator decides via Phase 82).
- `'{}'::text[]` literal for empty array — Phase 79 / catalog.ts pattern.

### Why NOT `INSERT ... ON CONFLICT DO NOTHING + fallback SELECT`

- DO NOTHING returns 0 rows on conflict — requires a second `SELECT id FROM brands WHERE name_normalized = ...` round-trip.
- The `upsertCatalogFromUserInput` function in `src/data/catalog.ts` already uses this two-statement pattern (CTE + UNION) as a workaround. The Phase 80 resolver does NOT need that workaround because we control the INSERT shape — DO UPDATE returns the id atomically.

### Empty `model_raw` handling (Discretion item ii)

**Recommendation: Option (b) — auto-create placeholder `(unspecified)` family scoped to the brand.**

When `rawModel.trim() === ''`:
- Exact match runs `WHERE name_normalized = ''` — 0 rows (no existing `(unspecified)` row yet).
- Alias containment runs `aliases @> ARRAY[''::text[]]` — 0 rows.
- Fuzzy runs `word_similarity('', name_normalized)` — returns 0 for all rows, threshold 0.6 fails — 0 rows.
- Falls through to auto-create with `name = '(unspecified)'`, `needs_review = true`.

```typescript
const effectiveModel = rawModel.trim() === '' ? '(unspecified)' : rawModel
// Then run tier 1-3 with effectiveModel; tier 4 uses '(unspecified)' literal.
```

**Race condition:** two concurrent extracts with empty model on the same brand → both attempt to insert `(unspecified)` family → second hits `watch_families_brand_name_unique` constraint, DO UPDATE returns the same id. ONE row. Operator cleans up via Phase 82.

**Why not (a) NULL family path:** impossible after CANON-02 NOT NULL flip.
**Why not (c) extend route empty-gate:** breaks the existing D-12 contract ("only fail if BOTH brand and model are empty") and forces a route-level change (Phase 80 is supposed to ship ZERO route changes per CONTEXT § Reusable Assets).

## Re-extract Behavior on `ON CONFLICT` (Discretion item iii)

**Recommendation: Option (i) — leave `brand_id` + `family_id` alone on conflict.**

The existing `upsertCatalogFromExtractedUrl` `ON CONFLICT ... DO UPDATE SET` clause (L218-239 of `src/data/catalog.ts`) explicitly lists the columns being updated:
- `source`, `movement_type`, `movement_caliber`, `case_size_mm`, `lug_to_lug_mm`, `water_resistance_m`, `crystal_type`, `dial_color`, `is_chronometer`, `production_year`, `image_url`, `image_source_url`, `image_source_quality`, `style_tags`, `design_traits`, `role_tags`, `complications`, `updated_at`.

**To achieve "leave brand_id/family_id alone":** simply DO NOT add them to the SET list. Columns not mentioned in `DO UPDATE SET` are left at their existing values automatically. No explicit `brand_id = watches_catalog.brand_id` line is needed.

**Verification:** when the existing row was created BEFORE Phase 80 ships (e.g., Phase 79 hydrated all rows), `brand_id` and `family_id` are already populated; the re-extract path leaves them untouched, preserving any operator merge decisions made via Phase 82.

**For `upsertCatalogFromUserInput`:** the existing CTE pattern (L143-161) is `INSERT ... ON CONFLICT DO NOTHING` + UNION SELECT. The Phase 80 changes: (1) call resolver BEFORE the CTE, (2) include `brand_id` + `family_id` in the INSERT column list / VALUES, (3) leave the `DO NOTHING` unchanged — on conflict, the existing row's FKs are returned by the UNION SELECT side.

## Migration Plan

### Filename + ordering

**Recommended:** `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`

- Sorts AFTER `20260624000000_phase78_aliases_needs_review.sql` (last shipped migration) ✓
- Sorts AFTER any quick-task migrations that may have shipped between Phase 78 and Phase 80 — **VERIFY** at write time by `ls supabase/migrations/` and confirm the timestamp is greater than the highest existing.
- Memory: [[drizzle-supabase-db-mismatch]] gotcha #1 (filename) + #2 (ordering).

### Migration body

```sql
-- Phase 80 — NOT NULL flip on watches_catalog.brand_id + family_id (CANON-01, CANON-02)
--
-- Precondition: Phase 79's --apply backfilled brand_id + family_id on all 205
-- prod rows. Phase 79 MIG-04 post-flight assertion proved zero NULLs at
-- transaction commit time. This migration is the trust boundary that makes
-- Phase 81 RECO-01/02 JOIN-through path safe (no NULL FKs to defend against).
--
-- Sequencing: D-80-03 staged deploy — this migration runs AFTER the resolver
-- code has been deployed to prod and ONE manual extract has proved both
-- upsertCatalogFromExtractedUrl and upsertCatalogFromUserInput attach brand_id
-- and family_id to new catalog rows. Without that proof, the next ingest after
-- the migration would fail with 23502 and break the AddWatchFlow.
--
-- Defensive guard: this migration includes a count-zero precondition assertion
-- (DIFFERENT predicate from the operation per [[post-flight-assertion-predicate-divergence]]).
-- If for any reason a NULL slipped in between Phase 79 close and Phase 80 push,
-- the migration aborts before the ALTER TABLE runs.
--
-- Filename ordering: 20260626000000 sorts AFTER the most recent migration
-- 20260624000000_phase78_aliases_needs_review.sql per [[drizzle-supabase-db-mismatch]] gotcha #1.
--
-- Sibling Drizzle shape mirror: src/db/schema.ts § watchesCatalog brand_id +
-- family_id columns flipped from .references(...) to .references(...).notNull().
-- Drizzle-kit push handles local; this hand-written SQL handles prod.
--
-- No table rewrite: ALTER TABLE ... SET NOT NULL on a column that has NO NULL
-- rows is a metadata-only operation in Postgres 11+. At ~205 prod rows the
-- AccessExclusive lock is sub-millisecond regardless.

BEGIN;

-- 1. Defensive precondition. Phrased as "count rows that VIOLATE the new
--    constraint" — semantically different from the ALTER itself (which would
--    just abort silently with "column contains null values" if a NULL existed).
--    Per [[post-flight-assertion-predicate-divergence]], a check that mirrors
--    the operation can inherit the same bug.
DO $$
DECLARE
  null_brand_count integer;
  null_family_count integer;
BEGIN
  SELECT count(*) INTO null_brand_count
    FROM watches_catalog
   WHERE brand_id IS NULL;
  SELECT count(*) INTO null_family_count
    FROM watches_catalog
   WHERE family_id IS NULL;

  IF null_brand_count > 0 THEN
    RAISE EXCEPTION 'Phase 80 aborted — % watches_catalog rows have brand_id IS NULL. Run Phase 79 --apply first.', null_brand_count;
  END IF;
  IF null_family_count > 0 THEN
    RAISE EXCEPTION 'Phase 80 aborted — % watches_catalog rows have family_id IS NULL. Run Phase 79 --apply first.', null_family_count;
  END IF;
END $$;

-- 2. Flip brand_id NOT NULL (CANON-01).
ALTER TABLE watches_catalog
  ALTER COLUMN brand_id SET NOT NULL;

-- 3. Flip family_id NOT NULL (CANON-02).
ALTER TABLE watches_catalog
  ALTER COLUMN family_id SET NOT NULL;

-- 4. Post-flight assertion. Phrased against RESULTING STATE (information_schema)
--    NOT against re-running a SELECT NULL count (which would trivially still
--    pass because nothing inserted between the ALTERs and now).
DO $$
DECLARE
  brand_id_nullable text;
  family_id_nullable text;
BEGIN
  SELECT is_nullable INTO brand_id_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches_catalog'
     AND column_name = 'brand_id';

  SELECT is_nullable INTO family_id_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watches_catalog'
     AND column_name = 'family_id';

  IF brand_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 80 failed — watches_catalog.brand_id is still nullable (got: %)', brand_id_nullable;
  END IF;
  IF family_id_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Phase 80 failed — watches_catalog.family_id is still nullable (got: %)', family_id_nullable;
  END IF;
END $$;

COMMIT;
```

### Local drizzle-kit push step

Schema update in `src/db/schema.ts` § watchesCatalog:

```typescript
brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
familyId: uuid('family_id').notNull().references(() => watchFamilies.id, { onDelete: 'restrict' }),
```

Workflow per [[drizzle-supabase-db-mismatch]]:
1. Edit `src/db/schema.ts` (add `.notNull()` to both columns).
2. Run `npm run db:push` LOCALLY — drizzle-kit generates and applies the change to the local Supabase.
3. **VERIFY** local: `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'watches_catalog' AND column_name IN ('brand_id', 'family_id')` returns `NO, NO`.
4. Hand-write `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` (the prod-portable version above).
5. Run the local-first verification recipe (§ below).
6. Push to prod via `supabase db push --linked` ONLY AFTER staged deploy step 2 (manual extract proof).

## File Map

### New files
| Path | Purpose |
|------|---------|
| `src/data/catalog-resolver.ts` | Brand + family resolver helpers (`resolveBrandId`, `resolveFamilyId`); structured log emission |
| `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` | NOT NULL flip migration (CANON-01, CANON-02) |
| `tests/unit/data/catalog-resolver.test.ts` | 7-branch resolver unit tests (exact-brand, fuzzy-clear-gap-brand, fuzzy-ambiguous-brand, auto-create-brand, exact-family, alias-family, fuzzy-family, auto-create-family) |
| `tests/integration/migrations/80-not-null-constraint.test.ts` | Integration test asserting `23502` on NULL `brand_id` insert |
| `tests/integration/data/catalog-resolver-against-local-db.test.ts` | Integration test running resolver against local Supabase with seeded brands/families |
| `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-POST-DEPLOY.md` | Operator-facing post-deploy verification artifact (mirrors Phase 78/79 pattern) |

### Modified files
| Path | Change |
|------|--------|
| `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` (L178–244) | Call `resolveBrandId` + `resolveFamilyId` BEFORE the INSERT; add `brand_id`, `family_id` to INSERT column + VALUES list; OMIT them from `ON CONFLICT DO UPDATE SET` clause (per Discretion iii — leave alone on conflict) |
| `src/data/catalog.ts` § `upsertCatalogFromUserInput` (L138–164) | Same resolver call shape; restructure CTE to include `brand_id`, `family_id` in INSERT columns + VALUES |
| `src/db/schema.ts` § `watchesCatalog` (L504–505) | Add `.notNull()` to `brandId` and `familyId` references |

### Unchanged (verify in plan)
| Path | Why |
|------|-----|
| `src/app/api/extract-watch/route.ts` | ZERO route changes per CONTEXT § Reusable Assets — resolver lives in the DAL, not the route |
| `src/components/.../AddWatchFlow*` | Silent response (D-80-04) — no client-side change |
| `src/components/.../ExtractErrorCard*` | D-15 error taxonomy unchanged |

## Test Plan

### Unit tests (`tests/unit/data/catalog-resolver.test.ts`) — vitest, jsdom default

> Run with mocked `db.execute` so each branch is testable without a live DB.

| # | Branch | Fixture input | Expected output | Assertion shape |
|---|--------|---------------|-----------------|-----------------|
| 1 | Brand Tier 1 (exact) | `rawBrand = 'Hamilton'` (canonical lower-trim 'hamilton' exists) | `{ brandId: '<hamilton-uuid>', decision: 'matched', tier: 'exact' }` | `expect(result.decision).toBe('matched')` + mock `db.execute` returns one row from Tier 1 query |
| 2 | Brand Tier 2 clear-gap | `rawBrand = 'Hamilon'` (typo); mock Tier 2 returns `[{ id: 'A', score: 0.85 }, { id: 'B', score: 0.62 }]` | `{ brandId: 'A', decision: 'matched', tier: 'fuzzy', score: 0.85, runnerUp: { id: 'B', score: 0.62 } }` | gap = 0.23 ≥ 0.1 → pick top; logs `fuzzy_brand_match` |
| 3 | Brand Tier 2 ambiguous | `rawBrand = 'Iwc'`; mock Tier 2 returns `[{ id: 'A', score: 0.72 }, { id: 'B', score: 0.68 }]` | Falls through to Tier 3 auto-create with `decision: 'tied_auto_create'` | gap = 0.04 < 0.1 → ambiguous; logs `fuzzy_brand_match` with `decision: tied_auto_create` then `brand_auto_created` |
| 4 | Brand Tier 3 auto-create | `rawBrand = 'Acme Chronograph Co'`; mock Tier 2 returns empty | `{ brandId: '<new-uuid>', decision: 'no_candidates_auto_create', tier: 'auto_create' }` | mock auto-create INSERT returns `{ id, was_created: true }`; logs `brand_auto_created` |
| 5 | Family Tier 1 (exact) | `(brandId, rawModel) = (<hamilton>, 'Khaki Field')` exact match | `{ familyId, decision: 'matched', tier: 'exact' }` | one-row Tier 1 result |
| 6 | Family Tier 2 alias | `(brandId, rawModel) = (<brut>, 'Brut Date')`; mock alias query returns `[{ id, name: 'Brut Datejust' }]` | `{ familyId, decision: 'matched', tier: 'alias' }` | aliases path hit; Tier 3 NOT called |
| 7 | Family Tier 3 fuzzy | `(brandId, rawModel) = (<iwc>, 'Portuguser')` (typo); mock fuzzy returns `[{ id, name: 'Portugieser', score: 0.78 }]` | `{ familyId, decision: 'matched', tier: 'fuzzy', score: 0.78 }` | logs `fuzzy_family_match` |
| 8 | Family Tier 4 auto-create | `(brandId, rawModel) = (<acme>, 'Foo Bar')`; all tiers miss | `{ familyId, decision: 'no_candidates_auto_create', tier: 'auto_create' }` | logs `family_auto_created` |
| 9 | Empty model_raw → placeholder | `(brandId, rawModel) = (<acme>, '')` → effectiveModel = '(unspecified)' | auto-create `(unspecified)` family or hit existing if present | exercise the empty-model branch explicitly |
| 10 | Re-extract idempotency | call resolver twice with same input | identical `brandId` + `familyId` on both calls | both call sites return same UUID; on auto-create, second call hits ON CONFLICT path |

### Integration test (`tests/integration/migrations/80-not-null-constraint.test.ts`) — vitest, node env, DATABASE_URL gated

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 80 — watches_catalog brand_id + family_id NOT NULL (CANON-01, CANON-02)', () => {
  let sql: ReturnType<typeof postgres>
  beforeAll(() => { sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) })
  afterAll(async () => { if (sql) await sql.end({ timeout: 5 }) })

  it('brand_id is NOT NULL in information_schema (CANON-01)', async () => {
    const rows = await sql<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id'
    `
    expect(rows[0].is_nullable).toBe('NO')
  })

  it('family_id is NOT NULL in information_schema (CANON-02)', async () => {
    const rows = await sql<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='family_id'
    `
    expect(rows[0].is_nullable).toBe('NO')
  })

  it('INSERT with brand_id=NULL raises 23502', async () => {
    await expect(
      sql`INSERT INTO watches_catalog (brand, model, source, brand_id, family_id)
          VALUES ('Test', 'Test', 'user_promoted', NULL, NULL)`
    ).rejects.toMatchObject({ code: '23502' })
  })
})
```

### Integration test (`tests/integration/data/catalog-resolver-against-local-db.test.ts`)

Exercise the actual resolver against local Supabase with seeded brands/families. Covers the alias path (Brut Date → Brut Datejust) and at least one auto-create path. **Wave 0 gap:** local seed must have at least one family with an alias appended — see § Local-First Verification Recipe step 2.

### Wave 0 gaps
- [ ] `tests/unit/data/catalog-resolver.test.ts` — covers INGEST-01..04 unit branches (10 cases)
- [ ] `tests/integration/migrations/80-not-null-constraint.test.ts` — covers CANON-01, CANON-02
- [ ] `tests/integration/data/catalog-resolver-against-local-db.test.ts` — covers INGEST-04 alias path end-to-end against real DB
- [ ] Existing test infrastructure for `tests/integration/migrations/*` (the Phase 78 test is the precedent — same `postgres` + `DATABASE_URL` gate pattern)

## Local-First Verification Recipe

> CLAUDE.md Local-First gate is non-optional. Phase 80 is BOTH DB-touching AND ingest-path-modifying. Verify ALL paths before push.

### Step 0 — pre-flight on local Supabase

```bash
# Ensure local Supabase is running and seeded
supabase status
# DATABASE_URL should point at 127.0.0.1:54322 per .env.development.local
```

Verify Phase 79 `--apply` has run against local (alias rows must be populated for the Brut Date test):

```bash
# Confirm at least one alias row exists locally
psql $DATABASE_URL -c "SELECT name, aliases FROM watch_families WHERE array_length(aliases, 1) > 0 LIMIT 5;"
# If empty: tsx scripts/v8.4-brand-canonicalization.ts --apply --mode=both  # against local
```

If local catalog does NOT have a Brut Datejust family with `brut date` alias, manually seed one for the test:

```sql
-- One-shot local seed for Brut Date alias test (NOT shipped to prod)
UPDATE watch_families
   SET aliases = aliases || ARRAY['brut date']::text[]
 WHERE name_normalized = 'brut datejust'
   AND brand_id = (SELECT id FROM brands WHERE name_normalized = 'brut');
```

### Step 1 — deploy ingest code locally

```bash
npm run dev
```

### Step 2 — execute four test extracts

For each test below: sign in as `viewer@horlo.test` / `password123`, paste the URL into the AddWatchFlow URL input, and complete the flow. Then verify via SQL.

**Test (a) — Brand exact match (Tier 1):**
- URL: a Hamilton product page (e.g., `https://www.hamiltonwatch.com/en-us/khaki-field-mechanical-h69439931.html`)
- Expected: `brand_id` resolves to existing Hamilton `brands.id`; NO new brand row; NO `fuzzy_brand_match` event in console.
- Verify:
  ```sql
  SELECT c.brand_id, b.name FROM watches_catalog c
    JOIN brands b ON b.id = c.brand_id
   WHERE c.brand = 'Hamilton' ORDER BY c.created_at DESC LIMIT 1;
  -- Should return canonical Hamilton row.
  ```

**Test (b) — Brand fuzzy clear-gap match (Tier 2):**
- Trick: most URLs you find will return correctly-spelled brand names from the LLM. To exercise the fuzzy path, USE the structured-input branch with `{ "mode": "structured", "brand": "Hamilon", "model": "Khaki Field" }`. Submit via curl or the AddWatchFlow structured panel.
- Expected: resolver scores `Hamilon` against `hamilton` (high `word_similarity`), top score wins clear-gap → existing Hamilton id attached. Console logs `fuzzy_brand_match` JSON with `decision: matched`.
- Verify: same SQL as (a) — should resolve to existing Hamilton.

**Test (c) — Brand auto-create (Tier 3):**
- Structured input: `{ "mode": "structured", "brand": "Acme Chronograph Co", "model": "Model X" }`.
- Expected: new `brands` row created with `needs_review = true`. New `watch_families` row created with `needs_review = true`. Both attached to the catalog row.
- Verify:
  ```sql
  SELECT name, needs_review FROM brands WHERE name = 'Acme Chronograph Co';
  -- Should return one row with needs_review = true.
  SELECT name, needs_review FROM watch_families WHERE name = 'Model X' AND brand_id = (SELECT id FROM brands WHERE name = 'Acme Chronograph Co');
  -- Should return one row with needs_review = true.
  ```

**Test (d) — Family alias hit (Tier 2 family):**
- Structured input: `{ "mode": "structured", "brand": "Brut", "model": "Brut Date" }` (requires Step 0 alias seed).
- Expected: brand resolves Tier 1 to canonical Brut id; family hits alias path → resolves to canonical `Brut Datejust` family. NO new family row.
- Verify:
  ```sql
  SELECT c.family_id, f.name FROM watches_catalog c
    JOIN watch_families f ON f.id = c.family_id
   WHERE c.brand = 'Brut' AND c.model = 'Brut Date' ORDER BY c.created_at DESC LIMIT 1;
  -- f.name should be 'Brut Datejust' (canonical).
  ```

### Step 3 — run the NOT NULL migration locally

```bash
# Drizzle local push (schema.ts notNull() addition)
npm run db:push

# Or run the hand-written SQL directly via psql
psql $DATABASE_URL -f supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql
```

Verify:
```sql
SELECT column_name, is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name='watches_catalog'
   AND column_name IN ('brand_id', 'family_id');
-- Both rows should show is_nullable = 'NO'.
```

### Step 4 — re-run tests (a)/(d) AFTER NOT NULL flip

Confirm no regression: a clean extract with a known brand still attaches both FKs and the route returns success.

### Step 5 — only AFTER step 4 passes, push to prod

Per D-80-03 staged deploy:
1. `git push` Vercel-deploys the ingest code (resolver wired, schema still nullable in prod).
2. Operator runs ONE manual extract on prod (test (a)) and verifies via Supabase SQL editor that `brand_id` + `family_id` are populated.
3. THEN `supabase db push --linked` runs the NOT NULL migration.
4. Operator verifies prod schema via SQL editor.

## Threat Model Inputs

### Threats

| # | Threat | STRIDE | Mitigation |
|---|--------|--------|------------|
| T-80-01 | SQL injection via LLM-extracted brand/model strings | Tampering | Drizzle `sql` template tag binds all parameters; never string-concat into SQL text. Verify EVERY interpolation in the resolver uses `sql\`...${value}...\`` form, not `sql.raw()` |
| T-80-02 | Mass auto-create flood (attacker submits N unique unknown brands) | Denial of Service | Auth gate at route boundary (already enforced — `getCurrentUser()` runs FIRST per route L141-148); auto-create requires authenticated user. Rate-limiting is at the Vercel/auth layer, not resolver-level. `needs_review = true` quarantines the rows — operator can mass-delete via Phase 82 admin UI |
| T-80-03 | Resolver bypassing auth (direct DAL caller without route auth gate) | Spoofing | Resolver lives in `src/data/catalog-resolver.ts` and is server-only (`import 'server-only'`). Only callable from server contexts — Server Actions, route handlers, server scripts. The resolver itself does NOT check auth (correct — DAL layer assumes upstream auth); the route ENFORCES auth |
| T-80-04 | `needs_review = true` queue poisoning (1000+ fake brand rows) | Tampering | Phase 82 admin UI needs sort/filter for the queue (Phase 82 OPS-01 concern). For Phase 80, acceptable — queue rows are just data; cleanup is one DELETE per row. Document for Phase 82 to handle. Worth a soft limit: planner can OPTIONALLY add a Phase 80 deferred item: "If brands.count where needs_review=true exceeds N, log a heightened-severity event for operator alerting" |
| T-80-05 | Slug collision on auto-create (`brands_slug_unique` constraint) | Availability | `slugify(rawBrand)` could produce collisions (e.g., `"Acme Co!"` and `"Acme Co?"` slug to same string). The INSERT would fail with 23505. Mitigation: catch 23505 specifically and retry with `slug + '-' + shortHash(name)`. See Open Questions |
| T-80-06 | Information disclosure via `console.log` payload | Information Disclosure | Payload fields (`input_raw`, `matched_name`, `runner_up_name`) are LLM-extracted brand/model strings from public web pages — not PII. NEVER log the full Watch object (could contain user notes, prices, etc.) or the request body. Audit the resolver's log emission to confirm only declared payload fields |

### Project Constraints (from CLAUDE.md)

- **Local-First Development:** Verify in `npm run dev` against local Supabase BEFORE pushing to prod. NOT optional — Phase 80 is the canonical "would silently break prod" case if the resolver has a bug.
- **Tech stack:** Next.js 16 App Router — no rewrites. Resolver code lives in the DAL layer (server-only).
- **GSD Workflow Enforcement:** All Phase 80 code changes go through `/gsd-execute-phase`.

## Open Questions for Planner

1. **Resolver file location.** Recommended `src/data/catalog-resolver.ts` (sibling of `src/data/catalog.ts`). Alternative: `src/lib/catalog/resolver.ts`. The existing precedent in the codebase is that DAL helpers (one-row-per-domain) live under `src/data/`, while pure-logic utilities live under `src/lib/`. Since the resolver runs SQL and uses the `db` client, `src/data/` is the right home. Confirm at plan-write time.

2. **`slugify` helper extraction.** The Phase 79 script has `slugify()` inline (`scripts/v8.4-brand-canonicalization.ts` ~L982). Phase 80 needs the same function — should the planner extract it to `src/lib/slug.ts` (shared), or duplicate the implementation in the resolver? Recommend extract.

3. **`slug` collision retry on auto-create.** When `slugify(rawBrand)` collides with an existing `brands.slug`, the INSERT fails with 23505 on `brands_slug_unique` (NOT on `brands_name_normalized_unique`). The DO UPDATE clause matches on `name_normalized` only — slug collisions are NOT caught. Recommend: catch 23505 → append short hash to slug → retry once. Planner to confirm or argue for a different approach.

4. **Diacritic folding on Tier 2 fuzzy.** The existing `searchCatalogWatches` fuzzy tier wraps both sides in `lower(public.f_unaccent(...))` (catalog.ts L549-550) to handle `Héron` ↔ `Heron`. The Phase 80 brand resolver SHOULD match this pattern for consistency. Two implementation options: (a) use the same `f_unaccent` wrapper for symmetry, (b) trust `name_normalized` (which is `lower(trim(name))` only — NOT unaccent-folded). Recommend (a). Planner to confirm.

5. **`brand_id` index on `brands.name_normalized`.** The UNIQUE constraint `brands_name_normalized_unique` creates a btree index automatically. Tier 1 (exact equality) hits this. Tier 2 (`word_similarity`) does NOT — at ~50 brands seq scan is fine. Recommend: defer trigram GIN index on `brands.name_normalized` to a future phase, but DOCUMENT the deferral.

6. **Re-extract behavior on the structured-input branch.** `upsertCatalogFromUserInput` uses `INSERT ... ON CONFLICT DO NOTHING + UNION SELECT` (not `DO UPDATE`). The Phase 80 changes need to: (a) include `brand_id` + `family_id` in the INSERT, (b) when the conflict path returns an existing row, the existing FKs are preserved (consistent with Discretion item iii). Verify the CTE shape works correctly when the resolver returns FRESH FKs that differ from the existing row's FKs (the existing row's FKs win — silent reuse). Planner to add a test case for this.

7. **Family auto-create when brand was ALSO auto-created.** When the brand resolver auto-creates a brand AND the family resolver immediately runs scoped to that fresh brand_id, the family lookup tier 1-3 returns zero rows (brand is empty of families), so tier 4 auto-creates. Result: two `needs_review = true` rows per novel-brand extraction. CONTEXT § Specifics explicitly accepts this. Planner should add a regression test that asserts this exact behavior (one brand row + one family row, both `needs_review = true`, both attached to one catalog row).

8. **Slug field for auto-created brands — null-slug option.** Memory check: `brands.slug` is `NOT NULL UNIQUE` per migration `20260510000000`. Auto-create MUST provide a slug. If the planner wants to avoid slug-collision retry complexity (Q3), an alternative is to slug with a UUID suffix: `slug = `${slugify(name)}-${randomSuffix}`` — guarantees uniqueness, sacrifices URL prettiness for `needs_review = true` rows (which the operator will rename via Phase 82 anyway). Recommend planner pick this simpler path.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x (existing `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- catalog-resolver` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANON-01 | `brand_id` is NOT NULL after migration | integration | `npm run test -- 80-not-null-constraint` | ❌ Wave 0 |
| CANON-02 | `family_id` is NOT NULL after migration | integration | `npm run test -- 80-not-null-constraint` | ❌ Wave 0 |
| INGEST-01 | Exact brand match attaches brand_id | unit | `npm run test -- catalog-resolver` (case 1) | ❌ Wave 0 |
| INGEST-02 | Fuzzy brand match clear-gap attaches brand_id + logs event | unit | `npm run test -- catalog-resolver` (cases 2, 3) | ❌ Wave 0 |
| INGEST-03 | No-match auto-creates brand with needs_review=true | unit + integration | `npm run test -- catalog-resolver` (case 4) | ❌ Wave 0 |
| INGEST-04 | Family lookup with alias containment before fuzzy | unit + integration | `npm run test -- catalog-resolver` (cases 5, 6, 7, 8) + alias path against local DB | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- catalog-resolver` (~5 sec)
- **Per wave merge:** `npm run test` (full suite) + Local-First Verification Recipe Step 2 (manual extract proof)
- **Phase gate:** Full suite green + manual prod extract proof + NOT NULL migration applied locally before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/data/catalog-resolver.test.ts` — covers INGEST-01..04 (10 branches)
- [ ] `tests/integration/migrations/80-not-null-constraint.test.ts` — covers CANON-01, CANON-02
- [ ] `tests/integration/data/catalog-resolver-against-local-db.test.ts` — covers INGEST-04 alias path end-to-end
- [ ] Framework install: NONE — vitest already configured

## Security Domain

> Project config has `security_enforcement` absent — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Route-level `getCurrentUser()` gate already enforced (L141-148 route.ts); resolver inherits |
| V3 Session Management | no | Phase 80 has no session-affecting changes |
| V4 Access Control | yes | Resolver runs under service-role within the upsert helper; correct per existing DAL pattern (writes go through service-role) |
| V5 Input Validation | yes | Zod validation at route boundary (existing); resolver receives already-validated strings; LLM-extracted strings are length-capped (.max(200)) |
| V6 Cryptography | no | No cryptographic operations introduced |

### Known Threat Patterns for Next 16 + Drizzle + Postgres

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via Drizzle `sql` template tag | Tampering | Always use `sql\`... ${value} ...\`` parameterized form; NEVER `sql.raw(string)` with user input |
| Race condition on auto-create (concurrent INSERT same name_normalized) | Availability/Integrity | UNIQUE constraint + `ON CONFLICT DO UPDATE RETURNING id` — Postgres handles race atomically |
| Slug collision side-channel | Availability | UNIQUE constraint on `brands.slug` — catch 23505 and retry with suffix, OR use UUID suffix preemptively |
| Information disclosure via structured logs | Information Disclosure | Whitelist exact payload fields; never log full Watch object or request body |
| NOT NULL constraint vs. data violation | Availability | Defensive precondition assertion in migration; staged deploy ensures all writes attach FKs before constraint flip |

## Sources

### Primary (HIGH confidence)
- `src/data/catalog.ts` L1-244 — both upsert helpers (`upsertCatalogFromExtractedUrl`, `upsertCatalogFromUserInput`); existing `sql` template tag conventions; `sql.join` array pattern; COALESCE pattern in ON CONFLICT DO UPDATE
- `src/data/catalog.ts` L356-613 — `searchCatalogWatches`, including the `word_similarity` + `f_unaccent` fuzzy fallback tier (260623-uua) — direct precedent for fuzzy match SQL shape
- `src/app/api/extract-watch/route.ts` L138-524 — full route handler; auth gate; Zod validation; both upsert call sites (L226 + L367); `console.error` precedent (L256, L296, L379, L415)
- `src/db/schema.ts` § watchesCatalog (L431-510), § brands (L518-537), § watchFamilies (L539-563) — column types, constraints, GENERATED columns
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` L105-135 — `watches_catalog_natural_key` UNIQUE constraint definition
- `supabase/migrations/20260510000000_phase34_brands_families.sql` — `brands_name_normalized_unique`, `watch_families_brand_name_unique` constraints; `brand_id` + `family_id` FKs added as nullable
- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` — `extensions.unaccent`, `extensions.pg_trgm`, `public.f_unaccent` IMMUTABLE wrapper, functional GIN trigram indexes
- `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` — `watch_families.aliases text[]` + GIN containment index (`watch_families_aliases_gin_idx`); `needs_review` boolean on both tables
- `scripts/v8.4-brand-canonicalization.ts` L970-1191 — Phase 79 `--apply` brand + family INSERT shapes with `needs_review` semantics, alias append SQL, JOIN-scoped UPDATE; verified working reference implementation
- `tests/integration/migrations/78-gin-index.test.ts` — Phase 78 integration test pattern (postgres lib, DATABASE_URL gate, information_schema introspection) — direct template for Phase 80 NOT NULL test

### Secondary (MEDIUM confidence)
- Memory [[drizzle-supabase-db-mismatch]] — 4 prod-push gotchas; verified by Phase 78/79/quick-260623-uua precedents
- Memory [[pg-trgm-word-similarity-for-brand-typos]] — `word_similarity` semantic; verified in catalog.ts L516-528 comment block
- Memory [[supabase-extension-schema-function-pin]] — relevant ONLY for functions in indexes; Phase 80 resolver uses `word_similarity` in a QUERY (not in an index), so the pin requirement does NOT apply
- Memory [[post-flight-assertion-predicate-divergence]] — applied in the migration body's defensive precondition
- Memory [[drizzle-sql-any-array-pitfall]] — verified NOT applicable; resolver uses single-element ARRAY literals, not array spreads
- Memory [[local-first-dev]] — applied in the Local-First Verification Recipe

### Tertiary (LOW confidence)
- None. All claims in this RESEARCH.md are verified against the codebase or against shipped migrations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies in active use
- Architecture: HIGH — direct precedent in Phase 79 `--apply` (same INSERT shapes); catalog.ts fuzzy fallback tier (260623-uua) for `word_similarity` query shape
- Atomic auto-create: HIGH — `ON CONFLICT ON CONSTRAINT brands_name_normalized_unique` and `watch_families_brand_name_unique` verified in shipped migrations
- Migration plan: HIGH — Postgres `ALTER COLUMN SET NOT NULL` is documented behavior; Phase 78 + 79 prove the timestamped filename ordering convention
- Slug collision handling: MEDIUM — `slugify` exists in Phase 79 script but slug collision retry path is not yet built; flagged in Open Questions
- Test plan: HIGH — Wave 0 file paths and assertion shapes derived from Phase 78 precedent
- Local-First Verification Recipe: HIGH — recipe follows the existing pattern; the only unverified step is whether local DB has any alias-populated family for the Brut Date test (Step 0 explicitly handles this case)

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (Phase 80 is the immediate next phase — research should not age before planning)

## Assumptions Log

No `[ASSUMED]` claims in this research. Every factual assertion is verified against:
- The codebase (`src/data/catalog.ts`, `src/db/schema.ts`, `src/app/api/extract-watch/route.ts`)
- Shipped migrations (`supabase/migrations/2026*`)
- Phase 78/79 context documents and the Phase 79 `--apply` script
- Project memories with explicit citation

All decisions presented as recommendations (resolver location, slug collision handling, diacritic folding on fuzzy) are documented in Open Questions for the planner to confirm at plan-write time.
