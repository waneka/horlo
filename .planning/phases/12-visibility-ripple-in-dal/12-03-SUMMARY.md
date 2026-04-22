---
phase: 12-visibility-ripple-in-dal
plan: "03"
subsystem: feed-dal
tags: [privacy, visibility, feed, activity, typescript, drizzle]
dependency_graph:
  requires: [12-01, 12-02]
  provides: [feed-visibility-gate, logActivity-discriminated-union]
  affects: [src/data/activities.ts, src/lib/feedTypes.ts, src/lib/wearVisibility.ts, src/app/actions/wearEvents.ts, src/app/actions/watches.ts]
tech_stack:
  added: [src/lib/wearVisibility.ts]
  patterns: [discriminated-union-overloads, jsonb-metadata-gate, D-09-fail-closed]
key_files:
  created:
    - src/lib/wearVisibility.ts
  modified:
    - src/data/activities.ts
    - src/lib/feedTypes.ts
    - src/app/actions/wearEvents.ts
    - src/app/actions/watches.ts
decisions:
  - "Single atomic commit for Tasks 1+2: type widening + caller fix must land together for build to pass"
  - "Created wearVisibility.ts here (Plan 02 dependency) since parallel Plan 02 hadn't committed yet"
  - "Fixed watches.ts if/else split: union variable fails TS overload narrowing — separate branches required"
metrics:
  duration: ~20min
  completed: "2026-04-22"
  tasks: 2
  files: 5
---

# Phase 12 Plan 03: Feed Metadata Visibility Gate Summary

Widened the `logActivity` signature and rewrote the `getFeedForUser` watch_worn WHERE branch to gate on per-row `activities.metadata->>'visibility'` rather than `profileSettings.wornPublic`, closing the feed read path for WYWT-10 three-tier visibility.

## What Was Built

### Task 1: Widen logActivity metadata type + rewrite getFeedForUser watch_worn branch

Three changes:

**A) Discriminated-union overloads on `logActivity`** (`src/data/activities.ts`):

Introduced three exported types:
- `WatchAddedMetadata` — `{ brand, model, imageUrl }`
- `WishlistAddedMetadata` — `{ brand, model, imageUrl }`
- `WatchWornMetadata` — `{ brand, model, imageUrl, visibility: WearVisibility }` (D-10, G-7)

Three overload signatures narrow the `metadata` arg type per `type` discriminant. The implementation signature accepts `ActivityMetadata` union. TypeScript now emits a compile error if any caller passes `logActivity('watch_worn', ...)` without `visibility` — G-7 mitigation as designed.

**B) WHERE sql template rewrite** (`src/data/activities.ts`, lines 140–165):

OLD:
```sql
OR (activities.type = 'watch_worn' AND profileSettings.wornPublic = true)
```

NEW:
```sql
OR (activities.type = 'watch_worn' AND activities.metadata->>'visibility' IN ('public','followers'))
```

Load-bearing comments added above the sql template:
- **ASSUMPTION A2**: the `IN ('public','followers')` simplification is valid only while the `innerJoin(follows, ...)` restricts every admitted row to followed actors. Any future widening of that JOIN must add a per-row follower check back.
- **D-09 fail-closed**: Postgres `->>` returns NULL for missing key; `NULL IN (...)` is NULL; NULL is not-true in WHERE — legacy rows without `visibility` are silently excluded without an explicit `IS NOT NULL` check.

**C) RawFeedRow.metadata extended** (`src/lib/feedTypes.ts`):

```typescript
metadata: {
  brand: string
  model: string
  imageUrl: string | null
  visibility?: WearVisibility  // OPTIONAL — only present on watch_worn rows
}
```

`normalizeMetadata` validates `m.visibility` against the literal union and carries it through if valid; omits it otherwise. Downstream Phase 15 surfaces can read `visibility` per row without a second join.

### Task 2: markAsWorn passes visibility:'public' in logActivity call

Single change in `src/app/actions/wearEvents.ts`:

```typescript
await logActivity(user.id, 'watch_worn', parsed.data, {
  brand: watch.brand,
  model: watch.model,
  imageUrl: watch.imageUrl ?? null,
  visibility: 'public', // D-07: markAsWorn always writes public; per-wear picker arrives in Phase 15
})
```

This satisfies the `WatchWornMetadata` requirement and makes the build pass after Task 1's type widening.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Created wearVisibility.ts (Plan 02 parallel dependency)**

- **Found during:** Task 1 setup
- **Issue:** `wearVisibility.ts` is created by Plan 02 (same wave, parallel agent) but was not present in the worktree. Plan 03 imports `WearVisibility` from this file.
- **Fix:** Created `src/lib/wearVisibility.ts` with the exact shape specified in the Plan 03 context: `export type WearVisibility = 'public' | 'followers' | 'private'`
- **Files modified:** `src/lib/wearVisibility.ts` (created)
- **Note:** Plan 02's version of this file may differ slightly in comments; merge conflict is unlikely since the export shape is identical.

**2. [Rule 1 - Bug] Fixed watches.ts logActivity caller — union variable fails TS overload narrowing**

- **Found during:** Task 2 build verification
- **Issue:** `src/app/actions/watches.ts` used a local variable `const activityType = ... ? 'wishlist_added' : 'watch_added'` whose type is `'watch_added' | 'wishlist_added'`. TypeScript cannot narrow a union variable against discriminated-union overload signatures — it requires each overload parameter to receive a literal type, not a union.
- **Fix:** Split into if/else with literal overload calls per branch.
- **Files modified:** `src/app/actions/watches.ts`
- **Commit:** dc8c5d2

**3. [Rule 3 - Blocking] Restored worktree files from HEAD**

- **Found during:** Initial setup
- **Issue:** `git reset --soft` left the working tree at an older checkout (Phase 7-era files) while the index was at HEAD. `activities.ts` was 21 lines instead of 136; `feedTypes.ts`, `next.config.ts`, and many other source files were missing or stale.
- **Fix:** `git checkout HEAD -- src/ tests/ next.config.ts` to restore all files to the committed state.

## Verification

```
grep -n "export type WatchWornMetadata" src/data/activities.ts    → line 41
grep -n "visibility: WearVisibility" src/data/activities.ts       → line 45 (type def), line 201 (normalizeMetadata)
grep -n "wornPublic|worn_public" src/data/activities.ts           → 0 matches
grep -n "metadata.*->>'visibility'" src/data/activities.ts        → lines 141, 164
grep -n "ASSUMPTION A2|D-09 fail-closed" src/data/activities.ts   → lines 149, 155
grep -n "visibility?: WearVisibility" src/lib/feedTypes.ts         → line 51
grep -n "visibility: 'public'" src/app/actions/wearEvents.ts      → line 43
npm run build                                                       → ✓ Compiled successfully
npm test -- tests/data/getFeedForUser.test.ts                      → 8 passed (11 skipped — integration, no local DB)
npm test -- tests/data/getWearRailForViewer.test.ts                → 8 passed (9 skipped)
```

Note: `tests/integration/phase12-visibility-matrix.test.ts` (Plan 01 artifact) does not exist in this worktree as Plan 01 runs in wave 0. Feed cells V-13 and V-14 will turn green when Plan 01's test file is merged and the full test suite runs against a seeded local DB.

Wishlist action (Plan 04) and column drop (Plan 06) cells remain red — that is expected.

## Known Stubs

None. `visibility: 'public'` is hardcoded in `markAsWorn` by design (D-07 default). The per-wear picker that lets users choose a tier is explicitly deferred to Phase 15 — the comment in the code cites this.

## Threat Flags

No new threat surface introduced. The changes remove the `profileSettings.wornPublic` JOIN from the feed hot path and replace it with a metadata jsonb read — same data, fewer JOINs. The ASSUMPTION A2 load-bearing comment locks the security dependency on the follows-JOIN shape.

## Self-Check
