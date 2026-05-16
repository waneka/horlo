# Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 28 (8 NEW + 20 MODIFY)
**Analogs found:** 28 / 28

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260510000001_phase35_layer_b.sql` | migration | DB | `supabase/migrations/20260510000000_phase34_brands_families.sql` | exact |
| `drizzle/0008_phase35_layer_b.sql` | migration | DB | `drizzle/0007_phase34_brands_families.sql` | exact |
| `src/db/schema.ts` (lines 22–34, 64–66, 308) | DB | DB | self — existing `wearVisibilityEnum` / `notificationTypeEnum` pattern at lines 22–34 | exact |
| `src/data/hierarchy.ts` | DAL | DB / recursive CTE | `src/data/catalog.ts` — server-only DAL with `sql` template raw queries | role-match |
| `scripts/backfill-catalog-families.ts` | script | DB / batch | `scripts/backfill-catalog-brands.ts` | exact |
| `scripts/backfill-catalog-lineage.ts` | script | DB / batch | `scripts/backfill-catalog-brands.ts` | role-match |
| `scripts/seed-data/families.json` | config | — | none — new directory | no-analog |
| `scripts/seed-data/lineage-edges.json` | config | — | none — new directory | no-analog |
| `tests/static/hierarchy.lineage-3-node.test.ts` | test | static source-scan | `tests/static/CollectionFitCard.no-engine.test.ts` | exact |
| `src/lib/types.ts` (line 3) | TS-types | — | self — `MovementType` line 3; `WatchStatus` / `StrapType` pattern | exact |
| `src/lib/constants.ts` (lines 72–78) | TS-types | — | self — `STRAP_TYPES`, `CRYSTAL_TYPES` canonical list pattern | exact |
| `src/lib/extractors/llm.ts` (lines 22, 138) | extractor | request-response | self — line 138 `cleanWatch` validates against `MOVEMENT_TYPES.includes(...)` | exact |
| `src/app/actions/watches.ts` (line 25) | server-action | request-response | self — line 25 `z.enum([...])` mirrors `MOVEMENT_TYPES` | exact |
| `src/lib/verdict/shims.ts` | utility | transform | self — `KNOWN_CRYSTALS` / `coerceCrystal` sibling pattern | exact |
| `src/lib/verdict/shims.test.ts` | test | — | self — sibling test file | exact |
| `src/components/watch/WatchForm.tsx` (lines 67, 428–432) | form component | — | self — existing `MOVEMENT_TYPES.map(...)` dropdown | exact |
| `src/components/watch/AddWatchFlow.tsx` (lines 638, 680) | component | — | self — existing `data.movement ?? 'automatic'` pattern | exact |
| `src/components/watch/CatalogPageActions.tsx` (line 81) | component | — | self — existing `spec.movement ?? 'automatic'` pattern | exact |
| `src/components/search/WatchSearchRowsAccordion.tsx` (line 87) | component | — | self — existing `movement: 'automatic' as const` pattern | exact |
| `src/data/catalog.ts` (lines 61, 194, 201, 215) | DAL | DB | self — `row.movement` → `row.movementType` rename; INSERT column list | exact |
| `src/data/watches.ts` (lines 27, 66) | DAL | DB | self — `mapRowToWatch` / `mapDomainToRow` movement field | exact |
| `src/components/insights/CollectionFitCard.test.tsx` (line 17) | test | — | self — test fixture pattern | exact |
| `src/components/profile/__tests__/CollectionTabContent.test.tsx` (line 56) | test | — | self — test fixture pattern | exact |
| `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` (line 57) | test | — | self — test fixture pattern | exact |
| `src/components/profile/WishlistTabContent.test.tsx` (line 57) | test | — | self — test fixture pattern | exact |
| `src/lib/taste/enricher.test.ts` (line 55) | test | — | self — test fixture pattern | exact |
| `src/lib/verdict/composer.test.ts` (lines 50, 81) | test | — | self — test fixture pattern | exact |
| `src/lib/verdict/confidence.test.ts` (lines 49, 80) | test | — | self — test fixture pattern | exact |
| `src/lib/verdict/viewerTasteProfile.test.ts` (line 49) | test | — | self — test fixture pattern | exact |
| `docs/deploy-db-setup.md` | docs | — | self — Phase 34 section at line 554 | exact |
| `package.json` | config | — | self — existing `db:backfill-catalog-brands` entry at line 17 | exact |

---

## Pattern Assignments (grouped by role)

---

### ROLE: migration

---

#### `supabase/migrations/20260510000001_phase35_layer_b.sql` (NEW)

**Analog:** `supabase/migrations/20260510000000_phase34_brands_families.sql`

**Top-level structure pattern** (lines 1–6, 70–101):
```sql
-- Phase 34 — Layer A: brand + family entities (CAT-15)
-- Source: 34-CONTEXT.md D-01..D-06; 34-RESEARCH.md §Pattern 2
-- Sibling Drizzle migration: drizzle/0007_phase34_brands_families.sql ...

BEGIN;

-- 1. brands table (D-01)
CREATE TABLE IF NOT EXISTS brands (
  ...
);
-- ... DDL blocks ...
-- N. Final assertion block (Phase 17 §8 pattern)
DO $$
DECLARE
  brands_select_policy_exists boolean;
  ...
BEGIN
  SELECT EXISTS (...) INTO brands_select_policy_exists;
  IF NOT brands_select_policy_exists THEN RAISE EXCEPTION 'Phase 34 failed -- ...'; END IF;
END $$;

COMMIT;
```
Phase 35 adds: `TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE;` as STEP 0 after `BEGIN;`, four `CREATE TYPE` statements before any `ALTER TABLE`, the cycle trigger function, and RLS for `watch_lineage_edges`.

**RLS + GRANT pattern** (lines 31–34, 58–61 of analog):
```sql
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_select_all ON brands;
CREATE POLICY brands_select_all ON brands FOR SELECT USING (true);
GRANT SELECT ON brands TO anon, authenticated;
```
Phase 35 mirrors verbatim for `watch_lineage_edges`. Table name and policy name change; body is identical.

**DO $$ idempotent assertion block pattern** (lines 71–99 of analog):
```sql
DO $$
DECLARE
  brands_select_policy_exists boolean;
  anon_can_select_brands boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='brands_select_all') INTO brands_select_policy_exists;
  SELECT has_table_privilege('anon', 'public.brands', 'SELECT') INTO anon_can_select_brands;
  IF NOT brands_select_policy_exists THEN RAISE EXCEPTION 'Phase 34 failed -- brands SELECT policy missing'; END IF;
  IF NOT anon_can_select_brands      THEN RAISE EXCEPTION 'Phase 34 failed -- anon cannot SELECT brands (T-34-02)'; END IF;
END $$;
```
Phase 35 adds additional assertions: lineage table exists, `movement_type_enum` type exists, `watch_lineage_edges` SELECT policy exists, anon can SELECT lineage edges.

**What differs:** Phase 35 adds four `CREATE TYPE` statements (before any DDL referencing them), TRUNCATE statements at the top, and the `check_lineage_cycle()` BEFORE INSERT trigger — none of which exist in the Phase 34 analog.

---

#### `drizzle/0008_phase35_layer_b.sql` (NEW)

**Analog:** `drizzle/0007_phase34_brands_families.sql`

**`--> statement-breakpoint` separator pattern** (lines 1–18 of analog):
```sql
-- Phase 34 — Layer A: brands + watch_families column shapes (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260510000000_phase34_brands_families.sql ...

CREATE TABLE IF NOT EXISTS "brands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "name_normalized" text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  "slug" text NOT NULL,
  CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_families" (
  ...
);
--> statement-breakpoint
ALTER TABLE "watches_catalog" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
```

**DO $$ FK-guard pattern** (lines 33–71 of analog):
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_families_brand_id_brands_id_fk'
      AND conrelid = 'watch_families'::regclass
  ) THEN
    ALTER TABLE "watch_families"
      ADD CONSTRAINT "watch_families_brand_id_brands_id_fk"
      FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
```

**Index creation pattern** (lines 72–74 of analog):
```sql
CREATE INDEX IF NOT EXISTS "watch_families_brand_id_idx" ON "watch_families" USING btree ("brand_id");
CREATE INDEX IF NOT EXISTS "watches_catalog_brand_id_idx" ON "watches_catalog" USING btree ("brand_id");
```

**What differs:** Phase 35 must first emit `CREATE TYPE IF NOT EXISTS movement_type_enum AS ENUM (...)` etc. (Drizzle needs type declarations to infer column types), then `ALTER TABLE watches_catalog DROP COLUMN IF EXISTS movement`, then `ADD COLUMN IF NOT EXISTS movement_type`, then `CREATE TABLE IF NOT EXISTS watch_lineage_edges`. No RLS, no trigger, no CHECK — those live only in the Supabase migration.

---

### ROLE: DB (schema.ts edits)

---

#### `src/db/schema.ts` — pgEnum declarations (lines 22–34, new exports to add)

**Analog:** Existing `wearVisibilityEnum` / `notificationTypeEnum` at lines 22–34

**Existing pgEnum pattern** (lines 22–34):
```typescript
// ----- Phase 11: wear_visibility enum (WYWT-09) -----
export const wearVisibilityEnum = pgEnum('wear_visibility', [
  'public',
  'followers',
  'private',
])

// ----- Phase 11: notification_type enum (NOTIF-01, D-09) -----
// Narrowed to 2 values in Phase 24 (DEBT-05) after prod migration applied.
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
])
```
Phase 35 adds three new `pgEnum` exports immediately after line 34, before the `users` table definition.

**Existing `watches.movement` column to DROP** (lines 64–66):
```typescript
movement: text('movement', {
  enum: ['automatic', 'manual', 'quartz', 'spring-drive', 'other'],
}).notNull(),
```
Replace with: `movementType: movementTypeEnum('movement_type'),` and `movementCaliber: text('movement_caliber'),` (both nullable — drop `.notNull()`).

**Existing `watchesCatalog.movement` to DROP** (line 308):
```typescript
movement: text('movement'),
```
Replace with five new columns using new `pgEnum` types.

**What differs:** Phase 35 introduces the first `pgEnum` columns in `watches` and `watchesCatalog` (existing enums were only on `wearEvents` and `notifications`). Also adds the `watchLineageEdges` table definition after `watchFamilies`.

---

### ROLE: DAL

---

#### `src/data/hierarchy.ts` (NEW)

**Analog:** `src/data/catalog.ts`

**Server-only guard + imports pattern** (lines 1–8 of analog):
```typescript
// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { CatalogEntry, CatalogSource, ... } from '@/lib/types'
```
`hierarchy.ts` imports `import 'server-only'` as first line, then `import { db } from '@/db'`, `import { sql } from 'drizzle-orm'`, and `import { watchLineageEdges, watchesCatalog } from '@/db/schema'`.

**Raw `sql` template for complex CTE pattern** (lines 191–232 of analog):
```typescript
const result = await db.execute<{ id: string }>(sql`
  INSERT INTO watches_catalog (
    brand, model, reference, source,
    movement, case_size_mm, ...
  )
  VALUES (
    ${input.brand}, ${input.model}, ...
  )
  ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET
    movement = COALESCE(watches_catalog.movement, EXCLUDED.movement),
    ...
    updated_at = now()
  RETURNING id
`)
const rows = result as unknown as Array<{ id: string }>
return rows[0]?.id ?? null
```
`hierarchy.ts` uses the same `db.execute(sql\`...\`)` pattern with `result as unknown as Array<LineageRow[]>` for the recursive CTE. The `CYCLE id SET is_cycle USING path` clause goes inside the SQL template string — Drizzle 0.45.2 has no typed builder for `WITH RECURSIVE`.

**Type for returned rows:** Define a `LineageRow` interface in `hierarchy.ts` with fields: `id`, `brand`, `model`, `reference`, `predecessor_catalog_id`, `successor_catalog_id`, `relationship_type`, `depth`, `direction` (`'forward' | 'backward'`), `is_cycle`.

**What differs:** `hierarchy.ts` uses `WITH RECURSIVE ... CYCLE id SET is_cycle USING path` (Postgres 15 syntax) — no analog of this exists in the codebase. Must use raw `sql` template. Include `WHERE NOT is_cycle` in the outer `SELECT` to guard against any pre-existing cycles in stored data.

---

#### `src/data/catalog.ts` — movement column reads/writes (MODIFY)

**Pattern to update** — `upsertCatalogFromExtractedUrl` INSERT column list (lines 192–232):
```typescript
const result = await db.execute<{ id: string }>(sql`
  INSERT INTO watches_catalog (
    brand, model, reference, source,
    movement, case_size_mm, ...        -- DROP 'movement' here
  )
  VALUES (
    ${input.brand}, ${input.model}, ...,
    ${input.movement ?? null}, ...     -- DROP this binding
  )
  ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET
    movement = COALESCE(...),          -- DROP this COALESCE line
    ...
`)
```
After Phase 35: replace `movement` column in INSERT with `movement_type` (bound to `${input.movementType ?? null}`). Add `movement_caliber` column bound to `${input.movementCaliber ?? null}`. Update the ON CONFLICT SET clause similarly.

**Row mapper pattern to update** (lines 55–86 of catalog.ts):
```typescript
movement: row.movement ?? null,   // line 61 — becomes:
movementType: row.movementType ?? null,
movementCaliber: row.movementCaliber ?? null,
```

**What differs:** Column rename from `movement` to `movementType`/`movementCaliber`. The `UrlExtractedCatalogInput` interface at line 103 also gains `movementType?: MovementType | null` and `movementCaliber?: string | null`, dropping `movement?: string | null`.

---

#### `src/data/watches.ts` — movement column reads/writes (MODIFY)

**`mapRowToWatch` pattern** (lines 17–51):
```typescript
function mapRowToWatch(row: WatchRow): Watch {
  return {
    id: row.id,
    brand: row.brand,
    ...
    movement: row.movement,           // line 27 — DROP
    ...
  }
}
```
After Phase 35: `movement: row.movement` becomes `movement: row.movementType ?? undefined` (or `movementType`/`movementCaliber` if Watch type is split — follow planner's decision on Watch type shape).

**`mapDomainToRow` pattern** (line 66):
```typescript
if (data.movement !== undefined) row.movement = data.movement   // line 66
```
After Phase 35: split into `if (data.movement !== undefined) row.movementType = data.movement` (or use the new field name per planner's Watch type decision).

**What differs:** Two-line change in each mapper. No structural change to the function shape.

---

### ROLE: script

---

#### `scripts/backfill-catalog-families.ts` (NEW)

**Analog:** `scripts/backfill-catalog-brands.ts` (direct template)

**File header + imports pattern** (lines 1–29 of analog):
```typescript
/**
 * Phase 34 backfill script — CAT-15, D-03/D-05.
 * Usage: npm run db:backfill-catalog-brands -- [...]
 *
 * Idempotent — re-runs after success are no-ops because:
 *   Pass A: ON CONFLICT (name_normalized) DO NOTHING
 *   Pass C: WHERE brand_id IS NULL filter shrinks to empty
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the
 * anon client.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
```

**Multi-pass structure with `db.execute<{ count: number }>(sql\`...\`)` pattern** (lines 51–68 of analog):
```typescript
async function passA_deriveBrands(): Promise<number> {
  const result = await db.execute<{ inserted: number }>(sql`
    WITH ins AS (
      INSERT INTO brands (name, slug)
      SELECT ...
      ON CONFLICT (name_normalized) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM ins
  `)
  const inserted = (result as unknown as Array<{ inserted: number }>)[0]?.inserted ?? 0
  console.log(`[backfill-catalog-brands] passA: inserted ${inserted} brand rows`)
  return inserted
}
```

**Pass C — idempotent `WHERE x IS NULL` link pattern** (lines 106–121 of analog):
```typescript
async function passC_linkCatalog(): Promise<number> {
  const result = await db.execute<{ linked: number }>(sql`
    WITH upd AS (
      UPDATE watches_catalog wc
         SET brand_id = b.id
        FROM brands b
       WHERE wc.brand_normalized = b.name_normalized
         AND wc.brand_id IS NULL
      RETURNING wc.id
    )
    SELECT count(*)::int AS linked FROM upd
  `)
  const linked = (result as unknown as Array<{ linked: number }>)[0]?.linked ?? 0
  console.log(`[backfill-catalog-brands] passC: linked ${linked} watches_catalog rows`)
  return linked
}
```

**`main()` + `process.exit` pattern** (lines 123–157 of analog):
```typescript
async function main() {
  const startedAt = Date.now()
  const inserted = await passA_deriveBrands()
  const linked = await passC_linkCatalog()
  // Final assertion — fail loudly if postcondition not met
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog
     WHERE brand_normalized IS NOT NULL AND brand_id IS NULL
  `)
  const remainingCount = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
  if (remainingCount !== 0) {
    console.error(`[backfill-catalog-brands] FAILED — ${remainingCount} catalog rows unlinked:`)
    process.exit(1)
  }
  console.log(`[backfill-catalog-brands] OK — inserted=${inserted} linked=${linked} unlinked=0 elapsedMs=${Date.now() - startedAt}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill-catalog-brands] fatal:', err)
  process.exit(1)
})
```

**What differs:** `backfill-catalog-families.ts` reads from `scripts/seed-data/families.json` (JSON file, not derived from catalog rows), resolves `brand_slug` to `brand_id` via a JOIN, and inserts into `watch_families` with `ON CONFLICT (brand_id, name_normalized) DO NOTHING`. Pass B links `watches_catalog.family_id` via `brand_id + name_normalized` match. No `parseArgs()` needed (no optional CLI flags).

---

#### `scripts/backfill-catalog-lineage.ts` (NEW)

**Analog:** `scripts/backfill-catalog-brands.ts`

**Imports + JSON read pattern** (lines 27–29 of analog):
```typescript
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
```

**`ON CONFLICT DO NOTHING` insert pattern** (lines 51–68 of analog — adapted):
```typescript
async function passA_deriveBrands(): Promise<number> {
  const result = await db.execute<{ inserted: number }>(sql`
    WITH ins AS (
      INSERT INTO brands (name, slug)
      ...
      ON CONFLICT (name_normalized) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM ins
  `)
```
For lineage: `INSERT INTO watch_lineage_edges (predecessor_catalog_id, successor_catalog_id, relationship_type) VALUES (...) ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING RETURNING id`.

**`process.exit` pattern** (lines 154–157 of analog): identical — same `process.exit(0)` / `process.exit(1)` bookends.

**What differs:** `backfill-catalog-lineage.ts` has a `resolveRef(triple: string)` helper that resolves `"brand_slug/family_slug/reference"` triples to `watches_catalog.id` via JOIN with `brands` + `watch_families`. Missing refs emit `console.warn(...)` and `skipped++` (no `process.exit(1)`). The final assertion checks `COUNT(*) FROM watch_lineage_edges` equals expected seed count.

---

### ROLE: TS-types

---

#### `src/lib/types.ts` (MODIFY, line 3)

**Analog:** Existing type definitions in same file (lines 1–7)

**Current pattern** (lines 1–7):
```typescript
export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'

export type MovementType = 'automatic' | 'manual' | 'quartz' | 'spring-drive' | 'other'

export type StrapType = 'bracelet' | 'leather' | 'rubber' | 'nato' | 'other'
```
After Phase 35: line 3 becomes `export type MovementType = 'auto' | 'manual' | 'quartz' | 'spring_drive'`. Add `export type WatchEra = typeof watchEraEnum.enumValues[number]` (Drizzle inference) or inline: `export type WatchEra = '1900-1910' | '1910-1920' | ... | '2020-2030'`.

Also update `Watch.movement` at line 30 from `movement: MovementType` to `movement?: MovementType` (optional, matching nullable DB column post-Phase 35).

**What differs:** `MovementType` loses 2 values and gains corrected spellings. `Watch.movement` flips from required to optional. `WatchEra` is a new export.

---

#### `src/lib/constants.ts` (MODIFY, lines 72–78)

**Analog:** Existing `STRAP_TYPES`, `CRYSTAL_TYPES` canonical list pattern (lines 80–95)

**Current `MOVEMENT_TYPES` pattern** (lines 72–78):
```typescript
export const MOVEMENT_TYPES = [
  'automatic',
  'manual',
  'quartz',
  'spring-drive',
  'other',
] as const
```
After Phase 35: rewrite to 4-value array. Then add `MOVEMENT_LABELS` map immediately after. Then add `CASE_MATERIALS_SUGGESTED` and `BRACELET_CONFIGS_SUGGESTED` following the same `as const` list pattern.

**What differs:** Values change; two new exports added (`MOVEMENT_LABELS` as a `Record<MovementType, string>` map — different shape from other `as const` arrays).

---

### ROLE: extractor

---

#### `src/lib/extractors/llm.ts` (MODIFY, lines 22 and 138)

**Analog:** Same file — existing `cleanWatch` validation logic

**Prompt string pattern** (lines 15–30):
```typescript
const EXTRACTION_PROMPT = `You are extracting watch specifications from a product page. ...
{
  ...
  "movement": "automatic|manual|quartz|spring-drive|other",
  ...
}`
```
After Phase 35: line 22 becomes `"movement": "auto|manual|quartz|spring_drive"`.

**`cleanWatch` validator pattern** (lines 138–140):
```typescript
if (typeof data.movement === 'string' && MOVEMENT_TYPES.includes(data.movement as typeof MOVEMENT_TYPES[number])) {
  cleaned.movement = data.movement as MovementType
}
```
This line does NOT need to change — it calls `MOVEMENT_TYPES.includes(...)`. After the constants update, it automatically validates against the 4-value list. The surrounding `if` guard is the D-03a "silently drop unmatched values" behavior.

**What differs:** Only line 22 (prompt string) changes. Line 138 is self-updating via the constants dependency.

---

### ROLE: server-action

---

#### `src/app/actions/watches.ts` (MODIFY, line 25)

**Analog:** Same file — existing `z.enum([...])` pattern at line 22 for `status`

**Zod enum pattern** (lines 17–26):
```typescript
const insertWatchSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  ...
  status: z.enum(['owned', 'wishlist', 'sold', 'grail']),
  ...
  movement: z.enum(['automatic', 'manual', 'quartz', 'spring-drive', 'other']),
  ...
})
```
After Phase 35: line 25 becomes `movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional()` (optional because `Watch.movement` becomes optional post-Phase 35, and the TRUNCATE wipes all existing rows).

**What differs:** 5 values → 4 values; `optional()` added to match nullable DB column. `'automatic'`, `'spring-drive'`, `'other'` removed; `'auto'`, `'spring_drive'` added.

---

### ROLE: utility

---

#### `src/lib/verdict/shims.ts` (MODIFY, lines 18–36, 51)

**Analog:** Same file — `KNOWN_CRYSTALS` / `coerceCrystal` sibling pattern (lines 26–42)

**Current `KNOWN_MOVEMENTS` + `coerceMovement` pattern** (lines 18–37):
```typescript
const KNOWN_MOVEMENTS: ReadonlySet<MovementType> = new Set<MovementType>([
  'automatic',
  'manual',
  'quartz',
  'spring-drive',
  'other',
])

function coerceMovement(m: string | null): MovementType {
  if (m === null) return 'other'
  return KNOWN_MOVEMENTS.has(m as MovementType) ? (m as MovementType) : 'other'
}
```
After Phase 35: `KNOWN_MOVEMENTS` set rebuilds with 4-value list. `coerceMovement` return type changes to `MovementType | undefined`. Both `null` and unrecognized strings return `undefined` (eliminates `'other'` fallback). `catalogEntryToSimilarityInput` at line 44 passes `movementType: coerceMovement(entry.movementType)` (column rename from `entry.movement`).

**`coerceCrystal` sibling (unchanged, structural reference)** (lines 39–42):
```typescript
function coerceCrystal(c: string | null): CrystalType | undefined {
  if (c === null) return undefined
  return KNOWN_CRYSTALS.has(c as CrystalType) ? (c as CrystalType) : undefined
}
```
`coerceMovement` post-Phase 35 should match this exact return-`undefined` pattern.

**What differs:** `coerceMovement` changes from `MovementType` return (always non-null) to `MovementType | undefined`. The `catalogEntryToSimilarityInput` call site at line 51 changes `entry.movement` to `entry.movementType`.

---

### ROLE: form component

---

#### `src/components/watch/WatchForm.tsx` (MODIFY, lines 67 and 428–432)

**Analog:** Same file — existing dropdown map at lines 428–432

**Current dropdown pattern** (lines 428–432):
```tsx
{MOVEMENT_TYPES.map((type) => (
  <SelectItem key={type} value={type}>
    <span className="capitalize">{type}</span>
  </SelectItem>
))}
```
After Phase 35: remove `<span className="capitalize">` (breaks `spring_drive` → "Spring_drive"); replace with `{MOVEMENT_LABELS[type]}`.

**Current default pattern** (line 67 in `initialFormData`):
```typescript
movement: 'automatic',
```
After Phase 35: `movement: 'auto'`.

**What differs:** Default value changes; `capitalize` CSS replaced by explicit `MOVEMENT_LABELS` lookup.

---

#### `src/components/watch/AddWatchFlow.tsx` (MODIFY, lines 638 and 680)

**Current pattern** (line 638):
```typescript
const movement: MovementType = data.movement ?? 'automatic'
```
After Phase 35: `data.movement ?? 'auto'`.

**What differs:** String literal `'automatic'` → `'auto'` in two places (lines 638 and 680).

---

#### `src/components/watch/CatalogPageActions.tsx` (MODIFY, line 81)

**Current pattern** (line 81):
```typescript
spec.movement ?? 'automatic'
```
After Phase 35: `spec.movement ?? 'auto'`.

---

#### `src/components/search/WatchSearchRowsAccordion.tsx` (MODIFY, line 87)

**Current pattern** (line 87):
```typescript
movement: 'automatic' as const
```
After Phase 35: `movement: 'auto' as const`.

---

### ROLE: test

---

#### `tests/static/hierarchy.lineage-3-node.test.ts` (NEW)

**Analog:** `tests/static/CollectionFitCard.no-engine.test.ts`

**Static source-scan pattern** (full analog file):
```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('Phase 20 D-04 — <CollectionFitCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/CollectionFitCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) {
      return   // Vacuous pass until file is created
    }
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
  })
})
```
`hierarchy.lineage-3-node.test.ts` uses the same `existsSync(path)` guard on `'src/data/hierarchy.ts'`, then `readFileSync(path, 'utf-8')` + regex assertions for CYCLE clause and depth guard presence.

**What differs:** Assertions are positive (`toMatch`) rather than negative (`not.toMatch`). Tests verify the source contains `CYCLE\s+id\s+SET\s+is_cycle\s+USING\s+path`, `depth\s*<\s*10`, `export\s+(async\s+)?function\s+getLineageForReference`, and `import 'server-only'`.

---

#### Test fixture files (MODIFY — 9 files, same pattern each)

**Analog:** Each file modifies a single fixture line

**Current pattern** (e.g., `src/components/insights/CollectionFitCard.test.tsx` line 17):
```typescript
movement: 'automatic',
```
After Phase 35: `movement: 'auto',` in all 9 fixture locations.

**Special case — `src/lib/verdict/shims.test.ts` lines 23, 72, 97, 127:**
- Lines 23, 72, 97: `movement: 'automatic'` → `movement: 'auto'`
- Line 127: `expect(shimmed.movement).toBe('other')` → redesign to assert `expect(shimmed.movement).toBeUndefined()` (tests `coerceMovement`'s new undefined-fallback behavior)

---

### ROLE: docs

---

#### `docs/deploy-db-setup.md` (MODIFY — append Phase 35 section)

**Analog:** Phase 34 section starting at line 554

**Phase 34 section structure pattern** (lines 554–560):
```markdown
## Phase 34 — Layer A: Brand + Family Entities Deploy Steps

Phase 34 (CAT-15) adds first-class `brands` and `watch_families` tables ...

Threats mitigated: T-34-01 (anon write blocked by RLS), T-34-02 (anon read enabled by GRANT), ...

### Preconditions
- Phase 34 PR is merged to `main`
- Local DB push is GREEN (...)
- ...

### 34.0 — Pre-flight pg_depend check (memory rule 4)
...

### 34.1 — Apply migrations to prod
...
```
Phase 35 appends a parallel `## Phase 35 — Layer B: ...` section with subsections 35.0 (BOLD TRUNCATE WARNING), 35.1 (pg_depend pre-flight D-03b query), 35.2 (supabase db push), 35.3–35.6 (four backfill scripts in D-14 order), 35.7 (smoke-test SELECTs from D-14 step 7).

**What differs:** Phase 35 section opens with a prominent TRUNCATE warning (bold, boxed, or prefixed with "WARNING:") since this is the first deploy in project history that wipes prod data. The pg_depend check moves to 35.1 (before migration push, not before FK adds).

---

### ROLE: config

---

#### `package.json` (MODIFY — add 2 script entries)

**Analog:** Existing `db:backfill-catalog-brands` entry (line 17):
```json
"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"
```
Phase 35 adds immediately after:
```json
"db:backfill-catalog-families": "tsx --env-file=.env.local scripts/backfill-catalog-families.ts",
"db:backfill-catalog-lineage":  "tsx --env-file=.env.local scripts/backfill-catalog-lineage.ts"
```

**What differs:** None — identical `tsx --env-file=.env.local` pattern.

---

## Shared Patterns

### Server-only DAL guard
**Source:** `src/data/catalog.ts` line 1–2, `src/data/watches.ts` line 1–2
**Apply to:** `src/data/hierarchy.ts`
```typescript
// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'
```

### `db.execute(sql\`...\`) + result cast` pattern
**Source:** `src/data/catalog.ts` lines 191–233
**Apply to:** `src/data/hierarchy.ts`, `scripts/backfill-catalog-families.ts`, `scripts/backfill-catalog-lineage.ts`
```typescript
const result = await db.execute<{ id: string }>(sql`
  -- raw SQL here
`)
const rows = result as unknown as Array<{ id: string }>
return rows[0]?.id ?? null
```

### RLS public-read + service-role-write (no explicit write policy)
**Source:** `supabase/migrations/20260510000000_phase34_brands_families.sql` lines 31–34
**Apply to:** `watch_lineage_edges` RLS block in Phase 35 migration
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS <table>_select_all ON <table>;
CREATE POLICY <table>_select_all ON <table> FOR SELECT USING (true);
GRANT SELECT ON <table> TO anon, authenticated;
-- No INSERT/UPDATE/DELETE policies — service_role bypasses RLS
```

### Idempotent backfill: `ON CONFLICT ... DO NOTHING` + `WHERE x IS NULL`
**Source:** `scripts/backfill-catalog-brands.ts` lines 51–68, 106–121
**Apply to:** `scripts/backfill-catalog-families.ts`, `scripts/backfill-catalog-lineage.ts`

### `process.exit(0)` / `process.exit(1)` — postgres.js pool does not auto-close
**Source:** `scripts/backfill-catalog-brands.ts` lines 150–157
**Apply to:** Both new backfill scripts
```typescript
main().catch((err) => {
  console.error('[script-name] fatal:', err)
  process.exit(1)
})
```

### Static source-scan test: `existsSync` guard + `readFileSync` + regex `toMatch`
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` full file
**Apply to:** `tests/static/hierarchy.lineage-3-node.test.ts`

### `pgEnum(...)` export declaration
**Source:** `src/db/schema.ts` lines 22–34
**Apply to:** Three new pgEnum exports in `src/db/schema.ts` (movementTypeEnum, lineageRelationshipTypeEnum, watchEraEnum)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/seed-data/families.json` | config | — | No JSON seed files in project; `scripts/seed-data/` directory does not exist |
| `scripts/seed-data/lineage-edges.json` | config | — | Same — new directory and file shape |

The JSON seed file shape is fully specified in CONTEXT.md D-13 and RESEARCH.md §8 — planner should copy verbatim from those sections rather than deriving from an analog.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `drizzle/`, `src/db/`, `src/data/`, `src/lib/`, `src/components/watch/`, `src/app/actions/`, `scripts/`, `tests/static/`, `docs/`
**Files scanned:** 18 analog files read
**Pattern extraction date:** 2026-05-10
