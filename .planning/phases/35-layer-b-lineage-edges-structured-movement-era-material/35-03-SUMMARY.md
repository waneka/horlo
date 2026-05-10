---
phase: 35
plan: "03"
subsystem: typescript-consumer-sweep
tags:
  - typescript
  - consumer-sweep
  - movement-enum
  - extractor
  - dal
  - tests
  - phase35

dependency_graph:
  requires:
    - 35-02  # MovementType 4-value enum + schema columns
  provides:
    - movement-enum-consumer-sweep-complete
  affects:
    - src/app/actions/watches.ts
    - src/lib/extractors/llm.ts
    - src/lib/verdict/shims.ts
    - src/lib/verdict/shims.test.ts
    - src/lib/types.ts
    - src/data/watches.ts
    - src/data/catalog.ts
    - src/components/watch/WatchForm.tsx
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/CatalogPageActions.tsx
    - src/components/search/WatchSearchRowsAccordion.tsx
    - src/components/watch/WatchCard.tsx
    - src/components/watch/WatchDetail.tsx
    - src/components/watch/VerdictStep.tsx
    - src/lib/stats.ts
    - src/app/catalog/[catalogId]/page.tsx
    - src/app/watch/new/page.tsx
    - src/app/actions/wishlist.ts
    - src/app/api/extract-watch/route.ts
    - scripts/backfill-taste.ts
    - scripts/reenrich-taste.ts
    - 54+ test files across src/ tests/

tech_stack:
  patterns:
    - "MovementType | undefined return type mirrors coerceCrystal sibling pattern"
    - "MOVEMENT_LABELS[type] for display instead of capitalize CSS"
    - "movementType DB column, movement Watch domain field (intentional naming split per Q1)"

key_files:
  modified:
    - src/lib/types.ts
    - src/lib/extractors/llm.ts
    - src/lib/verdict/shims.ts
    - src/lib/verdict/shims.test.ts
    - src/app/actions/watches.ts
    - src/data/watches.ts
    - src/data/catalog.ts
    - src/components/watch/WatchForm.tsx

decisions:
  - "Q1: Watch.movement field name preserved (not renamed to movementType) — DB column vs domain field intentional split"
  - "Q2: coerceMovement returns MovementType | undefined; no 'other' fallback; mirrors coerceCrystal"
  - "Q3: upsertCatalogFromExtractedUrl writes movement_type with ::movement_type_enum cast"
  - "CatalogEntry.movement → movementType + movementCaliber fields (types.ts updated)"

metrics:
  duration: "~18 minutes"
  completed_date: "2026-05-10"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 71
---

# Phase 35 Plan 03: Layer B TS Consumer Sweep Summary

TS consumer sweep replacing all old movement string literals ('automatic', 'spring-drive', 'other') with the 4-value DB-canonical enum ('auto', 'manual', 'quartz', 'spring_drive') across the entire src/ and tests/ surfaces. After this plan, `npx tsc --noEmit` produces zero movement-related errors and `npx vitest run src/components src/lib` exits 0 (173 tests pass).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Zod schema + LLM prompt for 4-value movement enum | ce5fccb |
| 2 | Restructure shims.ts + CatalogEntry type + shims.test.ts | 7e7e865 |
| 3 | Component fallback sweep + 12 test fixture files | 6c3b445 |
| 4 | DAL (watches.ts + catalog.ts) + full codebase cascade | 0bf392c |

## What Was Built

**Round A — Server validation + extractor (Task 1):**
- `watches.ts` Zod schema: `z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional()`
- `llm.ts` EXTRACTION_PROMPT: `"movement": "auto|manual|quartz|spring_drive"`
- `validateAndCleanData` guard already used `MOVEMENT_TYPES.includes()` — no change needed

**Round B — Shims structural change (Task 2):**
- `KNOWN_MOVEMENTS` rebuilt to 4-value set
- `coerceMovement` signature: `string | null | undefined → MovementType | undefined` (mirrors `coerceCrystal`)
- `catalogEntryToSimilarityInput` reads `entry.movementType ?? null`
- `CatalogEntry` in `types.ts`: `movement: string | null` replaced by `movementType: MovementType | null` + `movementCaliber: string | null`
- `shims.test.ts`: `toBe('other')` → `toBeUndefined()` for unknown movement test

**Round C — Component fallback sweep (Task 3):**
- `WatchForm.tsx`: default 'automatic' → 'auto'; dropdown uses `MOVEMENT_LABELS[type]` instead of `capitalize` CSS (fixes "Spring_drive" rendering)
- `AddWatchFlow.tsx`: 2 fallback sites updated
- `CatalogPageActions.tsx` + `WatchSearchRowsAccordion.tsx`: updated
- 12 test fixture files: `movement: 'automatic'` → `movement: 'auto'` (Watch fixtures) + `CatalogEntry` fixtures updated to `movementType` field

**Round D — DAL + cascade (Task 4):**
- `watches.ts`: `mapRowToWatch` reads `row.movementType ?? undefined`; `mapDomainToRow` writes `row.movementType`; `createWatch` insert uses `movementType`
- `catalog.ts`: `UrlExtractedCatalogInput` gains `movementType` + `movementCaliber`, drops `movement: string | null`; `mapRowToCatalogEntry` maps new columns; `upsertCatalogFromExtractedUrl` writes `movement_type` with `::movement_type_enum` cast
- 6 downstream src/ files fixed (catalog page, wishlist action, extract route, WatchCard, WatchDetail, stats.ts, VerdictStep.tsx)
- 2 scripts fixed (backfill-taste.ts, reenrich-taste.ts)
- 41 test files in tests/ updated (all 'automatic' → 'auto'; Drizzle inserts use `movementType` column)

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — Bug)

**1. [Rule 1 - Bug] CatalogEntry.movement field cascade**
- **Found during:** Task 2 (when updating shims.ts to read `entry.movementType`)
- **Issue:** `CatalogEntry` type in `types.ts` still had `movement: string | null` after Plan 02 only changed the DB schema and Drizzle schema. Updating shims.ts to read `entry.movementType` required updating `CatalogEntry` in types.ts first.
- **Fix:** Replaced `movement: string | null` with `movementType: MovementType | null` + `movementCaliber: string | null` in `CatalogEntry` interface.
- **Files modified:** `src/lib/types.ts`
- **Commit:** 7e7e865

**2. [Rule 1 - Bug] Downstream CatalogEntry.movement reads**
- **Found during:** Task 4 (TypeScript check)
- **Issue:** 4 files read `entry.movement` or `catalogEntry.movement` from CatalogEntry (now renamed to movementType)
- **Fix:** Updated `catalog/[catalogId]/page.tsx` (2 sites), `watch/new/page.tsx`, `actions/wishlist.ts`
- **Files modified:** `src/app/catalog/[catalogId]/page.tsx`, `src/app/watch/new/page.tsx`, `src/app/actions/wishlist.ts`
- **Commit:** 0bf392c

**3. [Rule 1 - Bug] Display sites showing raw enum values**
- **Found during:** Task 4 (reviewing downstream .movement usages)
- **Issue:** `WatchCard.tsx`, `WatchDetail.tsx`, `VerdictStep.tsx`, `stats.ts` displayed `watch.movement` with `capitalize` CSS — would show "auto" instead of "Automatic", "spring_drive" instead of "Spring Drive"
- **Fix:** Added MOVEMENT_LABELS import and replaced raw value display with `MOVEMENT_LABELS[watch.movement]`
- **Files modified:** `src/components/watch/WatchCard.tsx`, `src/components/watch/WatchDetail.tsx`, `src/components/watch/VerdictStep.tsx`, `src/lib/stats.ts`
- **Commit:** 0bf392c

**4. [Rule 1 - Bug] scripts/ reference watchesCatalog.movement (old column)**
- **Found during:** Task 4 (TypeScript check)
- **Issue:** `backfill-taste.ts` and `reenrich-taste.ts` referenced `watchesCatalog.movement` which no longer exists in Drizzle schema
- **Fix:** Updated to `watchesCatalog.movementType`; enricher spec still receives `movement: row.movementType ?? null` (EnrichmentSpecInput.movement is `string | null`)
- **Files modified:** `scripts/backfill-taste.ts`, `scripts/reenrich-taste.ts`
- **Commit:** 0bf392c

**5. [Rule 1 - Bug] tests/ Drizzle inserts used old movement column**
- **Found during:** Task 4 (TypeScript check)
- **Issue:** 10+ integration test files inserted directly into `watches` table with `movement:` key instead of `movementType:`
- **Fix:** Bulk sed replacement distinguishing Drizzle inserts (→ movementType) from Watch domain objects (→ movement: 'auto')
- **Files modified:** 10+ tests/integration/ files
- **Commit:** 0bf392c

### Pre-existing TS Errors (Out of Scope)

30 TypeScript errors remain in the codebase, all pre-existing and unrelated to movement:
- `RecentlyEvaluatedRail.test.tsx` — `verdict` prop missing (unrelated type regression)
- `DesktopTopNav.test.tsx` — duplicate `href` identifier (pre-existing)
- `PreferencesClient.debt01.test.tsx` — `UserPreferences` undefined (pre-existing debt)
- `WatchForm.isChronometer/notesPublic.test.tsx` — spread argument issues (pre-existing)
- `phase17-extract-route-wiring.test.ts` — null vs string | undefined (pre-existing)
- `PreferencesClientEmbedded.test.tsx` — unused `@ts-expect-error` (pre-existing)

These are logged to deferred-items and not fixed (Rule scope boundary).

## Verification Results

- `npx tsc --noEmit` — 0 movement-related errors; 30 pre-existing errors out of scope
- `npx vitest run src/components src/lib` — 173 tests pass (22 test files)
- Round D grep: zero `'automatic'` or `'spring-drive'` in movement context across all src/
- `shims.test.ts` asserts `toBeUndefined()` for unknown movement (not `toBe('other')`)
- `WatchForm` dropdown displays "Spring Drive" (via MOVEMENT_LABELS, not capitalize CSS)
- `catalog.ts` upsert path writes `movement_type` column with `::movement_type_enum` cast

## Known Stubs

None. All movement fields are properly wired.

## Threat Flags

None. The Zod boundary at `watches.ts` now correctly constrains to 4 values (T-35-CONS-01 mitigated). The LLM extractor cleanWatch guard uses MOVEMENT_TYPES.includes() (T-35-CONS-02 mitigated). shims.ts coerceMovement returns undefined for unknown values (T-35-CONS-03 accepted).

## Self-Check: PASSED

- src/lib/verdict/shims.ts — FOUND
- src/data/catalog.ts — FOUND
- src/data/watches.ts — FOUND
- ce5fccb (Task 1) — FOUND in git log
- 7e7e865 (Task 2) — FOUND in git log
- 6c3b445 (Task 3) — FOUND in git log
- 0bf392c (Task 4) — FOUND in git log
