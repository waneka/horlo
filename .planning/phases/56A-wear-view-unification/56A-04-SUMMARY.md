---
phase: 56A-wear-view-unification
plan: 04
subsystem: ui
tags: [react, next.js, server-components, suspense, supabase, storage, signed-url]

# Dependency graph
requires:
  - phase: 56A-wear-view-unification-02
    provides: WearCard shared component with commentHostVariant prop
  - phase: 56A-wear-view-unification-03
    provides: showAddToWishlist gate logic pattern (D-09) and getWatchesByUser usage

provides:
  - /wear/[wearEventId] page refactored to render shared WearCard (commentHostVariant="inline")
  - EN-6 cleanup: anon sentinel removed, route is auth-only
  - D-09 showAddToWishlist gate on the detail page

affects:
  - Phase 57 (comment compose/list) — inline comment host section in WearCard is the mount point
  - Any phase touching /wear/[wearEventId]/page.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WearPhotoStreamed Suspense server child returns WearCard (not raw photo components) — signed-URL minting stays inside Suspense boundary while WearCard owns engagement row + comment host"
    - "Auth-only wear route pattern: getCurrentUser() with no try/catch; proxy handles anon"

key-files:
  created: []
  modified:
    - src/app/wear/[wearEventId]/page.tsx

key-decisions:
  - "WearPhotoStreamed returns WearCard instead of WearPhotoClient/WearDetailHero — keeps F-2 signed-URL Suspense streaming intact while delegating photo rendering to WearCard"
  - "WearDetailMetadata rendered after Suspense block in the article — WearCard owns engagement row + comment host as an indivisible unit; injecting note between photo and engagement is not possible without modifying WearCard"
  - "showAddToWishlist uses wear.userId !== viewerId check + case-insensitive brand/model match via getWatchesByUser — exact same pattern as Plan 03 stories lane (D-09)"

patterns-established:
  - "Auth-only wear routes: both /wear/[id] and /wears/[username] use getCurrentUser() with no UnauthorizedError catch (EN-6)"

requirements-completed: [SC-3, SC-4]

# Metrics
duration: 6min
completed: 2026-05-23
---

# Phase 56A Plan 04: Wear Detail Page Unification Summary

**`/wear/[wearEventId]` refactored to render shared `WearCard` (commentHostVariant="inline") with EN-6 anon sentinel removal, D-09 wishlist gate, and F-2 signed-URL Suspense streaming preserved**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-23T15:50:00Z
- **Completed:** 2026-05-23T15:56:05Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Replaced bespoke inline engagement row (comment slot placeholder + LikeButton) with the shared `WearCard` (commentHostVariant="inline"), achieving visual and behavioral parity with the stories lane (SC-4)
- Removed the `__anon__` sentinel and anonymous-viewer try/catch block (EN-6) — route is now correctly auth-only, matching the stories lane
- Added D-09 `showAddToWishlist` gate: `wear.userId !== viewerId` combined with case-insensitive brand/model check against `getWatchesByUser(viewerId)`, identical to Plan 03 pattern
- Preserved the `WearPhotoStreamed` Suspense server child pattern (Pitfall F-2): signed URL minted per-request inside the boundary, now returning `WearCard` instead of `WearPhotoClient`/`WearDetailHero` directly

## Task Commits

1. **Task 1: Refactor /wear/[id] to use shared WearCard + EN-6 cleanup** - `c78b250` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/app/wear/[wearEventId]/page.tsx` - Refactored detail page: shared WearCard, EN-6 auth-only, D-09 wishlist gate, F-2 Suspense preserved

## Decisions Made

- **WearPhotoStreamed now returns WearCard**: The Suspense server child was kept as the signed-URL mint location but changed to return `<WearCard commentHostVariant="inline" />` instead of raw `WearPhotoClient`/`WearDetailHero`. This is the only approach that preserves Pitfall F-2 while delegating the full card rendering to WearCard.
- **WearDetailMetadata rendered after the Suspense/WearCard block**: WearCard owns photo + engagement row + inline comment host as an indivisible unit. Injecting the note between the engagement row and the comment section is not feasible without modifying WearCard. The note now renders after WearCard in the article flow (minor visual reordering vs. today's above-engagement position).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /wear/[wearEventId] now renders the shared WearCard (SC-3, SC-4 met)
- WearCard's inline comment host section (`id="wear-comments"`) is in place for Phase 57 comment compose/list wiring
- No blockers

## Self-Check: PASSED

- `c78b250` exists in git log
- `src/app/wear/[wearEventId]/page.tsx` exists and contains `<WearCard` with `commentHostVariant="inline"`
- `grep -c "__anon__\|ANON_SENTINEL"` returns 0
- `find src/app -path '*@modal*' -o -name '(.)wear*' | wc -l` returns 0
- `npm run build` succeeded
- `npm run test -- wear-detail` ran (DB-gated tests skipped, as expected without DATABASE_URL)

---
*Phase: 56A-wear-view-unification*
*Completed: 2026-05-23*
