---
phase: 56-like-ui
fixed_at: 2026-05-22T18:21:00Z
review_path: .planning/phases/56-like-ui/56-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 56: Code Review Fix Report

**Fixed at:** 2026-05-22T18:21:00Z
**Source review:** .planning/phases/56-like-ui/56-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Overlays render on top of the loading skeleton in `WearPhotoClient`

**Files modified:** `src/components/wear/WearPhotoClient.tsx`
**Commit:** 341b43d
**Applied fix:** Wrapped the `WearPhotoOverlays` call in the non-failed return path with `{status !== 'pending' && (...)}`. The two failed-state branches (watchImageUrl fallback and no-photo placeholder) remain unconditional — overlays always render there as required by D-08. Only the pending skeleton state suppresses the overlays. Also updated the Phase 56 comment in the module docblock to accurately describe the new gating behavior.

---

### WR-01: `WEAR_ID` declared but never used; `'wear'` target type is untested

**Files modified:** `tests/components/shared/LikeButton.test.tsx`
**Commit:** b9c8b78
**Applied fix:** Added test section 9 ("LikeButton — wear target discriminator") with one test that renders `LikeButton` with `target={{ type: 'wear', id: WEAR_ID }}` and asserts `toggleLikeAction` is called with `{ type: 'wear', id: WEAR_ID }`. `WEAR_ID` is now exercised. All 15 tests (14 original + 1 new) pass.

---

### WR-02: `viewerId` prop typed `string | null` on `WatchDetail` but documented as "null impossible"

**Files modified:** `src/components/watch/WatchDetail.tsx`
**Commit:** ddc08ad
**Applied fix:** Narrowed `viewerId?: string | null` to `viewerId?: string` to match the documented invariant ("auth-only route; always a string"). Removed the no-op `viewerId ?? null` coalesce on the `LikeButton` callsite — TypeScript narrows `string | undefined` to `string` inside the `viewerId !== undefined` guard, so `LikeButton` receives exactly `string`. The callsite at `src/app/watch/[id]/page.tsx` passes `user.id` (always a `string`) — no change needed there.

---

## Skipped Issues

None.

---

_Fixed: 2026-05-22T18:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
