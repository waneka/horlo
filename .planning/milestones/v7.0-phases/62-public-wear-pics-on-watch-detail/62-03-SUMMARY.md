---
phase: 62-public-wear-pics-on-watch-detail
plan: "03"
subsystem: profile/wears-tab
tags: [wear-photos, worms-tab, image-signing, wpic-03]
dependency_graph:
  requires: [62-01]
  provides: [WPIC-03-green, wear-photo-signed-urls-in-wears-tab]
  affects: [src/components/profile/WornTimeline.tsx, src/components/profile/WornCalendar.tsx, src/components/profile/WornTabContent.tsx, src/app/u/[username]/[tab]/page.tsx]
tech_stack:
  added: []
  patterns: [admin-client-signing, getSafeImageUrl-fallback-chain, fail-safe-to-null]
key_files:
  created: []
  modified:
    - src/components/profile/WornTimeline.tsx
    - src/components/profile/WornCalendar.tsx
    - src/components/profile/WornTabContent.tsx
    - src/app/u/[username]/[tab]/page.tsx
decisions:
  - "photoUrl added as required field to WearEventLite in all three chain components (WornTimeline, WornCalendar, WornTabContent) so TypeScript propagates the type correctly"
  - "Admin client (createSupabaseAdminClient) used for wear-photo signing — never cookie client (T-62-09 / PPR boundary safety)"
  - "Signing loop filters for distinct non-null paths only; fail-safe returns null on any signing error (D-19)"
metrics:
  duration: ~7m
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 4
---

# Phase 62 Plan 03: Wears Tab Wear Photo Preference Summary

**One-liner:** Wears tab now signs wear-photo storage paths via admin client and WornTimeline/WornCalendar prefer event.photoUrl over the generic watch cover, with getSafeImageUrl fallback chain.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WornTimeline + WornCalendar prefer event.photoUrl over watch cover | 5c25fcd | WornTimeline.tsx, WornCalendar.tsx, WornTabContent.tsx |
| 2 | Sign wear-photo paths in the Wears tab RSC and pass photoUrl to WornTabContent | cf532aa | src/app/u/[username]/[tab]/page.tsx |

## What Was Built

**Task 1 — Component preference chain (WPIC-03):**
- Added `photoUrl: string | null` to `WearEventLite` in `WornTimeline.tsx`, `WornCalendar.tsx`, and `WornTabContent.tsx`
- `WornTimeline`: computes `wearPhotoSafe = e.photoUrl ? getSafeImageUrl(e.photoUrl) : null` then uses `wearPhotoSafe ?? (watch ? getSafeImageUrl(watch.imageUrl) : null)` as the image source
- `WornCalendar`: same preference applied in two places — calendar cell dot (first event of day) and selected-day detail panel
- WPIC-03 unit tests: 4/4 GREEN (previously 1 failing RED)

**Task 2 — RSC signing (D-16/D-19):**
- Added `createSupabaseAdminClient` import to `src/app/u/[username]/[tab]/page.tsx`
- After `getWearEventsForViewer`, collects distinct non-null raw paths, signs each via `supabaseAdmin.storage.from('wear-photos').createSignedUrl(path, 3600)` with fail-safe null on error
- In `events.map(...)` passes `photoUrl: e.photoUrl ? (wearPhotoSignedMap.get(e.photoUrl) ?? null) : null` to `WornTabContent`
- No new `createSupabaseServerClient` signing (T-62-09 compliance)
- `npm run build` exits 0

## Verification Results

- `npx vitest run tests/unit/WornTimeline.test.tsx`: 4/4 PASS (WPIC-03 GREEN)
- `npm run build`: exits 0
- `grep "wear-photos" src/app/u/[username]/[tab]/page.tsx`: present (line 459)
- No new createSupabaseServerClient signing: confirmed (only 1 occurrence, a comment)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added photoUrl to WornTabContent.WearEventLite**
- **Found during:** Task 1
- **Issue:** `WornTabContent` acts as the intermediary that passes `events` from `page.tsx` to both `WornTimeline` and `WornCalendar`. Its local `WearEventLite` interface did not include `photoUrl`, which would cause a TypeScript type mismatch when the RSC (Task 2) passes `photoUrl` in the event objects.
- **Fix:** Added `photoUrl: string | null` to `WornTabContent`'s `WearEventLite` interface
- **Files modified:** `src/components/profile/WornTabContent.tsx`
- **Commit:** 5c25fcd

## Known Stubs

None — `photoUrl` is wired through the full chain from DAL to components.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The admin-client signing loop is consistent with the established pattern from `signCoverUrls.ts` and `src/app/w/[ref]/page.tsx`. T-62-09 and T-62-10 from the plan's threat model are mitigated.

## Self-Check: PASSED

- src/components/profile/WornTimeline.tsx — modified, confirmed contains `photoUrl`
- src/components/profile/WornCalendar.tsx — modified, confirmed contains `photoUrl`
- src/components/profile/WornTabContent.tsx — modified, confirmed contains `photoUrl`
- src/app/u/[username]/[tab]/page.tsx — modified, confirmed contains `wear-photos`
- Commits 5c25fcd and cf532aa confirmed in git log
