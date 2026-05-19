---
phase: 47-curated-lists-rail-hero-where-collections-go
plan: "01"
subsystem: database-schema-dal-utilities
tags: [schema, dal, migration, utilities, tests, wave-0]
dependency_graph:
  requires: [phase-45-cms-tables]
  provides: [published_at-column, setListStatus-extended, imageUrl-joins, getWeekIndex-utility, PATH_TYPES-utility, wave-0-test-scaffolds]
  affects: [src/data/curatedLists.ts, src/data/collectionPaths.ts, src/db/schema.ts, src/lib/weekIndex.ts, src/lib/pathTypes.ts]
tech_stack:
  added: []
  patterns: [drizzle-sql-template-coalesce, epoch-days-week-index, vi-hoisted-dal-mock]
key_files:
  created:
    - supabase/migrations/20260519000000_phase47_published_at.sql
    - src/lib/weekIndex.ts
    - src/lib/pathTypes.ts
    - src/lib/__tests__/weekIndex.test.ts
    - src/components/explore/__tests__/CuratedListsRail.test.tsx
    - src/components/explore/__tests__/HeroModule.test.tsx
    - src/components/explore/__tests__/WhereCollectionsGo.test.tsx
  modified:
    - src/db/schema.ts
    - src/data/curatedLists.ts
    - src/data/collectionPaths.ts
    - src/data/__tests__/curatedLists.test.ts
decisions:
  - "Epoch-days ÷ 7 week-index derivation chosen over ISO week (simpler, no year-boundary edge cases)"
  - "COALESCE(published_at, NOW()) in setListStatus avoids a round-trip read for first-transition guard"
  - "it.todo used for component scaffolds (vs it.skip) — test names are visible in output for planning clarity"
  - "Same-week stability test uses current epoch window boundary (not a hardcoded date) to avoid boundary-crossing false failures"
metrics:
  duration: "5m 9s"
  completed_date: "2026-05-19"
  tasks_completed: 4
  files_changed: 11
---

# Phase 47 Plan 01: Schema + DAL Foundation Summary

Laid the schema, DAL, and shared-utility foundation for all Phase 47 render plans — `published_at` column added to `curated_lists` via Drizzle schema + local DB push, `setListStatus` extended with COALESCE stamp, `getListItems`/`getPathNodes`/seed query extended with `imageUrl`, plus `getWeekIndex` and `PATH_TYPES` shared utilities and five Wave 0 test files.

## What Was Built

### Task 1: published_at column + migration + shared utilities

**`src/db/schema.ts`** — Added nullable `publishedAt: timestamp('published_at', { withTimezone: true })` to the `curatedLists` table definition, placed between `sortOrder` and `createdAt` per the migration ordering assumption (D-02).

**`supabase/migrations/20260519000000_phase47_published_at.sql`** — Plain DDL: `ADD COLUMN IF NOT EXISTS published_at timestamptz` + idempotent backfill `SET published_at = created_at WHERE status = 'published' AND published_at IS NULL` (D-03). Filename sorts after `20260518210000_phase45_cms_covers_bucket.sql`.

**`src/lib/weekIndex.ts`** — Exports `getWeekIndex(now: Date): number` using epoch-days ÷ 7 formula. Single shared source for Hero (D-07) and WhereCollectionsGo (D-13) rotation.

**`src/lib/pathTypes.ts`** — Exports `PATH_TYPES` four-value `as const` tuple and `PathType` type, extracted from `src/app/actions/cms/collectionPaths.ts:33` to allow `/explore/paths` Server Component page to import without touching a `'use server'` file.

### Task 2: setListStatus + imageUrl DAL joins

**`src/data/curatedLists.ts`** — `setListStatus` now conditionally adds `publishedAt: sql\`COALESCE(${curatedLists.publishedAt}, NOW())\`` to the update fields only when `status === 'published'`. `getListItems` select object extended with `imageUrl: watchesCatalog.imageUrl`.

**`src/data/collectionPaths.ts`** — `getPathNodes` select extended with `imageUrl: watchesCatalog.imageUrl`. The seed watch query inside `getPathWithNodes` also extended with `imageUrl: watchesCatalog.imageUrl`.

### Task 3: Local DB push

`npx drizzle-kit push` applied the `published_at` column to the local Supabase database. Confirmed via `information_schema.columns` query. No interactive prompt was required; drizzle-kit accepted the additive column change automatically.

### Task 4: Wave 0 test scaffolds

- **`src/lib/__tests__/weekIndex.test.ts`** — 4 passing tests: same-week stability (using epoch window boundary), +7-day increment, monotonicity over 12 weeks, non-negative integer return.
- **`src/data/__tests__/curatedLists.test.ts`** — 2 new Phase 47 tests appended to Phase 45 file: `setListStatus('published')` sets `publishedAt`, `setListStatus('draft')` does not.
- **`src/components/explore/__tests__/CuratedListsRail.test.tsx`** — 4 `it.todo` cases covering EXPL-06 null-hide and card render.
- **`src/components/explore/__tests__/HeroModule.test.tsx`** — 5 `it.todo` cases covering EXPL-08 null-hide, pin override, rotation fallback.
- **`src/components/explore/__tests__/WhereCollectionsGo.test.tsx`** — 5 `it.todo` cases covering EXPL-09 null-hide, rotation, path-type chip.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `0bd79c8` | feat(47-01): add published_at column, migration, and shared utilities |
| Task 2 | `5ef2451` | feat(47-01): extend setListStatus with COALESCE published_at stamp + imageUrl joins |
| Task 3 | (DB only) | No source file commit — local DB push only |
| Task 4 | `4d92fd4` | test(47-01): Wave 0 test scaffolds — weekIndex + setListStatus tests passing; component scaffolds |

## Verification

- `npx tsc --noEmit` — no new errors in plan files (pre-existing errors in `u/[username]/layout.tsx`, `RecentlyEvaluatedRail.test.tsx`, `SearchPageClient.test.tsx` are carryover from STATE.md)
- `npm test -- --run` for 5 Wave 0 files — exits 0 (14 passing, 14 todo/skipped)
- Local DB `curated_lists` has `published_at` column (verified via information_schema)
- Migration filename sorts correctly after `20260518210000_phase45_cms_covers_bucket.sql`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Epoch boundary in same-week stability test**
- **Found during:** Task 4 test execution
- **Issue:** The initial test used `2020-01-01` as the base date + 3 days, which happened to straddle an epoch-days week boundary (week 2608 vs 2609), causing the same-week stability assertion to fail
- **Fix:** Changed test to compute the current epoch window boundary dynamically (`Math.floor(Date.now() / WEEK_MS) * WEEK_MS`) so the "within same window" sample is guaranteed to not cross a boundary
- **Files modified:** `src/lib/__tests__/weekIndex.test.ts`
- **Commit:** `4d92fd4`

**2. [Rule 3 - Blocking] Files written to wrong path**
- **Found during:** Task 1 commit
- **Issue:** Initial Write/Edit calls used `/Users/tylerwaneka/Documents/horlo/src/...` paths which resolved to the main repo, not the worktree. Git commits must land on the `worktree-agent-*` branch.
- **Fix:** Detected via `git worktree list`, copied files to worktree path, reverted main repo, then re-applied changes using worktree-scoped absolute paths
- **Files modified:** All Task 1 files
- **Commit:** `0bd79c8`

## Known Stubs

None. This plan creates only schema, DAL, utilities, and tests — no UI components with stubs.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's `<threat_model>` describes. The migration is plain DDL (no SECURITY DEFINER functions — T-47-04 verified). The `imageUrl` extension exposes public catalog data (T-47-02 accepted by design).

## Self-Check: PASSED

- `src/db/schema.ts` — exists and contains `publishedAt` column: FOUND
- `supabase/migrations/20260519000000_phase47_published_at.sql` — exists with ADD COLUMN + backfill: FOUND
- `src/lib/weekIndex.ts` — exports `getWeekIndex`: FOUND
- `src/lib/pathTypes.ts` — exports `PATH_TYPES` and `PathType`: FOUND
- Commit `0bd79c8` — feat(47-01): schema + utilities: FOUND
- Commit `5ef2451` — feat(47-01): DAL extensions: FOUND
- Commit `4d92fd4` — test(47-01): Wave 0 scaffolds: FOUND
- 5 Wave 0 test files — all present and green: FOUND
