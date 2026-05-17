---
phase: 44-catalog-enrichment
plan: "04"
subsystem: catalog-enrichment
tags: [verify-catalog-coverage, playbook, production-run, checkpoint, ENRH-04, ENRH-05, ENRH-06]
dependency_graph:
  requires:
    - 44-01 (backfill-taste.ts hardened, migration emit)
    - 44-02 (downgrade guard in updateCatalogTaste)
    - 44-03 (factual-propose.ts, factual-apply.ts)
  provides:
    - scripts/verify-catalog-coverage.ts (reusable ship gate for Phase 46)
    - .planning/phases/44-catalog-enrichment/44-RUN-PLAYBOOK.md
    - db:verify-catalog-coverage npm script
  affects:
    - Phase 46 (Browse/Archetypes) — can re-run db:verify-catalog-coverage as a pre-ship gate
tech_stack:
  added: []
  patterns:
    - Hard/soft exit-code assertion script (exit 1 on NULL taste/factual; exit 0 with console.warn on archetype gaps)
    - array_length(style_tags, 1) IS NULL for empty-array detection (NOT NULL DEFAULT '{}' column)
    - PRIMARY_ARCHETYPES 10-value vocab as ground truth for archetype coverage (D-16)
key_files:
  created:
    - scripts/verify-catalog-coverage.ts
    - .planning/phases/44-catalog-enrichment/44-RUN-PLAYBOOK.md
  modified:
    - package.json (db:verify-catalog-coverage script entry)
    - tests/integration/backfill-taste.test.ts (verify-catalog-coverage source-assertion tests)
decisions:
  - "array_length(style_tags, 1) IS NULL is the correct ENRH-05 emptiness check — a plain style_tags IS NULL always passes because the column is NOT NULL DEFAULT '{}'"
  - "Archetype gaps are soft-warn only (console.warn, exit 0) per D-16 — a ~100-watch catalog may legitimately lack e.g. a racing watch; expansion is v5.2 scope"
  - "Integration DB test is behind describe.skip pending Task 2 population — unskip after production run"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-17"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 4
---

# Phase 44 Plan 04: Coverage Verification Script + Operator Run Playbook

Coverage verification npm script (db:verify-catalog-coverage) and operator run playbook committed.
Plan halted at Task 2 human-action checkpoint: the production enrichment run requires operator
judgment (review-file approval, cover-photo image sourcing, prod migration push).

## What Was Built

### Task 1: scripts/verify-catalog-coverage.ts (new)

HARD/SOFT coverage verification script following the `refresh-counts.ts` minimal script shape:

**HARD assertion 1 — taste population:**
```sql
SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
```
Exit 1 if count > 0 (any row missing taste attributes).

**HARD assertion 2 — factual population (ENRH-05):**
```sql
SELECT count(*)::int AS c FROM watches_catalog
 WHERE movement_type IS NULL
    OR case_size_mm IS NULL
    OR array_length(style_tags, 1) IS NULL
```
`array_length(style_tags, 1) IS NULL` is the correct emptiness check — `style_tags` is
`NOT NULL DEFAULT '{}'` so a plain `style_tags IS NULL` would always pass even when the
array is empty. Exit 1 if count > 0.

**SOFT archetype distribution (D-16):**
```sql
SELECT primary_archetype, count(*)::int AS c
FROM watches_catalog
GROUP BY primary_archetype ORDER BY c DESC
```
Prints full distribution table. For every value in `PRIMARY_ARCHETYPES` (10 values from
`src/lib/taste/vocab.ts` — code is ground truth, not the stale "8" in docs), emits
`console.warn` if count = 0. Does NOT affect exit code.

### Task 1 (cont): package.json script entry

```json
"db:verify-catalog-coverage": "tsx --env-file=.env.local scripts/verify-catalog-coverage.ts"
```

### Task 1 (cont): tests/integration/backfill-taste.test.ts extensions

Added `describe('scripts/verify-catalog-coverage.ts')` block with 4 tests:
1. Source imports `PRIMARY_ARCHETYPES` from `../src/lib/taste/vocab`
2. Source contains `confidence IS NULL` (taste hard-assertion)
3. Source contains `movement_type IS NULL` (factual hard-assertion)
4. Source contains `array_length(style_tags, 1) IS NULL` (ENRH-05 style_tags emptiness check)

Integration test (exit-code check against populated local DB) is behind `describe.skip` —
unskip after Task 2 run completes.

All 13 tests pass (1 skipped). Source-assertion tests prove the script asserts against the
10-value vocab and all three hard dimensions without requiring a populated DB.

### Task 1 (cont): .planning/phases/44-catalog-enrichment/44-RUN-PLAYBOOK.md (new)

8-step operator playbook:
- Step 0: Preflight — confirm local Supabase up, ~101 catalog rows present, `.env.local`
  DATABASE_URL points at `127.0.0.1:54322` (NEVER prod), ANTHROPIC_API_KEY set, web_search
  enabled; post-reset re-seed command documented
- Step 1: Taste backfill — `--dry-run` preview then live `npm run db:backfill-taste`
- Step 2: Factual propose — `--dry-run` preview then live `npm run db:factual-propose`
- Step 3: Operator review — set `approved:true/false` per JSONL line, source cover-photo images
- Step 4: Factual apply — `--dry-run` preview then live `npm run db:factual-apply`
- Step 5: Taste migration confirmation — states explicitly that the live backfill-taste run
  from Step 1 ALREADY emitted `supabase/migrations/<14-digit>_phase44_taste_data.sql` (Plan 01
  Task 3 / D-14); no separate command needed; verify with `ls supabase/migrations/*phase44_taste_data*`
- Step 6: Apply migrations locally + run `npm run db:verify-catalog-coverage` (must exit 0)
- Step 7: Commit both phase44_* migration files
- Step 8: OPERATOR-GATED prod push — `supabase db push --linked` (requires SUPABASE_ACCESS_TOKEN);
  re-verify against prod; explicitly marked as the operator action

## Task 2: Pending Human-Action Checkpoint

Task 2 is a `checkpoint:human-action` — NOT executed by this agent. The operator must:

1. Run the full `44-RUN-PLAYBOOK.md` end to end (Steps 0–8)
2. Confirm `npm run db:verify-catalog-coverage` exits 0 against both local and prod
3. Confirm both `phase44_*` SQL data migrations are committed with 14-digit timestamps
4. Reply "approved" to resume the continuation agent

See checkpoint return block below for full instructions.

## Test Coverage

All tests in `tests/integration/backfill-taste.test.ts` pass (13 passed, 1 skipped).

## Deviations from Plan

None — Task 1 executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `verify-catalog-coverage.ts`
is read-only (SELECT queries only). `44-RUN-PLAYBOOK.md` is documentation only.

## Known Stubs

None — all exports are fully implemented. The integration DB test is behind `describe.skip`
intentionally pending Task 2 population (documented in plan, not a functionality stub).

## Self-Check: PASSED
