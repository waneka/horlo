# Phase 80: NOT NULL Constraint Flip + Ingest Hardening — Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 9 (3 new src + 1 new migration + 3 new tests + 1 new doc + 3 modified)
**Analogs found:** 9 / 9 (all files have direct codebase precedent)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/data/catalog-resolver.ts` *(NEW)* | DAL helper (resolver) | SELECT + atomic INSERT/ON CONFLICT | `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` (L178–244) + `scripts/v8.4-brand-canonicalization.ts` § `applyBrandPath`/`applyFamilyPath` (L970–1191) | exact (role+flow) |
| `src/lib/slug.ts` *(NEW — extracted)* | utility (pure fn) | string → string | `scripts/v8.4-brand-canonicalization.ts` L165–167 (`slugify`) | exact (in-place precedent) |
| `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` *(NEW)* | migration (DDL — ALTER COLUMN SET NOT NULL) | DDL + DO $$ assertions | `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` (Phase 78) + `supabase/migrations/20260510000000_phase34_brands_families.sql` § final DO $$ block (L71–99) | exact (additive DDL + post-flight) |
| `tests/unit/data/catalog-resolver.test.ts` *(NEW)* | unit test (mocked db) | `vi.mock('@/db')` + branch assertions | `tests/unit/getPublicWearPicsForWatch.test.ts` (L1–80) | exact (DAL unit pattern) |
| `tests/integration/migrations/80-not-null-constraint.test.ts` *(NEW)* | integration test (introspection) | postgres lib + `information_schema` | `tests/integration/migrations/78-gin-index.test.ts` (full file) | exact (template) |
| `tests/integration/data/catalog-resolver-against-local-db.test.ts` *(NEW)* | integration test (live DB) | postgres lib + seeded brands/families | `tests/integration/migrations/78-gin-index.test.ts` + Local-First Recipe Step 2 | role-match |
| `.planning/phases/80-.../80-POST-DEPLOY.md` *(NEW)* | operator runbook | markdown | `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md` + Phase 79's POST-DEPLOY | exact (template) |
| `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` *(MODIFIED)* | DAL upsert helper | INSERT ... ON CONFLICT DO UPDATE | self (existing function — additive insertion of resolver call + 2 INSERT columns) | self |
| `src/data/catalog.ts` § `upsertCatalogFromUserInput` *(MODIFIED)* | DAL upsert helper | INSERT CTE + UNION SELECT | self (existing CTE — additive insertion of resolver call + 2 INSERT columns) | self |
| `src/db/schema.ts` § `watchesCatalog.brandId` / `.familyId` *(MODIFIED)* | Drizzle schema | column nullability | self (L504–505 nullable shape) | self |

---

## Pattern Assignments

### `src/data/catalog-resolver.ts` *(NEW — resolver module)*

**Role:** DAL helper exporting `resolveBrandId` + `resolveFamilyId`; `import 'server-only'` boundary; uses Drizzle `sql` template tag against the existing `db` client. Owns the structured `console.log` emission.

**Analog 1 — module boundary + imports + sanitizer style:** `src/data/catalog.ts` L1–11
```typescript
// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { cacheLife } from 'next/cache'

import { db } from '@/db'
import { brands, watches, watchesCatalog } from '@/db/schema'
import { and, arrayOverlaps, asc, between, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'
import type { CatalogEntry, CatalogSource, ImageSourceQuality, EraSignal, CatalogTasteAttributes } from '@/lib/types'
```

**Delta for the resolver:** trim imports to `db`, `sql` from drizzle-orm. No table imports needed (resolver uses raw SQL only against `brands` + `watch_families`). Drop `cacheLife` (resolver is per-request).

---

**Analog 2 — exact-match SELECT (brand/family Tier 1):** `src/data/catalog.ts` § `upsertCatalogFromUserInput` L143–161 (showing the `db.execute<{ id: string }>(sql\`...\`)` shape)
```typescript
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
     ...
   LIMIT 1
`)
const rows = result as unknown as Array<{ id: string }>
return rows[0]?.id ?? null
```

**Delta for Tier 1 brand:** strip the CTE; resolver Tier 1 is a plain `SELECT id, name FROM brands WHERE name_normalized = lower(trim(${rawBrand})) LIMIT 1`. The `result as unknown as Array<{...}>` cast pattern carries forward verbatim.

---

**Analog 3 — fuzzy `word_similarity` query (brand/family Tier 2 + 3):** `src/data/catalog.ts` § `searchCatalogWatches` L546–562 (the 260623-uua fuzzy fallback tier)
```typescript
.where((() => {
  const predicates = []
  predicates.push(
    sql`(word_similarity(lower(public.f_unaccent(${lowerQ})), lower(public.f_unaccent(${watchesCatalog.brand}))) > 0.2
         OR word_similarity(lower(public.f_unaccent(${lowerQ})), lower(public.f_unaccent(${watchesCatalog.model}))) > 0.2)`,
  )
  predicates.push(...buildFacetPredicates())
  return and(...predicates)
})())
.orderBy(
  desc(sql`GREATEST(
    word_similarity(lower(public.f_unaccent(${lowerQ})), lower(public.f_unaccent(${watchesCatalog.brand}))),
    word_similarity(lower(public.f_unaccent(${lowerQ})), lower(public.f_unaccent(${watchesCatalog.model})))
  )`),
  ...
)
```

**Deltas for resolver fuzzy SQL:**
- Use raw `sql\`SELECT id, name, word_similarity(...) AS score FROM brands WHERE word_similarity(...) >= 0.6 ORDER BY score DESC LIMIT 2\`` (single statement, not the query builder — keeps resolver imports lean and mirrors the upsert helpers).
- **Apply `public.f_unaccent` symmetrically per Open Question 4** (RESEARCH.md): `word_similarity(lower(public.f_unaccent(${rawBrand})), lower(public.f_unaccent(name_normalized)))`. The existing `name_normalized` GENERATED column is `lower(trim(name))` only — NOT unaccent-folded — so wrapping the column side with `public.f_unaccent(...)` at query time is required for `Héron` ↔ `Heron` parity with the search tier.
- `LIMIT 2` (not 1) to capture top + runner-up in one round-trip for the D-80-01 clear-gap check. Family Tier 3 uses `LIMIT 1` (no clear-gap rule per D-80-02).
- Threshold `0.6` (not `0.2` like search) — per D-80-01/02. Hoist to a module-level constant `BRAND_FUZZY_MIN_SCORE = 0.6` and `BRAND_FUZZY_CLEAR_GAP = 0.1`.

---

**Analog 4 — atomic auto-create (`INSERT ... ON CONFLICT ON CONSTRAINT ... DO UPDATE ... RETURNING id, (xmax=0) AS was_created`):** `scripts/v8.4-brand-canonicalization.ts` L980–984 + L1121–1124
```typescript
// Brand auto-create — Phase 79 shape (needs_review=false because operator-vetted)
const [row] = await tx`
  INSERT INTO brands (name, slug, needs_review)
  VALUES (${resolved.rawName}, ${slugify(resolved.rawName)}, false)
  RETURNING id
`
// ... and family auto-create ...
const [row] = await tx`
  INSERT INTO watch_families (brand_id, name, needs_review, aliases)
  VALUES (${brandUuid}, ${resolved.rawName}, false, '{}'::text[])
  RETURNING id
`
```

**Deltas for resolver auto-create (per RESEARCH § Atomic Auto-Create Pattern):**
- **Switch `needs_review` from `false` → `true`** — Phase 80 is the FIRST writer of `needs_review = true` (CONTEXT § Specifics + D-79-09).
- **Add `ON CONFLICT ON CONSTRAINT brands_name_normalized_unique DO UPDATE SET needs_review = brands.needs_review`** (no-op SET) so the statement is race-safe AND always returns a row. Phase 79's script ran inside a single transaction operator-confirmed against decision files — Phase 80's resolver runs per-request and MUST handle concurrent ingests of the same novel brand.
- **Add `(xmax = 0) AS was_created`** to the RETURNING clause — distinguishes INSERT (auto-create event) from UPDATE (race lost; log as `matched` decision) for the structured log emission.
- **Family auto-create uses `ON CONFLICT ON CONSTRAINT watch_families_brand_name_unique DO UPDATE SET needs_review = watch_families.needs_review`** — constraint name verified in `supabase/migrations/20260510000000_phase34_brands_families.sql` L47–50 and `src/db/schema.ts` L561.
- **Slug collision retry (Open Q3 / Q8):** wrap the brand INSERT in a try/catch on `23505` violating `brands_slug_unique`; on hit, retry once with `slug = `${slugify(rawBrand)}-${randomSuffix(6)}``. Q8 alternative: pre-emptively suffix every auto-create slug with a short random hash — simpler, sacrifices URL prettiness for `needs_review=true` rows (operator renames via Phase 82 anyway). **Recommended path: Q8 pre-emptive suffix** to avoid the retry code path entirely.

---

**Analog 5 — alias containment lookup (family Tier 2):** `scripts/v8.4-brand-canonicalization.ts` L1157–1162
```typescript
const result = (await tx`
  UPDATE watch_families
  SET aliases = aliases || ARRAY[${sourceNorm}]::text[]
  WHERE id = ${targetUuid}
    AND NOT (aliases @> ARRAY[${sourceNorm}]::text[])
`) as unknown as UpdateResult
```

**Delta for resolver family Tier 2:** invert from UPDATE-with-negative-containment to SELECT-with-positive-containment:
```sql
SELECT id, name
  FROM watch_families
 WHERE brand_id = ${resolvedBrandId}
   AND aliases @> ARRAY[lower(trim(${rawModel}))]::text[]
 ORDER BY created_at ASC
 LIMIT 1
```
- Same `ARRAY[...]::text[]` single-element literal — NOT a spread, so `[[drizzle-sql-any-array-pitfall]]` does NOT apply.
- The `lower(trim(rawModel))` normalization matches Phase 79's `sourceNorm = resolved.sourceModelRaw.toLowerCase().trim()` exactly (see canonicalization script L1155).
- GIN index `watch_families_aliases_gin_idx` (Phase 78) supports `@>` (strategy 2).

---

**Analog 6 — structured `console.log` emission (D-80-04 events):** `src/app/api/extract-watch/route.ts` L256, L296
```typescript
console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
// ...
console.error('[extract-watch] taste enrichment failed (non-fatal):', err)
```

**Delta for resolver log events:** swap `console.error` → `console.log` for non-error events, and JSON-shape the second argument explicitly:
```typescript
console.log('[extract-watch] fuzzy_brand_match', {
  input_raw: rawBrand,
  decision: 'matched',        // | 'tied_auto_create' | 'no_candidates_auto_create'
  matched_id: top.id,
  matched_name: top.name,
  score: top.score,
  runner_up_id: runnerUp?.id ?? null,
  runner_up_name: runnerUp?.name ?? null,
  runner_up_score: runnerUp?.score ?? null,
})
// family_id added to payload for family events per D-80-04
```
- Field whitelist per T-80-06 (information-disclosure mitigation): NEVER log the full Watch object or request body.
- All four event types (`fuzzy_brand_match`, `fuzzy_family_match`, `brand_auto_created`, `family_auto_created`) emit identically — same `[extract-watch] <event_type>` prefix.

---

**Expected exports / function signatures (skeleton — not full implementation):**
```typescript
// src/data/catalog-resolver.ts
import 'server-only'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { slugify } from '@/lib/slug'

export const BRAND_FUZZY_MIN_SCORE = 0.6
export const BRAND_FUZZY_CLEAR_GAP = 0.1
export const FAMILY_FUZZY_MIN_SCORE = 0.6

export type ResolveDecision =
  | { tier: 'exact'; decision: 'matched' }
  | { tier: 'alias'; decision: 'matched' }
  | { tier: 'fuzzy'; decision: 'matched'; score: number; runnerUp?: { id: string; name: string; score: number } }
  | { tier: 'auto_create'; decision: 'no_candidates_auto_create' }
  | { tier: 'auto_create'; decision: 'tied_auto_create'; runnerUp?: { id: string; name: string; score: number } }

export interface BrandResolution { brandId: string; decision: ResolveDecision }
export interface FamilyResolution { familyId: string; decision: ResolveDecision }

export async function resolveBrandId(rawBrand: string): Promise<BrandResolution>
export async function resolveFamilyId(brandId: string, rawModel: string): Promise<FamilyResolution>
```

---

### `src/lib/slug.ts` *(NEW — extracted helper)*

**Analog:** `scripts/v8.4-brand-canonicalization.ts` L160–167
```typescript
/**
 * Slug generator for new `brands.name` rows inserted by Phase 79's apply path.
 * Matches the established slug shape in the existing `brands` table (53 rows
 * inspected). 3 LOC per 79-PATTERNS.md L292-294.
 */
export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

**Delta:** move verbatim into `src/lib/slug.ts`; update the canonicalization script to import from `@/lib/slug` (or leave the script's copy alone since it's a one-shot — confirm at write time). Update the JSDoc to drop Phase 79-specific language and describe both Phase 79 + Phase 80 callsites. Per Open Q8, the resolver may additionally export `slugifyWithRandomSuffix(name: string): string` for auto-create paths to dodge the slug collision retry path.

---

### `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` *(NEW)*

**Analog 1 — file header + BEGIN/COMMIT + idempotent-by-shape:** `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` L1–38, L116–122
```sql
-- Phase 78 — Schema Additions for v8.4 Catalog Brand+Model Canonicalization
-- Requirements: CANON-03 ..., CANON-04 ...
--
-- Filename ordering: `20260624000000` sorts AFTER the most recent migration
--   `20260623200000_quick_260623_uua_search_unaccent_trgm.sql` per
--   `project_drizzle_supabase_db_mismatch` gotcha #1.
--
-- Sibling Drizzle shape mirror: drizzle/0014_phase78_aliases_needs_review.sql
--   (LOCAL ONLY ...; this hand-written SQL file is the authoritative migration
--   that ships to prod via `supabase db push --linked`).

BEGIN;
-- ...
COMMIT;
```

**Delta for Phase 80:** replicate the header verbatim with these adjustments:
- Filename `20260626000000` (verify > `20260624000000` and > any quick-task migrations shipped between Phase 78 and Phase 80 at write time — `ls supabase/migrations/`).
- Requirements line: `CANON-01 (brand_id NOT NULL), CANON-02 (family_id NOT NULL)`.
- Drop the `IF NOT EXISTS` idempotency (`ALTER COLUMN ... SET NOT NULL` is not naturally idempotent in pre-flight terms — wrap in `DO $$ ... IF is_nullable = 'YES' THEN ALTER ...` for re-run safety, OR rely on Supabase's migration ledger to skip already-applied files).
- Add the D-80-03 staged-deploy reminder block (RESEARCH § Migration Plan L319–347 has the full text).

**Analog 2 — defensive precondition (DO $$ count vs new constraint):** RESEARCH.md § Migration Plan L355–373 has the exact body. Pattern source: Phase 78 migration L69–119 (post-flight DO $$), Phase 34 migration L71–99 (final assertion block).

**Analog 3 — post-flight assertion against information_schema (per [[post-flight-assertion-predicate-divergence]]):** `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` L69–119 (the full DO $$ block introspecting `information_schema.columns` and `pg_indexes`)
```sql
DO $$
DECLARE
  brands_needs_review_default text;
  -- ...
BEGIN
  SELECT column_default INTO brands_needs_review_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'needs_review';
  -- ...
  IF brands_needs_review_default IS NULL OR brands_needs_review_default NOT LIKE 'false%' THEN
    RAISE EXCEPTION 'Phase 78 failed — brands.needs_review default not "false" (got: %)', brands_needs_review_default;
  END IF;
END $$;
```

**Delta:** Phase 80 reads `information_schema.columns.is_nullable` for `brand_id` + `family_id`, raises if anything other than `'NO'`. The pre-flight check uses a DIFFERENT predicate (`COUNT WHERE x IS NULL > 0`) so [[post-flight-assertion-predicate-divergence]] is satisfied. Full body in RESEARCH § Migration Plan L386–409.

---

### `tests/unit/data/catalog-resolver.test.ts` *(NEW)*

**Analog — DAL unit test with mocked db.execute:** `tests/unit/getPublicWearPicsForWatch.test.ts` L1–80
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// DB mock — mirrors the pattern in tests/data/getWearRailForViewer.test.ts
type Row = Record<string, unknown>
let mockRows: Row[] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(mockRows) }) }),
    }),
  },
}))

import { getPublicWearPicsForWatch } from '@/data/wearEvents'

describe('getPublicWearPicsForWatch', () => {
  beforeEach(() => { mockRows = [] })

  it('WPIC-01: returns public, non-hidden wear pic rows', async () => {
    mockRows = [{ id: 'we-1', wornDate: '2026-05-20', photoUrl: 'user-A/evt-1.jpg', hiddenFromDetail: false }]
    const result = await getPublicWearPicsForWatch(WATCH_ID)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('we-1')
  })
})
```

**Delta for resolver tests:**
- Mock the raw `db.execute<...>(sql\`...\`)` shape (not `select().from().where()` — the resolver uses raw SQL throughout). A simple queue-based mock works:
  ```typescript
  let execQueue: Array<unknown[]> = []
  vi.mock('@/db', () => ({
    db: { execute: vi.fn(() => Promise.resolve(execQueue.shift() ?? [])) }
  }))
  ```
- Stub `console.log` with `vi.spyOn(console, 'log').mockImplementation(() => {})` and assert event-emission shape per case (each fuzzy/auto-create branch must emit the expected `[extract-watch] <event_type>` log).
- 10 test cases from RESEARCH § Test Plan (cases 1–10). Each case enqueues N rows into `execQueue` matching the SQL the resolver runs in sequence (Tier 1 → Tier 2 → Tier 3 auto-create).
- For the alias path (case 6) the mock returns the alias-hit row on the SECOND `execute` call (Tier 1 returns empty, Tier 2 hits) and asserts Tier 3 is NEVER called by checking `execQueue.length === 1` after the call.

**Expected test file skeleton:**
```typescript
// @vitest-environment jsdom (default — no DB needed)
import { describe, it, expect, vi, beforeEach } from 'vitest'

let execQueue: Array<unknown[]> = []
vi.mock('@/db', () => ({
  db: { execute: vi.fn(() => Promise.resolve(execQueue.shift() ?? [])) }
}))

import { resolveBrandId, resolveFamilyId } from '@/data/catalog-resolver'

describe('Phase 80 — catalog-resolver (INGEST-01..04)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    execQueue = []
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('Brand Tier 1 (exact) — INGEST-01', async () => { /* enqueue one row, assert decision.tier === 'exact' */ })
  it('Brand Tier 2 (fuzzy clear-gap) — INGEST-02', async () => { /* enqueue empty for Tier 1, two rows score 0.85 + 0.62 for Tier 2 */ })
  it('Brand Tier 2 (ambiguous → tied_auto_create) — INGEST-02', async () => { /* gap 0.04 → fall through */ })
  it('Brand Tier 3 (auto-create) — INGEST-03', async () => { /* enqueue empty for Tier 1+2, { id, was_created: true } for Tier 3 */ })
  it('Family Tier 1 (exact) — INGEST-04', async () => {})
  it('Family Tier 2 (alias) — INGEST-04', async () => { /* Tier 3 NOT called */ })
  it('Family Tier 3 (fuzzy) — INGEST-04', async () => {})
  it('Family Tier 4 (auto-create) — INGEST-04', async () => {})
  it('Empty model_raw → placeholder family', async () => {})
  it('Re-extract idempotency', async () => {})
})
```

---

### `tests/integration/migrations/80-not-null-constraint.test.ts` *(NEW)*

**Analog — node-env integration test gated on DATABASE_URL, introspects information_schema:** `tests/integration/migrations/78-gin-index.test.ts` (full file, L1–121)
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 78 — watch_families_aliases_gin_idx + needs_review (introspection)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: ReturnType<typeof postgres>

  beforeAll(() => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })
  })

  afterAll(async () => { if (sql) await sql.end({ timeout: 5 }) })

  it('brands.needs_review column exists with default false (CANON-04)', async () => {
    const rows = await sql<{ data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'needs_review'
    `
    expect(rows.length).toBe(1)
    expect(rows[0].is_nullable).toBe('NO')
  })
})
```

**Deltas for Phase 80:**
- Add `// @vitest-environment node` pragma at the top (per memory: `[[vitest-static-node-env]]` — Vercel prebuild externalizes node:fs, jsdom default fails).
- Three test cases:
  1. `brand_id is NOT NULL in information_schema (CANON-01)` — assert `is_nullable === 'NO'` for `watches_catalog.brand_id`.
  2. `family_id is NOT NULL in information_schema (CANON-02)` — same shape for `family_id`.
  3. `INSERT with brand_id=NULL raises 23502` — `await expect(sql\`INSERT ... NULL, NULL\`).rejects.toMatchObject({ code: '23502' })` (full body in RESEARCH § Test Plan L506–512).
- Same `postgres(connStr, { max: 1, prepare: false })` connection shape — Supabase pooler requires `prepare: false`.

---

### `tests/integration/data/catalog-resolver-against-local-db.test.ts` *(NEW)*

**Analog:** `tests/integration/migrations/78-gin-index.test.ts` connection pattern + RESEARCH § Local-First Verification Recipe Step 2 SQL queries.

**Delta:** instead of introspecting schema, exercises the actual resolver against the seeded local catalog (4 users + ~205 catalog rows). At minimum 4 cases — one per branch with a real-data signal:
- Tier 1 hit: pass `'Hamilton'` → assert returned id matches `SELECT id FROM brands WHERE name_normalized = 'hamilton'` against the live local DB.
- Tier 2 clear-gap: pass `'Hamilon'` → assert returned id is the Hamilton id and `decision.score > 0.6`.
- Family alias: pre-seed alias `'brut date'` on the canonical Brut Datejust family (per Recipe Step 0 fallback SQL) then resolve `('<brut-id>', 'Brut Date')` → assert hit on Brut Datejust.
- Auto-create: pass `'Acme Chronograph Co'` → assert new brand row exists with `needs_review = true`; clean up at end of test (DELETE WHERE name = 'Acme Chronograph Co').

Use `beforeAll` to open the postgres connection AND seed the alias if missing; `afterAll` cleans up any auto-created rows so the test is re-runnable.

---

### `.planning/phases/80-.../80-POST-DEPLOY.md` *(NEW)*

**Analog:** `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md` (full file). Sections to copy verbatim and adapt:
- `# Phase 80 — Prod Deployment Record` header with date/operator/status/plan-link
- `## Deviation from Plan` (if any — D-80-03 staged deploy MIGHT roll out cleanly; if so, replace with "Plan executed as written")
- `## Verification Results (run YYYY-MM-DD)` block with the 5 SQL queries from RESEARCH § Local-First Recipe Step 5 + D-80-03 staged-deploy verification

**Delta:** prepend a D-80-03 staged-deploy preamble that records the THREE ordered steps (code deploy → manual extract proof → migration push) as separate verification rows. Plain-English tone per Open Q7 (Tyler's discussion preference).

---

### `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` *(MODIFIED — additive resolver call + 2 INSERT columns)*

**Existing shape:** L178–244 (full function, especially L198–241 INSERT/ON CONFLICT).

**Diff sketch:**
```typescript
// BEFORE — L198 (existing)
const result = await db.execute<{ id: string }>(sql`
  INSERT INTO watches_catalog (
    brand, model, reference, source,
    movement_type, ..., complications
  )
  VALUES (
    ${input.brand}, ${input.model}, ${input.reference}, 'url_extracted',
    ...
  )
  ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET
    source = ..., movement_type = COALESCE(...), ..., updated_at = now()
  RETURNING id
`)

// AFTER — Phase 80 additions only
// 1. Insert resolver calls BEFORE the existing INSERT, after sanitizers.
const { brandId } = await resolveBrandId(input.brand)
const { familyId } = await resolveFamilyId(brandId, input.model)

// 2. Add `brand_id` + `family_id` to INSERT column list:
//      ..., complications, brand_id, family_id
//    and to VALUES:
//      ..., ${toTextArraySql(safeComplications)}, ${brandId}, ${familyId}
// 3. DO NOT add brand_id/family_id to the DO UPDATE SET clause — per Discretion iii,
//    columns absent from SET are automatically left at their existing values (verified
//    in RESEARCH § Re-extract Behavior). Existing rows' FKs survive operator merges.
```

**Locked behaviors preserved:** D-13 first-non-null-wins COALESCE; D-10/D-11 source-bump-unless-admin-curated; tag-array enrich-only-if-empty (L235–238); `updated_at = now()`.

---

### `src/data/catalog.ts` § `upsertCatalogFromUserInput` *(MODIFIED — additive resolver call + restructured CTE)*

**Existing shape:** L138–164 (the CTE INSERT ... DO NOTHING + UNION SELECT idempotency pattern).

**Diff sketch:**
```typescript
// BEFORE — L143
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
     ...
   LIMIT 1
`)

// AFTER — Phase 80 additions
// 1. Resolver calls BEFORE the CTE
const { brandId } = await resolveBrandId(brand)
const { familyId } = await resolveFamilyId(brandId, model)

// 2. Add brand_id + family_id to the INSERT column list inside `ins`:
//      INSERT INTO watches_catalog (brand, model, reference, source, brand_id, family_id)
//      VALUES (${brand}, ${model}, ${reference}, 'user_promoted', ${brandId}, ${familyId})
// 3. The `DO NOTHING` stays — on conflict, the UNION SELECT side returns the
//    PRE-EXISTING row's id (and its existing brand_id/family_id are preserved
//    silently because the conflict path didn't touch them).
```

**Open Q6 verification:** when the resolver returns fresh `brandId`/`familyId` that DIFFER from the existing row's FKs (e.g. operator merged via Phase 82 between extracts), the existing row's FKs win because the CTE's `INSERT ... DO NOTHING` doesn't update on conflict. This is the desired behavior per Discretion item iii. Add a unit test asserting this.

---

### `src/db/schema.ts` § `watchesCatalog` *(MODIFIED — add `.notNull()`)*

**Existing shape:** L504–505
```typescript
brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' }),
familyId: uuid('family_id').references(() => watchFamilies.id, { onDelete: 'restrict' }),
```

**After Phase 80:**
```typescript
brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
familyId: uuid('family_id').notNull().references(() => watchFamilies.id, { onDelete: 'restrict' }),
```

**Sequencing per [[drizzle-supabase-db-mismatch]]:**
1. Edit `src/db/schema.ts` first.
2. Run `npm run db:push` LOCALLY — drizzle-kit auto-generates the local migration.
3. Hand-write the prod-portable `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` (matching the same shape).
4. Local-First verification recipe (RESEARCH § Step 0–5) BEFORE prod push.

---

## Shared Patterns

### Pattern A — Service-role DAL boundary (`server-only` + `db` client)

**Source:** `src/data/catalog.ts` L1–11
**Applies to:** `src/data/catalog-resolver.ts` (new) + every read/write inside both upsert helpers.

```typescript
import 'server-only'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
```

The route handler does NOT pass auth context down — the resolver inherits service-role from the upsert call site, which inherits from the route's `getCurrentUser()` gate (route.ts L141–148). No auth check inside the resolver itself (T-80-03 mitigation: server-only import is the trust boundary).

---

### Pattern B — `db.execute<T>(sql\`...\`)` + cast through `unknown`

**Source:** `src/data/catalog.ts` L162–163
```typescript
const result = await db.execute<{ id: string }>(sql`...`)
const rows = result as unknown as Array<{ id: string }>
return rows[0]?.id ?? null
```

**Applies to:** every SELECT inside `catalog-resolver.ts`. Drizzle's `db.execute<T>` returns a `Result<T>` shape that needs the `as unknown as Array<T>` cast in postgres.js mode. The pattern is consistent across the whole `catalog.ts` file — match it exactly.

---

### Pattern C — Drizzle `sql` template tag with parameter binding (never `sql.raw`)

**Source:** every interpolation in `src/data/catalog.ts` and `scripts/v8.4-brand-canonicalization.ts`.

**Applies to:** all resolver SQL. NEVER concatenate brand/model strings into the SQL text; ALWAYS use `${rawBrand}` etc. inside `sql\`...\``. This is the T-80-01 mitigation (SQL injection via LLM-extracted strings).

```typescript
// CORRECT
sql`SELECT id FROM brands WHERE name_normalized = lower(trim(${rawBrand}))`
// WRONG — never do this
sql.raw(`SELECT id FROM brands WHERE name_normalized = '${rawBrand}'`)
```

---

### Pattern D — Single-element ARRAY literal (NOT array spread)

**Source:** `scripts/v8.4-brand-canonicalization.ts` L1159, L1161

**Applies to:** family Tier 2 alias containment query.

```typescript
// CORRECT — single literal element, not a spread
sql`aliases @> ARRAY[${sourceNorm}]::text[]`
```

**Why:** memory `[[drizzle-sql-any-array-pitfall]]` warns against tagged-template spreads (`= ANY(${arr})`) producing Postgres ROW literals → `42809` at runtime. The resolver's `ARRAY[${value}]::text[]` is a single-element literal, NOT a spread — pitfall does not apply. The empty-array form `'{}'::text[]` (used in family auto-create VALUES) is also a literal, not a spread.

---

### Pattern E — `extensions.word_similarity` unqualified call site

**Source:** `src/data/catalog.ts` L549, L557 (search fuzzy fallback tier from 260623-uua)

**Applies to:** brand Tier 2 + family Tier 3 fuzzy queries.

```typescript
sql`word_similarity(lower(public.f_unaccent(${input})), lower(public.f_unaccent(name_normalized)))`
```

**Why this works in both local + prod:** prod has pg_trgm + unaccent in `extensions` schema, local has them in `public`. The session search_path includes `extensions` on prod by default; `word_similarity` resolves to the operator at plan time. This is NOT a function-in-index case ([[supabase-extension-schema-function-pin]] does NOT apply here — the resolver runs queries, not index builds).

`public.f_unaccent` is the IMMUTABLE wrapper installed by `20260623200000_quick_260623_uua_search_unaccent_trgm.sql` — call it as `public.f_unaccent(...)` (schema-qualified) for both environments.

---

### Pattern F — Hand-written `.sql` migration with `BEGIN; COMMIT;` + DO $$ post-flight

**Source:** every migration under `supabase/migrations/2026*` since Phase 17. Phase 78 + Phase 79 are the most recent precedents.

**Applies to:** `20260626000000_phase80_catalog_brand_family_not_null.sql`.

Three required structural pieces:
1. `BEGIN;` ... `COMMIT;` wrapper.
2. Pre-flight DO $$ block reading WHERE `brand_id IS NULL` count (semantically distinct from the ALTER per `[[post-flight-assertion-predicate-divergence]]`).
3. Post-flight DO $$ block reading `information_schema.columns.is_nullable` (also semantically distinct from a re-run of the pre-flight count).

Filename ordering per `[[drizzle-supabase-db-mismatch]]` gotcha #1: verify `20260626000000 > 20260624000000` AND `> ` any quick-task migrations between those dates at write time via `ls supabase/migrations/`.

---

### Pattern G — vitest integration test gated on DATABASE_URL with node env

**Source:** `tests/integration/migrations/78-gin-index.test.ts` L1–37

**Applies to:** both integration tests (`80-not-null-constraint.test.ts` and `catalog-resolver-against-local-db.test.ts`).

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('...', () => {
  let sql: ReturnType<typeof postgres>
  beforeAll(() => { sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) })
  afterAll(async () => { if (sql) await sql.end({ timeout: 5 }) })
  // ...
})
```

The `// @vitest-environment node` pragma is required per memory `[[vitest-static-node-env]]` — without it, Vercel's prebuild fails because node:fs is externalized. The `describe.skip` gate keeps CI green when DATABASE_URL is unset.

---

## No Analog Found

All 9 files have direct codebase precedent. Zero entries in this section.

---

## Metadata

**Analog search scope:**
- `src/data/catalog.ts` (full file — both upsert helpers + searchCatalogWatches fuzzy tier)
- `src/data/wearEvents.ts` (DAL pattern reference)
- `src/app/api/extract-watch/route.ts` (route + console.error precedent)
- `src/db/schema.ts` § watchesCatalog/brands/watchFamilies
- `scripts/v8.4-brand-canonicalization.ts` (Phase 79 INSERT/alias-append shapes + slugify)
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` (natural-key UNIQUE constraint precedent)
- `supabase/migrations/20260510000000_phase34_brands_families.sql` (brand/family table constraints + DO $$ assertion shape)
- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` (f_unaccent + pg_trgm shapes)
- `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` (additive migration template)
- `tests/integration/migrations/78-gin-index.test.ts` (integration introspection template)
- `tests/unit/getPublicWearPicsForWatch.test.ts` (DAL unit test pattern)
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md` (POST-DEPLOY template)
- `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md` (recent POST-DEPLOY precedent)

**Files scanned:** ~13 source + migration + test files (all read end-to-end or targeted-range as relevant).

**Pattern extraction date:** 2026-06-25

**Key invariants the executor must NOT violate:**
- Resolver SQL uses `sql\`... ${value} ...\`` parameter binding everywhere — never `sql.raw` with user input (T-80-01).
- `brand_id` + `family_id` are NEVER added to the `DO UPDATE SET` clause in `upsertCatalogFromExtractedUrl` (Discretion iii — existing FKs survive on conflict).
- The auto-create INSERT uses `ON CONFLICT ON CONSTRAINT <name> DO UPDATE SET <col> = <table>.<col>` (no-op SET) for race safety + always-returns-id atomicity. The constraint names are `brands_name_normalized_unique` and `watch_families_brand_name_unique` (verified against both migrations + schema.ts).
- The migration filename timestamp MUST sort after the most recent shipped migration at write time (verify `ls supabase/migrations/` — quick-task migrations between Phase 78 and Phase 80 may have shipped).
- `// @vitest-environment node` pragma is required on every integration test that uses the `postgres` lib.
- Structured log payloads NEVER include the full Watch object or request body (T-80-06) — whitelist exactly the 8 fields listed in D-80-04.
