---
phase: 35
plan: 06
subsystem: scripts
tags:
  - backfill
  - scripts
  - deploy-runbook
  - phase35
dependency_graph:
  requires:
    - 35-02  # families.json and lineage-edges.json seed files
    - 35-05  # Phase 35 migration (watch_families table, watch_lineage_edges table)
  provides:
    - operator surface for Plan 07 prod deploy
    - db:backfill-catalog-families npm script
    - db:backfill-catalog-lineage npm script
    - Phase 35 deploy runbook section
  affects:
    - docs/deploy-db-setup.md
    - package.json
tech_stack:
  added: []
  patterns:
    - "Phase 34 backfill-catalog-brands.ts pattern (tsx relative imports, ON CONFLICT DO NOTHING, process.exit bookends)"
    - "D-12 idempotent family insert + WHERE family_id IS NULL catalog link"
    - "D-12 ref-triple resolver (brand_slug/family_slug/reference → watches_catalog.id)"
key_files:
  created:
    - scripts/backfill-catalog-families.ts
    - scripts/backfill-catalog-lineage.ts
  modified:
    - package.json
    - docs/deploy-db-setup.md
decisions:
  - "Q4 resolution honored: unresolvable brand_slug in families script logs WARN and skips — does NOT exit 1"
  - "lineage script skips on unresolvable refs (WARN + skip); no placeholder catalog inserts — preserves SEED-001 provenance"
  - "::uuid and ::lineage_relationship_type casts explicit in INSERT VALUES for type safety"
  - "Process.exit(0)/(1) bookends required because postgres.js pool does not auto-close"
  - "Deploy runbook opens with bold TRUNCATE WARNING — first prod data wipe in project history"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 35 Plan 06: Backfill Scripts + npm Wiring + Deploy Runbook Summary

**One-liner:** Two idempotent backfill scripts (families + lineage edges) with ref-triple resolver, npm wiring via `tsx --env-file=.env.local`, and Phase 35 deploy runbook section with TRUNCATE warning and 6-step D-14 deploy order.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | backfill-catalog-families.ts | ec69f42 | scripts/backfill-catalog-families.ts |
| 2 | backfill-catalog-lineage.ts | 87d0f1e | scripts/backfill-catalog-lineage.ts |
| 3 | package.json + deploy-db-setup.md | a89c7b1 | package.json, docs/deploy-db-setup.md |

## What Was Built

### `scripts/backfill-catalog-families.ts`

Mirrors the Phase 34 `backfill-catalog-brands.ts` pattern exactly. Two-pass structure:

- **Pass A:** For each entry in `scripts/seed-data/families.json`, resolves `brand_slug` to `brands.id` via a CTE, then INSERTs into `watch_families (brand_id, name, slug)` with `ON CONFLICT (brand_id, name_normalized) DO NOTHING`. If `brand_slug` does not resolve (brand not yet seeded), emits `console.warn` and increments a `skipped` counter — does not exit 1 (Q4 resolution).

- **Pass B:** Runs a single `UPDATE watches_catalog SET family_id = wf.id FROM watch_families wf WHERE wc.brand_id = wf.brand_id AND lower(trim(wc.model)) = wf.name_normalized AND wc.family_id IS NULL`. The `WHERE family_id IS NULL` filter makes re-runs no-ops.

- **Final assertion:** Queries `SELECT count(*) FROM watch_families` and exits 1 if the table is empty after Pass A (catches silent failures).

### `scripts/backfill-catalog-lineage.ts`

Single-pass edge inserter with a `resolveRef(triple: string): Promise<string | null>` helper:

- Parses `"brand_slug/family_slug/reference"` triples, emitting `console.warn` on malformed format (not exactly 3 parts)
- Resolves to `watches_catalog.id` via `JOIN brands b ON b.id = wc.brand_id JOIN watch_families wf ON wf.id = wc.family_id WHERE b.slug = $brandSlug AND wf.slug = $familySlug AND wc.reference_normalized = regexp_replace(lower(trim($ref)), '[^a-z0-9]+', '', 'g')`
- If either `predId` or `succId` is null, emits `console.warn` and skips — no placeholder catalog row insertion (preserves SEED-001 catalog provenance per D-12)
- INSERT uses `ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING` per D-07; explicit `::uuid` and `::lineage_relationship_type` casts
- Cycle trigger (Plan 05 BEFORE INSERT trigger) fires on cycle-completing edges; the `catch` block surfaces the RAISE EXCEPTION

### `package.json` additions

```json
"db:backfill-catalog-families": "tsx --env-file=.env.local scripts/backfill-catalog-families.ts",
"db:backfill-catalog-lineage":  "tsx --env-file=.env.local scripts/backfill-catalog-lineage.ts"
```

### `docs/deploy-db-setup.md` — Phase 35 section

Appended `## Phase 35 — Layer B: Lineage Edges + Structured Movement + Era/Material Deploy Steps` with:
- Bold TRUNCATE WARNING (first prod data wipe in project history)
- **35.0:** pg_depend pre-flight query (D-03b verbatim) — zero-rows expected before proceeding
- **35.1:** `supabase db push --linked` migration sequence with DO $$ rollback note
- **35.2:** `db:backfill-catalog` (Phase 17 re-seed)
- **35.3:** `db:backfill-catalog-brands` (Phase 34 re-seed)
- **35.4:** `db:backfill-catalog-families` (NEW)
- **35.5:** `db:backfill-catalog-lineage` (NEW)
- **35.6:** Smoke-test SELECTs (RLS, row counts, column type checks)
- **35.7:** Cycle trigger manual smoke test (attempt C→A INSERT after A→B, B→C chain; expect RAISE EXCEPTION)
- **35.8:** Local DB re-sync steps post-Phase-35

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both scripts are complete implementations. The scripts will emit warnings and skip gracefully when the DB is not yet populated (expected behavior during local dev or before Plan 07 runs), but this is intentional design, not a stub.

## Threat Flags

None — these files are operator scripts (not network-accessible endpoints), env-loaded via `.env.local` or operator-supplied `DATABASE_URL` override. Threat T-35-SCRIPT-01 (service-role in backfill scripts) is documented in the script header and the runbook.

## Self-Check: PASSED

### Created files exist

- FOUND: scripts/backfill-catalog-families.ts
- FOUND: scripts/backfill-catalog-lineage.ts
- FOUND: docs/deploy-db-setup.md (modified)
- FOUND: package.json (modified)

### Commits exist

- FOUND: ec69f42 — feat(35-06): add backfill-catalog-families.ts
- FOUND: 87d0f1e — feat(35-06): add backfill-catalog-lineage.ts
- FOUND: a89c7b1 — feat(35-06): wire npm scripts + append Phase 35 deploy runbook section
