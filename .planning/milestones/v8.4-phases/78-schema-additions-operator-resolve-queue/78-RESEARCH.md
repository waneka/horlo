# Phase 78: Schema Additions + Operator-Resolve Queue — Research

**Researched:** 2026-06-24
**Domain:** Postgres additive schema migration + read-only TypeScript dry-run script (markdown artifact output)
**Confidence:** HIGH

## RESEARCH COMPLETE

## Summary

Phase 78 is a low-blast-radius, two-deliverable phase: (1) an additive Supabase SQL migration that adds three columns + one GIN index across two tables, and (2) a read-only `tsx` script that emits a GFM-table markdown artifact for operator review. Every CONTEXT.md decision (D-78-01..08) has clean precedent in the codebase — the migration pattern from `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` and the script pattern from `scripts/inventory-explore-catalog.ts` (markdown output) and `scripts/backfill-catalog-brands.ts` (drizzle `db.execute` with `sql\`...\``).

**Primary recommendation:** Hand-write `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` (additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS ... USING gin (aliases)` with default `array_ops` — no `gin_trgm_ops`, no `f_unaccent` wrapper needed because aliases are exact-string by D-decision); also drop a sibling `drizzle/*.sql` shape sync. Build `scripts/v8.4-brand-canonicalization.ts` by copying the env-bootstrap from `scripts/inventory-explore-catalog.ts` (or the `--env-file=.env.local` npm-script pattern from `scripts/backfill-catalog-brands.ts`) — connect via `postgres` lib + service-role `DATABASE_URL`, query for distinct `lower(trim(watches_catalog.brand))` and `LEFT JOIN brands ON ... = name_normalized`, run pg_trgm `word_similarity` for candidates (qualified as `extensions.word_similarity` because the script connection does not inherit migration-time search_path), and emit a GFM table with refuse-to-overwrite guard + `--regenerate` merge-forward.

> **Blocking risk flagged in Q2 / Q4:** Two of the user-supplied research questions ask whether `extensions.unaccent` is even needed in the schema migration, and whether `word_similarity` calls from TypeScript need the `extensions.` prefix. Short answers: **(Q2)** No — the Phase 78 SQL migration does not reference any extension function and therefore does not need `f_unaccent` / `SET search_path` on any helper. The portability requirement (success criterion #4) reduces to filename + ordering convention and additive column shape. **(Q4)** Yes — the TypeScript dry-run script's pg_trgm calls SHOULD be schema-qualified as `extensions.word_similarity(...)` because the script's `postgres`-lib connection does not run a migration-time `SET search_path` (and the existing DAL relies on baked-in index-OID resolution, not on session search_path).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANON-03 | `watch_families.aliases text[] NOT NULL DEFAULT '{}'` + GIN containment index | Q1 (GIN syntax), Q3 (Drizzle ADD COLUMN semantics) |
| CANON-04 | `brands.needs_review` + `watch_families.needs_review` boolean columns | Q3 (boolean default semantics + locking) |
| MIG-01 | Dry-run script writes `.planning/v8.4-brand-merge-decisions.md` (no `--apply`) | Q4 (pg_trgm from TS), Q5 (script pattern), Q6 (artifact format), Q9 (data shape), Q10 (lookup query) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Additive column DDL (aliases, needs_review × 2) | Database / Storage | — | Schema lives in Postgres; Drizzle definition is a mirror for type-safety |
| GIN containment index on `aliases` | Database / Storage | — | Index is purely a planner concern; consumed by Phase 80 `@>` lookups |
| Distinct-brand enumeration + JOIN-against-`brands` | Database / Storage | Script (Node) | Postgres `SELECT DISTINCT lower(trim(brand))` does the heavy lift; script formats |
| Fuzzy candidate scoring (top 3, ≥0.5) | Database / Storage | Script (Node) | `extensions.word_similarity` runs IN-database; script materializes top-K |
| GFM-table markdown emission | Script (Node) | Filesystem | `node:fs/promises` writeFile (matches `factual-apply.ts:307`) |
| Refuse-to-overwrite + `--regenerate` merge-forward | Script (Node) | — | `existsSync` guard before write; merge logic parses existing file |
| Operator review surface (.md editing) | Editor (human) | — | Off-system; D-78-01 chose GFM specifically because GFM is editor-fluent |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Operator-Resolve `.md` Artifact Format:**
- **D-78-01: GFM table is the on-disk format.** Single GitHub-Flavored Markdown table with columns `brand_raw | normalized | proposed_target_id | status | candidates / notes`. One row per distinct `lower(trim(watches_catalog.brand))` value. Familiar editor surface, search/replace-friendly, parseable by any GFM table parser.
- **D-78-02: `status` cell grammar uses explicit prefix tokens.** Phase 79's parser accepts exactly: `auto-resolved` · `merge:<uuid>` · `new` · `skip` · `needs-review`. Any other value causes Phase 79 to refuse `--apply`.
- **D-78-03: `candidates / notes` column carries top 3 fuzzy candidates ≥0.5.** Format: `hamilton (0.85), hamilton-khaki (0.62)`. Empty value = no candidates above 0.5; operator should treat as a `new` proposal.

**Auto-Resolve Aggressiveness:**
- **D-78-04: Exact-only auto-resolve.** A row is written with `status: auto-resolved` ONLY when `lower(trim(brand_raw))` exactly equals some existing `brands.name_normalized`. Every fuzzy candidate (any similarity threshold, including ≥0.6 — the INGEST threshold) goes to `status: needs-review`.
- **D-78-05: The dry-run never writes to the DB.** No INSERT/UPDATE/DELETE; reads only. Produces only the `.md` artifact.

**Script Runtime Contract:**
- **D-78-06: Service-role + `DATABASE_URL`, works against both envs.** Reuses the `tsx scripts/<name>.ts` pattern (analog: `scripts/inventory-explore-catalog.ts`). Service-role bypasses RLS so reads see every catalog row.
- **D-78-07: Idempotent re-run via refuse-to-overwrite + `--regenerate` merge-forward.** If artifact exists, default run exits non-zero with `--regenerate` hint. `--regenerate` rewrites file by merging: any `brand_raw` with non-`needs-review` status preserved verbatim; new rows appended at bottom with `status: needs-review`.

**Aliases Seeding:**
- **D-78-08: Phase 78 ships `aliases` empty; Phase 79's `--apply` populates them.**

### Claude's Discretion
- GIN index design (plain `USING GIN (aliases)` for `@>` is the standard answer; no trigram GIN needed because aliases are exact-string mapping by design)
- `needs_review` retroactive flagging (existing rows backfill to `false`; Phase 79 may flip specific rows true)
- Drizzle codegen vs hand-written `.sql` (hand-written `.sql` is the answer per `[[drizzle-supabase-db-mismatch]]`)
- `brand_id` column on `watches_catalog` (already exists from Phase 34; Phase 78 does NOT touch it)

### Deferred Ideas (OUT OF SCOPE)
- Functional GIN / trigram GIN on `aliases` (aliases are exact-string by design; fuzzy is upstream)
- Retroactive `needs_review: true` on existing brand rows (Phase 79's operator decision)
- Pre-seeding SEED-021-cited aliases in the schema migration (rejected per D-78-08)
- Local-only refusal to run against prod (rejected per D-78-06)
- Generic `--mode=brands|families` flag (Phase 79 adds families)

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement in Phase 78 |
|-----------|-------------------------|
| **Local-First Development** — verify in `npm run dev` against local Supabase before pushing prod | A schema-additions phase verifies via `supabase db push` (local) + `\d brands` + `\d watch_families` introspection + running the dry-run script against the seeded local catalog — NOT `npm run dev` clicking. See **Validation Architecture** below for the codified sequence. |
| **AGENTS.md — Next 16 has breaking changes, read `node_modules/next/dist/docs/`** | N/A for Phase 78 (no app-router code, no rendering, no server actions). |
| **GSD Workflow Enforcement — no direct repo edits outside a GSD command** | Phase 78 will be executed via `/gsd-plan-phase 78` → `/gsd-execute-phase`. |
| **`workflow.use_worktrees: false`** (already set globally per `[[next-clear-operational-debt]]`) | Phase 78 is DB-touching; worktrees disabled. |

## Standard Stack

### Core (already in `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `^0.45.2` | Schema definitions in `src/db/schema.ts`; `sql\`...\`` template literal | Existing project standard; sibling Drizzle SQL files in `drizzle/` mirror `supabase/migrations/` per `[[drizzle-supabase-db-mismatch]]` |
| `drizzle-kit` | `^0.31.10` | Local-only schema sync (`drizzle-kit push`) | Existing project standard; prod uses `supabase db push --linked` instead |
| `postgres` | `^3.4.9` | Direct `postgres` lib client (used in `scripts/inventory-explore-catalog.ts:16`) | Standard `tsx` script connection; `{ prepare: false }` required for Supabase pooler |
| `tsx` | (devDep) | Run `.ts` scripts without compile step | Existing standard — every `scripts/*.ts` runs via `tsx` (see `package.json` scripts L13-31) |
| `node:fs` / `node:fs/promises` | (built-in) | `existsSync`, `readFile`, `writeFile` for artifact I/O | Used in `scripts/factual-apply.ts:25-27`, `scripts/inventory-explore-catalog.ts:14` |

### Supporting (existing infrastructure, no new deps)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `extensions.pg_trgm` | (Postgres ext) | `word_similarity()` for fuzzy candidate scoring | Already installed local+prod via `20260623200000_quick_260623_uua_search_unaccent_trgm.sql` |
| `extensions.unaccent` + `public.f_unaccent(text)` | (Postgres ext + wrapper) | Diacritic folding for `Héron` vs `Heron` match | **Optional for Phase 78** — D-78-04 is exact-only auto-resolve. Use `lower(trim(brand))` against `name_normalized` (already lower-trimmed via GENERATED column). For fuzzy candidate scoring, recommend wrapping in `lower(public.f_unaccent(...))` so `Héron` and `Heron` produce the same score. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written line-based GFM parser (for Phase 79) | `remark` + `remark-gfm` | New dep; ~50KB; phase 79 only needs split-on-`\|` + trim — line parser is ~20 LOC. Recommendation: hand-roll the parser (Phase 79's concern; Phase 78 just emits a stable format). |
| `extensions.similarity` (whole-string) | `extensions.word_similarity` (best contiguous substring) | `word_similarity` is the project-standard per memory `[[pg-trgm-word-similarity-for-brand-typos]]`; documented in `src/data/catalog.ts:516-528` with empirical thresholds. Use `word_similarity`. |
| `drizzle-kit push` for prod | Hand-written `supabase/migrations/*.sql` + `supabase db push --linked` | drizzle-kit push is LOCAL ONLY per `[[drizzle-supabase-db-mismatch]]`; doing prod via drizzle-kit is a memory-cited footgun (silently lost `watches_catalog_natural_key` UNIQUE per `[[local-catalog-natural-key-drift]]`). |
| Markdown output via `react-markdown` AST | String concatenation (`lines.push(...)`) | `react-markdown` is for RENDERING, not generation; `inventory-explore-catalog.ts:128-184` already shows the line-array pattern. Use that. |

**Installation:** no new dependencies needed.

**Version verification:** all dependencies are already in `package.json` at versions verified during prior phases (`postgres@^3.4.9`, `drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.10`). No `npm view` calls needed.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌────────────────────────────────────────────────┐
                  │   Phase 78 Migration (additive DDL)            │
                  │                                                │
   supabase CLI ─►│   supabase/migrations/                         │
   (linked)       │     20260624000000_phase78_aliases_needs_      │
                  │       review.sql                               │
                  │                                                │
                  │   ┌──────────────┐  ┌──────────────────────┐  │
                  │   │ ALTER TABLE  │  │ ALTER TABLE          │  │
                  │   │   brands     │  │   watch_families     │  │
                  │   │   ADD needs_ │  │   ADD aliases text[] │  │
                  │   │   review     │  │   ADD needs_review   │  │
                  │   └──────────────┘  └──────────────────────┘  │
                  │                              │                 │
                  │                              ▼                 │
                  │                     CREATE INDEX GIN(aliases)  │
                  │                                                │
                  │   DO $$ ASSERT ... (column existence, generated │
                  │                     vs concrete, default values)│
                  └────────────────────────────────────────────────┘
                                       │
                                       ▼
                  ┌────────────────────────────────────────────────┐
                  │   Drizzle shape sync (LOCAL ONLY)              │
                  │     drizzle/0014_phase78_aliases_needs_review  │
                  │       .sql  (additive ADD COLUMN; mirror only) │
                  │     src/db/schema.ts (aliases, needsReview)    │
                  └────────────────────────────────────────────────┘

  ────────────────────────────────────────────────────────────────────

   Phase 78 Dry-Run Script (read-only)

   Operator                            scripts/v8.4-brand-canonicalization.ts
       │                                              │
       │ DATABASE_URL=postgresql://...                │
       │ npm run db:v8.4-brand-canon                  │
       ▼                                              ▼
   ┌────────────────┐    ┌──────────────────────────────────────────┐
   │ check artifact │───►│ existsSync(.planning/v8.4-brand-merge-   │
   │     exists?    │    │   decisions.md)                          │
   └────────────────┘    └──────────────────────────────────────────┘
                                              │
                                YES ─────►  exit 1 unless --regenerate
                                NO ──────►  fresh write
                                              │
                                              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ postgres({prepare:false}) → service-role DB                  │
   │                                                              │
   │ Stage 1: SELECT DISTINCT lower(trim(brand)) AS brand_raw     │
   │            FROM watches_catalog                              │
   │                                                              │
   │ Stage 2: LEFT JOIN brands ON brand_raw = name_normalized     │
   │            → proposed_target_id (NULL on miss)               │
   │                                                              │
   │ Stage 3: For each row WHERE proposed_target_id IS NULL,      │
   │            top 3 candidates via                              │
   │            extensions.word_similarity(brand_raw,             │
   │              name_normalized) > 0.5                          │
   │                                                              │
   │ Stage 4: classify status:                                    │
   │            - exact JOIN hit → 'auto-resolved'                │
   │            - no hit         → 'needs-review' (D-78-04)       │
   └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ If --regenerate: parse existing .md, preserve non-           │
   │   'needs-review' rows verbatim; append new rows at bottom    │
   │                                                              │
   │ Emit GFM table:                                              │
   │   | brand_raw | normalized | proposed_target_id |            │
   │   | status | candidates / notes |                            │
   └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ writeFile(.planning/v8.4-brand-merge-decisions.md, ...)      │
   └──────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                                       Operator opens .md,
                                       edits status cells,
                                       saves. Phase 79 consumes.
```

### Recommended Project Structure (additions only)
```
horlo/
├── supabase/migrations/
│   └── 20260624000000_phase78_aliases_needs_review.sql   # NEW (additive DDL)
├── drizzle/
│   └── 0014_phase78_aliases_needs_review.sql             # NEW (local shape sync only)
├── src/db/schema.ts                                       # EDIT: add aliases + needs_review × 2
├── scripts/
│   └── v8.4-brand-canonicalization.ts                    # NEW (dry-run + --regenerate)
├── tests/integration/
│   └── phase78-schema.test.ts                            # NEW (DB-gated; matches archetype-drop idiom)
├── tests/static/
│   └── phase78-schema-shape.test.ts                      # NEW (text grep on schema.ts + migration filename)
└── .planning/
    └── v8.4-brand-merge-decisions.md                     # GENERATED by dry-run (gitignored or committed — decide in plan)
```

### Pattern 1: Hand-Written Additive Migration With Post-Flight Assertion
**What:** Append-only `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + idempotent index create + DO $$ assertion block.
**When to use:** Every schema change post-Phase-17 per `[[drizzle-supabase-db-mismatch]]`. Drizzle's sibling SQL is shape-only / local-only.
**Example:** (source: `supabase/migrations/20260510000000_phase34_brands_families.sql:64-99`)
```sql
-- supabase/migrations/20260624000000_phase78_aliases_needs_review.sql
-- Phase 78 — Schema Additions for v8.4 (CANON-03, CANON-04)
-- Sibling Drizzle migration: drizzle/0014_phase78_aliases_needs_review.sql (shape only)
-- Apply to prod: supabase db push --linked
-- Threats mitigated: none new (additive; existing RLS on brands + watch_families intact)

BEGIN;

-- 1. CANON-04 — needs_review boolean on brands
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 2. CANON-04 — needs_review boolean on watch_families
ALTER TABLE watch_families
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 3. CANON-03 — aliases text[] on watch_families (Phase 78 ships EMPTY per D-78-08)
ALTER TABLE watch_families
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- 4. CANON-03 — GIN containment index on aliases
-- Plain GIN with default array_ops opclass supports @> (strategy 2).
-- NOT gin_trgm_ops (that's for ILIKE/similarity on a SINGLE text column).
-- Aliases are exact-string mapping by design (D-78-decision context); no trigram needed.
CREATE INDEX IF NOT EXISTS watch_families_aliases_gin_idx
  ON watch_families USING GIN (aliases);

-- 5. Post-flight assertion. Phrased with a DIFFERENT predicate from the DDL above
--    per [[post-flight-assertion-predicate-divergence]]. We check pg_attribute /
--    pg_index for the resulting state, not re-mirror the ALTER TABLE we just ran.
DO $$
DECLARE
  brands_needs_review_default text;
  families_needs_review_default text;
  aliases_default text;
  aliases_not_null boolean;
  gin_idx_exists boolean;
BEGIN
  SELECT column_default
    INTO brands_needs_review_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'brands'
     AND column_name = 'needs_review';

  SELECT column_default
    INTO families_needs_review_default
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'watch_families'
     AND column_name = 'needs_review';

  SELECT column_default, NOT is_nullable::boolean
    INTO aliases_default, aliases_not_null
    FROM (SELECT column_default,
                 CASE WHEN is_nullable = 'NO' THEN 'true' ELSE 'false' END AS is_nullable
            FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'watch_families'
             AND column_name = 'aliases') sub;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'watch_families_aliases_gin_idx'
  ) INTO gin_idx_exists;

  IF brands_needs_review_default IS NULL OR brands_needs_review_default NOT LIKE 'false%' THEN
    RAISE EXCEPTION 'Phase 78 failed — brands.needs_review default not "false" (got: %)', brands_needs_review_default;
  END IF;
  IF families_needs_review_default IS NULL OR families_needs_review_default NOT LIKE 'false%' THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.needs_review default not "false" (got: %)', families_needs_review_default;
  END IF;
  IF aliases_default IS NULL OR aliases_default NOT LIKE '%''{}''%' THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.aliases default not "{}" (got: %)', aliases_default;
  END IF;
  IF NOT aliases_not_null THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families.aliases is nullable (must be NOT NULL)';
  END IF;
  IF NOT gin_idx_exists THEN
    RAISE EXCEPTION 'Phase 78 failed — watch_families_aliases_gin_idx missing';
  END IF;
END $$;

COMMIT;
```

**Note: NO extension function reference.** Phase 78's migration does not call `unaccent()`, `f_unaccent()`, `similarity()`, or `word_similarity()`. The `extensions` schema portability requirement (success criterion #4) reduces to filename + ordering convention here. See Q2 below.

### Pattern 2: Drizzle Schema Edit (Mirror of SQL Migration)
**What:** Add column definitions to `src/db/schema.ts` so DAL queries are type-safe.
**When to use:** Every schema change — keeps `db.select({ ... })` queries compile-time correct.
**Example:** (source: `src/db/schema.ts:518-555`, with Phase 78 additions inline)
```ts
// src/db/schema.ts — brands (L518–535) + needs_review
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
    // Phase 78 CANON-04 — operator review queue flag
    needsReview: boolean('needs_review').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('brands_name_normalized_unique').on(table.nameNormalized),
  ],
)

// src/db/schema.ts — watch_families (L537–555) + aliases + needs_review
export const watchFamilies = pgTable(
  'watch_families',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').generatedAlwaysAs(
      sql`lower(trim(name))`,
    ),
    slug: text('slug'),
    // Phase 78 CANON-03 — typo/abbreviation alias array
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    // Phase 78 CANON-04 — operator review queue flag
    needsReview: boolean('needs_review').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_families_brand_name_unique').on(table.brandId, table.nameNormalized),
    // GIN index — Drizzle 0.45 indexUsing API is limited; emit via raw sql if needed,
    // or skip from Drizzle (the supabase migration is the source of truth).
  ],
)
```

Existing arrays-with-`'{}'::text[]`-default pattern: see `watches_catalog.styleTags` (`src/db/schema.ts:483`) — confirmed valid Drizzle 0.45.2 syntax.

### Pattern 3: tsx Script with `postgres`-lib Connection + Markdown Artifact
**What:** Direct `postgres` lib connection (not the shared `src/db` drizzle client) to keep the script self-contained and avoid Next 16 module-resolution surprises.
**When to use:** Read-only, one-shot scripts that need to operate against either local OR prod via inline `DATABASE_URL`.
**Example:** (source: `scripts/inventory-explore-catalog.ts:14-37,125-198`)
```ts
// scripts/v8.4-brand-canonicalization.ts (skeleton — full plan in PLAN.md)
import * as fs from 'node:fs'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import postgres from 'postgres'

const OUTPUT_FILE = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)

interface ParsedArgs {
  regenerate: boolean
  force: boolean
}

function parseArgs(): ParsedArgs {
  const flags = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '')))
  return {
    regenerate: flags.has('regenerate'),
    force: flags.has('force'),
  }
}

async function main() {
  const args = parseArgs()

  // D-78-07: refuse-to-overwrite
  if (existsSync(OUTPUT_FILE) && !args.regenerate && !args.force) {
    console.error(
      `[v8.4-brand-canon] ERROR: ${OUTPUT_FILE} already exists.\n` +
      `Pass --regenerate to merge operator decisions forward, or --force to overwrite.`,
    )
    process.exit(1)
  }

  const connStr = process.env.DATABASE_URL
  if (!connStr) {
    console.error('[v8.4-brand-canon] ERROR: DATABASE_URL is not set.')
    process.exit(1)
  }

  const sql = postgres(connStr, { max: 1, prepare: false })

  try {
    // Q10 — distinct catalog brands LEFT JOIN brands on exact normalized match.
    // Uses watches_catalog.brand_normalized (GENERATED) so the equality matches
    // brands.name_normalized (also GENERATED — same lower(trim(...)) expression).
    const rows = await sql<{
      brand_raw: string
      brand_normalized: string
      proposed_target_id: string | null
    }[]>`
      SELECT DISTINCT
        wc.brand AS brand_raw,
        wc.brand_normalized,
        b.id AS proposed_target_id
      FROM public.watches_catalog wc
      LEFT JOIN public.brands b ON b.name_normalized = wc.brand_normalized
      ORDER BY wc.brand_normalized
    `

    // For rows with no exact match (proposed_target_id IS NULL),
    // pull top 3 fuzzy candidates ≥ 0.5 via word_similarity.
    // Q4: schema-qualify extensions.word_similarity because the script's
    // postgres-lib connection does NOT inherit migration-time search_path.
    // Fold via public.f_unaccent so 'Héron' and 'Heron' produce the same score.
    const candidatesByNormalized = new Map<string, Array<{ name: string; score: number }>>()
    for (const r of rows.filter((r) => r.proposed_target_id === null)) {
      const cands = await sql<{ name_normalized: string; score: number }[]>`
        SELECT
          name_normalized,
          extensions.word_similarity(
            lower(public.f_unaccent(${r.brand_normalized})),
            lower(public.f_unaccent(name_normalized))
          ) AS score
        FROM public.brands
        WHERE extensions.word_similarity(
                lower(public.f_unaccent(${r.brand_normalized})),
                lower(public.f_unaccent(name_normalized))
              ) > 0.5
        ORDER BY score DESC
        LIMIT 3
      `
      candidatesByNormalized.set(
        r.brand_normalized,
        cands.map((c) => ({ name: c.name_normalized, score: Number(c.score) })),
      )
    }

    // D-78-04: exact-only auto-resolve.
    // D-78-07: --regenerate merge-forward (parser block omitted for brevity).
    const tableLines: string[] = [
      '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
      '| --------- | ---------- | ------------------ | ------ | ------------------ |',
    ]
    for (const r of rows) {
      const status = r.proposed_target_id ? 'auto-resolved' : 'needs-review'
      const cands = candidatesByNormalized.get(r.brand_normalized) ?? []
      const notes = cands
        .map((c) => `${c.name} (${c.score.toFixed(2)})`)
        .join(', ')
      tableLines.push(
        `| ${r.brand_raw} | ${r.brand_normalized} | ${r.proposed_target_id ?? ''} | ${status} | ${notes} |`,
      )
    }

    const now = new Date().toISOString().slice(0, 10)
    const header = [
      `# v8.4 Brand Merge Decisions`,
      ``,
      `> Generated ${now} by scripts/v8.4-brand-canonicalization.ts — READ-ONLY.`,
      `> Edit \`status\` cells to lock decisions: auto-resolved | merge:<uuid> | new | skip | needs-review`,
      `> Phase 79's --apply consumes this file. Unknown status values cause Phase 79 to refuse the run.`,
      ``,
    ].join('\n')

    await writeFile(OUTPUT_FILE, header + tableLines.join('\n') + '\n', 'utf8')
    console.log(`[v8.4-brand-canon] wrote ${OUTPUT_FILE} (${rows.length} brand rows)`)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('[v8.4-brand-canon] fatal:', err)
  process.exit(1)
})
```

### Anti-Patterns to Avoid
- **Don't `drizzle-kit push` for prod.** Memory `[[drizzle-supabase-db-mismatch]]` is explicit: prod = `supabase db push --linked` with hand-written SQL. `[[local-catalog-natural-key-drift]]` is the consequence of getting this wrong (UNIQUE constraint silently lost).
- **Don't use `sql\`= ANY(${arr})\`` for any IN-list.** Memory `[[drizzle-sql-any-array-pitfall]]` — produces ROW literal, runtime 42809 error. Use `IN (${sql.join(arr.map(v => sql\`${v}\`), sql\`, \`)})`. (Phase 78's script likely doesn't need an IN-list at all; the per-row loop above is fine for ~46 candidate rows.)
- **Don't bake aliases into the schema migration.** D-78-08 — aliases ship EMPTY in Phase 78; population is Phase 79's `--apply` driven by the operator queue.
- **Don't reference `extensions.unaccent` from the schema migration when no function in the migration calls it.** The Phase 78 migration is pure ADD COLUMN + CREATE INDEX; no `f_unaccent` wrapper, no `SET search_path` needed. The portability requirement reduces to filename + additive shape.
- **Don't auto-resolve fuzzy candidates.** D-78-04 — every fuzzy hit goes to `needs-review`. Auto-fuzzy-merging would silently make the exact calls the operator queue exists to surface.
- **Don't write to the database from the dry-run script.** D-78-05 — read-only by construction. Phase 79 wires `--apply`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diacritic folding (`Héron` ↔ `Heron`) | Custom JS normalize-then-lowercase loop | `public.f_unaccent(text)` from 260623-uua migration | Already IMMUTABLE-pinned + index-backed; matches DAL behavior; cross-env tested. Note: optional for Phase 78 because D-78-04 is exact-only — but recommended for candidate scoring so the operator sees `Héron Watches` as a candidate for `heron`. |
| Postgres extension schema portability for new helper functions | New `f_*` IMMUTABLE wrapper with pinned `SET search_path` | **N/A — no new helper functions needed in Phase 78** | Phase 78 migration has no SQL function definitions. Phase 79's `--apply` may need its own helpers; that's Phase 79's concern. |
| Trigram fuzzy fallback from TypeScript | Custom Levenshtein / Jaro-Winkler in JS | `extensions.word_similarity(text, text)` schema-qualified | Already-installed extension; functional indexes don't help cross-table similarity but Q9 puts the catalog at ~205 rows so a seqscan with word_similarity is sub-100ms. |
| GFM table emission | Markdown library | String-array `join('\n')` (per `inventory-explore-catalog.ts:128-184`) | No new dep; one less attack surface; trivially deterministic for diff-review. |
| Markdown artifact parsing (Phase 79 concern, not 78) | `remark` + `remark-gfm` | Line-based split on `\|` + trim cells | Phase 79's `--apply` only needs to read the table; D-78-02's status grammar is finite. Plan a 30-LOC parser. **OUT OF PHASE 78 SCOPE** — flagged as forward constraint only. |
| `existsSync` race for refuse-to-overwrite | `O_EXCL` fs flag | `existsSync` + early exit (matches `scripts/factual-apply.ts:205`) | Race window irrelevant for a manually-invoked script. |

**Key insight:** Phase 78 is light on new infrastructure. Every primitive it needs is already in the repo or already in Postgres. The work is composition + idempotency, not invention.

## Runtime State Inventory

> Phase 78 is a schema-additions phase. No rename / refactor / migration of existing strings.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 78 adds new columns with defaults; no existing data renames or moves | None |
| Live service config | None — no n8n / Datadog / Tailscale state references brand/family schema | None |
| OS-registered state | None — no Task Scheduler / pm2 / launchd embeds these schema names | None |
| Secrets / env vars | None new — script uses existing `DATABASE_URL` from `.env.local` or shell override | None |
| Build artifacts | `drizzle/0014_*.sql` is generated/committed alongside the migration; `src/db/schema.ts` recompiles on next `next build`. No stale egg-info / compiled binaries | Re-run `drizzle-kit push` against local once both files committed |

**Nothing in any category** — Phase 78 is purely additive. The closest "state" concern is the natural-key UNIQUE constraint silently lost across `drizzle-kit push` cycles per `[[local-catalog-natural-key-drift]]` — Phase 78 does NOT touch this constraint, but the planner should call out in the verification step that the local catalog post-push should be re-introspected (`\d+ watches_catalog`) to confirm `watches_catalog_natural_key` is still present.

## Common Pitfalls

### Pitfall 1: Forgetting `extensions.` prefix on word_similarity in the script
**What goes wrong:** `extensions.word_similarity` works in the existing DAL because the functional trigram indexes were built with `SET LOCAL search_path = public, extensions` at migration time — the index OIDs are baked in and the planner picks them up. But a fresh `postgres`-lib connection from the script has the default search_path (`"$user", public`) and won't resolve unqualified `word_similarity`.
**Why it happens:** The DAL code in `src/data/catalog.ts:549` writes `word_similarity(...)` unqualified, suggesting it works. It does — but only because the QUERY can be served via the existing functional index (`watches_catalog_brand_unaccent_trgm_idx`). A fresh ad-hoc SELECT in the script that doesn't go through the same index path will fail with `function word_similarity(text, text) does not exist`.
**How to avoid:** Schema-qualify as `extensions.word_similarity(...)` in the script, OR issue `SET search_path = public, extensions` on the script's connection before the first query. Recommend the explicit prefix — clearer to future readers + immune to session-state surprises.
**Warning signs:** `42883` undefined function error at runtime. Catch in local dev BEFORE running against prod (Local-First gate).

### Pitfall 2: GIN index seqscan on a small table is faster than the index — perf claim is aspirational
**What goes wrong:** Success criterion #1 ("GIN index returns rows in <50ms on seeded local catalog for `aliases @> ARRAY['datejust']`") is technically vacuous: with ~205 catalog rows and ~empty `aliases` (Phase 78 ships empty per D-78-08), the planner will seqscan and return in <5ms. The GIN index is built but possibly never hit.
**Why it happens:** Postgres `random_page_cost` vs `seq_page_cost` math doesn't pick an index for tiny tables. This is correct behavior, not a bug. The TRUE perf gate is post-Phase-79-alias-population on prod-scale rows.
**How to avoid:** Phrase the Phase 78 verification as **"index EXISTS and EXPLAIN ANALYZE shows it as a candidate (or the seqscan is sub-50ms anyway)"** rather than "index is HIT." The planner should write the verification to assert on `pg_indexes` row existence + a cold `EXPLAIN ANALYZE` showing sub-50ms execution regardless of plan choice.
**Warning signs:** Planner asserting `EXPLAIN ANALYZE` shows "Bitmap Index Scan" on a 205-row table — that will fail and the assertion is wrong, not the index.

### Pitfall 3: Post-flight assertion mirrors the DDL predicate
**What goes wrong:** Per `[[post-flight-assertion-predicate-divergence]]`, an assertion that re-mirrors the DDL's CHECK silently inherits the same bug. Phase 78's post-flight should not re-state the ALTER TABLE in WHERE-clause form.
**How to avoid:** Phrase assertions in terms of RESULTING STATE (`information_schema.columns.column_default`, `pg_indexes.indexname` existence) rather than re-running the DDL or its inverse. The Pattern 1 example above already follows this — see the `DO $$ ... information_schema.columns ...` block.
**Warning signs:** Assertion uses the same `ADD COLUMN` keyword vocabulary as the DDL. That's a smell.

### Pitfall 4: `text[] NOT NULL DEFAULT '{}'` locking on ADD COLUMN with default
**What goes wrong:** Postgres 11+ optimizes `ADD COLUMN ... NOT NULL DEFAULT <constant>` to NOT rewrite the table — it stores the default in metadata and serves it on read for old rows. Pre-11 this would take an ACCESS EXCLUSIVE lock for the rewrite. Supabase prod runs Postgres 15+ so this is safe.
**Why it might happen anyway:** If the default is `sql\`'{}'::text[]\`` (a CAST expression), Postgres might not classify it as a "constant" and might rewrite. Empirically `DEFAULT '{}'` (unquoted-cast form) IS treated as constant.
**How to avoid:** Use `ADD COLUMN aliases text[] NOT NULL DEFAULT '{}'` (literal-cast form). The ~205-row local catalog and ~205-row prod catalog rewrite would be sub-second even if it happened.
**Warning signs:** First prod push timing >5s for the migration — investigate, but expect <1s.

### Pitfall 5: Operator edits the artifact, then re-runs the script without `--regenerate`
**What goes wrong:** Default behavior per D-78-07 is refuse-to-overwrite — exits with non-zero status. If the operator edits decisions and re-runs to "preview" the markdown, they'll get an error and might delete the file.
**How to avoid:** The error message must clearly say "Pass `--regenerate` to merge operator decisions forward, or `--force` to overwrite from scratch." Phase 78's plan should make the error message unambiguous and tell the operator NOT to delete the file.
**Warning signs:** Operator's decisions disappear between runs.

### Pitfall 6: `wc.brand_normalized` referenced in dry-run script when GENERATED column was renamed
**What goes wrong:** `scripts/backfill-catalog-brands.ts:112` reads `wc.brand_normalized` — this column IS in `src/db/schema.ts:451` as a GENERATED column today. But the script uses raw SQL via `sql\`...\`` literal, not the type-safe Drizzle column reference. If schema.ts column rename happens, the script breaks silently with PG error 42703.
**How to avoid:** Phase 78's script can SAFELY use `wc.brand_normalized` (the column exists, GENERATED, lower(trim(brand))). No new vulnerability here. Just be aware of the silent-rename failure mode if any future phase renames the GENERATED column.
**Warning signs:** N/A for Phase 78. Document for completeness.

## Code Examples

### Distinct Catalog Brands + LEFT JOIN to brands (script Stage 1+2)
```ts
// Source: composition of scripts/inventory-explore-catalog.ts:42-93 (postgres-lib SELECT pattern)
//       + scripts/backfill-catalog-brands.ts:106-118 (name_normalized JOIN logic)
const rows = await sql<{
  brand_raw: string
  brand_normalized: string
  proposed_target_id: string | null
}[]>`
  SELECT DISTINCT
    wc.brand AS brand_raw,
    wc.brand_normalized,
    b.id AS proposed_target_id
  FROM public.watches_catalog wc
  LEFT JOIN public.brands b ON b.name_normalized = wc.brand_normalized
  ORDER BY wc.brand_normalized
`
```

### Top 3 Fuzzy Candidates ≥0.5 via word_similarity (script Stage 3)
```ts
// Schema-qualified extensions.word_similarity per Pitfall 1.
// One query per orphan brand; ~25-46 orphans expected (Q9), <500ms total.
const cands = await sql<{ name_normalized: string; score: number }[]>`
  SELECT
    name_normalized,
    extensions.word_similarity(
      lower(public.f_unaccent(${brandNormalized})),
      lower(public.f_unaccent(name_normalized))
    ) AS score
  FROM public.brands
  WHERE extensions.word_similarity(
          lower(public.f_unaccent(${brandNormalized})),
          lower(public.f_unaccent(name_normalized))
        ) > 0.5
  ORDER BY score DESC
  LIMIT 3
`
```

### GFM Table Emission (script Stage 4)
```ts
// Source: scripts/inventory-explore-catalog.ts:128-184 (line-array pattern)
const tableLines: string[] = [
  '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
  '| --------- | ---------- | ------------------ | ------ | ------------------ |',
  ...rows.map((r) => {
    const status = r.proposed_target_id ? 'auto-resolved' : 'needs-review'
    const cands = candidatesByNormalized.get(r.brand_normalized) ?? []
    const notes = cands.map((c) => `${c.name} (${c.score.toFixed(2)})`).join(', ')
    return `| ${r.brand_raw} | ${r.brand_normalized} | ${r.proposed_target_id ?? ''} | ${status} | ${notes} |`
  }),
]
await writeFile(OUTPUT_FILE, header + tableLines.join('\n') + '\n', 'utf8')
```

### Refuse-to-Overwrite Guard (D-78-07)
```ts
// Source: scripts/factual-apply.ts:205-208 (existsSync gate)
if (existsSync(OUTPUT_FILE) && !args.regenerate && !args.force) {
  console.error(
    `[v8.4-brand-canon] ERROR: ${OUTPUT_FILE} already exists.\n` +
    `Pass --regenerate to merge operator decisions forward, or --force to overwrite.`,
  )
  process.exit(1)
}
```

### `--regenerate` Merge-Forward Logic (D-78-07)
```ts
// Parse existing GFM table by splitting lines and the pipe-separator,
// build a Map<brand_raw, existingRow>, then for each new row:
//   - if brand_raw exists AND existing status !== 'needs-review' → preserve existing row verbatim
//   - else → use fresh-generated row
async function mergeForward(existingPath: string, fresh: typeof rows): Promise<string[]> {
  const existing = await readFile(existingPath, 'utf8')
  const existingByBrandRaw = new Map<string, string>()  // raw line text per brand_raw key
  for (const line of existing.split('\n')) {
    if (!line.startsWith('|') || line.startsWith('| ---') || line.startsWith('| brand_raw')) continue
    const cells = line.split('|').map((c) => c.trim())
    // cells[0] is empty (leading '|'); brand_raw at cells[1], status at cells[4]
    const brandRaw = cells[1]
    const status = cells[4]
    if (brandRaw && status && status !== 'needs-review') {
      existingByBrandRaw.set(brandRaw, line)
    }
  }
  // Emit fresh table, but substitute preserved lines where applicable
  return [
    '| brand_raw | normalized | proposed_target_id | status | candidates / notes |',
    '| --------- | ---------- | ------------------ | ------ | ------------------ |',
    ...fresh.map((r) => {
      const preserved = existingByBrandRaw.get(r.brand_raw)
      if (preserved) return preserved
      // ... fresh row formatter
    }),
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle-kit push for everything | Drizzle-kit local-only; hand-written `supabase/migrations/*.sql` for prod | Phase 11+ accumulated wisdom in `[[drizzle-supabase-db-mismatch]]` | Phase 78 follows this — hand-write SQL, mirror with Drizzle for type safety |
| Unaccent in `public` schema | `extensions.unaccent` + `public.f_unaccent(text)` IMMUTABLE wrapper with pinned `SET search_path` | quick-260623-uua (2026-06-23) | Phase 78 doesn't USE these in the migration but the dry-run script depends on them already existing |
| `similarity()` whole-string | `word_similarity()` best-substring | `[[pg-trgm-word-similarity-for-brand-typos]]` (2026-06-23) | Phase 78's candidate scoring uses `word_similarity` |
| `sql\`= ANY(${arr})\`` for IN lists | `sql\`IN (${sql.join(arr.map(v => sql\`${v}\`), sql\`, \`)})\`` | `[[drizzle-sql-any-array-pitfall]]` (2026-06-23) | Phase 78's per-row loop avoids IN-lists entirely; this is forward armor |

**Deprecated / outdated:** none specific to Phase 78. The script pattern of inlining `process.env.DATABASE_URL` reads + connecting via `postgres` lib remains current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Local seeded catalog has ~46 distinct `lower(trim(brand))` values | Q9 / Validation Architecture | LOW — the script handles any N; just affects expected artifact size |
| A2 | Supabase prod runs Postgres 15+ (cheap `ADD COLUMN ... DEFAULT '{}'` metadata-only) | Pitfall 4 | LOW — Supabase has been on 15.x since well before 2026; verifiable with `SELECT version()` |
| A3 | The four SEED-021 cases (Hamilton/Hamilton Watch, Omega/OMEGA, Héron/Héron Watches, Brut Date/Brut Datejust) are actually present in the seeded local catalog | Validation Architecture / D-78-04 verification | MEDIUM — confirmed Hamilton + Hamilton Watch and Héron Watches in seed-data JSON; Omega/OMEGA + Brut Date/Brut Datejust assumed but not visually confirmed. Verify with `SELECT DISTINCT brand FROM watches_catalog WHERE lower(brand) IN ('omega','brut date','brut datejust','hamilton','hamilton watch','héron','héron watches')` against local before plan |
| A4 | The local Postgres `extensions` schema has `pg_trgm` AND `unaccent` installed (from quick-260623-uua) | Q4 / dry-run script viability | LOW — verified via `\dx` in the precedent migration's deployment; if local got wiped, re-run `supabase db reset` + `supabase migration up` |

**If this table is left as-is:** A3 is the one to verify before planning — drop a one-liner `psql` check into the plan's Wave 0.

## Open Questions (RESOLVED)

### Cross-References for Plans (R-FIND labels)

The planners cite `R-FIND-01..R-FIND-04` shorthand in their `<action>` blocks; map them as follows:

- **R-FIND-01** — "Phase 78 migration does NOT reference any extension function" → Q2 (line 862) and Pattern 1 Note (line 310). Consequence: no `f_unaccent` wrapper, no `SET search_path` work in the migration; portability reduces to filename + ordering + additive ADD COLUMN shape.
- **R-FIND-02** — "Script must schema-qualify as `extensions.word_similarity(...)`" → Q4 (line 890) and Pitfall 1 (line 539). Consequence: the dry-run script SQL prefixes `word_similarity` with `extensions.`; failure mode is runtime `42883`.
- **R-FIND-03** — "GIN perf claim is aspirational pre-backfill" → Pitfall 2 (line 545) and Q1 (line 854). Consequence: verification asserts index EXISTS, NOT that the planner picks it; `<50ms` is verified end-to-end (seqscan included).
- **R-FIND-04** — "Local catalog has ~46 distinct brands; expect ~3-6 needs-review" → Q9 (line 953). Consequence: artifact-size sanity check + SEED-021 case-coverage expectation.

1. **Should `.planning/v8.4-brand-merge-decisions.md` be gitignored or committed?**
   - What we know: `.planning/` IS committed (every prior PLAN.md, RESEARCH.md, CONTEXT.md is in git).
   - What's unclear: this file has an operator-written status column that will be modified between runs — committing makes the operator's edits a phase-79 input traceable in git; gitignoring keeps the file local-only and treats the file as a transient artifact.
   - Recommendation: **commit** — Phase 79's `--apply` will reference the exact file in PR/commits anyway, and the diff-history is useful for "why did the operator pick `merge:<uuid>` for Brand X" forensics.
   - **RESOLVED:** Commit to git; Plan 03 Task 3 includes `git add` + commit of the artifact.

2. **Should the dry-run script create an `npm` script entry?**
   - What we know: existing precedent is `package.json` L13-31 has entries for every DB-touching script (`db:backfill-catalog-brands`, `db:factual-propose`, etc.).
   - What's unclear: Phase 78's script needs the env override pattern (`DATABASE_URL=... npm run db:v8.4-brand-canon`) — the standard `--env-file=.env.local` works for LOCAL; prod runs override.
   - Recommendation: Yes — add `"db:v8.4-brand-canon": "tsx --env-file=.env.local scripts/v8.4-brand-canonicalization.ts"`. Document the prod-override invocation in the script header (per `scripts/backfill-catalog-brands.ts:18-21`).
   - **RESOLVED:** Added npm script `db:v8.4-brand-canon`; Plan 03 Task 1 adds the package.json entry.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Docker container `supabase_db_horlo`) | Migration dry-run, dry-run script local verification | ✓ (assumed running per CLAUDE.md local-first rule) | Postgres 15+ | If not running, `supabase start` |
| `supabase` CLI | `supabase db push --linked` (prod) | ✓ (assumed installed) | N/A | Hand-apply via psql against pooler (not recommended) |
| `tsx` | Running `scripts/v8.4-brand-canonicalization.ts` | ✓ (devDep) | per package.json | `node` after explicit `tsc` compile (slower iteration) |
| `extensions.pg_trgm` | Fuzzy candidate scoring | ✓ in local + prod (via quick-260623-uua) | per extension | None — required |
| `extensions.unaccent` + `public.f_unaccent(text)` | Diacritic folding in candidate scoring (optional) | ✓ in local + prod (via quick-260623-uua) | per extension | Skip f_unaccent wrapper — accents-mismatched scores still ≥0.5 for most cases |
| `postgres` (npm package) | Script DB connection | ✓ (^3.4.9) | per package.json | Use `src/db` drizzle client (slightly heavier import surface) |
| `node:fs` / `node:fs/promises` | Artifact I/O | ✓ (built-in) | N/A | None — required |
| `prod DATABASE_URL` (Supabase pooler) | Optional: dry-run against prod for parity check | ✗ (operator-supplied at runtime) | N/A | LOCAL-ONLY dry-run; prod alignment verified post-`db push --linked` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** prod `DATABASE_URL` — operator supplies it on-demand for prod dry-run. Default LOCAL is the standard path.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@2.1.9` (already installed) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- tests/static/phase78-schema-shape.test.ts tests/integration/phase78-schema.test.ts` |
| Full suite command | `npm run test` |
| Build gate | `npm run build` (runs `prebuild` = `vitest run tests/static/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CANON-03 (column shape) | `watch_families.aliases` is `text[] NOT NULL DEFAULT '{}'` | static (grep schema.ts) + integration (`information_schema.columns`) | `npm run test -- tests/static/phase78-schema-shape.test.ts` AND `npm run test -- tests/integration/phase78-schema.test.ts` | ❌ Wave 0 |
| CANON-03 (GIN index exists) | `watch_families_aliases_gin_idx` exists in `pg_indexes` | integration | `npm run test -- tests/integration/phase78-schema.test.ts -t "aliases gin index"` | ❌ Wave 0 |
| CANON-03 (containment query works) | `SELECT * FROM watch_families WHERE aliases @> ARRAY['datejust']::text[]` returns rows in <50ms cold | manual SQL (planner adds to UAT) | `docker exec supabase_db_horlo psql -U postgres -d postgres -c "EXPLAIN ANALYZE ..."` | manual |
| CANON-04 (brands.needs_review) | `brands.needs_review boolean NOT NULL DEFAULT false`; existing rows backfill to `false` | static + integration | `npm run test -- tests/integration/phase78-schema.test.ts -t "brands needs_review"` | ❌ Wave 0 |
| CANON-04 (watch_families.needs_review) | same as above for `watch_families` | static + integration | same | ❌ Wave 0 |
| CANON-04 (existing rows all false) | `SELECT count(*) FROM brands WHERE needs_review IS NOT FALSE` = 0 | integration | `npm run test -- tests/integration/phase78-schema.test.ts -t "existing rows backfill"` | ❌ Wave 0 |
| MIG-01 (script exists + runs) | `scripts/v8.4-brand-canonicalization.ts` runs against seeded local catalog and writes `.planning/v8.4-brand-merge-decisions.md` | smoke (one-shot manual command in plan's UAT) | `DATABASE_URL=$LOCAL_PG_URL tsx scripts/v8.4-brand-canonicalization.ts` then `test -s .planning/v8.4-brand-merge-decisions.md` | manual |
| MIG-01 (no DB write) | The dry-run does not mutate any table | integration | Snapshot row counts on `brands`, `watch_families`, `watches_catalog` before + after script run; expect identical counts and `updated_at` unchanged | ❌ Wave 0 |
| MIG-01 (refuse-to-overwrite) | Re-run without `--regenerate` exits non-zero | smoke | Run script twice; second exit code must be non-zero | manual |
| MIG-01 (`--regenerate` merge-forward) | Operator-edited non-`needs-review` rows survive re-run | smoke | Edit a row to `merge:<uuid>`; re-run with `--regenerate`; grep file for original status | manual |
| MIG-01 (SEED-021 cases land in needs-review) | The four cases (Hamilton/Hamilton Watch, Omega/OMEGA, Héron/Héron Watches, Brut Date/Brut Datejust) appear with `status: needs-review` | smoke | `grep -E "(Hamilton Watch|OMEGA|Héron Watches)" .planning/v8.4-brand-merge-decisions.md | grep needs-review` | manual |
| MIG-05 portability foundation | Migration files in `supabase/migrations/` follow timestamp ordering; `supabase db push --linked` succeeds first time | smoke | `ls supabase/migrations/ | tail -1` (filename present) + manual `supabase db push --linked --dry-run` | manual |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/static/phase78-schema-shape.test.ts` (fast static guards)
- **Per wave merge:** `npm run test -- tests/static/ tests/integration/phase78-schema.test.ts`
- **Phase gate:** Full local verification sequence (below) + `npm run test` green + script dry-run produces SEED-021-correct artifact

### Phase 78 Local Verification Sequence (codifies Q8 — Local-First gate)

Per CLAUDE.md `## Local-First Development`, a schema-additions phase verifies via DB introspection, not `npm run dev` clicks. The sequence:

1. **Apply local Supabase migration:**
   ```bash
   supabase db push  # local target
   ```
2. **Drizzle shape sync (post-Supabase):**
   ```bash
   npx drizzle-kit push
   ```
3. **Confirm columns via psql introspection:**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c "\d brands" | grep needs_review
   docker exec supabase_db_horlo psql -U postgres -d postgres -c "\d watch_families" | grep -E "aliases|needs_review"
   ```
4. **Confirm GIN index:**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'watch_families_aliases_gin_idx'"
   ```
5. **Confirm existing-row backfill is `false`:**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT count(*) FROM brands WHERE needs_review IS NOT FALSE;
      SELECT count(*) FROM watch_families WHERE needs_review IS NOT FALSE;"
   # Expect 0 + 0
   ```
6. **Confirm natural-key UNIQUE intact post-push (per `[[local-catalog-natural-key-drift]]`):**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT conname FROM pg_constraint WHERE conname = 'watches_catalog_natural_key'"
   # Expect one row
   ```
7. **Dry-run script E2E:**
   ```bash
   npm run db:v8.4-brand-canon
   test -s .planning/v8.4-brand-merge-decisions.md  # non-empty
   grep -E "(Hamilton Watch|OMEGA|Héron Watches)" .planning/v8.4-brand-merge-decisions.md | grep needs-review
   # Expect at least one hit each
   ```
8. **Confirm script did NOT mutate the DB:**
   ```bash
   # Snapshot brand count + max(updated_at) before + after a re-run; expect identical.
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT count(*), max(updated_at) FROM brands"
   ```
9. **vitest green:**
   ```bash
   npm run test -- tests/static/phase78-schema-shape.test.ts tests/integration/phase78-schema.test.ts
   ```
10. **Build green (runs `prebuild` static guards too):**
    ```bash
    npm run build
    ```
11. **Prod push:**
    ```bash
    supabase db push --linked
    ```
12. **Prod parity:** re-run steps 3-6 against prod `DATABASE_URL`.

### Wave 0 Gaps
- [ ] `tests/static/phase78-schema-shape.test.ts` — text grep on `src/db/schema.ts` for `aliases:`, `needsReview:` (per `// @vitest-environment node` pattern in `tests/static/legacy-watch-routes.test.ts:1`)
- [ ] `tests/integration/phase78-schema.test.ts` — DATABASE_URL-gated integration test (per `tests/integration/migration-drop-archetype.test.ts:26` idiom: `const maybe = process.env.DATABASE_URL ? describe : describe.skip`); asserts column + index + default
- [ ] (Optional) `tests/integration/phase78-dry-run.test.ts` — DATABASE_URL-gated: snapshot row counts before + after invoking the script's pure-data function (extract a `generateBrandDecisions(connStr)` helper from `main()` so it's testable without `process.exit`)
- [ ] Framework install: none — vitest already configured

## Security Domain

> Required when `security_enforcement` is enabled (absent / true). Including for completeness — Phase 78 has minimal security surface but it MUST be covered.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 78 has no user-facing auth surface |
| V3 Session Management | no | Phase 78 has no session surface |
| V4 Access Control | yes | Script connects via service-role `DATABASE_URL`; secret SHALL NOT be committed to git or interpolated into the artifact |
| V5 Input Validation | yes | Script's `--regenerate` flag parses operator-edited markdown; malicious GFM content COULD inject malformed status cells. Phase 79 guards via strict status-grammar refusal, but Phase 78 should at minimum not crash on unexpected line shapes |
| V6 Cryptography | no | No crypto in Phase 78 |

### Known Threat Patterns for tsx-script + Postgres stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via brand string | Tampering | The script's queries parameterize `brand_normalized` via `sql\`${...}\``-bound parameters (`postgres` lib auto-binds template-literal interpolations). The brand strings flow from `watches_catalog` rows (not from operator-supplied input), so SQLi is bounded to "row content already in DB." LOW risk |
| Service-role secret leakage | Information Disclosure | The script reads `process.env.DATABASE_URL` and never logs it. Artifact is a markdown file with no secret material. Operator runs script in their own shell; DATABASE_URL never enters the artifact |
| Artifact poisoning between dry-run + --apply | Tampering (Phase 79 concern) | Phase 79's parser MUST refuse unknown `status` values (D-78-02). Phase 78 only needs to emit a strict-format artifact; Phase 79 enforces the grammar |
| Run script against prod by mistake | Information Disclosure (cross-env confusion) | `inventory-explore-catalog.ts:25-30` pattern: error-out if DATABASE_URL not set; Phase 78 dry-run is read-only so accidental prod connection is a no-op for the DB, but the artifact would reflect prod data. Recommend the script header documents the prod-override invocation explicitly (like `backfill-catalog-brands.ts:18-21`) |

**No new vectors introduced.** The script is read-only by D-78-05, and the schema additions are additive with default-`false` / default-`'{}'` — no privilege escalation, no PII exposure, no auth bypass.

---

## Question-by-Question Answers (the 10 user-supplied research questions)

### Q1 — GIN index syntax for `text[]` containment

**Answer:** `CREATE INDEX watch_families_aliases_gin_idx ON watch_families USING GIN (aliases);` — plain GIN with the **default `array_ops` opclass**, which supports `@>` (contains, strategy 2), `<@` (contained), `=`, and `&&` (overlap) per the Postgres docs. **No `gin_trgm_ops` needed** — that opclass is for trigram fuzzy match on a SINGLE `text` column, not for `text[]` containment.

**Source:** [PostgreSQL Documentation: Built-in Operator Classes](https://www.postgresql.org/docs/16/gin-builtin-opclasses.html); precedent: `supabase/migrations/20260427000000_phase17_catalog_schema.sql:142-145` (uses `gin (brand extensions.gin_trgm_ops)` — different opclass, different purpose).

**<50ms perf claim is aspirational pre-backfill.** With ~205 catalog rows / ~205 family rows and empty `aliases` per D-78-08, the planner will seqscan and return in <5ms regardless of index. The index is built for Phase 80 + post-Phase-79 alias-populated state. See **Pitfall 2** above — recommend the planner phrase the verification as "index EXISTS + cold EXPLAIN ANALYZE shows <50ms" rather than "index is HIT by the plan."

### Q2 — `extensions` schema portability for ADD COLUMN migrations

**Answer:** **The Phase 78 migration does NOT use `extensions.unaccent` or `extensions.similarity` or any extension function.** The migration is pure ADD COLUMN + CREATE INDEX (USING GIN, default `array_ops`). The portability requirement (success criterion #4) therefore reduces to:

1. **Filename + ordering convention** per `[[drizzle-supabase-db-mismatch]]` gotcha #1 (`20260624000000_phase78_aliases_needs_review.sql` — sorts AFTER `20260623200000_quick_260623_uua_search_unaccent_trgm.sql`, the most recent migration).
2. **Additive ADD COLUMN shape** (no enum-bound dependents → gotcha #4 not applicable; no extension-schema function definitions → gotcha #3 not applicable).

**`f_unaccent` + `SET search_path` pinning** matters in the DRY-RUN SCRIPT (Q4), not the migration. The script's `extensions.word_similarity(lower(public.f_unaccent(...)))` calls already-installed functions; the script itself does not define new functions and so the "pinned search_path" gotcha is irrelevant for the migration but relevant for the script's query qualification (use `extensions.`-prefixed calls + `public.f_unaccent`).

**This is a NOTABLE deviation from CONTEXT.md's framing.** CONTEXT.md L14 and L107 (and CANON-03 success criterion #4) describe the portability requirement as if extension functions are involved. They are not in Phase 78. Flag this in the planner's discuss-phase confirmation: success criterion #4 is satisfied by filename + ordering + additive ADD COLUMN; no `SET search_path` work in this migration.

### Q3 — Drizzle ADD COLUMN with `text[]` and `boolean DEFAULT false` semantics

**Answer:**
- **`boolean NOT NULL DEFAULT false`**: Postgres 11+ optimizes this to metadata-only (no table rewrite) — atomic, sub-second locking on a ~205-row table. Supabase prod is 15+. Existing rows backfill to `false` (the default) without rewriting. No concurrency risk.
- **`text[] NOT NULL DEFAULT '{}'`**: Same Postgres 11+ optimization applies for **constant defaults**. `'{}'` is treated as constant (the `array_in` parser produces a const value). Metadata-only, no rewrite. Same locking story.
- **`DEFAULT '{}'::text[]`** (with explicit cast) — slightly different parse path; Postgres may not classify as constant. Use the bare `'{}'` form. (Drizzle codegen tends to produce `DEFAULT '{}'::text[]` from `sql\`'{}'::text[]\``; that's safe but might rewrite. The hand-written SQL uses bare `'{}'`.)

**Drizzle codegen pattern for additive ADD COLUMN** — per `drizzle/0013_phase60_watch_photos.sql:1-7`, the project's pattern is: hand-write the Supabase migration FIRST (with the backfill + DDL + assertion), THEN run `drizzle-kit push` against local to sync the column shapes (no backfill — drizzle-kit only emits column DDL). Drizzle's emitted file is a "LOCAL SYNC ONLY" mirror; the Supabase file is the source of truth.

**Drizzle 0.45.2 `text('...').array().notNull().default(sql\`'{}'::text[]\`)`** is the documented syntax — see `src/db/schema.ts:483` for `styleTags` (existing precedent). Confirmed working.

**Filename + ordering rules** (from `[[drizzle-supabase-db-mismatch]]` and verified against `ls supabase/migrations/`):
- Format: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Must sort AFTER the most recent file (currently `20260623200000_quick_260623_uua_search_unaccent_trgm.sql`)
- Phase-named files use `phaseNN` prefix in the slug (per `20260525000000_phase60_watch_photos.sql`)
- **Recommended for Phase 78:** `20260624000000_phase78_aliases_needs_review.sql` (sorts after 260623200000, uses phase78 prefix).

### Q4 — `pg_trgm` from TypeScript via Drizzle / `postgres` lib

**Answer:**
- **Schema-qualify**: use `extensions.word_similarity(text, text)` in the script's SQL. Unqualified `word_similarity` works in the existing DAL (`src/data/catalog.ts:549`) ONLY because the planner serves those queries via the existing functional indexes (`watches_catalog_brand_unaccent_trgm_idx`), whose function references were resolved at index-build time. A fresh ad-hoc SELECT in the script that doesn't use those indexes will fail with `42883 function word_similarity(text, text) does not exist`. **Use `extensions.word_similarity` explicitly.**
- **`f_unaccent` (the IMMUTABLE wrapper)** is in `public` schema, not `extensions`. Reference as `public.f_unaccent(text)`.
- **Drizzle template-literal syntax**: `sql\`extensions.word_similarity(${a}, ${b})\`` — the `${a}` and `${b}` interpolations are bound as parameters by `postgres` lib (NOT spliced as strings), so they are SQLi-safe.
- **Batch fuzzy-lookup against N candidates**: prefer the **per-orphan-row loop** (one SELECT per orphan brand, returning top 3 candidates) over an IN-list of brand-raw values. With ~25-46 orphan brands (Q9), that's ~46 round-trips totaling <500ms; clearer code; no `= ANY(${arr})` ROW-literal footgun per `[[drizzle-sql-any-array-pitfall]]`.
- **If batch is desired** (forward armor): use `IN (${sql.join(arr.map(v => sql\`${v}\`), sql\`, \`)})` per the established pattern in `src/data/recommendations.ts:454` and `src/data/search.ts:280`. **Never** use `sql\`= ANY(${arr})\``.

**Canonical example for Phase 78:** see the Code Examples section above ("Top 3 Fuzzy Candidates ≥0.5 via word_similarity").

### Q5 — Existing `scripts/inventory-explore-catalog.ts` runtime pattern

**Answer:** Read in detail at `scripts/inventory-explore-catalog.ts:14-203`. Key findings:

- **Connection**: `postgres(connStr, { max: 1, prepare: false })` — direct `postgres` lib, NOT through `src/db` drizzle client. `{ prepare: false }` is mandatory for Supabase Transaction-mode pooler.
- **Env loading**: explicit `process.env.PROD_DATABASE_URL` — NO `--env-file`. The script header (L11) explicitly says "Does NOT use `--env-file=.env.local` because PROD_DATABASE_URL must NOT live there. The user supplies it via shell env." This is the **PROD-targeted** pattern.
- **For Phase 78** (D-78-06 = works against both envs): use the standard `--env-file=.env.local` pattern from `scripts/backfill-catalog-brands.ts:23` for local default, with explicit DATABASE_URL override for prod. This is the pattern across `db:*` package.json scripts. So: `"db:v8.4-brand-canon": "tsx --env-file=.env.local scripts/v8.4-brand-canonicalization.ts"` for local default; for prod, `DATABASE_URL=$PROD_URL tsx scripts/v8.4-brand-canonicalization.ts`.
- **Markdown emission**: line-array pattern (`lines.push(...)` then `lines.join('\n')`) — `inventory-explore-catalog.ts:128-184`. No template engine, no markdown library. Each table is built as: header row → separator row → data rows from `.map((r) => \`| ${r.col1} | ${r.col2} |\`)`. This is exactly the pattern Phase 78 should use.
- **Refuse-to-overwrite**: `inventory-explore-catalog.ts:9` comment says "Idempotent — re-runs overwrite the file." So this script does NOT have refuse-to-overwrite — that pattern is unique to Phase 78 per D-78-07. Closest precedent: `scripts/factual-apply.ts:205` (`if (!existsSync(args.reviewFile)) { exit 1 }` — early-exit on absent file, which is the inverse of Phase 78's needed gate). Phase 78's plan must include the refuse-to-overwrite logic as a NEW capability (~5 LOC, simple `existsSync` check).
- **Prod-vs-local URL switching**: handled by the env. `inventory-explore-catalog.ts:34-42` shows the warning-out pattern: connection failure → `process.exit(1)` with clear error.

### Q6 — GFM table parsing primitives (Phase 79's concern, but Phase 78 must produce a parseable output)

**Answer:**
- **No GFM AST parser in package.json.** `react-markdown` (^10.1.0) is for RENDERING (browser); `remark`, `marked`, `micromark` are NOT present.
- **The simplest parser is line-based**: ~20-30 LOC of split-on-`\|` + trim. Phase 79's `--apply` parser:
  ```ts
  // Phase 79 — Plan 0X — pseudo-code
  for (const line of artifact.split('\n')) {
    if (!line.startsWith('|')) continue
    if (line.startsWith('| ---')) continue
    if (line.startsWith('| brand_raw')) continue  // header
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    // cells = [brand_raw, normalized, proposed_target_id, status, candidates]
    const [brandRaw, normalized, proposedTargetId, status, candidates] = cells
    // strict status grammar (D-78-02):
    const VALID = ['auto-resolved', 'new', 'skip', 'needs-review']
    const MERGE_RE = /^merge:[0-9a-f-]{36}$/i
    if (!VALID.includes(status) && !MERGE_RE.test(status)) {
      throw new Error(`Phase 79 parser: unknown status "${status}" on brand_raw="${brandRaw}"`)
    }
    // ...
  }
  ```
- **Phase 78's contract**: emit the table cleanly with no embedded `|` characters in cell values (`brand_raw` could theoretically contain `|` if a catalog brand was named weirdly — sanitize by replacing `|` with `\|` or rejecting; recommend the planner add a defensive `.replace(/\|/g, '\\|')` on every cell write). With normalized brand strings being `lower(trim(...))` of catalog values, pipe characters are extremely unlikely but worth guarding.
- **Recommendation**: hand-roll the parser (Phase 79's concern). Phase 78 ships a defensively-emitted GFM table with no new dependencies.

### Q7 — `tests/static/` Vercel-prebuild guards pattern

**Answer:** Confirmed pattern at `tests/static/legacy-watch-routes.test.ts:1-56`:

- **Line 1: `// @vitest-environment node`** — MANDATORY for any test that uses `readFileSync`, `readdirSync`, `statSync`. Memory `[[vitest-static-node-env]]` cites this: jsdom (default) externalizes `node:fs` and `readdirSync` becomes `undefined`, passing locally but failing the Vercel prebuild.
- **`prebuild` npm hook runs `vitest run tests/static/`** — these guards gate every prod deploy (per `package.json:5`).
- **Pattern**: `import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'` at top of file; explicit `// @vitest-environment node` first line.
- **For Phase 78** (per Validation Architecture above):
  - `tests/static/phase78-schema-shape.test.ts` — grep `src/db/schema.ts` source text for `aliases:` and `needsReview:` definitions (catches drizzle-kit push regressions where the schema.ts and the SQL drift).
  - This file MUST be marked `// @vitest-environment node` because it uses `readFileSync` against `src/db/schema.ts`.

### Q8 — Local-first verification protocol for a schema-additions phase

**Answer:** Codified in the **Phase 78 Local Verification Sequence** under Validation Architecture above (12 steps). Summary: it is NOT `npm run dev` clicking — it is psql introspection + script smoke-test + vitest. The CLAUDE.md `## Local-First Development` rule applies generally ("verify in `npm run dev` against local Supabase before push"), but for schema-additions the runtime gate is psql `\d` + `\dx` + `\dy` introspection. The DAL gate (Drizzle `sql\`...\`` template literals not catching SQL syntax errors at compile time, per `[[drizzle-sql-any-array-pitfall]]`) IS still relevant for the dry-run script's queries — run the script against local before running against prod.

### Q9 — Catalog data shape on local

**Answer:** Local catalog row count is ~205 per CLAUDE.md (and `[[local-first-dev]]`). Distinct `lower(trim(brand))` values: cannot grep-count exactly from filesystem alone, but the seed-data JSON files (`scripts/seed-data/*.json`) reveal ~46 distinct surface brand strings (verified via `grep '"brand":' scripts/seed-data/*.json | sort -u | wc -l` → 63 raw lines reducing to ~46 distinct after normalization).

**For artifact sizing:**
- Total rows in `.md` artifact: ~46 (one per distinct lower-trim brand)
- Expected `auto-resolved` rows: ~40-43 (brands where `lower(trim(brand))` exact-matches some existing `brands.name_normalized`)
- Expected `needs-review` rows: ~3-6 (Hamilton/Hamilton Watch + Omega/OMEGA + Héron/Héron Watches + Brut Date/Brut Datejust + potential new microbrand ingest strings)

**Realistic operator workload:** scanning 46 rows in a markdown file takes ~3 minutes; editing the ~3-6 `needs-review` rows takes ~10 minutes. Phase 78 ships a manageable artifact. (Prod scale is similar order — prod catalog is ~205 rows per CLAUDE.md.)

**Recommend the planner:** include a Wave 0 step that runs `docker exec supabase_db_horlo psql -U postgres -d postgres -c "SELECT count(DISTINCT lower(trim(brand))) FROM watches_catalog"` and records the actual number in the plan so verification expectations are calibrated.

### Q10 — Brand → `brands.name_normalized` resolution query

**Answer:** The Phase 78 lookup is a simple LEFT JOIN — `brands.name_normalized` is already a GENERATED column = `lower(trim(name))`, and `watches_catalog.brand_normalized` is already a GENERATED column = `lower(trim(brand))`. Equality joins on these columns ARE the exact-only auto-resolve per D-78-04.

```sql
-- Q10 query, used by Stage 1+2 of the dry-run script
SELECT DISTINCT
  wc.brand AS brand_raw,
  wc.brand_normalized,
  b.id AS proposed_target_id  -- NULL on no exact match → routes to 'needs-review'
FROM public.watches_catalog wc
LEFT JOIN public.brands b
  ON b.name_normalized = wc.brand_normalized
ORDER BY wc.brand_normalized
```

**Field shapes:**
- `wc.brand_raw` (TEXT) — the actual catalog row's brand as-typed (preserves casing for the artifact's `brand_raw` column)
- `wc.brand_normalized` (TEXT, GENERATED) — `lower(trim(brand))`, the artifact's `normalized` column
- `b.id` (UUID) — the proposed target brand_id; NULL when no exact match

**Why DISTINCT on `wc.brand_raw`?** Multiple catalog rows can share the same `lower(trim(brand))` (e.g. "Hamilton Watch" appears N times across N different model rows). The artifact wants one row per distinct brand, not per catalog row. The DISTINCT trio `(brand_raw, brand_normalized, proposed_target_id)` collapses on equality — since `brand_normalized` and `proposed_target_id` are functions of `brand_raw`, each DISTINCT `lower(trim(brand))` produces exactly one artifact row. **Caveat:** if two different `brand_raw` strings normalize to the same `brand_normalized` (e.g. `"Hamilton"` and `"hamilton"`), the artifact will have TWO rows — both with the same `normalized` and same `proposed_target_id`. This is correct: the operator sees both raw strings and confirms they collapse on the same brand_id. To produce one row per distinct `brand_normalized` instead, use `DISTINCT ON (brand_normalized)`. **Recommendation: use DISTINCT ON (brand_normalized) ORDER BY brand_normalized, brand_raw** — one row per normalized key, pick the alphabetically-first `brand_raw` as the representative, like `scripts/backfill-catalog-brands.ts:51-65` does.

## Sources

### Primary (HIGH confidence — codebase grep verified)
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-CONTEXT.md` — D-78-01..08 locked decisions
- `.planning/REQUIREMENTS.md:30-43` — CANON-03, CANON-04, MIG-01, MIG-05 requirement text
- `.planning/ROADMAP.md:267-278` — Phase 78 success criteria
- `src/db/schema.ts:440-555` — current `watches_catalog`, `brands`, `watch_families` definitions
- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` — precedent for `extensions`-prefixed function pattern + pinned `SET search_path` + post-flight assertion phrasing
- `supabase/migrations/20260510000000_phase34_brands_families.sql:64-99` — additive ADD COLUMN pattern + DO $$ assertion block
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql:103-145` — `watches_catalog_natural_key` UNIQUE constraint + GIN trigram indexes
- `scripts/inventory-explore-catalog.ts:14-203` — `postgres` lib + markdown line-array emission pattern
- `scripts/backfill-catalog-brands.ts:25-156` — `db.execute(sql\`...\`)` + DISTINCT ON brand_normalized pattern + final assertion idiom
- `scripts/factual-apply.ts:200-314` — `existsSync` review-file gate + `--dry-run` flag pattern + migration generation
- `src/data/catalog.ts:511-566` — DAL-side `word_similarity` + `f_unaccent` invocation
- `src/data/recommendations.ts:430-460` — `sql.join` IN-list pattern (forward armor against ANY-array footgun)
- `tests/static/legacy-watch-routes.test.ts:1-56` — `// @vitest-environment node` + `prebuild` static-guard pattern
- `tests/integration/migration-drop-archetype.test.ts:1-26` — `DATABASE_URL ? describe : describe.skip` integration test idiom
- `package.json:13-31` — `db:*` script entries + `prebuild: vitest run tests/static/`
- Memory: `[[drizzle-supabase-db-mismatch]]` — filename + ordering + extension schema gotchas
- Memory: `[[supabase-extension-schema-function-pin]]` — pinned `SET search_path` for IMMUTABLE wrappers
- Memory: `[[pg-trgm-word-similarity-for-brand-typos]]` — `word_similarity` not `similarity`
- Memory: `[[drizzle-sql-any-array-pitfall]]` — never `sql\`= ANY(${arr})\``
- Memory: `[[local-catalog-natural-key-drift]]` — `watches_catalog_natural_key` post-drizzle-push verification
- Memory: `[[local-first-dev]]` — local-first verification rule
- Memory: `[[post-flight-assertion-predicate-divergence]]` — assertions phrased differently from the operation
- Memory: `[[vitest-static-node-env]]` — `// @vitest-environment node` for fs-walking guards
- Memory: `[[next-clear-operational-debt]]` — `workflow.use_worktrees: false` globally set

### Secondary (MEDIUM confidence — single-source web docs)
- [PostgreSQL Documentation: GIN Builtin Operator Classes](https://www.postgresql.org/docs/16/gin-builtin-opclasses.html) — `array_ops` supports `@>` (strategy 2), `<@`, `=`, `&&`
- [PostgreSQL Documentation: GIN Indexes](https://www.postgresql.org/docs/current/gin.html) — general GIN behavior

### Tertiary (LOW confidence — assumptions to verify)
- Assumption A3 (the four SEED-021 case strings are actually present in local seeded catalog) — verify with `psql` before plan finalization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed, every pattern has direct codebase precedent
- Architecture: HIGH — `inventory-explore-catalog.ts` + `backfill-catalog-brands.ts` + the precedent migration cover every primitive Phase 78 needs
- Pitfalls: HIGH — 6 pitfalls drawn from project memories and the precedent code, all with concrete avoidance pattern

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (30 days — stable additive migration + read-only script; no fast-moving dependencies)
