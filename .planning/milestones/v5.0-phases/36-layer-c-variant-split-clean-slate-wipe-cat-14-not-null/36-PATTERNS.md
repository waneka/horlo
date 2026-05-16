# Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL — Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 6 / 6 (all exact role-match precedents)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` (MODIFY — add `watchVariants` pgTable + `variantId` FK on `watches` + optional `.notNull()` on `catalogId`) | Drizzle schema definition (TS source of truth) | Build-time type inference | `src/db/schema.ts` lines 377–414 (`brands` + `watchFamilies`) + lines 420–444 (`watchLineageEdges`) + lines 65–134 (`watches`, current `catalogId`) | exact (same file, same pattern, in-file precedent) |
| `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` (NEW) | Supabase migration — authoritative DDL (RLS + GRANT + DO $$ + ALTER) | DDL transaction (BEGIN…COMMIT) | `supabase/migrations/20260510000001_phase35_layer_b.sql` (full file) + `supabase/migrations/20260510000000_phase34_brands_families.sql` (idempotent DO $$ FK guard pattern) | exact (same role + same data flow, modulo TRUNCATE removal + FIRST-position DO $$) |
| `drizzle/0009_phase36_layer_c_variants.sql` (NEW) | Drizzle migration — structural twin | DDL (idempotent: IF NOT EXISTS + DO $$ FK guard) | `drizzle/0008_phase35_layer_b.sql` | exact |
| `drizzle/meta/_journal.json` (MODIFY — append `idx=9`) | Drizzle journal entry (build artifact) | JSON append | Existing `idx=8` entry for Phase 35 (lines 61–67) | exact |
| `tests/integration/phase36-rls.test.ts` (NEW) | Vitest integration test (RLS + schema + CAT-14 assertions) | DB introspection + anon supabase-js client | `tests/integration/phase34-rls.test.ts` (full file — Phase 35 did not ship a sibling RLS test, so Phase 34 is the cleanest analog) | exact (RESEARCH.md §Validation Architecture mandates verbatim shape) |
| `docs/deploy-db-setup.md` (MODIFY — append Phase 36 section) | Deploy runbook append | Markdown documentation | `docs/deploy-db-setup.md` lines 671–823 (Phase 35 section: §35.0 pg_depend → §35.1 push → §35.6 smoke → §35.7 cycle test → §35.8 local re-sync) + lines 554–667 (Phase 34 section) | exact |

---

## Pattern Assignments

### `src/db/schema.ts` (Drizzle schema definition, build-time type inference)

**Analog 1 (entity-table shape) — `src/db/schema.ts` lines 377–414 (`brands` + `watchFamilies`)**

Excerpt (showing how `pgTable` + `defaultRandom().primaryKey()` + `references(() => parent.id, { onDelete: 'restrict' })` + `unique(...)` + `index(...)` compose for a public catalog-tier entity table):

```typescript
// Lines 377–394 — brands (the shape watchVariants must mirror)
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').generatedAlwaysAs(
      sql`lower(trim(name))`,
    ),
    slug: text('slug').notNull().unique(),
    countryOfOrigin: text('country_of_origin'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brands_name_normalized_unique').on(table.nameNormalized),
  ]
)
```

**Analog 2 (FK to `watchesCatalog` + composite UNIQUE constraint) — `src/db/schema.ts` lines 420–444 (`watchLineageEdges`)**

Excerpt — this is the closest analog because it ALSO references `watchesCatalog.id` with `onDelete: 'restrict'` and uses a composite `unique(...)` on the secondary index columns:

```typescript
// Lines 420–444 — watchLineageEdges (closest FK pattern for watch_variants.catalog_id)
export const watchLineageEdges = pgTable(
  'watch_lineage_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    predecessorCatalogId: uuid('predecessor_catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    successorCatalogId: uuid('successor_catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    relationshipType: lineageRelationshipTypeEnum('relationship_type').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_lineage_edges_predecessor_idx').on(table.predecessorCatalogId),
    index('watch_lineage_edges_successor_idx').on(table.successorCatalogId),
    unique('lineage_edges_unique_triple').on(
      table.predecessorCatalogId,
      table.successorCatalogId,
      table.relationshipType,
    ),
  ],
)
```

**Analog 3 (in-file precedent for nullable FK column on `watches`) — `src/db/schema.ts` line 118 (`catalogId`)**

Excerpt:

```typescript
// Line 116–118 — existing catalogId column (the shape watches.variantId mirrors VERBATIM
// modulo the lazy callback target: () => watchVariants.id instead of () => watchesCatalog.id)
// Phase 17: catalog FK — nullable, ON DELETE SET NULL (CAT-04, D-catalog-14: NEVER SET NOT NULL in v4.0)
// Forward-reference resolved lazily by Drizzle (watchesCatalog defined below).
catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

**Excerpt to mirror — final `watchVariants` definition (composite of analogs 1 + 2; insertion point: between line 444 and line 449, immediately below `watchLineageEdges`):**

```typescript
// ----- Phase 36 D-02..D-05: watch_variants table (CAT-17) -----
// RLS public-read + GRANT SELECT to anon/authenticated co-located in
// supabase/migrations/20260511000000_phase36_layer_c_variants.sql.
// Same Drizzle-vs-Supabase migration split as Phase 34/35: Drizzle = column shapes;
// Supabase = authoritative DDL including RLS + GRANT + DO $$ pre-flight + assertions.
export const watchVariants = pgTable(
  'watch_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    // slug is set explicitly (NOT GENERATED) per D-02 — URL-stable across name edits.
    slug: text('slug').notNull(),
    dialColor: text('dial_color'),
    bezel: text('bezel'),
    braceletVariant: text('bracelet_variant'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_variants_catalog_id_idx').on(table.catalogId),
    unique('watch_variants_catalog_slug_unique').on(table.catalogId, table.slug),
  ],
)
```

**Excerpt to mirror — edit on `watches` (lines 116–123):**

```typescript
// CHANGED in Phase 36 (Pitfall 6 — tighten to match prod): catalogId becomes .notNull().
// Without this, TypeScript still treats watch.catalogId as string | null even though
// prod has flipped to NOT NULL via the Supabase migration.
catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'set null' }),

// NEW in Phase 36 (D-04): variant_id FK. Nullable; ON DELETE SET NULL preserves user data.
// No NOT NULL flip scheduled — variants will never hit 100% coverage.
variantId: uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' }),

// Phase 27 — sort_order for wishlist drag-reorder (D-01).
sortOrder: integer('sort_order').notNull().default(0),
```

**Deviations from analog 1 / 2 required for Phase 36:**
- NO `nameNormalized` GENERATED column (D-02 — variants need URL-stable slug + free-form name; normalization would conflict with curator-controlled identity like "Kermit" vs "kermit").
- NO `.notNull().unique()` on `slug` (uniqueness is composite: `(catalog_id, slug)`, not global).
- NO `slug` as `text('slug')` nullable (Phase 34's `watch_families.slug` IS nullable; Phase 36's IS NOT NULL — required for the `/watch/{ref}/{slug}` Phase 39 route).
- NO `nameNormalized` UNIQUE — uniqueness is on `(catalog_id, slug)`, not on name.

**Gotchas (cite RESEARCH.md §Risks & Landmines):**
- Risk #4 / Pitfall 5: FK cascade clause MUST be `'restrict'` on `watchVariants.catalogId` and `'set null'` on `watches.variantId`. Easy to copy-paste the wrong one — D-03 vs D-04.
- Risk #8 / Pitfall 6: If you SKIP the `.notNull()` on `catalogId`, `InferSelectModel<typeof watches>.catalogId` keeps reporting `string | null`. Downstream Phase 38 LEFT JOIN code will defensively null-check a value that can no longer be null. Plan-phase REC = include the edit.
- Forward-reference: `watchVariants` must be defined BEFORE the `watches` edit references `() => watchVariants.id`. Drizzle's `() =>` lazy callback resolves at table-instantiation time, not import time, so positional order in the file is technically flexible — but for readability, declare `watchVariants` first, then add the `variantId` line to `watches`. Same pattern used by `watchesCatalog` / `watches.catalogId` (catalog declared at line 298, referenced from line 118 via lazy callback).

---

### `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` (Supabase migration — authoritative DDL)

**Analog 1 (full file structure: BEGIN → DDL → end-of-migration DO $$ post-assertion → COMMIT) — `supabase/migrations/20260510000001_phase35_layer_b.sql` (210 lines, full file)**

Excerpt (header + transaction open + RLS/GRANT block — the Phase 36 mirror is verbatim modulo table names):

```sql
-- Phase 35 — Layer B: Lineage Edges + Structured Movement + Era/Material (CAT-16)
-- Source: 35-CONTEXT.md D-01..D-14; 35-RESEARCH.md §3, §4, §5, §6, §9
-- Sibling Drizzle migration: drizzle/0008_phase35_layer_b.sql (column shapes only — no RLS, no trigger, no CHECK)
-- Threats mitigated: T-35-01 (anon write blocked by RLS service-role-only), T-35-03 (cycle trigger),
--                    T-35-04 (TRUNCATE-first eliminates movement value-mapping risk per D-02; pg_depend pre-flight in deploy runbook),
--                    T-35-05 (ON DELETE RESTRICT on lineage edge FKs catches catalog deletions).

BEGIN;

-- ============================================================================
-- STEP 6: RLS + GRANT (Phase 34 pattern verbatim; T-35-01 mitigation).
-- Per memory rule project_supabase_secdef_grants.md: REVOKE FROM PUBLIC alone is insufficient;
-- explicit GRANT SELECT TO anon, authenticated is mandatory. service_role bypasses RLS for writes.
-- ============================================================================
ALTER TABLE watch_lineage_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lineage_edges_select_all ON watch_lineage_edges;
CREATE POLICY lineage_edges_select_all ON watch_lineage_edges FOR SELECT USING (true);
GRANT SELECT ON watch_lineage_edges TO anon, authenticated;
```

Excerpt (end-of-migration DO $$ post-assertion — lines 127–207 — the Phase 36 mirror copies the SHAPE, with different DECLARE variables and EXISTS checks):

```sql
-- ============================================================================
-- STEP 7: Final assertion block (Phase 17 §8 / Phase 34 pattern).
-- Raises RAISE EXCEPTION on any schema invariant failure; transaction aborts atomically.
-- ============================================================================
DO $$
DECLARE
  movement_type_enum_exists      boolean;
  lineage_table_exists           boolean;
  lineage_select_policy_exists   boolean;
  anon_can_select_lineage        boolean;
  cycle_trigger_exists           boolean;
  -- ... (more DECLARE vars)
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type_enum')         INTO movement_type_enum_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='watch_lineage_edges')
    INTO lineage_table_exists;
  SELECT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND policyname='lineage_edges_select_all')
    INTO lineage_select_policy_exists;
  SELECT has_table_privilege('anon', 'public.watch_lineage_edges', 'SELECT')
    INTO anon_can_select_lineage;
  -- ... (more SELECT INTO assignments)

  IF NOT movement_type_enum_exists       THEN RAISE EXCEPTION 'Phase 35 failed -- movement_type_enum type missing'; END IF;
  IF NOT lineage_table_exists            THEN RAISE EXCEPTION 'Phase 35 failed -- watch_lineage_edges table missing'; END IF;
  IF NOT lineage_select_policy_exists    THEN RAISE EXCEPTION 'Phase 35 failed -- lineage_edges_select_all policy missing'; END IF;
  IF NOT anon_can_select_lineage         THEN RAISE EXCEPTION 'Phase 35 failed -- anon cannot SELECT watch_lineage_edges (T-35-01 mitigation broken)'; END IF;
  -- ... (more IF NOT … RAISE EXCEPTION lines)
END $$;

COMMIT;
```

Excerpt (`watch_lineage_edges` CREATE TABLE + cycle prevention CHECK + UNIQUE — Phase 36 mirrors the CREATE TABLE + UNIQUE bits; omits the CHECK + cycle trigger):

```sql
-- Lines 60–73 — watch_lineage_edges (closest CREATE TABLE pattern for watch_variants)
CREATE TABLE watch_lineage_edges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  successor_catalog_id   uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  relationship_type      lineage_relationship_type NOT NULL,
  metadata               jsonb NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_loop                CHECK (predecessor_catalog_id <> successor_catalog_id),
  CONSTRAINT lineage_edges_unique_triple UNIQUE (predecessor_catalog_id, successor_catalog_id, relationship_type)
);

CREATE INDEX watch_lineage_edges_predecessor_idx ON watch_lineage_edges (predecessor_catalog_id);
CREATE INDEX watch_lineage_edges_successor_idx   ON watch_lineage_edges (successor_catalog_id);
```

**Analog 2 (updated_at trigger pattern — Phase 34) — `supabase/migrations/20260510000000_phase34_brands_families.sql` lines 26–30**

Excerpt — Phase 36's `watch_variants_set_updated_at()` trigger is a verbatim re-shape:

```sql
CREATE OR REPLACE FUNCTION brands_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS brands_set_updated_at_trg ON brands;
CREATE TRIGGER brands_set_updated_at_trg BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION brands_set_updated_at();
```

**Analog 3 (Phase 35 cycle-trigger function — `RAISE EXCEPTION` with `%` format markers) — `supabase/migrations/20260510000001_phase35_layer_b.sql` lines 100–104**

Excerpt — the syntactic precedent for Phase 36's FIRST-statement `RAISE EXCEPTION` is here:

```sql
-- Phase 35 RAISE EXCEPTION pattern — identical syntax to Phase 36's DO $$ pre-flight
RAISE EXCEPTION 'Lineage cycle detected: % -> %',
  NEW.predecessor_catalog_id, NEW.successor_catalog_id;
```

**Excerpt to mirror — final Phase 36 supabase migration (composed from analogs 1 + 2 + 3, per RESEARCH.md §Migration Statement Ordering / §Supabase migration — full file template):**

```sql
-- supabase/migrations/20260511000000_phase36_layer_c_variants.sql
-- Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL (CAT-17 + CAT-14)
-- Source: 36-CONTEXT.md D-01..D-07; 36-RESEARCH.md §Migration Statement Ordering
-- Sibling Drizzle migration: drizzle/0009_phase36_layer_c_variants.sql (column shapes only — no RLS, no DO $$, no GRANT)
-- Threats mitigated: T-36-01 (anon write blocked by RLS service-role-only),
--                    T-36-02 (anon read via GRANT SELECT per memory project_supabase_secdef_grants.md),
--                    T-36-03 (FK orphans blocked by ON DELETE RESTRICT on watch_variants.catalog_id),
--                    T-36-04 (CAT-14 silent application — DO $$ pre-flight rolls back the entire
--                             transaction if any orphan exists).
--
-- Inheritance: Phase 35 D-02 already wiped + re-seeded prod on 2026-05-10. Phase 36 does NOT re-wipe.
-- Per memory rule project_drizzle_supabase_db_mismatch.md rule 4 + 4a, pg_depend pre-flight runs in
-- docs/deploy-db-setup.md §36.0 BEFORE this file is applied to prod.

BEGIN;

-- ============================================================================
-- STEP 0: CAT-14 pre-flight (D-07). FIRST STATEMENT per ROADMAP success #3.
-- ============================================================================
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows in watches have NULL catalog_id. Run npm run db:backfill-catalog or inspect manually (see docs/deploy-db-setup.md Phase 36 recovery flow), then retry the migration.', orphan_count;
  END IF;
END $$;

-- STEP 1: CREATE TABLE watch_variants (D-02) — mirrors watch_lineage_edges shape
CREATE TABLE watch_variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  slug              text NOT NULL,
  dial_color        text,
  bezel             text,
  bracelet_variant  text,
  image_url         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_variants_catalog_slug_unique UNIQUE (catalog_id, slug)
);

CREATE INDEX watch_variants_catalog_id_idx ON watch_variants(catalog_id);

-- STEP 2: updated_at trigger (Phase 34 pattern verbatim)
CREATE OR REPLACE FUNCTION watch_variants_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_variants_set_updated_at_trg ON watch_variants;
CREATE TRIGGER watch_variants_set_updated_at_trg BEFORE UPDATE ON watch_variants
  FOR EACH ROW EXECUTE FUNCTION watch_variants_set_updated_at();

-- STEP 3: RLS + GRANT (D-05; T-36-01 + T-36-02 mitigation) — Phase 35 §STEP 6 verbatim
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;

-- STEP 4: ADD COLUMN watches.variant_id (D-04)
ALTER TABLE watches
  ADD COLUMN variant_id uuid NULL
    REFERENCES watch_variants(id) ON DELETE SET NULL;

-- STEP 5: CAT-14 NOT NULL flip — load-bearing constraint change
ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;

-- STEP 6: Final assertion block — Phase 35 §STEP 7 pattern (different DECLARE vars / EXISTS checks)
DO $$
DECLARE
  watch_variants_table_exists           boolean;
  watch_variants_select_policy_exists   boolean;
  anon_can_select_variants              boolean;
  variant_id_col_exists                 boolean;
  catalog_id_is_not_null                boolean;
  watch_variants_catalog_slug_unique    boolean;
  variant_id_fk_set_null                boolean;
  variant_catalog_id_fk_restrict        boolean;
BEGIN
  -- (see RESEARCH.md §Supabase migration — full file template for the 8 SELECT INTO + 8 IF NOT … RAISE EXCEPTION lines)
END $$;

COMMIT;
```

**Deviations from Phase 35 analog required for Phase 36:**
1. **NOVEL — FIRST-position DO $$ pre-flight.** Phase 35's DO $$ sits at the END (lines 127–207) as a post-assertion. Phase 36's FIRST DO $$ is a PRE-flight assertion that runs BEFORE any DDL. Same PL/pgSQL syntax (`DO $$ DECLARE … BEGIN … END $$;`); different position (first, not last). The PRE-flight raises if `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL > 0` — rolling back BEFORE any CREATE TABLE / ALTER TABLE runs. RESEARCH.md §DO $$ Pre-flight Block — Rollback semantics § confirms: because the pre-flight is the FIRST statement, the rollback is a clean no-op on the live schema. ROADMAP success #3 verbatim requires the pre-flight be FIRST.
2. **NO `TRUNCATE`.** Phase 35 began with `TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE;` (D-02). Phase 36 INHERITS that wipe; does NOT re-execute it. CONTEXT.md D-01 + RESEARCH.md §Phase 35 D-02 inheritance.
3. **NO `CREATE TYPE` statements.** Phase 35 created 3 pgEnums (`movement_type_enum`, `lineage_relationship_type`, `watch_era`). Phase 36 adds zero new pgEnums — all variant attrs are free text per D-02 (mirrors Phase 35 D-10/D-11 specialty values).
4. **NO BEFORE INSERT cycle trigger.** Phase 35's `check_lineage_cycle()` + `trg_check_lineage_cycle` (lines 87–111) has no Phase 36 analog — variants form a flat (catalog_id → variant_id) relationship, not a graph.
5. **HAS an `ALTER TABLE … ALTER COLUMN SET NOT NULL`.** Phase 35 had none. Phase 36's STEP 5 is the load-bearing CAT-14 change; the FIRST DO $$ protects this statement.
6. **HAS an `ALTER TABLE watches ADD COLUMN variant_id`.** Phase 35's `ALTER TABLE watches` only DROPped + ADDed `movement_type` / `movement_caliber`. Phase 36 adds one new FK column.

**Gotchas (cite RESEARCH.md §Risks & Landmines + Pitfalls):**
- **Pitfall 1 / Risk #1 — Migration filename collision.** Highest existing = `20260510000001_phase35_layer_b.sql`. Phase 36 MUST be `20260511000000_phase36_layer_c_variants.sql` (strictly greater per memory rule 1+2). Plan-checker should `ls -1 supabase/migrations/ | tail -1` before write.
- **Pitfall 2 / Risk #5 — DO $$ pre-flight not FIRST.** ROADMAP success #3 verbatim says FIRST. Plan-checker MUST grep `head -25 <migration>` and confirm `DO $$` appears before any `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX`. The STEP 0 comment block above the DO $$ enforces this visually.
- **Pitfall 3 / Risk #2+3 — GRANT SELECT omission.** `CREATE POLICY` alone is NOT sufficient — memory `project_supabase_secdef_grants.md` says `REVOKE FROM PUBLIC` alone does not block anon, AND explicit `GRANT SELECT` is required for anon SELECT to actually work. The 4-line block (`ALTER TABLE … ENABLE; DROP POLICY IF EXISTS; CREATE POLICY; GRANT SELECT`) is non-negotiable.
- **Pitfall 5 / Risk #4 — FK cascade clause drift.** `watch_variants.catalog_id` MUST be `ON DELETE RESTRICT` (D-03); `watches.variant_id` MUST be `ON DELETE SET NULL` (D-04). The post-assertion DO $$ verifies via `pg_constraint.confdeltype` (`'r'` = RESTRICT, `'n'` = SET NULL, `'c'` = CASCADE).
- **Atomicity guarantee** (RESEARCH.md §Rollback semantics): all 6 steps run inside one `BEGIN; … COMMIT;` transaction. If any DDL fails OR if the FIRST DO $$ raises OR if the LAST DO $$ raises, the entire transaction rolls back. Splitting Phase 36 into multiple migration files would break this guarantee.

---

### `drizzle/0009_phase36_layer_c_variants.sql` (Drizzle migration — structural twin)

**Analog — `drizzle/0008_phase35_layer_b.sql` (full file, 97 lines)**

Excerpt (header + `CREATE TABLE IF NOT EXISTS` + DO-block FK guard — the exact pattern Phase 36 mirrors):

```sql
-- Phase 35 — Layer B: Lineage Edges + Structured Movement + Era/Material (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260510000001_phase35_layer_b.sql (the authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no trigger, no CHECK constraint —
-- those live exclusively in the Supabase migration.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → drizzle-kit push → docker exec psql < this file
-- so every CREATE / ALTER must be IF NOT EXISTS.

-- ----- watch_lineage_edges table -----
CREATE TABLE IF NOT EXISTS "watch_lineage_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "predecessor_catalog_id" uuid NOT NULL,
  "successor_catalog_id" uuid NOT NULL,
  "relationship_type" "lineage_relationship_type" NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lineage_edges_unique_triple" UNIQUE ("predecessor_catalog_id", "successor_catalog_id", "relationship_type")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_lineage_edges_predecessor_catalog_id_fk'
      AND conrelid = 'watch_lineage_edges'::regclass
  ) THEN
    ALTER TABLE "watch_lineage_edges"
      ADD CONSTRAINT "watch_lineage_edges_predecessor_catalog_id_fk"
      FOREIGN KEY ("predecessor_catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_lineage_edges_predecessor_idx" ON "watch_lineage_edges" USING btree ("predecessor_catalog_id");
```

**Excerpt to mirror — final Phase 36 Drizzle migration (verbatim shape, RESEARCH.md §Idempotent Drizzle migration):**

```sql
-- Phase 36 — Layer C: watch_variants table + watches.variant_id (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260511000000_phase36_layer_c_variants.sql (authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no GRANT, no DO $$ pre-flight —
-- those live exclusively in the Supabase migration.

CREATE TABLE IF NOT EXISTS "watch_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "dial_color" text,
  "bezel" text,
  "bracelet_variant" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "watch_variants_catalog_slug_unique" UNIQUE ("catalog_id", "slug")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_variants_catalog_id_fk'
      AND conrelid = 'watch_variants'::regclass
  ) THEN
    ALTER TABLE "watch_variants"
      ADD CONSTRAINT "watch_variants_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_variants_catalog_id_idx" ON "watch_variants" USING btree ("catalog_id");
--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watches_variant_id_fk'
      AND conrelid = 'watches'::regclass
  ) THEN
    ALTER TABLE "watches"
      ADD CONSTRAINT "watches_variant_id_fk"
      FOREIGN KEY ("variant_id") REFERENCES "public"."watch_variants"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
-- Phase 36 CAT-14: the NOT NULL flip lives in the Supabase migration, NOT here.
-- Drizzle's migrate path runs AFTER supabase db push has already applied the SET NOT NULL.
-- SET NOT NULL on an already-NOT-NULL column is a no-op in Postgres (idempotent).
ALTER TABLE "watches" ALTER COLUMN "catalog_id" SET NOT NULL;
```

**Deviations from Phase 35 analog required for Phase 36:**
1. **HAS a trailing `ALTER COLUMN SET NOT NULL`** — Phase 35 had none. RESEARCH.md §Assumption A1 confirms idempotency (SET NOT NULL on already-NOT-NULL is a no-op).
2. **NO `CREATE TYPE IF NOT EXISTS` DO blocks** — Phase 35 had 3 (movement_type_enum, lineage_relationship_type, watch_era). Phase 36 adds zero pgEnums.
3. **NO `DROP COLUMN IF EXISTS`** — Phase 35 dropped the legacy `movement` column on watches + watches_catalog. Phase 36 drops nothing.
4. **Two `CREATE TABLE` + FK guards** in Phase 35 collapse to ONE in Phase 36 (`watch_variants`). Phase 36 ALSO adds one new `ALTER TABLE watches ADD COLUMN IF NOT EXISTS variant_id` + FK guard.

**Gotchas (cite RESEARCH.md §Risks & Landmines):**
- **No RLS, no GRANT, no DO $$ pre-flight in this file.** Those live exclusively in the Supabase migration. Drizzle-kit ignores RLS/GRANT clauses or emits malformed DDL (RESEARCH.md §Anti-Patterns).
- **`--> statement-breakpoint` markers between every statement.** Phase 34 / Phase 35 both use these; drizzle-kit's parser splits on them. Missing markers may cause silent fail on multi-statement apply.
- **Idempotency MUST hold** — local re-sync recipe runs `drizzle-kit push` AFTER `supabase db reset` may have already applied parts. Every `CREATE TABLE` is `IF NOT EXISTS`; every `ADD COLUMN` is `IF NOT EXISTS`; every FK ADD is wrapped in `DO $$ IF NOT EXISTS pg_constraint`.
- **DEBT-12 / Pitfall 7** — prod's `drizzle.__drizzle_migrations` table has only `idx=0`. `drizzle-kit migrate` against prod will try idx=1..8 first and fail on `relation "watches" already exists`. Plan-phase decision: skip drizzle-kit migrate on prod for Phase 36 (rely on `supabase db push --linked` only). The Drizzle migration is documentation + local re-sync support.

---

### `drizzle/meta/_journal.json` (Drizzle journal entry — build artifact)

**Analog — `drizzle/meta/_journal.json` lines 61–67 (Phase 35's idx=8 entry)**

Excerpt:

```json
{
  "idx": 8,
  "version": "7",
  "when": 1778393232709,
  "tag": "0008_phase35_layer_b",
  "breakpoints": true
}
```

**Excerpt to mirror — append to the `entries` array (between current closing `}` of idx=8 entry and the closing `]` of the array):**

```json
,
    {
      "idx": 9,
      "version": "7",
      "when": <unix-ms-at-generation>,
      "tag": "0009_phase36_layer_c_variants",
      "breakpoints": true
    }
```

Note: `<unix-ms-at-generation>` is filled in by `drizzle-kit generate` when the migration file is created. If hand-edited, use `Date.now()` or `date +%s%3N`.

**Deviations from analog:** none — exact same shape, only `idx`, `when`, `tag` differ.

**Gotchas (cite RESEARCH.md §Anti-Patterns + §Common Pitfalls):**
- **MUST be appended in the SAME task/commit as the migration file.** Without the `idx=9` entry, `drizzle-kit migrate` silently SKIPS the new SQL file — prod `__drizzle_migrations` row count stays unchanged (silent no-op). STATE.md Accumulated Context captures this as a Phase 34 Plan 01 lesson.
- **JSON syntax — trailing comma trap.** The current closing `}` of the idx=8 entry has NO trailing comma. The new idx=9 entry MUST add a `,` after the idx=8 `}` (or use `drizzle-kit generate` which handles this).
- **`idx` MUST be exactly 9.** No insertion between adjacent integers (memory rule 2 mirror — applies to journal idx as well as filename timestamps).

---

### `tests/integration/phase36-rls.test.ts` (Vitest integration test)

**Analog — `tests/integration/phase34-rls.test.ts` (full file, 132 lines)**

Phase 35 did not ship a sibling `phase35-rls.test.ts` file (verified via `ls tests/integration/ | grep phase35` returns nothing). RESEARCH.md §Validation Architecture explicitly mandates `phase34-rls.test.ts` as the analog.

Excerpt (file header + localhost guard + `maybe` describe block + has_table_privilege + anon SELECT test — Phase 36 mirrors this VERBATIM with `brands` → `watch_variants`):

```typescript
/**
 * Phase 34 — Layer A RLS + schema introspection integration tests (CAT-15).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Pitfall 4 mitigation below: tests skip
 * if DATABASE_URL doesn't look like localhost.
 *
 * Threats covered:
 *   - T-34-01 (anon write): anon INSERT into brands / watch_families is blocked
 *   - T-34-02 (anon read enabled): has_table_privilege returns true; SELECT works
 *   - T-34-03 (FK orphans): non-existent brand_id INSERT raises FK violation
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'

// Pitfall 4: assert localhost to prevent accidental prod runs.
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip

maybe('Phase 34 RLS + schema introspection — brands + watch_families (CAT-15)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // -------- T-34-02: anon SELECT privilege --------
  it('has_table_privilege: anon can SELECT brands (T-34-02)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.brands', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  // -------- T-34-01: anon INSERT blocked --------
  it('anon supabase-js INSERT INTO brands fails with RLS (T-34-01)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.from('brands').insert({ name: 'AnonBrand', slug: 'anon-brand' })
    expect(error).not.toBeNull()
    const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
    expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
  })

  // -------- T-34-03: FK integrity (orphan prevention) --------
  it('FK integrity: INSERT into watches_catalog with non-existent brand_id fails (T-34-03)', async () => {
    const fakeUuid = randomUUID()
    await expect(
      db.execute(sql`
        INSERT INTO watches_catalog (brand, model, brand_id)
        VALUES ('FK-Test', 'FK-Model-' || gen_random_uuid()::text, ${fakeUuid}::uuid)
      `)
    ).rejects.toThrow()
  })
})
```

**Excerpt to mirror — final Phase 36 test file (composed from analog + RESEARCH.md §Code Examples §Integration test §Phase Requirements → Test Map). 11+ `it()` blocks covering all CAT-17 + CAT-14 behaviors:**

```typescript
/**
 * Phase 36 — Layer C RLS + schema introspection integration tests (CAT-17 + CAT-14).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Pitfall 4 mitigation below: tests skip
 * if DATABASE_URL doesn't look like localhost.
 *
 * Threats covered:
 *   - T-36-01 (anon write): anon INSERT into watch_variants is blocked
 *   - T-36-02 (anon read enabled): has_table_privilege returns true; SELECT works
 *   - T-36-03 (FK orphans): non-existent catalog_id INSERT raises FK violation
 *   - T-36-04 (CAT-14): watches.catalog_id is_nullable = 'NO'
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'

const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip

maybe('Phase 36 RLS + schema introspection — watch_variants + CAT-14 (CAT-17, CAT-14)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // T-36-02 — anon SELECT privilege
  it('has_table_privilege: anon can SELECT watch_variants (T-36-02)', async () => { /* ... */ })
  it('anon supabase-js SELECT * FROM watch_variants works (T-36-02)', async () => { /* ... */ })

  // T-36-01 — anon INSERT blocked
  it('anon supabase-js INSERT INTO watch_variants fails with RLS (T-36-01)', async () => { /* ... */ })

  // T-36-04 — CAT-14
  it('watches.catalog_id is NOT NULL after Phase 36 (CAT-14)', async () => { /* ... */ })
  it('INSERT into watches with NULL catalog_id fails with NOT NULL violation (CAT-14)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches (user_id, brand, model, status, catalog_id)
        VALUES (${randomUUID()}, 'TestBrand', 'TestModel', 'wishlist', NULL)
      `)
    ).rejects.toMatchObject({ code: '23502' }) // not_null_violation
  })

  // Schema introspection — column shape + UNIQUE + FK cascade clauses
  it('watch_variants table has all 10 expected columns', async () => { /* ... */ })
  it('watch_variants has UNIQUE (catalog_id, slug)', async () => { /* ... */ })
  it('watches.variant_id FK has ON DELETE SET NULL', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watches'::regclass AND a.attname='variant_id'
    `)
    expect((result as unknown as Array<{ confdeltype: string }>)[0].confdeltype).toBe('n')
  })
  it('watch_variants.catalog_id FK has ON DELETE RESTRICT', async () => {
    // confdeltype = 'r' = RESTRICT
  })

  // T-36-03 — FK orphan rejection
  it('INSERT into watch_variants with non-existent catalog_id fails (T-36-03)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watch_variants (catalog_id, name, slug)
        VALUES (${randomUUID()}, 'OrphanVariant', 'orphan-variant')
      `)
    ).rejects.toMatchObject({ code: '23503' }) // foreign_key_violation
  })
})
```

(See RESEARCH.md §Code Examples §Integration test for the full body of each `it()` block.)

**Deviations from Phase 34 analog required for Phase 36:**
1. **NO `is_generated` ALWAYS test** — Phase 34 verified `brands.name_normalized` was `GENERATED ALWAYS`. Phase 36 has NO GENERATED columns (D-02 — slug is explicit per URL stability).
2. **HAS CAT-14 NOT NULL tests** — Phase 34 had no nullability flip. Phase 36 adds 2 tests: (a) `is_nullable = 'NO'`, (b) actual INSERT with NULL catalog_id raises `23502`.
3. **HAS confdeltype assertions for BOTH FKs** — Phase 34 didn't introspect FK cascade clauses (uncomplicated by mixed semantics). Phase 36 has TWO FKs with different clauses (RESTRICT vs SET NULL — D-03 vs D-04) and MUST assert each.
4. **HAS a column shape `toEqual([...])` test** — Phase 34 had nothing equivalent (it checked individual columns). Phase 36 asserts the 10-column ordered list to guard against silent drift.

**Gotchas (cite RESEARCH.md §Common Pitfalls):**
- **Localhost guard (Pitfall 4 in test file).** The `dbUrlIsLocal` check + `describe.skip` if not local is non-negotiable — prevents accidental prod runs. Verbatim from Phase 34.
- **`db.execute` return shape coercion** — Phase 34 uses `(result as unknown as Array<{ ... }>)[0]` to peel off the row. Postgres-driver returns rows as an array on the result object. Phase 36 must use the same idiom.
- **`23502` and `23503` SQLSTATE codes** — `23502` = not_null_violation, `23503` = foreign_key_violation. These are stable across Postgres versions. Use `.rejects.toMatchObject({ code: '23502' })` style.
- **Test sample rate** (RESEARCH.md §Sampling Rate) — per-task `npx vitest run tests/integration/phase36-rls.test.ts -t "phase 36"`; per-wave `npx vitest run`; phase-gate full suite + prod-state psql smoke tests.

---

### `docs/deploy-db-setup.md` (Deploy runbook append)

**Analog 1 (full section structure) — `docs/deploy-db-setup.md` lines 671–823 (Phase 35 section)**

Phase 35's `## Phase 35 — Layer B …` heading + sub-sections form the exact structural template Phase 36 mirrors. Sub-section breakdown:

| Phase 35 sub-section | Phase 36 mirror |
|----------------------|-----------------|
| `## Phase 35 — Layer B …` H2 heading | `## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps` |
| Phase-intro paragraph + threats mitigated list | Phase-intro + T-36-01..T-36-04 |
| **WARNING — DESTRUCTIVE MIGRATION** blockquote | **NOTE — INHERITED FROM PHASE 35** blockquote (Phase 36 does NOT re-wipe; references Phase 35 D-02) |
| `### Preconditions` | `### Preconditions` (verbatim shape; adds `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL = 0` precondition) |
| `### 35.0 — Pre-flight pg_depend check` | `### 36.0 — Pre-flight pg_depend check` (same JOIN form on different column: `catalog_id` not `movement`) |
| `### 35.1 — Apply migration to prod` | `### 36.1 — Safety re-link backfill (D-01 step (d))` + `### 36.2 — Zero-NULL verification (D-01 step (e))` + `### 36.3 — Apply migrations to prod (D-01 step (f) — CAT-14 NOT NULL flip)` |
| `### 35.6 — Smoke-test SELECTs (D-14 step 7)` | `### 36.4 — Smoke-test SELECTs (post-deploy)` |
| (Phase 35 had no hard-fail flow) | `### 36.5 — CAT-14 hard-fail recovery flow (if §36.3 pre-flight fires)` — NOVEL section |
| `### 35.8 — Local DB re-sync after Phase 35` | `### 36.6 — Local DB re-sync after Phase 36` |
| (Phase 34 had `### 34.7 — Backout plan`; Phase 35 omitted but it's still the pattern) | `### 36.7 — Backout plan (if Phase 36 must be reverted post-deploy)` |

**Analog 2 (heading-level + code-fence style) — `docs/deploy-db-setup.md` lines 554–667 (Phase 34 section, esp. lines 650–667 backout plan)**

Excerpt — Phase 34's backout plan provides the structural template for Phase 36's §36.7:

```markdown
### 34.7 — Backout plan (if Phase 34 must be reverted post-deploy)
Reversible because Phase 34 is purely additive:
```sql
-- 1. Drop empty watch_families table (no rows in Phase 34)
DROP TABLE IF EXISTS watch_families;

-- 2. Drop brands table — CASCADE drops the FKs from watches_catalog
DROP TABLE IF EXISTS brands CASCADE;

-- 3. Defensive: ensure the columns are gone
ALTER TABLE watches_catalog
  DROP COLUMN IF EXISTS brand_id,
  DROP COLUMN IF EXISTS family_id;
```
**Caveat:** This backout plan is safe ONLY for the Phase-34-only window. Once Phase 35 ships … treat §34.7 as a Phase-34-only window — after Phase 35 ships, schedule a forward-fix instead of a backout.
```

**Analog 3 (pg_depend JOIN form on a different column) — `docs/deploy-db-setup.md` lines 687–720 (Phase 35 §35.0)**

Excerpt — the EXACT JOIN form Phase 36 mirrors (different column: `catalog_id` instead of `movement`):

```sql
-- CORRECT form: joins pg_attribute by both attrelid AND attnum to confirm the
-- column name on each row. Returns ONLY true dependents on `movement`.
SELECT
  d.classid::regclass AS dependency_class,
  d.objid::regclass   AS dependent_object,
  d.refobjid::regclass AS on_table,
  a.attname            AS on_column,
  d.deptype
FROM pg_depend d
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjid IN ('watches'::regclass, 'watches_catalog'::regclass)
  AND a.attname = 'movement';
```

Phase 36 mirror — same JOIN shape, single-table scope (`watches`), single-column (`catalog_id`):

```sql
SELECT
  d.classid::regclass AS dependency_class,
  d.objid::regclass   AS dependent_object,
  d.refobjid::regclass AS on_table,
  a.attname            AS on_column,
  d.deptype
FROM pg_depend d
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjid = 'watches'::regclass
  AND a.attname = 'catalog_id';
```
Expected result: 1 row — `watches_catalog_id_idx` (index, deptype=`a` auto). Memory rule 4 + 4a.

**Excerpt to mirror — see RESEARCH.md §Deploy Runbook Append (lines 691–895 of `36-RESEARCH.md`) for the FULL ~150-line Phase 36 section. Insertion point: end of `docs/deploy-db-setup.md` (after line 824, after the Phase 35 §35.8 local re-sync section).**

**Deviations from Phase 35 analog required for Phase 36:**
1. **NOTE — INHERITED FROM PHASE 35 blockquote replaces WARNING — DESTRUCTIVE MIGRATION.** Phase 36 does NOT TRUNCATE. The note clarifies that steps (a)(b)(c) of the ROADMAP 6-step runbook are inherited from Phase 35 D-02 (executed 2026-05-10).
2. **Adds CAT-14 zero-NULL precondition + verification step** (§36.2). Phase 35 had no equivalent.
3. **Adds §36.5 hard-fail recovery flow** (NOVEL). Phase 35 had no equivalent because no NOT NULL flip + no orphan risk.
4. **pg_depend scope is single-table (`watches`) single-column (`catalog_id`)**. Phase 35's scope was two-table (`watches`, `watches_catalog`) single-column (`movement`).
5. **No re-seed sub-sections.** Phase 35 had §35.2–§35.5 (re-seed catalog, brands, families, lineage). Phase 36 ships `watch_variants` empty per D-06 — no seeding. The shrunken runbook is the deliberate scope reduction per CONTEXT.md D-01.
6. **No cycle trigger smoke test.** Phase 35 §35.7 inserted a cycle to verify the trigger. Phase 36 has no cycle trigger.

**Gotchas (cite RESEARCH.md §Risks & Landmines):**
- **Heading level consistency** — Phase 34 / 35 use `## Phase NN — …` (H2) for the section heading and `### NN.X — …` (H3) for sub-sections. Phase 36 MUST match — otherwise the doc TOC drifts.
- **pg_depend footgun cross-reference** (RESEARCH.md §pg_depend Pre-check + memory rule 4a) — the §36.0 sub-section MUST include a footgun callout referencing Phase 35's incident (the broken `IN` form). RESEARCH.md §Deploy Runbook Append lines 736–740 show the exact callout text.
- **Code fence language tags** — `sql` for SQL queries, `bash` for shell commands, `markdown` not used here. Phase 34/35 are consistent; Phase 36 follows.
- **`<prod pooler URL>` placeholder syntax** — never hardcode the URL. Inline `DATABASE_URL=` override per Footgun T-34-04 / T-17-BACKFILL-PROD-DB.
- **`### 36.7 — Backout plan caveat`** — once Phase 37+ ships and consumers assume `catalog_id` is NOT NULL (Phase 38 CAT-13 LEFT JOIN simplification), the §36.7 backout becomes destructive. Document as a Phase-36-only window. Mirrors Phase 34's §34.7 caveat verbiage.

---

## Shared Patterns

### RLS + GRANT (catalog-tier public-read + service-role-write)

**Source:** `supabase/migrations/20260510000001_phase35_layer_b.sql` lines 118–121 (Phase 35 `watch_lineage_edges`) — itself inherited from `supabase/migrations/20260510000000_phase34_brands_families.sql` lines 31–34 (Phase 34 `brands`) — itself inherited from `supabase/migrations/20260427000000_phase17_catalog_schema.sql` (Phase 17 `watches_catalog`).

**Apply to:** The Phase 36 supabase migration STEP 3 (RLS + GRANT block for `watch_variants`).

```sql
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;
```

**Rationale:** Memory `project_supabase_secdef_grants.md` — `REVOKE FROM PUBLIC` alone does not block anon; explicit `GRANT SELECT` is mandatory. The 4-line block is non-negotiable. `service_role` bypasses RLS entirely (Supabase default), so no INSERT/UPDATE/DELETE policy is needed — backfill scripts using the service-role DATABASE_URL still write.

---

### `updated_at` trigger pattern (Phase 34 / Phase 35)

**Source:** `supabase/migrations/20260510000000_phase34_brands_families.sql` lines 26–30 (Phase 34 `brands`) — `supabase/migrations/20260510000001_phase35_layer_b.sql` lines 76–80 (Phase 35 `watch_lineage_edges`).

**Apply to:** The Phase 36 supabase migration STEP 2 (`watch_variants_set_updated_at()` function + trigger).

```sql
CREATE OR REPLACE FUNCTION <table>_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS <table>_set_updated_at_trg ON <table>;
CREATE TRIGGER <table>_set_updated_at_trg BEFORE UPDATE ON <table>
  FOR EACH ROW EXECUTE FUNCTION <table>_set_updated_at();
```

---

### Drizzle vs Supabase migration split (Phase 17 / 34 / 35 / 36)

**Source:** RESEARCH.md §Pattern 1 + memory `project_drizzle_supabase_db_mismatch.md` + Phase 34 Plan 01 lesson.

**Apply to:** Both new migration files (`drizzle/0009_…` + `supabase/migrations/20260511…`).

| Concern | Drizzle file | Supabase file |
|---------|--------------|---------------|
| Column shape (PK, FK, UNIQUE, INDEX, type) | YES (structural twin) | YES (authoritative) |
| RLS POLICY / GRANT | NO | YES |
| DO $$ blocks (pre-flight, post-assertion) | NO | YES |
| Triggers (BEFORE INSERT, BEFORE UPDATE) | NO | YES |
| pgEnums (CREATE TYPE) | YES (via `DO $$ IF NOT EXISTS pg_type`) | YES (CREATE TYPE directly) |
| CHECK constraints (e.g., `no_self_loop`) | NO (not expressible in 0.45.2 pg-core DSL) | YES |
| Idempotency (IF NOT EXISTS everywhere) | YES (re-runs locally after supabase db reset) | NO (single-shot prod apply) |
| Transaction wrapper (BEGIN; … COMMIT;) | NO (drizzle-kit wraps internally) | YES (explicit, atomicity guarantee) |

---

### Inline DO $$ Pre-flight Assertion (Phase 36 NOVEL position, Phase 34/35 syntactic precedent)

**Source:** RESEARCH.md §Pattern 3 + Phase 35 cycle-trigger function (lines 87–107 — `RAISE EXCEPTION` with `%` format markers).

**Apply to:** The Phase 36 supabase migration STEP 0 (FIRST STATEMENT — ROADMAP success #3).

```sql
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows in watches have NULL catalog_id. Run npm run db:backfill-catalog or inspect manually (see docs/deploy-db-setup.md Phase 36 recovery flow), then retry the migration.', orphan_count;
  END IF;
END $$;
```

**Novel aspect for Phase 36:** Position. Phase 35's DO $$ is the LAST statement (post-assertion). Phase 36's DO $$ is the FIRST statement (pre-flight). Same PL/pgSQL syntax, opposite position. ROADMAP success #3 verbatim requires FIRST.

**Rollback semantics** (RESEARCH.md §DO $$ Pre-flight Block §Rollback semantics): RAISE EXCEPTION inside the transaction rolls back every prior statement. Pre-flight is the FIRST statement → clean no-op rollback (no DDL has run yet). Prod stays in pre-migration state.

---

### pg_depend pre-flight (JOIN form, memory rule 4 + 4a)

**Source:** `docs/deploy-db-setup.md` lines 687–720 (Phase 35 §35.0) + memory `project_drizzle_supabase_db_mismatch.md` Rule 4 + 4a.

**Apply to:** `docs/deploy-db-setup.md` §36.0 — Pre-flight pg_depend check.

```sql
SELECT
  d.classid::regclass AS dependency_class,
  d.objid::regclass   AS dependent_object,
  d.refobjid::regclass AS on_table,
  a.attname            AS on_column,
  d.deptype
FROM pg_depend d
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjid = 'watches'::regclass
  AND a.attname = 'catalog_id';
```

**Critical:** Use JOIN form ONLY. Naive `IN` form has cross-table attnum collision risk (Phase 35 incident — 2 false-positive CHECK constraints reported). Memory rule 4a is non-negotiable.

Expected result: 1 row (`watches_catalog_id_idx`). Any surprise dependent → STOP, inspect.

---

## No Analog Found

None. Every Phase 36 deliverable has a direct precedent in Phase 17 / 34 / 35.

The ONE novel construct (inline DO $$ as FIRST statement) is syntactically identical to Phase 35's end-of-migration DO $$ — only the position differs. RESEARCH.md §State of the Art confirms: "Phase 36 is a re-application of established patterns, not invention."

---

## Metadata

**Analog search scope:**
- `src/db/schema.ts` (full file — `watches`, `watchesCatalog`, `brands`, `watchFamilies`, `watchLineageEdges`)
- `supabase/migrations/` (Phase 34, Phase 35 read in full)
- `drizzle/` (Phase 34, Phase 35 read in full + `meta/_journal.json`)
- `tests/integration/phase34-rls.test.ts` (full)
- `docs/deploy-db-setup.md` (Phase 34 §554–667, Phase 35 §671–823)
- `36-CONTEXT.md` (full)
- `36-RESEARCH.md` (full — `Migration Filenames`, `pg_depend Pre-check`, `DO $$ Pre-flight Block`, `Migration Statement Ordering`, `RLS + GRANT Template`, `Drizzle Schema Additions`, `Common Pitfalls`, `Code Examples`, `Deploy Runbook Append`)

**Files scanned:** 9 source files + 4 planning artifacts + 4 memory references.

**Pattern extraction date:** 2026-05-11
