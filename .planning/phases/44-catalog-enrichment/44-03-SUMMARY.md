---
phase: 44-catalog-enrichment
plan: "03"
subsystem: data-scripts
tags: [factual-fill, catalog-enrichment, web-search, sql-migration, ENRH-05]
dependency_graph:
  requires: [44-01]
  provides: [factual-propose-script, factual-apply-script, sanitizeHttpUrl-export]
  affects: [src/data/catalog.ts, scripts/, tests/integration/backfill-taste.test.ts, package.json]
tech_stack:
  added: []
  patterns: [gap-driven-factual-fill, operator-review-gate, 14-digit-migration-filename, JSONL-review-ledger]
key_files:
  created:
    - scripts/factual-propose.ts
    - scripts/factual-apply.ts
  modified:
    - src/data/catalog.ts
    - tests/integration/backfill-taste.test.ts
    - package.json
decisions:
  - "sanitizeHttpUrl exported from src/data/catalog.ts (not duplicated in factual-apply) per PATTERNS.md Shared Pattern 6"
  - "Gap row detection uses array_length(style_tags, 1) IS NULL (not style_tags = '{}') matching the plan spec exactly"
  - "factual-propose dry-run exits 0 without ANTHROPIC_API_KEY — guards the key only on live runs"
  - "factual-apply test uses absolute env-file path to work in the worktree where .env.local is in main repo"
  - "image_source_page_url field maps to image_source_url column in the DB (D-04: operator supplies final image URL)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 44 Plan 03: Factual-Fill Scripts Summary

**One-liner:** Gap-driven `factual-propose.ts` proposes LLM+web_search factual values into a hand-editable JSONL review file; `factual-apply.ts` validates approved entries and emits a 14-digit-timestamped SQL migration — LLM never writes factual columns directly (ENRH-05).

## What Was Built

### Task 1: Export sanitizeHttpUrl + factual-propose.ts

**`src/data/catalog.ts`** — Added `export` to `sanitizeHttpUrl` so `factual-apply.ts` can import it without duplicating the implementation.

**`scripts/factual-propose.ts`** — Gap-driven web_search LLM proposer:
- Gap query: `WHERE movement_type IS NULL OR case_size_mm IS NULL OR array_length(style_tags, 1) IS NULL`
- `loadAlreadyProposed()` — scans existing JSONL review file, returns `Set<string>` of catalog_ids; re-runs skip already-proposed rows (D-13 resume ledger)
- `FACTUAL_TOOL` — Anthropic custom tool with `movement_type` (enum auto|manual|quartz|spring_drive), `case_size_mm` (number), `style_tags` (string array, maxItems 8), `image_source_page_url` (page URL, NOT direct image URL per D-04)
- Uses `enrichWithWebSearch` from Plan 01's `src/lib/taste/webSearch.ts` (two-turn pattern)
- `--dry-run`: prints gap count and would-be rows, makes no API calls, exits 0, requires no ANTHROPIC_API_KEY
- Per-row structured JSON log: `factual_propose_row_result` event with `status: success|failure|skipped`
- Handles `webSearchUnavailable: true` gracefully (logs `factual_propose_web_search_unavailable` event, continues)
- `db:factual-propose` npm script added to `package.json`

### Task 2: factual-apply.ts + dry-run test

**`scripts/factual-apply.ts`** — Operator-reviewed migration emitter:
- Reads JSONL review file, parses entries, filters to `approved === true` only
- T-44-08 validation gate before any SQL emission:
  - `movement_type`: allow-list check (auto|manual|quartz|spring_drive)
  - `case_size_mm`: finite number in range [20, 60]
  - `style_tags`: array-of-strings check
  - URL fields: run through `sanitizeHttpUrl` — rejects non-http/https (T-44-09)
  - Invalid entries dropped and logged, never emitted
- Groups validated entries by `catalog_id`, builds ONE `UPDATE watches_catalog SET ...` per row
- `generateMigrationFilename('phase44_factual_data')` — 14-digit `YYYYMMDDHHMMSS` prefix (Pitfall 3)
- Writes to `supabase/migrations/<filename>` with Phase-44 file-header comment block
- `--dry-run`: prints approved count and UPDATE statements, writes no file
- `db:factual-apply` npm script added to `package.json`

**`tests/integration/backfill-taste.test.ts`** — Added `describe('scripts/factual-apply.ts --dry-run')` block:
- Writes temp JSONL with one `approved: true` `movement_type` entry and one `approved: false` entry
- Runs `factual-apply.ts --dry-run --review-file=<temp>`
- Asserts output contains `DRY RUN` and `UPDATE watches_catalog` for the approved row
- Asserts output does NOT contain the rejected catalog_id
- Asserts no new `phase44_factual_data` file appeared in `supabase/migrations/`
- Cleans up temp file

## Verification Results

| Check | Result |
|-------|--------|
| `npm run db:factual-propose -- --dry-run` prints "DRY RUN" and "no API calls made" | PASS |
| `npm run db:factual-propose -- --dry-run` exits 0 with no ANTHROPIC_API_KEY | PASS |
| `factual-apply.ts --dry-run` prints "DRY RUN" + UPDATE for approved row, skips rejected | PASS |
| `factual-apply.ts --dry-run` writes no migration file to `supabase/migrations/` | PASS |
| `npm test -- --run tests/integration/backfill-taste.test.ts` new test passes | PASS |
| `npx tsc --noEmit` — no errors in new files | PASS |
| `package.json` contains `db:factual-propose` and `db:factual-apply` | PASS |
| Migration filename matches `^\d{14}_phase44_factual_data\.sql$` | PASS |
| LLM never writes factual columns — migration is only path | PASS (architecture enforced by design) |
| `style_tags` (NOT `design_motifs`) used in FACTUAL_TOOL | PASS (Pitfall 5 avoided) |

## Commits

| Hash | Message |
|------|---------|
| 108040f | feat(44-03): export sanitizeHttpUrl and build factual-propose.ts |
| cfeb7cc | feat(44-03): build factual-apply.ts and dry-run integration test |

## Deviations from Plan

None — plan executed exactly as written.

The 2 pre-existing test failures in `backfill-taste.test.ts` (`scripts/backfill-taste.ts --dry-run` and `scripts/reenrich-taste.ts`) are caused by the worktree environment where `.env.local` exists in the main repo but not in the worktree directory. These failures existed before this plan's changes. The new `factual-apply.ts --dry-run` test correctly uses the absolute env-file path and passes.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes at trust boundaries introduced. The scripts are CLI-only and all threat mitigations from the plan's `<threat_model>` were implemented:

- **T-44-08** (SQL injection): per-field validation + typed SQL literals in `factual-apply.ts`
- **T-44-09** (non-http URL): `sanitizeHttpUrl` on all URL fields in `factual-apply.ts`
- **T-44-10** (API key leak): per-row logs include only `catalog_id`, `status`, `timestamp`; key never logged
- **T-44-11** (direct image URL): FACTUAL_TOOL proposes only `image_source_page_url` (a page, not an image file)

## Self-Check

**Files exist:**
- `scripts/factual-propose.ts`: FOUND
- `scripts/factual-apply.ts`: FOUND
- `src/data/catalog.ts` (export added): FOUND

**Commits exist:**
- `108040f`: FOUND
- `cfeb7cc`: FOUND

## Self-Check: PASSED
