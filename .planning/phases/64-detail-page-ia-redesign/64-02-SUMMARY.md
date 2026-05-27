---
phase: 64-detail-page-ia-redesign
plan: 02
subsystem: watch-detail-ui
tags: [hero-island, client-component, ia-redesign, photo-forward, verdict-elevation]
dependency_graph:
  requires: [64-01]
  provides: [WatchDetailHero client island]
  affects: [src/components/watch/WatchDetailHero.tsx]
tech_stack:
  added: []
  patterns: [client island extraction, 2-col grid hero, jump-to-comments anchor, D-10 empty verdict states]
key_files:
  created:
    - src/components/watch/WatchDetailHero.tsx
  modified: []
decisions:
  - "'use client' hero island: WatchDetailHero is a self-contained client island (handlers need useRouter + useTransition + useState)"
  - "UserPreferences prop removed from hero: verdict is precomputed in page.tsx; collection is only needed for D-10 collection.length check"
  - "Check icon (lucide) not imported in hero: it was used only in Specifications card (trailing territory)"
  - "CommentThread references in JSDoc comments reworded to avoid import.*CommentThread regex false-positive in PAGE-03 guard"
metrics:
  duration: 3m
  completed: 2026-05-27
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 64 Plan 02: WatchDetailHero Island Summary

WatchDetailHero client island — photo-forward 2-col grid with elevated verdict, SpecsSublabel condensed strip, jump-to-comments anchor, and owner-gated actions extracted from WatchDetail.tsx hero portion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WatchDetailHero client island | 0868e12 | src/components/watch/WatchDetailHero.tsx |

## What Was Built

`src/components/watch/WatchDetailHero.tsx` is a new `'use client'` island implementing the locked hero composition from the UI-SPEC:

- **Desktop grid:** `grid gap-8 lg:grid-cols-[3fr_2fr]` — `WatchPhotoSection` in the left (3fr) column; title/verdict/actions in the right (2fr) column
- **Right column order (locked):** `Badge` status → brand `h1` (font-serif text-3xl sm:text-4xl) → model (text-lg sm:text-xl) → reference → `SpecsSublabel` condensed strip → verdict block → LikeButton + jump anchor → last-worn (owner gate) → flag-deal (owner gate) → owner actions (owner gate)
- **Verdict block (D-09):** `CollectionFitCard` elevated from page bottom into hero right column when `verdict` is non-null
- **Empty-verdict states (D-10):**
  - `verdict === null` + `collection.length === 0` + `catalogTaste.confidence >= 0.5` → `ReferenceIdentityCard`
  - Otherwise → caption "Add a few watches to see how this one fits your collection."
- **Jump anchor (D-06):** `<a href="#comments">` with `MessageCircle` icon, `min-h-[44px]` touch target, `sr-only` "comments" label, hidden at zero count — no `CommentThread` import
- **Owner gates (T-64-04):** Mark-Worn / Edit / Delete Dialog all gated by `viewerCanEdit`; flag-deal gated by `isWishlistLike && viewerCanEdit`
- **Date safety (React #418):** `formatDate` uses `toLocaleDateString('en-US', { timeZone: 'UTC' })`
- **B1 invariant (PAGE-03/T-64-05):** No `CommentThread` import; `commentCount` is a plain `number` prop

## Verification

- `head -1 WatchDetailHero.tsx` → `'use client'` ✓
- `grep WatchPhotoSection` → present ✓
- `grep CollectionFitCard` → present ✓
- `grep 'href="#comments"'` → present ✓
- `grep 'lg:grid-cols-\[3fr_2fr\]'` → present ✓
- `grep "timeZone: 'UTC'"` → present ✓
- `grep -E "import.*CommentThread"` → no match ✓
- `grep "Add a few watches..."` → present ✓
- `npx vitest run --reporter=basic -t "PAGE-03|PAGE-04"` → 2 passed ✓
- `npm run build` → exit 0 ✓

PAGE-01/02 tests (page.tsx child ordering) remain RED by design — those turn GREEN in Plan 04 when page.tsx is rewired.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CommentThread prose in JSDoc matched PAGE-03 regex**
- **Found during:** Task 1 verification
- **Issue:** The JSDoc comment "does NOT import CommentThread" matched `grep -E "import.*CommentThread"` — the static test `expect(content).not.toMatch(/import.*CommentThread/)` would have false-positive flagged the file
- **Fix:** Reworded comment to "B1 invariant (PAGE-03): CommentThread is NOT referenced in this file." — preserves intent without triggering the guard
- **Files modified:** src/components/watch/WatchDetailHero.tsx
- **Commit:** 0868e12

**2. [Rule 1 - Scope] Removed unused imports from WatchDetail.tsx hero copy**
- **Found during:** Task 1 implementation
- **Issue:** `Check` (lucide), `UserPreferences` (types), `MOVEMENT_LABELS` (constants), `Card/CardContent/CardHeader/CardTitle` (ui) were in WatchDetail.tsx imports but are only used in the trailing section (spec cards / Chronometer row) — not in the hero JSX
- **Fix:** Removed those unused imports from WatchDetailHero.tsx; kept only hero-relevant imports
- **Files modified:** src/components/watch/WatchDetailHero.tsx
- **Commit:** 0868e12

## Threat Surface Scan

No new network endpoints, auth paths, or file-access patterns introduced. `WatchDetailHero.tsx` is a client-only render component — no server-side data fetching.

| Flag | File | Description |
|------|------|-------------|
| T-64-04 mitigated | WatchDetailHero.tsx | viewerCanEdit gates all Mark-Worn/Edit/Delete/Flag-deal blocks; underlying Server Actions (removeWatch, markAsWorn, editWatch) double-verify ownership |
| T-64-05 mitigated | WatchDetailHero.tsx | No CommentThread import; PAGE-03 static guard passes; commentCount is plain number prop |

## Self-Check

- [x] `src/components/watch/WatchDetailHero.tsx` exists
- [x] Commit 0868e12 exists in git log
- [x] Build exits 0
- [x] PAGE-03 + PAGE-04 static assertions pass

## Self-Check: PASSED
