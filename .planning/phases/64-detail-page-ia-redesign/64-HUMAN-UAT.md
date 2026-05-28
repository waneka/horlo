---
status: partial
phase: 64-detail-page-ia-redesign
source: [64-VERIFICATION.md]
started: 2026-05-27T00:00:00Z
updated: 2026-05-27T00:00:00Z
---

## Current Test

[awaiting human testing — push origin main → Vercel, verify AFTER the route cache fills]

## Tests

### 1. Desktop 2-column hero layout (PAGE-01/04)
expected: Hero is a 2-column grid: carousel left, verdict + title + like right; CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails.
result: [pending]

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
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
