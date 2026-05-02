---
phase: 26-wywt-auto-nav
plan: "01"
subsystem: wear-detail
tags: [next, suspense, supabase-storage, signed-url, react-19, client-retry]
dependency_graph:
  requires: []
  provides: [PhotoSkeleton, WearPhotoClient, Suspense-wrapped wear detail page]
  affects: [src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearDetailHero.tsx]
tech_stack:
  added: []
  patterns:
    - "Suspense + async server child (WearPhotoStreamed) for streamed photo render"
    - "Client-side onError retry state machine with query-string cache-buster"
    - "Native <img> with eslint-disable-next-line per Pitfall F-2"
key_files:
  created:
    - src/components/wear/PhotoSkeleton.tsx
    - src/components/wear/WearPhotoClient.tsx
  modified:
    - src/app/wear/[wearEventId]/page.tsx
    - src/components/wear/WearDetailHero.tsx
decisions:
  - "D-01: PhotoSkeleton class string locked to w-full aspect-[4/5] md:rounded-lg md:max-w-[600px] md:mx-auto — zero CLS"
  - "D-02: Two-layer defense — Suspense covers server-render gap; onError retry with ?retry=N covers CDN propagation window"
  - "D-05: Signed URL minted in WearPhotoStreamed per-request (60-min TTL), never cached"
  - "D-06: Native <img> only, not next/image — prevents token-stripping by Next optimizer"
metrics:
  duration: "3m"
  completed: "2026-05-02T19:30:55Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 26 Plan 01: Suspense-wrapped signed-URL photo render with client retry Summary

Suspense boundary + WearPhotoStreamed server child + WearPhotoClient onError retry state machine covering the 200–800ms Supabase Storage CDN propagation window after a fresh WYWT upload.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PhotoSkeleton server component | d7c235f | src/components/wear/PhotoSkeleton.tsx (created) |
| 2 | Create WearPhotoClient with onError retry state machine | 2858101 | src/components/wear/WearPhotoClient.tsx (created) |
| 3 | Wrap photo render in Suspense + simplify WearDetailHero | 047f90c | src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearDetailHero.tsx |

## What Was Built

**PhotoSkeleton.tsx** — Server-component-safe presentational skeleton that composes the existing shadcn `<Skeleton>` primitive with exactly `w-full aspect-[4/5] md:rounded-lg md:max-w-[600px] md:mx-auto`. No text, no icons, no `'use client'`. Zero CLS between skeleton and loaded hero.

**WearPhotoClient.tsx** — Client Component owning the signed-URL `<img>` branch. State machine: renders PhotoSkeleton while `onLoad` hasn't fired; on `onError` retries up to 3× at 300ms intervals appending `?retry=N` to the existing signed URL (cache-buster, NOT a re-mint); after MAX_RETRIES falls through to the watchImageUrl branch or no-photo placeholder. Native `<img>` with `eslint-disable-next-line @next/next/no-img-element` per D-06 / Pitfall F-2.

**page.tsx (modified)** — Introduces `<Suspense fallback={<PhotoSkeleton />}>` wrapping a new `WearPhotoStreamed` async server child. The rest of the page (WearDetailMetadata) renders immediately. `WearPhotoStreamed` mints the signed URL per-request inside the Suspense boundary — 60-min TTL, never cached (D-05). If signed URL mints successfully, hands off to `WearPhotoClient`; otherwise falls back to `WearDetailHero`. Anonymous viewer path (UnauthorizedError catch) preserved.

**WearDetailHero.tsx (modified)** — `signedUrl` prop removed entirely. Component now handles only: (1) `watchImageUrl` present → render as hero; (2) neither → muted no-photo placeholder with brand/model label. Signed-URL rendering fully delegated to `WearPhotoClient`.

## Deviations from Plan

None — plan executed exactly as written. All three tasks used verbatim file content from the plan's `<action>` blocks.

## Acceptance Criteria Verification

All criteria verified:
- `PhotoSkeleton.tsx`: export exists, exact class string present, no `'use client'`, no text/icons, tsc clean
- `WearPhotoClient.tsx`: `'use client'` first line, `MAX_RETRIES = 3`, `RETRY_DELAY_MS = 300`, `retry=${retryCount}` cache-buster, eslint-disable comment present, no `next/image`, no caching constructs, tsc clean
- `page.tsx`: Suspense import from `'react'`, fallback uses `<PhotoSkeleton />`, `async function WearPhotoStreamed` present, `createSignedUrl` called once, `WearPhotoClient` wired, no `use cache`/`unstable_cache`/`revalidate`, `getCurrentUser` + `UnauthorizedError` preserved, no `next/image`
- `WearDetailHero.tsx`: `signedUrl` grep returns 0, `watchImageUrl` retained, `No photo` aria-label retained, no `next/image` import
- ESLint passes on all four files
- TypeScript compiles cleanly for all four files (pre-existing test errors in test files are out of scope)

## Known Stubs

None. All data flows are wired: signed URL minted server-side → passed to WearPhotoClient → rendered with retry → fallback chain complete.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`. All STRIDE items (T-26-01 through T-26-04) are mitigated by the implementation as written.

## Self-Check: PASSED

Files exist:
- src/components/wear/PhotoSkeleton.tsx: FOUND
- src/components/wear/WearPhotoClient.tsx: FOUND
- src/app/wear/[wearEventId]/page.tsx: FOUND (modified)
- src/components/wear/WearDetailHero.tsx: FOUND (modified)

Commits exist:
- d7c235f (Task 1): FOUND
- 2858101 (Task 2): FOUND
- 047f90c (Task 3): FOUND
