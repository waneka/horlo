---
phase: 64-detail-page-ia-redesign
plan: "04"
subsystem: ui
tags: [next.js, react, ppr, cache-components, ssr, server-components]

# Dependency graph
requires:
  - phase: 64-detail-page-ia-redesign plan 01
    provides: SpecsSublabel extraction, CommentThread id=comments anchor, IA-order + privacy static guards, repaired PPR guard
  - phase: 64-detail-page-ia-redesign plan 02
    provides: WatchDetailHero client island (2-col hero, elevated verdict, carousel-forward, owner gates)
  - phase: 64-detail-page-ia-redesign plan 03
    provides: WatchDetailTrailing pure RSC (four spec cards, gap-fill, notes, #418-safe dates)
provides:
  - "All three /w/[ref] page.tsx render branches re-ordered to the canonical IA"
  - "Branch 1 + Branch 2-D06: hero → comments → trailing → SameFamilyRail → LineageRail → footer"
  - "Branch 3 (catalog): catalog shell → verdict/empty-state → OtherOwnersRoster → CatalogPageActions → SameFamilyRail → LineageRail"
  - "WatchPageSkeleton mirroring new IA (hero grid + comment skeleton + spec-cards skeleton)"
  - "watch-detail-ia-order.test.ts GREEN (hero < comments < trailing < SameFamilyRail)"
affects: [65-and-beyond, any-phase-touching-w-ref-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-tree child ordering as the canonical IA signal — DOM order equals visual order (D-07); no CSS flex-reverse tricks"
    - "Branch-3 catalog shell stays inline RSC — no client island for catalog-only path"
    - "WatchPageSkeleton as pure JSX with Skeleton primitives only (no dynamic API, no hooks) to be a valid Suspense fallback under connection() opt-out"

key-files:
  created: []
  modified:
    - src/app/w/[ref]/page.tsx

key-decisions:
  - "Branch 2-D06 (owner via catalogId) correctly omits OtherOwnersRoster + CatalogPageActions — those are cross-user-only components (RESEARCH confirms); Phase-64 TODO at ~595 resolved by leaving them absent"
  - "Branch 3 container changed from space-y-6 to space-y-8 for parity with Branches 1+2 (D-14)"
  - "WatchPageSkeleton updated to mirror new IA (hero grid lg:grid-cols-[3fr_2fr] + comment skeleton + spec-cards skeleton) while staying hook-free and API-free to remain a valid Suspense fallback"
  - "Phase-64 TODO comments (D-13 OtherOwnersRoster/CatalogPageActions position) resolved and removed — no live TODOs remain in page.tsx"
  - "Prod human-verify (Task 3) auto-approved in chain mode; actual prod check (push to Vercel, cache fill, visual + scroll + #419 verification) is PENDING and human_needed"

patterns-established:
  - "Canonical page.tsx IA wiring: WatchDetailHero island → Suspense(CommentThreadSkeleton){CommentThread} → WatchDetailTrailing RSC → rails → footer"
  - "Cache Components plumbing (unstable_instant=false, await connection(), admin-client signing before getLikesForTargetCached) preserved byte-for-byte; enforced by PPR static guard"

requirements-completed: [PAGE-01, PAGE-02, PAGE-03, PAGE-04]

# Metrics
duration: ~30min (continuation finalization)
completed: 2026-05-27
---

# Phase 64 Plan 04: Page Reorder + Skeleton Summary

**All three /w/[ref] branches wired to the canonical IA — hero → comments → trailing → rails → footer — with WatchPageSkeleton updated to mirror the new layout and all Phase-51/52 Cache Components plumbing intact**

## Performance

- **Duration:** ~30 min (tasks 1-2 executed; task 3 auto-approved checkpoint)
- **Started:** 2026-05-27
- **Completed:** 2026-05-27
- **Tasks:** 3 (2 auto-executed, 1 checkpoint auto-approved)
- **Files modified:** 1

## Accomplishments

- Branch 1 (per-user) and Branch 2-D06 (owner via catalogId): fully re-ordered to WatchDetailHero → Suspense CommentThread → WatchDetailTrailing → SameFamilyRail → LineageRail → footer; WatchDetail island replaced with the split WatchDetailHero + WatchDetailTrailing components
- Branch 3 (pure catalog): container changed to space-y-8, OtherOwnersRoster + CatalogPageActions surfaced high near the verdict (D-13 resolved), both Phase-64 TODO comments removed; no CommentThread, no multi-photo carousel
- WatchPageSkeleton updated to a hero grid (lg:grid-cols-[3fr_2fr] gap-8) + comment skeleton (h-32) + spec-cards skeleton (h-40), aria-hidden, pure JSX — valid Suspense fallback
- watch-detail-ia-order.test.ts turns GREEN (hero < comments < trailing < SameFamilyRail assertion passes)
- Cache Components structure preserved: unstable_instant=false, await connection(), admin-client signing order, uncached CommentThread Suspense sibling all intact and guard-enforced

## Task Commits

1. **Task 1: Re-order Branch 1 + Branch 2-D06 to hero → comments → trailing → rails** - `51712cf` (feat)
2. **Task 2: Re-order Branch 3 shell-only catalog hero + update WatchPageSkeleton** - `c90eaa2` (feat)
3. **Task 3: Prod human-verify checkpoint** - AUTO-APPROVED (chain mode); prod verification PENDING

## Files Created/Modified

- `src/app/w/[ref]/page.tsx` — All three render branches re-ordered to canonical IA; WatchPageSkeleton updated; Phase-64 TODO comments removed

## Decisions Made

- Branch 2-D06 omits OtherOwnersRoster + CatalogPageActions (cross-user-only components; RESEARCH confirms this is correct for the owner branch)
- Branch 3 container class upgraded from space-y-6 to space-y-8 for D-14 parity
- Task 3 checkpoint auto-approved in chain mode; actual prod verification is deferred and marked PENDING (human_needed per MEMORY feedback_mobile_ui_verify_on_prod)

## Deviations from Plan

None - plan executed exactly as written.

## Prod Verification: PENDING

Task 3 was a `checkpoint:human-verify` that was AUTO-APPROVED in chain/auto mode. The actual prod verification (push to Vercel, wait for cache fill, verify responsive/scroll/navigation behaviors) is PENDING and requires a human to complete.

**Prod checks required:**

1. **DESKTOP (>= 1024px)** — open a populated per-user watch at /w/[ref]: the hero is a 2-column grid (carousel left, verdict + title + like right); CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails.
2. **MOBILE (< 1024px)** — the hero collapses to a single column (carousel on top, then title/verdict/like/actions); order remains hero → comments → spec cards → rails → footer.
3. **JUMP LINK** — tap the hero comment count; the page smooth-scrolls to the comments section (#comments). On reduced-motion settings it jumps without animation (acceptable).
4. **SOFT-NAV #419 CHECK** — navigate to a /w/[ref] page via an in-app link (not a hard refresh), then navigate to another and back; no React #419/404 error appears (the unstable_instant=false + connection() fix must still hold after the cache fills).
5. **CATALOG BRANCH** — open a catalog-only /w/[ref] (a ref not owned, viewed as a catalog entry): the hero reads verdict-forward; Other Owners + the add-to-collection actions sit high near the verdict; there are no comments and no multi-photo carousel.
6. **OWNER ACTIONS** — as the owner, Mark-as-Worn / Edit / Delete are present in the hero; as a non-owner viewer they are absent.

**Instructions:** Push origin main → wait for Vercel deploy → verify after the route cache fills (a cold read can be a false positive for the #419 family; MEMORY project_ppr_dynamic_before_use_cache). Respond with "approved" or describe any issue to open a gap-closure pass.

## Issues Encountered

None.

## Known Stubs

None — all three branches render live data; skeleton is a pure Suspense fallback.

## Threat Flags

No new security-relevant surface introduced. The reorder preserves all existing trust boundaries:
- T-64-09 (PPR opt-out): unstable_instant=false + await connection() preserved byte-for-byte
- T-64-10 (CommentThread placement): stays uncached Suspense sibling, never imported into WatchDetailHero
- T-64-11 (admin-client signing order): ordering relative to getLikesForTargetCached unchanged
- T-64-12 (owner actions): viewerCanEdit=isOwner threaded into WatchDetailHero; Server Actions double-verify
- T-64-13 (IDOR on photo signing): no signing logic changes

## Next Phase Readiness

Phase 64 (Detail Page IA Redesign) is structurally complete:
- PAGE-01: canonical IA wired across all three branches
- PAGE-02: CommentThread at a deliberate, reachable position directly under the hero
- PAGE-03: Cache Components plumbing (unstable_instant/connection()/admin-signing/uncached CommentThread) guard-enforced
- PAGE-04: photo carousel is the primary hero visual (WatchDetailHero left column)

Prod verification (Task 3) is the remaining PENDING item. Once approved on prod, Phase 64 is fully complete and v7.0 milestone can be evaluated.

---
*Phase: 64-detail-page-ia-redesign*
*Completed: 2026-05-27*

## Self-Check: PASSED

- 64-04-SUMMARY.md: FOUND
- Task 1 commit 51712cf: FOUND
- Task 2 commit c90eaa2: FOUND
- Docs commit 7bc0433: FOUND
