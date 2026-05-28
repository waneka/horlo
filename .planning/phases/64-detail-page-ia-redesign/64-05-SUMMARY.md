---
phase: 64-detail-page-ia-redesign
plan: 05
subsystem: ui
tags: [tailwind, responsive, mobile, watchdetail, a11y]

# Dependency graph
requires:
  - phase: 64-detail-page-ia-redesign
    provides: WatchDetailHero two-column grid with minmax(0,3fr)/minmax(0,2fr) track fix (16c3700), unified hero right column with WatchDetailContextBlock full-width (084ec94), owner-only status badge gate (95385e9)
provides:
  - Mobile-only brand+model <h1> hoisted above the hero carousel on /w/[ref] via JSX duplication with lg:hidden responsive visibility
  - Desktop right-column title block unchanged, downgraded from <h1> to <h2> (one h1 per page rule)
  - WatchPageSkeleton mirrored: lg:hidden brand+model skeleton row above the grid, hidden lg:block wrapping the right-column brand+model placeholders
  - Static guard (watch-detail-ia-order.test.ts) extended with 6 new assertions locking in the mobile/desktop responsive split
  - UAT Test 2 gap closed: mobile title above the fold on prod (approved 2026-05-28)
affects: [watch-detail, WatchDetailHero, WatchPageSkeleton, mobile-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mobile-first identifier hoist via JSX duplication with lg:hidden / hidden lg:block — the GSD pattern for mobile DOM-order tweaks when D-07-style tab-order parity bans CSS order- utilities"
    - "One h1 per page rule with breakpoint split: mobile block holds the canonical <h1>, desktop right column uses <h2> styled identically (font-serif text-3xl) — visual parity, semantic correctness"

key-files:
  created: []
  modified:
    - src/components/watch/WatchDetailHero.tsx
    - src/app/w/[ref]/page.tsx
    - tests/static/watch-detail-ia-order.test.ts

key-decisions:
  - "Mobile hoist uses JSX duplication with lg:hidden / hidden lg:block, NOT CSS order- utilities (D-07 tab-order parity ban)"
  - "h1 lives in the mobile-only block so the page heading is above the fold on the dominant viewport; desktop right column uses h2 (one h1 per page a11y rule)"
  - "Ref line + SpecsSublabel remain in the right column at all breakpoints — descriptive metadata intentionally below the photo on mobile"
  - "Branch 3 (catalog inline hero) left untouched — its side-by-side layout is already correct at every viewport"

patterns-established:
  - "JSX duplication with responsive visibility classes: preferred approach for DOM-order tweaks that must not violate D-07 CSS order- ban"

requirements-completed: [PAGE-01]

# Metrics
duration: checkpoint-resume (Task 2 human-verify)
completed: 2026-05-28
---

# Phase 64 Plan 05: Mobile Brand+Model Hoist Above the Fold Summary

**Mobile-only JSX hoist of brand+model <h1> above the hero carousel in WatchDetailHero, mirrored in WatchPageSkeleton, with 6 new static guard assertions — closes UAT Test 2 gap, prod-verified 2026-05-28.**

## Performance

- **Duration:** checkpoint-resume (Task 1 auto, Task 2 human-verify)
- **Started:** prior session
- **Completed:** 2026-05-28
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments

- Closed UAT Test 2 gap: brand+model identifier now above the fold on mobile viewports at /w/[ref]; carousel follows below
- Implemented mobile hoist using JSX duplication with `lg:hidden` / `hidden lg:block` responsive visibility — no CSS `order-` utilities (D-07 preserved)
- Maintained exactly one `<h1>` per page: mobile-only block holds the canonical `<h1>`, desktop right-column heading downgraded to `<h2>` styled identically
- Status badge (owned/wishlist/grail) remains owner-only at every breakpoint — `viewerCanEdit` gate preserved in both the mobile-only block and the desktop block (commit 95385e9 invariant held)
- WatchPageSkeleton mirrored: `lg:hidden` brand+model skeleton row above the grid, `hidden lg:block` wrapping the existing right-column brand+model placeholders — no content jump after PPR cache fill
- Static guard `tests/static/watch-detail-ia-order.test.ts` extended with 6 new assertions locking in the responsive split (lg:hidden block exists, hidden lg:block exists, exactly one h1, no order- utilities D-07, mobile block contains both watch.brand and watch.model, mobile Badge gated by viewerCanEdit)
- Branch 3 (catalog inline hero in page.tsx) byte-for-byte unchanged
- WatchDetailContextBlock render position in Branches 1 and 2 unchanged

## Task Commits

1. **Task 1: Hoist mobile brand+model header in WatchDetailHero + mirror in WatchPageSkeleton + extend static guard** - `f4b04ed` (feat)
2. **Task 2: Prod human-verify** - (no code commit; checkpoint approved by user 2026-05-28, all 7 checks pass)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `src/components/watch/WatchDetailHero.tsx` - Added `lg:hidden` mobile-only header block (Badge + `<h1>` brand + `<p>` model) above the existing grid; wrapped desktop right-column title block in `hidden lg:block`; downgraded desktop `<h1>` to `<h2>`; ref + SpecsSublabel remain unconditional in the right column
- `src/app/w/[ref]/page.tsx` - WatchPageSkeleton updated: `lg:hidden` brand+model skeleton row inserted above the grid; right-column brand+model Skeletons wrapped in `hidden lg:block`; all other Skeleton code paths unchanged; no `'use client'`, no hooks, no dynamic API calls added
- `tests/static/watch-detail-ia-order.test.ts` - New describe block `PAGE-01 mobile: brand+model hoisted above the grid on mobile (gap closure 64-05)` with 6 it-cases

## Decisions Made

- **JSX duplication over CSS order-**: D-07 bans CSS `order-` utilities for reordering (tab-order parity). The mobile hoist uses a duplicated JSX block visible only on mobile (`lg:hidden`) with the desktop right-column block hidden on mobile (`hidden lg:block`). No `order-first`, `order-last`, `order-1`, or `lg:order-*` anywhere.
- **h1 in mobile block, h2 in desktop column**: The page heading should be above the fold on the dominant viewport (mobile). Downgrading the desktop block to `<h2>` (same Tailwind typography classes, visually identical) preserves the one-h1-per-page accessibility rule without requiring the mobile block to be `aria-hidden`.
- **Ref line + SpecsSublabel stay in right column**: Descriptive metadata (reference, movement, case size, dial color) intentionally below the photo on mobile — these are secondary spec details, not the page identifier.
- **Branch 3 (catalog) untouched**: The catalog inline hero (page.tsx ~line 675) was already side-by-side at every viewport and correct. Scope boundary maintained.

## Deviations from Plan

None — plan executed exactly as written. Task 1 implemented the mobile hoist per spec; Task 2 was a human-verify checkpoint that the user approved with all 7 prod checks passing.

## Issues Encountered

None.

## UAT Outcome

UAT Test 2 ("Mobile single-column collapse — brand+model reachable above the fold") flips from `issue` to `pass`.

All 7 prod checks approved 2026-05-28:
1. Mobile owned watch — Badge + brand + model above the fold (pass)
2. Mobile ref + SpecsSublabel below photo (pass)
3. Mobile cross-user — no Badge (pass)
4. Desktop owned — unchanged from before, one `<h1>` (pass)
5. Loading skeleton mirrors mobile + desktop layouts (pass)
6. Catalog Branch 3 unchanged (pass)
7. Soft-nav PPR — no React #419/404 (pass)

Reference: `.planning/phases/64-detail-page-ia-redesign/64-HUMAN-UAT.md` (Test 2 gap resolved)
Debug session: `.planning/debug/mobile-title-above-fold.md`

## User Setup Required

None — no external service configuration required.

## Lessons / Reusable Patterns

**Mobile-first identifier hoist pattern:** When a watch detail (or any content detail) page needs its identifying heading above a tall visual on mobile — and CSS `order-` is banned (D-07 tab-order parity) — the correct pattern is JSX duplication with responsive visibility:

1. Render the identifier block ABOVE the visual wrapper, wrapped in `lg:hidden`.
2. Wrap the SAME identifier block inside the desktop right column with `hidden lg:block`.
3. In the mobile block, use `<h1>` (canonical heading above the fold). In the desktop block, downgrade to `<h2>` (same typography, one h1 per page).
4. Mirror the split in any loading skeleton that covers the same DOM region (prevents content jump after PPR cache fill).
5. Add a static guard asserting: lg:hidden block exists, hidden lg:block block exists, exactly one `<h1>`, no `order-` utilities, identifier tokens inside the lg:hidden substring.

This pattern scales to any future page type where the "identifier should be above the fold on mobile but beside the visual on desktop."

## Next Phase Readiness

Phase 64 gap closure complete. All 5 plans (64-01 through 64-05) executed; all UAT tests pass. Phase 64 is ready for phase-complete state transition via the orchestrator.

---
*Phase: 64-detail-page-ia-redesign*
*Completed: 2026-05-28*
