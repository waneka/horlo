---
phase: 27-watch-card-collection-render-polish
plan: 04
subsystem: profile-card-render
tags: [vis-07, vis-08, ui-polish, wave-2, profile-card, tailwind, next-image]

# Dependency graph
requires:
  - phase: 27-watch-card-collection-render-polish
    plan: 01
    provides: "Wave 0 RED contract — ProfileWatchCard-priceLine.test.tsx (9 cases) + CollectionTabContent.test.tsx (1 case)"
provides:
  - "ProfileWatchCard renders a single status-driven price line for all card variants (owned/sold paid bucket; wishlist/grail target bucket; marketPrice fallback)"
  - "ProfileWatchCard <Image sizes> attr matches the 2-column mobile layout (50vw at <=640px)"
  - "CollectionTabContent renders 2 columns on mobile while preserving sm:grid-cols-2 / lg:grid-cols-4"
affects: [27-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-driven render-path unification — single price-line resolution function replaces a status-coupled JSX gate; pattern reused across card variants without duplication"
    - "Tailwind utility class lock for typography (`mt-1 text-xs font-normal text-foreground`) — UI-SPEC line 70 contract"
    - "Next.js 16 <Image sizes> attr scoped to layout breakpoints — 50vw at <=640px keeps srcset density correct for the new 2-col mobile grid"

key-files:
  created: []
  modified:
    - "src/components/profile/ProfileWatchCard.tsx (lines 41-56 inserted: status-driven price-line helper; line 67 sizes attr updated; lines 102-106 replaced wishlist-only Target block with priceLine render)"
    - "src/components/profile/CollectionTabContent.tsx (line 161: grid wrapper class string changed from grid-cols-1 to grid-cols-2)"

key-decisions:
  - "Insert priceLine helper above the JSX return rather than as a self-invoking IIFE — produces identical render output but reads more naturally and aligns with the project's predominant top-level-const idiom (no IIFE precedent in src/components/profile/)"
  - "Add explicit `font-normal` to the new price-line className per UI-SPEC line 70 lock (was implicit on the legacy block); same computed style on most browsers but matches the spec verbatim and makes future audits cheaper"
  - "Plan-04 explicitly does NOT touch WishlistTabContent — bundled with drag UX in Plan 05 because both edits target the same render branches in the same file"

patterns-established:
  - "Card price-line single-source-of-truth — one helper resolves the line for all 4 statuses + 3 price fields, no per-variant duplication; future card variants pick up the same shape"

requirements-completed: [VIS-07, VIS-08]

# Metrics
duration: 4min
completed: 2026-05-04
---

# Phase 27 Plan 04: ProfileWatchCard price line + CollectionTabContent 2-col grid Summary

**ProfileWatchCard surfaces a single status-driven price line; CollectionTabContent renders 2 columns on mobile. 10/10 Plan 01 RED test cases turn GREEN.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-04T07:53:39Z
- **Completed:** 2026-05-04T07:57:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **ProfileWatchCard** — Replaced the legacy wishlist-only `Target: $X` block (was at lines 85-89) with a unified status-driven price line that renders for ALL card variants (collection AND wishlist) per D-15..D-21:
  - `owned` / `sold` (paid bucket): `Paid: $X` if `pricePaid`, else `Market: $X` if `marketPrice`, else hide
  - `wishlist` / `grail` (target bucket): `Target: $X` if `targetPrice`, else `Market: $X` if `marketPrice`, else hide
  - `marketPrice` surfaces ONLY in the fallback role (D-20) — v6.0 Market Value owns first-class market display
- **ProfileWatchCard** — Updated `<Image sizes>` attr from `(max-width: 640px) 100vw, ...` to `(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw` (D-13) so srcset density matches the new 2-column mobile grid
- **CollectionTabContent** — Single-class change at line 161: `grid-cols-1` → `grid-cols-2` (VIS-07 / D-11). Tablet (`sm:grid-cols-2`) and desktop (`lg:grid-cols-4`) breakpoints preserved
- **Class string** — New price line uses `mt-1 text-xs font-normal text-foreground` per UI-SPEC line 70 (explicit `font-normal` added vs. legacy implicit weight)

## Task Commits

1. **Task 1 — ProfileWatchCard status-driven price line + sizes attr** — `593d9c5` (feat)
2. **Task 2 — CollectionTabContent grid-cols-2** — `58b5979` (feat)

## Files Created/Modified

- `src/components/profile/ProfileWatchCard.tsx` — Modified.
  - Line 67: `sizes` attr updated.
  - Lines 41-56: inserted `isWishlistLike` / `primary` / `primaryLabel` / `priceLine` helper above the JSX return.
  - Lines 102-106: replaced the wishlist-only `Target: $X` block (was lines 85-89) with the unified `{priceLine && (...)}` render.
  - Notes preview block at lines 107-111 unchanged — still gated on `showWishlistMeta && watch.notes`.
  - The `<Link href={\`/watch/${watch.id}\`}>` wrap at line 59 unchanged — non-owner click-through preserved.
- `src/components/profile/CollectionTabContent.tsx` — Modified. Line 161 only: `grid-cols-1` → `grid-cols-2`. Single-line diff (one `-` / one `+`). Empty-state grid at line 89 (`mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2`) deliberately untouched per PATTERNS line 614.

## Tests

| Test File | Cases | Pre-Plan-04 | Post-Plan-04 |
|-----------|-------|-------------|--------------|
| `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` | 9 | 4 PASS / 5 FAIL (RED) | 9 PASS / 0 FAIL (GREEN) |
| `src/components/profile/__tests__/CollectionTabContent.test.tsx` | 1 | 0 PASS / 1 FAIL (RED) | 1 PASS / 0 FAIL (GREEN) |
| `src/components/profile/WishlistTabContent.test.tsx` (Phase 27 cases — owned by Plan 05) | 3 NEW + 3 pre-existing | 3 PASS / 3 FAIL (Wave 0 RED) | 4 PASS / 2 FAIL (still RED — Plan 05 owns) |

**Plan 04 contract:** 10/10 GREEN.

**Net suite delta:** +6 passes, -6 failures (4168 passed / 29 failed post-Plan-04 vs. 4162 / 35 post-Plan-01). No new failures introduced.

## Decisions Made

- **Helper hoisted above JSX return** rather than as a self-invoking IIFE (PATTERNS suggested either shape). Produces identical render output; reads more naturally; aligns with the project's predominant top-level-const idiom in `src/components/profile/`.
- **Explicit `font-normal` added to the new price-line className** to match UI-SPEC line 70 verbatim. The legacy block used `text-xs text-foreground` (no explicit weight); same computed value on most browsers but the explicit class makes future audits cheaper and matches the spec contract.
- **WishlistTabContent NOT touched** — Plan 04 explicitly excludes it. The grid update there is bundled with the drag UX in Plan 05 because both edits target the same render branches in the same file (atomicity per Plan 04 objective line 41).
- **Acceptance criterion `grep -c isWishlistLike == 1` interpreted as "predicate exists"** — the actual count is 3 (declaration + 2 ternary uses) because the PATTERNS-prescribed helper shape (PATTERNS lines 405-411) uses the predicate three times. This is a consequence of using the documented helper shape; the frontmatter MUST_HAVES `contains: "isWishlistLike"` constraint is satisfied.

## Confirmations (per PLAN <output>)

- **Legacy wishlist-only Target block REPLACED, not supplemented:** confirmed. `grep -c "showWishlistMeta && watch.targetPrice" src/components/profile/ProfileWatchCard.tsx` returns 0 — the legacy gate is gone. The new `{priceLine && (...)}` block is the sole price-rendering path. No double rendering on wishlist tab (priceLine subsumes the wishlist case via the target bucket).
- **Notes preview block remains gated on `showWishlistMeta && watch.notes`:** confirmed. `grep -c "showWishlistMeta && watch.notes" src/components/profile/ProfileWatchCard.tsx` returns 1 (line 107). Wishlist-only behavior preserved.
- **WishlistTabContent grid update owned by Plan 05:** confirmed. `git diff main...HEAD -- src/components/profile/WishlistTabContent.tsx` is empty. The 2 RED cases in `WishlistTabContent.test.tsx` (Plan 01 Wave 0) intentionally remain RED until Plan 05 ships the drag wiring + grid update atomically.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed at the exact files/lines/edits specified in PLAN.md `<action>` blocks. All grep acceptance criteria pass (with the noted interpretation of `grep -c "isWishlistLike"` above — the helper shape is the PATTERNS-prescribed one).

## Issues Encountered

None. Pre-implementation RED state confirmed exactly as documented in Plan 01 SUMMARY (5/9 priceLine FAIL, 1/1 grid FAIL). Post-implementation GREEN state achieved on first vitest invocation for both files.

**Worktree node_modules:** symlinked from the parent checkout (`ln -s /Users/.../horlo/node_modules ./node_modules`) so vitest could resolve `@/lib/...` and the testing-library packages. This is a worktree-local convenience, not a file change committed to the repo.

## User Setup Required

None — both edits are pure render-path changes with no schema, dependency, or env-var implications.

## Next Phase Readiness

- **Plan 27-05 (drag UX wiring on WishlistTabContent):** can proceed. Plan 04 leaves the price-line truth table locked + the CollectionTab 2-col grid locked. Plan 05 will atomically ship the WishlistTab grid update + dnd-kit context + `SortableProfileWatchCard` wiring; the 2 still-RED Phase 27 cases in `WishlistTabContent.test.tsx` will turn GREEN there.

## Self-Check: PASSED

Verified files exist:
- FOUND: src/components/profile/ProfileWatchCard.tsx (modified — git log -1 hits Task 1 hash)
- FOUND: src/components/profile/CollectionTabContent.tsx (modified — git log -1 hits Task 2 hash)
- FOUND: .planning/phases/27-watch-card-collection-render-polish/27-04-SUMMARY.md (this file)

Verified commits exist:
- FOUND: 593d9c5 (Task 1 — ProfileWatchCard status-driven price line + sizes attr)
- FOUND: 58b5979 (Task 2 — CollectionTabContent grid-cols-2)

---
*Phase: 27-watch-card-collection-render-polish*
*Plan: 04*
*Completed: 2026-05-04*
