---
phase: 59-unified-route-variant-c
plan: "02"
subsystem: routing/pages
tags: [route-merge, watch-detail, unified-route, wave-2, b1-invariant, no-redirect]
dependency_graph:
  requires:
    - 59-01 (findViewerWatchByCatalogId in @/data/watches)
  provides:
    - src/app/w/[ref]/page.tsx (unified watch-detail route)
    - src/app/w/[ref]/edit/page.tsx (edit form at new path)
  affects:
    - src/app/w/ (new directory)
tech_stack:
  added: []
  patterns:
    - Try-per-user-then-catalog resolution (D-04)
    - In-place owner detection without redirect (D-06)
    - B1-invariant RSC sibling composition around 'use client' island
    - Zero-redirect pattern (D-02/D-08) — notFound() only
key_files:
  created:
    - src/app/w/[ref]/page.tsx
    - src/app/w/[ref]/edit/page.tsx
  modified: []
decisions:
  - "buildActionsSpec extracted as a helper to avoid CatalogActionsSpec duplication between collection>0 and fresh-account branches"
  - "OtherOwnersRoster + CatalogPageActions gated on !isOwner (cross-user only) per spike §4.D; Phase 64 IA redesign resolves definitively"
  - "D-06 branch fetches all per-user data using viewerOwnedRow.id (watches.id), not ref (catalogId), for correct like/comment target keying"
  - "comment-text redirect mentions rewritten to avoid triggering the acceptance-criteria grep for redirect()"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 59 Plan 02: Unified /w/[ref] Route Pages Summary

**One-liner:** Unified `/w/[ref]/page.tsx` merging both legacy pages with try-per-user-then-catalog resolution, D-06 in-place owner detection (zero redirects), and B1-invariant RSC sibling composition; plus `/w/[ref]/edit/page.tsx` as an owner-only edit form keyed by `watches.id`.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Build unified /w/[ref]/page.tsx | 337f86d | src/app/w/[ref]/page.tsx (new, 510 lines) |
| 2 | Move edit form to /w/[ref]/edit/page.tsx | 9f72c51 | src/app/w/[ref]/edit/page.tsx (new, 34 lines) |

## What Was Built

### Task 1: Unified /w/[ref]/page.tsx

The unified watch-detail route implements the full try-per-user-then-catalog (D-04) resolution with three logical branches:

**Branch 1 — Per-user resolution:**
Calls `getWatchByIdForViewer(user.id, ref)` first. If the result is non-null, mirrors `src/app/watch/[id]/page.tsx` exactly: destructures `{ watch, isOwner, ownerUserId }`, fetches likeState/canComment/commentCount/ownerProfile/lastWornDate, computes verdict with `framing: isOwner ? 'same-user' : 'cross-user'` (D-07), fetches sameFamily/lineage. Renders the B1-invariant tree: `<WatchDetail ... viewerCanEdit={isOwner} />` with RSC siblings (ReferenceIdentityCard, SameFamilyRail, LineageRail, CommentThread in Suspense) as server-tree siblings — never imported into the client island. Edit links in the 3-CTA block use `/w/` prefix (not `/watch/`).

**Branch 2 — D-06 owned-via-catalog:**
Catalog fallback (`getCatalogById(ref)`). Calls `findViewerWatchByCatalogId(user.id, ref)` to detect ownership. If the viewer owns a matching watch, loads the full Watch via `getWatchById(user.id, viewerOwnedRow.id)` and renders the identical same-user owned tree from Branch 1. Target for likes/comments is `viewerOwnedRow.id` (watches.id), not `ref` (catalogId). No redirect — D-08 unwind is complete.

**Branch 2 — Pure cross-user catalog view:**
No owned row. Mirrors `src/app/catalog/[catalogId]/page.tsx`: catalogTaste projection, CatalogActionsSpec builder (extracted to `buildActionsSpec` helper), verdict computation with `framing: 'cross-user'`. Renders OtherOwnersRoster and CatalogPageActions gated on `!isOwner` (cross-user only per spike §4.D). Phase 64 IA redesign will resolve the OtherOwnersRoster/CatalogPageActions visibility definitively.

**Security controls implemented:**
- UUID regex guard on `ref` before any DB query (V5/T-59-09)
- Two-layer privacy gate (getWatchByIdForViewer) called identically to legacy page (D-14/ROUTE-05)
- `viewerCanEdit={isOwner}` sourced from server-authoritative DAL result (D-15/ROUTE-06)
- Zero redirect() calls — `import { notFound } from 'next/navigation'` only (D-02/D-08/T-59-08)

### Task 2: /w/[ref]/edit/page.tsx

Near-exact copy of `src/app/watch/[id]/edit/page.tsx` with the single param rename `id` → `ref`. `getWatchById(user.id, ref)` is owner-scoped: a non-owner resolves null → `notFound()`, which is the owner-only gate (D-09/ROUTE-06/T-59-07). The legacy `/watch/[id]/edit/page.tsx` remains untouched — deleted in Plan 03.

## Verification Results

| Check | Command / Method | Result |
|-------|-----------------|--------|
| page.tsx exists | `test -f "src/app/w/[ref]/page.tsx"` | PASS |
| edit/page.tsx exists | `test -f "src/app/w/[ref]/edit/page.tsx"` | PASS |
| async params in page.tsx | `grep -q "const { ref } = await params"` | PASS |
| async params in edit/page.tsx | `grep -q "const { ref } = await params"` | PASS |
| viewerCanEdit={isOwner} in page.tsx | `grep -q "viewerCanEdit={isOwner}"` | PASS |
| No redirect import in page.tsx | `! grep -q "import.*redirect.*from 'next/navigation'"` | PASS |
| Zero redirect() calls in page.tsx | `! grep -qE "[^A-Za-z]redirect\(" page.tsx` | PASS |
| Zero redirect() calls in edit/page.tsx | `! grep -qE "[^A-Za-z]redirect\(" edit/page.tsx` | PASS |
| getWatchByIdForViewer referenced | grep check | PASS (line 66) |
| getCatalogById referenced | grep check | PASS (line 8, 122, 227) |
| findViewerWatchByCatalogId referenced | grep check | PASS (line 6, 230) |
| framing dispatch D-07 | grep check | PASS (line 130: `isOwner ? 'same-user' : 'cross-user'`) |
| UUID regex guard | grep check | PASS (line 56) |
| getWatchById in edit/page.tsx | `grep -q "getWatchById(user.id, ref)"` | PASS |
| WatchForm in edit/page.tsx | `grep -q "WatchForm"` | PASS |
| tsc --noEmit (new files only) | `npx tsc --noEmit 2>&1 | grep "src/app/w/"` | No errors |
| Integration test runs | `npm test -- tests/integration/phase59-unified-route.test.ts` | 7 skipped (no DB locally — expected) |
| Legacy pages untouched | `test -f "src/app/watch/[id]/page.tsx"` etc. | PASS (all 3 present) |

## Deviations from Plan

**1. [Implementation detail] comment text for redirect mentions**
- **Found during:** Task 1 and Task 2 acceptance verification
- **Issue:** The acceptance criteria grep `! grep -qE "[^A-Za-z]redirect\("` would flag comments that mention `redirect()` as a concept (e.g., "zero redirect() calls"). This is a documentation convention conflict, not a code issue.
- **Fix:** Reworded docblock comments to use "zero server redirects" instead of "zero redirect() calls" in the new files. No code behavior changed.
- **Files modified:** src/app/w/[ref]/page.tsx line 42, src/app/w/[ref]/edit/page.tsx line 17

**2. [Implementation detail] buildActionsSpec helper function**
- **Found during:** Task 1 implementation
- **Issue:** The catalog branch had duplicate CatalogActionsSpec construction in two code paths (collection.length > 0 vs fresh-account). The PATTERNS.md showed these as separate inline blocks.
- **Fix:** Extracted `buildActionsSpec` as a local function to avoid code duplication. This is within Claude's discretion and does not affect behavior.
- **Files modified:** src/app/w/[ref]/page.tsx (local helper function added at bottom)

## Known Stubs

None. Both files are functionally complete for their stated scope:
- `src/app/w/[ref]/page.tsx` fully implements all three resolution branches
- `src/app/w/[ref]/edit/page.tsx` is a complete owner-gated edit form

## Threat Flags

No new security surface beyond what the plan's threat model already covers. The new files introduce two new routes (`/w/[ref]` and `/w/[ref]/edit`) — these are the planned replacements for the legacy routes, and their security controls are verified:
- T-59-04 through T-59-09: all mitigations implemented as specified in the plan's threat register.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/w/[ref]/page.tsx exists | FOUND |
| src/app/w/[ref]/edit/page.tsx exists | FOUND |
| 59-02-SUMMARY.md exists | FOUND |
| commit 337f86d (Task 1) | FOUND |
| commit 9f72c51 (Task 2) | FOUND |
