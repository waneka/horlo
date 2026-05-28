---
status: partial
phase: 64-detail-page-ia-redesign
source: [64-VERIFICATION.md]
started: 2026-05-27T00:00:00Z
updated: 2026-05-27T00:00:00Z
---

## Current Test

number: 1
name: Desktop 2-column hero layout (PAGE-01/04)
expected: |
  Hero is a 2-column grid: carousel left, verdict + title + like right; CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails.
awaiting: user response

## Tests

### 1. Desktop 2-column hero layout (PAGE-01/04)
expected: Hero is a 2-column grid: carousel left, verdict + title + like right; CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails.
result: issue
reported: "balance is way off on the 2 column section - the photos are only taking up maybe 1/6 of the width"
severity: major
root_cause: "Grid is correct (lg:grid-cols-[3fr_2fr] = 60/40). WatchPhotoSection carousel viewport hard-caps at `max-w-md` (448px) at WatchPhotoSection.tsx:448, so it cannot fill its 3fr column; on a wide window 448px reads as ~1/6 of the screen and defeats PAGE-04 (carousel as primary visual). UI-SPEC CSS-chain blind spot — checker validated the grid token, not the carousel's internal max-width."
fix: "Added `fill` prop to WatchPhotoSection (default false = unchanged elsewhere); relaxes the carousel viewport/indicator/filmstrip max-w caps so they fill the container. WatchDetailHero passes `fill`. Kept the locked 60/40 ratio (user choice). Aligned WatchPageSkeleton carousel placeholder to aspect-square to match. Build exit 0; 426 static tests GREEN. PENDING re-verify on prod."

### 2. Mobile single-column collapse (PAGE-01)
expected: Hero collapses to single column: carousel on top, then title/verdict/like/actions; order remains hero → comments → spec cards → rails → footer.
result: [pending]

### 3. Jump-to-comments scroll behavior (PAGE-02)
expected: Tapping the hero comment count smooth-scrolls (or jumps on reduced-motion) to the #comments section.
result: [pending]

### 4. Soft-nav #419 absence (PAGE-03)
expected: No React #419/404 error on in-app soft navigation to/from a /w/[ref] page; the unstable_instant=false + await connection() fix holds after cache fills (verify AFTER cache warms, not on cold read).
result: [pending]

### 5. Catalog branch layout (PAGE-01)
expected: On a catalog-only /w/[ref] (a ref you don't own): verdict-forward hero; OtherOwnersRoster + CatalogPageActions sit high near the verdict; no comments and no multi-photo carousel.
result: [pending]

### 6. Owner vs non-owner actions
expected: As owner: Mark-as-Worn / Edit / Delete present in the hero. As non-owner viewer: those controls absent (and the empty-collection "Add to Wishlist/Collection" CTAs do not appear — CR-01 fix).
result: [pending]

### 7. WatchPageSkeleton visual match (PAGE-01)
expected: Loading skeleton mirrors the new IA: hero grid (left carousel placeholder, right column), comment skeleton, spec-cards skeleton.
result: [pending]

### 8. Overall "intentional hierarchy" feel (PAGE-01)
expected: Comments are reachable without scrolling past all rails; the carousel and verdict are the primary visuals above the fold on a desktop viewport.
result: [pending]

## Summary

total: 8
passed: 0
issues: 1
pending: 7
skipped: 0
blocked: 0

## Gaps

- truth: "Carousel is the primary visual at ~60% width in the desktop 2-col hero (PAGE-04)"
  status: failed
  reason: "User reported: balance way off — photos only ~1/6 width. WatchPhotoSection viewport caps at max-w-md (448px) and cannot fill the 3fr column."
  severity: major
  test: 1
  artifacts: [src/components/watch/WatchPhotoSection.tsx:448]
  missing: ["carousel must fill its hero column (remove/raise max-w-md, or make it a prop so the hero passes a fill variant)"]
