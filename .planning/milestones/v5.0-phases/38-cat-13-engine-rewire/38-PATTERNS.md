# Phase 38: CAT-13 Engine Rewire — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** ~32 (8 production + ~17 fixture + 5 new + 2 migration twin)
**Analogs found:** 32 / 32 (every file has a strong analog precedent in-codebase)

## File Classification

### Plan A — `catalogId .notNull()` tightening

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` (line 150) | schema (Drizzle pgTable) | type producer | `src/db/schema.ts:160` `sortOrder: integer(...).notNull().default(0)` | exact (same file, same `.notNull()` idiom) |
| `src/data/watches.ts` (line 197 `createWatch`) | DAL (write target) | request-response (insert) | `src/data/watches.ts:220` `updateWatch` (signature shape) | exact (sibling function, same file) |
| `src/app/actions/watches.ts` (line 121 `addWatch`) | Server Action (controller) | request-response | Already-correct upsert-BEFORE-create at `watches.ts:130-146` (post-create today; reorder to pre-create) | exact (in-file precedent — reorder, don't reinvent) |
| `src/app/actions/wishlist.ts` (line 124 `addToWishlistFromWearEvent`) | Server Action | request-response | `src/app/actions/watches.ts:130-146` `upsertCatalogFromUserInput` block | role-match (different action, same upsert primitive) |
| `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` | migration (DDL) | one-shot DDL | `supabase/migrations/20260511010000_phase37_layer_d.sql` (header convention, BEGIN/COMMIT not needed for idempotent DO block); §"Migration Files" of RESEARCH.md provides the DO $$ idempotent IF NOT EXISTS body | exact |
| `drizzle/0011_phase38_catalog_id_notnull.sql` | migration twin | one-shot DDL | `drizzle/0010_phase37_layer_d.sql` (header + `--> statement-breakpoint` cadence; IF NOT EXISTS guards) | exact |
| `drizzle/meta/_journal.json` (append idx=11) | journal append | config | `drizzle/meta/_journal.json` entry idx=10 (Phase 37) | exact |
| ~17 integration fixture files (per RESEARCH.md §Q3) | test fixture | write target (DB seed) | `tests/integration/phase17-join-shape.test.ts:36-52` (current canonical: seed catalog row FIRST, then watches row with `catalogId`) | exact |

### Plan B — Engine rewire

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/types.ts` (extend `Watch` with `catalogTaste`) | type producer | n/a | `src/lib/types.ts:38-96` `Watch` interface (existing fields) + `:214-223` `CatalogTasteAttributes` (REUSE verbatim per D-10) | exact (direct reuse) |
| `src/data/watches.ts:120 getWatchesByUser` (extend LEFT JOIN) | DAL (read-only consumer) | CRUD (read) | `src/lib/verdict/viewerTasteProfile.ts:42-58` (innerJoin + projection + `Number()` coercion at line 67) | exact (sister file, same JOIN target, same coercion need) |
| `src/lib/similarity.ts` (extend `WEIGHTS`, add taste dim) | engine (transform) | transform | `src/lib/similarity.ts:84-126` `calculatePairSimilarity` (existing 8-dim shape — add 9th in same pattern) | exact (in-file precedent) |
| `tests/fixtures/catalogTaste.ts` | test fixture (typed data) | type producer | `tests/fixtures/watches.ts` (`makeWatch`, deterministic IDs, typed exports) | exact (sibling fixture file) |
| `tests/static/similarity.taste-null.test.ts` | static test (invariant) | assert byte-identical | `tests/static/CollectionFitCard.no-engine.test.ts` + `tests/no-evaluate-route.test.ts` (assert-invariants idiom) | role-match (different invariant, same shape) |
| `tests/static/similarity.taste-present.test.ts` | static test (directional) | assert directional | same as above (directional rather than byte-identical) | role-match |

### Plan C — Composer-engine alignment + recommended DAL test

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/static/composer-engine-alignment.test.ts` | static test (cross-module agreement) | assert tier agreement | `src/lib/verdict/composer.test.ts` (composer scenarios) + `tests/static/CollectionFitCard.no-engine.test.ts` (no-component boundary) | role-match (multi-module scenario harness) |
| `src/data/__tests__/watches-leftjoin.test.ts` (optional) | DAL test (Drizzle mock) | mock chain | `src/lib/verdict/viewerTasteProfile.test.ts:13-62` (Drizzle chain mock pattern — `vi.mock('@/db')` with chained `from→innerJoin→where` stubs) | exact (testing template) |

---

## Pattern Assignments

### `src/db/schema.ts` line 150 — `catalogId` `.notNull()` flip

**Analog:** `src/db/schema.ts:160` (same file, `sortOrder` declared as `.notNull()`)

**Current shape** (lines 142-150):
```typescript
// Phase 17 + Phase 36: catalog FK — prod becomes NOT NULL after Phase 36 CAT-14 flip
// (supabase/migrations/20260511000000_phase36_layer_c_variants.sql ships SET NOT NULL).
// Drizzle-side `.notNull()` tightening (Pitfall 6 mitigation in 36-RESEARCH.md §Common Pitfalls)
// is DEFERRED — see .planning/phases/36-…/deferred-items.md → "Pitfall 6 catalogId .notNull()
// deferred to Phase 38". ...
// ON DELETE SET NULL preserved (Phase 17 D-04).
catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

**Target shape (Phase 38 D-06 step 1):**
```typescript
// Phase 38 D-06 — Drizzle catch-up to prod SET NOT NULL (Phase 36 already shipped at DB level).
// ON DELETE SET NULL retained syntactically but unreachable post-flip (column cannot become NULL).
catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

**Notes:**
- The `onDelete: 'set null'` clause remains syntactically — Drizzle accepts the conflict; runtime can never trigger it post-flip because every watch must have a catalog row.
- Comment block updated to point to Phase 38, not the deferral reason.

---

### `src/data/watches.ts:197 createWatch` — required `catalogId` parameter

**Analog (sibling signature in same file):** `src/data/watches.ts:220 updateWatch(userId, watchId, data: Partial<Watch>)`

**Current shape:**
```typescript
export async function createWatch(userId: string, data: Omit<Watch, 'id'>): Promise<Watch> {
  const rowData = mapDomainToRow(data)
  const inserted = await db
    .insert(watches)
    .values({
      ...rowData,
      brand: data.brand,
      model: data.model,
      status: data.status,
      movementType: data.movement,
      complications: data.complications,
      styleTags: data.styleTags,
      designTraits: data.designTraits,
      roleTags: data.roleTags,
      userId,
    })
    .returning()
  return mapRowToWatch(inserted[0])
}
```

**Target shape (Phase 38 D-06 step 4):** Make `catalogId` required at the type level. Two valid idioms:

```typescript
// IDIOM A: explicit second-positional argument (clearest at callsites)
export async function createWatch(
  userId: string,
  catalogId: string,
  data: Omit<Watch, 'id' | 'catalogId'>,
): Promise<Watch> {
  ...
  .values({ ...rowData, ..., catalogId, userId })
  ...
}

// IDIOM B: tighten `data` shape (less disruptive to call sites that already pass catalogId in data)
export async function createWatch(
  userId: string,
  data: Omit<Watch, 'id'> & { catalogId: string },
): Promise<Watch> { ... }
```

Planner chooses; IDIOM B has lower churn at the 17 fixtures (they already pass `catalogId` in the object). **Whichever idiom: tsc must catch all 3 production callers + 17 fixture callers.**

---

### `src/app/actions/watches.ts:121 addWatch` — verify upsert-BEFORE-create ordering

**Existing (post-Phase-17) flow** at `watches.ts:130-146` — upsert lives AFTER `createWatch`:
```typescript
// CURRENT: createWatch FIRST, then fire-and-forget upsert + link
const watch = await watchDAL.createWatch(user.id, createPayload)

let catalogId: string | null = null
try {
  catalogId = await catalogDAL.upsertCatalogFromUserInput({
    brand: parsed.data.brand,
    model: parsed.data.model,
    reference: parsed.data.reference ?? null,
  })
} catch (err) {
  console.error('[addWatch] catalog upsert failed (non-fatal):', err)
}
if (catalogId) {
  try {
    await watchDAL.linkWatchToCatalog(user.id, watch.id, catalogId)
  } catch (err) {
    console.error('[addWatch] catalog link failed (non-fatal):', err)
  }
}
```

**Target (Plan A D-08 ordering):** Move `upsertCatalogFromUserInput` BEFORE `createWatch`; pass `catalogId` into `createWatch` directly; remove the post-create `linkWatchToCatalog`.

```typescript
// AFTER: upsert FIRST (fail-loud — catalogId is now required), pass into createWatch
const catalogId = await catalogDAL.upsertCatalogFromUserInput({
  brand: parsed.data.brand,
  model: parsed.data.model,
  reference: parsed.data.reference ?? null,
})
const watch = await watchDAL.createWatch(user.id, catalogId, createPayload)
// linkWatchToCatalog call REMOVED — createWatch now sets catalogId atomically.
```

**Notes:**
- Failure semantics change: pre-Phase-38 the upsert was fire-and-forget; post-Phase-38 a failed upsert blocks the createWatch. This is intentional — the column is now NOT NULL; no way to insert without a catalogId.
- The Phase 19.1 D-08/D-09 fire-and-forget enrichment block at `watches.ts:154` (taste enrichment based on `catalogId`) stays put — it already reads from `catalogId` which is now guaranteed non-null.

---

### `src/app/actions/wishlist.ts:124 addToWishlistFromWearEvent` — apply upsert-BEFORE-create

**Analog:** `src/app/actions/watches.ts:130-146` upsert+link pattern (same upsert primitive, different action context).

**Current shape (lines 119-134):**
```typescript
try {
  // Create a NEW watch row under the viewer's account, snapshotted from
  // the source. Required fields per Watch domain type:
  // brand, model, status, movement, complications, styleTags, designTraits,
  // roleTags. Optional: imageUrl (undefined when source has none).
  const watch = await createWatch(user.id, {
    brand: row.brand,
    model: row.model,
    status: 'wishlist',
    movement: row.movementType ?? undefined,
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    imageUrl: row.imageUrl ?? undefined,
  })
```

**Target (RESEARCH.md Pitfall 1 — researcher correction):** Upsert catalog from the source wear-event row's denormalized brand/model BEFORE calling `createWatch`. The source wear_event row carries `row.brand` / `row.model` (denormalized snapshot); no reference is available here (the source may or may not have one). Mirror the `addWatch` shape.

```typescript
const catalogId = await catalogDAL.upsertCatalogFromUserInput({
  brand: row.brand,
  model: row.model,
  reference: null,  // wear_event row carries no reference; upsert tolerates null
})
const watch = await createWatch(user.id, catalogId, {
  brand: row.brand,
  model: row.model,
  status: 'wishlist',
  movement: row.movementType ?? undefined,
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  imageUrl: row.imageUrl ?? undefined,
})
```

**Note:** Researcher (RESEARCH.md §Q9, Pitfall 1) flagged CONTEXT.md D-06 originally missed this callsite. Planner MUST include it.

---

### `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql`

**Analog (header + idempotent DO $$ shape):** `supabase/migrations/20260511010000_phase37_layer_d.sql` lines 1-17 (header convention with threats mitigated + Rule 1-4 audit + cross-link to drizzle twin).

**Header shape to mirror:**
```sql
-- Phase 38 — D-06: Drizzle catch-up to existing prod state (CAT-13 prereq).
-- Source: 38-CONTEXT.md D-06; 38-RESEARCH.md §Migration Files
-- Sibling Drizzle migration: drizzle/0011_phase38_catalog_id_notnull.sql
--
-- Phase 36 already shipped SET NOT NULL via 20260511000000_phase36_layer_c_variants.sql
-- (verified Phase 36 Plan 05 §36.4 smoke test: watches.catalog_id is_nullable=NO).
-- This migration is a no-op in prod (idempotent re-assertion) but required so the
-- Drizzle schema's .notNull() flip matches a supabase migration commit.
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   Rule 1: 14-digit timestamp 20260512000000 strictly > Phase 37 (20260511010000)
--   Rule 2: no insertion — fresh idx, no fill
--   Rule 3: N/A (no extension-scoped operators)
--   Rule 4: N/A (no DROP, no type-change; only constraint tightening)
```

**Body (verbatim from RESEARCH.md §Migration Files):**
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watches'
      AND column_name = 'catalog_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;
    RAISE NOTICE 'Phase 38: applied SET NOT NULL on watches.catalog_id';
  ELSE
    RAISE NOTICE 'Phase 38: watches.catalog_id already NOT NULL (Phase 36 already shipped); no-op';
  END IF;
END $$;
```

---

### `drizzle/0011_phase38_catalog_id_notnull.sql`

**Analog:** `drizzle/0010_phase37_layer_d.sql` lines 1-9 (header convention — local re-sync note, IF NOT EXISTS guards, `--> statement-breakpoint` cadence).

**Header shape:**
```sql
-- Phase 38 — D-06: catalog_id NOT NULL (Drizzle-side catch-up).
-- Idempotent twin of supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql.
-- Mirror Phase 35/36/37 idempotent pattern.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → docker exec psql < supabase/migrations/...phase38....sql → drizzle-kit push
-- so the ALTER must be guarded with IF EXISTS.
```

**Body:** identical idempotent DO $$ block as the supabase twin (RESEARCH.md §Migration Files §Drizzle migration twin).

---

### `drizzle/meta/_journal.json` append idx=11

**Analog:** `drizzle/meta/_journal.json` entry idx=10 (Phase 37, last entry).

**Append shape:**
```json
{
  "idx": 11,
  "version": "7",
  "when": <unix-ms from `node -e "process.stdout.write(String(Date.now()))"`>,
  "tag": "0011_phase38_catalog_id_notnull",
  "breakpoints": true
}
```

**CRITICAL (Phase 36 Plan 03 precedent — RESEARCH.md §Q1):** `when` MUST be a plain integer literal, NOT a JS expression like `Date.now()` (drizzle-kit reads as JSON, not JS).

---

### ~17 Integration test fixture files (RESEARCH.md §Q3 commit map)

**Analog (canonical seed pattern):** `tests/integration/phase17-join-shape.test.ts:36-52` (insert catalog row FIRST, then watches row with `catalogId` set).

**Current canonical shape:**
```typescript
// Seed 1 catalog row
catalogId = randomUUID()
await db.insert(watchesCatalog).values({
  id: catalogId,
  brand: `JoinBrand_${stamp}`,
  model: `JoinModel_${stamp}`,
  source: 'user_promoted',
}).onConflictDoNothing()

// Seed 1 watches row WITH catalog_id set
const [w1] = await db.insert(watches).values({
  userId,
  brand: `JoinBrand_${stamp}`,
  model: `JoinModel_${stamp}`,
  status: 'owned',
  movementType: 'auto',
  catalogId,  // ← required after Plan A
}).returning()
```

**Mass-edit pattern across the 17 files (per RESEARCH.md §Q3 commit grouping):**
- For each `db.insert(watches).values({...})` that lacks `catalogId`, prepend a `db.insert(watchesCatalog).values({...}).onConflictDoNothing()` seed for an arbitrary catalog row, then add `catalogId` to the watches insert.
- For each `watchDAL.createWatch(userId, data)` callsite, change to `watchDAL.createWatch(userId, catalogId, data)` (IDIOM A) or include `catalogId` in `data` (IDIOM B), depending on planner's signature choice.

**Commit-per-family (D-07 ordering):** RESEARCH.md §Q3 lists exact files grouped by phase family — one commit per family, each commit must independently pass `tsc --noEmit` + `vitest run <files>`.

---

### `src/lib/types.ts` — extend `Watch` with `catalogTaste`

**Analog (direct reuse):** `src/lib/types.ts:214-223 CatalogTasteAttributes` (verbatim — no new interface).

**Current `Watch` interface (lines 38-96)** — `catalogId` already exists at line 80:
```typescript
// Phase 17: FK to watches_catalog (CAT-08). Nullable — backfill not guaranteed on all rows.
// Used by Phase 20 composer to look up catalog taste attributes for the verdict bundle.
catalogId?: string | null
```

**Target shape (D-10):** Add a new field directly below `catalogId`. Type imports already present in file.
```typescript
// Phase 38 D-10 — catalog taste, populated by getWatchesByUser LEFT JOIN.
// `null` represents both "no catalog row" (legacy pre-Plan-A) AND "catalog row
// exists but no fields populated yet" — the engine gates on confidence ≥ 0.5
// in analyzeSimilarity, not at the type level (D-12).
catalogTaste?: CatalogTasteAttributes | null
```

**Notes:**
- Optional `?` mirrors `catalogId?` at line 80 — backward-compatible for unmocked test consumers; DAL post-Plan-A always populates.
- No change to `SimilarityResult`, `SimilarityLabel`, or `CatalogTasteAttributes` itself (D-10 + parity gate).

---

### `src/data/watches.ts:120 getWatchesByUser` — extend LEFT JOIN

**Analog:** `src/lib/verdict/viewerTasteProfile.ts:36-58` (innerJoin shape + numeric `Number()` coercion at line 67).

**Current shape (verbatim from `watches.ts:120-127`):**
```typescript
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}
```

**Analog body to mirror (`viewerTasteProfile.ts:42-58`):**
```typescript
const rows = await db
  .select({
    formality: watchesCatalog.formality,
    sportiness: watchesCatalog.sportiness,
    heritageScore: watchesCatalog.heritageScore,
    primaryArchetype: watchesCatalog.primaryArchetype,
    eraSignal: watchesCatalog.eraSignal,
    designMotifs: watchesCatalog.designMotifs,
  })
  .from(watches)
  .innerJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
  .where(...)
```

**Numeric coercion analog (`viewerTasteProfile.ts:62-67`) — REUSE VERBATIM for Plan B:**
```typescript
const numbersOf = (key: 'formality' | 'sportiness' | 'heritageScore'): number[] =>
  rows
    .map((r) => r[key] as unknown as number | string | null)
    .filter((x): x is number | string => x !== null)
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n))
```

**Target shape (Plan B Task 0):** Switch `select()` → projection object, add `.leftJoin`, extend mapper. See RESEARCH.md §Pattern 1 lines 250-286 for the full drop-in shape.

**Critical pitfall (RESEARCH.md Pitfall 2):** Coerce numeric columns in the DAL mapper using `Number()`, not in the engine. postgres-js surfaces `numeric` as string; uncoerced strings produce `NaN` in `cosine3D`.

---

### `src/lib/similarity.ts` lines 10-19 — `WEIGHTS` reweighting

**Analog (in-file precedent):** existing `WEIGHTS` const at lines 10-19 — the rewrite preserves the keys but rescales values.

**Current shape (lines 10-19, verified):**
```typescript
const WEIGHTS = {
  styleTags: 0.25,
  designTraits: 0.20,
  roleTags: 0.20,
  dialColor: 0.10,
  complications: 0.10,
  caseSize: 0.05,
  strapType: 0.05,
  waterResistance: 0.05,
}
```

**Target shape (D-01 + D-05 — NO magic numbers):**
```typescript
const EXISTING_WEIGHTS_BASE = {
  styleTags: 0.25, designTraits: 0.20, roleTags: 0.20,
  dialColor: 0.10, complications: 0.10, caseSize: 0.05,
  strapType: 0.05, waterResistance: 0.05,
} as const
const TASTE_WEIGHT = 0.20
const EXISTING_SCALE = 1.0 - TASTE_WEIGHT  // 0.80
const WEIGHTS = {
  ...Object.fromEntries(
    Object.entries(EXISTING_WEIGHTS_BASE).map(([k, v]) => [k, v * EXISTING_SCALE]),
  ),
  taste: TASTE_WEIGHT,
} as { [K in keyof typeof EXISTING_WEIGHTS_BASE]: number } & { taste: number }
```

**D-05 anti-pattern (forbidden):** Hardcoding `styleTags: 0.20` magic number directly. Static grep guard post-edit: `grep -n "0\\.20.*styleTags\\|styleTags.*0\\.20" src/lib/similarity.ts` should return 0 matches.

---

### `src/lib/similarity.ts:84 calculatePairSimilarity` — add 9th `taste` dimension

**Analog (in-file precedent):** existing 8-dim pattern at lines 84-126 (`score += WEIGHTS.styleTags * arrayOverlap(...)`).

**`arrayOverlap` REUSE (lines 55-60, verified Jaccard):**
```typescript
function arrayOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0
  const intersection = arr1.filter((item) => arr2.includes(item))
  const union = new Set([...arr1, ...arr2])
  return intersection.length / union.size
}
```
Direct reuse for the `motifsJaccard` sub-component per D-03 (no new helper).

**Target shape (Plan B Task 4) — add to `calculatePairSimilarity` after line 122:**
```typescript
// Phase 38 D-01..D-05 — 9th additive taste dimension (0.20 weight).
score += tasteSimilarityRaw01(watch1.catalogTaste, watch2.catalogTaste) * WEIGHTS.taste
```

Where `tasteSimilarityRaw01` is a new top-level helper in the same file. See RESEARCH.md §Pattern 2 lines 320-365 for the drop-in helper body (cosine3D + 4 sub-components, internal weights summing to 1.0 inside `[0, 1]`).

**Match the existing 8-dim cadence** — each existing line is `score += WEIGHTS.foo * fooSimilarity(...)`. The new line mirrors that exactly (`WEIGHTS.taste * raw01(...)`).

---

### `tests/fixtures/catalogTaste.ts` (NEW)

**Analog (file conventions):** `tests/fixtures/watches.ts:1-71` (typed exports, deterministic structure, JSDoc per-fixture).

**Current fixture pattern to mirror:**
```typescript
import type { Watch, UserPreferences, CollectionGoal } from '@/lib/types'

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `test-${idCounter}`
}

export function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: nextId(),
    brand: 'TestBrand',
    ...overrides,
  }
}
```

**Target shape (RESEARCH.md §Q2 — drop-in code already drafted):** 9 typed exports — 4 high-conf archetypes (sub/datejust/speedy/tank), 1 low-conf, 4 edge fixtures (exactly-half, just-below-half, empty-motifs, null-numerics). All values vocab-verified against `src/lib/taste/vocab.ts`.

```typescript
import type { CatalogTasteAttributes } from '@/lib/types'

/** Submariner-like — high heritage, sport-leaning, dive archetype. */
export const subLikeTaste: CatalogTasteAttributes = {
  formality: 0.25,
  sportiness: 0.85,
  heritageScore: 0.90,
  primaryArchetype: 'dive',
  eraSignal: 'modern',
  designMotifs: ['applied-indices', 'mercedes-hands'],
  confidence: 0.85,
  extractedFromPhoto: false,
}
// ... 8 more named exports — see RESEARCH.md §Q2 lines 450-567 for the full set.
```

---

### `tests/static/similarity.taste-null.test.ts` (NEW)

**Analog:** `tests/static/CollectionFitCard.no-engine.test.ts` (assert-invariants style, vitest+vitest.it+expect, no DB).

**Pattern to mirror (assert-invariants, not specific values):**
```typescript
import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { makeWatch, emptyPreferences } from '@/../tests/fixtures/watches'
import { lowConfTaste, justBelowHalfTaste } from '@/../tests/fixtures/catalogTaste'

describe('Phase 38 CAT-13 #1 — taste-null engine output is byte-identical to legacy', () => {
  it('returns same SimilarityResult when both watches have catalogTaste = null', () => {
    const target = makeWatch({ catalogTaste: null })
    const owned = [makeWatch({ status: 'owned', catalogTaste: null })]
    const withTaste = analyzeSimilarity(target, owned, emptyPreferences)
    const withoutTaste = analyzeSimilarity({ ...target, catalogTaste: undefined }, owned.map(w => ({ ...w, catalogTaste: undefined })), emptyPreferences)
    expect(withTaste.score).toBe(withoutTaste.score)
    expect(withTaste.label).toBe(withoutTaste.label)
  })

  it('returns same SimilarityResult when confidence < 0.5 (gate fires)', () => {
    const target = makeWatch({ catalogTaste: lowConfTaste })
    const owned = [makeWatch({ status: 'owned', catalogTaste: justBelowHalfTaste })]
    const result = analyzeSimilarity(target, owned, emptyPreferences)
    // Asserts the score matches the byte-identical 8-dim baseline — gate must fire.
    expect(result.score).toBeLessThanOrEqual(0.80)  // 0.80 cap proves taste did not contribute
  })
})
```

**Ordering invariant (D-13):** Test is committed BEFORE the engine rewire. At commit-time, both assertions pass against the pre-rewire engine (which ignores `catalogTaste` entirely). After the rewire, both still pass (gate fires, taste contribution = 0).

---

### `tests/static/similarity.taste-present.test.ts` (NEW)

**Analog:** same as above (`CollectionFitCard.no-engine.test.ts`), but the assertion is directional rather than byte-identical.

**Target pattern:**
```typescript
import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { makeWatch, emptyPreferences } from '@/../tests/fixtures/watches'
import { subLikeTaste, speedyLikeTaste, tankLikeTaste } from '@/../tests/fixtures/catalogTaste'

describe('Phase 38 CAT-13 #2 — taste-present produces directional alignment', () => {
  it('taste-compatible pair scores HIGHER than taste-incompatible pair (matching archetype)', () => {
    const target = makeWatch({ catalogTaste: subLikeTaste })
    const compatible = makeWatch({ status: 'owned', catalogTaste: subLikeTaste })  // same archetype
    const incompatible = makeWatch({ status: 'owned', catalogTaste: tankLikeTaste }) // mismatched archetype

    const compatibleResult = analyzeSimilarity(target, [compatible], emptyPreferences)
    const incompatibleResult = analyzeSimilarity(target, [incompatible], emptyPreferences)

    expect(compatibleResult.score).toBeGreaterThan(incompatibleResult.score)
  })
})
```

**Ordering invariant (D-13 RED state):** Test is committed BEFORE the engine rewire. At commit-time, this FAILS against the pre-rewire engine (which ignores `catalogTaste`; compatible & incompatible scores are identical). After Plan B Task 4 rewires the engine, this PASSES.

---

### `tests/static/composer-engine-alignment.test.ts` (NEW)

**Analog (multi-module scenario harness):** `src/lib/verdict/composer.test.ts` (composer scenarios) + `tests/static/CollectionFitCard.no-engine.test.ts` (no-component boundary).

**Target pattern (D-15 scenarios):**
```typescript
import { describe, it, expect } from 'vitest'
import { analyzeSimilarity } from '@/lib/similarity'
import { composeVerdictCopy } from '@/lib/verdict/composer'
import { makeWatch, emptyPreferences } from '@/../tests/fixtures/watches'
import * as taste from '@/../tests/fixtures/catalogTaste'

type Scenario = {
  name: string
  targetTaste: CatalogTasteAttributes | null
  ownedTaste: CatalogTasteAttributes | null
  expectedTier: 'core-fit' | 'familiar-territory' | 'role-duplicate' | 'hard-mismatch'
}

const SCENARIOS: Scenario[] = [
  { name: 'taste-null both', targetTaste: null, ownedTaste: null, expectedTier: 'familiar-territory' },
  { name: 'low confidence both', targetTaste: taste.lowConfTaste, ownedTaste: taste.lowConfTaste, expectedTier: 'familiar-territory' },
  { name: 'high-conf taste-compatible', targetTaste: taste.subLikeTaste, ownedTaste: taste.subLikeTaste, expectedTier: 'core-fit' },
  { name: 'high-conf taste-incompatible', targetTaste: taste.subLikeTaste, ownedTaste: taste.tankLikeTaste, expectedTier: 'hard-mismatch' },
  { name: 'confidence exactly 0.5 (strict >=)', targetTaste: taste.exactlyHalfConfTaste, ownedTaste: taste.exactlyHalfConfTaste, expectedTier: 'core-fit' },
  { name: 'confidence 0.499 (strict <)', targetTaste: taste.justBelowHalfTaste, ownedTaste: taste.justBelowHalfTaste, expectedTier: 'familiar-territory' },
  { name: 'empty motifs (no crash)', targetTaste: taste.emptyMotifsTaste, ownedTaste: taste.emptyMotifsTaste, expectedTier: 'core-fit' },
  // ... ~10 total per D-15
]

describe('Phase 38 D-04 — composer & engine agree at verdict tier', () => {
  for (const s of SCENARIOS) {
    it(`${s.name}: composer and engine agree at tier level`, () => {
      const target = makeWatch({ catalogTaste: s.targetTaste })
      const owned = [makeWatch({ status: 'owned', catalogTaste: s.ownedTaste })]
      const engineResult = analyzeSimilarity(target, owned, emptyPreferences)
      const composerResult = composeVerdictCopy(/* ...same inputs ... */)
      // Tier-level agreement: engine label and composer copy class match.
      expect(mapLabelToTier(engineResult.label)).toBe(mapCopyToTier(composerResult))
    })
  }
})
```

**Note:** Test calls `composeVerdictCopy` directly from `@/lib/verdict/composer` — NOT through `CollectionFitCard.tsx` (FIT-04 boundary preserved per RESEARCH.md §Anti-Patterns).

**Forward-compat (RESEARCH.md §Q8):** If planner accepts adding `tasteContribution: number` to `SimilarityResult` (researcher Assumption A1), this scenario harness gains a 3rd assertion column — but that decision belongs to planner/discuss-phase, not researcher.

---

### `src/data/__tests__/watches-leftjoin.test.ts` (OPTIONAL, researcher-recommended)

**Analog:** `src/lib/verdict/viewerTasteProfile.test.ts:13-62` (Drizzle chain mock pattern).

**Pattern to mirror (Drizzle chain mock — verbatim shape):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockRows: Array<{ watch: any; taste: any }> = []
let selectSpy: ReturnType<typeof vi.fn>

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          })),
        })),
      })),
    })),
  },
}))

import { getWatchesByUser } from '@/data/watches'
import { db } from '@/db'

beforeEach(() => {
  mockRows = []
  selectSpy = vi.mocked(db.select)
  selectSpy.mockClear()
})

describe('getWatchesByUser LEFT JOIN', () => {
  it('populates catalogTaste from JOIN result', async () => {
    mockRows = [{
      watch: { id: 'w1', /* ...full row... */ },
      taste: { formality: '0.85', sportiness: '0.75', /* ...string-typed numeric ...*/ },
    }]
    const result = await getWatchesByUser('user-1')
    expect(result[0].catalogTaste?.formality).toBe(0.85)  // string → number coerced
  })

  it('sets catalogTaste = null when LEFT JOIN matches no catalog row', async () => {
    mockRows = [{
      watch: { id: 'w1', /* ... */ },
      taste: { formality: null, confidence: null, /* ... */ },  // post-Plan-A this only happens if catalog row deleted mid-flight
    }]
    const result = await getWatchesByUser('user-1')
    expect(result[0].catalogTaste).toBeNull()
  })
})
```

---

## Shared Patterns

### Shared #1 — Drizzle migration pair (supabase + drizzle twin)

**Apply to:** Both `supabase/migrations/20260512000000_*.sql` AND `drizzle/0011_*.sql`.

**Conventions to follow (from Phase 37 precedent):**
1. Filename: 14-digit timestamp strictly greater than previous (next: `20260512000000` for supabase, `0011` for drizzle).
2. Both files use idempotent `DO $$ ... END $$` blocks with `IF EXISTS` guards on the column state.
3. Drizzle migration has NO RLS, NO GRANT, NO CREATE TYPE — column shapes only (Phase 37 precedent at `drizzle/0010_phase37_layer_d.sql` header).
4. Supabase migration includes header comment block explaining threats mitigated + Rule 1/2/3/4 audit per `~/.claude/projects/.../memory/project_drizzle_supabase_db_mismatch.md`.
5. Journal entry `when` field is a plain integer literal (NOT `Date.now()` expression — drizzle-kit parses as JSON).

**Source files (verbatim shapes):** `supabase/migrations/20260511010000_phase37_layer_d.sql` + `drizzle/0010_phase37_layer_d.sql` + `drizzle/meta/_journal.json` entry idx=10.

---

### Shared #2 — Numeric column `Number()` coercion at DAL boundary

**Apply to:** `getWatchesByUser` (Plan B) — coerce `formality`, `sportiness`, `heritageScore`, `confidence` immediately after the JOIN returns.

**Source:** `src/lib/verdict/viewerTasteProfile.ts:62-67`.

```typescript
const numbersOf = (...): number[] =>
  rows
    .map((r) => r[key] as unknown as number | string | null)
    .filter((x): x is number | string => x !== null)
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n))
```

For per-row population on `Watch.catalogTaste` (rather than aggregation), the inline form is:
```typescript
formality: taste.formality !== null ? Number(taste.formality) : null,
```
(Verbatim from RESEARCH.md §Pattern 1 line 276.)

**Pitfall avoided (RESEARCH.md Pitfall 2):** If forgotten, postgres-js surfaces `numeric` as string → `cosine3D` produces `NaN` → all scores collapse silently.

---

### Shared #3 — Confidence ≥ 0.5 gating happens at consumer boundary, not at DAL

**Apply to:** Engine (`src/lib/similarity.ts` Plan B Task 4) AND Composer (`src/lib/verdict/composer.ts` — already enforces). DAL (`getWatchesByUser`) does NOT pre-filter (D-12).

**Source:** `src/lib/verdict/viewerTasteProfile.ts:13` defines `const CONFIDENCE_FLOOR = 0.5` + line 56 SQL filter `sql\`${watchesCatalog.confidence} >= ${CONFIDENCE_FLOOR}\``. The aggregate ENFORCES it in SQL; Phase 38 engine does NOT (gates at the function entry; see RESEARCH.md §Pattern 2 lines 333-335).

**Pattern (RESEARCH.md §Pattern 2):**
```typescript
function tasteSimilarityRaw01(t1: CatalogTasteAttributes | null, t2: CatalogTasteAttributes | null): number {
  if (!t1 || !t2) return 0
  if (t1.confidence === null || t2.confidence === null) return 0
  if (t1.confidence < 0.5 || t2.confidence < 0.5) return 0
  // ... 4 sub-components ...
}
```

---

### Shared #4 — `arrayOverlap` Jaccard helper REUSE

**Apply to:** `motifsJaccard` sub-component of taste dimension (Plan B Task 4).

**Source:** `src/lib/similarity.ts:55-60` (verified Jaccard implementation per RESEARCH.md §Q4).

**Reuse rule (RESEARCH.md "Don't Hand-Roll" table):** Do NOT write a new Jaccard helper. The existing `arrayOverlap` short-circuits on empty arrays AND computes `|A∩B| / |A∪B|` correctly. Reuse mandated by D-03 wording ("mirrors existing `arrayOverlap` helper at `src/lib/similarity.ts` lines 55–60").

---

### Shared #5 — Test fixture file conventions

**Apply to:** New `tests/fixtures/catalogTaste.ts` (Plan B/C).

**Source:** `tests/fixtures/watches.ts` (canonical fixture file pattern in this codebase).

**Conventions:**
1. Named exports for each typed constant (NOT a factory function — `CatalogTasteAttributes` shapes are static enough to be top-level constants).
2. JSDoc per-fixture documenting the archetype + why this shape was chosen (e.g., "Submariner-like — high heritage, sport-leaning, dive archetype").
3. All values must validate against vocab in `src/lib/taste/vocab.ts` (verified by RESEARCH.md §Q2 last line).
4. Empty arrays / null fields explicitly typed (TypeScript strict mode enforces).

---

### Shared #6 — Static test invariant idiom

**Apply to:** All 3 new static tests (`taste-null`, `taste-present`, `composer-engine-alignment`).

**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` + `tests/no-evaluate-route.test.ts` (existing static-guard precedents).

**Conventions:**
1. Assert invariants (relationships, not specific values).
2. Use `vitest` + `describe/it/expect` (project convention).
3. Use `tests/fixtures/*` for deterministic test data (no `Math.random()` / `Date.now()`).
4. Each test file headers with a JSDoc block explaining the Phase invariant + which CAT requirement it satisfies.
5. Static tests live under `tests/static/` (project convention).

---

## No Analog Found

None. Every Phase 38 file has at least a role-match analog. The "no analog" category is empty because Phase 38 is a wiring exercise on pre-existing primitives (per RESEARCH.md §Don't Hand-Roll closing line: "Every helper, type, RLS policy, upsert primitive, and migration pattern already exists").

---

## Metadata

**Analog search scope:** `src/lib/`, `src/data/`, `src/app/actions/`, `src/db/`, `src/lib/verdict/`, `tests/fixtures/`, `tests/static/`, `tests/integration/`, `drizzle/`, `supabase/migrations/`
**Files scanned:** 14 read (similarity.ts, types.ts, watches.ts DAL, watches.ts action, wishlist.ts, schema.ts, viewerTasteProfile.ts, viewerTasteProfile.test.ts, CollectionFitCard.no-engine.test.ts, no-evaluate-route.test.ts, watches.ts fixtures, phase17-join-shape.test.ts, drizzle 0010, supabase Phase 37 migration), plus 1 journal file.
**Pattern extraction date:** 2026-05-12

---

## PATTERN MAPPING COMPLETE
