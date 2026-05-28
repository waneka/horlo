---
phase: 59-unified-route-variant-c
plan: "01"
subsystem: routing/dal/testing
tags: [dal, ci-guard, integration-test, route-migration, wave-1]
dependency_graph:
  requires: []
  provides:
    - findViewerWatchByCatalogId in @/data/watches
    - tests/static/legacy-watch-routes.test.ts (ROUTE-03 CI guard)
    - tests/integration/phase59-unified-route.test.ts (ROUTE-01 contract)
    - package.json prebuild hook
  affects:
    - src/data/watches.ts
    - package.json (build pipeline)
tech_stack:
  added: []
  patterns:
    - DAL extraction (findViewerWatchByCatalogId from page file to watches.ts)
    - Vitest static-scan guard (readFileSync + regex on src/ files)
    - npm prebuild lifecycle hook for Vercel build gating
key_files:
  created:
    - tests/static/legacy-watch-routes.test.ts
    - tests/integration/phase59-unified-route.test.ts
  modified:
    - src/data/watches.ts
    - package.json
decisions:
  - "findViewerWatchByCatalogId placed after getWatchByIdForViewer in watches.ts (natural grouping by query scope)"
  - "FORBIDDEN regex set uses a single /`\\/watch\\/\\${/ pattern covering both detail and edit forms (simpler + complete)"
  - "Integration test uses describe.skip guard (same as phase12) so local CI does not hard-fail without DATABASE_URL"
  - "prebuild hook targets only the guard test file (fast; 1.8s) rather than full vitest suite"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 59 Plan 01: Foundation — DAL Extraction, CI Guard, Integration Test Scaffold Summary

**One-liner:** DAL extraction of `findViewerWatchByCatalogId` with BUG-01 fix, Vitest static-scan CI guard detecting 24 legacy link literals (RED by design), and ROUTE-01 resolution-contract integration test — all gated via a `prebuild` npm hook.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract findViewerWatchByCatalogId into DAL | 868c62b | src/data/watches.ts (+28 lines) |
| 2 | Author CI guard test + route-absence assertions | ba9906a | tests/static/legacy-watch-routes.test.ts (new, 147 lines) |
| 3 | Scaffold ROUTE-01 integration test + wire prebuild hook | 225f421 | tests/integration/phase59-unified-route.test.ts (new), package.json |

## What Was Built

### Task 1: findViewerWatchByCatalogId DAL extraction

`findViewerWatchByCatalogId(userId, catalogId): Promise<{id} | null>` was moved from `src/app/catalog/[catalogId]/page.tsx` (a local non-exported function using the `watchesTable` alias) into `src/data/watches.ts` as a proper `export async function`. Key details:

- Uses `watches` (not `watchesTable`) consistent with the DAL import convention
- Preserves the BUG-01 fix: `eq(watches.status, 'owned')` filters sold/wishlist rows from the owned-view trigger (T-59-02)
- Two-predicate WHERE clause (`userId AND catalogId`) prevents IDOR cross-user reads (T-59-01)
- No new imports needed (`db`, `watches`, `and`, `eq` already present)
- The catalog page file is NOT touched — it will be deleted wholesale in Plan 03

### Task 2: CI guard test (tests/static/legacy-watch-routes.test.ts)

Two `describe` blocks:

**ROUTE-02** — three `existsSync` assertions that the three legacy page files do not exist. These are RED until Plan 03 deletes them (by design).

**ROUTE-03** — recursive `collectSourceFiles('src')` scans all `.ts`/`.tsx` files (excluding `.test.` files). FORBIDDEN patterns:
- `` `/watch/${`` template literal (covers detail + edit forms)
- `` `/catalog/${`` template literal  
- `return \`/watch/${` computed deep-link (D-12 — NotificationRow.resolveHref)
- `router.push(\`/watch/${` computed navigation (NotesEmptyOwnerActions)
- `href="/watch/` static (not `/watch/new`)
- `href="/catalog/` static

ALLOWLIST patterns: `/watch/new` (D-13), `/watch/[id]` and `/catalog/[catalogId]` path-segment forms (docs), pure comment lines (`//`), JSDoc lines (`*`).

**Verified RED state:** `npm run test -- tests/static/legacy-watch-routes.test.ts` fails with 24 FORBIDDEN-pattern violations (3 ROUTE-02 + 21 ROUTE-03). The guard correctly identifies only actual `/watch/` and `/catalog/` link sites — no false positives from `/explore/lists/`, `/admin/lists/`, or `/wear/[id]` non-link paths.

### Task 3: Integration test + prebuild hook

`tests/integration/phase59-unified-route.test.ts` exercises the resolution CONTRACT the unified page must satisfy:

1. **Branch 1 per-user hit** — `getWatchByIdForViewer(owner, watchId)` → `{isOwner: true}`, same-user framing
2. **Branch 1 cross-user** — `getWatchByIdForViewer(viewer, watchId)` → `{isOwner: false}`, `viewerCanEdit=false`
3. **Branch 2 catalog hit** — per-user returns null, `getCatalogById(catalogId)` finds the entry
4. **Branch 2 D-06 owned-via-catalog** — `findViewerWatchByCatalogId(owner, catalogId)` returns `{id: ownedWatchId}`; BUG-01 asserted: sold row NOT returned; viewer returns null (IDOR gate)

Suite is guarded with `describe.skip` when `DATABASE_URL` is absent (mirrors phase12 pattern). Locally: 7 tests skipped. The describe block is titled `phase59` for the validation map.

`package.json` now has:
```json
"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts",
"build": "next build",
```

npm lifecycle runs `prebuild` before `build`, so Vercel's `npm run build` will fire the guard first. The `build` script is unchanged. The prebuild→build linkage will be PROVEN (not just assumed) by the planted-literal build-fail step in Plan 03.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| findViewerWatchByCatalogId in DAL | `grep -n "findViewerWatchByCatalogId" src/data/watches.ts` | Line 245 — PASS |
| BUG-01 fix preserved | `grep -n "eq(watches.status, 'owned')" src/data/watches.ts` | Line 257 — PASS |
| No new type errors in watches.ts | `npx tsc --noEmit` | Only pre-existing test file errors — PASS |
| CI guard test structure | ROUTE-02 and ROUTE-03 describe blocks present | PASS |
| Guard detects legacy literals | `npm run test -- tests/static/legacy-watch-routes.test.ts` | 24 failures — RED (expected) |
| Integration test runs without harness error | `npm run test -- tests/integration/phase59-unified-route.test.ts` | 7 skipped (no DB locally) — PASS |
| prebuild script wired | `grep -q '"prebuild"' package.json` | PASS |

## Deviations from Plan

None — plan executed exactly as written. The FORBIDDEN regex set was simplified to a single `` `/watch/${`` pattern covering both detail and edit template literals (the plan's RESEARCH showed a more complex two-pattern approach was also valid; the single pattern is complete and simpler). This is an implementation detail within Claude's discretion for the CI guard mechanism (D-13).

## Known Stubs

None. The three artifacts are complete for their stated scope:
- `findViewerWatchByCatalogId` is a fully functional DAL function
- The CI guard test is fully functional (RED, by design)
- The integration test scaffold encodes the full contract (skips without DB, not stubbed)

## Threat Flags

None. The plan's threat model mitigations are all satisfied:
- T-59-01 (IDOR): two-predicate WHERE on `userId AND catalogId` preserved
- T-59-02 (BUG-01): `eq(watches.status, 'owned')` preserved
- T-59-03 (CI guard completeness): FORBIDDEN set covers template literals, edit forms, and computed `return \`/watch/${` deep-links (D-12)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/data/watches.ts exists | FOUND |
| tests/static/legacy-watch-routes.test.ts exists | FOUND |
| tests/integration/phase59-unified-route.test.ts exists | FOUND |
| 59-01-SUMMARY.md exists | FOUND |
| commit 868c62b (Task 1) | FOUND |
| commit ba9906a (Task 2) | FOUND |
| commit 225f421 (Task 3) | FOUND |
