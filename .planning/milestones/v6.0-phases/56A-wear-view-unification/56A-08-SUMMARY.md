---
phase: 56A-wear-view-unification
plan: "08"
status: complete
one_liner: "Thread watchId through WearCard → WearPhotoClient → WearPhotoOverlays and wrap brand/model in Link to /watch/[watchId], closing UAT gap #2"
subsystem: wear
tags: [wear, navigation, link, overlay, gap-closure]
dependency_graph:
  requires: [56A-02]
  provides: [brand/model clickable link on wear card D-01]
  affects: [WearCard, WearPhotoClient, WearDetailHero, WearPhotoOverlays]
tech_stack:
  added: []
  patterns: [next/link with stopPropagation matching avatar/username pattern, pointer-events-auto on inner row]
key_files:
  created: []
  modified:
    - src/components/wear/WearCard.tsx
    - src/components/wear/WearPhotoClient.tsx
    - src/components/wear/WearDetailHero.tsx
decisions:
  - "D-01 — brand/model → /watch/[watchId] link works on both routes (shared card D-12)"
  - "stopPropagation on Link onClick mirrors avatar/username pattern to prevent parent swipe/click capture"
  - "pointer-events-auto on inner brand/model row (bottom overlay inner div) mirrors top overlay pattern"
  - "Tasks 1+2 committed atomically because WearPhotoClient and WearPhotoOverlays form an interdependent prop chain"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 56A Plan 08: Brand/Model → Watch Link Summary

## One-Liner

Thread watchId through WearCard → WearPhotoClient → WearPhotoOverlays and wrap brand/model in Link to /watch/[watchId], closing UAT gap #2.

## What Was Built

UAT gap #2 (MAJOR) — tapping the watch brand/model on a wear card did nothing. The `watchId` prop was already accepted by `WearCard` but immediately discarded as `_watchId`. This plan wired it all the way through the photo layer and made the brand/model text a working `next/link` Link.

### Changes

**WearCard.tsx**
- Renamed `watchId: _watchId` destructure to `watchId`
- Passed `watchId={watchId}` to both `WearPhotoClient` and `WearDetailHero` branches

**WearPhotoClient.tsx**
- Added `watchId: string` to the props interface and destructure
- Forwarded `watchId={watchId}` to all three `WearPhotoOverlays` renders: failed→watchImageUrl fallback, failed→no-photo fallback, and happy-path render

**WearDetailHero.tsx (WearPhotoOverlays + WearDetailHero)**
- Added `watchId: string` to `WearPhotoOverlaysProps` interface
- Added `watchId: string` to `WearDetailHero` props; both render branches forward it
- Wrapped brand/model spans in `<Link href={`/watch/${watchId}`}>` with `onClick={e => e.stopPropagation()}`
- Added `pointer-events-auto` to the bottom overlay inner content `div` (matching the top overlay pattern at line 72) so the Link is tappable through the gradient scrim
- Brand remains `font-semibold`; model renders as `block` inside the same Link
- Styling mirrors avatar/username Link: `text-sm hover:opacity-80` + `textClass` for hasPhoto color switch — no accent color

## Verification

- `grep "_watchId" src/components/wear/WearCard.tsx` → nothing (watchId no longer discarded)
- `grep "/watch/" src/components/wear/WearDetailHero.tsx` → finds `/watch/[watchId]` comment + href
- `npx tsc --noEmit` → no errors in any of the three target files (pre-existing test-file errors are out of scope)
- `npx eslint` → clean for all three files
- Link works on both `/wears/[username]` stories lane and `/wear/[id]` detail page (shared card D-12)

## Commits

| Hash | Message |
|------|---------|
| 8e276a0 | feat(56A-08): brand/model → /watch/[watchId] link on wear card (D-01) |

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 committed atomically because the WearPhotoClient prop forwarding and WearPhotoOverlays prop addition form an interdependent chain that would not type-check independently; combined commit preserves atomicity.

## Self-Check: PASSED

- src/components/wear/WearCard.tsx — FOUND (modified, committed)
- src/components/wear/WearPhotoClient.tsx — FOUND (modified, committed)
- src/components/wear/WearDetailHero.tsx — FOUND (modified, committed)
- Commit 8e276a0 — FOUND
