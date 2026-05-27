---
phase: 62-public-wear-pics-on-watch-detail
plan: 01
subsystem: database
tags: [drizzle, postgres, supabase, vitest, schema, migration]

# Dependency graph
requires:
  - phase: 60-watch-photos-schema-dal
    provides: wear_events table + boolean column pattern (watchPhotos uses boolean 'hidden' style)
provides:
  - hidden_from_detail boolean column on wear_events (schema + local DB + prod migration file)
  - Partial index on wear_events for public/not-hidden fast reads
  - Four Wave 0 test scaffolds (getPublicWearPicsForWatch, hideWearPic, WornTimeline, wearRail guardrail)
affects: [62-02-dal-union, 62-03-hide-action, 62-04-carousel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 test scaffold pattern: RED-allowed test files that import planned function names; downstream plans turn RED → GREEN"
    - "Source-level guardrail test: assert getWearRailForViewer function body still contains 48h cutoff token and visibility predicate AND does NOT reference hidden_from_detail"
    - "Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod migration file shipped now, applied at deploy via supabase db push --linked"

key-files:
  created:
    - src/db/schema.ts (hiddenFromDetail column added to wearEvents table)
    - supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql
    - tests/unit/getPublicWearPicsForWatch.test.ts
    - tests/unit/hideWearPic.test.ts
    - tests/unit/WornTimeline.test.tsx
    - tests/unit/wearRail.test.ts
  modified: []

key-decisions:
  - "hidden_from_detail is a dedicated persistent boolean on wear_events, separate from visibility — hide-from-detail is NOT a visibility change (D-11)"
  - "Wave 0 test scaffolds use concrete failing assertions (not .skip) so Plans 02-04 see RED→GREEN transitions"
  - "Partial index covers the exact wear-pic union query shape (visibility='public' AND hidden_from_detail=false) for cheap reads"

patterns-established:
  - "Source-level guardrail: read the target function from disk and assert key tokens present / absent; prevents silent behavioral regression across plans"

requirements-completed: [WPIC-02, WPIC-04]

# Metrics
duration: 20min
completed: 2026-05-27
---

# Phase 62 Plan 01: Add hiddenFromDetail Schema Column + Wave 0 Test Scaffolds Summary

**`hidden_from_detail boolean NOT NULL DEFAULT false` added to wear_events in schema + local DB via drizzle-kit push, prod migration written, four Wave 0 test scaffolds created with source-level guardrail for getWearRailForViewer**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-27T00:00:00Z
- **Completed:** 2026-05-27T00:20:00Z
- **Tasks:** 2 (Task 1 auto + Task 2 human-action checkpoint, resolved by user)
- **Files modified:** 7

## Accomplishments

- Added `hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false)` to `wearEvents` pgTable in `src/db/schema.ts`, inserted after `visibility` column with no change to any existing column (T-62-01 threat mitigated)
- Shipped prod migration `20260527000000_phase62_wear_hidden_from_detail.sql` with ADD COLUMN IF NOT EXISTS + partial index `wear_events_watch_id_public_visible_idx` covering the exact DAL union query shape
- Created four Wave 0 test scaffolds (`getPublicWearPicsForWatch.test.ts`, `hideWearPic.test.ts`, `WornTimeline.test.tsx`, `wearRail.test.ts`) — `wearRail.test.ts` PASSES as a source-level guardrail; the other three are RED-allowed, awaiting Plans 02-04 implementation
- Local DB updated via `drizzle-kit push` (user-confirmed: "Changes applied") closing the false-positive verification gap (RESEARCH Pitfall 4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hiddenFromDetail column to schema + write prod migration + Wave 0 test scaffolds** - `f22ce7b` (feat)
2. **Task 2: [BLOCKING] Apply schema to local DB via drizzle-kit push** - RESOLVED by user (drizzle-kit push, no source file commit)

**Plan metadata:** _(this SUMMARY commit)_

## Files Created/Modified

- `src/db/schema.ts` - Added `hiddenFromDetail` boolean column to wearEvents pgTable (after `visibility`, before `createdAt`)
- `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` - Prod migration: ADD COLUMN IF NOT EXISTS + partial index on (watch_id, worn_date DESC) WHERE visibility='public' AND hidden_from_detail=false
- `tests/unit/getPublicWearPicsForWatch.test.ts` - Wave 0 scaffold: WPIC-01 (public wear pic appears) + WPIC-05 (followers/private/hidden never returned); RED-allowed
- `tests/unit/hideWearPic.test.ts` - Wave 0 scaffold: WPIC-02 (hide sets hidden=true, excludes from re-query; un-hide restores; ownership check rejects non-owner); RED-allowed
- `tests/unit/WornTimeline.test.tsx` - Wave 0 scaffold: WPIC-03 (photoUrl preference — renders photoUrl when present, falls back to watch.imageUrl when null); RED-allowed
- `tests/unit/wearRail.test.ts` - Wave 0 GUARDRAIL: WPIC-04 asserts getWearRailForViewer still has 48h cutoff token + visibility followers-branch predicate AND does NOT reference hiddenFromDetail/hidden_from_detail; PASSES GREEN

## Decisions Made

- **D-11 honored**: `hidden_from_detail` is a NEW boolean column, not a mutation of `visibility`. The schema diff touched only the wearEvents column block with no changes to existing columns.
- **Wave 0 scaffolds use concrete failing assertions** (not `.skip` or `.todo`) so downstream plans clearly see RED→GREEN transitions.
- **Checkpoint resolution**: Task 2 was a `checkpoint:human-action` gate (drizzle-kit push requires interactive confirmation). User ran `npx drizzle-kit push` and confirmed "[✓] Changes applied" — no source file change needed; column is live locally.

## Deviations from Plan

None — plan executed exactly as written. The stub exports added to `src/data/wearEvents.ts` and `src/app/actions/wearEvents.ts` (so test scaffolds import cleanly) were explicitly called out in the plan as acceptable scaffold patterns; Plan 02 implements them fully.

## Issues Encountered

None. The `checkpoint:human-action` gate for `drizzle-kit push` was expected (flagged `autonomous: false` in the plan) and resolved cleanly by the user.

## User Setup Required

None — no external service configuration required beyond the drizzle-kit push already completed.

## Next Phase Readiness

- **62-02 (DAL union)**: `hidden_from_detail` is live in both schema.ts and the local DB — Drizzle types are accurate, and DAL queries can reference the column without drift. `getPublicWearPicsForWatch.test.ts` scaffold is the verify target.
- **62-03 (hide action)**: `hideWearPic.test.ts` scaffold provides the RED test target for `hideWearPicAction`/`unhideWearPicAction`.
- **62-04 (carousel UI)**: `WornTimeline.test.tsx` scaffold provides the RED test target for photoUrl-preference rendering.
- **Prod migration**: `20260527000000_phase62_wear_hidden_from_detail.sql` ships with the final phase deploy via `supabase db push --linked` (per dual-migration discipline; MEMORY project_drizzle_supabase_db_mismatch).
- No blockers.

---
*Phase: 62-public-wear-pics-on-watch-detail*
*Completed: 2026-05-27*
