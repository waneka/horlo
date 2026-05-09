# Phase 34: Layer A — Brand + Family Entities — Research

**Researched:** 2026-05-09
**Domain:** PostgreSQL schema migration (Drizzle + Supabase split) + service-role backfill script
**Confidence:** HIGH

---

## Summary

Phase 34 is a schema-only migration with a near-perfect template precedent: Phase 17 (`20260427000000_phase17_catalog_schema.sql` + `drizzle/0004_phase17_catalog.sql` + `scripts/backfill-catalog.ts`). Every architectural choice is already locked by CONTEXT.md D-01 through D-06 and inherited Phase 17 D-NN decisions. The research effort here is small: confirm filename sequencing, lock the exact RLS / GENERATED / FK shapes, walk the backfill script template, identify the cheapest verification harness for "31 DAL queries unchanged", and sketch the deploy runbook delta.

The plan should ship two SQL files (one Drizzle migration, one Supabase migration), one TypeScript script with one optional argument flag, an updated `src/db/schema.ts` with two new exports plus two FK column additions, a new `package.json` script entry, an appended runbook section, and a Vitest integration test that asserts RLS truth values against the local DB. Production execution actually runs the brand backfill (per D-03), so the plan must include a "run it on prod" step gated behind the migration push.

**Primary recommendation:** Mirror Phase 17 exactly — same Drizzle/Supabase split, same `DO $$ ... END $$` idempotent guards, same `WHERE x IS NULL` shrink-to-empty backfill loop, same `tsx --env-file=.env.local` script entry. Do not invent new patterns.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (Phase 17 / Phase 19.1 / Phase 33b inheritance):**
- Phase 17 D-02 / D-03 — `brands.name_normalized` and `watch_families.name_normalized` MUST be `GENERATED ALWAYS AS (lower(trim(name))) STORED`. No app-side computation, no triggers.
- Phase 17 D-04 / D-06 — RLS pattern: public-read SELECT for `anon` and `authenticated`; INSERT/UPDATE/DELETE restricted to `service_role` only via the absence of a write policy. Co-located in the same Supabase migration file as `CREATE TABLE`.
- Phase 17 D-15 — no denormalized counts (`watch_count`, `owners_count`) on brands/families in Phase 34.
- Phase 19.1 — Drizzle definition is type-source-of-truth; Supabase migration carries authoritative DDL (RLS, CHECK, GENERATED, FK).
- Phase 33b Q2 verdict (DEFERRED) — lineage / family browse UI deferred to Phase 39 / v5.x. Phase 34 ships zero user-facing affordances referencing brands or families.
- Memory `project_drizzle_supabase_db_mismatch.md`: 14-digit migration filenames, no insertion between adjacent integers, `pg_depend` check before structural changes, `WITH SCHEMA extensions` opclasses (only relevant if GIN indexes added — not in Phase 34).
- Memory `project_supabase_secdef_grants.md`: `REVOKE FROM PUBLIC` does NOT block anon; rely on RLS policies + explicit `GRANT SELECT` to anon/authenticated.

**Phase 34 specific (D-01 through D-06):**
- **D-01 — Minimal+ table shape with `country_of_origin` on brands.** Exact column list locked (see CONTEXT.md lines 47–67). `brands` has 7 cols + 1 generated; `watch_families` has 7 cols + 1 generated.
- **D-01a — `brands.slug UNIQUE NOT NULL`; `watch_families.slug` nullable.** Intra-brand uniqueness enforced via `UNIQUE (brand_id, name_normalized)` rather than a global slug uniqueness constraint.
- **D-01b — Slug NOT a GENERATED column.** Slug is set explicitly by the backfill script via `lower(replace(trim(name), ' ', '-'))`; URL-stable across name edits.
- **D-02 — `watches_catalog.brand_id` and `watches_catalog.family_id` both use `ON DELETE RESTRICT`.** Both nullable. `watch_families.brand_id` is `NOT NULL REFERENCES brands(id) ON DELETE RESTRICT`.
- **D-03 — Hybrid brands populated + production-run; families empty in Phase 34.**
  - Auto-derive brands from `SELECT DISTINCT brand_normalized FROM watches_catalog`.
  - `--patch-country=country.json` CLI flag for `country_of_origin` patches.
  - `watch_families` table stays empty; `family_id` stays NULL on every catalog row.
- **D-04 — Permanent denormalization.** `watches_catalog.brand` text NOT NULL stays forever; `brand_id` is purely the relational link. No future drop scheduled.
- **D-05 — Three-step migration discipline documented in CONTEXT.md.** Step 1 (Phase 34 — `NULL` allowed); Step 2 (Phase 35 — populate `family_id` + `watch_families`); Step 3 DEFERRED (NOT NULL flip — no target phase).
- **D-06 — Append a Phase 34 section to `docs/deploy-db-setup.md`** covering: `supabase db push --linked`, two `has_table_privilege` smoke-test queries, `npm run db:backfill-catalog-brands` invocation, three-step verification SQL.

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion. D-05 and D-06 are derived from ROADMAP success criteria #3 and #5. The remaining discretionary surface within planning:

- Test/verification harness shape (DAL parity smoke test) — sketched in Specifics but ship/skip is a planning-time call.
- Migration filename suffix (e.g., `_phase34_brands_families.sql` vs `_phase34_layer_a.sql`) — convention favors `phase34_brands_families`.
- Whether to ship a Vitest integration test that asserts RLS truth values against local DB (mirrors `tests/integration/phase17-secdef.test.ts` pattern).
- `country.json` initial content (which brands ship with country mappings out-of-the-box vs left for operator). Recommended: ship a starter map covering the obvious brands the user collection contains; let operator add the long tail.

### Deferred Ideas (OUT OF SCOPE)

From CONTEXT.md `<deferred>` section — DO NOT plan for any of these in Phase 34:

- Rich brand cols: `founding_year`, `logo_url`, `display_name`, `parent_brand_id` — additive `ALTER TABLE` candidates for Phase 39 / v6 / v5.x lineage browse.
- Rich family cols: `era_start`, `era_end`, `parent_family_id` — Phase 39 / v5.x candidates.
- `watch_families` table seeding — formally deferred to Phase 35 alongside lineage_edges.
- `brand_id` / `family_id` `NOT NULL` flip — formally deferred per D-05 step 3; no target phase.
- `watches_catalog.brand` text drop — explicitly NOT scheduled per D-04.
- Auto-extract families from `model` text — Phase 35 manual curation only.
- Hand-curated brand seed list (~30–50 canonical brands) — auto-derive from existing `brand_normalized` chosen instead.
- Admin UI for brand/family CRUD — locked out by ROADMAP success #4.
- `/brand/{id}` and `/family/{id}` browse pages — Phase 39 / v5.x per Phase 33b Q2.
- Denormalized counts (`brand_watch_count`, `family_owners_count`) — add when a UI page actually needs them.
- GIN indexes on `brands.name_normalized` for trigram search — add when brand-search becomes a feature; remember the `extensions.gin_trgm_ops` opclass rule.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-15 | Layer A: New `brands` and `watch_families` tables with public-read RLS + service-role-write. Nullable `brand_id` FK and nullable `family_id` FK added to `watches_catalog`. Existing DAL queries continue working unchanged. Backfill is manual via service-role scripts; no automated migration. Three-step migration discipline: nullable column add → backfill → (deferred) NOT NULL flip. | This entire research document. Specifically: (a) RLS template extracted from Phase 17 migration §6 mirrors the public-read + service-role-write pattern for the two new tables; (b) the FK ALTER pattern reuses Phase 17's `watches.catalog_id` precedent (`drizzle/0004_phase17_catalog.sql:45–48`) but with `ON DELETE RESTRICT` per D-02; (c) backfill skeleton lifted from `scripts/backfill-catalog.ts` with `WHERE x IS NULL` idempotence; (d) three-step discipline already documented in CONTEXT.md D-05 — runbook (D-06) appends the operator-facing step list; (e) DAL parity defended by ROADMAP success #2 — research validates that all 31 `watchesCatalog` references use SELECT-by-column patterns that survive nullable additive columns without modification. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brand entity table | Database (Postgres) | — | Schema-only addition; no app-tier representation in Phase 34. |
| Family entity table | Database (Postgres) | — | Schema-only addition; table empty in Phase 34. |
| `watches_catalog.brand_id` / `family_id` FK columns | Database (Postgres) | — | Pure schema addition; nullable; no DAL reads/writes in Phase 34. |
| RLS public-read + service-role-write | Database (Postgres) | — | Co-located in migration; enforced at row level; Server Actions / scripts use service-role client which bypasses RLS via DATABASE_URL. |
| GENERATED `name_normalized` columns | Database (Postgres) | — | `lower(trim(name))` computed by Postgres on every insert/update. App never computes normalization (Phase 17 D-02/D-03 inheritance). |
| Slug derivation | Service-role script (Node) | — | Per D-01b, slug is NOT GENERATED — it must survive name edits. The backfill script computes `lower(replace(trim(name), ' ', '-'))` once at insert time. |
| Brand backfill (auto-derive + link) | Service-role script (Node, run from operator machine) | — | One-shot service-role script reading prod via session-mode pooler URL. Idempotent on `WHERE brand_id IS NULL`. |
| `country_of_origin` patching | Service-role script + operator-curated `country.json` | — | Hybrid: script auto-runs the brand-derivation pass; the optional `--patch-country=country.json` flag applies a flat map on a second pass. |
| Drizzle type inference | Build-time (TypeScript) | — | `src/db/schema.ts` exports `brands` and `watchFamilies` for future DAL consumers (Phase 35+); Phase 34 ships the types but no runtime consumer reads them. |
| Deploy verification (RLS smoke tests) | Operator (psql via session-mode pooler) | Optional Vitest integration test | `has_table_privilege` queries are operator-runbook items per D-06; an optional `tests/integration/phase34-rls.test.ts` mirroring `phase17-secdef.test.ts` could automate the same checks against local DB. |

---

## Standard Stack

### Core (already installed — no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `^0.45.2` | TypeScript ORM + type inference for `brands` / `watchFamilies` | Already source-of-truth for column types in this project (`src/db/schema.ts`); Phase 17 / 19.1 / 27 precedent [VERIFIED: package.json:30, src/db/schema.ts:281] |
| `drizzle-kit` | `^0.31.10` | Generates Drizzle migration SQL from schema TS | Already used to emit `drizzle/0006_phase27_sort_order.sql` [VERIFIED: package.json:29, drizzle/0006_*] |
| `postgres` | `^3.4.9` | Postgres.js client backing `db` instance in `src/db` | Same client used by every other backfill script [VERIFIED: package.json:36] |
| `tsx` | (transitive — used via `npm run` scripts) | Runs TypeScript scripts with `--env-file=.env.local` | Phase 17 / 19.1 / 24 / 27 backfill script precedent [VERIFIED: package.json:12-16] |
| Supabase CLI | `2.x` | `supabase db push --linked` for prod migration apply | Locked via deploy runbook [VERIFIED: docs/deploy-db-setup.md:7] |
| Vitest | `^2.1.9` | Test framework for optional RLS integration test | Phase 17 SECDEF test uses identical shape [VERIFIED: tests/integration/phase17-secdef.test.ts] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `^2.103.0` | anon-client construction in optional RLS test | Only needed if writing an integration test that validates anon SELECT works; same pattern as `tests/integration/phase17-secdef.test.ts:11-14` [VERIFIED: package.json:25] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-authored Supabase migration | `drizzle-kit generate` exclusively | Drizzle 0.45.2 emits malformed DDL for `GENERATED ALWAYS AS` clauses (Phase 17 plan note explicitly documents this fallback); RLS / co-located policies cannot be expressed in Drizzle DSL. **Rejected — locked by Phase 17 / 19.1 split convention.** |
| `commander` / `yargs` for `--patch-country` | Inline `process.argv` parsing | Adds a transitive dep for a one-flag script. Existing precedent (`scripts/backfill-taste.ts:39-49`) uses inline `process.argv.slice(2).map` parsing into a `Map` — clean enough for this scope. **Recommended pattern: copy from `backfill-taste.ts`.** |
| New script directory layout | Reuse `scripts/` flat layout | Adds churn for no benefit. **Rejected — flat `scripts/*.ts` is the pattern.** |

### No new installations required
Phase 34 ships zero new dependencies. Every tool is already in `package.json`.

**Version verification** (verified 2026-05-09 against local lockfile):
- `drizzle-orm@0.45.2` confirmed via `node_modules/drizzle-orm/package.json`
- `drizzle-kit@0.31.10` confirmed via `package.json`
- `next@16.2.3` (relevant only because `'use client'` boundaries are unchanged — no app code in Phase 34)

---

## Architecture Patterns

### System Architecture Diagram

```
                           ┌──────────────────────────┐
                           │  src/db/schema.ts        │  ← TS source of truth (D-types)
                           │  + brands export         │
                           │  + watchFamilies export  │
                           │  + watchesCatalog gains  │
                           │    .brandId / .familyId  │
                           └─────────────┬────────────┘
                                         │ drizzle-kit generate
                                         ▼
                       ┌─────────────────────────────────┐
                       │ drizzle/0007_phase34_brands_…sql│  ← columns shapes
                       └─────────────────────────────────┘
                                         │ npx drizzle-kit migrate (LOCAL ONLY)
                                         ▼
              ┌──────────────────────────────────────────────────┐
              │ supabase/migrations/                             │
              │   20260510000000_phase34_brands_families.sql     │  ← AUTHORITATIVE for prod
              │   • CREATE TABLE brands (with GENERATED, RLS)    │
              │   • CREATE TABLE watch_families (FK, RLS)        │
              │   • ALTER watches_catalog ADD brand_id, family_id│
              │   • DO $$ idempotent guards + assertions          │
              └────────────────────────────┬─────────────────────┘
                                           │ supabase db push --linked  (PROD APPLY)
                                           ▼
                              ┌────────────────────────────┐
                              │  PROD POSTGRES             │
                              │  brands [empty]            │
                              │  watch_families [empty]    │
                              │  watches_catalog.brand_id  │
                              │  watches_catalog.family_id │
                              └─────────────┬──────────────┘
                                            │ npm run db:backfill-catalog-brands
                                            │ (DATABASE_URL = prod pooler URL)
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │ scripts/backfill-catalog-brands.ts               │
                  │  Pass A: INSERT INTO brands SELECT DISTINCT …    │
                  │  Pass B (--patch-country): UPDATE country_of_…   │
                  │  Pass C: UPDATE watches_catalog SET brand_id=…   │
                  │           (idempotent on brand_id IS NULL)       │
                  └──────────────────────────────────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────┐
                       │ Smoke verification (operator psql)   │
                       │  has_table_privilege(...) → t/t      │
                       │  COUNT(*) FROM watches_catalog       │
                       │     WHERE brand_id IS NULL → 0       │
                       │  COUNT(*) FROM watch_families → 0    │
                       └──────────────────────────────────────┘
```

**Trace the primary use case:** A v5.0 catalog row that today has `brand = "Rolex"` and `brand_normalized = "rolex"` but no relational FK gets a `brand_id` populated by the backfill script — the brand text remains (D-04 permanent denormalization), and the new FK becomes the relational anchor for Phase 35 lineage edges and v5.x browse pages without changing any existing query path.

### Component Responsibilities

| File | Role | Phase 34 change |
|------|------|----------------|
| `src/db/schema.ts` (lines 281–340) | TS column definitions for `watchesCatalog` | ADD `brandId` + `familyId` nullable FK columns; ADD two new exports `brands` and `watchFamilies` |
| `drizzle/0007_phase34_brands_families.sql` | Drizzle-generated DDL for column shapes | NEW FILE — emitted by `drizzle-kit generate`; may need hand-touch if `generatedAlwaysAs` emission is malformed (Phase 17 plan precedent) |
| `supabase/migrations/20260510000000_phase34_brands_families.sql` | Authoritative DDL: tables, FK, GENERATED, RLS, GRANT, assertions | NEW FILE — hand-authored mirroring Phase 17 schema migration (`20260427000000_phase17_catalog_schema.sql`) |
| `scripts/backfill-catalog-brands.ts` | Service-role script: derive brands → patch country → link `watches_catalog.brand_id` | NEW FILE — structural twin of `scripts/backfill-catalog.ts` |
| `package.json` `scripts.db:backfill-catalog-brands` | npm-run entry pointing to the backfill script | NEW ENTRY — mirrors `db:backfill-catalog`, `db:refresh-counts`, `db:backfill-taste` pattern |
| `country.json` (file path TBD by planner — likely `scripts/country.json` or `data/country.json`) | Operator-edited brand-name → ISO country mapping | NEW FILE — committed for repeatability per CONTEXT.md D-03 |
| `docs/deploy-db-setup.md` | Deploy runbook | APPEND a "Phase 34 — Layer A Brand + Family Entities Deploy Steps" section per D-06 |
| `tests/integration/phase34-rls.test.ts` | Optional Vitest integration test asserting RLS truth values against local DB | NEW FILE (optional but recommended) — mirrors `tests/integration/phase17-secdef.test.ts` shape |

### Recommended Project Structure

```
horlo/
├── drizzle/
│   └── 0007_phase34_brands_families.sql       ← NEW (Drizzle-emitted)
├── supabase/migrations/
│   └── 20260510000000_phase34_brands_families.sql  ← NEW (authoritative)
├── scripts/
│   ├── backfill-catalog.ts                    (existing — Phase 17)
│   ├── backfill-catalog-brands.ts             ← NEW
│   └── country.json                           ← NEW (planner picks path)
├── src/db/
│   └── schema.ts                              (modified — 2 new exports + 2 cols)
├── tests/integration/
│   └── phase34-rls.test.ts                    ← NEW (optional)
├── docs/
│   └── deploy-db-setup.md                     (appended — Phase 34 section)
└── package.json                               (modified — 1 new script entry)
```

### Pattern 1: Drizzle vs Supabase Migration Split (Phase 17 / 19.1 inheritance)

**What:** Drizzle migration declares column shapes (types, NOT NULL, defaults, FK existence). Supabase migration declares everything Drizzle's pg-core DSL can't faithfully express — RLS policies, GENERATED ALWAYS AS clauses, CHECK constraints, named unique constraints, embedded `DO $$ ... END $$` assertions.

**When to use:** Always, in this project. Locked by Phase 17 D-19.1 D-01.

**Example — `brands` table in Drizzle:**
```typescript
// src/db/schema.ts — NEW EXPORT (after watchesCatalog block)
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
// [CITED: src/db/schema.ts:281-340 (watchesCatalog template)]
```

**Example — `watchFamilies` table in Drizzle:**
```typescript
export const watchFamilies = pgTable(
  'watch_families',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').generatedAlwaysAs(
      sql`lower(trim(name))`,
    ),
    slug: text('slug'),  // nullable per D-01a
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_families_brand_name_unique').on(table.brandId, table.nameNormalized),
  ]
)
```

**Example — `watchesCatalog` ALTER (add nullable FK columns):**
```typescript
// src/db/schema.ts — modify existing watchesCatalog table definition
export const watchesCatalog = pgTable(
  'watches_catalog',
  {
    // ... existing columns unchanged ...
    extractedFromPhoto: boolean('extracted_from_photo').notNull().default(false),

    // ----- Phase 34 D-02: nullable FKs to brand + family -----
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' }),
    familyId: uuid('family_id').references(() => watchFamilies.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)
// Note: Drizzle resolves FK callbacks lazily (same pattern as watches.catalogId at schema.ts:101).
// Place `brands` and `watchFamilies` exports BEFORE watchesCatalog if not using callback form,
// OR use `() => brands.id` callback form if order can't be changed.
```

[CITED: src/db/schema.ts:101 — `watches.catalogId` uses callback `() => watchesCatalog.id` for forward reference; Phase 34's new FKs follow the same pattern.]

### Pattern 2: Supabase Migration Authoritative DDL (RLS + GENERATED + assertions)

**What:** A single `BEGIN ... COMMIT` transaction containing `CREATE TABLE`, GENERATED clause, FK clauses, RLS enable, RLS policies, GRANT statements, and a final `DO $$` assertion block that validates every claimed feature.

**Example — full Phase 34 Supabase migration shape:**
```sql
-- supabase/migrations/20260510000000_phase34_brands_families.sql
-- Phase 34 — Layer A: brand + family entities (CAT-15)
-- D-01..D-06; mirrors 20260427000000_phase17_catalog_schema.sql shape.
BEGIN;

-- ============================================================
-- 1. brands table (D-01)
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_normalized   text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  slug              text NOT NULL,
  country_of_origin text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_slug_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_slug_unique UNIQUE (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_name_normalized_unique') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_name_normalized_unique UNIQUE (name_normalized);
  END IF;
END $$;

-- updated_at trigger (Phase 17 D-12 pattern)
CREATE OR REPLACE FUNCTION brands_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS brands_set_updated_at_trg ON brands;
CREATE TRIGGER brands_set_updated_at_trg BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION brands_set_updated_at();

-- RLS — public-read; service-role-write only (Phase 17 D-04/D-06 pattern)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_select_all ON brands;
CREATE POLICY brands_select_all ON brands FOR SELECT USING (true);

-- ============================================================
-- 2. watch_families table (D-01)
-- ============================================================
CREATE TABLE IF NOT EXISTS watch_families (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  slug            text,  -- nullable per D-01a
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watch_families_brand_name_unique') THEN
    ALTER TABLE watch_families
      ADD CONSTRAINT watch_families_brand_name_unique UNIQUE (brand_id, name_normalized);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS watch_families_brand_id_idx ON watch_families (brand_id);

CREATE OR REPLACE FUNCTION watch_families_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_families_set_updated_at_trg ON watch_families;
CREATE TRIGGER watch_families_set_updated_at_trg BEFORE UPDATE ON watch_families
  FOR EACH ROW EXECUTE FUNCTION watch_families_set_updated_at();

ALTER TABLE watch_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_families_select_all ON watch_families;
CREATE POLICY watch_families_select_all ON watch_families FOR SELECT USING (true);

-- ============================================================
-- 3. watches_catalog FK column adds (D-02)
-- ============================================================
ALTER TABLE watches_catalog
  ADD COLUMN IF NOT EXISTS brand_id  uuid REFERENCES brands(id)         ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES watch_families(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS watches_catalog_brand_id_idx  ON watches_catalog (brand_id);
CREATE INDEX IF NOT EXISTS watches_catalog_family_id_idx ON watches_catalog (family_id);

-- ============================================================
-- 4. Sanity assertions (Phase 17 §8 pattern — fail loudly if any of the above didn't land)
-- ============================================================
DO $$
DECLARE
  brands_select_policy_exists boolean;
  families_select_policy_exists boolean;
  brand_id_col_exists boolean;
  family_id_col_exists boolean;
  brand_normalized_is_generated boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='brands_select_all')
    INTO brands_select_policy_exists;
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='watch_families_select_all')
    INTO families_select_policy_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id')
    INTO brand_id_col_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='family_id')
    INTO family_id_col_exists;
  SELECT (is_generated = 'ALWAYS') INTO brand_normalized_is_generated
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands' AND column_name='name_normalized';

  IF NOT brands_select_policy_exists THEN
    RAISE EXCEPTION 'Phase 34 failed — brands SELECT policy missing';
  END IF;
  IF NOT families_select_policy_exists THEN
    RAISE EXCEPTION 'Phase 34 failed — watch_families SELECT policy missing';
  END IF;
  IF NOT brand_id_col_exists THEN
    RAISE EXCEPTION 'Phase 34 failed — watches_catalog.brand_id column missing';
  END IF;
  IF NOT family_id_col_exists THEN
    RAISE EXCEPTION 'Phase 34 failed — watches_catalog.family_id column missing';
  END IF;
  IF NOT brand_normalized_is_generated THEN
    RAISE EXCEPTION 'Phase 34 failed — brands.name_normalized not GENERATED ALWAYS';
  END IF;
END $$;

COMMIT;
```

[CITED: supabase/migrations/20260427000000_phase17_catalog_schema.sql — full pattern source]

### Pattern 3: Service-Role Backfill Script (Phase 17 D-14 inheritance)

**What:** A `tsx --env-file=.env.local`-launched script that imports the `db` client (`src/db`) — which uses `DATABASE_URL` env var = service-role pooler URL — and runs idempotent upserts/updates with `WHERE x IS NULL` filters that shrink to empty on re-run.

**Three passes:**
1. **Brand derivation:** `INSERT INTO brands (name, slug, ...) SELECT DISTINCT brand, lower(replace(trim(brand), ' ', '-')), ... FROM watches_catalog WHERE brand_normalized IS NOT NULL ON CONFLICT (name_normalized) DO NOTHING`. Idempotent on the unique constraint.
2. **Optional country patch (`--patch-country=country.json`):** Read JSON, `UPDATE brands SET country_of_origin = $value WHERE name_normalized = $key AND country_of_origin IS NULL`. Idempotent on the `IS NULL` filter.
3. **Catalog FK linking:** `UPDATE watches_catalog SET brand_id = b.id FROM brands b WHERE watches_catalog.brand_normalized = b.name_normalized AND watches_catalog.brand_id IS NULL`. Idempotent on the `brand_id IS NULL` filter.

**Final assertion:** `SELECT count(*) FROM watches_catalog WHERE brand_normalized IS NOT NULL AND brand_id IS NULL` should be 0 (or near-0 — script logs anomalies but per D-03 the script SHOULD link every row whose brand_normalized is non-null, so 0 is the expected pass condition; failure dumps the anomalous rows via console.table per Phase 17 precedent).

**Example — script skeleton:**
```typescript
// scripts/backfill-catalog-brands.ts
// Phase 34 backfill script — CAT-15.
// Usage: npm run db:backfill-catalog-brands [-- --patch-country=country.json]
//
// Mirrors scripts/backfill-catalog.ts (Phase 17) shape — same env loading, same
// idempotence, same final assertion + console.table failure dump.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'

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

async function passA_deriveBrands() {
  // INSERT brands derived from DISTINCT watches_catalog.brand
  // ON CONFLICT (name_normalized) DO NOTHING — idempotent
  const result = await db.execute<{ inserted: number }>(sql`
    WITH inserted AS (
      INSERT INTO brands (name, slug)
      SELECT DISTINCT ON (lower(trim(brand)))
             brand,
             lower(regexp_replace(trim(brand), '\\s+', '-', 'g'))
        FROM watches_catalog
       WHERE brand IS NOT NULL
      ON CONFLICT (name_normalized) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM inserted
  `)
  // ... log inserted count
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
  // UPDATE watches_catalog.brand_id via brand_normalized JOIN.
  // Idempotent on brand_id IS NULL.
  await db.execute(sql`
    UPDATE watches_catalog wc
       SET brand_id = b.id
      FROM brands b
     WHERE wc.brand_normalized = b.name_normalized
       AND wc.brand_id IS NULL
  `)
}

async function main() {
  const args = parseArgs()
  await passA_deriveBrands()
  if (args.patchCountry) await passB_patchCountry(args.patchCountry)
  await passC_linkCatalog()

  // Final assertion — fail loudly if any non-null brand_normalized rows remain unlinked.
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches_catalog
     WHERE brand_normalized IS NOT NULL AND brand_id IS NULL
  `)
  const count = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
  if (count !== 0) {
    const unlinked = await db.execute(sql`
      SELECT id, brand FROM watches_catalog
       WHERE brand_normalized IS NOT NULL AND brand_id IS NULL
    `)
    console.error(`[backfill-catalog-brands] FAILED — ${count} catalog rows unlinked:`)
    console.table(unlinked)
    process.exit(1)
  }
  console.log(`[backfill-catalog-brands] OK`)
  process.exit(0)
}

main().catch((err) => { console.error('[backfill-catalog-brands] fatal:', err); process.exit(1) })
```

[CITED: scripts/backfill-catalog.ts:1-93 — full template; scripts/backfill-taste.ts:39-49 — argument parsing pattern]

### Anti-Patterns to Avoid

- **Computing `name_normalized` in app code.** The `lower(trim(name))` happens in Postgres via `GENERATED ALWAYS AS ... STORED`. Phase 17 D-02/D-03 inheritance — never compute in app, never use a trigger.
- **Using `drizzle-kit push` against prod.** Memory rule 1 — production uses `supabase db push --linked`. `drizzle-kit push` is local-dev only.
- **Inserting a migration filename between adjacent integers.** Memory rule 2 — Phase 34 must be greater than the highest existing migration. `20260504120000` is the current max; `20260510000000_phase34_*` is safe and gives buffer for any pre-Phase-34 hotfixes.
- **Creating a NOT NULL FK column without a backfill.** Phase 34 explicitly ships `brand_id` and `family_id` as nullable per D-05 step 1. The NOT NULL flip is deferred (D-05 step 3).
- **Rewriting any `watchesCatalog` DAL query.** ROADMAP success #2 forbids this. Nullable additive columns are safe — `SELECT *` and `SELECT id, brand, model, …` patterns survive without modification.
- **Dropping `watches_catalog.brand` text.** D-04 permanent denormalization. The natural-key UNIQUE on `(brand_normalized, model_normalized, reference_normalized)` depends on `brand`-derived `brand_normalized`.
- **Using a CASCADE FK on `brands` or `watch_families`.** D-02 — `RESTRICT` only. Cascading deletes through brands would silently null out catalog rows.
- **Adding GIN trigram indexes on `brands.name_normalized` "while we're here".** Deferred per CONTEXT.md. If added, must use `extensions.gin_trgm_ops` schema-qualified (memory rule 3).
- **Inline `cat << 'EOF'` heredoc commits.** Use the Write tool. `commit_docs` controls git only, not file authoring.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand-name normalization (lowercasing, trimming) | App-side `name.toLowerCase().trim()` everywhere | Postgres `GENERATED ALWAYS AS (lower(trim(name))) STORED` column | Eliminates drift; ensures every reader sees the same normalized form; UNIQUE constraint operates on the canonical value. Phase 17 D-02/D-03 precedent. |
| FK ON DELETE behavior | App-level "are there catalog rows pointing to this brand?" check before delete | `ON DELETE RESTRICT` | Postgres surfaces an error at the source (transaction-safe); no app-side race window. D-02 lock. |
| Slug uniqueness checking | App-level "is this slug taken?" loop with append-`-2` retry | `UNIQUE (slug)` constraint + `ON CONFLICT DO NOTHING` | Idempotent at the DB layer; no concurrent-insert race. |
| RLS write-blocking | Server Action middleware that asserts service-role | Database-level RLS + service-role-only writes via DATABASE_URL pooler | Defense-in-depth; even a buggy/compromised app server can't write through anon. Phase 17 D-04 / project_supabase_secdef_grants.md memory. |
| Migration idempotence | Manual "is this column already there?" check before each ALTER | `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` + `DO $$ BEGIN IF NOT EXISTS ... END $$` blocks | Phase 17 / 27 precedent — local re-runs after `drizzle-kit push` are no-ops. Lets dev/prod state diverge briefly without breaking. |
| Batch backfill loop control | Manual offset/cursor pagination | `WHERE x IS NULL LIMIT 100` shrink-to-empty loop | Naturally idempotent — re-runs after success do zero work. Phase 17 D-14 precedent. |
| CLI argument parsing | `commander` / `yargs` dep | Inline `process.argv.slice(2).map → Map` | Phase 19.1 backfill-taste.ts:39-49 precedent — no new dep for one optional flag. |
| Country mapping in TypeScript constants | Hardcoded TS array | `country.json` data file | Operator-editable without a code change; survives a fresh checkout; commits cleanly. |

**Key insight:** Every "should I build this?" question Phase 34 raises has a Phase 17 / 19.1 / 27 precedent answer in the codebase. Don't invent anything.

---

## Common Pitfalls

### Pitfall 1: Drizzle FK forward-reference compile error

**What goes wrong:** `src/db/schema.ts` defines `watchesCatalog` first (line 281), then needs to reference `brands` and `watchFamilies` from `watchesCatalog.brandId` / `.familyId` — but if those exports are placed AFTER the `watchesCatalog` block, the `references(() => brands.id)` callback resolves correctly (lazy evaluation) but `() => brands` with non-callback form fails at module-load with `ReferenceError: Cannot access 'brands' before initialization`.

**Why it happens:** Drizzle 0.45.2 supports both `.references(brands.id, ...)` (eager — requires forward order) and `.references(() => brands.id, ...)` (callback — lazy). The codebase already uses callback form for `watches.catalogId → watchesCatalog.id` (schema.ts:101).

**How to avoid:** Use callback form for the new FKs in `watchesCatalog`, OR place `brands` and `watchFamilies` exports BEFORE the `watchesCatalog` block. Callback form is consistent with existing code.

**Warning signs:** TypeScript build fails with `Cannot access 'X' before initialization` on `src/db/schema.ts`.

### Pitfall 2: GENERATED column emission by drizzle-kit may be malformed

**What goes wrong:** `drizzle-kit generate` for `nameNormalized: text(...).generatedAlwaysAs(sql`lower(trim(name))`)` may emit DDL that Postgres rejects (Phase 17 plan 01 task 2 explicitly documents this fallback).

**Why it happens:** Drizzle's GENERATED-column DDL emission has historical issues; the generated SQL may quote the expression incorrectly or omit the `STORED` keyword.

**How to avoid:** After `drizzle-kit generate`, INSPECT the emitted file (`drizzle/0007_phase34_brands_families.sql`) and compare against the column shape in `drizzle/0004_phase17_catalog.sql` line 6–8 (which is known-good). If malformed, the Supabase migration's `DO $$ ... END $$` re-create logic (mirroring `20260427000000_phase17_catalog_schema.sql:26-68`) is authoritative — Drizzle's emission is best-effort, Supabase's is authoritative.

**Warning signs:** `npx drizzle-kit migrate` (LOCAL — never prod) fails with `syntax error near GENERATED` or similar.

### Pitfall 3: Service-role script accidentally hits local DB during prod backfill

**What goes wrong:** Operator forgets to override `DATABASE_URL` in the shell, runs `npm run db:backfill-catalog-brands`, and the script reads `.env.local` — backfilling the LOCAL Docker DB instead of prod. Operator believes prod is backfilled; prod still has unlinked rows.

**Why it happens:** Footgun T-17-BACKFILL-PROD-DB documented in `docs/deploy-db-setup.md:279`. The `tsx --env-file=.env.local` flag means `DATABASE_URL` from `.env.local` wins unless explicitly overridden.

**How to avoid:** Runbook MUST instruct operator to use the inline form: `DATABASE_URL=<prod pooler URL> npm run db:backfill-catalog-brands` — not `npm run db:backfill-catalog-brands` after some manual env shuffle. Mirrors Phase 17 §17.2 docs/deploy-db-setup.md:268-270.

**Warning signs:** Post-script `SELECT COUNT(*) FROM watches_catalog WHERE brand_id IS NULL` against prod returns the same number as before.

### Pitfall 4: Test runner accidentally connects to prod

**What goes wrong:** `tests/integration/phase34-rls.test.ts` skips `describe` based on env presence; if `DATABASE_URL` happens to point at prod when tests run (e.g., a recent shell with prod URL exported), the test will SELECT against prod tables. Most queries are read-only so harm is bounded, but assertions about row counts can be misleading.

**Why it happens:** `tests/integration/phase17-secdef.test.ts` uses `process.env.DATABASE_URL` directly without checking which env it points at.

**How to avoid:** Document in test file header: "ASSUMES DATABASE_URL points to LOCAL DB. NEVER export prod pooler URL before running `npm run test`." If higher safety is needed, add a startup check that asserts the URL contains `localhost` or `127.0.0.1` and skips otherwise — the existing `phase17-secdef.test.ts` pattern doesn't do this, but Phase 34 could improve on the precedent.

**Warning signs:** Test pass/fail counts don't match local DB state; integration test PASSES on a prod-pointed env that should fail.

### Pitfall 5: `watches_catalog.brand_normalized` value drift breaks JOIN

**What goes wrong:** The backfill script joins on `watches_catalog.brand_normalized = brands.name_normalized`. If a Phase 34-era catalog row has `brand = "  Rolex  "` (extra whitespace), `brand_normalized` will be `"rolex"` (trimmed). When the script INSERTs that brand into `brands`, `name = "  Rolex  "`, then `brands.name_normalized` is also `"rolex"` (trimmed). Match works. But if a future catalog row has `brand = "Rolex SA"` and the brand auto-derivation produces `name = "Rolex SA"`, the JOIN would create a NEW brand row rather than linking to the existing `"Rolex"` row.

**Why it happens:** GENERATED `name_normalized` is the join key, not `name`. The script's `SELECT DISTINCT ON (lower(trim(brand))) brand` clause picks one canonical text per normalized value — so if "Rolex" and "rolex" both exist in catalog, one wins. This is intentional and matches Phase 17 D-02 D-03 precedent.

**How to avoid:** Use `SELECT DISTINCT ON (lower(trim(brand))) brand FROM watches_catalog WHERE brand IS NOT NULL ORDER BY lower(trim(brand)), id ASC` to deterministically pick the lowest-id catalog row's `brand` text as the canonical brand name. Phase 34 CONTEXT specifies this in the Specifics section. Document the choice in script comments.

**Warning signs:** `SELECT count(*) FROM brands GROUP BY name_normalized HAVING count(*) > 1` returns rows post-backfill (should never happen due to UNIQUE constraint, but the constraint failing is the symptom).

### Pitfall 6: Slug collision when two brand names normalize to the same slug

**What goes wrong:** Two distinct brand names produce the same slug. E.g., "Brand-X" and "Brand X" both → "brand-x". `brands.slug UNIQUE NOT NULL` causes the second `INSERT` to fail with `duplicate key value violates unique constraint`. The naive `ON CONFLICT (name_normalized) DO NOTHING` won't help because the conflict is on `slug`, not `name_normalized`.

**Why it happens:** Slug derivation is `lower(replace(trim(name), ' ', '-'))`; two distinct names with hyphens-vs-spaces collapse.

**How to avoid:** (a) At single-user / ~10–30 brands scale, this is improbable but possible. (b) The script's INSERT should `ON CONFLICT (name_normalized) DO NOTHING` AND wrap with a SAVEPOINT or per-row try/catch that detects `slug` conflicts — script logs the conflict and exits 1 with a clear "edit `country.json` or rename one of these brands" message. (c) Alternative: relax `slug UNIQUE` to nullable in Phase 34 and defer slug-uniqueness enforcement to Phase 39 when /brand/{slug} routes ship. **Recommendation:** keep slug UNIQUE NOT NULL per D-01a; surface collisions loudly in the script; operator resolves by renaming.

**Warning signs:** Backfill script fails on pass A with `duplicate key value violates unique constraint "brands_slug_unique"`.

### Pitfall 7: `watches_catalog.brand` is NOT NULL but Phase 17 didn't enforce it on the GENERATED `brand_normalized` chain

**What goes wrong:** `watches_catalog.brand` is NOT NULL (verified — `drizzle/0004_phase17_catalog.sql:3`). `brand_normalized` is `GENERATED ALWAYS AS (lower(trim(brand)))`. So `brand_normalized` should never be NULL. But the backfill script's `WHERE brand_normalized IS NOT NULL` filter is defensive — it accommodates a hypothetical future where `brand` is nullable (which D-04 explicitly forbids, but defense-in-depth is cheap).

**Why this matters for the planner:** The script's `WHERE brand IS NOT NULL` filter (or `WHERE brand_normalized IS NOT NULL`, equivalently) is correct as written. The final assertion — "every catalog row with `brand_normalized IS NOT NULL` should have `brand_id` populated" — should pass with 0 unlinked. If it doesn't, the failure mode is one of: (a) Pitfall 6 slug collision blocked an `INSERT`, or (b) a UNIQUE constraint mismatch between catalog brand and brands.name_normalized. Both are diagnosable from the failure dump.

### Pitfall 8: ROADMAP success #2 ("DAL queries return identical results") is hard to assert empirically without a baseline

**What goes wrong:** "All 31 DAL `watchesCatalog` references return correct results without modification" sounds testable but has no obvious empirical pre/post comparison harness. A test could be "run all DAL queries against pre-migration DB, snapshot results; run them again post-migration, diff" — but that requires a DB clone. At single-user MVP scale, the queries are all "select these specific columns or `select *`" — and adding nullable columns to the table cannot change the value of any existing column.

**How to avoid:** The cheapest defense is **static reasoning**: enumerate all 31 reference sites, classify each as "selects specific columns" vs "selects *" vs "uses `$inferSelect` type". Confirm none of these patterns is broken by adding two nullable FK columns. A second-cheap defense is a smoke runbook step: post-migration, post-backfill, hit a few key surfaces (`/explore`, `/catalog/{id}`, `/search?q=…`) and visually confirm identical UI — operator-time, not automation. **Recommendation:** include the static enumeration table in the plan's verification section; skip the empirical pre/post harness as overkill for the failure mode it protects against.

**Static analysis of the 31 references** (verified 2026-05-09 via `grep -rn "watchesCatalog" src/data/`):
- `src/data/catalog.ts:5` — import (no query impact)
- `src/data/catalog.ts:49` — `typeof watchesCatalog.$inferSelect` (auto-includes new cols; safe)
- `src/data/catalog.ts:246` — `db.select().from(watchesCatalog).where(eq(watchesCatalog.id, id))` (selects all columns; new nullable cols included; safe)
- `src/data/catalog.ts:304-330` — explicit column selection (`id`, `brand`, `model`, `reference`, `imageUrl`, `ownersCount`, `wishlistCount`); does NOT select brand_id/family_id; new cols invisible to query; safe
- `src/data/discovery.ts:11, 141-156` — explicit column selection mirroring catalog.ts:304; safe

Plus raw `sql\`SELECT … FROM watches_catalog\`` references in:
- `src/data/catalog.ts` (CTE upserts, taste updates, photo applies — all explicit column lists or COALESCE updates; do not break)
- `src/data/discovery.ts` (DISTINCT ON CTE — selects `wc.id, wc.brand, wc.model, wc.reference, wc.image_url`, ordering by `wc.brand_normalized`; safe)
- `src/data/recommendations.ts`, `src/data/suggestions.ts`, `src/data/search.ts` — must verify same pattern at plan time but expected to be the same shape per Phase 17 / 19.1 conventions

**Conclusion:** All 31 references are safe by inspection. Adding two nullable FK columns to `watches_catalog` cannot change any existing query output.

---

## Runtime State Inventory

> Phase 34 is partly a migration (rename-adjacent — adds new columns, populates one of them on prod). Categories below are explicitly answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) `watches_catalog` rows in PROD with `brand` populated; backfill must derive `brands` rows from these and link `brand_id` per row. (b) Local Docker DB has the same schema — local `supabase db reset` workflow must include the new migration (memory `project_local_db_reset.md`). | (a) Run `npm run db:backfill-catalog-brands` against PROD pooler URL after migration push. (b) Update `docs/deploy-db-setup.md:386-404` "Local DB reset workflow" to include the new migration filename. |
| Live service config | None. Phase 34 ships zero changes to: Vercel env vars, Supabase Auth config, Supabase Storage buckets, n8n / pg_cron jobs, Resend SMTP. The existing `pg_cron` `refresh_watches_catalog_counts_daily` job (Phase 17 §17.3) is unaffected — it does not touch the new tables. | None — verified by audit of `src/lib`, `src/app`, `supabase/migrations`. |
| OS-registered state | None. No Windows Task Scheduler / launchd / systemd / pm2 state references brand or family entities. | None. |
| Secrets / env vars | `DATABASE_URL` (prod pooler URL) is consumed by the new backfill script — same shape as Phase 17 backfill. No new secret keys. `ANTHROPIC_API_KEY` is NOT consumed (Phase 34 does no LLM work). | None — operator already has DATABASE_URL set up per Phase 17 / 19.1 deploy. |
| Build artifacts / installed packages | None. No new npm dependency. No installed binary changes. `node_modules/drizzle-orm@0.45.2` already supports `generatedAlwaysAs` (verified — used since Phase 17). `drizzle/meta/_journal.json` will gain a new entry after `drizzle-kit generate` — committed as part of the new Drizzle migration file. | Commit `drizzle/0007_phase34_brands_families.sql` AND any updated `drizzle/meta/*` files together. |

**Nothing found in 3 of 5 categories** — verified by file audit + grep pass over `src/`, `supabase/`, `docs/`, `scripts/`. Only the data-migration (Stored data) and Drizzle journal (Build artifacts) categories require action.

---

## Code Examples

Verified patterns from in-repo sources:

### Drizzle FK with callback (forward reference)
```typescript
// Source: src/db/schema.ts:101 (existing pattern — Phase 17 watches.catalogId)
catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
// Phase 34 mirrors this exactly with onDelete: 'restrict'
```
[CITED: src/db/schema.ts:101]

### Drizzle GENERATED column
```typescript
// Source: src/db/schema.ts:292-294 (existing pattern — Phase 17)
brandNormalized: text('brand_normalized').generatedAlwaysAs(
  sql`lower(trim(brand))`,
),
```
[CITED: src/db/schema.ts:292]

### Drizzle composite UNIQUE
```typescript
// Source: src/db/schema.ts:248 (existing pattern — Phase 11)
unique('wear_events_unique_day').on(table.userId, table.watchId, table.wornDate),
```
[CITED: src/db/schema.ts:248]

### Supabase RLS public-read + service-role-write
```sql
-- Source: supabase/migrations/20260427000000_phase17_catalog_schema.sql:172-176
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watches_catalog_select_all ON watches_catalog;
CREATE POLICY watches_catalog_select_all
  ON watches_catalog FOR SELECT USING (true);
-- (no INSERT/UPDATE/DELETE policy → only service_role can write, since RLS is enabled
-- and anon/authenticated have no matching policy)
```
[CITED: supabase/migrations/20260427000000_phase17_catalog_schema.sql:166-176]

### Supabase migration `DO $$ ... END $$` final assertion
```sql
-- Source: supabase/migrations/20260427000000_phase17_catalog_schema.sql:190-220
DO $$
DECLARE
  has_select_policy boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND policyname='watches_catalog_select_all')
    INTO has_select_policy;

  IF NOT has_select_policy THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed — watches_catalog SELECT policy missing (Pitfall 4)';
  END IF;
END $$;
```
[CITED: supabase/migrations/20260427000000_phase17_catalog_schema.sql:190-220]

### Idempotent backfill loop (`WHERE x IS NULL` shrink-to-empty)
```typescript
// Source: scripts/backfill-catalog.ts:26-67
while (true) {
  pass++
  const rows = await db.select(...).from(watches).where(sql`catalog_id IS NULL`).limit(BATCH_SIZE)
  if (rows.length === 0) break
  for (const row of rows) {
    await db.execute(sql`...UPDATE watches SET catalog_id = ... WHERE id = ${row.id}`)
  }
}
// Final assertion + console.table failure dump
const remaining = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM watches WHERE catalog_id IS NULL`)
```
[CITED: scripts/backfill-catalog.ts:26-87]

### Inline argument parsing (Phase 19.1 pattern)
```typescript
// Source: scripts/backfill-taste.ts:39-49
function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }))
  return { dryRun: args.get('dry-run') === 'true', batchSize: parseInt(args.get('batch-size') ?? '20', 10) }
}
// Phase 34: { patchCountry: args.get('patch-country') ?? null }
```
[CITED: scripts/backfill-taste.ts:39-49]

### Vitest integration test for RLS
```typescript
// Source: tests/integration/phase17-secdef.test.ts:6-26
const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? describe : describe.skip

maybe('Phase 34 RLS — public-read on brands + watch_families (CAT-15)', () => {
  it('has_table_privilege: anon SELECT on brands', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.brands', 'SELECT') AS can
    `)
    expect((result as unknown as Array<{ can: boolean }>)[0].can).toBe(true)
  })

  it('anon supabase-js client SELECT * FROM brands works', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await anon.from('brands').select('*').limit(1)
    expect(error).toBeNull()  // RLS allows; query may return empty rows but not error
  })

  it('anon supabase-js client INSERT INTO brands fails with RLS', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await anon.from('brands').insert({ name: 'Test', slug: 'test' })
    expect(error).toBeTruthy()  // RLS blocks; PGRST116 or 42501
  })
})
```
[CITED: tests/integration/phase17-secdef.test.ts:6-26 — direct adaptation]

### npm-run script entry
```json
// Source: package.json:12-16 (existing pattern)
"db:backfill-catalog":           "tsx --env-file=.env.local scripts/backfill-catalog.ts",
"db:refresh-counts":             "tsx --env-file=.env.local scripts/refresh-counts.ts",
"db:backfill-taste":             "tsx --env-file=.env.local scripts/backfill-taste.ts",
"db:reenrich-taste":             "tsx --env-file=.env.local scripts/reenrich-taste.ts",
"db:preflight-notification-cleanup": "tsx --env-file=.env.local scripts/preflight-notification-types.ts",
// Phase 34 ADDS:
"db:backfill-catalog-brands":    "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts",
```
[CITED: package.json:12-16]

### Migration filename answer (Question #1 from research questions)

The next safe 14-digit filename greater than `20260504120000_phase27_sort_order.sql` (current max, verified 2026-05-09 via `ls supabase/migrations/`) is **`20260510000000_phase34_brands_families.sql`**. Per memory rule 1 (14-digit, no suffix letters) and memory rule 2 (no insertion between adjacent integers), choosing `20260510000000` (May 10, 2026 00:00:00 UTC) gives a 6-day buffer above the current max while remaining greater than today's date (2026-05-09) — which matters if a hotfix migration ships between research and implementation. Drizzle equivalent: `drizzle/0007_phase34_brands_families.sql` (next sequential after `0006_phase27_sort_order.sql`).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single Drizzle migration carrying everything | Drizzle (column shapes) + Supabase migration (RLS, GENERATED, CHECK, named constraints, assertions) split | Phase 17 (2026-04-27) | Phase 34 inherits — both files ship together |
| `drizzle-kit push` against prod | `supabase db push --linked` against prod; `drizzle-kit push` is local-only | Memory `project_drizzle_supabase_db_mismatch.md` (multiple incidents) | Phase 34 deploy uses `supabase db push --linked` |
| Compute normalization in app code | Postgres `GENERATED ALWAYS AS ... STORED` columns | Phase 17 D-02/D-03 | Phase 34 mirrors for `brands.name_normalized` and `watch_families.name_normalized` |
| `commander` / `yargs` for CLI scripts | Inline `process.argv.slice(2).map → Map` | Phase 19.1 D-15 (`backfill-taste.ts`) | Phase 34 backfill uses inline parsing |
| Sequential phase migrations with adjacent integer filenames | 14-digit timestamps; no insertion between adjacent integers | Memory rule 2 | Phase 34 uses `20260510000000` (May 10 2026 buffered above current) |

**Deprecated/outdated:**
- Phase 17's `WITH SCHEMA extensions` opclass requirement (memory rule 3) is irrelevant for Phase 34 because no GIN trigram indexes are added.
- The `notification_type` enum cleanup pattern (Phase 24) is irrelevant — Phase 34 adds tables, not modifies enums.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (`devDependencies` in package.json:63) |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `npm run test -- tests/integration/phase34-rls.test.ts` (single-file) |
| Full suite command | `npm run test` (Vitest run-all) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-15 SC#1 | `brands` table exists with public-read RLS + service-role-write | integration (DB-gated) | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#1 | `watch_families` table exists with public-read RLS + service-role-write | integration (DB-gated) | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#2 | `watches_catalog.brand_id` (nullable FK) exists | integration (schema introspection) | `npm run test -- tests/integration/phase34-rls.test.ts` (assert `information_schema.columns` row) | Wave 0 — NEW FILE |
| CAT-15 SC#2 | `watches_catalog.family_id` (nullable FK) exists | integration (schema introspection) | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#2 | All existing DAL queries return correct results without modification | static analysis (no automation) | manual: enumerate `grep -rn "watchesCatalog" src/data/` and confirm all 31 references use column-list or `$inferSelect` patterns that survive nullable additive columns | already verified in research (see Pitfall 8) |
| CAT-15 SC#3 | `has_table_privilege('anon', 'public.brands', 'SELECT')` returns true | integration | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#3 | `has_table_privilege('anon', 'public.watch_families', 'SELECT')` returns true | integration | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#3 | Anon supabase-js INSERT into `brands` fails with RLS error | integration (anon client) | `npm run test -- tests/integration/phase34-rls.test.ts` | Wave 0 — NEW FILE |
| CAT-15 SC#4 | `scripts/backfill-catalog-brands.ts` exists with auto-derive + country-patch + link logic | manual + smoke run on local DB | `npm run db:backfill-catalog-brands` (assert exit 0; assert idempotent — second run is no-op) | Wave 0 — NEW FILE |
| CAT-15 SC#4 | Backfill script is idempotent (re-run = no-op) | integration | Run script twice locally; second run logs "0 inserted, 0 patched, 0 linked" | Wave 0 — NEW FILE |
| CAT-15 SC#5 | Three-step migration discipline documented in CONTEXT.md | document inspection | `grep -q 'D-05' .planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` | already passes (verified — CONTEXT.md:104-107) |
| Cross-cutting | `pg_depend` shows no broken dependents from new FK columns | manual psql query | `SELECT … FROM pg_depend WHERE refobjid = 'public.watches_catalog'::regclass` — assert no orphaned references | manual — runbook step |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/integration/phase34-rls.test.ts` (single test file)
- **Per wave merge:** `npm run test` (full Vitest suite — should remain green; no existing tests should break since DAL queries are unchanged)
- **Phase gate:** Full suite green + manual prod smoke (RLS truth values via psql + backfill exit 0 + final-count SQL assertions per D-06 runbook)

### Wave 0 Gaps
- [ ] `tests/integration/phase34-rls.test.ts` — covers CAT-15 SC#1, SC#2, SC#3 (RLS truth values + schema introspection + anon write-blocked)
- [ ] No new conftest / fixtures needed — leverages existing `db` import pattern from `phase17-secdef.test.ts` and `phase27-backfill.test.ts`
- [ ] Framework already installed: Vitest 2.1.9 — no install command needed
- [ ] (Optional) `tests/integration/phase34-backfill-idempotence.test.ts` — runs the backfill script twice against local DB; asserts second run is a no-op (linked count unchanged). Could also be a runbook smoke step instead of an automated test if the planner prefers.

*If the planner ships only the RLS test, Wave 0 has 1 net new test file. If both, 2.*

### Concrete Validation Points (for VALIDATION.md generation)

1. **Migration applies cleanly** — `supabase db push --linked` against local Supabase Docker (or the documented alternate `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql`) returns exit 0 with no `RAISE EXCEPTION` from the embedded `DO $$` assertion block.

2. **Drizzle migration applies cleanly** — `npx drizzle-kit migrate` (LOCAL only) applies `0007_phase34_brands_families.sql` and `drizzle.__drizzle_migrations` row count incremented by 1.

3. **RLS truth values** — `tests/integration/phase34-rls.test.ts` asserts: `has_table_privilege('anon', 'public.brands', 'SELECT') = true`, same for `watch_families`. Anon supabase-js INSERT fails with RLS. Service-role INSERT succeeds.

4. **Schema introspection** — `information_schema.columns` rows confirm: `brands.name_normalized` is `is_generated = 'ALWAYS'`; `watches_catalog.brand_id` exists with `data_type = 'uuid'` and `is_nullable = 'YES'`; `watches_catalog.family_id` same shape.

5. **FK integrity** — `INSERT INTO watches_catalog (brand, model, brand_id) VALUES ('X', 'Y', '<non-existent-uuid>')` MUST fail with FK violation. `DELETE FROM brands WHERE id = '<id-with-catalog-rows>'` MUST fail with `RESTRICT` violation.

6. **Backfill idempotence** — Run `npm run db:backfill-catalog-brands` against local DB. Snapshot `brands` row count. Re-run. Assert row count unchanged AND `watches_catalog WHERE brand_id IS NULL AND brand_normalized IS NOT NULL` count unchanged (both should be 0 post-first-run).

7. **DAL parity** — Static analysis enumerated in Pitfall 8: all 31 `watchesCatalog` references use column-list or `$inferSelect` patterns that survive nullable additive columns. No empirical pre/post test required at single-user MVP scale.

8. **`pg_depend` lookup** — Memory rule 4 mandates `pg_depend` check before structural changes. Phase 34 is purely additive (new tables + new nullable columns + new FK constraints), so the check is trivially satisfied: no enums modified, no existing columns altered. The runbook step is: post-migration, run `SELECT classid::regclass, objid, deptype FROM pg_depend WHERE refobjid = 'public.brands'::regclass;` — expect 2 rows (the new FK from `watches_catalog.brand_id` and the new FK from `watch_families.brand_id`); same for `watch_families`. No orphans.

---

## Open Questions

1. **`country.json` initial content scope** — Should the planner ship a starter `country.json` covering ~10–30 obvious brands (Rolex, Omega, Casio, Seiko, Patek Philippe, Cartier, etc.) or leave it empty for the operator to populate?
   - What we know: D-03 specifies operator-driven population; D-06 makes it a runbook step.
   - What's unclear: Whether shipping a starter map is "doing the operator's work" or "removing friction".
   - Recommendation: ship a starter map as `scripts/country.json` covering brands likely to be in the existing collection (operator can verify against `SELECT DISTINCT brand_normalized FROM watches_catalog ORDER BY 1` after the auto-derivation pass). Reduces the "manual review" surface to "verify and add tail".

2. **Optional Vitest integration test ship/skip** — Should `tests/integration/phase34-rls.test.ts` ship in Wave 0 (recommended) or be skipped in favor of operator runbook smoke tests only?
   - What we know: Phase 17 shipped `tests/integration/phase17-secdef.test.ts`; Phase 27 shipped `tests/integration/phase27-backfill.test.ts`. Both add CI insurance.
   - What's unclear: Whether single-user MVP CI value justifies the test file (CI doesn't actually have a DB-gated env, so the test runs locally only).
   - Recommendation: ship the test. Cost is ~30 lines of code. Value is local-dev confidence + machine-readable doc of intent.

3. **DAL parity smoke test ship/skip** — Should the planner add a static-analysis test that asserts "selectFromCatalog query shape unchanged"?
   - What we know: ROADMAP success #2 + Pitfall 8 analysis say static analysis is sufficient.
   - What's unclear: Whether to formalize this with a one-off `scripts/check-dal-shape.ts` linter or trust the static reasoning.
   - Recommendation: skip. Static reasoning + grep audit is enough. The two new nullable columns cannot break anything by inspection.

4. **Local DB reset workflow update timing** — Should `docs/deploy-db-setup.md:386-404` (existing local-reset workflow) be updated in Phase 34 to include the new migration filename?
   - What we know: D-06 mandates appending a Phase 34 deploy section. The local-reset workflow is a separate section and isn't called out.
   - What's unclear: Whether Phase 34 owns updating the reset workflow or whether it accumulates organically across phases.
   - Recommendation: include a one-line addition to the local-reset section ("4. Apply Phase 34 migration: `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260510000000_phase34_brands_families.sql`") as part of the D-06 runbook update task.

5. **Where to commit `country.json`** — `scripts/country.json` (next to the script that consumes it) or `data/country.json` (separate data dir)?
   - Recommendation: `scripts/country.json`. Next-to-script colocation matches the project's flat `scripts/` layout. No `data/` directory exists today.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, tsx | ✓ (assumed via existing dev workflow) | not pinned | — |
| npm | package.json | ✓ (existing dev workflow) | bundled | — |
| Supabase CLI | `supabase db push --linked` | ✓ per `docs/deploy-db-setup.md:7` | 2.x | — |
| Docker (local Supabase) | local migration apply | ✓ per `docs/deploy-db-setup.md:398-403` | n/a | — |
| psql | runbook smoke tests + pg_depend lookup | ✓ assumed (operator already uses for Phase 17 / 27 deploy) | n/a | Supabase Studio web UI for one-off SELECTs (slower but works) |
| Postgres 15+ | `GENERATED ALWAYS AS ... STORED`, `UNIQUE ... NULLS NOT DISTINCT`, `DO $$` blocks | ✓ Supabase prod runs Postgres 15.x | 15.x | — |
| `drizzle-orm` 0.45.2 | TS column definitions | ✓ installed | `^0.45.2` | — |
| `drizzle-kit` 0.31.10 | Generate migration SQL | ✓ installed | `^0.31.10` | hand-author drizzle migration if `drizzle-kit generate` emits malformed DDL |
| `tsx` | run TS scripts via `npm run db:*` | ✓ used by 5 existing scripts | bundled w/ project? (verify package.json — likely transitive) | direct `node --import tsx scripts/...` |
| `vitest` | optional integration test | ✓ installed | `^2.1.9` | skip the integration test; rely on operator runbook |
| `@supabase/supabase-js` | optional integration test (anon client) | ✓ installed | `^2.103.0` | skip the integration test |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — every dependency is already in the project. `drizzle-kit` could theoretically emit malformed GENERATED DDL, in which case the fallback is to hand-author the Drizzle SQL file (Phase 17 plan 01 task 2 fallback note explicitly documents this scenario).

---

## Security Domain

> Phase 34 adds public-read tables. Security model is locked by Phase 17 D-04/D-06 inheritance (RLS public-read + service-role-write).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 34 ships zero auth-touched code paths |
| V3 Session Management | no | Same |
| V4 Access Control | yes | RLS public-read + service-role-write; no anon/authenticated write surface |
| V5 Input Validation | yes (script side) | `scripts/backfill-catalog-brands.ts` reads `country.json` — must `JSON.parse` defensively + length-cap country names; `--patch-country` arg path must avoid path traversal (read only the operator-provided path; don't shell-out) |
| V6 Cryptography | no | No crypto in Phase 34 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via brand name in backfill | Tampering | Drizzle `sql\`...${value}...\`` parameterized binds — never string-concatenate brand names into SQL. Phase 17 D-14 / Phase 18 T-18-01-02 precedent. |
| Path traversal via `--patch-country=../../etc/passwd` | Information Disclosure | Operator runs the script; the path is operator-controlled, not user-controlled. Defense: read the file with explicit `readFileSync(path, 'utf-8')` and `JSON.parse` — content non-JSON fails fast. No symlink-following / arbitrary-execution surface. |
| RLS misconfiguration allowing anon write | Tampering | Embedded `DO $$ ... END $$` post-check in migration asserts `pg_policies` row presence; runbook smoke step verifies via `has_table_privilege`; integration test asserts anon INSERT fails. Triple-checked. |
| Forgotten `ENABLE ROW LEVEL SECURITY` (Pitfall 4 from Phase 17) | Tampering | Migration explicitly calls `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for both new tables BEFORE any data hits them. Phase 17 §6 / §7 precedent. |
| Service-role token leak via committed `country.json` | Information Disclosure | `country.json` contains brand→country mappings — no secrets. `.env.local` and pooler URLs remain gitignored. |
| Backfill running against wrong DB (Pitfall 3) | Tampering | Operator runbook explicitly instructs `DATABASE_URL=<prod-pooler> npm run db:backfill-catalog-brands` — never `npm run db:backfill-catalog-brands` after a manual env shuffle. |

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

CLAUDE.md and AGENTS.md directives applicable to Phase 34:

- **Tech stack lock:** Next.js 16 App Router, no rewrites. Phase 34 ships zero `src/app/` changes — directive trivially satisfied.
- **Data model: extend, don't break.** Phase 34 adds nullable FK columns + two new tables. ROADMAP success #2 enforces zero existing-DAL changes. Aligned.
- **Personal-first; data isolation correctness preserved.** Phase 34 adds `brands` and `watch_families` as PUBLIC-read (no `user_id` column). Brand/family taxonomy is shared across all users — matches the existing `watches_catalog` PUBLIC-read pattern (Phase 17 D-04). Aligned.
- **Performance: <500 watches per user.** Phase 34's `~10–30 brands` and `0 families` is well under this scale. Aligned.
- **`AGENTS.md`: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/` before assuming patterns.** Phase 34 ships zero Next.js code, so this directive doesn't bite. Aligned by non-applicability.
- **GSD workflow enforcement:** Use GSD entry points (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`). Phase 34 is being planned via the standard flow — aligned.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres 15+ is running in prod, supporting `UNIQUE NULLS NOT DISTINCT` and `GENERATED ALWAYS AS ... STORED` | Standard Stack, Pattern 2 | LOW — Supabase prod is verified Postgres 15+ via Phase 17 (used `NULLS NOT DISTINCT`). Risk only if Supabase downgrades, which is implausible. |
| A2 | `drizzle-kit generate` may or may not emit malformed GENERATED DDL — Phase 17 documented a fallback case but didn't specify whether 0.31.10 still has the issue | Pitfall 2 | MEDIUM — local apply may need hand-touch if emission is broken. Mitigation: Supabase migration is authoritative; manual fixup is small. Verify at plan implementation time. |
| A3 | `tsx` is available via `npm run db:*` scripts (transitive dep or installed elsewhere) | Environment Availability | LOW — 5 existing `db:*` scripts work in the current dev setup, so tsx is reachable. Verify by running `npm run db:refresh-counts -- --help` or similar. |
| A4 | Operator already has `DATABASE_URL` for the prod session-mode pooler URL | Environment Availability, Pitfall 3 | LOW — same operator ran Phase 17 / 19.1 / 27 deploys which require the same URL. |
| A5 | The 31 `watchesCatalog` references in `src/data/` use only column-list or `$inferSelect` patterns (no `INSERT INTO watches_catalog (...)` value-list inserts that omit the new columns and would fail if the new columns were added with `NOT NULL`) | DAL Parity / Pitfall 8 | LOW — verified by grep audit (16 in catalog.ts, 15 in discovery.ts). All column-list patterns. New columns are nullable so VALUES (...) inserts that omit them get NULL — safe. |
| A6 | The user collection at single-user MVP scale produces ~10–30 distinct `brand_normalized` values, not hundreds | Standard Stack, Pitfall 6 | LOW — CONTEXT.md explicitly states this scale assumption (D-03 rationale). Pitfall 6 (slug collision) is improbable but mitigated. |
| A7 | The optional Vitest integration test does NOT need a Supabase Storage / pg_cron stand-up; it only needs `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_*` | Validation Architecture | LOW — `tests/integration/phase17-secdef.test.ts` works with these three env vars only. |
| A8 | "Phase 35 lineage edges work will populate `watch_families` rows" — Phase 35 isn't planned yet, so the assumption that Phase 35 absorbs family seeding is forward-looking | User Constraints (D-03 / Deferred Ideas) | LOW — CONTEXT.md and ROADMAP both lock this. If Phase 35 scope shifts, the impact on Phase 34 is zero (Phase 34 just ships an empty `watch_families` table). |

**No `[ASSUMED]` claims contradict locked decisions.** All claims are either verified against in-repo evidence or documented as low-risk forward assumptions about future phases.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` (entire file) — RLS template, `DO $$` assertion pattern, GENERATED column re-create idempotence
- `drizzle/0004_phase17_catalog.sql` (lines 1–49) — Drizzle migration shape; ALTER TABLE FK column add precedent at line 45
- `src/db/schema.ts` (lines 281–340) — `watchesCatalog` table definition; FK callback pattern at line 101
- `scripts/backfill-catalog.ts` (entire file) — service-role idempotent backfill template
- `scripts/backfill-taste.ts` (lines 39–49) — inline argument-parsing pattern
- `tests/integration/phase17-secdef.test.ts` (entire file) — Vitest RLS integration test template
- `tests/integration/phase27-backfill.test.ts` (entire file) — Vitest backfill integration test template
- `docs/deploy-db-setup.md` (Phase 17 §17.1–17.6, lines 234–323) — operator runbook template
- `package.json` (lines 12–16, 25–46) — existing `db:*` script entries; dependency versions
- `.planning/phases/34-layer-a-brand-family-entities/34-CONTEXT.md` (entire file) — locked decisions D-01..D-06
- `.planning/REQUIREMENTS.md` (CAT-15 line 25) — full requirement text
- `.planning/ROADMAP.md` (Phase 34 §lines 182–192) — success criteria
- Memory `project_drizzle_supabase_db_mismatch.md` — DB migration rules 1–4
- Memory `project_supabase_secdef_grants.md` — RLS-based access control discipline
- Memory `project_local_db_reset.md` — local DB reset workflow

### Secondary (MEDIUM confidence)
- Phase 33b verdicts in STATE.md lines 73–77 — Q2 DEFERRED locks Phase 34 schema-only posture
- `node_modules/drizzle-orm/package.json` — confirmed Drizzle 0.45.2 supports `generatedAlwaysAs`

### Tertiary (LOW confidence)
None — all claims in this research are verified against in-repo files. Zero web searches needed; the codebase is the authoritative source for every pattern Phase 34 uses.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed and used in identical patterns elsewhere in the codebase.
- Architecture: HIGH — Phase 17 is a near-perfect template; Phase 34 is structurally a copy-paste-and-adapt exercise with no novel architectural decisions.
- Pitfalls: HIGH — all 8 pitfalls are derived from in-repo evidence (Phase 17 plan notes, deploy runbook footguns, schema introspection of GENERATED columns); no speculative pitfalls.
- Validation Architecture: HIGH — Vitest is pre-installed; `phase17-secdef.test.ts` is a near-line-for-line template; manual runbook checks mirror Phase 17 §17.1–17.4 verbatim.
- Security: HIGH — RLS pattern is verified working in prod since Phase 17; no new attack surface.
- Open questions: 5 questions are scope-/style-level (e.g., "ship country.json starter content?"), not architectural blockers.

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days — stable; phase is schema-only with no fast-moving external deps)
