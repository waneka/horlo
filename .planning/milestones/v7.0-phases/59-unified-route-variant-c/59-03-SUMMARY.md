---
phase: 59-unified-route-variant-c
plan: "03"
subsystem: routing/link-migration/ci-guard
tags: [link-migration, route-cutover, ci-guard, wave-3, hard-cutover, build-gate]
dependency_graph:
  requires:
    - 59-01 (CI guard, DAL extraction, prebuild hook)
    - 59-02 (unified /w/[ref] page + /w/[ref]/edit page)
  provides:
    - All 26 internal watch-link literals migrated to /w/[ref]
    - Three legacy page files deleted (404 by absence)
    - CI guard GREEN (0 violations)
    - Build-gate proven: planted literal exits non-zero, clean build exits 0
  affects:
    - src/components/insights/ (3 files)
    - src/components/home/ (4 files)
    - src/components/profile/ (4 files)
    - src/components/watch/ (2 files)
    - src/components/wear/ (1 file)
    - src/components/notifications/ (1 file)
    - src/components/explore/ (2 files)
    - src/components/search/ (2 files)
    - src/app/explore/lists/[id]/page.tsx
    - src/app/watch/[id]/page.tsx (deleted)
    - src/app/watch/[id]/edit/page.tsx (deleted)
    - src/app/catalog/[catalogId]/page.tsx (deleted)
tech_stack:
  added: []
  patterns:
    - Hard cutover via 404-by-absence (D-02) — delete page.tsx = route gone
    - ID-type discipline (D-03) — ownership surfaces emit watches.id, discovery surfaces emit catalogId
    - Computed deep-link migration (D-12) — NotificationRow.resolveHref return statement
    - Build-gate proof — planted literal trips prebuild non-zero
key_files:
  created: []
  modified:
    - src/components/insights/SleepingBeautiesSection.tsx
    - src/components/insights/GoodDealsSection.tsx
    - src/components/insights/CollectionFitCard.tsx
    - src/components/home/MostWornThisMonthCard.tsx
    - src/components/home/ActivityRow.tsx
    - src/components/home/RecommendationCard.tsx
    - src/components/home/SleepingBeautyCard.tsx
    - src/components/profile/StatsTabContent.tsx
    - src/components/profile/ProfileWatchCard.tsx
    - src/components/profile/NoteRow.tsx
    - src/components/profile/NotesEmptyOwnerActions.tsx
    - src/components/watch/WatchCard.tsx
    - src/components/watch/WatchDetail.tsx
    - src/components/wear/WearDetailHero.tsx
    - src/components/notifications/NotificationRow.tsx
    - src/app/explore/lists/[id]/page.tsx
    - src/components/explore/DiscoveryWatchCard.tsx
    - src/components/explore/PathCard.tsx
    - src/components/search/WatchSearchRow.tsx
  deleted:
    - src/app/watch/[id]/page.tsx
    - src/app/watch/[id]/edit/page.tsx
    - src/app/catalog/[catalogId]/page.tsx
    - tests/app/catalog-page.test.ts
    - tests/app/watch-page-verdict.test.ts
decisions:
  - "All 26 literals migrated by changing ONLY the path prefix (/watch/ or /catalog/ → /w/); id variables preserved verbatim per D-03"
  - "NotificationRow.resolveHref return statement changed to /w/${watchId} (computed deep-link, D-12)"
  - "Tests that imported the deleted legacy pages (catalog-page.test.ts, watch-page-verdict.test.ts) removed — they tested pages that no longer exist"
  - "Component tests for ActivityRow, RecommendationCard, CollectorsLikeYou, NotificationRow, WatchSearchRow, WatchSearchRowsAccordion updated to /w/ path expectations"
  - "Build-gate proof: npm run build exits 1 with planted /watch/${x}; exits 0 after removal — ROUTE-03/D-11 proven locally"
metrics:
  duration_minutes: 35
  completed_date: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 27
---

# Phase 59 Plan 03: Link Migration + Legacy Page Deletion + Build-Gate Proof Summary

**One-liner:** All 26 internal watch-link literals migrated from `/watch/` or `/catalog/` to `/w/[ref]` with D-03 id-type discipline preserved; 3 legacy pages deleted (404 by absence); CI guard GREEN (347/347); build-gate proven by planted-literal experiment (planted → exit 1, clean → exit 0).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Re-point detail + edit + computed deep-link literals (watches.id surfaces) | 8b355e4 | 15 component files |
| 2 | Re-point catalog (discovery) literals + delete the three legacy pages | 1e0a5b2 | 4 component/page files + 3 deleted |
| 3 | Prove CI guard GREEN + fails build on planted legacy literal | 353b6c6 | 8 test files updated/deleted |

## What Was Built

### Task 1: watches.id literal migration (Group A + B + computed deep-link)

**Group A — 12 detail link sites** (all `watches.id`-emitting, path prefix changed from `/watch/` to `/w/`):
- `src/components/insights/SleepingBeautiesSection.tsx:44` — `href={/w/${watch.id}}`
- `src/components/insights/GoodDealsSection.tsx:48` — `href={/w/${w.id}}`
- `src/components/insights/CollectionFitCard.tsx:71` — `href={/w/${watch.id}}`
- `src/components/home/MostWornThisMonthCard.tsx:21` — `href={/w/${watch.id}}`
- `src/components/home/ActivityRow.tsx:55` — `href={/w/${row.watchId}}` (activities.watchId FK → watches.id)
- `src/components/home/RecommendationCard.tsx:22` — `href={/w/${rec.representativeWatchId}}`
- `src/components/home/SleepingBeautyCard.tsx:33` — `href={/w/${watch.id}}`
- `src/components/profile/StatsTabContent.tsx:62` — `href={/w/${watch.id}}`
- `src/components/profile/ProfileWatchCard.tsx:63` — `href={/w/${watch.id}}`
- `src/components/profile/NoteRow.tsx:62` — `href={/w/${watch.id}}`
- `src/components/watch/WatchCard.tsx:35` — `href={/w/${watch.id}}`
- `src/components/wear/WearDetailHero.tsx:111` — `href={/w/${watchId}}` (wearEvents.watchId FK → watches.id)

**Computed deep-link (D-12):** `src/components/notifications/NotificationRow.tsx:142` — `return \`/w/${watchId}\`` (was `/watch/${watchId}`)

**Group B — 3 edit link sites:**
- `src/components/profile/NotesEmptyOwnerActions.tsx:53` — `router.push(/w/${watchId}/edit#notes)` (router.push form)
- `src/components/profile/NoteRow.tsx:96` — `render={<Link href={/w/${watch.id}/edit} />}` (DropdownMenuItem)
- `src/components/watch/WatchDetail.tsx:226` — `href={/w/${watch.id}/edit}` (inside 'use client' island)

All id variables preserved verbatim per D-03. No `/watch/new` references altered (D-10).

### Task 2: catalogId literal migration (Group C) + legacy page deletion

**Group C — 7 catalog literals across 4 files** (all `catalogId`-emitting, `/catalog/` → `/w/`):
- `src/app/explore/lists/[id]/page.tsx:91,110` — `href={/w/${item.catalogId}}` (2 literals)
- `src/components/explore/DiscoveryWatchCard.tsx:30` — `href={/w/${watch.id}}` (variable named `watch.id` but IS catalogEntry.id per D-03 — variable unchanged)
- `src/components/explore/PathCard.tsx:97,134,143` — `href={/w/${node.catalogId}}` (3 literals — `replace_all` applied)
- `src/components/search/WatchSearchRow.tsx:31` — `href={/w/${result.catalogId}}`

**Legacy page deletion (ROUTE-02/D-02):**
- `src/app/watch/[id]/page.tsx` — deleted via `git rm` (route 404s by absence)
- `src/app/watch/[id]/edit/page.tsx` — deleted (Pitfall 5: both edit + detail must be gone)
- `src/app/catalog/[catalogId]/page.tsx` — deleted (removes the last `redirect()` on a watch route — D-08 unwind)

`/watch/new/page.tsx` was NOT touched (D-10). `findViewerWatchByCatalogId` confirmed in `src/data/watches.ts` from Plan 01 (DAL extraction complete).

### Task 3: CI guard GREEN + build-gate proof

**Guard verification:**
`npm run test -- tests/static/legacy-watch-routes.test.ts` → 347/347 PASS (3 ROUTE-02 absence assertions + 344 per-file ROUTE-03 scans).

**Test suite migration:**
7 test files updated to use new `/w/` path expectations; 2 test files deleted (they imported the now-deleted legacy pages). The 2 remaining failures (`no-raw-palette.test.ts`, `wishlist.test.ts`) are pre-existing and unrelated to this migration (verified by running them before/after my changes — identical failures).

**Build-gate proof (ROUTE-03/D-11, closes RESEARCH Assumption A4 MEDIUM-confidence):**

| Step | Action | Exit Code |
|------|--------|-----------|
| Plant | Added `const _guardProof = \`/watch/${'x'}\`` to WatchCard.tsx | — |
| `npm run build` (planted) | prebuild guard fired, detected WatchCard.tsx:34 violation | **1 (non-zero)** |
| Remove | Removed planted line from WatchCard.tsx | — |
| `npm run build` (clean) | prebuild GREEN (347/347), next build succeeded | **0** |

The build route table from the clean build confirmed: `/w/[ref]` and `/w/[ref]/edit` present; `/watch/[id]` and `/catalog/[catalogId]` absent.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| All 26 literals migrated | `grep -rEn "/(watch\|catalog)/\$\{" src/ \| grep -vE "/w/\|/watch/new"` | EMPTY — all migrated |
| Legacy pages deleted | `test ! -f "src/app/watch/[id]/page.tsx" && ...` | DELETED_AND_NEW_KEPT |
| /watch/new preserved | `test -f "src/app/watch/new/page.tsx"` | PASS |
| No redirects on watch routes | `grep -rEn "redirect\(" src/app/` | Only non-watch paths (settings, preferences, auth, etc.) |
| NotificationRow deep-link | `grep -n "/w/" src/components/notifications/NotificationRow.tsx` | Line 142 — PASS |
| /watch/new untouched | `grep -rn "/watch/new" src/components/` | 20 matches, all allowlisted — PASS |
| CI guard GREEN | `npm run test -- tests/static/legacy-watch-routes.test.ts` | 347/347 PASS |
| Build with planted literal | `npm run build` (planted `/watch/${'x'}`) | EXIT 1 (non-zero) — PROVEN |
| Build after removing literal | `npm run build` (clean) | EXIT 0 — PROVEN |
| TypeScript check | `npx tsc --noEmit` in components | Pre-existing errors only (RecentlyEvaluatedRail.test.tsx — out of scope) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test assertions for migrated component paths**
- **Found during:** Task 3 (full test suite run after Task 2)
- **Issue:** 6 test files asserted old `/watch/` or `/catalog/` paths in their href selectors/expectations. Since the source components now emit `/w/` paths, these tests were correctly failing (the tests were testing the OLD behavior).
- **Fix:** Updated all 6 test files to assert the new `/w/` path: `ActivityRow.test.tsx`, `RecommendationCard.test.tsx`, `CollectorsLikeYou.test.tsx`, `NotificationRow.test.tsx`, `WatchSearchRow.test.tsx`, `WatchSearchRowsAccordion.test.tsx`.
- **Files modified:** 6 test files
- **Commit:** 353b6c6

**2. [Rule 1 - Bug] Removed test files that imported deleted legacy pages**
- **Found during:** Task 3 (full test suite run)
- **Issue:** `tests/app/catalog-page.test.ts` imported `@/app/catalog/[catalogId]/page` and `tests/app/watch-page-verdict.test.ts` imported `@/app/watch/[id]/page` — both deleted by Task 2. The tests were failing with module resolution errors.
- **Fix:** Removed both test files via `git rm`. These tests validated the legacy pages' behavior; with the pages deleted, the tests are obsolete (the unified `/w/[ref]` page is validated by Plan 01's integration test scaffold).
- **Files deleted:** 2 test files
- **Commit:** 353b6c6

## Known Stubs

None. All 26 literals are fully migrated, the guard is GREEN, the build succeeds, and the legacy pages are deleted.

## Threat Flags

No new security surface. The threat register mitigations from the plan are all satisfied:
- T-59-10 (build-gate linkage): PROVEN — planted literal exits 1, clean exits 0
- T-59-11 (ID-type cross-wiring): MITIGATED — every site's existing id variable preserved; only prefix changed
- T-59-12 (dead link completeness): MITIGATED — both watch/[id]/page.tsx AND watch/[id]/edit/page.tsx deleted (Pitfall 5 guard)
- T-59-13 (residual redirect): MITIGATED — catalog/[catalogId]/page.tsx deletion removed the last redirect(); confirmed no watch-route redirects remain in src/app/

## Self-Check: PASSED

| Item | Status |
|------|--------|
| 26 literals migrated — grep empty | FOUND (no violations) |
| 3 legacy pages deleted | FOUND (git rm confirmed) |
| /watch/new preserved | FOUND |
| NotificationRow /w/${watchId} return | FOUND (line 142) |
| tests/static/legacy-watch-routes.test.ts GREEN | PASSED (347/347) |
| Build with planted literal → exit 1 | PROVEN |
| Build after removal → exit 0 | PROVEN |
| 59-03-SUMMARY.md exists | FOUND |
| commit 8b355e4 (Task 1) | FOUND |
| commit 1e0a5b2 (Task 2) | FOUND |
| commit 353b6c6 (Task 3) | FOUND |
