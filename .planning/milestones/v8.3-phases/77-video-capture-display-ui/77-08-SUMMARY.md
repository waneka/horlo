---
phase: 77-video-capture-display-ui
plan: 08
subsystem: integration
tags: [display, ssr, signed-urls, tile-overlay, wave-3-final]
requires:
  - phase: 77-01
    provides: WywtTile.video test stub
  - phase: 77-02
    provides: WywtTile additive fields (mediaType, posterPath); plus signedPosterUrl added in this plan
  - phase: 77-03
    provides: DAL surfaces mediaType / mediaPath / posterPath (consumed by the 3 SSR pages)
  - phase: 77-07
    provides: WearCard discriminator + VideoPlayBadge + WearVideoClient
provides:
  - WywtTile video render branch (poster image + VideoPlayBadge overlay) — Plan 07's badge mounted on the home rail
  - WywtRail passes mediaType + signedPosterUrl through to WywtTile
  - WearsLane WearSlide extended with mediaType + signedVideoUrl + signedPosterUrl (additive); D-07 onEnded guardrail preserved
  - /wear/[wearEventId]/page.tsx WearPhotoStreamed mints both video + poster signed URLs via admin client
  - /page.tsx home rail mints poster signed URLs for video tiles in parallel with the existing photo mint
  - /wears/[username]/page.tsx signs both URLs per video slide
  - 3 new passing tests covering the VideoPlayBadge branch
affects: []
tech-stack:
  added: []
  patterns:
    - "Server-side admin client (createSupabaseServerClient) for all signed URL minting — never the cookie client (T-77-03, Phase 61 lesson)"
    - "Per-page Promise.all for video signing — both mediaPath and posterPath signed in parallel for each video wear"
    - "Tile mapping enrichment: ...t, signedPosterUrl: posterById.get(...) pattern mirrors the existing ...t, photoUrl: byId.get(...) photo-signing pattern"
key-files:
  created: []
  modified:
    - src/lib/wywtTypes.ts (added signedPosterUrl optional field)
    - src/components/home/WywtTile.tsx
    - src/components/home/WywtRail.tsx
    - src/components/wears/WearsLane.tsx
    - src/app/wear/[wearEventId]/page.tsx
    - src/app/page.tsx
    - src/app/wears/[username]/page.tsx
    - tests/components/home/WywtTile.video.test.tsx
key-decisions:
  - "T-77-03 mitigated by exclusive use of createSupabaseServerClient (admin) across all 3 SSR pages — non-owner cover URLs sign correctly (cookie client would fail open)"
  - "T-77-ppr-419 mitigated by NOT adding any new Suspense boundaries; NOT adding await connection() anywhere — pages remain dynamic via getCurrentUser()"
  - "D-07 onEnded guardrail preserved in WearsLane — segmented progress is driven only by embla 'select' (user swipe). NO video.onEnded listener added (would couple lane advance to video loop completion)"
  - "VideoPlayBadge sits between image and bottom gradient in DOM order — clipped by outer overflow-hidden, never covers username/time text"
patterns-established:
  - "signedPosterUrl as a render-time-only tile field (mirrors photoUrl lifecycle — raw at DAL, signed at page boundary)"
requirements-completed:
  - VID-13
  - VID-14
duration: 28min
completed: 2026-06-23
---

# Phase 77 Plan 08: End-to-end video display wiring

**The final integration — every Server Component that renders a wear surface (home rail, detail page, stories lane) now mints signed URLs for video media via the admin client, threads them through to WearCard/WywtTile, and the discriminator branches in Plan 07 + the new WywtTile branch in this plan render the video player or play-badge accordingly. Phase 77 is now CODE-COMPLETE.**

## Performance

- **Duration:** ~28 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files modified:** 8

## Per-file diff summary

### `src/lib/wywtTypes.ts`
- Added optional `signedPosterUrl?: string | null` field to `WywtTile` — render-time-only (populated by page.tsx, never persisted, never returned by the DAL). Same lifecycle as `photoUrl` (raw path at DAL, signed URL at page boundary).

### `src/components/home/WywtTile.tsx`
- Imported `VideoPlayBadge` from `@/components/wear/VideoPlayBadge`.
- `Props` interface gains `mediaType?: 'photo' | 'video'` and `signedPosterUrl?: string | null` (optional; VID-15 invariant — absent → photo branch runs unchanged).
- Image render branch becomes a 3-way ternary: `mediaType === 'video' && signedPosterUrl` → poster `<Image>`; else `(tile.photoUrl ?? tile.imageUrl)` → existing photo `<Image>`; else `<WatchIcon>` fallback (unchanged).
- `{mediaType === 'video' && <VideoPlayBadge />}` rendered between the image and the bottom gradient — clipped by outer `overflow-hidden`, never covers the username/time text.

### `src/components/home/WywtRail.tsx`
- `<WywtTile>` invocation gains two explicit props: `mediaType={entry.tile?.mediaType}` and `signedPosterUrl={entry.tile?.signedPosterUrl ?? null}`.

### `src/components/wears/WearsLane.tsx`
- `WearSlide` interface gains three additive optional fields: `mediaType?: 'photo' | 'video'`, `signedVideoUrl?: string | null`, `signedPosterUrl?: string | null`.
- No render-logic changes; `{...slide}` spread on `<WearCard>` already carries the new fields to Plan 07's discriminator branch.
- **D-07 guardrail honoured**: NO `video.onEnded` listener added — segmented progress indicator still advances only on embla `select` (user swipe). `grep onEnded` = 0.

### `src/app/wear/[wearEventId]/page.tsx`
- `<WearPhotoStreamed>` invocation gains three new props (`mediaType`, `mediaPath`, `posterPath`) threaded from `wear`.
- `WearPhotoStreamed` accepts the new props in its signature.
- Mint block becomes: `if (mediaType === 'video') { ...Promise.all both URLs via admin client... } else if (photoUrl) { ...existing photo mint VERBATIM... }`.
- `<WearCard>` invocation gains `mediaType={mediaType}`, `signedVideoUrl={signedVideoUrl}`, `signedPosterUrl={signedPosterUrl}`.
- **No new Suspense boundaries; no `await connection()` added** (page already dynamic via `getCurrentUser()` — PPR guardrail).

### `src/app/page.tsx` (home rail)
- Filters `tilesWithVideos = railData.tiles.filter(t => t.mediaType === 'video' && t.posterPath)`.
- Parallel `Promise.all` signs both photo URLs and video posters via the admin client.
- Tile mapping enriches each tile with `signedPosterUrl` (from `posterById` Map) alongside the existing `photoUrl` replacement.
- **VID-15 invariant**: existing photo signing path preserved verbatim.

### `src/app/wears/[username]/page.tsx`
- Replaced `signedUrls` with `signedTriples` — each entry is `{ signedUrl, signedVideoUrl, signedPosterUrl }`. Video wears mint both URLs via `Promise.all`; photo wears mint the single URL as before.
- Slide construction threads `mediaType`, `signedVideoUrl`, `signedPosterUrl` onto each `WearSlide`.

### `tests/components/home/WywtTile.video.test.tsx`
- 3 `it.todo` → 3 real `it(...)` cases.

## Task Commits

1. **Task 1: WywtTile + WywtRail + WearsLane + 3 SSR page edits + wywtTypes** — `43fd34c3` (feat)
2. **Task 2: WywtTile.video test upgrade** — `7ae07331` (test)

## Verification

- `grep -c "VideoPlayBadge" src/components/home/WywtTile.tsx` → 2 (import + JSX)
- `grep -c "signedPosterUrl" src/components/home/WywtTile.tsx` → 4 (prop + JSX + guard)
- `grep -c "mediaType === 'video'" src/components/home/WywtTile.tsx` → 2 (image branch + badge guard)
- `grep -c "signedVideoUrl" src/components/wears/WearsLane.tsx` → 1 (WearSlide field)
- `grep -c "onEnded" src/components/wears/WearsLane.tsx` → 0 (D-07 guardrail)
- `grep -c "signedVideoUrl" src/app/wear/[wearEventId]/page.tsx` → 3 (declaration + JSX + WearCard prop)
- `grep -c "signedPosterUrl" src/app/wear/[wearEventId]/page.tsx` → 3
- `grep -c "wear.mediaType === 'video'" src/app/wear/[wearEventId]/page.tsx` → 0 — the inner `mediaType === 'video'` check is now against the unpacked `mediaType` prop (count = 1 of `mediaType === 'video'`)
- `grep -c "createSupabaseServerClient" src/app/wear/[wearEventId]/page.tsx` → 2 (one per branch — preserved + new)
- `grep -c "await connection" src/app/wear/[wearEventId]/page.tsx` → 0
- `grep -c "signedPosterUrl" src/app/page.tsx` → 3
- `grep -c "createSignedUrl" src/app/page.tsx` → 2 (preserved photo + new video poster)
- `grep -c "signedVideoUrl" src/app/wears/[username]/page.tsx` → 4
- `grep -c "signedPosterUrl" src/app/wears/[username]/page.tsx` → 4
- `grep -c "mediaType === 'video'" src/app/wears/[username]/page.tsx` → 1
- `npm run build` → exit 0
- `npx vitest run tests/components/home/WywtTile.video.test.tsx` → 3 passed

## VID-15 broader regression check

Ran `npx vitest run tests/components/wear/ tests/components/home/ tests/components/wears/` — 92 passed, 5 failed.

The 5 failures pre-existed Phase 77 and are unrelated to this work:
- 4 in `CollectorsLikeYou.test.tsx`: `next/cache` mock missing `cacheTag` export (Next 16 cache-components API)
- 1 in `WatchPickerDialog.test.tsx`: assertion on `markAsWorn` arity (also pre-existing)

Verified by stashing all Phase 77 changes and re-running — the same 5 failures appear on `main` before this phase. Per durable memory `project_baseline_not_green_build_is_gate`: `npm run build` is the authoritative gate; pre-existing test noise is not a phase regression.

## Self-Check

PASSED — all acceptance criteria met. No deviations.

## Phase 77 status

**Phase 77 is CODE-COMPLETE.** All requirements covered:

| Req | Coverage |
|-----|----------|
| VID-01 | Plan 06 (3-button chooser + capability gate) + Plan 06 tests (2 passing) |
| VID-02 | Plan 05 (3.0s setTimeout auto-stop in VideoCaptureView) + Plan 05 tests (3 passing) |
| VID-03 | Plan 05 (cancel guard via cancelledRef) + Plan 06 (handleDiscardVideo) + Plan 05/06 tests |
| VID-04 | Plan 04 (useMediaCapability MIME probe) + 4 passing tests |
| VID-05 | Plan 04 (extractPosterBlob canvas + 0.75 seek) + 3 passing tests |
| VID-06 | Plan 02 (MediaState discriminated union) + Plan 06 (submit handler narrows on kind) + 3 passing tests |
| VID-13 | Plan 07 (WearCard discriminator) + this plan (WywtTile badge) + 5 passing tests |
| VID-14 | Plan 07 (WearVideoClient autoplay-muted-loop) + 3 passing tests; this plan threads signed URLs end-to-end |
| VID-15 | Photo paths preserved in WearCard / WywtTile / 3 SSR pages / WywtPostDialog / ComposeStep — regression sentinels in 4 test files |
| WR-02 | Plan 03 (4 DAL readers widened) + 4 passing source-grep tests |

**Status:** Ready for prod UAT walk per `feedback_mobile_ui_verify_on_prod` (iOS playsInline + autoplay-muted-loop behavior verifies on prod, not jsdom). Bundled deploy recommended (1 Vercel push, 1 iPhone Safari walk) per the v8.1 bundled-deploy pattern.
