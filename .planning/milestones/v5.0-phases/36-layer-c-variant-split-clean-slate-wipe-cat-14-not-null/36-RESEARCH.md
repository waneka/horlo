# Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL - Research

**Researched:** 2026-05-11
**Domain:** Postgres schema migration — additive table + nullable FK column + NOT NULL constraint flip; Supabase RLS / GRANT discipline; Drizzle ORM mirroring; pg_depend pre-flight; PL/pgSQL one-shot DO $$ pre-flight block
**Confidence:** HIGH

## Summary

Phase 36 is a schema-only migration that ships the third tier of the catalog hierarchy: a `watch_variants` table keyed off `watches_catalog`, an additive nullable `watches.variant_id` FK column, and the CAT-14 NOT NULL flip on `watches.catalog_id`. Every load-bearing primitive has direct precedent in Phase 17 (catalog + RLS pattern), Phase 34 (entity-table shape — brands/watch_families), and Phase 35 (lineage_edges + cycle-trigger + DO $$ post-assertion block + pg_depend pre-flight). Phase 36 introduces ONE novel construct — a one-shot inline `DO $$` block as the FIRST statement of the migration to assert zero orphans before the NOT NULL flip — and it is syntactically equivalent to the assertion block Phase 35 already ships at the END of its migration.

The migration runs in a single Postgres transaction. If the DO $$ pre-flight raises (any orphan exists), the entire transaction rolls back including the table create and FK column add; prod stays in pre-migration state. After Phase 35 D-02 wiped + re-seeded catalog rows on 2026-05-10, prod's current `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` is 0, so the pre-flight is expected to pass cleanly on the first attempt. The runbook's `npm run db:backfill-catalog` safety re-run before the push is the belt-and-suspenders for any watches added since 2026-05-10.

**Primary recommendation:** Mirror Phase 35's migration shape verbatim — `BEGIN; <DO $$ pre-flight>; <CREATE TYPE> (none in Phase 36); <ALTER TABLE adds>; <CREATE TABLE watch_variants + indexes + RLS + GRANT>; <ALTER COLUMN SET NOT NULL>; <DO $$ post-assertion>; COMMIT;`. The Drizzle mirror is a structural twin in `drizzle/0009_phase36_layer_c_variants.sql` (no RLS, no DO $$, no GRANT).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `watch_variants` table DDL + constraints | Database / Storage | — | Schema lives in Postgres; Supabase migration is authoritative |
| `watch_variants` RLS + GRANT enforcement | Database / Storage | — | Public-read via RLS + explicit GRANT SELECT; service-role writes only |
| `watches.variant_id` FK column | Database / Storage | — | Additive nullable column; no app-tier consumer in Phase 36 |
| CAT-14 NOT NULL flip on `watches.catalog_id` | Database / Storage | — | Constraint-only metadata change; no app-tier change |
| DO $$ pre-flight zero-NULL assertion | Database / Storage | — | PL/pgSQL inline block; same transaction; rollback-safe |
| Drizzle TypeScript inference | API / Backend (build-time) | — | `InferSelectModel<typeof watchVariants>` ships in Phase 36 — no runtime consumer until Phase 39 |
| Variant population (seed data) | — | — | DEFERRED to Phase 39 per D-06 |
| Variant browse UI | — | — | DEFERRED to Phase 39 per Phase 33b Q2 verdict |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (DO NOT re-litigate):**
- Phase 17 D-04 — `watches.catalog_id` `ON DELETE SET NULL` semantics preserved; nullability changes, cascade does not
- Phase 17 D-04 / D-06 — Public-read RLS for anon/authenticated; INSERT/UPDATE/DELETE service-role only; co-located in the same Supabase migration
- Phase 17 — Slug is set explicitly (not GENERATED) for URL stability across name edits
- Phase 17 / 19.1 — Drizzle vs Supabase migration split: Drizzle = TS source of truth; Supabase = authoritative DDL (RLS, GRANT, DO $$)
- Phase 34 D-02 — Entity FKs use `ON DELETE RESTRICT`; service-role-only writes mean no app-flow risk
- Phase 34 D-03 / D-05 — Ship `watch_variants` empty; seeding deferred to consumer phase
- Phase 33b Q2 — Variant browse UI DEFERRED to Phase 39 / v5.x; Phase 36 ships ZERO UI surface
- Phase 35 D-02 — TRUNCATE already executed; Phase 36 does NOT re-wipe
- Memory `project_drizzle_supabase_db_mismatch.md` — All 4 prod-push gotchas apply: (1) 14-digit filename, (2) no insertion between adjacent integers, (3) extension-schema opclass N/A (no GIN), (4) pg_depend BEFORE NOT NULL flip
- Memory `project_db_wipeable_2026_05_09.md` — Single-user prod; do NOT re-wipe; re-check before future phases assume wipeability
- REQUIREMENTS CAT-17 — "user's collection survives the wipe" honored by inheritance from Phase 35 D-02
- REQUIREMENTS CAT-14 — DO $$ pre-flight as FIRST migration statement; honored verbatim by D-07

**D-01 (Wipe runbook shrink):** Drop steps (a)(b)(c) of the ROADMAP 6-step runbook (absorbed by Phase 35 D-02). Keep:
- (d) `npm run db:backfill-catalog` safety re-run BEFORE migration push (idempotent — Phase 17 `WHERE catalog_id IS NULL` filter)
- (e) `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` zero-NULL verification (must return 0)
- (f) CAT-14 NOT NULL flip as part of the same Phase 36 migration transaction

**D-02 (watch_variants column shape):**
```sql
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
  UNIQUE (catalog_id, slug)
);
```
- `name` + `slug` are required identity; slug is set explicitly (not GENERATED — URL stability across name edits)
- `dial_color`, `bezel`, `bracelet_variant`, `image_url` are nullable free text with NO CHECK constraints (mirrors Phase 35 D-10/D-11 specialty values)
- Phase 19.1 LLM taste columns stay on `watches_catalog` only — per-Reference taste, not per-Variant

**D-03 (`watch_variants.catalog_id` `ON DELETE RESTRICT`):** Mirrors Phase 34 D-02 + Phase 35 D-04. Orphan-detection signal at delete time; no app-flow risk because writes are service-role only.

**D-04 (`watches.variant_id` `ON DELETE SET NULL`, nullable, no NOT NULL flip planned):**
```sql
ALTER TABLE watches
  ADD COLUMN variant_id uuid NULL
    REFERENCES watch_variants(id) ON DELETE SET NULL;
```
User never loses their watch due to admin curation. Variant_id stays nullable indefinitely.

**D-05 (RLS pattern same as Phase 34/35):** Public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only. Co-located in same Supabase migration as `CREATE TABLE watch_variants`. Verbatim mirror of `brands` and `watch_families` policies.

**D-06 (Ship watch_variants EMPTY; defer all population to Phase 39):** No seed file, no backfill script, no anchor rows. Phase 39 owns:
- `scripts/seed-data/variants.json`
- `scripts/backfill-catalog-variants.ts` (skip-on-missing-ref pattern from Phase 35 lineage D-12)
- `package.json` `db:backfill-catalog-variants` script entry
- Anchor seed (Submariner Kermit/Hulk/Cermit, GMT-Master II Pepsi/Batman, etc.)

**D-07 (Hard-fail pre-flight + manual recovery via runbook):**
```sql
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM watches WHERE catalog_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'CAT-14 pre-flight failed: % rows have NULL catalog_id. Run db:backfill-catalog or inspect manually before retry.', orphan_count;
  END IF;
END $$;
```
Recovery flow: inspect orphans → re-run `db:backfill-catalog` OR manual `catalogDAL.upsertCatalogFromUserInput()` → re-verify zero NULLs → retry migration push.

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion. D-01 through D-07 are all user-confirmed. Research must NOT recommend alternatives to any locked decision.

### Deferred Ideas (OUT OF SCOPE)

- Variant population (seed file + backfill script + anchor data) — Phase 39
- Variant browse UI / `/watch/{ref}/{slug}` route — Phase 39 / v5.x per Phase 33b Q2
- Admin UI for variant CRUD — locked out by ROADMAP for v5.0
- `watches.variant_id` NOT NULL flip — explicitly NOT scheduled
- Auto-decompose fragmented catalog rows — moot per Phase 35 D-02 wipe
- Per-variant LLM taste enrichment — taste stays on `watches_catalog`
- `watch_variants.production_year_start/end` columns — kept ROADMAP-3 + name/slug only
- GIN trigram indexes on variant names — not in Phase 36
- CAT-14 NOT NULL flip on `watches.variant_id` — not scheduled
- Auto-backfill orphan watches inside migration — rejected per D-07 (loses curation discipline)
- `watches_catalog.is_canonical` boolean — not needed; Phase 35 D-02 re-seeded only canonical rows

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-17 | New `watch_variants` table (catalog_id FK + dial_color, bezel, bracelet_variant). Fragmented-row consolidation runbook. User's collection survives the wipe. | `## Migration Filenames`, `## RLS + GRANT Template`, `## Drizzle Schema Additions`, `## Parity Gate Greps` |
| CAT-14 | `SET NOT NULL` on `watches.catalog_id`. Pre-flight `DO $$` block asserts zero NULLs as the FIRST migration statement; transaction aborts if any NULL exists. Bundled with CAT-17. | `## DO $$ Pre-flight Block`, `## CAT-14 Hard-Fail Recovery`, `## pg_depend Pre-check` |

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Next.js 16 App Router; TypeScript 5 strict; Drizzle ORM 0.45.2 + Supabase. Continue with existing framework, NO rewrites.
- **AGENTS.md directive:** Next.js 16 has breaking changes from prior versions — Phase 36 ships ZERO Next.js code, but the rule applies to any related work (it does not in scope here).
- **GSD Workflow Enforcement:** All file changes must flow through a GSD command. Phase 36 work flows through `/gsd-plan-phase 36` → wave-based execution.
- **Data model:** `Watch` and `UserPreferences` types are established — extend, do NOT break. Phase 36 ADDs `variant_id` to the watches Drizzle definition; does NOT alter any existing column.
- **Performance:** <500 watches per user; no pagination concerns. Phase 36 has no DAL surface — irrelevant.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 [VERIFIED: package.json] | TypeScript schema + type inference for Postgres | Project standard since Phase 17 (`src/db/schema.ts`); `pgTable`, `pgEnum`, `references`, `unique`, `index` all already in use |
| drizzle-kit | 0.31.10 [VERIFIED: package.json] | Generate `drizzle/NNNN_*.sql` migration files from schema diffs | Standard generation path; Phase 35 used it for `0008_phase35_layer_b.sql` |
| postgres (driver) | 3.4.9 [VERIFIED: package.json] | Postgres client used by `src/db/index.ts` | Already wired; no change |
| Supabase CLI | 2.x [CITED: docs/deploy-db-setup.md §0–§2] | `supabase db push --linked` for prod migration apply | Mandatory per memory rule `project_drizzle_supabase_db_mismatch.md` |
| vitest | (dev) [VERIFIED: package.json `test: vitest run`] | Test runner | Phase 34 pattern: `tests/integration/phase34-rls.test.ts` |
| @supabase/supabase-js | 2.103.0 [VERIFIED: package.json] | Anon-client RLS verification in integration tests | Phase 34 pattern verbatim |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | 0.10.2 [VERIFIED: package.json] | Server-component client | Not used by Phase 36 (no UI) |
| zod | 4.3.6 [VERIFIED: package.json] | Schema validation | Not used by Phase 36 (no app flow) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle structural twin migration | Pure Supabase migration only | Rejected — Phase 17/34/35 established the split; Drizzle is TS source of truth for `InferSelectModel<typeof watchVariants>` (used by Phase 39 + Phase 38) |
| Inline `DO $$` pre-flight | Separate pre-flight script run by deploy operator | Rejected per D-07 + ROADMAP success #3 — the pre-flight MUST be the FIRST statement of the migration so it runs atomically inside the same transaction as the NOT NULL flip |
| `ALTER TABLE ... ADD CONSTRAINT NOT NULL` | `ALTER COLUMN ... SET NOT NULL` | Equivalent in Postgres; `SET NOT NULL` is the idiomatic form Phase 17/34/35 use elsewhere |
| GIN trigram index on `watch_variants.name` for fuzzy search | No index in Phase 36 | Rejected per D-06 — variants ship empty; fuzzy search is Phase 39+ concern; memory rule 3 (schema-qualified opclass) only relevant if GIN added |

**Installation:** No new dependencies. All required libraries already installed.

**Version verification:**
```bash
# Already verified in package.json — no install step
node -e "console.log(require('./package.json').dependencies)"
# drizzle-orm@^0.45.2, drizzle-kit@^0.31.10, next@16.2.3, postgres@^3.4.9
```
Versions are pinned in the lockfile. No `npm view` lookup needed — these are unchanged from Phase 35.

## Migration Filenames

### Supabase migration

**Highest existing supabase migration:** `supabase/migrations/20260510000001_phase35_layer_b.sql` [VERIFIED: ls supabase/migrations/]

**Required filename for Phase 36:** `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`

Rationale:
- 14 digits exactly per memory rule 1 [CITED: `project_drizzle_supabase_db_mismatch.md` Rule 1]
- Strictly greater than `20260510000001` per memory rule 2 (no insertion between adjacent integers) [CITED: Rule 2]
- Date `2026-05-11` matches the current date and the day Phase 36 starts; suffix `000000` keeps the slot at 00:00:00 in case any hot-fix needs to slot in later in the day (precedent: Phase 35 used `20260510000001` to slot after Phase 34's `20260510000000` on the same day)
- Suffix `_phase36_layer_c_variants.sql` follows Phase 34/35 naming (`_phase34_brands_families`, `_phase35_layer_b`)

### Drizzle migration

**Highest existing drizzle migration:** `drizzle/0008_phase35_layer_b.sql` [VERIFIED: ls drizzle/]

**Highest existing journal entry:** `idx=8, tag=0008_phase35_layer_b` [VERIFIED: drizzle/meta/_journal.json]

**Required filename for Phase 36:** `drizzle/0009_phase36_layer_c_variants.sql`

**Required journal entry:** `idx=9, tag=0009_phase36_layer_c_variants, when=<unix-ms-at-generation>, version=7, breakpoints=true`

Rationale:
- Sequential 4-digit prefix per Phase 35's `0008` precedent [VERIFIED: drizzle/0008_phase35_layer_b.sql]
- Journal MUST be appended in the same task as the migration file — memory `project_drizzle_supabase_db_mismatch.md` does not state this explicitly, but Phase 34 Plan 01 decision (STATE.md) does: *"drizzle/meta/_journal.json MUST be appended in same task as the Drizzle migration file — without the idx=N entry, drizzle-kit migrate silently skips and the prod __drizzle_migrations row count stays unchanged (silent no-op)"* [CITED: STATE.md Accumulated Context]

## pg_depend Pre-check

**Memory rule 4** [CITED: `project_drizzle_supabase_db_mismatch.md` Rule 4]: Query `pg_depend` BEFORE any structural change touching a column. Phase 36 touches `watches.catalog_id` (nullability flip), so the pre-check runs against that column.

**Memory rule 4a** [CITED: same memory, Rule 4a — added after Phase 35 incident]: Use the JOIN form, NOT the naive `IN` form. Cross-table `attnum` collision risk produces false positives. The Phase 35 incident reported 2 false-positive CHECK constraints because both `watches.movement` and `watches_catalog.image_source_url` had `attnum=10`.

### Correct query (use this form ONLY)

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

### Expected result

| dependency_class | dependent_object | on_table | on_column | deptype |
|-----------------|------------------|----------|-----------|---------|
| pg_class | watches_catalog_id_idx | watches | catalog_id | a (auto) |

**Single expected dependent:** `watches_catalog_id_idx` — the btree index on `(catalog_id)` declared in `src/db/schema.ts:130` [VERIFIED: src/db/schema.ts lines 128–133]:
```typescript
(table) => [
  index('watches_user_id_idx').on(table.userId),
  index('watches_catalog_id_idx').on(table.catalogId),
  index('watches_user_sort_idx').on(table.userId, table.sortOrder),
],
```

**An index on a column is unaffected by a nullability change** — Postgres rewrites the index entry encoding only on type changes, not constraint changes. The `SET NOT NULL` is metadata-only. [ASSUMED: standard Postgres semantics; safe to assert per Phase 17/34 precedent where no index drops were needed for similar adds]

### Surprise dependents to watch for

If the query returns ANY of the following, **STOP and inspect before proceeding**:

| Dependent type | What to do |
|----------------|-----------|
| Foreign key from another table to `watches.catalog_id` | Investigate — no FKs to `watches.catalog_id` exist per `src/db/schema.ts` audit |
| View or materialized view referencing `watches.catalog_id` | None known; investigate origin and decide whether to DROP+RECREATE around the migration |
| Generated column referencing `catalog_id` | None — `watches.catalog_id` has no derivatives |
| CHECK constraint mentioning `catalog_id` | None known; verify the constraint still validates after NOT NULL |
| Trigger or function referencing `catalog_id` | None known; review trigger body |
| RLS policy mentioning `catalog_id` | None on `watches` — RLS uses `auth.uid() = user_id` only |

[VERIFIED: grep for `catalog_id` in `supabase/migrations/*.sql` shows only Phase 17 schema, Phase 17 backfill assertion, and the index — no views, no triggers, no FKs from other tables]

## DO $$ Pre-flight Block

### Exact SQL (FIRST statement of migration, inside the BEGIN)

```sql
-- ============================================================================
-- STEP 0: CAT-14 pre-flight (D-07). MUST be the first statement after BEGIN
-- per ROADMAP success #3. RAISE EXCEPTION aborts the entire transaction
-- including the watch_variants CREATE TABLE and the variant_id ADD COLUMN.
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
```

### Syntactic validity

PL/pgSQL inline `DO $$ ... $$;` blocks are standard Postgres syntax [CITED: PostgreSQL docs — DO statement, https://www.postgresql.org/docs/15/sql-do.html]. The form is identical to Phase 34's migration (which uses an inline `DO $$ BEGIN ... END $$` block for FK constraint guards) [VERIFIED: supabase/migrations/20260510000000_phase34_brands_families.sql lines 18–25, 46–51] and Phase 35's migration (which uses the same form for its end-of-migration assertion block) [VERIFIED: supabase/migrations/20260510000001_phase35_layer_b.sql lines 127–207].

`RAISE EXCEPTION` with `%` format markers is the canonical PL/pgSQL pattern [CITED: PostgreSQL docs — RAISE]. Phase 35's cycle-trigger function uses identical syntax [VERIFIED: same file lines 102–104]:
```sql
RAISE EXCEPTION 'Lineage cycle detected: % -> %',
  NEW.predecessor_catalog_id, NEW.successor_catalog_id;
```

### Rollback semantics

The DO $$ block runs inside the same transaction as `BEGIN; ... COMMIT;`. If `RAISE EXCEPTION` fires:
1. The exception propagates up through the PL/pgSQL execution
2. Supabase CLI / psql receives the error
3. The implicit rollback of the migration's transaction reverts every statement after `BEGIN;`
4. Since the pre-flight is the FIRST statement, no DDL has executed yet — the rollback is a clean no-op on the live schema
5. Prod stays in pre-migration state; `watches.catalog_id` is still nullable; `watch_variants` does NOT exist; `watches.variant_id` does NOT exist

This is the desired behavior — the migration is all-or-nothing.

## Migration Statement Ordering (FULL)

The complete Supabase migration follows this order:

```sql
BEGIN;

-- STEP 0 (FIRST STATEMENT — ROADMAP success #3): CAT-14 pre-flight
-- (see DO $$ block above)

-- STEP 1: Create watch_variants table + indexes + constraints (D-02)
CREATE TABLE watch_variants (...);
CREATE INDEX watch_variants_catalog_id_idx ON watch_variants(catalog_id);

-- STEP 2: updated_at trigger (Phase 34 pattern)
CREATE OR REPLACE FUNCTION watch_variants_set_updated_at() RETURNS trigger ...;
CREATE TRIGGER watch_variants_set_updated_at_trg ...;

-- STEP 3: RLS + GRANT (D-05)
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;

-- STEP 4: Add watches.variant_id column (D-04)
ALTER TABLE watches
  ADD COLUMN variant_id uuid NULL
    REFERENCES watch_variants(id) ON DELETE SET NULL;

-- STEP 5: CAT-14 NOT NULL flip (the load-bearing constraint change)
ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;

-- STEP 6: Final assertion block (mirrors Phase 35 end-of-migration DO $$)
DO $$
DECLARE
  watch_variants_table_exists boolean;
  watch_variants_select_policy_exists boolean;
  anon_can_select_variants boolean;
  variant_id_col_exists boolean;
  catalog_id_is_not_null boolean;
  catalog_id_ondelete_set_null boolean;
  variant_id_ondelete_set_null boolean;
  variant_catalog_id_ondelete_restrict boolean;
  variant_unique_catalog_slug_exists boolean;
BEGIN
  -- existence + RLS checks (8+ assertions, see Validation Architecture)
  ...
  IF NOT watch_variants_table_exists       THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants table missing'; END IF;
  IF NOT anon_can_select_variants          THEN RAISE EXCEPTION 'Phase 36 failed -- anon cannot SELECT watch_variants'; END IF;
  IF NOT catalog_id_is_not_null            THEN RAISE EXCEPTION 'Phase 36 failed -- watches.catalog_id is still nullable'; END IF;
  -- ... etc
END $$;

COMMIT;
```

**Rationale for this ordering:**
1. Pre-flight FIRST — fails fast if orphans exist; no wasted DDL
2. watch_variants table created BEFORE `watches.variant_id` ADD COLUMN — the FK target must exist
3. RLS + GRANT BEFORE `variant_id` add — order doesn't strictly matter, but co-locating with the table create matches Phase 34 pattern
4. NOT NULL flip AFTER the pre-flight (technically it could go immediately after the DO $$, but keeping it after the new table+column work groups the additive Phase 36 deliverables together)
5. End-of-migration DO $$ post-assertion mirrors Phase 35 — defensive insurance against partial apply (extremely unlikely inside a transaction, but cheap)

## RLS + GRANT Template

### Source: Phase 35's `watch_lineage_edges` policy [VERIFIED: supabase/migrations/20260510000001_phase35_layer_b.sql lines 118–121]

```sql
ALTER TABLE watch_lineage_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lineage_edges_select_all ON watch_lineage_edges;
CREATE POLICY lineage_edges_select_all ON watch_lineage_edges FOR SELECT USING (true);
GRANT SELECT ON watch_lineage_edges TO anon, authenticated;
```

### Phase 36 mirror (verbatim shape)

```sql
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;
```

### Why no INSERT/UPDATE/DELETE policy

Phase 17/34/35 deliberately ship NO INSERT/UPDATE/DELETE policies on catalog-tier tables. Per memory rule `project_supabase_secdef_grants.md` [CITED]:
- `REVOKE FROM PUBLIC` alone does NOT block anon — Supabase auto-grants direct EXECUTE/INSERT/UPDATE/DELETE via `ALTER DEFAULT PRIVILEGES`
- The absence of a policy means anon/authenticated have NO matching policy → RLS denies the operation
- `service_role` bypasses RLS entirely (Supabase default) — backfill scripts using the service-role DATABASE_URL can write

### Verification per Phase 34 integration test pattern

```typescript
// tests/integration/phase36-rls.test.ts (Phase 34 pattern verbatim)
it('has_table_privilege: anon can SELECT watch_variants (T-36-02)', async () => {
  const result = await db.execute<{ can: boolean }>(sql`
    SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT') AS can
  `)
  expect((result as unknown as Array<{ can: boolean }>)[0].can).toBe(true)
})

it('anon supabase-js INSERT INTO watch_variants fails with RLS (T-36-01)', async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await anon.from('watch_variants').insert({
    catalog_id: randomUUID(), name: 'AnonVariant', slug: 'anon-variant',
  })
  expect(error).not.toBeNull()
  expect(`${error?.code ?? ''} ${error?.message ?? ''}`).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
})
```

### Column-level grants NOT needed

Table-level `GRANT SELECT ON watch_variants TO anon, authenticated` covers all columns. No column needs separate handling. [VERIFIED: Phase 34/35 migrations grant at table level only; identical pattern works]

## Drizzle Schema Additions

### Exact `pgTable` definition for `watchVariants` (NEW)

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

**Insertion point in `src/db/schema.ts`:** Below the `watchLineageEdges` definition (lines 420–444); above the `watchesCatalogDailySnapshots` definition (line 449). The `() => watchesCatalog.id` callback resolves the forward reference lazily — same pattern Phase 34 used for `brands.id ← watch_families.brand_id` [VERIFIED: src/db/schema.ts lines 396–414].

### `variantId` column add on `watches` (line 118-area edit)

Insert the new column between `catalogId` (line 118) and `sortOrder` (line 123) in the `watches` table definition. After the edit, the relevant block reads:

```typescript
    // Phase 17: catalog FK — nullable in v4.0, flipped to NOT NULL in Phase 36 (CAT-14).
    // ON DELETE SET NULL preserved (Phase 17 D-04 — never CASCADE, never RESTRICT).
    catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),

    // Phase 36 D-04: variant FK — nullable, ON DELETE SET NULL (CAT-17).
    // No NOT NULL flip scheduled — variants will never hit 100% coverage.
    variantId: uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' }),

    // Phase 27 — sort_order for wishlist drag-reorder (D-01).
    sortOrder: integer('sort_order').notNull().default(0),
```

**Drizzle note on `catalogId` NOT NULL:** The Drizzle definition currently has NO `.notNull()` on `catalogId`. Phase 36's authoritative `SET NOT NULL` flip happens in the Supabase migration. The Drizzle schema MAY also be updated to `uuid('catalog_id').notNull().references(...)` so that `InferSelectModel<typeof watches>.catalogId` becomes `string` instead of `string | null`. **Recommended:** YES — update the Drizzle type. The plan-phase should include a separate task editing `src/db/schema.ts` line 118 to add `.notNull()`. Without it, Drizzle's TypeScript inference will still report `catalogId: string | null` even after the prod constraint flip, requiring downstream consumers to defensively null-check. [ASSUMED — confirm in plan-phase whether to include the `.notNull()` flip on the Drizzle side; both options are valid, but YES is more honest about the new prod reality.]

### Idempotent Drizzle migration (mirrors Phase 35 pattern)

Phase 34's drizzle migration (`drizzle/0007_phase34_brands_families.sql`) and Phase 35's (`drizzle/0008_phase35_layer_b.sql`) are both idempotent — they use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and DO-block FK guards. This lets `drizzle-kit migrate` run AFTER `supabase db push --linked` has already created the objects without erroring. [VERIFIED: both files read]

Phase 36's `drizzle/0009_phase36_layer_c_variants.sql` mirrors this exactly:

```sql
-- Phase 36 — Layer C: watch_variants table + watches.variant_id (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260511000000_phase36_layer_c_variants.sql (authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no GRANT, no DO $$ —
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
-- If Drizzle's TypeScript schema is updated to mark catalogId as .notNull(), drizzle-kit's
-- diff would emit ALTER COLUMN SET NOT NULL — that statement is included idempotently
-- (SET NOT NULL is a no-op if already not nullable):
ALTER TABLE "watches" ALTER COLUMN "catalog_id" SET NOT NULL;
```

[ASSUMED — last statement is idempotent: SET NOT NULL on an already-NOT-NULL column is a no-op in Postgres; if Drizzle runs after Supabase has flipped it, this statement succeeds silently. If Drizzle runs FIRST (local re-sync flow without Supabase having pushed), this is the operation. Confirmed by standard Postgres semantics. Verify in plan-phase by reading PostgreSQL ALTER TABLE docs.]

### Journal entry

Append to `drizzle/meta/_journal.json`:
```json
{
  "idx": 9,
  "version": "7",
  "when": <unix-ms-at-generation>,
  "tag": "0009_phase36_layer_c_variants",
  "breakpoints": true
}
```

## Local Re-sync Recipe

Per memory `project_local_db_reset.md` [CITED]:

```bash
# Step 1: Wipe local DB. supabase db reset partially fails on social_tables_create
# (well-known; tables get dropped anyway).
supabase db reset

# Step 2: Rebuild schema via Drizzle (local only — NEVER prod).
# This now creates watch_variants and watches.variant_id columns directly.
npx drizzle-kit push

# Step 3: Apply Supabase migrations in lexical order via docker exec (multi-statement support).
# Phase 17–35 migrations FIRST (their order is fixed); Phase 36 LAST.
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260413000000_sync_auth_users.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260420000000_rls_existing_tables.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260420000001_social_tables_rls.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260420000002_profile_trigger.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260427000000_phase17_catalog_schema.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260427000001_phase17_pg_cron.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260430000000_phase19_1_taste_constraints.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260430000001_phase19_1_catalog_source_photos_bucket.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000001_phase35_layer_b.sql
# NEW for Phase 36:
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260511000000_phase36_layer_c_variants.sql

# Step 4: Verify Phase 36 schema
docker exec -i supabase_db_horlo psql -U postgres -d postgres -c "\d watch_variants"
docker exec -i supabase_db_horlo psql -U postgres -d postgres -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id';"
# Expect: NO (catalog_id is now NOT NULL)
```

**Critical:** After Phase 35 D-02 TRUNCATEd the local catalog, `npx drizzle-kit push` runs against an empty `watches` table. The Phase 36 DO $$ pre-flight will pass trivially on local. The Supabase migration apply via docker exec succeeds. No special handling needed.

**Footgun:** If a developer has manually added watches to local without running `db:backfill-catalog`, the Phase 36 local Supabase migration apply may fail at the DO $$ pre-flight. Solution: run `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:backfill-catalog` against local FIRST, then re-run the migration apply.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x (via package.json `"test": "vitest run"`) [VERIFIED: package.json] |
| Config file | `vitest.config.ts` [VERIFIED: ls] |
| Quick run command | `npx vitest run tests/integration/phase36-rls.test.ts -t "phase 36"` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-17 | `watch_variants` table exists with correct shape | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "table exists"` | ❌ Wave 0 |
| CAT-17 | `watches.variant_id` column added, nullable, FK to `watch_variants.id` ON DELETE SET NULL | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "variant_id"` | ❌ Wave 0 |
| CAT-17 | `watch_variants` RLS enabled; anon can SELECT | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "anon SELECT"` | ❌ Wave 0 |
| CAT-17 | Anon INSERT into `watch_variants` blocked by RLS | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "anon INSERT"` | ❌ Wave 0 |
| CAT-17 | FK `watch_variants.catalog_id` ON DELETE RESTRICT enforced | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "ON DELETE RESTRICT"` | ❌ Wave 0 |
| CAT-17 | `watch_variants.catalog_id` is NOT NULL | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id NOT NULL"` | ❌ Wave 0 |
| CAT-17 | UNIQUE (catalog_id, slug) enforced | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_slug UNIQUE"` | ❌ Wave 0 |
| CAT-14 | `watches.catalog_id` `is_nullable = 'NO'` | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id is NOT NULL"` | ❌ Wave 0 |
| CAT-14 | INSERT into `watches` with NULL `catalog_id` raises | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "INSERT NULL catalog_id"` | ❌ Wave 0 |
| Parity | All existing watches DAL queries return identical results | static (grep proof) | `grep -rn "variant_id\|variantId" src/data src/app src/lib src/components` → expect ZERO matches | ✅ proven now (current grep returns zero) |
| Parity | `watches.catalog_id` ON DELETE SET NULL still in effect | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id ON DELETE SET NULL"` | ❌ Wave 0 |
| Pre-flight | DO $$ pre-flight is FIRST statement of supabase migration | static (file grep) | `head -25 supabase/migrations/20260511000000_phase36_layer_c_variants.sql \| grep -A 10 'DO \$\$'` | ❌ Wave 0 (verified at file commit time) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/integration/phase36-rls.test.ts` (~5 seconds against local Docker)
- **Per wave merge:** `npx vitest run` (full integration + unit suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`. Plus the prod-state verifications:
  - `psql "<prod>" -c "SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT');"` → expect `t`
  - `psql "<prod>" -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id';"` → expect `NO`
  - `psql "<prod>" -c "SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL;"` → expect `0`
  - `psql "<prod>" -c "SELECT COUNT(*) FROM watch_variants;"` → expect `0` (deferred to Phase 39)
  - Parity row counts: `SELECT COUNT(*) FROM watches` and `SELECT COUNT(*) FROM watches_catalog` match pre-migration baseline

### Wave 0 Gaps

- [ ] `tests/integration/phase36-rls.test.ts` — covers all CAT-17 + CAT-14 behaviors above; mirrors `tests/integration/phase34-rls.test.ts` structure verbatim with 11–13 it() blocks
- [ ] Migration filename verification check in `tests/static/phase36-migration-shape.test.ts` (OPTIONAL — Phase 35 did not ship this; planner decides whether to include)
- [ ] Framework install: NOT needed — vitest already in devDependencies; @supabase/supabase-js already installed; sql from drizzle-orm already used

**Framework already covers all phase requirements** — no new infra needed beyond the new test file.

## Parity Gate Greps

ROADMAP success #5 requires *"All existing collection-browsing, profile, and verdict flows return correct watch data post-migration; no user-visible watch data is lost."* The proof is grep-based: no existing code path references `variant_id` / `variantId`, so the additive nullable column cannot affect any read path.

### Required grep commands (all expected to return ZERO matches as of 2026-05-11)

```bash
# Proof 1: no DAL or component currently references variant_id / variantId
grep -rn "variant_id\|variantId" src/data src/app src/lib src/components
# Expected output: <empty>
# [VERIFIED 2026-05-11: zero matches]
```

```bash
# Proof 2: addWatch flow always populates catalog_id via catalogDAL.upsertCatalogFromUserInput
grep -n "upsertCatalogFromUserInput\|catalogDAL" src/app/actions/watches.ts
# Expected output (from VERIFIED grep 2026-05-11):
#   6:import * as catalogDAL from '@/data/catalog'
#   121:      catalogId = await catalogDAL.upsertCatalogFromUserInput({
#   155:            await catalogDAL.applyUserUploadedPhoto(catalogId, {
#   188:          await catalogDAL.updateCatalogTaste(catalogId, taste)
# This proves: every new watch goes through upsertCatalogFromUserInput, which guarantees
# catalog_id is populated. Orphan creation is impossible in normal app flow → CAT-14
# pre-flight is expected to pass cleanly.
```

```bash
# Proof 3: src/data/watches.ts DAL surface untouched
grep -n "catalog_id\|catalogId" src/data/watches.ts
# Expected output (from VERIFIED grep 2026-05-11):
#   47:    catalogId: row.catalogId ?? null,
#   243:  catalogId: string,
#   247:    .set({ catalogId })
# Three references. After Phase 36:
#   - Line 47 maps catalog_id from DB to domain — works unchanged (catalog_id is now non-null,
#     but the ?? null fallback is harmless)
#   - Lines 243+247 are the existing setCatalogId helper — unchanged
# No queries SELECT variant_id; no queries WHERE on variant_id; no queries JOIN to watch_variants.
```

```bash
# Proof 4: catalog DAL surface untouched
grep -c "watchesCatalog" src/data/catalog.ts
# Expected: 31 (Phase 17 count documented in CONTEXT.md canonical_refs)
# All 31 references operate on watches_catalog — Phase 36 does not modify that table's shape.
```

```bash
# Proof 5: no Drizzle definition or type-inference site reads variantId outside the new
# watchVariants table definition itself
grep -rn "variantId" src/db src/lib
# Expected output: <empty> (after Phase 36 schema edit, this should still be empty — the
# watchVariants table is exported but no consumer reads InferSelectModel<typeof watchVariants>
# until Phase 39)
```

**If ANY of these greps return unexpected matches after Phase 36's schema edits, STOP and audit before merge.**

## Deploy Runbook Append

Append to `docs/deploy-db-setup.md` at end (after the Phase 35 section, line ~826):

````markdown
---

## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps

Phase 36 (CAT-17 + CAT-14) introduces the `watch_variants` table with public-read RLS + service-role-write, adds a nullable `watches.variant_id` FK column, and flips `watches.catalog_id` to NOT NULL. Schema-only — no UI surface, no DAL changes, no new app code.

Threats mitigated: T-36-01 (anon write blocked by RLS service-role-only), T-36-02 (anon read enabled by GRANT SELECT — memory rule `project_supabase_secdef_grants.md`), T-36-03 (FK orphans blocked by ON DELETE RESTRICT on `watch_variants.catalog_id`), T-36-04 (CAT-14 silent application — DO $$ pre-flight as FIRST migration statement aborts the transaction if any orphan exists).

> **NOTE — INHERITED FROM PHASE 35:** Steps (a)(b)(c) of the ROADMAP success #2 6-step runbook (export-to-CSV / DELETE fragmented rows / re-seed canonical refs) are inherited from Phase 35 D-02 — that TRUNCATE + re-seed cycle ran on 2026-05-10. Phase 36 does NOT re-execute the wipe. Per memory `project_db_wipeable_2026_05_09.md`, prod is still single-user (twwaneka@gmail.com) — verify with `SELECT count(*) FROM auth.users` before assuming.

### Preconditions

- Phase 36 PR is merged to `main`
- Local DB push is GREEN (Phase 36 supabase migration applied locally via `docker exec ... psql ... < supabase/migrations/20260511000000_phase36_layer_c_variants.sql` exits 0; final DO $$ post-assertion does NOT raise)
- `tests/integration/phase36-rls.test.ts` passes locally with `DATABASE_URL` pointed at local Docker (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
- TypeScript compiles cleanly (`npx tsc --noEmit` exits 0)
- Full test suite passes (`npx vitest run` exits 0)
- `SELECT count(*) FROM auth.users` against prod returns 1 (single-user assumption holds — STOP if a 2nd user has signed up)
- `SELECT count(*) FROM watches WHERE catalog_id IS NULL` against prod returns 0 (Phase 35 inheritance — verify here, do not assume)

### 36.0 — Pre-flight pg_depend check (memory rule 4 + 4a)

BEFORE applying the migration, run this query against PROD via psql to confirm `watches.catalog_id` has no unexpected dependents:

```sql
-- CORRECT form (memory rule 4a): joins pg_attribute by both attrelid AND attnum
-- to confirm the column name on each row. Returns ONLY true dependents on
-- watches.catalog_id.
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

**Expected output: ONE row** — the `watches_catalog_id_idx` index. The index is unaffected by a nullability change (metadata-only).

> **Footgun T-35-PGDEPEND-ATTNUM (cross-reference from Phase 35 §35.0):** The naive `IN` form has a cross-table attnum-collision bug. Use the JOIN form above only.

If any row OTHER than `watches_catalog_id_idx` appears, **DO NOT PROCEED** — investigate the dependent object first. Most likely candidates would be a forgotten view, materialized view, or generated column referencing `catalog_id`. None exist as of 2026-05-11.

### 36.1 — Safety re-link backfill (D-01 step (d))

```bash
DATABASE_URL="<prod session-mode pooler URL>" npm run db:backfill-catalog
```

Idempotent — `WHERE catalog_id IS NULL` filter from Phase 17. Re-runs against a fully-linked collection are no-ops (exit `inserted=0 patched=0 linked=0 unlinked=0`). This is the belt-and-suspenders for any watch added since Phase 35's 2026-05-10 wipe + re-seed.

Footgun T-17-BACKFILL-PROD-DB / T-34-04 applies — see §17.2 / §34.2 for the wrong-DB risk and the inline `DATABASE_URL=` override pattern.

### 36.2 — Zero-NULL verification (D-01 step (e))

```bash
psql "<prod pooler URL>" -c "SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL;"
```

**Expected: 0.** If non-zero, **STOP** and go to §36.5 hard-fail recovery flow before retrying the migration push.

### 36.3 — Apply migrations to prod (D-01 step (f) — CAT-14 NOT NULL flip)

```bash
supabase db push --linked
```

Confirms (in order):
- `BEGIN;` opens transaction
- `DO $$ ... END $$` CAT-14 pre-flight runs FIRST (ROADMAP success #3). If orphans exist, this raises EXCEPTION and rolls back; prod stays in pre-migration state.
- `CREATE TABLE watch_variants (...)` with PK, FK, UNIQUE, indexes
- `ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY` + policy + GRANT
- `ALTER TABLE watches ADD COLUMN variant_id uuid NULL REFERENCES watch_variants(id) ON DELETE SET NULL`
- `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` (the CAT-14 load-bearing change)
- Final `DO $$ ... END $$` post-assertion block (raises on any invariant failure → rollback)
- `COMMIT;` closes transaction atomically

Also push the Drizzle column-shape migration:
```bash
DATABASE_URL="<prod session-mode pooler URL>" npx drizzle-kit migrate
```
Expected: applies `0009_phase36_layer_c_variants.sql`; `drizzle.__drizzle_migrations` row count incremented by 1. The Drizzle migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, DO-block FK guards) so `NOTICE: relation "..." already exists, skipping` is expected and benign; any `ERROR:` line is a fail.

### 36.4 — Smoke-test SELECTs (post-deploy)

Run against PROD via psql:

```sql
-- RLS verification (T-36-02)
SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT');
-- expect: t

-- CAT-14 NOT NULL flip verification
SELECT is_nullable FROM information_schema.columns
 WHERE table_name = 'watches' AND column_name = 'catalog_id';
-- expect: NO

-- Empty-table parity (per D-06)
SELECT COUNT(*) FROM watch_variants;                   -- expect: 0
SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL;  -- expect: 0

-- Row-count parity (no data lost)
SELECT COUNT(*) FROM watches;                           -- expect: same as pre-migration
SELECT COUNT(*) FROM watches_catalog;                   -- expect: same as pre-migration

-- Column shape verification
SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_name = 'watch_variants'
 ORDER BY ordinal_position;
-- expect: id, catalog_id, name, slug, dial_color, bezel, bracelet_variant, image_url, created_at, updated_at
```

### 36.5 — CAT-14 hard-fail recovery flow (if §36.3 pre-flight fires)

If `supabase db push --linked` fails with:
```
ERROR: CAT-14 pre-flight failed: N rows in watches have NULL catalog_id. Run npm run db:backfill-catalog or inspect manually (see docs/deploy-db-setup.md Phase 36 recovery flow), then retry the migration.
```

The transaction has rolled back. Prod is in pre-migration state. `watches.catalog_id` is still nullable. `watch_variants` does NOT exist. `watches.variant_id` does NOT exist. No data loss.

Recovery:

1. **Inspect orphans:**
   ```sql
   SELECT id, user_id, brand, model, reference, created_at
     FROM watches WHERE catalog_id IS NULL
     ORDER BY created_at;
   ```

2. **For each orphan, choose one path:**

   **Path (a) — Re-run safety re-link** (if the orphan matches an existing canonical Reference):
   ```bash
   DATABASE_URL="<prod pooler URL>" npm run db:backfill-catalog
   ```
   Idempotent. Picks up any orphan whose `(brand, model, reference)` matches an existing canonical Reference via the `WHERE catalog_id IS NULL` filter.

   **Path (b) — Manual upsert via DAL helper** (if no canonical match exists):
   ```bash
   # In a tsx repl or one-shot script:
   await catalogDAL.upsertCatalogFromUserInput({
     userId: '<orphan user_id>',
     brand: '<orphan brand>',
     model: '<orphan model>',
     reference: '<orphan reference>',
   })
   # Then re-run db:backfill-catalog to link.
   ```

3. **Re-verify zero NULLs:**
   ```sql
   SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL;
   -- expect: 0
   ```

4. **Retry the migration push:** `supabase db push --linked`

Per D-07 rationale: auto-creating user_promoted rows inside the migration transaction (the rejected alternative) would silently create low-quality catalog rows the user never reviewed — loses curation discipline. Hard-fail + manual recovery is the safer path.

### 36.6 — Local DB re-sync after Phase 36

Per memory `project_local_db_reset.md`:

```bash
supabase db reset
npx drizzle-kit push
# Apply prior-phase Supabase migrations in lexical order (see §35.8 list), then:
docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260511000000_phase36_layer_c_variants.sql
```

If a local watch was inserted without a catalog link before the Phase 36 migration is applied locally, the DO $$ pre-flight will raise. Recovery: run `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:backfill-catalog` against local FIRST.

### 36.7 — Backout plan (if Phase 36 must be reverted post-deploy)

Reversible because Phase 36 is additive + a constraint flip:

```sql
BEGIN;

-- 1. Drop watches.variant_id column (clean since watch_variants is empty)
ALTER TABLE watches DROP COLUMN IF EXISTS variant_id;

-- 2. Drop watch_variants table (no rows ever inserted in Phase 36 per D-06)
DROP TABLE IF EXISTS watch_variants;

-- 3. Revert CAT-14 NOT NULL flip (rollback to original Phase 17 D-04 state)
ALTER TABLE watches ALTER COLUMN catalog_id DROP NOT NULL;

COMMIT;
```

**Caveat:** Once Phase 37 / 38 ship and downstream consumers assume `watches.catalog_id` is NOT NULL (e.g., Phase 38 CAT-13 LEFT JOIN simplification), backing out the NOT NULL flip would re-introduce defensive null-checks. Treat §36.7 as a Phase-36-only window — after Phase 37 ships, schedule a forward-fix instead of a backout.

**Drizzle-side backout:** Revert `src/db/schema.ts` to remove `watchVariants` table definition and `variantId` column on `watches`. Delete `drizzle/0009_phase36_layer_c_variants.sql` and remove the `idx=9` entry from `drizzle/meta/_journal.json`.
````

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────┐
                          │      Phase 36 Schema Migration       │
                          │       (single transaction)           │
                          └─────────────────────────────────────┘
                                          │
                                          ▼
                  ┌──────────────────────────────────────────┐
                  │ BEGIN; (Supabase migration file)         │
                  └──────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 0 — DO $$ pre-flight (FIRST STATEMENT)     │
              │ SELECT COUNT(*) FROM watches WHERE catalog_id    │
              │ IS NULL  →  if > 0, RAISE EXCEPTION → rollback   │
              └──────────────────────────────────────────────────┘
                                          │
                                          │ (orphan_count = 0)
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 1 — CREATE TABLE watch_variants             │
              │ (id, catalog_id FK NOT NULL ON DELETE RESTRICT,  │
              │  name, slug, dial_color, bezel, bracelet_variant,│
              │  image_url, timestamps, UNIQUE (catalog_id,slug))│
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 2 — updated_at trigger (Phase 34 pattern)   │
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 3 — ENABLE RLS + CREATE POLICY + GRANT      │
              │ public-read SELECT for anon/authenticated;       │
              │ NO INSERT/UPDATE/DELETE policy (service-role     │
              │ bypasses RLS — backfill scripts can still write) │
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 4 — ALTER TABLE watches ADD COLUMN          │
              │ variant_id uuid NULL REFERENCES watch_variants   │
              │ (id) ON DELETE SET NULL                          │
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 5 — CAT-14: ALTER TABLE watches ALTER       │
              │ COLUMN catalog_id SET NOT NULL                   │
              │ (now safe because pre-flight verified 0 orphans) │
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ STEP 6 — DO $$ post-assertion block (defensive)  │
              │ Verify all invariants: table exists, policy      │
              │ exists, anon SELECT works, catalog_id NOT NULL,  │
              │ FK ON DELETE clauses correct                     │
              └──────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌──────────────────────────────────────────────────┐
              │ COMMIT;  (atomic apply or atomic rollback)       │
              └──────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files outside what is already documented:
```
supabase/migrations/
└── 20260511000000_phase36_layer_c_variants.sql   # NEW (single file)

drizzle/
├── 0009_phase36_layer_c_variants.sql              # NEW
└── meta/_journal.json                              # MODIFIED (append idx=9)

src/db/
└── schema.ts                                        # MODIFIED:
                                                    #   - ADD watchVariants pgTable definition
                                                    #   - ADD variantId column on watches
                                                    #   - OPTIONALLY add .notNull() on watches.catalogId

docs/
└── deploy-db-setup.md                              # MODIFIED (append §36 section)

tests/integration/
└── phase36-rls.test.ts                             # NEW (mirrors phase34-rls.test.ts shape)

.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/
├── 36-CONTEXT.md                                   # EXISTS
├── 36-DISCUSSION-LOG.md                            # EXISTS
└── 36-RESEARCH.md                                  # THIS FILE
```

### Pattern 1: Drizzle vs Supabase Migration Split

**What:** Two migration files per phase. Drizzle for column shapes; Supabase for authoritative DDL (RLS, GRANT, CHECK, GENERATED, DO $$, triggers).
**When to use:** Every phase that touches the schema.
**Example:**
- Drizzle file: `drizzle/0009_phase36_layer_c_variants.sql` — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, FK guards via DO-block, no RLS, no GRANT
- Supabase file: `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — full DDL including DO $$ pre-flight, RLS, GRANT, post-assertion DO $$, single transaction

[VERIFIED: Phase 17 / 34 / 35 all follow this split — `supabase/migrations/20260426000000_phase17_drizzle_tables.sql` + `supabase/migrations/20260427000000_phase17_catalog_schema.sql` for Phase 17; `drizzle/0007_phase34_brands_families.sql` + `supabase/migrations/20260510000000_phase34_brands_families.sql` for Phase 34; same shape for Phase 35]

### Pattern 2: Service-Role-Only Writes via RLS

**What:** Public-read SELECT policy + GRANT SELECT to anon/authenticated. No INSERT/UPDATE/DELETE policy. service_role bypasses RLS.
**When to use:** Every catalog-tier table where end users do not directly write (brands, watch_families, watches_catalog, watch_lineage_edges, watch_variants).
**Example:**
```sql
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;
```

### Pattern 3: Inline DO $$ Pre-flight Assertion

**What:** A PL/pgSQL block that runs at the start of a migration, querying the live DB state and raising EXCEPTION if invariants don't hold.
**When to use:** Any constraint flip (NOT NULL, UNIQUE, CHECK) where prod data must satisfy the new constraint at apply time.
**Example:** See `## DO $$ Pre-flight Block` above.
**Rollback semantics:** RAISE EXCEPTION inside a transaction rolls back every prior statement. Pre-flight is the FIRST statement → clean no-op rollback.

### Anti-Patterns to Avoid

- **Phase 24-style enum rename** — N/A here (no enum changes), but the rule transfers: never rename or drop types/columns that have enum-bound dependents without surgery. Phase 36 has no such risk.
- **Naive `pg_depend` query with `IN` clause** — false positives from cross-table attnum collision (Phase 35 incident, memory rule 4a). Always use the JOIN form.
- **Drizzle migration carrying RLS / GRANT / DO $$** — Drizzle-kit ignores these clauses or emits malformed DDL. Drizzle stays structural-only; Supabase carries the safety mechanisms.
- **Forgetting to append `drizzle/meta/_journal.json`** — without the idx=N entry, drizzle-kit migrate silently skips and the prod `__drizzle_migrations` row count stays unchanged (silent no-op). Phase 34 Plan 01 caught this; Phase 36 must add idx=9 in the same task as the migration file.
- **Running `drizzle-kit push` against prod** — local-only. Prod uses `supabase db push --linked`. Memory rule 1.
- **Running `npm run db:backfill-catalog` without inline `DATABASE_URL=` override** — defaults to local Docker per `.env.local`. Footgun T-34-04 / T-17-BACKFILL-PROD-DB.
- **Splitting Phase 36 into multiple Supabase migration files** — single transaction is required so that the DO $$ pre-flight protects ALL of the variant table + variant_id + NOT NULL flip work. Splitting breaks the atomicity guarantee.
- **Auto-creating user_promoted catalog rows inside the DO $$ pre-flight** — rejected per D-07. Loses curation discipline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-flight zero-NULL check | A separate `scripts/check-orphans.ts` invoked by the operator | Inline `DO $$ ... RAISE EXCEPTION` as FIRST statement | Atomicity — must be in the same transaction as `SET NOT NULL` per ROADMAP success #3 |
| Validating RLS works | Custom GUC manipulation, role-switching, complex setup | `has_table_privilege('anon', 'public.watch_variants', 'SELECT')` + `@supabase/supabase-js` anon client | Phase 34 integration test pattern — 2-line verification |
| Detecting unexpected column dependents | Manually grepping migration files | `pg_depend` query (memory rule 4a JOIN form) | Postgres has the authoritative view of dependencies |
| Generating migration filename | Manual concatenation | `date -u +%Y%m%d%H%M%S` (with manual edit if collision) | 14-digit timestamp per memory rule 1; must be greater than highest existing |
| Updating Drizzle journal | Hand-edit JSON | `drizzle-kit generate` emits the journal entry automatically (then commit) | Phase 34 Plan 01 lesson — journal must be in same commit as migration |
| Idempotent table creation | Custom check-then-create script | `CREATE TABLE IF NOT EXISTS` + `DO $$ IF NOT EXISTS pg_constraint ADD CONSTRAINT END $$` | Phase 34 + Phase 35 Drizzle migrations use this pattern verbatim |
| Verifying NOT NULL flip succeeded | Custom DB introspection | `SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id'` (expect `'NO'`) | Standard PostgreSQL system catalog query |

**Key insight:** Every primitive Phase 36 needs has a direct precedent in Phase 17 / 34 / 35. Phase 36 is a re-application of established patterns, not invention. The ONE novel piece is the inline DO $$ pre-flight as FIRST statement (versus Phase 35's DO $$ as LAST statement post-assertion), and the syntactic shape is identical.

## Runtime State Inventory

Phase 36 is schema-only and additive (plus a constraint flip). However, this section applies because we are flipping `watches.catalog_id` to NOT NULL — a metadata change that could break runtime state if any system inserts new watches without a catalog link.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `watches.catalog_id` currently nullable in prod; `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL = 0` (post Phase 35 D-02 wipe + re-seed) [VERIFIED: Phase 35 D-02 + memory `project_db_wipeable_2026_05_09.md`] | None — pre-flight verifies before flip |
| **Stored data** | `watches_catalog` rows in prod = canonical Reference set (no fragmented rows post-Phase-35) | None — Phase 36 does not modify catalog rows |
| **Live service config** | None — no Supabase Edge Function, n8n workflow, Datadog dashboard, or external service references `watches.catalog_id` by name | None |
| **OS-registered state** | None — no cron job, no scheduled task, no pg_cron job uses `watches.catalog_id` as a parameter [VERIFIED: `supabase/migrations/20260427000001_phase17_pg_cron.sql` registers `refresh_watches_catalog_counts` which reads `watches_catalog.id`, NOT `watches.catalog_id`] | None |
| **Secrets/env vars** | None — no env var name encodes "catalog_id" | None |
| **Build artifacts / installed packages** | Drizzle `drizzle.__drizzle_migrations` table tracks applied migration hashes; new idx=9 row will be added by drizzle-kit migrate | None — automatic via drizzle-kit migrate |
| **Build artifacts** | `src/db/schema.ts` TypeScript types — `Watch.catalogId` currently inferred as `string \| null`; will flip to `string` if `.notNull()` is added on the Drizzle side | OPTIONAL plan-time decision: add `.notNull()` to Drizzle to tighten types. NOT required by Phase 36 success criteria. |
| **DEBT-12** | Per memory + STATE.md: prod's `drizzle.__drizzle_migrations` journal contains only idx=0 (`0000_flaky_lenny_balinger`). Migrations 0001..0008 were applied via `supabase db push --linked` and never recorded in the Drizzle journal table. Phase 36's `drizzle-kit migrate` against prod will (a) attempt 0001 first, (b) fail on `relation "watches" already exists`, (c) abort. | OPEN QUESTION for plan-phase: should Phase 36 also opportunistically repair DEBT-12 by running `scripts/repair-drizzle-journal.ts` (per REQUIREMENTS line 63)? STATE.md describes this as "opportunistic." If Phase 36 needs `drizzle-kit migrate` to work cleanly on prod, repair is required. If we skip drizzle-kit migrate for prod (apply only via supabase db push), no repair needed but the journal stays drifted. Recommend: PLAN-PHASE DECIDES. |

**Nothing found in a category:** Listed as "None" with verification rationale.

## Environment Availability

This phase has external dependencies (Supabase CLI, psql/docker, drizzle-kit). All required for migration apply and validation.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | `supabase db push --linked` (prod) and `supabase db reset` (local) | ✓ [CITED: docs/deploy-db-setup.md §0–§2] | 2.x | — |
| docker | `docker exec -i supabase_db_horlo psql -U postgres -d postgres` (local migration apply) | ✓ assumed (Phase 35 used it 2026-05-10) | — | psql with local connection string |
| psql client | All smoke-test SELECTs in deploy runbook | ✓ assumed (Phase 35 used it) | — | Supabase Studio Web SQL editor |
| drizzle-kit | `drizzle-kit generate` + `drizzle-kit migrate` | ✓ [VERIFIED: package.json devDependency 0.31.10] | 0.31.10 | — |
| Local Supabase Docker (`supabase_db_horlo`) | Integration tests | ✓ assumed | — | Skip integration tests if not running (Phase 34 test does `describe.skip` when DATABASE_URL ≠ localhost) |
| Prod session-mode pooler URL | All prod operations | Operator-supplied at deploy time | — | — |
| `DATABASE_URL` env for prod | drizzle-kit migrate against prod | Operator-supplied inline override | — | — |
| `DATABASE_URL` env for local | drizzle-kit push + integration tests | `.env.local` already has `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | — | — |
| @supabase/supabase-js | Integration test anon-client | ✓ [VERIFIED: package.json 2.103.0] | 2.103.0 | — |
| vitest | Test runner | ✓ [VERIFIED: package.json] | — | — |

**Missing dependencies with no fallback:** None. All required tools are already available.

**Missing dependencies with fallback:** None.

## Common Pitfalls

### Pitfall 1: Migration filename collision (memory rule 1+2)
**What goes wrong:** A 14-digit filename equal to or less than the highest existing supabase migration sorts before Phase 36 in lexical order, causing `supabase db push` to skip it.
**Why it happens:** Operator types `20260510000002` instead of `20260511000000` thinking they need to slot it on the Phase 35 day.
**How to avoid:** Always check `ls -1 supabase/migrations/ | tail -1` before writing the filename. Phase 36 should use `20260511000000_phase36_layer_c_variants.sql` (next day, 00:00:00).
**Warning signs:** `supabase db push --linked` reports "0 migrations to apply" when Phase 36 should be in the queue.

### Pitfall 2: DO $$ pre-flight not the FIRST statement (ROADMAP success #3)
**What goes wrong:** If a `CREATE TABLE watch_variants` or `ALTER TABLE watches ADD COLUMN variant_id` lands before the DO $$ pre-flight, the rollback on a pre-flight failure also rolls back those statements — fine for atomicity, but ROADMAP success #3 verbatim states the pre-flight is FIRST.
**Why it happens:** Operator orders statements by "natural" order (table creation first), forgetting the ROADMAP-locked sequencing.
**How to avoid:** Add a comment block above the DO $$ block: `-- STEP 0: FIRST STATEMENT — ROADMAP success #3 requires this`. Plan-checker should grep `head -25` of the migration file to confirm DO $$ appears before any CREATE / ALTER.
**Warning signs:** Verifier or plan-checker flags ROADMAP success #3 as ambiguous.

### Pitfall 3: GRANT SELECT omitted (memory `project_supabase_secdef_grants.md`)
**What goes wrong:** `CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true)` lands but the `GRANT SELECT TO anon, authenticated` is forgotten. `has_table_privilege('anon', 'public.watch_variants', 'SELECT')` returns `false`. Anon reads fail.
**Why it happens:** RLS policy is documented as "the access control"; operator assumes policy alone is sufficient.
**How to avoid:** Mirror Phase 34/35's verbatim 4-line block: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS ...; CREATE POLICY ... FOR SELECT USING (true); GRANT SELECT ON ... TO anon, authenticated;`. The GRANT line is non-negotiable.
**Warning signs:** Integration test `it('anon can SELECT watch_variants')` fails with the privilege check returning `false`.

### Pitfall 4: Cross-table `attnum` collision in `pg_depend` query (memory rule 4a)
**What goes wrong:** The naive `IN` form of the pg_depend query returns false positives — CHECK constraints on UNRELATED columns of OTHER tables show up as "catalog_id dependents" because the `attnum` value (e.g., 10) happens to match. Phase 35 incident: `watches_catalog_image_source_url_protocol_check` falsely reported as movement dependent.
**Why it happens:** `refobjsubid` is column NUMBER, not column name. The naive query filters by attnum from a UNION that doesn't preserve which table each attnum came from.
**How to avoid:** Always use the JOIN form documented in `## pg_depend Pre-check` — joins `pg_attribute` by both `attrelid` AND `attnum`.
**Warning signs:** pg_depend reports dependents on tables you didn't expect — and they're CHECK constraints on different columns.

### Pitfall 5: Drizzle / Supabase shape drift on `watches.variant_id`
**What goes wrong:** Drizzle definition declares `variant_id` with `onDelete: 'set null'`, but the Supabase migration writes `ON DELETE CASCADE` (or vice versa). Local apply uses one path; prod apply uses the other; behaviors diverge.
**Why it happens:** Operator copy-pastes from the wrong precedent. Phase 34 D-02 uses RESTRICT for entity FKs; Phase 17 D-04 uses SET NULL for catalog FKs.
**How to avoid:** D-04 locks `watches.variant_id` to `ON DELETE SET NULL`. D-03 locks `watch_variants.catalog_id` to `ON DELETE RESTRICT`. Plan-time review must verify both Drizzle and Supabase files use the correct clause for each FK.
**Warning signs:** Verifier `pg_constraint` introspection reveals `confdeltype` mismatch (`'n'` for SET NULL vs `'r'` for RESTRICT vs `'c'` for CASCADE).

### Pitfall 6: Drizzle `catalogId` still typed as nullable after CAT-14 flip
**What goes wrong:** After Phase 36 ships, prod's `watches.catalog_id` is NOT NULL, but Drizzle's `src/db/schema.ts:118` still has `catalogId: uuid('catalog_id').references(...)` without `.notNull()`. `InferSelectModel<typeof watches>.catalogId` keeps reporting `string | null`. Downstream consumers (Phase 38) defensively null-check a value that can no longer be null.
**Why it happens:** The CAT-14 flip is at the Supabase migration level; Drizzle's type system needs a manual sync.
**How to avoid:** Plan-time decision (recommend YES): edit `src/db/schema.ts:118` to add `.notNull()` on `catalogId`. The change is mechanical and ships in the same Phase 36 task as the `watchVariants` add.
**Warning signs:** TypeScript types still allow `watch.catalogId === null` after Phase 36; Phase 38 CAT-13 LEFT JOIN code paths handle a null that can never happen.

### Pitfall 7: drizzle-kit migrate against prod fails due to DEBT-12 journal drift
**What goes wrong:** prod's `drizzle.__drizzle_migrations` has only idx=0. drizzle-kit migrate tries 0001 first, fails on `relation "watches" already exists`, aborts. Phase 36's new migration is never applied via the drizzle path. The supabase path (db push --linked) successfully applies the Supabase file; the Drizzle file's `IF NOT EXISTS` clauses make it a no-op IF you got it to run, but you can't get it to run.
**Why it happens:** Pre-existing DEBT-12 from before v5.0 — multiple migrations were applied via `supabase db push --linked` and never journaled.
**How to avoid:** Plan-phase decision: (a) skip drizzle-kit migrate against prod for Phase 36 (rely on `supabase db push --linked` only — the Drizzle file is documentation), OR (b) opportunistically repair DEBT-12 via `scripts/repair-drizzle-journal.ts` per REQUIREMENTS line 63. STATE.md flags DEBT-12 as opportunistic; the next phase that NEEDS drizzle-kit migrate is the trigger.
**Warning signs:** §36.3 `npx drizzle-kit migrate` against prod errors with "relation ... already exists."

### Pitfall 8: Local apply with leftover orphans triggers DO $$ pre-flight
**What goes wrong:** Local developer has added test watches without running `npm run db:backfill-catalog` against local. Phase 36 migration applied locally fails at DO $$ pre-flight.
**Why it happens:** Local dev DB drift; ad-hoc inserts skip the catalogDAL flow.
**How to avoid:** Document in §36.6 (local re-sync): run `db:backfill-catalog` against local FIRST. Recovery: same as prod (§36.5 flow).
**Warning signs:** Local supabase migration apply prints `ERROR: CAT-14 pre-flight failed: N rows have NULL catalog_id`.

## Code Examples

### Drizzle `pgTable` for `watchVariants` (NEW — insert in `src/db/schema.ts`)

```typescript
// Source: src/db/schema.ts patterns for brands (lines 377–394) + watchFamilies (lines 396–414) + watchLineageEdges (lines 420–444)
// Phase 36 D-02..D-05: watch_variants table (CAT-17).
// RLS public-read + GRANT SELECT to anon/authenticated co-located in
// supabase/migrations/20260511000000_phase36_layer_c_variants.sql.
export const watchVariants = pgTable(
  'watch_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
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

### `watches` table edit — `variantId` add + optional `catalogId` NOT NULL tightening

```typescript
// Source: src/db/schema.ts lines 65–134 (existing watches definition)
// Phase 36 edits — ADD variantId column; OPTIONALLY tighten catalogId to .notNull().
export const watches = pgTable(
  'watches',
  {
    // ... existing columns unchanged ...

    // CHANGED in Phase 36 (optional but recommended): catalogId becomes NOT NULL on Drizzle side
    // to match the prod constraint flip. Without this edit, TypeScript still treats
    // watch.catalogId as string | null even though prod has flipped to NOT NULL.
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'set null' }),
    // (was: uuid('catalog_id').references(...))

    // NEW in Phase 36 (D-04): variantId column
    variantId: uuid('variant_id').references(() => watchVariants.id, { onDelete: 'set null' }),

    // ... existing columns unchanged ...
  },
  (table) => [
    index('watches_user_id_idx').on(table.userId),
    index('watches_catalog_id_idx').on(table.catalogId),
    index('watches_user_sort_idx').on(table.userId, table.sortOrder),
    // Note: no watches_variant_id_idx by default (no DAL query path uses variantId in Phase 36).
    // If Phase 39 adds variant filtering queries, the index can be added then.
  ],
)
```

### Supabase migration — full file template

```sql
-- supabase/migrations/20260511000000_phase36_layer_c_variants.sql
-- Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL (CAT-17 + CAT-14)
-- Source: 36-CONTEXT.md D-01..D-07; 36-RESEARCH.md §Migration Statement Ordering
-- Sibling Drizzle migration: drizzle/0009_phase36_layer_c_variants.sql (column shapes only — no RLS, no DO $$, no GRANT)
-- Threats mitigated: T-36-01 (anon write blocked by RLS service-role-only), T-36-02 (anon read via GRANT SELECT
--                    per memory project_supabase_secdef_grants.md), T-36-03 (FK orphans blocked by ON DELETE RESTRICT
--                    on watch_variants.catalog_id), T-36-04 (CAT-14 silent application — DO $$ pre-flight rolls back
--                    the entire transaction if any orphan exists).
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

-- ============================================================================
-- STEP 1: CREATE TABLE watch_variants (D-02).
-- ============================================================================
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

-- ============================================================================
-- STEP 2: updated_at trigger (Phase 34 pattern).
-- ============================================================================
CREATE OR REPLACE FUNCTION watch_variants_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_variants_set_updated_at_trg ON watch_variants;
CREATE TRIGGER watch_variants_set_updated_at_trg BEFORE UPDATE ON watch_variants
  FOR EACH ROW EXECUTE FUNCTION watch_variants_set_updated_at();

-- ============================================================================
-- STEP 3: RLS + GRANT (D-05; T-36-01 + T-36-02 mitigation).
-- ============================================================================
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_variants_select_all ON watch_variants;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;

-- ============================================================================
-- STEP 4: ADD COLUMN watches.variant_id (D-04).
-- ============================================================================
ALTER TABLE watches
  ADD COLUMN variant_id uuid NULL
    REFERENCES watch_variants(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 5: CAT-14 NOT NULL flip (the load-bearing constraint change).
-- ============================================================================
ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Final assertion block (Phase 17 / 34 / 35 pattern).
-- ============================================================================
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
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='watch_variants')
    INTO watch_variants_table_exists;
  SELECT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND policyname='watch_variants_select_all')
    INTO watch_variants_select_policy_exists;
  SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT')
    INTO anon_can_select_variants;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='watches' AND column_name='variant_id')
    INTO variant_id_col_exists;
  SELECT (is_nullable = 'NO') INTO catalog_id_is_not_null
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='watches' AND column_name='catalog_id';
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='watch_variants_catalog_slug_unique'
                    AND conrelid='watch_variants'::regclass)
    INTO watch_variants_catalog_slug_unique;
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'watches'::regclass
                   AND a.attname = 'variant_id' AND c.confdeltype = 'n')
    INTO variant_id_fk_set_null;
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'watch_variants'::regclass
                   AND a.attname = 'catalog_id' AND c.confdeltype = 'r')
    INTO variant_catalog_id_fk_restrict;

  IF NOT watch_variants_table_exists         THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants table missing'; END IF;
  IF NOT watch_variants_select_policy_exists THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants_select_all policy missing'; END IF;
  IF NOT anon_can_select_variants            THEN RAISE EXCEPTION 'Phase 36 failed -- anon cannot SELECT watch_variants (T-36-02 mitigation broken)'; END IF;
  IF NOT variant_id_col_exists               THEN RAISE EXCEPTION 'Phase 36 failed -- watches.variant_id column missing'; END IF;
  IF NOT catalog_id_is_not_null              THEN RAISE EXCEPTION 'Phase 36 failed -- watches.catalog_id is still nullable (CAT-14 flip missed)'; END IF;
  IF NOT watch_variants_catalog_slug_unique  THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants UNIQUE (catalog_id, slug) constraint missing'; END IF;
  IF NOT variant_id_fk_set_null              THEN RAISE EXCEPTION 'Phase 36 failed -- watches.variant_id FK is not ON DELETE SET NULL'; END IF;
  IF NOT variant_catalog_id_fk_restrict      THEN RAISE EXCEPTION 'Phase 36 failed -- watch_variants.catalog_id FK is not ON DELETE RESTRICT'; END IF;
END $$;

COMMIT;
```

### Integration test (NEW — `tests/integration/phase36-rls.test.ts`)

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

  // -------- T-36-02: anon SELECT privilege --------
  it('has_table_privilege: anon can SELECT watch_variants (T-36-02)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT') AS can
    `)
    expect((result as unknown as Array<{ can: boolean }>)[0].can).toBe(true)
  })

  it('anon supabase-js SELECT * FROM watch_variants works (T-36-02)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anon.from('watch_variants').select('*')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  // -------- T-36-01: anon INSERT blocked --------
  it('anon supabase-js INSERT INTO watch_variants fails with RLS (T-36-01)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.from('watch_variants').insert({
      catalog_id: randomUUID(), name: 'AnonVariant', slug: 'anon-variant',
    })
    expect(error).not.toBeNull()
    expect(`${error?.code ?? ''} ${error?.message ?? ''}`).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
  })

  // -------- T-36-04: CAT-14 NOT NULL --------
  it('watches.catalog_id is NOT NULL after Phase 36 (CAT-14)', async () => {
    const result = await db.execute<{ is_nullable: string }>(sql`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches' AND column_name='catalog_id'
    `)
    expect((result as unknown as Array<{ is_nullable: string }>)[0].is_nullable).toBe('NO')
  })

  // -------- Schema shape --------
  it('watch_variants table has all 10 expected columns', async () => {
    const result = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watch_variants'
       ORDER BY ordinal_position
    `)
    const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
    expect(cols).toEqual([
      'id', 'catalog_id', 'name', 'slug', 'dial_color', 'bezel',
      'bracelet_variant', 'image_url', 'created_at', 'updated_at',
    ])
  })

  it('watch_variants has UNIQUE (catalog_id, slug)', async () => {
    const result = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname='watch_variants_catalog_slug_unique'
           AND conrelid='watch_variants'::regclass
      ) AS exists
    `)
    expect((result as unknown as Array<{ exists: boolean }>)[0].exists).toBe(true)
  })

  it('watches.variant_id FK has ON DELETE SET NULL', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watches'::regclass AND a.attname='variant_id'
    `)
    // 'n' = SET NULL per Postgres docs
    expect((result as unknown as Array<{ confdeltype: string }>)[0].confdeltype).toBe('n')
  })

  it('watch_variants.catalog_id FK has ON DELETE RESTRICT', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watch_variants'::regclass AND a.attname='catalog_id'
    `)
    // 'r' = RESTRICT per Postgres docs
    expect((result as unknown as Array<{ confdeltype: string }>)[0].confdeltype).toBe('r')
  })

  // -------- T-36-03: FK orphan rejection --------
  it('INSERT into watch_variants with non-existent catalog_id fails with FK violation (T-36-03)', async () => {
    // Service-role write — use the DB connection directly (anon can't insert per T-36-01).
    await expect(
      db.execute(sql`
        INSERT INTO watch_variants (catalog_id, name, slug)
        VALUES (${randomUUID()}, 'OrphanVariant', 'orphan-variant')
      `)
    ).rejects.toMatchObject({ code: '23503' }) // foreign_key_violation
  })

  // -------- CAT-14 enforcement --------
  it('INSERT into watches with NULL catalog_id fails with NOT NULL violation (CAT-14)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches (user_id, brand, model, status, catalog_id)
        VALUES (${randomUUID()}, 'TestBrand', 'TestModel', 'wishlist', NULL)
      `)
    ).rejects.toMatchObject({ code: '23502' }) // not_null_violation
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pg_depend` query using `IN` clause for column-attnum match | JOIN form on `pg_attribute` by `attrelid AND attnum` | Phase 35 incident 2026-05-10 (DEV-35-07-03) | Cross-table attnum collision risk eliminated; documented as memory rule 4a |
| Wipe + re-seed as a 6-step ROADMAP runbook | Inherit Phase 35 D-02 TRUNCATE; Phase 36 only runs the post-wipe (d)(e)(f) steps | Phase 35 (2026-05-10) | Phase 36 runbook is shrunken; audit trail preserved via inheritance note |
| Adding NOT NULL constraints via a separate phase after backfill | DO $$ pre-flight inside the same migration transaction | Phase 36 (this phase) | Atomicity guarantee; ROADMAP success #3 sequencing locked |
| Variant data stored on `watches_catalog` via fragmented rows (e.g., "16610 Kermit", "16610 black dial") | Canonical Reference + N Variants in `watch_variants` | Phase 36 schema; Phase 39 population | Fragmentation cleanup deferred — Phase 35 D-02 already wiped, so no fragmented rows exist post-2026-05-10 |
| Catalog-tier RLS via REVOKE FROM PUBLIC | RLS POLICY + explicit GRANT SELECT TO anon/authenticated | Phase 11 incident (`project_supabase_secdef_grants.md`) | Memory rule established; Phase 17/34/35/36 all use this verbatim |

**Deprecated/outdated:**
- The original 6-step ROADMAP success #2 runbook (steps a/b/c) — superseded by Phase 35 D-02 inheritance; documented in CONTEXT.md D-01.
- Phase 17 D-04's "NEVER SET NOT NULL in v4.0" comment on `watches.catalog_id` — superseded by CAT-14 (Phase 36 flips it). Update the schema.ts comment in the same task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle SET NOT NULL on `catalog_id` is a no-op when the column is already NOT NULL | `## Drizzle Schema Additions` | Low — standard Postgres semantics. Verify by reading PostgreSQL ALTER TABLE docs in plan-phase. If wrong, the Drizzle migration would fail on re-apply; mitigation is to remove the redundant statement. |
| A2 | An index on a column is unaffected by a nullability change | `## pg_depend Pre-check` | Low — standard Postgres index semantics (index entries store values, not constraint metadata). If wrong, Phase 36's `watches_catalog_id_idx` would need to be dropped + recreated. Phase 17/34/35 added similar constraints without index disruption. |
| A3 | DEBT-12 status (drizzle journal drift) — plan-phase decides whether Phase 36 opportunistically repairs | `## Runtime State Inventory` | Medium — if DEBT-12 is not addressed and §36.3 includes `drizzle-kit migrate`, the prod apply fails. Mitigation in plan-phase: either (a) skip drizzle-kit migrate on prod for Phase 36, or (b) include the repair script. Both are valid; the decision is product/operator preference. |
| A4 | Whether to tighten `catalogId` to `.notNull()` in `src/db/schema.ts` is a plan-time decision (recommended YES) | `## Drizzle Schema Additions` Pitfall 6 | Low — Phase 36 ships regardless. NOT NULL on Drizzle is a strict improvement: it locks the TypeScript types to match the new prod reality. Without it, downstream consumers (Phase 38) defensively null-check unnecessarily. |
| A5 | docker is available on the operator machine for local Supabase migration apply | `## Local Re-sync Recipe` | Low — verified by Phase 35 (used docker on 2026-05-10). Fallback to psql with localhost connection string. |
| A6 | The CAT-14 NOT NULL flip on `watches.catalog_id` does not invalidate any Phase 17 SECDEF function or RLS policy that references `catalog_id` by name | Migration ordering | Low — Phase 17 functions reference `watches_catalog.id` (the parent), not `watches.catalog_id` (the child). `watches.catalog_id` participates only in the FK and the index. Confirmed via grep. |

## Open Questions

1. **Should Phase 36 opportunistically repair DEBT-12 (drizzle journal drift)?**
   - What we know: prod has only idx=0 in `drizzle.__drizzle_migrations`; idx=1..8 were applied via `supabase db push --linked` and never journaled. REQUIREMENTS line 63 schedules this as "opportunistic — next prod deploy needing drizzle-kit migrate."
   - What's unclear: Does Phase 36 NEED `drizzle-kit migrate` to work cleanly on prod, or is `supabase db push --linked` sufficient? If the latter, the Drizzle file is documentation-only; if the former, repair is required.
   - Recommendation: Plan-phase decides. Recommend SKIP for Phase 36 (rely on supabase db push only). Repair fits better in a less-load-bearing phase. The Drizzle file is still emitted for local re-sync support and for type inference at build time.

2. **Should `src/db/schema.ts:118` add `.notNull()` on `catalogId` in the same task as Phase 36's other schema edits?**
   - What we know: CAT-14 flips the prod constraint. Drizzle's TS inference currently reports `catalogId: string | null`.
   - What's unclear: Strictly speaking, ROADMAP success #4 covers the prod-schema state, not the Drizzle source. The phase passes without the `.notNull()` tightening.
   - Recommendation: Plan-phase includes the `.notNull()` edit as a single-line task. Marginal cost; meaningful type-safety improvement for Phase 38 onwards.

3. **Does Phase 36 need to add a watches.variant_id index?**
   - What we know: `watches_variant_id_idx` is NOT in the locked deliverables. Phase 39 will populate variant_id and may query by it (e.g., "how many people own this specific variant?").
   - What's unclear: Whether Phase 36 should add the index now (cheap on an empty column) or defer to Phase 39 (no current query path uses it).
   - Recommendation: Plan-phase decides. Recommend ADD the index in Phase 36 — it's free on an empty column and avoids a future migration. Phase 17 and Phase 34 both added indexes on FK columns at table-create time (`watches_catalog_id_idx`, `watches_catalog_brand_id_idx`).

## Architectural Responsibility Map (consolidated for planner)

See `## Architectural Responsibility Map` above. All capabilities are Database / Storage tier. No frontend, no backend API, no edge function work.

## Security Domain

`security_enforcement` is not explicitly false in `.planning/config.json` (key absent — treat as enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Database-tier schema change; no architectural shift |
| V2 Authentication | no | No auth changes; Phase 22 password re-auth unaffected |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | RLS policy + GRANT SELECT discipline (memory `project_supabase_secdef_grants.md`); service-role writes only |
| V5 Input Validation | yes (downstream) | Phase 39 variant population will use Zod schemas in the backfill script; Phase 36 ships zero app flow |
| V6 Cryptography | no | No crypto |
| V7 Error Handling | yes | DO $$ RAISE EXCEPTION reveals orphan counts but no PII |
| V8 Data Protection | yes | Variant data is per-Reference public catalog metadata, not PII |
| V9 Communications | no | No new endpoints |
| V10 Malicious Code | no | No new dependencies |
| V11 Business Logic | no | No business logic |
| V12 File / Resources | no | No file ops |
| V13 API | no | No new APIs |
| V14 Configuration | yes | Migration filename + ordering rules (memory rule 1+2); idempotency via IF NOT EXISTS |

### Known Threat Patterns for Postgres / Supabase / Drizzle Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon write to public-read table | E (Elevation of Privilege) | RLS policy with no INSERT/UPDATE/DELETE policy; service-role bypasses RLS (T-36-01) |
| Anon read denied despite RLS policy | I (Information Disclosure / availability) | Explicit `GRANT SELECT TO anon, authenticated` per memory rule (T-36-02) |
| FK orphans (delete cascade or refs to deleted rows) | T (Tampering) | `ON DELETE RESTRICT` on `watch_variants.catalog_id` (T-36-03); `ON DELETE SET NULL` on `watches.variant_id` (preserves user data) |
| Silent CAT-14 application against orphan rows | T (Tampering) / D (Denial) | DO $$ pre-flight raises EXCEPTION before `SET NOT NULL` executes; rolls back atomically (T-36-04) |
| Migration filename collision (silent skip) | T (Tampering) | 14-digit timestamp strictly greater than highest existing (memory rule 1+2) |
| pg_depend false positive blocking deploy | D (Denial) | JOIN form (memory rule 4a); recovery: ignore false-positives if dependent is on different column |
| Drizzle journal drift causing migrate failure | D (Denial) | DEBT-12 awareness; plan-phase decision to skip drizzle-kit migrate or repair |
| Wrong-DB backfill (T-34-04 mirror) | T (Tampering) / I | Inline `DATABASE_URL=<prod pooler URL>` override on every prod backfill command |

## Risks & Landmines (consolidated)

1. **Timestamp collision** — `20260511000000` is unique; verify with `ls supabase/migrations/ | tail -1` before write.
2. **RLS misconfig** — GRANT SELECT omitted (memory `project_supabase_secdef_grants.md`); mitigation: 4-line block verbatim from Phase 34.
3. **GRANT omission** — same as above; covered by Phase 34 pattern.
4. **Drizzle / Supabase shape drift** — FK cascade clause mismatch (D-03 RESTRICT vs D-04 SET NULL); mitigation: plan-checker reviews both files.
5. **DO $$ not first statement** — ROADMAP success #3 verbatim violation; mitigation: comment block + plan-checker grep `head -25`.
6. **pg_depend false positive** — naive IN form; mitigation: JOIN form documented in runbook §36.0.
7. **DEBT-12 journal drift** — drizzle-kit migrate against prod fails; mitigation: plan-phase decision (skip or repair).
8. **Drizzle `.notNull()` not synced** — TS types still allow null; mitigation: plan-phase includes the schema edit.
9. **Local apply with orphans** — local dev DB drift; mitigation: §36.6 runbook recipe runs db:backfill-catalog locally first.
10. **Backout caveat** — after Phase 37+ ships, the §36.7 backout becomes destructive; mitigation: documented as Phase-36-only window.
11. **Single-user assumption** — `auth.users count = 1` must hold; mitigation: §36.0 verification step (precondition, not a step).
12. **Variant-only flows after Phase 39** — out of scope here, but flag: when Phase 39 adds variant population, the parity grep proof must be re-run because `variantId` will appear in `src/data/` and `src/components/` paths.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-CONTEXT.md` — Phase 36 locked decisions D-01..D-07
- `.planning/REQUIREMENTS.md` lines 29 (CAT-17) and 37 (CAT-14)
- `.planning/ROADMAP.md` lines 251–261 (Phase 36 goal + 5 success criteria)
- `.planning/STATE.md` (Phase 35 complete 2026-05-10; Phase 36 next-up)
- `.planning/phases/35-layer-b-lineage-edges-structured-movement-era-material/35-CONTEXT.md` (D-02 TRUNCATE inheritance; D-04/D-10/D-11 precedent)
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` (D-01 table shape; D-02 ON DELETE RESTRICT; D-03 ship-empty pattern)
- `supabase/migrations/20260510000001_phase35_layer_b.sql` (full file read — RLS + GRANT + DO $$ patterns)
- `supabase/migrations/20260510000000_phase34_brands_families.sql` (full file read — entity-table pattern)
- `drizzle/0008_phase35_layer_b.sql` (full file read — idempotent Drizzle pattern)
- `drizzle/0007_phase34_brands_families.sql` (full file read — idempotent FK guard pattern)
- `src/db/schema.ts` (full file read — current state of `watches`, `watchesCatalog`, `brands`, `watchFamilies`, `watchLineageEdges`)
- `docs/deploy-db-setup.md` (full file read — Phase 17/34/35 deploy runbook structure)
- `package.json` (verified versions of drizzle-orm, drizzle-kit, next, postgres, @supabase/supabase-js)
- `drizzle/meta/_journal.json` (verified next idx=9 needed)
- `tests/integration/phase34-rls.test.ts` (read first 80 lines for test pattern)
- Memory: `project_drizzle_supabase_db_mismatch.md` Rules 1–4 + 4a [VERIFIED via Read]
- Memory: `project_local_db_reset.md` [VERIFIED — flagged 20 days old; re-verified against current docs/deploy-db-setup.md §35.8]
- Memory: `project_supabase_secdef_grants.md` [VERIFIED — flagged 19 days old; behavior re-verified against Phase 35 GRANT pattern]
- Memory: `project_db_wipeable_2026_05_09.md` (single-user prod state)
- Grep proofs run 2026-05-11: no `variant_id` / `variantId` references in `src/data` / `src/app` / `src/lib` / `src/components`; `upsertCatalogFromUserInput` always populates catalog_id in addWatch flow

### Secondary (MEDIUM confidence)
- PostgreSQL DO statement docs (PL/pgSQL inline blocks) [WebSearch cross-reference, training knowledge]
- PostgreSQL ALTER TABLE docs (SET NOT NULL idempotency, FK confdeltype semantics) [training knowledge — verify in plan-phase by reading official docs if any doubt]
- PostgreSQL `pg_depend` and `pg_attribute` system catalog docs [training knowledge — memory rule 4a is authoritative for this codebase]

### Tertiary (LOW confidence)
- None — all critical claims were verified via tool read or cited memory rules.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; versions verified in `package.json`; no new deps needed
- Architecture: HIGH — three direct precedents (Phase 17 / 34 / 35) for every primitive Phase 36 needs
- Pitfalls: HIGH — Phase 35 incident memory (rule 4a) captures the most recent landmine; Phase 24 incident memory captures the enum-rename landmine (N/A here); Phase 17/34/35 inherited patterns are battle-tested

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (30 days — Phase 36 is a stable, well-precedented schema migration; the only fast-moving piece is DEBT-12 status, which may resolve in any intervening prod-deploy phase)

---

*Phase: 36-Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL*
*Research completed: 2026-05-11*
