---
phase: 62-public-wear-pics-on-watch-detail
fixed_at: 2026-05-27T08:01:00Z
review_path: .planning/phases/62-public-wear-pics-on-watch-detail/62-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 62: Code Review Fix Report

**Fixed at:** 2026-05-27
**Source review:** `.planning/phases/62-public-wear-pics-on-watch-detail/62-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6 (CR-01, CR-02, WR-01, WR-02 note, WR-03, IN-01, IN-02)
- Skipped: 1 (WR-02 — false positive, documented rather than changed)

---

## Fixed Issues

### CR-01: `getPublicWearPicsForWatch` returns null-photo rows

**Files modified:** `src/data/wearEvents.ts`, `tests/unit/getPublicWearPicsForWatch.test.ts`
**Commit:** `364f0ee`
**Applied fix:** Added `isNotNull(wearEvents.photoUrl)` to the WHERE clause and the `isNotNull` import from drizzle-orm. Updated the return type to `photoUrl: string` (non-nullable, since the predicate guarantees it). Added 2 new test cases asserting null-photoUrl rows are excluded; fixed the ordering test to use non-null photoUrls.

---

### IN-01: Stale "stub for Wave 0" comment in getPublicWearPicsForWatch

**Files modified:** `src/data/wearEvents.ts`
**Commit:** `364f0ee` (included in the CR-01 commit)
**Applied fix:** Removed the "NOTE: This is a stub for Wave 0 test collection. Full implementation in Plan 02." comment. Updated the block comment to accurately describe the shipped production implementation including the new `photoUrl IS NOT NULL` predicate.

---

### CR-02 + IN-02: WatchPhotoSection passes hardcoded canComment/follow flags to WearCommentHost

**Files modified:** `src/components/watch/WatchPhotoSection.tsx`, `src/components/watch/WatchDetail.tsx`, `src/app/w/[ref]/page.tsx`
**Commit:** `90aa716`
**Applied fix:**
- Added `canCommentOnWears`, `ownerFollowsViewerForWears`, `viewerIsFollowingForWears` props to `WatchPhotoSectionProps` and `WatchDetailProps`.
- Updated `WearCommentHost` call to use `canComment={canCommentOnWears}`, `ownerFollowsViewer={ownerFollowsViewerForWears}`, `viewerIsFollowing={viewerIsFollowingForWears}` instead of hardcoded values.
- In `w/[ref]/page.tsx` Branch 1: passes `canCommentOnWears={!isOwner && canComment}` plus the two follow signals already resolved for the watch-level thread.
- In `w/[ref]/page.tsx` Branch 2 D-06 (owner branch): passes `canCommentOnWears={false}` and both follow flags as `false` (owner cannot comment on their own wear pics).
- The comment gate now applies to wear-pic comments exactly as it does to the watch-level thread.

---

### WR-01: Worn-tab wear-photo signing uses admin client without path-prefix check

**Files modified:** `src/app/u/[username]/[tab]/page.tsx`
**Commit:** `20603fd`
**Applied fix:** Added `if (!path.startsWith(\`${profile.id}/\`)) { wearPhotoSignedMap.set(path, null); return; }` guard inside the `Promise.all` map before calling `supabaseAdmin.storage.createSignedUrl`. Paths that fail the check fail-safe to `null` (placeholder). Mirrors the equivalent guard already present in `w/[ref]/page.tsx` for watch-photos.

---

### WR-02: revalidatePath('/w/[ref]', 'page') claimed to be a no-op (FALSE POSITIVE)

**Files modified:** `src/app/actions/wearEvents.ts`
**Commit:** `18816c8`
**Verdict: FALSE POSITIVE — no code change made.**

Per the Next.js 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` §"Revalidating a Page path"):

> `revalidatePath('/blog/[slug]', 'page')` — "This will invalidate any path that matches the provided `page` file for revalidation on the next page visit."

The second argument `'page'` combined with a dynamic segment pattern IS the documented, correct form for invalidating all pages of a dynamic route. It is NOT a no-op. The reviewer's claim that `'page'` scope requires an exact path is incorrect per the Next.js 16 documentation.

Added inline comments to `hideWearPicAction` and `unhideWearPicAction` citing the docs section so future reviewers don't re-raise this finding.

---

### WR-03: Optimistic hide revert uses stale closure-captured value under concurrent transitions

**Files modified:** `src/components/watch/WatchPhotoSection.tsx`
**Commit:** `ab94a1e`
**Applied fix:** Captured `currentHidden = isHidden` and `newHidden = !isHidden` from the render closure BEFORE entering `startTransition`. The async body uses `newHidden` for the optimistic apply and `currentHidden` for the failure revert. Both values now reference the same consistent snapshot from the moment of the tap, regardless of any re-render or concurrent second tap. The `toast.success` call uses `currentHidden` for the correct direction copy.

---

## Build and Test Status

- `npx vitest run tests/unit/` — **56/56 pass** (8 files; wearRail.test.ts D-17 guardrail green)
- `npm run build` — **exit 0** (includes TypeScript check + static generation)

---

_Fixed: 2026-05-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
