---
phase: 64-detail-page-ia-redesign
reviewed: 2026-05-27T23:54:35Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/app/w/[ref]/page.tsx
  - src/components/comment/CommentThread.tsx
  - src/components/watch/SpecsSublabel.tsx
  - src/components/watch/WatchDetailHero.tsx
  - src/components/watch/WatchDetailTrailing.tsx
  - tests/static/comment-thread-no-client.test.ts
  - tests/static/ppr-dynamic-before-use-cache.test.ts
  - tests/static/watch-detail-ia-order.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-05-27T23:54:35Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 64 splits the monolithic `WatchDetail` client island into `WatchDetailHero` (client) and `WatchDetailTrailing` (RSC), and reorders the `page.tsx` render tree so `CommentThread` appears above the spec cards. The load-bearing invariants are intact: `unstable_instant = false` and `await connection()` are present at the correct scope, `CommentThread` has no `'use client'` or `'use cache'`, and photo signing exclusively uses the admin client. Three static regression tests are well-structured.

One critical functional bug was found: the 3-CTA "Add to Wishlist / Add to Collection / Skip" block in Branch 1 (per-user resolution) renders for non-owner viewers with an empty collection, pointing them at the **owner's** watch ID for editing. The edit route is owner-gated, so clicking either CTA produces a 404 for the viewer — the CTAs are broken for cross-user Branch 1 viewers. Additionally, three warnings were found around a dangerous prop default, a weakened regression test, and a duplicated utility function.

---

## Critical Issues

### CR-01: Branch 1 "Add to Wishlist / Add to Collection" CTAs broken for non-owner viewers

**File:** `src/app/w/[ref]/page.tsx:374-386`

**Issue:** The 3-CTA block (`collection.length === 0`) is gated only on the viewer's empty collection, not on `isOwner`. `getWatchByIdForViewer` can return a non-null result for public-profile owners' watches, so a non-owner authenticated viewer with an empty collection hits Branch 1 and sees these CTAs. Both links point to `/w/${watch.id}/edit?status=wishlist` and `/w/${watch.id}/edit?status=owned`, where `watch.id` is the **owner's** `watches.id`. The edit route (`/w/[ref]/edit/page.tsx`) calls `getWatchById(user.id, ref)` which is owner-scoped; the non-owner gets `null` → `notFound()` → the viewer sees a 404 when clicking "Add to Wishlist" or "Add to Collection." The same bug exists in the D-06 owned branch at lines 602-614 where `isOwner = true` always, so it cannot be reached by non-owners there — Branch 1 is the live path.

The same pattern existed in the pre-Phase-64 code (the CTA block was not gated by `isOwner`), but Phase 64 moved `CollectionFitCard` / `ReferenceIdentityCard` inside the hero island — the CTA block is now the only empty-state element remaining in the page-level RSC for Branch 1, making its scope more visible.

**Fix:** Gate the CTA block on `isOwner`:
```tsx
// Before (line 374):
{collection.length === 0 && (

// After:
{isOwner && collection.length === 0 && (
```
Non-owner viewers with an empty collection arriving via Branch 1 should see the same CTA as the catalog branch (Branch 3), which uses `CatalogPageActions`. The complete fix requires either (a) gating the existing block by `isOwner`, or (b) rendering a viewer-appropriate CTA (using `watch.catalogId` if present) for non-owners. At minimum, option (a) prevents the 404.

---

## Warnings

### WR-01: `viewerCanEdit` defaults to `true` in `WatchDetailHero` — dangerous default for a new component

**File:** `src/components/watch/WatchDetailHero.tsx:110`

**Issue:** The prop default `viewerCanEdit = true` causes any future caller that omits the prop to display owner-only controls (Edit, Delete, Mark as Worn, Flag as Deal) to non-owners. The in-code comment at line 57 says "Defaults to true for backward compat," but `WatchDetailHero` is a **new component** created in Phase 64 with no legacy callers. All current callers in `page.tsx` explicitly pass `viewerCanEdit={isOwner}`. The default is therefore providing no backward compatibility while creating a footgun for future callers.

**Fix:** Change the default to `false`:
```tsx
// Line 110:
viewerCanEdit = false,
```
This is the safe default for a cross-user display component. Remove the "backward compat" comment from the JSDoc.

---

### WR-02: `ppr-dynamic-before-use-cache.test.ts` regression guard weakened to a vacuous proxy

**File:** `tests/static/ppr-dynamic-before-use-cache.test.ts:151-185`

**Issue:** The test originally guarded P61-BUG-01: "dynamic cookie-reading API (`createSupabaseServerClient` / `signCoverUrls`) must appear BEFORE `'use cache'` calls in PPR routes." The current `w/[ref]/page.tsx` replaced the cookie-based client with `createSupabaseAdminClient` for all signing (which is correct — admin client bypasses cookies). However, the test was updated to assert that `createSupabaseAdminClient` precedes each `getLikesForTargetCached` call, rather than asserting the **absence of cookie-based client calls after `use cache` helpers**. Since `createSupabaseAdminClient` does not read cookies, the original P61-BUG-01 invariant (cookie client ordering) is no longer enforced by any test. A future refactor that adds a `createSupabaseServerClient()` call after `getLikesForTargetCached` would re-introduce P61-BUG-01 without failing this test.

The test comment at line 133 acknowledges this ("vacuous guard repaired 2026-05-27") but the repair only substitutes a proxy signal — it does not add an assertion that `createSupabaseServerClient` is absent from the route.

**Fix:** Add a direct assertion that `createSupabaseServerClient` does not appear in active code in `w/[ref]/page.tsx`:
```typescript
it('createSupabaseServerClient( does not appear in active code (cookie client forbidden in this PPR route)', () => {
  const cookieClientLines = activeLineNumbers(lines, /createSupabaseServerClient\(/)
  expect(
    cookieClientLines.length,
    `P61-BUG-01: createSupabaseServerClient( must not appear in active code in ${REF_PAGE} — use createSupabaseAdminClient for signing. Found on lines: ${cookieClientLines.join(', ')}`,
  ).toBe(0)
})
```

---

### WR-03: `formatDate` is duplicated across three files

**File:** `src/components/watch/WatchDetailTrailing.tsx:19-28`, `src/components/watch/WatchDetailHero.tsx:39-47`

**Issue:** An identical `formatDate` function appears in `WatchDetailHero.tsx` (lines 39-47), `WatchDetailTrailing.tsx` (lines 19-28), and reportedly in `WatchDetail.tsx` as well. The `WatchDetailTrailing.tsx` comment says "copied verbatim from WatchDetail.tsx:106-119." All three copies are identical including the critical `timeZone: 'UTC'` option. Future maintenance changes (e.g., locale, format options) must be applied to all three copies — a single missed update would produce a visible inconsistency in the UI or re-introduce a React #418 hydration bug.

**Fix:** Extract to a shared module, e.g., `src/lib/formatDate.ts`:
```typescript
// src/lib/formatDate.ts
export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
```
Import from the shared module in all three components. This eliminates the duplication risk for the hydration-critical `timeZone` option.

---

## Info

### IN-01: `WatchDetail.tsx` (old monolith) is retained but rendered nowhere

**File:** `src/components/watch/WatchDetail.tsx`

**Issue:** Per the phase context, `WatchDetail.tsx` is intentionally retained because two pre-existing tests reference it (`tests/no-raw-img.test.ts`, `tests/components/watch/WatchDetail.isChronometer.test.tsx`). The file is now dead production code. This is a known/accepted state — noted once as directed. A future cleanup phase should either migrate those tests to reference the new components or archive `WatchDetail.tsx`.

**Fix:** No action required now. Track as cleanup debt for a future phase once the dependent tests are migrated.

---

### IN-02: `commentCount` for the jump-to-comments badge requires a separate DB round-trip

**File:** `src/app/w/[ref]/page.tsx:280-282`, `src/components/comment/CommentThread.tsx:40`

**Issue:** `page.tsx` calls `getCommentsForTarget(user.id, target)` at line 281 solely to compute `commentCount` for the hero badge. `CommentThread` independently calls `getCommentsForTarget(viewerId ?? '', target)` at line 40 to fetch and render comments. This is two DB round-trips to the same table with the same arguments. React `cache()` does not de-duplicate across RSC render passes for different callers (CommentThread renders inside a `<Suspense>` boundary, so it is not co-located with the page's data fetch).

**Fix:** Pass `commentCount` as a prop to `CommentThread` (it already receives it indirectly via the jump link in the hero, but the thread itself could expose `initialComments.length` back to the parent, or the page could pass the pre-fetched comments to the thread). Out of scope for this phase and classified as performance — noted for awareness only.

---

## Post-Review Resolution (Phase 64 chain, 2026-05-27)

Applied inline during the `--chain` execute-phase run, build + static guards re-confirmed green (426 static tests, `npm run build` exit 0):

- **CR-01 — FIXED.** Branch 1 empty-collection 3-CTA block in `page.tsx` now gated on `isOwner && collection.length === 0` (was `collection.length === 0` only). Non-owner viewers no longer see "Add to Wishlist/Collection" links that 404 against the owner-scoped edit route. (Pre-existing Phase 39b bug surfaced by this review; Phase 64 re-touched the block during the reorder.)
- **WR-01 — FIXED.** `WatchDetailHero` default `viewerCanEdit` changed `true → false` (defensive; all live callers pass it explicitly).
- **WR-02 — FIXED.** `ppr-dynamic-before-use-cache.test.ts` now also asserts `createSupabaseServerClient(` is absent from active code in the route (verified: the route uses only `createSupabaseAdminClient`). Closes the vacuous-proxy gap.
- **WR-03 — DEFERRED (advisory).** `formatDate` is triplicated across `WatchDetailHero`/`WatchDetailTrailing`/`WatchDetail` with the `timeZone:'UTC'` guard intact in all three (no live #418 bug). Extraction to `src/lib/formatDate.ts` is a quality refactor for a follow-up.
- **IN-01 — ACKNOWLEDGED.** `WatchDetail.tsx` (old monolith) is now rendered nowhere in the app but is retained because two pre-existing tests reference it (`tests/no-raw-img.test.ts`, `tests/components/watch/WatchDetail.isChronometer.test.tsx`). Cleanup requires migrating/removing those tests — out of scope.
- **IN-02 — ACKNOWLEDGED.** Double `getCommentsForTarget` round-trip (count + thread). Performance, out of scope.

---

_Reviewed: 2026-05-27T23:54:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
