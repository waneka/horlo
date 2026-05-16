# Phase 34: Layer A — Brand + Family Entities — Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 7 (4 NEW, 3 MODIFIED)
**Analogs found:** 7 / 7 (100% coverage — Phase 17 is a near-perfect template)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260510000000_phase34_brands_families.sql` (NEW) | migration (authoritative DDL) | schema mutation (transform) | `supabase/migrations/20260427000000_phase17_catalog_schema.sql` | exact |
| `drizzle/0007_phase34_brands_families.sql` (NEW) | migration (column shapes) | schema mutation (transform) | `drizzle/0004_phase17_catalog.sql` | exact |
| `src/db/schema.ts` (MODIFIED) | model (Drizzle ORM type defs) | schema (TS types) | `src/db/schema.ts` lines 281–341 (existing `watchesCatalog` block) | exact (in-file template) |
| `scripts/backfill-catalog-brands.ts` (NEW) | utility script (service-role backfill) | batch (CRUD via SQL) | `scripts/backfill-catalog.ts` (primary) + `scripts/backfill-taste.ts` (arg parsing) | exact (primary) + role-match (args) |
| `package.json` (MODIFIED) | config | static config | `package.json:12-16` (existing `db:*` script entries) | exact (in-file template) |
| `docs/deploy-db-setup.md` (MODIFIED) | docs (operator runbook) | document (append) | `docs/deploy-db-setup.md:234-322` (Phase 17 §17.1–17.6) | exact (in-file template) |
| `tests/integration/phase34-rls.test.ts` (NEW, optional) | test (integration) | request-response (DB-gated) | `tests/integration/phase17-secdef.test.ts` (primary) + `tests/integration/phase17-catalog-rls.test.ts` (anon-client RLS pattern) | exact (primary) + role-match |
| `scripts/country.json` (NEW, planner discretion) | config (data file) | static config | (no analog — first JSON data file in project) | no analog |

---

## Pattern Assignments

### `supabase/migrations/20260510000000_phase34_brands_families.sql` (migration, authoritative DDL)

**Analog:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql`

**File header pattern** (Phase 17 lines 1–11):
```sql
-- Phase 17 Migration 1/2: watches_catalog schema (RLS, generated cols, UNIQUE NULLS NOT DISTINCT, GIN, CHECK, trigger, snapshots)
-- Source: 17-CONTEXT.md D-01..D-09, D-12; 17-RESEARCH.md §"Pattern 1"
-- Requirements: CAT-01, CAT-02, CAT-03, CAT-04, CAT-12
--
-- Sibling Drizzle migration: drizzle/0004_phase17_catalog.sql (column shapes only).
-- This file layers RLS + generated columns + NULLS NOT DISTINCT UNIQUE + GIN + CHECK +
-- updated_at trigger + snapshots-table RLS on top.

BEGIN;
```

**Phase 34 should mirror:** Source-pin to CONTEXT.md D-01..D-06; reference sibling `drizzle/0007_phase34_brands_families.sql`; open with `BEGIN;` and close with `COMMIT;`.

**GENERATED column idempotent re-create pattern** (Phase 17 lines 26–68):
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'watches_catalog'
       AND column_name = 'brand_normalized'
       AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE watches_catalog DROP COLUMN IF EXISTS brand_normalized;
    ALTER TABLE watches_catalog ADD COLUMN brand_normalized text
      GENERATED ALWAYS AS (lower(trim(brand))) STORED;
  END IF;
END
$$;
```

**Phase 34 application:** Phase 34 creates new tables (not mutates existing), so the simpler form `CREATE TABLE IF NOT EXISTS brands (... name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED ...)` works at table-creation time. Reuse the `DO $$ BEGIN IF NOT EXISTS ... END $$` pattern only for ADD CONSTRAINT statements (named UNIQUE constraints — see below).

**Named UNIQUE constraint via DO $$ idempotent guard** (Phase 17 lines 110–135 — adapted for Phase 34):
```sql
-- Phase 17: promotes a UNIQUE INDEX to a named CONSTRAINT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'watches_catalog'::regclass
       AND conname = 'watches_catalog_natural_key'
  ) THEN
    ALTER TABLE watches_catalog
      ADD CONSTRAINT watches_catalog_natural_key
      UNIQUE USING INDEX watches_catalog_natural_key;
  END IF;
END
$$;
```

**Phase 34 application** (RESEARCH.md lines 326–333):
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_slug_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_slug_unique UNIQUE (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_name_normalized_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_name_normalized_unique UNIQUE (name_normalized);
  END IF;
END $$;
```

**updated_at trigger pattern** (Phase 17 lines 152–164):
```sql
CREATE OR REPLACE FUNCTION watches_catalog_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS watches_catalog_set_updated_at_trg ON watches_catalog;
CREATE TRIGGER watches_catalog_set_updated_at_trg
  BEFORE UPDATE ON watches_catalog
  FOR EACH ROW EXECUTE FUNCTION watches_catalog_set_updated_at();
```

**Phase 34 application:** Replicate twice — once for `brands_set_updated_at`, once for `watch_families_set_updated_at`. Function names MUST be table-prefixed to avoid collisions.

**RLS public-read + service-role-write pattern** (Phase 17 lines 166–185 — load-bearing):
```sql
-- Anon/authenticated SELECT works. Anon/authenticated INSERT/UPDATE/DELETE all
-- fail (no policy). Server Actions use service-role Drizzle client which bypasses RLS.
-- Pitfall 4: every new table MUST have ENABLE RLS + at least one policy in the same commit.
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watches_catalog_select_all ON watches_catalog;
CREATE POLICY watches_catalog_select_all
  ON watches_catalog FOR SELECT USING (true);
```

**Phase 34 application:** Replicate verbatim with table substitution for both `brands` and `watch_families`. Policy names: `brands_select_all`, `watch_families_select_all`. NO INSERT/UPDATE/DELETE policy — RLS-enabled table with no write policy means only `service_role` (which bypasses RLS) can write.

**Final assertion `DO $$` block pattern** (Phase 17 lines 188–220):
```sql
DO $$
DECLARE
  has_natural_key boolean;
  brand_is_generated boolean;
  has_select_policy boolean;
  has_snapshots_select_policy boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'watches_catalog'::regclass AND conname = 'watches_catalog_natural_key')
    INTO has_natural_key;
  SELECT (is_generated = 'ALWAYS') FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'watches_catalog' AND column_name = 'brand_normalized'
    INTO brand_is_generated;
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'watches_catalog_select_all')
    INTO has_select_policy;

  IF NOT has_natural_key THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed -- natural-key UNIQUE constraint missing';
  END IF;
  IF NOT brand_is_generated THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed -- brand_normalized not GENERATED ALWAYS';
  END IF;
  IF NOT has_select_policy THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed -- watches_catalog SELECT policy missing (Pitfall 4)';
  END IF;
END
$$;

COMMIT;
```

**Phase 34 application:** Mirror exactly. Assertions to add (RESEARCH.md lines 392–429):
- `brands_select_all` policy exists in `pg_policies`
- `watch_families_select_all` policy exists in `pg_policies`
- `watches_catalog.brand_id` column exists in `information_schema.columns`
- `watches_catalog.family_id` column exists in `information_schema.columns`
- `brands.name_normalized` is `is_generated = 'ALWAYS'`

Each `RAISE EXCEPTION` message MUST start with `'Phase 34 failed -- '` for grep-ability in CI logs.

**ALTER TABLE ADD COLUMN IF NOT EXISTS pattern** for `watches_catalog` FK adds (RESEARCH.md lines 382–387):
```sql
ALTER TABLE watches_catalog
  ADD COLUMN IF NOT EXISTS brand_id  uuid REFERENCES brands(id)         ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES watch_families(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS watches_catalog_brand_id_idx  ON watches_catalog (brand_id);
CREATE INDEX IF NOT EXISTS watches_catalog_family_id_idx ON watches_catalog (family_id);
```

**ON DELETE policy:** `RESTRICT` per CONTEXT.md D-02 (NOT `SET NULL` — `watches.catalogId` uses `SET NULL`, but Phase 34 brand/family FKs use `RESTRICT`). This is intentional asymmetry.

---

### `drizzle/0007_phase34_brands_families.sql` (migration, column shapes)

**Analog:** `drizzle/0004_phase17_catalog.sql`

**Imports / structure pattern** (Phase 17 lines 1–30):
```sql
CREATE TABLE "watches_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"reference" text,
	"brand_normalized" text GENERATED ALWAYS AS (lower(trim(brand))) STORED,
	...
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
```

**Phase 34 application:** `drizzle-kit generate` will produce the equivalent for `brands` and `watch_families`. If emission is malformed for `GENERATED ALWAYS AS` (Pitfall 2 — Phase 17 plan 01 task 2 documents this fallback), hand-author the SQL using this exact shape. Drizzle uses `"` quotes for identifiers; statement separator is `--> statement-breakpoint`.

**ALTER TABLE ADD COLUMN + FK pattern** (Phase 17 lines 45–48):
```sql
ALTER TABLE "watches" ADD COLUMN "catalog_id" uuid;--> statement-breakpoint
ALTER TABLE "watches_catalog_daily_snapshots" ADD CONSTRAINT "watches_catalog_daily_snapshots_catalog_id_watches_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_catalog_id_watches_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watches_catalog_id_idx" ON "watches" USING btree ("catalog_id");
```

**Phase 34 application:** Two `ALTER TABLE "watches_catalog" ADD COLUMN ... uuid;` statements + two `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE restrict` statements + two `CREATE INDEX` statements. Constraint name pattern: `watches_catalog_brand_id_brands_id_fk` and `watches_catalog_family_id_watch_families_id_fk` (Drizzle's auto-naming convention is `<table>_<col>_<reftable>_<refcol>_fk`).

**Sequencing note:** `drizzle/0006_phase27_sort_order.sql` is the current max — Phase 34 file MUST be `0007_phase34_brands_families.sql` (next sequential integer per memory rule 2).

---

### `src/db/schema.ts` (MODIFIED — Drizzle ORM type definitions)

**Analog:** `watchesCatalog` block at lines 281–341 (in-file template).

**Imports pattern** (lines 1–15 — NO CHANGE in Phase 34):
```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
```

**Phase 34 application:** No new imports needed. `pgTable`, `uuid`, `text`, `timestamp`, `unique`, and `sql` are already imported.

**FK callback pattern** (line 101 — load-bearing for forward references):
```typescript
catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

**Phase 34 application:** New FK columns on `watchesCatalog` MUST use callback form because `brands` and `watchFamilies` may be defined either before or after `watchesCatalog` in the file. Use `() => brands.id` and `() => watchFamilies.id`. **`onDelete: 'restrict'`** per CONTEXT.md D-02 (note the difference from `'set null'` above — same pattern, different semantic).

**GENERATED column pattern** (lines 292–299):
```typescript
brandNormalized: text('brand_normalized').generatedAlwaysAs(
  sql`lower(trim(brand))`,
),
modelNormalized: text('model_normalized').generatedAlwaysAs(
  sql`lower(trim(model))`,
),
```

**Phase 34 application:**
```typescript
nameNormalized: text('name_normalized').generatedAlwaysAs(
  sql`lower(trim(name))`,
),
```

Used identically on both `brands` and `watchFamilies` — only the source column changes (`brand` → `name`).

**Composite UNIQUE pattern** (line 357 from `watchesCatalogDailySnapshots`):
```typescript
(table) => [
  unique('watches_catalog_snapshots_unique_per_day').on(table.catalogId, table.snapshotDate),
  index('watches_catalog_snapshots_date_idx').on(table.snapshotDate, table.catalogId),
],
```

**Phase 34 application** (for `watchFamilies` `(brand_id, name_normalized)` UNIQUE per D-01):
```typescript
(table) => [
  unique('watch_families_brand_name_unique').on(table.brandId, table.nameNormalized),
],
```

For `brands`, single-column UNIQUE on `nameNormalized`:
```typescript
(table) => [
  unique('brands_name_normalized_unique').on(table.nameNormalized),
],
```

**Note on `slug` UNIQUE:** Per RESEARCH.md, `brands.slug` UNIQUE is enforced via the Supabase migration's `DO $$` block (named constraint `brands_slug_unique`), not via Drizzle's `unique()` helper — but `.unique()` on the Drizzle `slug` column works too and gets idempotent-merged at apply time.

**Timestamp + UUID PK pattern** (lines 284, 338–339):
```typescript
id: uuid('id').defaultRandom().primaryKey(),
// ...
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

**Phase 34 application:** Identical pattern on both `brands` and `watchFamilies`.

**Two new exports + two FK column adds on `watchesCatalog`:** The `watchesCatalog` block at lines 281–341 gets two new column lines (e.g., between `extractedFromPhoto` at line 336 and `createdAt` at line 338). The two new top-level exports (`brands`, `watchFamilies`) can be placed either before or after the existing `watchesCatalog` block as long as the FK callback form is used (Pitfall 1).

---

### `scripts/backfill-catalog-brands.ts` (utility script, service-role backfill)

**Analog (primary):** `scripts/backfill-catalog.ts`
**Analog (CLI parsing):** `scripts/backfill-taste.ts:39-49`

**File header pattern** (Phase 17 lines 1–13):
```typescript
/**
 * Phase 17 backfill script -- CAT-05, D-14.
 * Usage: npm run db:backfill-catalog
 *
 * Links existing per-user `watches` rows to `watches_catalog`. Idempotent -- re-runs after
 * success are no-ops because the WHERE catalog_id IS NULL filter shrinks to empty.
 *
 * Uses service-role DATABASE_URL via the existing src/db client. NEVER use the anon client.
 *
 * Env loading: relies on `--env-file=.env.local` flag passed by `npm run db:backfill-catalog`
 * (see package.json) -- matches sibling `scripts/refresh-counts.ts` pattern. Avoids depending
 * on a transitively-resolved `dotenv` package.
 */
```

**Phase 34 application:** Mirror header verbatim with substitutions: requirement ID = CAT-15, decision IDs = D-03/D-05, usage = `npm run db:backfill-catalog-brands [-- --patch-country=country.json]`, behavior = "Auto-derives brands from watches_catalog.brand and links brand_id". Sibling pattern reference: `scripts/backfill-catalog.ts`.

**Imports pattern** (Phase 17 lines 14–17):
```typescript
// Use relative imports -- tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watches } from '../src/db/schema'
import { sql } from 'drizzle-orm'
```

**Phase 34 application:**
```typescript
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
// brands/watchFamilies imports optional -- script uses raw SQL only (mirrors
// backfill-catalog.ts pattern of using `sql` template tag for the CTE upserts).
```

**CLI argument parsing pattern** (`scripts/backfill-taste.ts:39-49`):
```typescript
interface ParsedArgs {
  dryRun: boolean
  batchSize: number
  resume: boolean
}

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }))
  return {
    dryRun: args.get('dry-run') === 'true',
    batchSize: parseInt(args.get('batch-size') ?? '20', 10),
    resume: args.get('resume') === 'true' || !args.has('force'),
  }
}
```

**Phase 34 application:**
```typescript
interface ParsedArgs { patchCountry: string | null }

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    })
  )
  return { patchCountry: args.get('patch-country') ?? null }
}
```

**Idempotent batch loop pattern** (Phase 17 lines 26–67):
```typescript
const BATCH_SIZE = 100

while (true) {
  pass++
  const rows = await db.select({ ... })
    .from(watches)
    .where(sql`catalog_id IS NULL`)
    .limit(BATCH_SIZE)

  if (rows.length === 0) break

  for (const row of rows) {
    await db.execute(sql`
      WITH ins AS (
        INSERT INTO watches_catalog (brand, model, reference, source)
        VALUES (${row.brand}, ${row.model}, ${row.reference}, 'user_promoted')
        ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING
        RETURNING id
      ),
      existing AS (
        SELECT id FROM watches_catalog
         WHERE brand_normalized = lower(trim(${row.brand}))
           ...
      )
      UPDATE watches SET catalog_id = COALESCE(
        (SELECT id FROM ins LIMIT 1),
        (SELECT id FROM existing LIMIT 1)
      )
      WHERE id = ${row.id}
    `)
  }
}
```

**Phase 34 application:** Phase 34 backfill is a 3-pass script (not a per-row loop):

```typescript
async function passA_deriveBrands() {
  // Pass A: INSERT brands derived from DISTINCT watches_catalog.brand
  // ON CONFLICT (name_normalized) DO NOTHING -- idempotent
  await db.execute(sql`
    INSERT INTO brands (name, slug)
    SELECT DISTINCT ON (lower(trim(brand)))
           brand,
           lower(regexp_replace(trim(brand), '\\s+', '-', 'g'))
      FROM watches_catalog
     WHERE brand IS NOT NULL
     ORDER BY lower(trim(brand)), id ASC
    ON CONFLICT (name_normalized) DO NOTHING
  `)
}

async function passB_patchCountry(jsonPath: string) {
  const map = JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<string, string>
  for (const [nameNormalized, country] of Object.entries(map)) {
    await db.execute(sql`
      UPDATE brands
         SET country_of_origin = ${country}
       WHERE name_normalized = ${nameNormalized}
         AND country_of_origin IS NULL
    `)
  }
}

async function passC_linkCatalog() {
  // Pass C: UPDATE watches_catalog.brand_id via brand_normalized JOIN.
  // Idempotent on brand_id IS NULL.
  await db.execute(sql`
    UPDATE watches_catalog wc
       SET brand_id = b.id
      FROM brands b
     WHERE wc.brand_normalized = b.name_normalized
       AND wc.brand_id IS NULL
  `)
}
```

**Final assertion + console.table failure dump pattern** (Phase 17 lines 69–87):
```typescript
const remaining = await db.execute<{ c: number }>(sql`
  SELECT count(*)::int AS c FROM watches WHERE catalog_id IS NULL
`)
const count = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0

if (count !== 0) {
  const unlinked = await db.select({ ... })
    .from(watches).where(sql`catalog_id IS NULL`)
  console.error(`[backfill] FAILED -- ${count} watches unlinked:`)
  console.table(unlinked)
  process.exit(1)
}

const elapsedMs = Date.now() - startedAt
console.log(`[backfill] OK -- total linked: ${totalLinked}, unlinked remaining: 0, elapsed: ${elapsedMs}ms`)
process.exit(0)
```

**Phase 34 application:** Mirror exactly. Final assertion: `SELECT count(*) FROM watches_catalog WHERE brand_normalized IS NOT NULL AND brand_id IS NULL` should be 0. Failure dump shows `id, brand` columns. Log prefix: `[backfill-catalog-brands]`.

**Catch-all error pattern** (Phase 17 lines 90–93):
```typescript
main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
```

**Phase 34 application:** Identical with `[backfill-catalog-brands]` prefix.

**SQL injection defense:** All user-derived values flow through Drizzle's `sql\`...${value}...\`` template tag, which parameterizes binds. Never string-concatenate into SQL. Phase 17 D-14 / Phase 18 T-18-01-02 precedent (RESEARCH.md §Security Domain).

---

### `package.json` (MODIFIED — npm script entry add)

**Analog:** `package.json:12-16` (in-file template — existing `db:*` entries).

**Existing pattern** (lines 12–16):
```json
"db:backfill-catalog": "tsx --env-file=.env.local scripts/backfill-catalog.ts",
"db:refresh-counts": "tsx --env-file=.env.local scripts/refresh-counts.ts",
"db:backfill-taste": "tsx --env-file=.env.local scripts/backfill-taste.ts",
"db:reenrich-taste": "tsx --env-file=.env.local scripts/reenrich-taste.ts",
"db:preflight-notification-cleanup": "tsx --env-file=.env.local scripts/preflight-notification-types.ts"
```

**Phase 34 application — single new line:**
```json
"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"
```

**Placement:** Append to the `db:*` group (after `db:preflight-notification-cleanup` is fine; alphabetic sort would put it after `db:backfill-catalog` and before `db:backfill-taste` — either is acceptable, but appending preserves chronological introduction).

**No dependency changes:** Phase 34 ships ZERO new npm dependencies (RESEARCH.md §Standard Stack). `tsx`, `drizzle-orm`, `postgres`, `vitest`, `@supabase/supabase-js` all already installed.

---

### `docs/deploy-db-setup.md` (MODIFIED — append Phase 34 section)

**Analog:** Phase 17 §17.1–17.6 at lines 234–322 (in-file template).

**Section structure pattern** (Phase 17 lines 234–322):
```markdown
## Phase 17 -- Catalog Foundation Deploy Steps

Phase 17 adds the canonical `watches_catalog` table and pg_cron daily refresh. ...

### Preconditions
- Phase 17 PR is merged to `main`
- Local DB push is GREEN ...
- Supabase CLI linked to prod project ...
- `DATABASE_URL` for prod (session-mode pooler URL ...) is available

### 17.1 -- Apply migrations to prod
```bash
supabase db push --linked
```
Expected: CLI applies in this order (lexical filename sort): ...

Also push the Drizzle column-shape migration:
```bash
DATABASE_URL="<prod session-mode pooler URL>" \
  npx drizzle-kit migrate
```

### 17.2 -- Run the catalog backfill
Once-only, to link existing prod `watches` rows to `watches_catalog`:
```bash
DATABASE_URL="<prod session-mode pooler URL>" \
  npm run db:backfill-catalog
```
Expected: `[backfill] OK -- total linked: N, unlinked remaining: 0`

**Footgun T-17-BACKFILL-PROD-DB:** Do NOT run `npm run db:backfill-catalog` against the LOCAL Docker DB by accident. ...

### 17.3 -- Verify pg_cron schedule
... psql commands ...

### 17.6 -- Backout plan (if Phase 17 must be reverted post-deploy)
```

**Phase 34 application — section heading:** `## Phase 34 -- Layer A: Brand + Family Entities Deploy Steps` (mirrors Phase 17 / 19.1 naming).

**Phase 34 sub-sections (per CONTEXT.md D-06):**
- **34.1** — Apply migrations: `supabase db push --linked` (applies `20260510000000_phase34_brands_families.sql`); `DATABASE_URL=<prod> npx drizzle-kit migrate` (applies `0007_phase34_brands_families.sql`).
- **34.2** — Run the brand backfill: `DATABASE_URL=<prod> npm run db:backfill-catalog-brands` (NOTE the inline `DATABASE_URL=<prod>` form per Footgun T-17-BACKFILL-PROD-DB precedent at line 279).
- **34.3** — Verify RLS truth values:
  ```sql
  SELECT has_table_privilege('anon', 'public.brands', 'SELECT');         -- expect: t
  SELECT has_table_privilege('anon', 'public.watch_families', 'SELECT'); -- expect: t
  ```
- **34.4** — Verify backfill landed:
  ```sql
  SELECT COUNT(*) FROM brands;                                            -- expect: ~10–30
  SELECT COUNT(*) FROM watches_catalog WHERE brand_id IS NULL;            -- expect: 0 (or low)
  SELECT COUNT(*) FROM watch_families;                                    -- expect: 0 (deferred to Phase 35)
  SELECT COUNT(*) FROM watches_catalog WHERE family_id IS NULL;           -- expect: total catalog count
  ```
- **34.5** — Backout plan (analog to Phase 17 §17.6): `DROP TABLE watch_families; DROP TABLE brands;` is reversible because both are empty/lightly-populated; `ALTER TABLE watches_catalog DROP COLUMN brand_id, DROP COLUMN family_id;` is reversible because columns are nullable. **Caveat:** running backout on production AFTER Phase 35 ships becomes unsafe — document this as a Phase 34-only window.

**Footgun cross-reference:** Phase 34 §34.2 MUST cite Footgun T-17-BACKFILL-PROD-DB by name and reuse the inline `DATABASE_URL=<prod> npm run ...` form. Mirrors Phase 17 §17.2 line 269.

**Local DB reset workflow update** (CONTEXT.md / RESEARCH.md Open Question #4 — RECOMMENDED ship): Append to existing list at lines 386–404:
```markdown
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql
```

---

### `tests/integration/phase34-rls.test.ts` (NEW, optional but recommended)

**Analog (primary — env gating + service-role db pattern):** `tests/integration/phase17-secdef.test.ts`
**Analog (anon-client RLS shape):** `tests/integration/phase17-catalog-rls.test.ts`

**Imports pattern** (`phase17-secdef.test.ts:1-4`):
```typescript
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
```

**Phase 34 application:** Identical imports. May also import `randomUUID` from `'node:crypto'` if seed/cleanup logic is added (mirroring `phase17-catalog-rls.test.ts:13`).

**Env-gating skip pattern** (`phase17-secdef.test.ts:6-7`):
```typescript
const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? describe : describe.skip
```

**Phase 34 application:** Identical. Required env vars: `DATABASE_URL` (service-role for db.execute calls), `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon-client construction). RESEARCH.md Pitfall 4 recommends adding a localhost-assertion guard to prevent prod-pointed test runs — optional improvement on the precedent.

**`has_table_privilege` truth-value test pattern** (adapt from `phase17-secdef.test.ts:28-39` `has_function_privilege`):
```typescript
it('has_function_privilege checks anon=false, authenticated=false, service_role=true', async () => {
  const result = await db.execute<{ anon_can: boolean; authed_can: boolean; service_can: boolean }>(sql`
    SELECT
      has_function_privilege('anon',          'public.refresh_watches_catalog_counts()', 'EXECUTE') AS anon_can,
      has_function_privilege('authenticated', 'public.refresh_watches_catalog_counts()', 'EXECUTE') AS authed_can,
      has_function_privilege('service_role',  'public.refresh_watches_catalog_counts()', 'EXECUTE') AS service_can
  `)
  const row = (result as unknown as Array<{ anon_can: boolean; authed_can: boolean; service_can: boolean }>)[0]
  expect(row.anon_can).toBe(false)
  ...
})
```

**Phase 34 application:**
```typescript
it('has_table_privilege: anon SELECT on brands returns true', async () => {
  const result = await db.execute<{ can: boolean }>(sql`
    SELECT has_table_privilege('anon', 'public.brands', 'SELECT') AS can
  `)
  const row = (result as unknown as Array<{ can: boolean }>)[0]
  expect(row.can).toBe(true)
})
// Same shape for watch_families.
```

**Anon-client SELECT pattern** (`phase17-catalog-rls.test.ts:62-69`):
```typescript
it('anon can SELECT from watches_catalog', async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.from('watches_catalog').select('*')
  expect(error).toBeNull()
  expect(data).not.toBeNull()
  expect(data!.length).toBeGreaterThanOrEqual(1)
})
```

**Phase 34 application:** Mirror for `brands` and `watch_families`. NOTE: `data!.length` assertion may be 0 since `watch_families` ships empty — adapt to `expect(data).not.toBeNull()` only (drop the `.length >= 1` clause for empty tables).

**Anon-client INSERT-blocked pattern** (`phase17-catalog-rls.test.ts:71-83`):
```typescript
it('anon write blocked (INSERT) on watches_catalog', async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await anon.from('watches_catalog').insert({
    id: randomUUID(),
    brand: 'AnonInsert',
    model: 'AnonModel',
    source: 'user_promoted',
  })
  expect(error).not.toBeNull()
  const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
  expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
})
```

**Phase 34 application:**
```typescript
it('anon supabase-js INSERT INTO brands fails with RLS', async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await anon.from('brands').insert({ name: 'Test', slug: 'test' })
  expect(error).not.toBeNull()
  const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
  expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
})
```

**Schema introspection assertion pattern** (RESEARCH.md §Validation Architecture):
```typescript
it('watches_catalog.brand_id column exists with correct shape', async () => {
  const result = await db.execute<{ data_type: string; is_nullable: string }>(sql`
    SELECT data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id'
  `)
  const row = (result as unknown as Array<{ data_type: string; is_nullable: string }>)[0]
  expect(row.data_type).toBe('uuid')
  expect(row.is_nullable).toBe('YES')
})
```

**FK integrity test pattern** (RESEARCH.md §Validation Architecture point 5):
```typescript
it('FK integrity: INSERT into watches_catalog with non-existent brand_id fails', async () => {
  const fakeUuid = randomUUID()
  await expect(
    db.execute(sql`INSERT INTO watches_catalog (brand, model, brand_id) VALUES ('X', 'Y', ${fakeUuid}::uuid)`)
  ).rejects.toThrow()
})
```

---

### `scripts/country.json` (NEW, planner discretion)

**Analog:** None — first JSON data file in the project's `scripts/` directory.

**Recommended shape** (CONTEXT.md `<specifics>` lines 211–219):
```json
{
  "rolex": "Switzerland",
  "omega": "Switzerland",
  "casio": "Japan",
  "...": "..."
}
```

**Keys:** `name_normalized` values (lowercased, trimmed brand names — must match `brands.name_normalized`).
**Values:** ISO country names (free text; no enum constraint).

**Path placement:** `scripts/country.json` (RESEARCH.md Open Question #5 recommendation — colocate with consuming script). No `data/` directory exists in the project; do not create one.

**Initial content:** RESEARCH.md Open Question #1 recommends shipping a starter map covering ~10–30 brands likely in the user's collection (Rolex, Omega, Casio, Seiko, Patek Philippe, Cartier, Tudor, Grand Seiko, etc.). Operator extends post-auto-derivation by running `SELECT DISTINCT brand_normalized FROM watches_catalog ORDER BY 1`.

**Schema validation:** `scripts/backfill-catalog-brands.ts` does `JSON.parse(readFileSync(path, 'utf-8'))` defensively (RESEARCH.md §Security Domain). Non-JSON content fails fast.

---

## Shared Patterns

### Authentication / Authorization (RLS)
**Source:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql:166-185`
**Apply to:** Both new tables in `supabase/migrations/20260510000000_phase34_brands_families.sql`.

**Pattern:** Public-read (anon + authenticated SELECT allowed) + service-role-write (no policy → only DATABASE_URL connection bypasses RLS):
```sql
ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS <new_table>_select_all ON <new_table>;
CREATE POLICY <new_table>_select_all ON <new_table> FOR SELECT USING (true);
-- NO INSERT/UPDATE/DELETE policy. Service role bypasses RLS via DATABASE_URL pooler URL.
```

**Memory anchor:** `project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` alone does NOT block anon; this RLS pattern is the actual enforcement mechanism.

---

### Migration Idempotence
**Source:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql` (multiple sites)
**Apply to:** Every DDL statement in the Phase 34 Supabase migration.

**Patterns to use:**
- `CREATE TABLE IF NOT EXISTS <table> (...)`
- `CREATE INDEX IF NOT EXISTS <name> ON <table> (...)`
- `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type> ...`
- `DROP POLICY IF EXISTS <name> ON <table>;` then `CREATE POLICY <name> ...`
- `DROP TRIGGER IF EXISTS <name> ON <table>;` then `CREATE TRIGGER <name> ...`
- `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '<name>') THEN ALTER TABLE ... ADD CONSTRAINT <name> ... ; END IF; END $$;`

**Why:** `supabase db push --linked` may re-apply migrations during retries; local `supabase db reset` workflow re-applies everything. Idempotent guards mean re-runs are no-ops.

---

### Final Assertion Block (RAISE EXCEPTION)
**Source:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql:188-220`
**Apply to:** Every Supabase migration in this project.

**Pattern:**
```sql
DO $$
DECLARE
  feature_a_landed boolean;
  feature_b_landed boolean;
BEGIN
  SELECT EXISTS(...) INTO feature_a_landed;
  SELECT EXISTS(...) INTO feature_b_landed;

  IF NOT feature_a_landed THEN
    RAISE EXCEPTION 'Phase NN failed -- <feature> missing';
  END IF;
  IF NOT feature_b_landed THEN
    RAISE EXCEPTION 'Phase NN failed -- <feature> missing';
  END IF;
END $$;

COMMIT;
```

**Why:** A failed migration that reports success is the worst outcome. The assertion block is defense-in-depth — any of the dozens of `IF NOT EXISTS` / `CREATE OR REPLACE` patterns above silently succeeding when the underlying object isn't right would otherwise go unnoticed. The `RAISE EXCEPTION` aborts the entire `BEGIN...COMMIT` transaction.

---

### Service-Role DB Client Access
**Source:** `scripts/backfill-catalog.ts:14-17` + `package.json:12-16` (npm script entries)
**Apply to:** `scripts/backfill-catalog-brands.ts`.

**Pattern:**
```typescript
// Use relative imports -- tsx does not resolve @/* path aliases.
import { db } from '../src/db'
```

Combined with npm script entry:
```json
"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"
```

**Why:** `--env-file=.env.local` injects `DATABASE_URL` (service-role pooler URL) at script invocation. Importing `db` from `'../src/db'` (NOT `'@/db'`) avoids the path-alias resolution that `tsx` doesn't support.

**Footgun:** Operator MUST override `DATABASE_URL` inline when running against prod (`DATABASE_URL=<prod> npm run ...`). Documented at `docs/deploy-db-setup.md:279` (Footgun T-17-BACKFILL-PROD-DB).

---

### SQL Injection Defense (Drizzle parameterization)
**Source:** `scripts/backfill-catalog.ts:40-62` (ON CONFLICT inline parameter binds)
**Apply to:** All `db.execute(sql\`...\`)` calls in `scripts/backfill-catalog-brands.ts`.

**Pattern:**
```typescript
await db.execute(sql`
  UPDATE brands
     SET country_of_origin = ${country}     -- parameterized (safe)
   WHERE name_normalized = ${nameNormalized} -- parameterized (safe)
`)
```

**Anti-pattern (NEVER):**
```typescript
await db.execute(sql`UPDATE brands SET country_of_origin = '${country}'`)  // string concat -- vulnerable
```

**Why:** Drizzle's `sql` template tag converts `${value}` placeholders into parameterized binds. String concatenation into the template string defeats this and reintroduces SQL injection. `country.json` content is operator-controlled but still flows through the parameterized path as a defense-in-depth measure.

---

### Final Assertion + console.table Failure Dump (TS scripts)
**Source:** `scripts/backfill-catalog.ts:69-87`
**Apply to:** `scripts/backfill-catalog-brands.ts`.

**Pattern:**
```typescript
const remaining = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM <table> WHERE <still_unprocessed_predicate>`)
const count = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
if (count !== 0) {
  const offenders = await db.execute(sql`SELECT id, <key_cols> FROM <table> WHERE <still_unprocessed_predicate>`)
  console.error(`[<script-prefix>] FAILED -- ${count} rows unprocessed:`)
  console.table(offenders)
  process.exit(1)
}
console.log(`[<script-prefix>] OK -- ${totalProcessed} rows`)
process.exit(0)
```

**Why:** Loud failure with per-row diagnostic dump beats silent success. `console.table` formats nicely for operator console. `process.exit(1)` enables CI/operator scripts to detect and halt on failure.

---

### Filename Sequencing Discipline
**Source:** Memory `project_drizzle_supabase_db_mismatch.md` Rule 1 + Rule 2
**Apply to:** Both new migration files.

**Rules:**
- Drizzle migrations: monotonically increasing 4-digit prefix. Current max: `0006_phase27_sort_order.sql`. **Phase 34 → `0007_phase34_brands_families.sql`** (next sequential).
- Supabase migrations: 14-digit timestamp prefix. Current max: `20260504120000_phase27_sort_order.sql`. **Phase 34 → `20260510000000_phase34_brands_families.sql`** (May 10 2026 — buffered above today + above current max). NEVER decorate with suffix letters.

**Why:** `supabase db push --linked` applies in lexical order. Inserting between adjacent integers breaks the migration sequence on local-dev re-syncs.

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `scripts/country.json` | config (data file) | First JSON data file in project; no precedent for structured operator-edited data files. Pattern is invented in Phase 34 (small, low-risk — `JSON.parse` + flat object). |

---

## Metadata

**Analog search scope:**
- `supabase/migrations/` (26 files) — ranked by `phase17_catalog_schema.sql` (exact match for RLS + GENERATED + assertion patterns)
- `drizzle/` (8 files) — `0004_phase17_catalog.sql` is the natural twin for table+ALTER+FK shape
- `src/db/schema.ts` (350+ lines) — in-file template; Phase 34 modifies the existing `watchesCatalog` block and adds 2 new exports
- `scripts/` (5 .ts files) — `backfill-catalog.ts` (primary) + `backfill-taste.ts` (CLI args)
- `tests/integration/` (35 files) — `phase17-secdef.test.ts` (env gating) + `phase17-catalog-rls.test.ts` (anon-client RLS shape)
- `docs/deploy-db-setup.md` (lines 234–419) — Phase 17 §17.1–17.6 sectional template + Phase 19.1 local-reset template
- `package.json` — in-file template (existing `db:*` entries)

**Files scanned:** ~75 (all relevant phase 17 / 19.1 / 27 analogs read in full or via targeted offsets).

**Pattern extraction date:** 2026-05-09

**Key insight:** Phase 34 has zero novel architectural decisions. Every pattern is a verbatim adaptation of Phase 17 (RLS + GENERATED + assertion) or Phase 19.1 (CLI args, backfill rhythm). The planner should resist any urge to "improve on" the precedent — Phase 17 patterns are battle-tested in prod since 2026-04-27. The one Phase-34-specific pattern (`scripts/country.json` operator-edited data file) is small enough that no precedent is needed.
