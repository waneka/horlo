---
status: complete
phase: 64-detail-page-ia-redesign
source: [64-VERIFICATION.md]
started: 2026-05-27T00:00:00Z
updated: 2026-05-28T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop 2-column hero layout (PAGE-01/04)
expected: Hero is a 2-column grid: carousel left, verdict + title + like right; CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails.
result: pass
resolution: "Re-verified on prod 2026-05-28 after grid-track fix (16c3700) + D-09 hero unification (084ec94/bd90f54) + owner badge gate (95385e9)."
original_report: "balance is way off on the 2 column section - the photos are only taking up maybe 1/6 of the width"
severity: major
root_cause: "Grid is correct (lg:grid-cols-[3fr_2fr] = 60/40). WatchPhotoSection carousel viewport hard-caps at `max-w-md` (448px) at WatchPhotoSection.tsx:448, so it cannot fill its 3fr column; on a wide window 448px reads as ~1/6 of the screen and defeats PAGE-04 (carousel as primary visual). UI-SPEC CSS-chain blind spot — checker validated the grid token, not the carousel's internal max-width."
fix_attempt_1: "Added `fill` prop to WatchPhotoSection (relax max-w-md/max-w-sm caps). Necessary but INSUFFICIENT — user reported no change. The carousel was never hitting max-w-md; it was being squeezed BELOW it."
real_root_cause: "CSS grid `lg:grid-cols-[3fr_2fr]` defaults to `minmax(auto,3fr) minmax(auto,2fr)` — each track is forced ≥ its content min-content. The right column's CollectionFitCard (compare `<table>` + badges) has a large min-content, inflating the 2fr track and STARVING the carousel track to ~1/6. User nailed it: 'collection fit section pushing the border.'"
fix: "Changed hero grid to `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` + `min-w-0` on both column wrappers (WatchDetailHero) so tracks respect the strict 60/40 ratio and content wraps/fits within its column instead of blowing out the track. Applied the same to WatchPageSkeleton. Kept the `fill` prop (so the carousel fills its now-correct 60% column). Verified generated CSS contains `grid-template-columns:minmax(0,3fr) minmax(0,2fr)`. Build exit 0; 426 static tests GREEN. PENDING re-verify on prod."
design_change: "D-09 REFINED (user decision, UAT 2026-05-27): the full Collection Fit verdict is NO LONGER shown in the hero for OWNED watches (same-user framing) — the buy/skip question is moot once owned. Only the role-overlap note ('competes for wrist time') surfaces lower in the page (WatchDetailTrailing). Verdict stays hero-forward for cross-user (viewing someone else's watch) + catalog entries (candidate buy contexts). Implemented via `verdict.framing === 'cross-user'` gate in WatchDetailHero + a same-user role-note in WatchDetailTrailing (verdict prop threaded from page.tsx Branches 1 & 2). Build exit 0; 426 static guards GREEN. PENDING re-verify on prod."
design_change_2: "D-09/D-10 SECOND REFINEMENT (user decision, UAT 2026-05-27): cross-user hero felt cramped. UNIFY the hero right column across ALL viewers — title → spec strip → like+jump → owner actions only (no verdict, no empty-state cards there). Extract the verdict / ReferenceIdentityCard / fallback caption into a new RSC `WatchDetailContextBlock` (src/components/watch/WatchDetailContextBlock.tsx) rendered FULL-WIDTH directly below the hero (above CommentThread) in page.tsx Branches 1 & 2. Branch 3 (catalog) was already single-column and unchanged. Static guards 14/14 GREEN (427 tests; +1 from earlier WR-02). Build exit 0. PENDING re-verify on prod."

### 2. Mobile single-column collapse (PAGE-01)
expected: Hero collapses to single column: carousel on top, then title/verdict/like/actions; order remains hero → comments → spec cards → rails → footer.
result: pass
reported: "pass - but i think we need to tweak. the large photo looks great at the top but with the thumbnail filmstrip below, the title actually is pushed below the fold. i'm wondering if it should maybe be above the photo on mobile, just the watch brand and name. that would potentially orphan the other info included in the title (ref, type, size, color)"
resolution: "Fixed in plan 64-05 (commit f4b04ed): mobile-only brand+model hoist above carousel via JSX duplication with lg:hidden. Prod-approved 2026-05-28, all 7 checks pass."
severity: minor
note: "Originally a UX refinement gap (structurally passed, brand+model was below fold). Resolved by plan 64-05 mobile hoist."

### 3. Jump-to-comments scroll behavior (PAGE-02)
expected: Tapping the hero comment count smooth-scrolls (or jumps on reduced-motion) to the #comments section.
result: pass

### 4. Soft-nav #419 absence (PAGE-03)
expected: No React #419/404 error on in-app soft navigation to/from a /w/[ref] page; the unstable_instant=false + await connection() fix holds after cache fills (verify AFTER cache warms, not on cold read).
result: pass

### 5. Catalog branch layout (PAGE-01)
expected: On a catalog-only /w/[ref] (a ref you don't own): verdict-forward hero; OtherOwnersRoster + CatalogPageActions sit high near the verdict; no comments and no multi-photo carousel.
result: pass

### 6. Owner vs non-owner actions
expected: As owner: Mark-as-Worn / Edit / Delete present in the hero. As non-owner viewer: those controls absent (and the empty-collection "Add to Wishlist/Collection" CTAs do not appear — CR-01 fix).
result: pass

### 7. WatchPageSkeleton visual match (PAGE-01)
expected: Loading skeleton mirrors the new IA: hero grid (left carousel placeholder, right column), comment skeleton, spec-cards skeleton.
result: pass

### 8. Overall "intentional hierarchy" feel (PAGE-01)
expected: Comments are reachable without scrolling past all rails; the carousel and verdict are the primary visuals above the fold on a desktop viewport.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Carousel is the primary visual at ~60% width in the desktop 2-col hero (PAGE-04)"
  status: resolved
  reason: "User reported: balance way off — photos only ~1/6 width. Root cause: CSS grid track blowout (default minmax(auto, Nfr) was sized by CollectionFitCard min-content)."
  severity: major
  test: 1
  fix: "Pin grid to minmax(0,3fr)/minmax(0,2fr) + min-w-0 on both columns (16c3700); subsequently unified hero right column across viewers and moved verdict to full-width WatchDetailContextBlock (084ec94)."
  verified: "Prod re-verify 2026-05-28 — user typed pass."

- truth: "On mobile, the brand+model identifier is reachable above the fold on a /w/[ref] page"
  status: resolved
  reason: "User reported: 'photo looks great at top but with the thumbnail filmstrip below, the title is pushed below the fold.' Test 2 structurally passes (single-column collapse + correct stacking order) — gap was a UX refinement scoped into Phase 64 by user choice. Fixed in plan 64-05."
  severity: minor
  test: 2
  root_cause: "Mobile stack-order — identifier below visual. WatchDetailHero.tsx:159 declares the hero as a grid with `lg:` modifier ({grid-cols-1 on mobile collapses → DOM child order rules}); photo column renders FIRST (line 167, ~470–580px tall on 390px viewport), title block SECOND (line 209). ~600px of photo content lands above the <h1> on iPhone-class viewports. Not a defect — UI-SPEC D-01 says 'mobile: single column'. Title block is already a clean sub-tree (brand <h1> + model <p> are separable from ref + SpecsSublabel)."
  fix: "Plan 64-05: mobile-only JSX hoist of brand+model <h1> above the hero grid via lg:hidden / hidden lg:block responsive visibility (NOT CSS order- per D-07); WatchPageSkeleton mirrored; static guard extended; desktop right-column <h1> downgraded to <h2> (one h1 per page)."
  verified: "Prod approval 2026-05-28 — all 7 UAT checks pass (commit f4b04ed). Debug session: .planning/debug/mobile-title-above-fold.md"
  artifacts:
    - path: "src/components/watch/WatchDetailHero.tsx"
      issue: "Mobile DOM child order puts photo column before title block; brand+model lands below the fold."
    - path: "src/app/w/[ref]/page.tsx"
      issue: "WatchPageSkeleton (lines 108-127) mirrors the same grid; must update in parallel or Test 7 regresses + content-jump on cache-fill."

- truth: "Cross-user viewers do not see misleading owner-only ownership indicators"
  status: resolved
  reason: "User reported: 'I see [owned chip] when looking at another user's collection watches.' WatchDetailHero.tsx:212 rendered watch.status (owned/wishlist/grail) unconditionally — but that's the OWNER's relationship to THEIR record. For a cross-user viewer it implied they owned the piece."
  severity: major
  test: incidental (found during Test 1 re-verify)
  fix: "Gated the status badge on `viewerCanEdit` so it's owner-only. Build exit 0; 427 static guards GREEN. Server Actions remain the authoritative ownership check; this is purely a UX correctness fix."
