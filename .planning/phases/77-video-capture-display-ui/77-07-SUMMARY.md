---
phase: 77-video-capture-display-ui
plan: 07
subsystem: display
tags: [component, video-player, wear-card, discriminator, regression-gate]
requires:
  - phase: 77-01
    provides: WearVideoClient + WearCard.video test stubs
  - phase: 77-02
    provides: WywtTile mediaType/posterPath additive types (downstream consumers)
  - phase: 77-03
    provides: DAL mediaType column surfacing (consumed by Plan 08 page-level wiring)
provides:
  - VideoPlayBadge shared component (consumed by Plan 08's WywtTile)
  - WearVideoClient autoplay-muted-loop video player with tap-to-pause + onError fallback
  - WearCard mediaType discriminator branch (additive — no photo-path regression)
  - 5 new passing tests; existing WearCard.test.tsx still green (broader VID-15 regression)
affects: [Plan 08]
tech-stack:
  added: []
  patterns:
    - "Additive-discriminator pattern in WearCard: outer ternary on new optional prop wraps the existing photo-or-fallback ternary byte-for-byte"
    - "Error fallback as separate render branch (no retry SM — video lacks photo's CDN-propagation window)"
key-files:
  created:
    - src/components/wear/VideoPlayBadge.tsx
    - src/components/wear/WearVideoClient.tsx
  modified:
    - src/components/wear/WearCard.tsx
    - tests/components/wear/WearVideoClient.test.tsx
    - tests/components/wear/WearCard.video.test.tsx
key-decisions:
  - "VID-15 enforced by additive optional props (mediaType, signedVideoUrl, signedPosterUrl all `?`) — absent => existing photo ternary runs unchanged"
  - "Video error fallback shows poster + 'Video unavailable' label — no retry (videos don't suffer the photo CDN-propagation race)"
  - "Tap toggle reads videoRef.current.paused directly (DOM truth) rather than React state — avoids paused state desync with browser-driven autoplay/pause edge cases"
patterns-established:
  - "Disappearance assertion in tests (per durable feedback_test_assert_disappearance_too): when click both mounts X and unmounts Y, assert BOTH"
requirements-completed:
  - VID-13
  - VID-14
  - VID-15
duration: 20min
completed: 2026-06-23
---

# Phase 77 Plan 07: VideoPlayBadge + WearVideoClient + WearCard discriminator

**The display half of v8.3 — adds a video render branch to WearCard (delegating to a new WearVideoClient that mirrors WearPhotoClient's visual contract) without touching WearPhotoClient or WearDetailHero.**

## Performance

- **Duration:** ~20 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files created:** 2 (`VideoPlayBadge.tsx`, `WearVideoClient.tsx`)
- **Files modified:** 3 (`WearCard.tsx` additively + both Wave 0 test stubs)
- **Files explicitly UNTOUCHED (VID-15 evidence):** `WearPhotoClient.tsx`, `WearDetailHero.tsx`

## Accomplishments

- `src/components/wear/VideoPlayBadge.tsx` — new shared `<Play>` icon overlay with `bg-black/50` backdrop and `clamp(32px, 24%, 56px)` sizing. Pure decorative (no hooks, `aria-hidden`). Consumed by Plan 08's WywtTile.
- `src/components/wear/WearVideoClient.tsx` — new `'use client'` component parallel to `WearPhotoClient`:
  - Happy-path: `<video autoPlay muted loop playsInline>` inside the same container class as WearPhotoClient (VID-15 visual parity contract). Tap toggles pause/resume via `videoRef.current.paused` check.
  - Error fallback (D-08): when `failed || !signedVideoUrl`, swaps to `<img src={signedPosterUrl}>` + a `"Video unavailable"` label.
  - `WearPhotoOverlays` (imported from `WearDetailHero`) rendered in both branches.
- `src/components/wear/WearCard.tsx` — additively extended:
  - Three new optional props in `WearCardProps`: `mediaType?: 'photo' | 'video'`, `signedVideoUrl?: string | null`, `signedPosterUrl?: string | null`.
  - Import added: `WearVideoClient`.
  - Render logic: new ternary wraps existing branches — `mediaType === 'video' ? <WearVideoClient> : signedUrl !== null ? <WearPhotoClient> : <WearDetailHero>`.
  - Existing `WearPhotoClient` and `WearDetailHero` invocations + prop spreads PRESERVED byte-for-byte.

## Task Commits

1. **Task 1: VideoPlayBadge + WearVideoClient** — `09487a8c` (feat)
2. **Task 2: WearCard discriminator + 5 tests** — `8fcb3c3b` (feat)

## Files

- `src/components/wear/VideoPlayBadge.tsx` — new (~30 lines)
- `src/components/wear/WearVideoClient.tsx` — new (~120 lines)
- `src/components/wear/WearCard.tsx` — +15 / −0 lines (additive)
- `tests/components/wear/WearVideoClient.test.tsx` — 3 `it.todo` → 3 real `it(...)`
- `tests/components/wear/WearCard.video.test.tsx` — 2 `it.todo` → 2 real `it(...)`

## Verification

- `grep -c "export function VideoPlayBadge" src/components/wear/VideoPlayBadge.tsx` → 1
- `grep -c "export function WearVideoClient" src/components/wear/WearVideoClient.tsx` → 1
- WearVideoClient grep gates: `autoPlay`=1, `playsInline`=1, `loop`≥1, `muted`≥1, `Video unavailable`=1, `WearPhotoOverlays`≥3, `font-semibold`≥1, `font-medium`=0
- WearCard grep gates: `WearVideoClient` count = 2 (import + JSX) ✓, all 3 new optional props present ✓, `mediaType === 'video'` literal = 1 ✓, `WearPhotoClient` count = 2 (preserved) ✓, `WearDetailHero` count = 2 (preserved) ✓
- VID-15 evidence: `git diff --stat` shows ZERO changes to `WearPhotoClient.tsx` and `WearDetailHero.tsx`
- `npm run build` → exit 0
- `npx vitest run tests/components/wear/WearVideoClient.test.tsx tests/components/wear/WearCard.video.test.tsx tests/components/wear/WearCard.test.tsx` → 8 passed (3 + 2 + 3 existing)

## Self-Check

PASSED — all acceptance criteria met. No deviations.

## Notes for downstream plans

- Plan 06 (ComposeStep) — does NOT consume WearVideoClient; the composer's post-capture preview uses an inline `<video autoPlay muted loop playsInline>` directly (D-16 — no VideoPlayBadge on the composer preview).
- Plan 08 (page wiring):
  - Mounts `<WearCard mediaType="video" signedVideoUrl={...} signedPosterUrl={...} ...>` on `/wear/[id]` after `getWearEventByIdForViewer` returns `mediaType === 'video'`.
  - Uses `<VideoPlayBadge />` inside `WywtTile` when the tile's `mediaType === 'video'`.
  - URL minting MUST use the admin Supabase client (NOT cookie client) — Phase 61 lesson, threat T-77-03.
