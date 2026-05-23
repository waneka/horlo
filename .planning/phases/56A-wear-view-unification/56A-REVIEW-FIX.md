---
phase: 56A-wear-view-unification
fixed_at: 2026-05-23T09:17:00Z
review_path: .planning/phases/56A-wear-view-unification/56A-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 56A: Code Review Fix Report

**Fixed at:** 2026-05-23T09:17:00Z
**Source review:** .planning/phases/56A-wear-view-unification/56A-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0
- Info findings (IN-01, IN-02): out of scope per run directive

## Fixed Issues

### CR-01: D-09 own-wear gate not enforced server-side

**Files modified:** `src/app/actions/wishlist.ts`
**Commit:** `0dba952`
**Applied fix:** Added an early `if (isSelf) return { success: false, error: 'Wear event not found' }` guard immediately after the `isSelf` assignment (line 90). Removed the `isSelf ||` branch from the `canSee` predicate since own-wears are now blocked categorically before that predicate is reached — the predicate now covers only non-self visibility correctly. Updated the JSDoc to document D-09 prohibition rather than G-5 self-bypass. The follow-check branch condition was also simplified from `if (!isSelf && ...)` to `if (...)` since the isSelf path can no longer reach it.

### WR-01: "Copy link" copies a relative path, not a usable URL

**Files modified:** `src/components/wear/WearOverflowMenu.tsx`
**Commit:** `20fe528`
**Applied fix:** Changed the `onClick` handler of the "Copy link" `DropdownMenuItem` to construct `const absolute = \`\${window.location.origin}\${permalinkUrl}\`` and write that to the clipboard instead of the bare relative `permalinkUrl`. The `window.location.origin` is safe since this component is `'use client'` and only runs in the browser.

### WR-02: Embla viewport contains a sibling close button — pointer events conflict

**Files modified:** `src/components/wears/WearsLane.tsx`
**Commit:** `92b2f2d`
**Applied fix:** Restructured the return JSX to a two-level layout. The outer `div` is now a positional container (retains the `fixed inset-0 h-dvh overflow-hidden md:...` classes) that holds the close button as a positioned sibling. A new inner `div` carries `ref={emblaRef}` and `overflow-hidden bg-background md:max-w-[600px] md:mx-auto` classes — this is the embla viewport. The close button (aria-label, 44px touch target, top-3 left-3 z-20, router.back()) is unchanged and sits outside embla's pointer-listener tree.

### WR-03: WearCommentHost bottom-sheet variant unguarded for missing onOpenChange

**Files modified:** `src/components/wear/WearCommentHost.tsx`
**Commit:** `5e1d3be`
**Applied fix:** Replaced the flat `interface WearCommentHostProps` with a discriminated union type:
- `bottom-sheet` arm: `open: boolean` and `onOpenChange: (v: boolean) => void` are both required (not optional).
- `inline` arm: `open?: never` and `onOpenChange?: never` prevents passing those props accidentally.
No runtime behaviour changes; the function body was already correct.

### WR-04: WearCommentHost missing wearEventId prop creates Phase 57 breakage seam

**Files modified:** `src/components/wear/WearCommentHost.tsx`, `src/components/wear/WearCard.tsx`
**Commit:** `aa24259`
**Applied fix:** Added `wearEventId: string` to both arms of the `WearCommentHostProps` discriminated union. In the function body, destructured as `wearEventId: _wearEventId` (with an eslint-disable comment) since Phase 56A keeps the placeholder body unchanged — Phase 57 renames it and connects it to comment fetching. Updated both `WearCommentHost` callsites in `WearCard.tsx` (lines 186-190 and 192) to pass `wearEventId={wearEventId}`, which is already in scope. Phase 57 is now a drop-in with no interface or callsite changes needed.

---

## Test Results

```
Tests  14 passed (14)
Files  3 passed (3)
  tests/data/getActiveWearsForUser.test.ts    (7 tests — all pass)
  tests/components/wear/WearCard.test.tsx     (3 tests — all pass)
  tests/integration/phase56a-wears-lane.test.ts (4 tests — all pass)
```

TypeScript check (touched files only):
```
npx tsc --noEmit 2>&1 | grep -E "WearCard|WearCommentHost|WearOverflowMenu|WearsLane|wishlist"
→ no 56A type errors
```

---

_Fixed: 2026-05-23T09:17:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
