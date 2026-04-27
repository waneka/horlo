# Phase 17: Catalog Foundation — Research

**Researched:** 2026-04-27
**Domain:** Postgres schema design (canonical product catalog), Drizzle 0.45.2 + Supabase migration ordering, RLS asymmetry (public-read / service-role-write), pg_cron + SECURITY DEFINER, idempotent backfill, COALESCE-based enrichment upsert
**Confidence:** HIGH

## Summary

Phase 17 adds a canonical `watches_catalog` table with denormalized counts and a daily snapshot table, populated via two distinct upsert helpers (typed-input writes natural-key only; URL-extract enriches via per-column COALESCE), backfilled by an idempotent script, and refreshed daily by `pg_cron` in production (manual script in local). It is **silent infrastructure** — `analyzeSimilarity()` is not modified, no UI surfaces ship in this phase. The phase delivers schema + DAL + write-path wiring + ops scripts + RLS migration that unblock Phases 18 (/explore), 19 (/search), and 20 (/evaluate).

The work is dominated by migration safety (RLS-default-on, NULLS NOT DISTINCT, generated-column normalization, ON CONFLICT semantics) and ops correctness (SECURITY DEFINER + explicit anon/authenticated revokes, pg_cron prod-only path with local fallback). Every locked decision in CONTEXT.md (D-01 through D-17) has been resolved by research; the remaining Claude's Discretion items have prescriptive recommendations below.

**Primary recommendation:** Ship as a single Drizzle column-shape migration + a single sibling Supabase raw-SQL migration committed in the same commit, with the backfill script and pg_cron function deployed separately (script run after migrations land in prod; pg_cron job created in a prod-only Supabase migration). Use Drizzle's native `generatedAlwaysAs()` and `unique(...).nullsNotDistinct()` for column-level constraints; raw SQL for the natural-key UNIQUE on the generated trio (because Drizzle's introspection of generated columns inside multi-column unique indexes is unverified at 0.45.2).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Identity & Normalization**

- **D-01: Natural-key UNIQUE uses `NULLS NOT DISTINCT`** (PG 15+). `UNIQUE (brand_normalized, model_normalized, reference_normalized) NULLS NOT DISTINCT`. Two `(Rolex, Submariner, NULL)` rows collide and dedup. Validate Drizzle 0.45.2 introspection during planning; index defined in raw SQL regardless.

- **D-02: Postgres generated columns for normalization.** Source columns preserve display casing; `_normalized` columns are DB-enforced. Pattern:
  ```sql
  brand text NOT NULL,
  brand_normalized text GENERATED ALWAYS AS (lower(trim(brand))) STORED,
  model text NOT NULL,
  model_normalized text GENERATED ALWAYS AS (lower(trim(model))) STORED,
  reference text,
  reference_normalized text GENERATED ALWAYS AS (
    /* see D-03 for reference-specific normalization shape */
  ) STORED
  ```
  Impossible to bypass — even raw INSERTs work correctly.

- **D-03: Reference normalization is `lower + trim + strip whitespace/punctuation`** (medium aggressiveness). `116610LN`, `116610 LN`, `116610-LN`, `116610.LN` all collapse to `116610ln`. Trades small risk of merging punctuation-distinct refs (Patek `5711/1A`) for much higher dedup rate on real-world sloppy input. **Claude's Discretion:** the exact regex/character set for "punctuation" in the GENERATED expression — research and pin during plan-time.

- **D-04: `source` is a CHECK constraint on a text column**, NOT a Drizzle `pgEnum`. Avoids the Phase 24-style rename+recreate dance if values evolve. Add the TS literal union manually in `src/lib/types.ts`.

**Catalog Field Scope & Image Provenance**

- **D-05: `upsertCatalogFromUserInput` writes natural key only.** Helper inserts `(brand, model, reference, source='user_promoted')` and uses `ON CONFLICT DO NOTHING`. Spec columns (caseSizeMm, movement, complications, year, tags, etc.) start NULL.

- **D-06: imageUrl lives at the catalog level with provenance tracking.** Three columns: `image_url`, `image_source_url`, `image_source_quality`. Smart-replace logic deferred to v5+. **Claude's Discretion:** CHECK enum vs free-text for `image_source_quality` in v4.0.

- **D-07: `dialColor` is a catalog SPEC field.** Different references = different catalog rows (`116610LN` black vs `116610LB` blue).

- **D-08: `productionYear` is a single integer matching existing `watches.productionYear` shape**, plus a new `production_year_is_estimate boolean DEFAULT false` flag.

- **D-09: Tag columns mirror current `watches` shape exactly.** `style_tags`, `design_traits`, `role_tags`, `complications` — all `text[] NOT NULL DEFAULT '{}'`. **No taxonomy changes in Phase 17.**

**Source Provenance & Enrichment**

- **D-10: `source` upgrades `user_promoted` → `url_extracted` on any successful URL-extract write.** Reflects highest-trust write the row has seen. Never downgrades. `admin_curated` is terminal lockdown state.

- **D-11: No code path writes `admin_curated` in v4.0.** CHECK allows the value but admin tooling is deferred. The CAT-07 `admin_curated` overwrite-guard is implemented but never triggers in v4.0.

- **D-12: Audit trail is `updated_at timestamptz NOT NULL DEFAULT now()` only.** No per-field tracking, no audit log table, no `enrichment_count`. Trigger updates `updated_at` on every write.

- **D-13: Conflict resolution is COALESCE-only — first non-null write wins.** URL #1 sets `case_size_mm = 40`; URL #2 says `41`; COALESCE keeps 40.

**Backfill & Cron Operations**

- **D-14: Backfill runs as `npm run db:backfill-catalog`**, a standalone TS script at `scripts/backfill-catalog.ts`. Idempotent: `WHERE catalog_id IS NULL` short-circuit + final zero-unlinked assertion. Re-running after success is a no-op.

- **D-15: pg_cron daily refresh runs at 03:00 UTC.** SECURITY DEFINER function refreshes counts AND writes a snapshot row.

- **D-16: Local `npm run db:refresh-counts` mirrors prod behavior** — refreshes counts AND writes a snapshot row. Same code path as pg_cron, manually invoked. Snapshot date = current date in UTC; idempotent on `UNIQUE (catalog_id, date)`.

- **D-17: Snapshots retained indefinitely in v4.0** — no purge job. ~1.8M rows/year is well within Supabase free tier.

### Claude's Discretion

The plan can decide:
- Exact regex/character set for "strip whitespace/punctuation" in `reference_normalized` GENERATED expression (D-03)
- Whether `image_source_quality` ships as a CHECK enum or free-text in v4.0 (D-06)
- Snake-case column naming details (snake_case throughout, mirroring existing conventions)
- Backfill script logging format
- pg_cron job naming (`refresh_watches_catalog_counts_daily` or similar)
- Migration filename ordering relative to existing v3.0 migrations
- Exact SECURITY DEFINER + REVOKE PUBLIC/anon/authenticated grants on the cron function (mirror Phase 11 pattern)

### Deferred Ideas (OUT OF SCOPE)

- **Admin tooling for catalog curation** — image override, spec corrections, source promotion to `admin_curated`, conflict resolution. v5+ phase.
- **Brand-domain allowlist + tier-aware image COALESCE smart-replace logic** — columns added in Phase 17; logic in v5+.
- **Back-port `production_year_is_estimate` flag to per-user `watches` table** — v4.x or v5+.
- **Tag taxonomy audit & rewire** — future phase audits, pares down, migrates both `watches` + `watches_catalog` in lockstep, updates `analyzeSimilarity()` weights. Should land BEFORE v5.0 catalog→similarity rewire.
- **Snapshot purge job** — deferred from v4.0; revisit when storage becomes a concern.
- **`SET NOT NULL` on `watches.catalog_id`** — preserved as NULLABLE indefinitely in v4.0 (CAT-14, v5+).
- **Modifying `analyzeSimilarity()` to read from catalog** — silent infrastructure in v4.0; rewire is v5+.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | `watches_catalog` table with surrogate UUID PK + natural-key UNIQUE on normalized `(brand, model, reference)` trio | Schema sketch under "Architecture Patterns → Pattern 1"; confirms `nullsNotDistinct()` is supported by Drizzle 0.45.2 (verified in `node_modules/drizzle-orm/pg-core/unique-constraint.d.ts:10,22`) |
| CAT-02 | Public-read RLS; service-role-only writes (deliberate departure from two-layer privacy) | Schema sketch under "Architecture Patterns → Pattern 2"; mirrors Phase 11 RLS audit pattern (`20260423000005_phase11_debt02_audit.sql`) |
| CAT-03 | `pg_trgm` GIN indexes on `brand` + `model` for sub-200ms search | Index DDL under "Architecture Patterns → Pattern 1"; mirrors Phase 11 `20260423000003_phase11_pg_trgm.sql` proven shape; opclass schema-qualified to `extensions.gin_trgm_ops` |
| CAT-04 | Nullable `catalog_id` FK on `watches` with `ON DELETE SET NULL` | Schema sketch + Pitfall 1; column added now, NEVER `SET NOT NULL` in v4.0 |
| CAT-05 | Idempotent batched backfill script with `WHERE catalog_id IS NULL` short-circuit + final `COUNT(*)` zero-unlinked assertion | "Code Examples → Pattern 5"; idempotency guaranteed by both the WHERE filter AND `INSERT … ON CONFLICT DO NOTHING` |
| CAT-06 | `upsertCatalogFromUserInput` using `ON CONFLICT DO NOTHING` (typed-input, no spec enrichment) | "Code Examples → Pattern 3"; rationale = typo risk |
| CAT-07 | `upsertCatalogFromExtractedUrl` using `ON CONFLICT DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` per nullable spec column; `admin_curated` rows guarded | "Code Examples → Pattern 4"; CASE on source column pins admin_curated never overwritten |
| CAT-08 | `addWatch` Server Action and `/api/extract-watch` route handler both populate `watches_catalog` via the appropriate helper | "Architecture Patterns → Integration Points"; fire-and-forget non-fatal failure semantics mirror `logActivity` |
| CAT-09 | `pg_cron` daily-batch function refreshes denormalized `owners_count` + `wishlist_count` (SECURITY DEFINER + revoke PUBLIC/anon/authenticated) | "Code Examples → Pattern 6"; mirrors Phase 11 `20260423000046_phase11_secdef_revoke_public.sql` |
| CAT-10 | Manual `npm run db:refresh-counts` script provides the same refresh path for local dev | "Code Examples → Pattern 7"; calls the same SECDEF function via service-role psql |
| CAT-11 | Catalog authoritative for SPEC fields at display time via `catalog_id` JOIN; per-user `watches` authoritative for OWNERSHIP/PROVENANCE fields | "Architecture Patterns → Pattern 8: Source-of-Truth Split"; documented as Key Decision in PROJECT.md after merge |
| CAT-12 | `watches_catalog_daily_snapshots` table records `(catalog_id, date, owners_count, wishlist_count)` | Schema sketch + idempotency UNIQUE under "Architecture Patterns → Pattern 1" |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md and AGENTS.md add two Phase-17-relevant directives:

1. **Next.js 16 has breaking changes** — for any code touching App Router internals (cache, Server Actions, route handlers), read the relevant guide in `node_modules/next/dist/docs/` before writing. Phase 17 has light Next.js exposure (only `addWatch` + `/api/extract-watch` get a single helper call added), but the planner should not assume Next.js 15-era APIs are still valid (e.g., `revalidateTag` vs `updateTag` semantics — already established by Phase 13).
2. **GSD workflow enforcement** — file edits flow through GSD commands. Phase 17 work goes through `/gsd-execute-phase`.

Coding conventions confirmed from `CLAUDE.md` Conventions section:
- Component files PascalCase; non-component files camelCase; route segments kebab-case
- Type-only imports use `import type { ... }`
- Absolute imports via `@/*`
- Strict TS; no class components; functional only
- Snake-case for DB columns (mirrored from existing schema)
- Drizzle for column shapes + raw SQL Supabase migrations for RLS / partial indexes / GIN / CHECK / generated columns / triggers

## Standard Stack

### Core (already in tree — no installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 | Column-shape migrations, type-safe queries | Project default; verified `generatedAlwaysAs()` + `unique(...).nullsNotDistinct()` available in this version `[VERIFIED: node_modules/drizzle-orm/pg-core/columns/common.d.ts:46-51, unique-constraint.d.ts:10,22]` |
| `drizzle-kit` | 0.31.10 | Local push only (`drizzle-kit push`) | Project default per MEMORY `project_drizzle_supabase_db_mismatch.md` — prod migrations use `supabase db push --linked` `[VERIFIED: node_modules/drizzle-kit/package.json:3]` |
| `postgres` | ^3.4.9 | Driver Drizzle uses on Supabase pooler | Already wired |
| `zod` | bundled | Server Action input validation | Already in `src/app/actions/watches.ts` `[VERIFIED: file:src/app/actions/watches.ts:2]` |
| `pg_trgm` (Postgres extension) | shipped with Supabase | GIN trigram indexes for ILIKE acceleration | Phase 11 already enabled it in `extensions` schema `[VERIFIED: supabase/migrations/20260423000003_phase11_pg_trgm.sql:11]` |
| `pg_cron` (Postgres extension) | shipped with Supabase prod | Daily refresh function scheduler | NOT shipped in vanilla Supabase Docker — local fallback is a manual script `[CITED: STACK.md §"Local Dev Workflow (No pg_cron)"]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` (built-in) | Node | UUID generation in scripts | Backfill batching |
| `tsx` (or `ts-node` via npm script wrapper) | dev-only | Run TS scripts (`scripts/backfill-catalog.ts`) | New `package.json` scripts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generated columns + `lower(trim(...))` | `CITEXT` columns | `[CITED: PITFALLS.md §Pitfall 3]` — CITEXT solves casing but not whitespace/punctuation drift; introduces a new column type the codebase doesn't use elsewhere; rejected |
| Generated columns | App-side normalization in DAL only | Bypassable by raw SQL; CONTEXT.md D-02 specifies DB-enforced |
| Live AFTER INSERT/UPDATE/DELETE triggers on `watches` | `pg_cron` daily batch | Write amplification on `addWatch` hot path; "trending" is slow-moving — daily is fine `[CITED: ARCHITECTURE.md §"Feature 2 — Live Triggers vs Daily pg_cron Batch" lines 309-321]` |
| Materialized view for `owners_count` | Plain UPDATE in cron function | Materialized view requires `REFRESH MATERIALIZED VIEW CONCURRENTLY` and a separate row-source; UPDATE on the catalog table is simpler at our scale |
| Drizzle `pgEnum` for `source` | Text column with CHECK constraint | CONTEXT.md D-04 — avoids Phase-24-style rename+recreate if values evolve |
| Algolia / Meilisearch / Typesense | `pg_trgm` GIN | Operational overkill at <5000 catalog rows; pg_trgm is fast enough until 100k+ rows `[CITED: STACK.md §"/explore + /search Watches/Collections — No New Libraries"]` |

**Installation:**
No new npm dependencies required. Phase 17 is composed entirely of in-tree libraries.

**Version verification (Phase 17 plan-time — to be re-confirmed in plan):**
- `drizzle-orm@0.45.2` `[VERIFIED: node_modules/drizzle-orm/package.json:3 on 2026-04-27]`
- `drizzle-kit@0.31.10` `[VERIFIED: node_modules/drizzle-kit/package.json:3 on 2026-04-27]`
- `postgres@3.4.x` `[VERIFIED: package.json on 2026-04-27]`

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/
│   └── schema.ts                    # ADD watchesCatalog + watchesCatalogDailySnapshots tables
                                     # ADD catalogId column to watches
├── data/
│   ├── catalog.ts                   # NEW — DAL: upsertCatalogFromUserInput,
│   │                                #              upsertCatalogFromExtractedUrl,
│   │                                #              linkWatchToCatalog
│   └── watches.ts                   # MODIFY — accept optional catalogId in createWatch
│                                    #          OR keep separate linkWatchToCatalog (planner choice)
├── app/
│   ├── actions/watches.ts           # MODIFY — addWatch wires catalog_id (fire-and-forget)
│   └── api/extract-watch/route.ts   # MODIFY — call upsertCatalogFromExtractedUrl after success
├── lib/
│   ├── types.ts                     # ADD — CatalogSource, CatalogEntry, ImageSourceQuality types
│   └── extractors/index.ts          # NO CHANGE — extractor logic untouched (D-05/D-07)
scripts/
├── backfill-catalog.ts              # NEW — idempotent batched backfill
└── refresh-counts.ts                # NEW — calls SECDEF function via service-role psql
drizzle/
└── XXXX_phase17_catalog.sql         # NEW — column shapes (auto-generated by drizzle-kit)
supabase/
└── migrations/
    ├── 20260427NNNNNN_phase17_catalog_schema.sql       # NEW — table, generated cols,
    │                                                   # natural-key UNIQUE NULLS NOT DISTINCT,
    │                                                   # GIN indexes, CHECK on source,
    │                                                   # CHECK on image_source_quality,
    │                                                   # RLS + public-read SELECT policy,
    │                                                   # snapshots table + UNIQUE,
    │                                                   # updated_at trigger
    └── 20260427NNNNNN_phase17_pg_cron.sql              # NEW — SECDEF refresh fn, REVOKE
                                                         # PUBLIC/anon/authenticated, GRANT
                                                         # service_role, cron.schedule
                                                         # (prod-only — guarded so local skips)
docs/
└── deploy-db-setup.md               # MODIFY — add post-deploy backfill + pg_cron verify steps
tests/integration/
├── phase17-catalog-rls.test.ts      # NEW — anon SELECT works, anon write blocked
├── phase17-natural-key.test.ts      # NEW — NULLS NOT DISTINCT dedup; casing collapse
├── phase17-backfill-idempotency.test.ts  # NEW — re-run is no-op
├── phase17-upsert-coalesce.test.ts  # NEW — DO NOTHING vs DO UPDATE COALESCE per source
└── phase17-refresh-counts.test.ts   # NEW — refresh_counts() updates owners + writes snapshot
package.json                         # ADD scripts: db:backfill-catalog, db:refresh-counts
src/lib/types.ts                     # ADD CatalogSource union, CatalogEntry, etc.
```

### Pattern 1: Schema with Generated Columns + NULLS NOT DISTINCT Natural Key

**What:** Source columns preserve display casing; `_normalized` generated columns are DB-computed; UNIQUE on the normalized trio with `NULLS NOT DISTINCT` so two `(Rolex, Submariner, NULL)` rows collide and dedup.

**When to use:** Every catalog write — manual entry, URL-extract, backfill, future admin tooling. Identity is enforced at the DB regardless of code path.

**Why this shape (not just app-side `.toLowerCase()`):**
- Bypassable by raw SQL inserts (psql, future migrations, admin tools)
- Generated columns are deterministic and indexable `[CITED: PITFALLS.md §Pitfall 3 line 96]`
- Locked by CONTEXT.md D-02

**Drizzle vs raw SQL split:**

| Concern | Mechanism | Reason |
|---------|-----------|--------|
| Column shape (id, brand, model, image_url, source, counts, timestamps) | Drizzle `pgTable` | Project convention; type inference downstream |
| `brand_normalized` / `model_normalized` / `reference_normalized` GENERATED columns | Drizzle `text(...).generatedAlwaysAs(sql\`lower(trim(brand))\`)` | Verified Drizzle 0.45.2 supports it `[VERIFIED: node_modules/drizzle-orm/pg-core/columns/common.d.ts:49]`; emit DDL Drizzle can author |
| Natural-key UNIQUE on the generated trio with `NULLS NOT DISTINCT` | Raw SQL in Supabase migration | Drizzle 0.45.2 introspection of generated columns inside multi-column unique indexes is unverified. The CONTEXT.md D-01 note "index defined in raw SQL regardless" — adopt it |
| `image_source_quality` CHECK constraint | Raw SQL `CHECK (image_source_quality IN (...))` | Drizzle pg-core has limited CHECK expression in 0.45.2 |
| `source` CHECK constraint | Raw SQL `CHECK (source IN ('user_promoted','url_extracted','admin_curated'))` | Same — CONTEXT.md D-04 explicitly avoids `pgEnum` |
| `pg_trgm` GIN indexes on `brand` + `model` | Raw SQL | Drizzle pg-core does not express `gin_trgm_ops` opclass `[CITED: existing schema.ts comment, src/db/schema.ts:236-239]` |
| RLS: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR SELECT USING (true)` | Raw SQL | Drizzle does not author RLS policies |
| `updated_at` trigger | Raw SQL | Drizzle does not author triggers |
| `watches.catalog_id` FK (nullable, ON DELETE SET NULL) | Drizzle `uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' })` | Standard FK |

**Schema (final shape — illustrative):**

```sql
-- supabase/migrations/20260427NNNNNN_phase17_catalog_schema.sql
BEGIN;

CREATE TABLE watches_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display columns (preserve user/extractor casing)
  brand text NOT NULL,
  model text NOT NULL,
  reference text,

  -- Normalized columns (DB-enforced; D-02)
  brand_normalized text GENERATED ALWAYS AS (lower(trim(brand))) STORED,
  model_normalized text GENERATED ALWAYS AS (lower(trim(model))) STORED,
  reference_normalized text GENERATED ALWAYS AS (
    CASE WHEN reference IS NULL THEN NULL
         ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')
    END
  ) STORED,

  -- Source provenance (D-04)
  source text NOT NULL DEFAULT 'user_promoted'
    CHECK (source IN ('user_promoted','url_extracted','admin_curated')),

  -- Image provenance (D-06)
  image_url text,
  image_source_url text,
  image_source_quality text
    CHECK (image_source_quality IS NULL
           OR image_source_quality IN ('official','retailer','unknown')),

  -- Spec fields (D-07, D-08, D-09) — all nullable, COALESCE-enriched (D-13)
  movement text,
  case_size_mm real,
  lug_to_lug_mm real,
  water_resistance_m integer,
  crystal_type text,
  dial_color text,
  is_chronometer boolean,
  production_year integer,
  production_year_is_estimate boolean NOT NULL DEFAULT false,

  -- Tag arrays (D-09 — mirror watches shape exactly)
  style_tags text[] NOT NULL DEFAULT '{}',
  design_traits text[] NOT NULL DEFAULT '{}',
  role_tags text[] NOT NULL DEFAULT '{}',
  complications text[] NOT NULL DEFAULT '{}',

  -- Denormalized counts (refreshed by pg_cron / db:refresh-counts)
  owners_count integer NOT NULL DEFAULT 0,
  wishlist_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()  -- D-12
);

-- Natural-key UNIQUE on normalized trio (D-01) — raw SQL because NULLS NOT DISTINCT
-- on a generated-column trio is the safest path for Drizzle 0.45.2 introspection
CREATE UNIQUE INDEX watches_catalog_natural_key_idx
  ON watches_catalog (brand_normalized, model_normalized, reference_normalized)
  NULLS NOT DISTINCT;

-- pg_trgm GIN — schema-qualified opclass per Phase 11 pattern
CREATE INDEX watches_catalog_brand_trgm_idx
  ON watches_catalog USING gin (brand extensions.gin_trgm_ops);
CREATE INDEX watches_catalog_model_trgm_idx
  ON watches_catalog USING gin (model extensions.gin_trgm_ops);

-- /explore Trending sort (Phase 18 will read this)
CREATE INDEX watches_catalog_owners_count_desc_idx
  ON watches_catalog (owners_count DESC NULLS LAST);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION watches_catalog_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER watches_catalog_set_updated_at_trg
  BEFORE UPDATE ON watches_catalog
  FOR EACH ROW EXECUTE FUNCTION watches_catalog_set_updated_at();

-- RLS — public-read, server-write-only (D from CAT-02; deliberate departure)
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY watches_catalog_select_all
  ON watches_catalog FOR SELECT USING (true);

-- Note: no INSERT/UPDATE/DELETE policies → those operations fail under anon/authenticated.
-- Server Actions use service-role Drizzle client which bypasses RLS.

-- watches.catalog_id FK (CAT-04)
ALTER TABLE watches
  ADD COLUMN catalog_id uuid REFERENCES watches_catalog(id) ON DELETE SET NULL;

CREATE INDEX watches_catalog_id_idx ON watches (catalog_id);

-- Daily snapshots (CAT-12)
CREATE TABLE watches_catalog_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  owners_count integer NOT NULL,
  wishlist_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, snapshot_date)  -- idempotency guard for cron retries (D-15, D-16)
);

CREATE INDEX watches_catalog_snapshots_date_idx
  ON watches_catalog_daily_snapshots (snapshot_date DESC, catalog_id);

-- Snapshots are public-read too (Phase 18 /explore Gaining Traction will join them)
ALTER TABLE watches_catalog_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY watches_catalog_snapshots_select_all
  ON watches_catalog_daily_snapshots FOR SELECT USING (true);

COMMIT;
```

### Pattern 2: RLS Asymmetry — Public Read, Service-Role Write

**What:** `watches_catalog` is `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY … FOR SELECT USING (true)`. NO INSERT/UPDATE/DELETE policies. Anon/authenticated reads work; their writes fail. The Drizzle client uses the service role (via `DATABASE_URL` from `.env.local` — pooler URL, service-role authentication), which bypasses RLS entirely.

**When to use:** Phase 17 only — this is a deliberate departure from the project's two-layer privacy default. CONTEXT.md acknowledges "the asymmetry is the point." Document as a Key Decision in PROJECT.md when v4.0 ships `[CITED: ARCHITECTURE.md line 200]`.

**Critical guarantee:** EVERY new table in v4.0+ must include `ENABLE ROW LEVEL SECURITY` + at least one policy in the SAME commit `[CITED: PITFALLS.md §Pitfall 4]`. Phase 11 DEBT-02 audited this; absence = anon-invisible silent failure that only manifests on production.

**Test:** Open an anon Supabase JS client in `tests/integration/phase17-catalog-rls.test.ts`; assert SELECT returns >0 rows after seed; assert INSERT/UPDATE/DELETE fail with RLS error.

### Pattern 3: Two Upsert Helpers — DO NOTHING vs COALESCE-Enrichment

**What:** Two distinct functions in `src/data/catalog.ts`, never share an insert path.

| Helper | Conflict behavior | Source written | Used by |
|--------|-------------------|----------------|---------|
| `upsertCatalogFromUserInput` (CAT-06) | `ON CONFLICT DO NOTHING` | `'user_promoted'` (only on INSERT — D-10 means existing url_extracted/admin_curated rows are NOT downgraded; DO NOTHING handles this naturally) | `addWatch` Server Action |
| `upsertCatalogFromExtractedUrl` (CAT-07) | `ON CONFLICT DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` per nullable spec column; `source = CASE WHEN catalog.source = 'admin_curated' THEN catalog.source ELSE 'url_extracted' END` | `'url_extracted'` (D-10 upgrade) | `/api/extract-watch` route handler |

**Why two helpers, not one with a flag:** PITFALLS.md Pitfall 2 — sharing a helper risks `DO NOTHING` accidentally getting applied to URL-extract path, which silently discards better data. Helper name = clear intent at call site `[CITED: PITFALLS.md §Pitfall 2]`.

**Failure semantics:** Both helpers are wrapped in fire-and-forget try/catch at call sites (mirror `logActivity` / `logNotification` pattern from Phase 13). If catalog insert fails, the user's `watches` row is committed with `catalog_id = NULL`. Backfill or future re-attempt repairs.

### Pattern 4: Backfill Idempotency

**What:** `scripts/backfill-catalog.ts` reads `watches WHERE catalog_id IS NULL` in batches, inserts catalog rows with `ON CONFLICT DO NOTHING`, links via UPDATE, and asserts zero unlinked at end.

**Idempotency guarantees:**
1. `WHERE catalog_id IS NULL` filter skips already-linked rows
2. `INSERT … ON CONFLICT (brand_normalized, model_normalized, reference_normalized) DO NOTHING` short-circuits dedup attempts
3. `UPDATE watches SET catalog_id = X WHERE id = Y` with the same X is a no-op
4. Final assertion: `SELECT count(*) FROM watches WHERE catalog_id IS NULL` — log every unlinked row before exit if non-zero

**Operational pattern:** Run AFTER the schema migration applies in prod. Per MEMORY `project_drizzle_supabase_db_mismatch.md`, prod uses `supabase db push --linked --include-all`, NOT `drizzle-kit push`. Backfill script uses the same `DATABASE_URL` (service-role pooler).

### Pattern 5: pg_cron + SECURITY DEFINER + Explicit Revokes

**What:** A single Postgres function `refresh_watches_catalog_counts()` recomputes `owners_count` + `wishlist_count` AND inserts a daily snapshot row, scheduled at 03:00 UTC by `pg_cron`. The function is SECURITY DEFINER and has explicit REVOKE FROM PUBLIC, anon, authenticated, plus GRANT TO service_role. Mirrors Phase 11 `20260423000046_phase11_secdef_revoke_public.sql` pattern.

**Why explicit revokes from anon AND authenticated:** Per MEMORY `project_supabase_secdef_grants.md`, Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions at creation time. `REVOKE FROM PUBLIC` alone does not block them. Must explicitly revoke from each role.

**Local fallback:** Vanilla Supabase Docker doesn't ship pg_cron. The pg_cron schedule lives in a separate Supabase migration that is prod-only. Locally, devs run `npm run db:refresh-counts` which calls the same SECDEF function directly via psql or service-role Drizzle client `[CITED: STACK.md §"Local Dev Workflow (No pg_cron)"]`.

**pg_cron job naming (Claude's Discretion):** `refresh_watches_catalog_counts_daily` — descriptive, includes cadence in the name for `SELECT * FROM cron.job` legibility.

**Verification:** `SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'refresh_watches_catalog_counts_daily'` — document this query in `docs/deploy-db-setup.md` post-deploy step.

### Pattern 6: Source-of-Truth Split (CAT-11)

**What:**

| Field type | Authoritative source | Read at display time from |
|------------|---------------------|---------------------------|
| SPEC (movement, caseSizeMm, lugToLugMm, waterResistanceM, crystalType, dialColor, isChronometer, complications, productionYear, image_url, style_tags, design_traits, role_tags) | `watches_catalog` | JOIN `watches.catalog_id = watches_catalog.id` |
| OWNERSHIP / PROVENANCE (status, pricePaid, targetPrice, marketPrice, acquisitionDate, notes, notesPublic, notesUpdatedAt, lastWornDate, isFlaggedDeal) | `watches` | Direct |

**v4.0 enforcement:** Phase 17 ships the catalog and the FK; it does NOT modify display code. Per CAT-11 the display-time JOIN is a contract for downstream phases (19, 20). Phase 17 only ensures the data substrate is correct so future surfaces can compose it.

**Per-user override deferred:** PITFALLS.md Pitfall 18 raises the divergence question (per-user `watches.isChronometer = false` while catalog says `true`). v4.0 answer: catalog wins for /search and /explore; per-user `watches` wins for the user's own collection view. Cross-display reconciliation deferred to v5+.

### Anti-Patterns to Avoid

- **Live triggers on `watches` to update `owners_count`** — write amplification on `addWatch` hot path, contention under load. Use daily pg_cron (D-15) `[CITED: PITFALLS.md §Pitfall 11]`.
- **Hand-rolling normalization in app code only** — bypassable by raw SQL; CONTEXT.md D-02 mandates DB-enforced generated columns.
- **Sharing a single upsert helper between manual + URL-extract paths** — silently discards URL enrichment via `DO NOTHING`. Two helpers, two clear call sites `[CITED: PITFALLS.md §Pitfall 2]`.
- **Forgetting `ENABLE ROW LEVEL SECURITY` on the snapshots table** — Phase 11 DEBT-02 audit established the project-wide invariant. Both new tables must have RLS + at least one policy `[CITED: PITFALLS.md §Pitfall 4]`.
- **Using `ALTER TYPE ADD/DROP VALUE` for `source` evolution** — CONTEXT.md D-04 explicitly avoids this; `source` is a CHECK constraint on `text`, ALTER TABLE … DROP/ADD CONSTRAINT is the evolution path.
- **`SET NOT NULL` on `watches.catalog_id` in v4.0** — Pitfall 1 + CONTEXT.md `<deferred>` ban this. It MUST stay nullable indefinitely.
- **Backfill that doesn't re-run as a no-op** — required by D-14 and CAT-05; assert `WHERE catalog_id IS NULL` count = 0 at end, log each unlinked row before retry.
- **`updateTag` / `revalidateTag` on catalog writes from inside the addWatch hot path** — catalog data isn't viewer-tagged in v4.0 (no per-user catalog cache); skip cache invalidation work in Phase 17.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive UNIQUE on `(brand, model, reference)` | App-side `.toLowerCase()` before insert | Postgres GENERATED columns + `UNIQUE NULLS NOT DISTINCT` | Bypassable by raw SQL; non-deterministic across code paths `[CITED: PITFALLS.md §Pitfall 3]` |
| Trigram-style search on brand/model | LIKE with multiple OR clauses + manual scoring | `pg_trgm` GIN + `ILIKE` | Phase 11 already enabled; sub-200ms at production scale; planner picks Bitmap Index Scan above ~150 rows `[CITED: PITFALLS.md §Pitfall 17]` |
| Daily refresh job | Node cron (`node-cron`, `agenda`, custom interval) | `pg_cron` SECDEF function + manual fallback script | Lives in DB; survives app restarts; Supabase ships the extension `[CITED: ARCHITECTURE.md §"Feature 2"]` |
| Idempotent upsert with conditional enrichment | App-side SELECT-then-INSERT-or-UPDATE | `INSERT … ON CONFLICT DO UPDATE SET col = COALESCE(...)` per column | Race-free atomic; no SELECT-then-write window `[CITED: PITFALLS.md §Pitfall 2]` |
| `updated_at` maintenance | App writes `updated_at = new Date()` on every UPDATE | Postgres BEFORE UPDATE trigger | Can't be forgotten; D-12 demands consistency with `watches`/`profiles` |
| Backfill batching helper | Custom batching primitive | Plain LIMIT/OFFSET loop with `WHERE catalog_id IS NULL` filter as the natural cursor | Total scale is hundreds of rows; loop terminates because the WHERE filter shrinks as we link |
| Image-quality smart-replace | Hand-rolled tier comparison | DEFER to v5+ (D-06) | Out of v4.0 scope; columns added but logic is admin tooling work |

**Key insight:** Postgres handles every hard part of this phase natively (UNIQUE NULLS NOT DISTINCT, generated columns, GIN trigram, SECDEF + pg_cron, COALESCE upsert). The DAL is a thin call-site adapter, not a logic layer. Every "what if I did this in TypeScript instead" answer is wrong for this phase.

## Runtime State Inventory

> Phase 17 introduces new tables, columns, and DB functions. It does NOT rename or refactor existing identifiers. Most categories are not applicable; documented for completeness so the planner has explicit signals.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 17 is additive. Existing `watches` rows gain a nullable `catalog_id` (pre-fill = NULL); backfill script populates them. No existing string identifiers being renamed. | Backfill script (D-14) — already in plan |
| Live service config | None — no n8n / Datadog / Cloudflare Tunnel state references catalog tables | None |
| OS-registered state | None — no Windows Task Scheduler / launchd / pm2 jobs reference catalog. The pg_cron job is registered IN the database via `cron.schedule(...)`, not at OS level. | Document the cron job name in `docs/deploy-db-setup.md` for verifiability |
| Secrets/env vars | None — `DATABASE_URL` already exists and provides service-role access used by both the backfill script and the manual refresh script. No new secrets. | None |
| Build artifacts | None — Phase 17 ships TS source under `src/`, scripts under `scripts/`, and SQL under `supabase/migrations/` + `drizzle/`. No compiled artifacts. The `drizzle-kit push` local shadow journal under `drizzle/meta/` will gain a Phase 17 entry — checked into git per project convention. | Re-run `npm install` is NOT required (no dep changes) |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*

Answer: nothing. This phase is additive — there is nothing "old" to invalidate. The only post-deploy operations are (a) running the backfill script once, and (b) verifying the pg_cron job is scheduled. Both are documented in `docs/deploy-db-setup.md`.

## Common Pitfalls

> Each pitfall below maps to a numbered entry in `.planning/research/PITFALLS.md`. Mitigations are pinned to specific Phase 17 plan tasks.

### Pitfall 1: Backfill half-completes; SET NOT NULL forced too early

**What goes wrong:** The phase plan tries to ship schema + backfill + `ALTER COLUMN catalog_id SET NOT NULL` in one migration. Production has rows that fail to match (typo, casing, NULL reference colliding under default UNIQUE semantics), the SET NOT NULL fails, the entire migration aborts, and recovery is painful because half the catalog is inserted but none is linked.

**How to avoid:**
- CONTEXT.md `<deferred>` and CAT-14 explicitly defer SET NOT NULL to v5+. The phase plan must NOT include `ALTER COLUMN … SET NOT NULL` anywhere.
- Backfill is a separate operation from the schema migration. Schema ships → migration applies in prod → THEN run `npm run db:backfill-catalog`.
- Backfill ends with `SELECT count(*) FROM watches WHERE catalog_id IS NULL`; if non-zero, log each `(brand, model, reference)` and abort before any caller assumes 100%.

**Warning signs:** Migration file contains both `ADD COLUMN catalog_id` and `ALTER COLUMN … SET NOT NULL`. Backfill script lacks final assertion.

**Phase 17 task to address:** Schema migration task, backfill task. Reviewer must verify SET NOT NULL is NOT present anywhere.

### Pitfall 2: `ON CONFLICT DO NOTHING` on URL-extract path silently discards enrichment

**What goes wrong:** If the URL-extract helper uses `DO NOTHING`, the second URL extraction for an existing catalog row (with better spec data) is a no-op. Catalog stays at user_promoted quality forever.

**How to avoid:**
- Two helpers, two call sites. `upsertCatalogFromUserInput` uses `DO NOTHING`; `upsertCatalogFromExtractedUrl` uses `DO UPDATE SET col = COALESCE(catalog.col, EXCLUDED.col)` per nullable spec column.
- Test: write a row via `upsertCatalogFromUserInput` (caseSizeMm = NULL); call `upsertCatalogFromExtractedUrl` with caseSizeMm = 40; assert catalog row's caseSizeMm is now 40.
- Test: write a row via `upsertCatalogFromExtractedUrl` (caseSizeMm = 40); call again with caseSizeMm = 41; assert catalog row's caseSizeMm is still 40 (D-13 first-non-null wins).

**Warning signs:** Single shared upsert helper. No test asserts spec enrichment.

**Phase 17 task to address:** DAL implementation task; integration test task `phase17-upsert-coalesce.test.ts`.

### Pitfall 3: Catalog identity fragmentation from typo / casing

**What goes wrong:** Without normalization, "Rolex"/"ROLEX"/"rolex" produce three catalog rows. /explore double-counts; owners_count fragmented.

**How to avoid:** D-02 + D-03 — generated columns enforce normalization at DB level. UNIQUE on the generated trio guarantees identity. Plan-time decision (D-03 Claude's Discretion): the regex.

**Recommended regex for `reference_normalized`:** `regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')`

**Why this regex (not `[\s\W_]+` from the CONTEXT note):**
- `[^a-z0-9]+` is more robust because it's an explicit allowlist of survivors after `lower()`. Anything outside `a-z0-9` is stripped — covers spaces, hyphens, dots, slashes, underscores, unicode punctuation.
- `[\s\W_]+` relies on the `\W` shorthand which in Postgres POSIX-like regex means "non-word characters." Behavior across locales is less predictable than an explicit allowlist.
- Validation against the four refs in D-03 (`116610LN`, `116610 LN`, `116610-LN`, `116610.LN`) — all collapse to `116610ln` ✓
- Patek `5711/1A` → `57111a` (slash collapses, accepted tradeoff per D-03)
- Both regex variants produce the same output for the listed cases; explicit allowlist is the safer long-run choice. **Pin this in the plan.**

**Note:** The CONTEXT.md "Patek 5711/1A collision tradeoff" note means: if Patek ever ships a real `57111A` (no slash), it would collide with the slashed variant. Confirmed acceptable risk per D-03; no further mitigation in v4.0.

**Warning signs:** Catalog row count grows linearly with `watches` row count instead of plateauing. /explore shows the same model twice with different counts.

**Phase 17 task to address:** Schema migration task (regex pinned); integration test `phase17-natural-key.test.ts`.

### Pitfall 4: RLS-default-on means new tables = anon-invisible

**What goes wrong:** Phase 11 DEBT-02 audited project-wide RLS ON. Forgetting to add `ENABLE RLS + CREATE POLICY` for new tables makes /search and /explore silently return zero rows on production (the dev sees results because `DATABASE_URL` is service-role).

**How to avoid:**
- The Supabase migration includes `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + `CREATE POLICY … FOR SELECT USING (true)` for BOTH `watches_catalog` AND `watches_catalog_daily_snapshots`.
- Integration test `phase17-catalog-rls.test.ts` opens an anon Supabase JS client and asserts SELECT returns rows after seed; asserts INSERT fails.

**Warning signs:** Drizzle migration created without sibling `supabase/migrations/*.sql`. Phrase `ENABLE ROW LEVEL SECURITY` does not appear in the Phase 17 commits.

**Phase 17 task to address:** Schema migration task; RLS test task.

### Pitfall 5: pg_cron not in local Docker — silent "works in prod, empty locally"

**What goes wrong:** Vanilla Supabase Docker doesn't ship `pg_cron`. If the cron-schedule SQL runs blindly during `supabase db reset`, it errors. If it succeeds (extension preloaded), the schedule registered locally is meaningless because the dev Docker doesn't run it.

**How to avoid:**
- Split into two migrations: `phase17_catalog_schema.sql` (table, RLS, indexes — runs in BOTH local and prod) and `phase17_pg_cron.sql` (schedule — prod-only).
- The pg_cron migration starts with `CREATE EXTENSION IF NOT EXISTS pg_cron;` + a guard like `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN PERFORM cron.schedule(...); END IF; END $$;` so it gracefully skips locally if pg_cron isn't installed.
- Per MEMORY `project_drizzle_supabase_db_mismatch.md`: prod migrations land via `supabase db push --linked`. The pg_cron migration is committed but applied to prod only. Local devs use `npm run db:refresh-counts` for the same code path.

**Warning signs:** Local `supabase db reset` errors on pg_cron lines. /explore Trending shows zeros locally even after seed.

**Phase 17 task to address:** pg_cron migration task; refresh-counts script task; docs/deploy-db-setup.md update.

### Pitfall 6: SECDEF function callable by anon/authenticated via direct RPC

**What goes wrong:** Per MEMORY `project_supabase_secdef_grants.md`, Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions. `REVOKE FROM PUBLIC` alone leaves direct grants in place.

**How to avoid:** Mirror Phase 11 `20260423000046_phase11_secdef_revoke_public.sql` pattern verbatim:

```sql
REVOKE EXECUTE ON FUNCTION public.refresh_watches_catalog_counts() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_watches_catalog_counts() TO service_role;

-- Sanity assertion (from Phase 11 pattern):
DO $$
DECLARE anon_can boolean; authed_can boolean; service_can boolean;
BEGIN
  SELECT has_function_privilege('anon',           'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO anon_can;
  SELECT has_function_privilege('authenticated',  'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO authed_can;
  SELECT has_function_privilege('service_role',   'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO service_can;

  IF anon_can OR authed_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed — anon=% authed=%', anon_can, authed_can;
  END IF;
  IF NOT service_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed — service_role missing EXECUTE';
  END IF;
END $$;
```

**Warning signs:** Migration only contains `REVOKE FROM PUBLIC`. No assertion DO block.

**Phase 17 task to address:** pg_cron migration task; integration test asserts anon RPC fails with permission error.

### Pitfall 7: `ON CONFLICT` doesn't see the natural-key UNIQUE because GENERATED columns are computed AFTER input checking

**What goes wrong (theoretical concern in CONTEXT.md "Claude's Discretion #5"):** If you write `INSERT INTO watches_catalog (brand, model, reference) VALUES ('Rolex', 'Submariner', '116610LN') ON CONFLICT (brand_normalized, model_normalized, reference_normalized) DO NOTHING`, does Postgres correctly compute the generated columns BEFORE checking the UNIQUE constraint?

**Answer: Yes.** Postgres GENERATED ALWAYS AS … STORED columns are computed during INSERT processing, BEFORE constraint checks fire. The UNIQUE index on the generated columns is consulted normally. This is documented behavior in Postgres 12+ (where stored generated columns were introduced) and verified in Postgres 15+ (Supabase target).

`[CITED: Postgres docs — Generated Columns: "The value will be calculated at the time the row is inserted or updated, and stored on disk."]` — verifying the citation in the plan with a small migration test is recommended but the answer is well-established.

**Recommended `ON CONFLICT` syntax:** Use the index name explicitly to make intent unambiguous:
```sql
INSERT INTO watches_catalog (brand, model, reference, source) VALUES (...)
ON CONFLICT ON CONSTRAINT watches_catalog_natural_key_idx DO NOTHING
RETURNING id;
```
Or column-list form (also works):
```sql
ON CONFLICT (brand_normalized, model_normalized, reference_normalized) DO NOTHING
```

Both are valid; constraint-name form is more robust to schema evolution.

**Warning signs:** None for v4.0. This works correctly. Listed for completeness because CONTEXT.md flagged it as a Claude's Discretion question.

**Phase 17 task to address:** Add a single integration test asserting the natural-key UNIQUE fires on conflicting input written via different casings and reference punctuations (covered in `phase17-natural-key.test.ts`).

### Pitfall 8: Drizzle migration ordering vs existing v3.0 migrations

**What goes wrong:** Phase 17 has both a Drizzle column-shape migration (auto-generated by `drizzle-kit generate`) AND a sibling Supabase raw-SQL migration. Filename ordering matters because both directories are applied in lexical order.

**How to avoid:**
- Drizzle migration filename: auto-numbered (e.g., `0004_phase17_catalog.sql`). Drizzle journal in `drizzle/meta/_journal.json` tracks applied migrations.
- Supabase migration filename pattern: `YYYYMMDDHHMMSS_phaseNN_description.sql`. Use `20260427NNNNNN_phase17_catalog_schema.sql` and `20260427NNNNNN_phase17_pg_cron.sql` with NNNNNN being the timestamp at file creation. The `20260427` prefix sorts after Phase 13 (`20260425000000`).
- Apply order in prod: `supabase db push --linked --include-all` applies BOTH directories in their respective lexical order. The Drizzle migration creates the column shapes; the Supabase migrations layer on RLS, indexes, generated columns, CHECK, pg_cron. Naming the Supabase migration's timestamp AFTER the Drizzle migration's auto-number is sufficient.
- Per MEMORY `project_local_db_reset.md`: local reset runs Drizzle push, then selectively applies Supabase migrations via docker exec psql. Document the Phase 17 reset steps in the plan (or in an updated `docs/deploy-db-setup.md`).

**Warning signs:** Two migration files have conflicting timestamps. `drizzle-kit generate` produces an unexpectedly named file (e.g., the same name as an existing Phase 11 migration).

**Phase 17 task to address:** Migration ordering documented in the plan. Use `git status` after `drizzle-kit generate` to confirm filename. Test locally with a clean `supabase db reset` before pushing to prod.

### Pitfall 9: addWatch hot-path failure semantics for catalog wiring

**What goes wrong:** A flaky catalog upsert could throw, surface as a Server Action error, and the user thinks their watch wasn't added — when it WAS added (just not catalog-linked).

**How to avoid:**
- Wrap the catalog upsert + linking call in try/catch INSIDE addWatch, log on error, do NOT propagate. Mirrors `logActivity` and `logNotification` fire-and-forget pattern from Phase 13.
- The `linkWatchToCatalog` step is post-`createWatch`, so even if catalog work fails entirely, the user's `watches` row is committed with `catalog_id = NULL` and addWatch returns success.
- Backfill or future re-attempt fixes the unlinked row.

**Warning signs:** Catalog wiring happens BEFORE `createWatch`. Catalog errors propagate to ActionResult.error.

**Phase 17 task to address:** addWatch wiring task. Include test that mocks catalog DAL to throw and asserts addWatch still returns success with the watch saved.

### Pitfall 10: `ON DELETE SET NULL` on catalog_id needs `service_role` to actually fire when admin deletes a catalog row

**What goes wrong (low-risk because no admin tooling in v4.0, but worth noting):** ON DELETE SET NULL is enforced at the FK constraint level, not via a trigger. It runs regardless of who issues the DELETE. The risk is that anon/authenticated cannot DELETE from `watches_catalog` (no DELETE policy), so the trigger never fires for them. Service role bypasses RLS, so admin-issued deletes through the service-role client correctly null out per-user `watches.catalog_id` references.

**How to avoid:** Already correct by virtue of CAT-04 schema. No work needed in v4.0. Listed for completeness; v5+ admin tooling will exercise this.

## Code Examples

### Pattern 1: `upsertCatalogFromUserInput` (CAT-06)

```typescript
// src/data/catalog.ts
import 'server-only'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
import { sql } from 'drizzle-orm'

export interface UserPromotedCatalogInput {
  brand: string
  model: string
  reference: string | null
}

/**
 * Upserts a catalog row from typed user input.
 * Writes natural key only — spec columns left NULL for URL extraction to enrich later (D-05).
 * Returns the catalog row id (whether newly inserted or already existed).
 *
 * Failure semantics: caller must wrap in try/catch — fire-and-forget per CAT-08.
 */
export async function upsertCatalogFromUserInput(
  input: UserPromotedCatalogInput,
): Promise<string | null> {
  const { brand, model, reference } = input
  // Brand/model/reference values are passed raw — generated columns normalize on the way in.
  // Server Actions already validate non-empty brand/model via zod (src/app/actions/watches.ts:17-19).

  const result = await db.execute<{ id: string }>(sql`
    WITH ins AS (
      INSERT INTO watches_catalog (brand, model, reference, source)
      VALUES (${brand}, ${model}, ${reference}, 'user_promoted')
      ON CONFLICT ON CONSTRAINT watches_catalog_natural_key_idx DO NOTHING
      RETURNING id
    )
    SELECT id FROM ins
    UNION ALL
    SELECT id FROM watches_catalog
     WHERE brand_normalized    = lower(trim(${brand}))
       AND model_normalized    = lower(trim(${model}))
       AND reference_normalized IS NOT DISTINCT FROM (
         CASE WHEN ${reference}::text IS NULL THEN NULL
              ELSE regexp_replace(lower(trim(${reference}::text)), '[^a-z0-9]+', '', 'g')
         END
       )
     LIMIT 1
  `)

  // Result is { rows: [{ id }] } shape — depends on driver. Adapt to project's existing pattern.
  // (See src/data/profiles.ts for db.execute idioms in this codebase.)
  const rows = result as unknown as Array<{ id: string }>
  return rows[0]?.id ?? null
}
```

### Pattern 2: `upsertCatalogFromExtractedUrl` (CAT-07)

```typescript
// src/data/catalog.ts (continued)
import type { ExtractedWatchData } from '@/lib/extractors/types'

export interface UrlExtractedCatalogInput {
  brand: string
  model: string
  reference: string | null
  // Optional spec fields from extractor
  movement?: string | null
  caseSizeMm?: number | null
  lugToLugMm?: number | null
  waterResistanceM?: number | null
  crystalType?: string | null
  dialColor?: string | null
  isChronometer?: boolean | null
  productionYear?: number | null
  imageUrl?: string | null
  imageSourceUrl?: string | null  // typically the page URL itself
  imageSourceQuality?: 'official' | 'retailer' | 'unknown' | null
  styleTags?: string[]
  designTraits?: string[]
  roleTags?: string[]
  complications?: string[]
}

/**
 * Upserts a catalog row from URL-extracted data.
 * On conflict: enriches NULL fields via COALESCE; never overwrites non-null (D-13).
 * Promotes source to 'url_extracted' unless the existing row is 'admin_curated' (D-10, D-11).
 * Returns the catalog row id.
 *
 * Failure semantics: caller must wrap in try/catch — fire-and-forget per CAT-08.
 */
export async function upsertCatalogFromExtractedUrl(
  input: UrlExtractedCatalogInput,
): Promise<string | null> {
  // Build the COALESCE column list — every nullable spec column maps to:
  //   col = COALESCE(watches_catalog.col, EXCLUDED.col)
  // Tag arrays use a different rule: append uniques (only when catalog array is empty),
  // because empty defaults '{}' would otherwise look like "already populated, don't enrich".

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
      ${input.imageUrl ?? null}, ${input.imageSourceUrl ?? null},
      ${input.imageSourceQuality ?? null},
      ${input.styleTags ?? []}::text[], ${input.designTraits ?? []}::text[],
      ${input.roleTags ?? []}::text[], ${input.complications ?? []}::text[]
    )
    ON CONFLICT ON CONSTRAINT watches_catalog_natural_key_idx DO UPDATE SET
      -- D-10: source upgrades user_promoted → url_extracted; admin_curated locked
      source = CASE
        WHEN watches_catalog.source = 'admin_curated' THEN watches_catalog.source
        ELSE 'url_extracted'
      END,
      -- D-13: COALESCE-only first-non-null-wins on every nullable spec column
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
      -- Tag arrays: only enrich if catalog row's array is empty. Avoids appending
      -- to a curated taxonomy. (Plan-time decision: alternative is array_cat dedup.)
      style_tags    = CASE WHEN array_length(watches_catalog.style_tags, 1)   IS NULL THEN EXCLUDED.style_tags    ELSE watches_catalog.style_tags END,
      design_traits = CASE WHEN array_length(watches_catalog.design_traits, 1) IS NULL THEN EXCLUDED.design_traits ELSE watches_catalog.design_traits END,
      role_tags     = CASE WHEN array_length(watches_catalog.role_tags, 1)    IS NULL THEN EXCLUDED.role_tags     ELSE watches_catalog.role_tags END,
      complications = CASE WHEN array_length(watches_catalog.complications, 1) IS NULL THEN EXCLUDED.complications ELSE watches_catalog.complications END,
      updated_at = now()
    RETURNING id
  `)
  const rows = result as unknown as Array<{ id: string }>
  return rows[0]?.id ?? null
}
```

### Pattern 3: addWatch wiring (CAT-08)

```typescript
// src/app/actions/watches.ts — modify addWatch
import * as catalogDAL from '@/data/catalog'

export async function addWatch(data: unknown): Promise<ActionResult<Watch>> {
  // ... existing zod parse + auth ...

  try {
    const watch = await watchDAL.createWatch(user.id, parsed.data)

    // CAT-08 — catalog wiring (fire-and-forget; mirrors logActivity pattern)
    try {
      const catalogId = await catalogDAL.upsertCatalogFromUserInput({
        brand: parsed.data.brand,
        model: parsed.data.model,
        reference: parsed.data.reference ?? null,
      })
      if (catalogId) {
        await watchDAL.linkWatchToCatalog(watch.id, catalogId)
      }
    } catch (err) {
      console.error('[addWatch] catalog wiring failed (non-fatal):', err)
    }

    // ... existing activity + notification + revalidate ...
  } catch (err) {
    // ... existing error handling ...
  }
}
```

### Pattern 4: /api/extract-watch wiring (CAT-08)

```typescript
// src/app/api/extract-watch/route.ts — modify the POST handler
// AFTER successful extraction, BEFORE returning, fire catalog upsert (non-fatal).
//
// const result = await fetchAndExtract(url)
//
// try {
//   if (result.data.brand && result.data.model) {
//     await catalogDAL.upsertCatalogFromExtractedUrl({
//       brand: result.data.brand,
//       model: result.data.model,
//       reference: result.data.reference ?? null,
//       movement: result.data.movement ?? null,
//       caseSizeMm: result.data.caseSizeMm ?? null,
//       // ... map every extracted field ...
//       imageSourceUrl: url,  // page URL is the source
//       imageSourceQuality: 'unknown',  // v4.0 has no allowlist; v5+ tier-aware
//     })
//   }
// } catch (err) {
//   console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
// }
//
// return NextResponse.json({ success: true, ...result })
```

### Pattern 5: backfill script (CAT-05, D-14)

```typescript
// scripts/backfill-catalog.ts
// Usage: npm run db:backfill-catalog
// Idempotent — re-runs are no-ops once all watches are linked.
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db } from '@/db'
import { watches } from '@/db/schema'
import { sql } from 'drizzle-orm'

async function main() {
  const BATCH_SIZE = 100
  let totalLinked = 0
  let pass = 0

  while (true) {
    pass++
    const rows = await db.select({
      id: watches.id,
      brand: watches.brand,
      model: watches.model,
      reference: watches.reference,
    }).from(watches).where(sql`catalog_id IS NULL`).limit(BATCH_SIZE)

    if (rows.length === 0) break

    for (const row of rows) {
      // Inline the upsert+link as a single CTE for atomicity per row.
      await db.execute(sql`
        WITH ins AS (
          INSERT INTO watches_catalog (brand, model, reference, source)
          VALUES (${row.brand}, ${row.model}, ${row.reference}, 'user_promoted')
          ON CONFLICT ON CONSTRAINT watches_catalog_natural_key_idx DO NOTHING
          RETURNING id
        ),
        existing AS (
          SELECT id FROM watches_catalog
           WHERE brand_normalized = lower(trim(${row.brand}))
             AND model_normalized = lower(trim(${row.model}))
             AND reference_normalized IS NOT DISTINCT FROM (
               CASE WHEN ${row.reference}::text IS NULL THEN NULL
                    ELSE regexp_replace(lower(trim(${row.reference}::text)), '[^a-z0-9]+', '', 'g')
               END
             )
        )
        UPDATE watches SET catalog_id = COALESCE(
          (SELECT id FROM ins LIMIT 1),
          (SELECT id FROM existing LIMIT 1)
        )
        WHERE id = ${row.id}
      `)
      totalLinked++
    }

    console.log(`[backfill] pass ${pass}: linked ${rows.length} (cumulative ${totalLinked})`)
  }

  // Final assertion — zero unlinked rows
  const remaining = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM watches WHERE catalog_id IS NULL
  `)
  const count = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
  if (count !== 0) {
    // Log every unlinked row for human review per Pitfall 1 mitigation
    const unlinked = await db.select({
      id: watches.id, brand: watches.brand, model: watches.model, reference: watches.reference,
    }).from(watches).where(sql`catalog_id IS NULL`)
    console.error(`[backfill] FAILED — ${count} watches unlinked:`)
    console.table(unlinked)
    process.exit(1)
  }

  console.log(`[backfill] OK — total linked: ${totalLinked}, unlinked remaining: 0`)
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### Pattern 6: pg_cron refresh function (CAT-09)

```sql
-- supabase/migrations/20260427NNNNNN_phase17_pg_cron.sql
-- PROD-ONLY effects: the cron schedule. Local dev uses npm run db:refresh-counts.

BEGIN;

-- Extension is shipped on Supabase prod; local Docker may lack it.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The refresh function — recomputes counts AND inserts a daily snapshot.
-- D-15: snapshot row insert is idempotent on (catalog_id, date) UNIQUE.
CREATE OR REPLACE FUNCTION public.refresh_watches_catalog_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Recompute counts on watches_catalog
  UPDATE watches_catalog wc
  SET
    owners_count   = COALESCE(c.owned, 0),
    wishlist_count = COALESCE(c.wishlisted, 0),
    updated_at     = now()
  FROM (
    SELECT
      catalog_id,
      COUNT(*) FILTER (WHERE status IN ('owned','grail'))   AS owned,
      COUNT(*) FILTER (WHERE status = 'wishlist')            AS wishlisted
    FROM watches
    WHERE catalog_id IS NOT NULL
    GROUP BY catalog_id
  ) c
  WHERE wc.id = c.catalog_id;

  -- Reset rows that no longer have any watches linked (e.g. after deletes)
  UPDATE watches_catalog wc
  SET owners_count = 0, wishlist_count = 0, updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM watches w WHERE w.catalog_id = wc.id
  ) AND (wc.owners_count <> 0 OR wc.wishlist_count <> 0);

  -- Write a snapshot row per catalog row for today
  INSERT INTO watches_catalog_daily_snapshots
    (catalog_id, snapshot_date, owners_count, wishlist_count)
  SELECT id, current_date AT TIME ZONE 'UTC', owners_count, wishlist_count
    FROM watches_catalog
  ON CONFLICT (catalog_id, snapshot_date) DO UPDATE SET
    owners_count   = EXCLUDED.owners_count,
    wishlist_count = EXCLUDED.wishlist_count;
END
$$;

-- SECDEF lockdown — mirror Phase 11 pattern
REVOKE EXECUTE ON FUNCTION public.refresh_watches_catalog_counts()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_watches_catalog_counts()
  TO service_role;

-- Sanity assertion (Phase 11 pattern)
DO $$
DECLARE anon_can boolean; authed_can boolean; service_can boolean;
BEGIN
  SELECT has_function_privilege('anon',          'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO anon_can;
  SELECT has_function_privilege('authenticated', 'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO authed_can;
  SELECT has_function_privilege('service_role',  'public.refresh_watches_catalog_counts()', 'EXECUTE') INTO service_can;
  IF anon_can OR authed_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed — anon=%, authed=%', anon_can, authed_can;
  END IF;
  IF NOT service_can THEN
    RAISE EXCEPTION 'Phase 17 SECDEF guard failed — service_role missing EXECUTE';
  END IF;
END
$$;

-- Schedule daily at 03:00 UTC — guarded so local skips when pg_cron is absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule any prior version with the same name (idempotent re-run)
    PERFORM cron.unschedule('refresh_watches_catalog_counts_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_watches_catalog_counts_daily');
    PERFORM cron.schedule(
      'refresh_watches_catalog_counts_daily',
      '0 3 * * *',
      $cron$SELECT public.refresh_watches_catalog_counts()$cron$
    );
  END IF;
END
$$;

COMMIT;
```

### Pattern 7: local refresh-counts script (CAT-10, D-16)

```typescript
// scripts/refresh-counts.ts
// Usage: npm run db:refresh-counts
// Mirrors prod cron behavior — same SECDEF function.
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db } from '@/db'
import { sql } from 'drizzle-orm'

async function main() {
  // Calls the same function pg_cron calls in prod. service_role-only EXECUTE.
  await db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)
  console.log('[refresh-counts] OK — counts refreshed and snapshot row written')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### Pattern 8: Drizzle schema additions

```typescript
// src/db/schema.ts — additions
export const watchesCatalog = pgTable(
  'watches_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    brand: text('brand').notNull(),
    model: text('model').notNull(),
    reference: text('reference'),

    // Drizzle 0.45.2 supports generatedAlwaysAs (verified).
    // Note: If introspection produces unexpected DDL, drop these from the Drizzle
    //       definition and emit them via raw SQL only (per CONTEXT D-02 fallback).
    brandNormalized: text('brand_normalized').generatedAlwaysAs(
      sql`lower(trim(brand))`,
    ),
    modelNormalized: text('model_normalized').generatedAlwaysAs(
      sql`lower(trim(model))`,
    ),
    referenceNormalized: text('reference_normalized').generatedAlwaysAs(
      sql`CASE WHEN reference IS NULL THEN NULL ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g') END`,
    ),

    // CHECK constraint added in raw SQL migration (Drizzle pg-core CHECK is limited)
    source: text('source').notNull().default('user_promoted'),

    imageUrl: text('image_url'),
    imageSourceUrl: text('image_source_url'),
    imageSourceQuality: text('image_source_quality'),  // CHECK in raw SQL

    movement: text('movement'),
    caseSizeMm: real('case_size_mm'),
    lugToLugMm: real('lug_to_lug_mm'),
    waterResistanceM: integer('water_resistance_m'),
    crystalType: text('crystal_type'),
    dialColor: text('dial_color'),
    isChronometer: boolean('is_chronometer'),
    productionYear: integer('production_year'),
    productionYearIsEstimate: boolean('production_year_is_estimate').notNull().default(false),

    styleTags:    text('style_tags').array().notNull().default(sql`'{}'::text[]`),
    designTraits: text('design_traits').array().notNull().default(sql`'{}'::text[]`),
    roleTags:     text('role_tags').array().notNull().default(sql`'{}'::text[]`),
    complications: text('complications').array().notNull().default(sql`'{}'::text[]`),

    ownersCount:   integer('owners_count').notNull().default(0),
    wishlistCount: integer('wishlist_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  // Natural-key UNIQUE on the generated trio is in raw SQL (D-01 directive).
  // Trigram GIN indexes also raw SQL.
)

export const watchesCatalogDailySnapshots = pgTable(
  'watches_catalog_daily_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogId: uuid('catalog_id').notNull().references(() => watchesCatalog.id, { onDelete: 'cascade' }),
    snapshotDate: text('snapshot_date').notNull(),  // ISO date — matches existing wear_events.wornDate convention
    ownersCount: integer('owners_count').notNull(),
    wishlistCount: integer('wishlist_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watches_catalog_snapshots_unique_per_day').on(table.catalogId, table.snapshotDate),
    index('watches_catalog_snapshots_date_idx').on(table.snapshotDate, table.catalogId),
  ],
)

// Modify existing `watches` table — add catalogId column
// (in the same pgTable definition):
//   catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
```

### Pattern 9: CatalogSource TS literal union (D-04)

```typescript
// src/lib/types.ts — additions
export type CatalogSource = 'user_promoted' | 'url_extracted' | 'admin_curated'

export type ImageSourceQuality = 'official' | 'retailer' | 'unknown'

export interface CatalogEntry {
  id: string
  brand: string
  model: string
  reference: string | null
  source: CatalogSource
  imageUrl: string | null
  imageSourceUrl: string | null
  imageSourceQuality: ImageSourceQuality | null
  movement: string | null
  caseSizeMm: number | null
  lugToLugMm: number | null
  waterResistanceM: number | null
  crystalType: string | null
  dialColor: string | null
  isChronometer: boolean | null
  productionYear: number | null
  productionYearIsEstimate: boolean
  styleTags: string[]
  designTraits: string[]
  roleTags: string[]
  complications: string[]
  ownersCount: number
  wishlistCount: number
  createdAt: string
  updatedAt: string
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-user independent watch entries (no canonical catalog) | Canonical `watches_catalog` + nullable FK; per-user `watches` references it | v4.0 Phase 17 | Reverses v2.0 Key Decision; enables /search Watches and /explore. NOT a breaking change to existing rows because catalog_id is NULLABLE indefinitely |
| Postgres UNIQUE NULLS DISTINCT (default) | UNIQUE … NULLS NOT DISTINCT | Postgres 15+ (Supabase target since 2024) | Allows two `(Rolex, Submariner, NULL)` rows to dedup correctly |
| App-side normalization (`.toLowerCase()`) | Postgres GENERATED ALWAYS AS … STORED | Postgres 12+ (stored generated cols) | Bypassable-resistant; deterministic across all writers |
| Live AFTER INSERT triggers for denormalized counts | pg_cron daily batch + idempotent snapshot row | v4.0 Phase 17 | Avoids hot-path write amplification; "trending" is slow-moving so 24h staleness is fine |
| Drizzle `pgEnum` for catalog source | Text column + CHECK constraint | v4.0 Phase 17 | Avoids ALTER TYPE ADD/DROP VALUE pain (Pitfall 10 from PITFALLS.md / Phase 24); evolution = ALTER TABLE … DROP/ADD CONSTRAINT |
| Two-layer privacy (RLS + DAL WHERE) | Public-read RLS only; service-role-only writes | v4.0 Phase 17 (deliberate departure for THIS table only) | Documented as Key Decision in PROJECT.md when v4.0 ships |

**Deprecated/outdated:**
- v2.0 Key Decision "Per-user independent watch entries (no canonical watch table)" — explicitly reversed by Phase 17. Document the reversal in PROJECT.md Key Decisions when v4.0 ships.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres GENERATED columns are computed BEFORE UNIQUE constraint check fires | Pattern 7 / Pitfall 7 | Confidence is HIGH per Postgres docs but not verified against Supabase 15.x specifically in this session. Test in plan with the integration test `phase17-natural-key.test.ts` — covered. |
| A2 | `regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')` produces stable output for unicode references (e.g. accented chars in vintage Italian/German watches) | Pitfall 3 | Watches use ASCII references in 99% of cases. Patek `5711/1A` and Omega `311.30.42.30.01.005` test cases covered. Risk is low; if a vintage piece has e.g. accented "Réf" the normalization correctly strips to alphanumeric. |
| A3 | Drizzle 0.45.2 emits `GENERATED ALWAYS AS (expr) STORED` correctly for `generatedAlwaysAs(sql\`...\`)` | Pattern 1, Pattern 8 | Verified the API exists in `node_modules/drizzle-orm/pg-core/columns/common.d.ts:49`. Output DDL not inspected. Mitigation: plan-time experiment — run `drizzle-kit generate` against the proposed schema and inspect the generated SQL before pushing. If it doesn't emit correct DDL, drop the generated columns from the Drizzle definition and emit them via raw SQL only (the natural-key UNIQUE is already in raw SQL, so dropping these doesn't change the migration shape — they just become Drizzle-invisible columns whose existence is guaranteed by the Supabase migration). |
| A4 | Tag arrays should "only enrich if the catalog row's array is empty" rather than appending uniques | Pattern 2 | Plan-time decision. Alternative: `array_cat(catalog.array, EXCLUDED.array)` with deduplication. Picked the simpler "first non-empty wins" because Phase 17 is silent infrastructure and tag taxonomy audit is deferred — so we don't want URL-extract enrichment polluting a thoughtfully-curated tag list. If user feedback shows enrichment is too sparse, loosen in v4.x. |
| A5 | snapshot_date should be `text` (ISO date) like `wear_events.worn_date`, not `date` | Pattern 8 | Existing project convention favors ISO `text` for dates. UNIQUE on `(catalog_id, snapshot_date)` works for either type. Pin to `date` if the planner prefers — the cron function uses `current_date AT TIME ZONE 'UTC'` which returns `date` either way. |

**Confirm with user (suggested questions for the planner to surface during plan-time):**
1. Image source quality enum: ship as `CHECK (... IN ('official','retailer','unknown'))` or free-text? Recommended: CHECK enum (D-06 Claude's Discretion). Cheap to relax later via DROP/ADD CONSTRAINT.
2. Should the backfill script also enrich catalog tag arrays from per-user `watches` (where existing rows have non-empty styleTags)? Recommended: NO — backfill writes natural key only (mirrors D-05); URL-extract is the enrichment vector.
3. Is "00:00 UTC" or "03:00 UTC" the right cron time? D-15 specifies 03:00 UTC; confirmed with rationale "off-peak for US/EU/Asia".

## Open Questions

1. **Drizzle introspection of GENERATED columns + UNIQUE NULLS NOT DISTINCT in 0.45.2**
   - What we know: API supports both individually (`generatedAlwaysAs`, `unique().nullsNotDistinct()`). Verified in `.d.ts` files.
   - What's unclear: Whether `drizzle-kit generate` emits correct DDL when both are combined on a multi-column index over generated columns.
   - Recommendation: First task in the plan — run `drizzle-kit generate` against the proposed `watchesCatalog` schema and visually inspect the output. If introspection is wrong, drop the generated columns and unique index from Drizzle's definition entirely; the Supabase migration is authoritative. The Drizzle table can still type-infer the columns as plain `text` columns (with a comment noting they're DB-generated).

2. **Should `linkWatchToCatalog` be a separate DAL function or a parameter on `createWatch`?**
   - What we know: ARCHITECTURE.md notes both work (`src/data/watches.ts createWatch` could accept optional `catalogId`, OR a separate `linkWatchToCatalog(watchId, catalogId)`).
   - What's unclear: Which is more testable / readable.
   - Recommendation: Separate function `linkWatchToCatalog`. Keeps `createWatch` signature stable; aligns with fire-and-forget semantics (the linking step can fail independently and is logged separately).

3. **Where does `image_source_url` come from for URL-extracted rows?**
   - What we know: It's the URL the user pasted into `/api/extract-watch` (the page where the image was found, not the image asset URL itself per se).
   - What's unclear: If the extractor pulls the canonical image from a different domain than the page (e.g., page is `chrono24.com/listing/123`, image is hosted at `cdn.brand.com`), should `image_source_url` be the page URL or the image asset URL?
   - Recommendation: Page URL (the URL the user submitted). It's how a future admin can re-verify provenance. Image asset URL is what `image_url` holds.

## Environment Availability

> Phase 17 has external dependencies. Audit results below.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres 15+ | All migrations (NULLS NOT DISTINCT, generated cols) | ✓ | Supabase prod ships 15.x; local Docker 15.x | — |
| `pg_trgm` extension | CAT-03 GIN indexes | ✓ | Already enabled by Phase 11 | — |
| `pg_cron` extension | CAT-09 daily refresh | ✓ (prod), ✗ (local Docker default) | Supabase prod ships pg_cron; vanilla local Docker may not | `npm run db:refresh-counts` manual script (D-16, CAT-10) |
| Drizzle 0.45.2 `generatedAlwaysAs()` | Schema definitions | ✓ | Verified `[node_modules/drizzle-orm/pg-core/columns/common.d.ts:49]` | If introspection emits bad DDL, fall back to raw SQL for generated columns only |
| Drizzle 0.45.2 `unique().nullsNotDistinct()` | Type-level affirmation | ✓ | Verified `[node_modules/drizzle-orm/pg-core/unique-constraint.d.ts:22]` | Natural-key UNIQUE is in raw SQL regardless (D-01) |
| Service-role `DATABASE_URL` | Backfill, refresh-counts scripts, Server Actions writing catalog | ✓ | Already in `.env.local` | — |
| Vitest + service-role DB | Integration tests | ✓ | Project standard `[VERIFIED: vitest.config.ts]`; `DATABASE_URL`-gated tests pattern proven in `tests/integration/phase11-pg-trgm.test.ts` | Tests skip cleanly when DATABASE_URL unset |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `pg_cron` locally — handled by `npm run db:refresh-counts`. The pg_cron migration uses a `DO $$ ... END $$` guard so `supabase db reset` against a Docker without pg_cron will succeed (the schedule simply isn't created locally; the function still exists and is invocable via the manual script).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.x with `@testing-library/react` 16.3.x and MSW 2.13.x `[VERIFIED: package.json:devDependencies]` |
| Config file | `vitest.config.ts` `[VERIFIED: vitest.config.ts:1-22]` |
| Quick run command | `npm test -- tests/integration/phase17-*.test.ts` (or per-file: `npm test -- tests/integration/phase17-natural-key.test.ts`) |
| Full suite command | `npm test` (runs all tests; `vitest run` under the hood) |
| DB-gated pattern | `const maybe = process.env.DATABASE_URL ? describe : describe.skip` — established in `tests/integration/phase11-pg-trgm.test.ts:23` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | watches_catalog table has surrogate UUID PK + natural-key UNIQUE on normalized trio | integration | `npm test -- tests/integration/phase17-schema.test.ts -t "natural-key"` | ❌ Wave 0 |
| CAT-01 | NULLS NOT DISTINCT — two `(Rolex, Submariner, NULL)` rows dedup; not three rows | integration | `npm test -- tests/integration/phase17-natural-key.test.ts -t "nulls collide"` | ❌ Wave 0 |
| CAT-01 | Casing-different inputs ("Rolex"/"ROLEX"/"rolex") collapse to one catalog row | integration | `npm test -- tests/integration/phase17-natural-key.test.ts -t "casing collapse"` | ❌ Wave 0 |
| CAT-01 | Reference punctuation drift ("116610LN"/"116610 LN"/"116610-LN") collapses to one row | integration | `npm test -- tests/integration/phase17-natural-key.test.ts -t "reference normalization"` | ❌ Wave 0 |
| CAT-02 | Anon Supabase JS client SELECT on watches_catalog returns rows after seed | integration | `npm test -- tests/integration/phase17-catalog-rls.test.ts -t "anon can SELECT"` | ❌ Wave 0 |
| CAT-02 | Anon INSERT/UPDATE/DELETE on watches_catalog fails with RLS error | integration | `npm test -- tests/integration/phase17-catalog-rls.test.ts -t "anon write blocked"` | ❌ Wave 0 |
| CAT-03 | pg_trgm GIN indexes exist on `brand` and `model` (and use `extensions.gin_trgm_ops`) | integration | `npm test -- tests/integration/phase17-schema.test.ts -t "trgm indexes"` | ❌ Wave 0 |
| CAT-03 | EXPLAIN with `enable_seqscan = OFF` shows `Bitmap Index Scan` on `watches_catalog_brand_trgm_idx` | integration | `npm test -- tests/integration/phase17-schema.test.ts -t "trgm planner reachability"` | ❌ Wave 0 |
| CAT-04 | `watches.catalog_id` column exists, nullable, with `ON DELETE SET NULL` referencing `watches_catalog(id)` | integration | `npm test -- tests/integration/phase17-schema.test.ts -t "watches.catalog_id FK"` | ❌ Wave 0 |
| CAT-05 | Backfill script: re-run after success is a no-op (zero new inserts; final unlinked count = 0) | integration | `npm test -- tests/integration/phase17-backfill-idempotency.test.ts` | ❌ Wave 0 |
| CAT-05 | Backfill script: zero-unlinked assertion fails loudly when a row can't be linked | integration | `npm test -- tests/integration/phase17-backfill-idempotency.test.ts -t "zero unlinked"` | ❌ Wave 0 |
| CAT-06 | `upsertCatalogFromUserInput`: writes natural key only; spec columns NULL after first call | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "user input writes natural key only"` | ❌ Wave 0 |
| CAT-06 | `upsertCatalogFromUserInput`: second call with same natural key + different brand is a no-op (DO NOTHING) | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "user input does nothing on conflict"` | ❌ Wave 0 |
| CAT-07 | `upsertCatalogFromExtractedUrl`: enriches NULL spec columns via COALESCE on conflict | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "url extract enriches"` | ❌ Wave 0 |
| CAT-07 | `upsertCatalogFromExtractedUrl`: never overwrites non-null spec columns (D-13 first-non-null wins) | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "url extract does not overwrite"` | ❌ Wave 0 |
| CAT-07 | `upsertCatalogFromExtractedUrl`: source upgrades user_promoted → url_extracted | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "source upgrade"` | ❌ Wave 0 |
| CAT-07 | `upsertCatalogFromExtractedUrl`: never overwrites `admin_curated` source (CASE-guard) | integration | `npm test -- tests/integration/phase17-upsert-coalesce.test.ts -t "admin_curated locked"` | ❌ Wave 0 |
| CAT-08 | `addWatch` Server Action populates `watches.catalog_id` after success (non-fatal if catalog fails) | integration | `npm test -- tests/integration/phase17-addwatch-wiring.test.ts` | ❌ Wave 0 |
| CAT-08 | `addWatch` succeeds even when catalog upsert throws (mocked) — fire-and-forget | unit | `npm test -- tests/actions/addwatch-catalog-resilience.test.ts` | ❌ Wave 0 |
| CAT-08 | `/api/extract-watch` calls `upsertCatalogFromExtractedUrl` after successful extraction | integration | `npm test -- tests/integration/phase17-extract-route-wiring.test.ts` | ❌ Wave 0 |
| CAT-09 | `refresh_watches_catalog_counts()` function exists, is SECURITY DEFINER, anon/authenticated cannot EXECUTE | integration | `npm test -- tests/integration/phase17-secdef.test.ts -t "secdef permissions"` | ❌ Wave 0 |
| CAT-09 | `refresh_watches_catalog_counts()` correctly recomputes owners_count + wishlist_count from watches | integration | `npm test -- tests/integration/phase17-refresh-counts.test.ts -t "refresh counts"` | ❌ Wave 0 |
| CAT-09 | pg_cron job exists in prod with name `refresh_watches_catalog_counts_daily`, schedule `0 3 * * *` | integration / manual | `npm test -- tests/integration/phase17-secdef.test.ts -t "cron job scheduled"` (DATABASE_URL must point at Supabase prod for this assertion; otherwise skip with note) | ❌ Wave 0 |
| CAT-10 | `npm run db:refresh-counts` calls the same function and writes a snapshot row | integration | `npm test -- tests/integration/phase17-refresh-counts.test.ts -t "snapshot written"` | ❌ Wave 0 |
| CAT-10 | `db:refresh-counts` second invocation same day is idempotent (UNIQUE on `(catalog_id, snapshot_date)`) | integration | `npm test -- tests/integration/phase17-refresh-counts.test.ts -t "snapshot idempotent"` | ❌ Wave 0 |
| CAT-11 | (Compile-time) — JOIN shape works for downstream phases (no Phase 17 surface, but a query test asserts `watches LEFT JOIN watches_catalog ON watches.catalog_id = watches_catalog.id` returns expected columns) | integration | `npm test -- tests/integration/phase17-join-shape.test.ts` | ❌ Wave 0 |
| CAT-12 | `watches_catalog_daily_snapshots` table exists with UNIQUE on `(catalog_id, snapshot_date)` | integration | `npm test -- tests/integration/phase17-schema.test.ts -t "snapshots table"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/integration/phase17-{file}.test.ts` (the file most relevant to the task)
- **Per wave merge:** `npm test -- tests/integration/phase17-*.test.ts` (all phase 17 integration tests)
- **Phase gate:** `npm test` (full suite) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase17-schema.test.ts` — natural-key UNIQUE existence; trgm indexes existence; `watches.catalog_id` FK shape; snapshots table + UNIQUE; CHECK constraints; covers CAT-01 (structural), CAT-03, CAT-04, CAT-12
- [ ] `tests/integration/phase17-natural-key.test.ts` — NULLS NOT DISTINCT dedup; casing collapse; reference normalization (covers CAT-01 behavior)
- [ ] `tests/integration/phase17-catalog-rls.test.ts` — anon SELECT works; anon write blocked (covers CAT-02). MUST use anon Supabase JS client (not the service-role Drizzle `db`); reference Phase 11 storage RLS test pattern.
- [ ] `tests/integration/phase17-upsert-coalesce.test.ts` — DO NOTHING (CAT-06) and DO UPDATE COALESCE (CAT-07) semantics; source upgrade; admin_curated guard
- [ ] `tests/integration/phase17-backfill-idempotency.test.ts` — re-run no-op; zero-unlinked assertion (CAT-05)
- [ ] `tests/integration/phase17-addwatch-wiring.test.ts` — addWatch populates catalog_id (CAT-08)
- [ ] `tests/integration/phase17-extract-route-wiring.test.ts` — /api/extract-watch populates catalog (CAT-08)
- [ ] `tests/integration/phase17-secdef.test.ts` — SECDEF permissions, cron job existence (CAT-09)
- [ ] `tests/integration/phase17-refresh-counts.test.ts` — function recomputes counts; snapshot writes; idempotency (CAT-09, CAT-10)
- [ ] `tests/integration/phase17-join-shape.test.ts` — `watches LEFT JOIN watches_catalog` returns expected columns (CAT-11 forward-compat for Phase 19/20)
- [ ] `tests/actions/addwatch-catalog-resilience.test.ts` — addWatch resilience to catalog upsert failure (CAT-08 fire-and-forget); mocked DAL

**Framework install:** Already present (`vitest@^2.1.9`, `@testing-library/react@^16.3.2`, `msw@^2.13.2`). No install needed.

**No Wave 0 framework gaps:** test infrastructure is mature. All gaps are net-new test files for Phase 17 requirements.

## Sources

### Primary (HIGH confidence)

- **`.planning/phases/17-catalog-foundation/17-CONTEXT.md`** — locked decisions D-01 through D-17, Claude's Discretion items, deferred ideas
- **`.planning/REQUIREMENTS.md` lines 13-25** — CAT-01 through CAT-12 requirements verbatim
- **`.planning/research/ARCHITECTURE.md` lines 70-301** — `watches_catalog` table sketch, RLS posture, backfill flow, pg_cron migration
- **`.planning/research/PITFALLS.md` lines 23-345** — Pitfalls #1-#6, #10, #11, #17, #18 (catalog-relevant)
- **`.planning/research/STACK.md` lines 109-243** — natural-key UNIQUE design, NULLS NOT DISTINCT reference, generated-column normalization, RLS posture, ripple effects on similarity
- **`supabase/migrations/20260423000003_phase11_pg_trgm.sql`** — verified pg_trgm pattern (extensions schema, GIN with gin_trgm_ops opclass)
- **`supabase/migrations/20260423000005_phase11_debt02_audit.sql`** — verified RLS audit assertion pattern
- **`supabase/migrations/20260423000045_phase11_storage_rls_secdef_fix.sql`** — verified SECURITY DEFINER + revoke pattern
- **`supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql`** — verified `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated/service_role` pattern with sanity assertion
- **`src/db/schema.ts`** — existing column shape conventions (snake_case, defaults, types)
- **`src/data/profiles.ts`** — DAL pattern (`server-only` import, `db.execute`, `db.select`, `inArray` anti-N+1)
- **`src/app/actions/watches.ts`** — addWatch Server Action shape, fire-and-forget pattern from `logActivity` / `logNotification`
- **`src/app/api/extract-watch/route.ts`** — extract route handler shape
- **`src/lib/extractors/index.ts`** — `extractWatchData()` and `fetchAndExtract()` API
- **`tests/integration/phase11-pg-trgm.test.ts`** — Vitest DB-gated test pattern (`maybe = DATABASE_URL ? describe : describe.skip`)
- **`node_modules/drizzle-orm/pg-core/columns/common.d.ts:49`** — `generatedAlwaysAs` API verified at v0.45.2
- **`node_modules/drizzle-orm/pg-core/unique-constraint.d.ts:10,22`** — `nullsNotDistinct()` API verified at v0.45.2
- **MEMORY: `project_drizzle_supabase_db_mismatch.md`** — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked --include-all`
- **MEMORY: `project_supabase_secdef_grants.md`** — REVOKE FROM PUBLIC alone insufficient; explicit anon + authenticated revokes required
- **MEMORY: `project_local_db_reset.md`** — supabase db reset workflow

### Secondary (MEDIUM confidence)

- **`.planning/research/SUMMARY.md` lines 86-105** — milestone-level pitfall summary, confidence assessment
- **`.planning/PROJECT.md` Key Decisions table** — v2.0 "Per-user independent watch entries" reversal context

### Tertiary (LOW confidence)

- Postgres docs claim about GENERATED columns evaluation order — well-documented behavior but not re-verified in this session against Supabase 15.x specifically. Mitigation: integration test `phase17-natural-key.test.ts` covers the actual behavior.
- Tag-array enrichment policy ("only enrich if catalog array is empty" vs `array_cat` dedup) — opinionated plan-time choice; alternative documented in Assumptions Log A4.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in tree; versions verified against `node_modules/`; no new installs
- Architecture: HIGH — every locked decision in CONTEXT.md maps to a Postgres-native primitive (generated columns, NULLS NOT DISTINCT, COALESCE upsert, SECDEF + pg_cron, CHECK constraint). Existing v3.0 patterns (Phase 11 RLS, Phase 13 fire-and-forget) generalize cleanly.
- Pitfalls: HIGH — all major pitfalls catalogued in `.planning/research/PITFALLS.md` are addressed by either CONTEXT.md decisions or this RESEARCH.md mitigations.
- Validation Architecture: HIGH — DB-gated Vitest pattern proven in Phase 11; 11 net-new test files cover every CAT-NN requirement at the right granularity.
- Drizzle introspection of generated cols + UNIQUE NULLS NOT DISTINCT combined: MEDIUM — APIs exist independently; combined output not verified. Mitigation: experiment first, fall back to raw SQL if needed.

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30-day estimate — Postgres + Drizzle + Supabase patterns are stable; pg_cron / SECDEF posture unchanged since Phase 11)
