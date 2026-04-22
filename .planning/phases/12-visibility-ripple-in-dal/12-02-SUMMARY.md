---
phase: 12-visibility-ripple-in-dal
plan: "02"
subsystem: dal
tags: [visibility, wear-events, three-tier, privacy, wywt]
dependency_graph:
  requires: [12-01]
  provides: [getWearEventsForViewer, WearVisibility, WywtTile.visibility]
  affects: [src/data/wearEvents.ts, src/lib/wywtTypes.ts, src/lib/wearVisibility.ts, src/app/u/[username]/[tab]/page.tsx]
tech_stack:
  added: []
  patterns: [three-tier-visibility-predicate, drizzle-leftjoin-per-row, self-bypass-G5, profile-public-outer-gate-G4]
key_files:
  created:
    - src/lib/wearVisibility.ts
  modified:
    - src/data/wearEvents.ts
    - src/lib/wywtTypes.ts
    - src/app/u/[username]/[tab]/page.tsx
    - next.config.ts
decisions:
  - Explicit literal union for WearVisibility (not typeof wearVisibilityEnum.enumValues[number]) per RESEARCH Open Question #2
  - Per-profile follow check (single boolean) instead of leftJoin in getWearEventsForViewer — cheaper for profile page where follow direction is one row not per-event
  - Explicit SELECT projection in getWearEventsForViewer to avoid Drizzle nested shape from innerJoin
metrics:
  duration: ~25min
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 5
---

# Phase 12 Plan 02: Three-Tier Visibility Predicate in Wear DAL Summary

**One-liner:** Renamed `getPublicWearEventsForViewer` → `getWearEventsForViewer` with three-tier predicate (public/followers/private × owner/follower/stranger); `getWearRailForViewer` WHERE rewritten with `leftJoin(follows)` dropping `wornPublic`; `WywtTile` extended with `visibility: WearVisibility`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WearVisibility type module | `4b2f834` | src/lib/wearVisibility.ts, next.config.ts |
| 2 | Rewrite wearEvents DAL + extend WywtTile | `697d97a` | src/data/wearEvents.ts, src/lib/wywtTypes.ts, src/app/u/[username]/[tab]/page.tsx |

## Diff Summary

### src/data/wearEvents.ts
- **Before:** 202 lines. `getPublicWearEventsForViewer` gated on `profileSettings.wornPublic` boolean. `getWearRailForViewer` SELECT included `wornPublic`, WHERE used `eq(profileSettings.wornPublic, true)`.
- **After:** 243 lines. `getWearEventsForViewer` implements three-tier predicate with self-bypass (G-5), follow check, and `visibilityPredicate` OR. `getWearRailForViewer` adds `leftJoin(follows, ...)` for per-row direction check; WHERE uses three-tier OR; `wornPublic` removed from SELECT and WHERE entirely; `visibility: wearEvents.visibility` added to SELECT.
- **Import additions:** `sql` added to drizzle-orm imports; `WearVisibility` type import added.

### src/lib/wywtTypes.ts
- Added `import type { WearVisibility } from '@/lib/wearVisibility'`
- Added `visibility: WearVisibility` field to `WywtTile` interface (between `note` and `isSelf`)

### src/app/u/[username]/[tab]/page.tsx (Rule 3 — blocking)
- Import updated: `getPublicWearEventsForViewer` → `getWearEventsForViewer`
- Two call sites updated (worn tab + stats tab non-owner branch)

## Row-Shape Adjustment

Used an explicit `.select({ id, userId, watchId, wornDate, note, photoUrl, visibility, createdAt })` projection in `getWearEventsForViewer` to avoid the `{ wear_events: ..., profile_settings: ... }` nested shape that Drizzle returns when `innerJoin` is used with `.select()` (no projection). This matches the recommendation in the plan's action note and the canonical pattern in `src/data/watches.ts:119-149`.

## Canonical Predicate Citation

`getWearEventsForViewer` mirrors the viewer-aware pattern from `src/data/watches.ts:119-149` (owner-or-profilePublic-AND-perTabFlag), replacing the per-tab boolean flag with the three-tier `wear_events.visibility` OR predicate.

## Build Status

`npm run build` passes after both commits.

## Test Status

- `tests/data/getWearRailForViewer.test.ts` — **not yet created** (Plan 01 wave 0 creates this file). Will pass Unit 9-11 once merged.
- `tests/integration/phase12-visibility-matrix.test.ts` — **not yet created** (Plan 01 wave 0). DAL cells V-1 through V-12 will pass once merged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Update call sites in [tab]/page.tsx**
- **Found during:** Task 2 build verification
- **Issue:** `src/app/u/[username]/[tab]/page.tsx` imported and called `getPublicWearEventsForViewer` at two locations — build failed with "export not found"
- **Fix:** Updated import + both call sites to use `getWearEventsForViewer`
- **Files modified:** `src/app/u/[username]/[tab]/page.tsx`
- **Commit:** `697d97a`
- **Plan note:** Plan 04 was intended to handle consumer call sites, but the rename in Task 2 caused an immediate build break requiring fix in this plan.

**2. [Rule 3 - Blocking] Add cacheComponents: true to next.config.ts**
- **Found during:** Task 1 build verification
- **Issue:** `src/components/home/CollectorsLikeYou.tsx` uses `'use cache'` directive which requires `experimental.cacheComponents: true` in next.config.ts — the worktree was missing this flag (added in Phase 10 main branch but not reflected in worktree working tree)
- **Fix:** Added `experimental: { cacheComponents: true }` to next.config.ts
- **Files modified:** `next.config.ts`
- **Commit:** `4b2f834`

## Known Stubs

None — all three-tier predicate logic is fully wired. No placeholder values or TODO comments introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Changes are DAL-layer only, closing the information disclosure threats T-12-02-01 through T-12-02-03 as mitigated.

## Self-Check: PASSED

- FOUND: src/lib/wearVisibility.ts
- FOUND: src/data/wearEvents.ts (rewritten)
- FOUND: src/lib/wywtTypes.ts (visibility field added)
- FOUND: commit 4b2f834 (Task 1)
- FOUND: commit 697d97a (Task 2)
