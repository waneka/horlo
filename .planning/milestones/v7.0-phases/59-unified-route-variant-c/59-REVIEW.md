---
phase: 59-unified-route-variant-c
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/app/w/[ref]/page.tsx
  - src/app/w/[ref]/edit/page.tsx
  - src/data/watches.ts
  - src/components/notifications/NotificationRow.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchCard.tsx
  - src/components/explore/DiscoveryWatchCard.tsx
  - src/components/explore/PathCard.tsx
  - src/components/home/ActivityRow.tsx
  - src/components/home/MostWornThisMonthCard.tsx
  - src/components/home/RecommendationCard.tsx
  - src/components/home/SleepingBeautyCard.tsx
  - src/components/insights/CollectionFitCard.tsx
  - src/components/insights/GoodDealsSection.tsx
  - src/components/insights/SleepingBeautiesSection.tsx
  - src/components/profile/NoteRow.tsx
  - src/components/profile/NotesEmptyOwnerActions.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - src/components/profile/StatsTabContent.tsx
  - src/components/search/WatchSearchRow.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/app/explore/lists/[id]/page.tsx
  - tests/static/legacy-watch-routes.test.ts
  - tests/integration/phase59-unified-route.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 59 collapses `/watch/[id]` and `/catalog/[catalogId]` into a single canonical `/w/[ref]` route (Variant C hard cutover). The load-bearing file is `src/app/w/[ref]/page.tsx`. The mechanical path-swap files are clean.

**Security and authorization verdict:** No IDOR or authorization bypass found. The three-branch resolution (per-user → catalog owner-detection → pure catalog) is correctly scoped:

- `getWatchByIdForViewer` uses a two-predicate WHERE (watches.id match + owner OR profilePublic/per-tab gate) — privacy gate is intact.
- `findViewerWatchByCatalogId` is doubly-scoped by `userId` AND `catalogId` AND `status='owned'` — the BUG-01 fix is correctly implemented.
- `isOwner` and `viewerCanEdit` are derived server-side from DB query results, never from URL or client input.
- Zero `redirect()` calls — the D-02/D-08 Router Cache poisoning constraint is satisfied.
- B1 invariant holds: RSC siblings (CommentThread, rails, OtherOwnersRoster, CollectionFitCard on the catalog branch) compose around the `'use client'` WatchDetail island, not inside it.
- Async params correctly use `await params` per Next.js 16 convention.
- UUID format validation before any DB query cleanly collapses malformed URLs to 404.

Three warnings found, all in `page.tsx`. No critical bugs. Three info-level quality items.

## Warnings

### WR-01: Dead code block in D-06 branch — 3-CTA always unreachable

**File:** `src/app/w/[ref]/page.tsx:352-364`
**Issue:** The "Add to Wishlist / Add to Collection / Skip" CTA block inside the D-06 owned-via-catalog branch is gated on `collection.length === 0`. This condition can never be true in the D-06 branch: `collection` is populated by `getWatchesByUser(user.id)` at line 226, which includes the watch that activated D-06 (`viewerOwnedRow`). The owner arriving via a catalogId URL always has at least one watch in their collection. This block is permanently dead code.

**Fix:** Remove lines 352–364 from the D-06 return block entirely. The equivalent CTA block in Branch 1 (lines 204–216) is also technically unreachable for the same reason (collection.length is always > 0 for a viewer who owns the watch being viewed), but D-06 is the sharper case because the owner's existence of `viewerOwnedRow` is the activation predicate.

```tsx
// DELETE lines 352-364:
{collection.length === 0 && (
  <div className="flex flex-wrap gap-2">
    <Link href={`/w/${ownedWatch.id}/edit?status=wishlist`}>
      <Button variant="outline">Add to Wishlist</Button>
    </Link>
    <Link href={`/w/${ownedWatch.id}/edit?status=owned`}>
      <Button>Add to Collection</Button>
    </Link>
    <Link href="/">
      <Button variant="ghost">Skip</Button>
    </Link>
  </div>
)}
```

### WR-02: `findViewerWatchByCatalogId` has no ORDER BY — non-deterministic for multi-owned edge case

**File:** `src/data/watches.ts:249-263`
**Issue:** The query uses `.limit(1)` with no `ORDER BY`. If a user owns two physical watches linked to the same `catalogId` (e.g., the same reference held twice), the returned row id is non-deterministic across Postgres plan changes. The D-06 branch in `page.tsx` then calls `getWatchById(user.id, viewerOwnedRow.id)` and renders whichever watch was returned. There is no unique constraint on `(userId, catalogId)` in the `watches` schema, so this scenario is possible.

**Fix:** Add an `ORDER BY` to make the result stable (most recently created owned row, or lowest sort_order):

```ts
.where(and(
  eq(watches.userId, userId),
  eq(watches.catalogId, catalogId),
  eq(watches.status, 'owned'),
))
.orderBy(desc(watches.createdAt))  // deterministic: most recent first
.limit(1)
```

### WR-03: Stale JSDoc comment in `WatchDetail` exposes deleted route path

**File:** `src/components/watch/WatchDetail.tsx:46`
**Issue:** The `verdict` prop JSDoc comment reads `"precomputed VerdictBundle from /watch/[id]/page.tsx"`. The legacy `/watch/[id]` route was deleted in this phase. The computation now happens in `/w/[ref]/page.tsx`. A second stale reference appears at line 474 in a JSX inline comment. These are documentation-only, but they will mislead future maintainers about where verdict computation lives.

**Fix:**
```tsx
// Line 46 — change:
* Phase 20 D-03/D-04: precomputed VerdictBundle from /watch/[id]/page.tsx.
// to:
* Phase 20 D-03/D-04: precomputed VerdictBundle from /w/[ref]/page.tsx (Phase 59 unified route).

// Line 474 — change:
{/* Phase 20 FIT-01/D-04: pure-render card; computation happens in /watch/[id]/page.tsx (D-03 Server Component compute) */}
// to:
{/* Phase 20 FIT-01/D-04: pure-render card; computation happens in /w/[ref]/page.tsx (D-03 Server Component compute) */}
```

## Info

### IN-01: Stale comment in `DiscoveryWatchCard` references deleted route

**File:** `src/components/explore/DiscoveryWatchCard.tsx:14`
**Issue:** The JSDoc block comment says `"wrapped in <Link href="/catalog/[catalogId]"> per the new catalog detail route"`. This route was deleted in Phase 59; the actual implementation at line 30 correctly uses `/w/${watch.id}`. The comment is misleading.

**Fix:**
```tsx
// Change:
 * Phase 20 D-10: wrapped in <Link href="/catalog/[catalogId]"> per the new
 * catalog detail route.
// to:
 * Phase 20 D-10: wrapped in <Link href="/w/[catalogId]"> per the Phase 59
 * unified route.
```

### IN-02: Dead exported function `linkWatchToCatalog` in `watches.ts`

**File:** `src/data/watches.ts:340-349`
**Issue:** `linkWatchToCatalog` is marked `@deprecated` with "Mark for deletion in Polish." It has zero callers in the current codebase (only a removal comment in `actions/watches.ts:141`). Exported dead code increases the DAL's surface area and could mislead future contributors into thinking the function is still in use.

**Fix:** Delete the function (lines 340–349) and its JSDoc block. The `@deprecated` comment in `actions/watches.ts:141` can be simplified to a regular comment.

### IN-03: Integration test BUG-01 scenario is incomplete — sold-only case not covered

**File:** `tests/integration/phase59-unified-route.test.ts:200-209`
**Issue:** The BUG-01 test seeds both an `owned` row AND a `sold` row for the same catalogId, then verifies the function returns the `owned` row. This proves the filter works when both statuses coexist. It does NOT test the simpler and more important BUG-01 scenario: when the owner has ONLY a `sold` row (no `owned` row), `findViewerWatchByCatalogId` must return `null`. The code behavior is correct (the `status='owned'` filter handles it), but the test does not document this contract.

**Fix:** Add a third assertion within the BUG-01 `it` block, or a new `it` block:
```ts
it('BUG-01 (sold-only): owner with only a sold row gets null → cross-user framing', async () => {
  // Remove the owned row, keep only soldWatchId with same catalogId
  // Then verify findViewerWatchByCatalogId returns null
  // (Requires inserting a fresh catalog entry to avoid interfering with other tests)
})
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
