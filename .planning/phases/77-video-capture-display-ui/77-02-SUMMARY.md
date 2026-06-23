---
phase: 77-video-capture-display-ui
plan: 02
subsystem: types
tags: [discriminated-union, mediastate, wywt-tile, types]
requires:
  - phase: 77-01
    provides: tests/unit/mediaState.test.ts Wave 0 RED stub to flip green
provides:
  - MediaState discriminated union (kind: 'none' | 'photo' | 'video') exported from src/lib/wywtTypes.ts
  - WywtTile additive optional fields mediaType + posterPath (no consumer break — VID-15)
  - tests/unit/mediaState.test.ts upgraded to 3 passing variant assertions
affects: [Plan 03, Plan 04, Plan 05, Plan 06, Plan 07, Plan 08]
tech-stack:
  added: []
  patterns:
    - "Discriminated union with literal kind discriminator over Blob shape"
    - "Additive optional interface fields preserve all extant call sites"
key-files:
  created: []
  modified:
    - src/lib/wywtTypes.ts
    - tests/unit/mediaState.test.ts
key-decisions:
  - "VID-06: compile-time either-or enforcement via discriminated union; the DB CHECK (Phase 76) is the last-line defense, this union is the first"
  - "Three variants only — no 'uploading'/'error' variant; those are component-local UI state, not domain type"
  - "Type-only import (`import type { MediaState }`) in tests — zero runtime cost"
patterns-established:
  - "Phase-77 mode-switch enforcement: switch (mediaState.kind) is the only valid narrowing pattern downstream"
requirements-completed:
  - VID-06
duration: 6min
completed: 2026-06-23
---

# Phase 77 Plan 02: MediaState union + WywtTile additive fields

**Compile-time gate for video-or-photo-but-never-both, plus the two additive WywtTile fields the rail pipeline needs to carry video metadata end-to-end.**

## Performance

- **Duration:** ~6 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files modified:** 2 (src/lib/wywtTypes.ts, tests/unit/mediaState.test.ts)

## Accomplishments

- Added `MediaState` discriminated union to `src/lib/wywtTypes.ts` — three variants (`none`, `photo`, `video`); TypeScript exhaustive narrowing in `switch (mediaState.kind)` makes the co-existing photo+video state unconstructable (closes T-77-eitheror-bypass MEDIUM at the type layer).
- Extended `WywtTile` with two ADDITIVE optional fields: `mediaType?: 'photo' | 'video'` and `posterPath?: string | null`. Every existing call site (src/data/wearEvents.ts, src/components/home/WywtRail.tsx, src/components/home/WywtTile.tsx, src/app/page.tsx) compiles unchanged (VID-15 regression invariant).
- Flipped `tests/unit/mediaState.test.ts` from Wave 0 `it.todo` placeholder to 3 real assertions — one per variant.

## Task Commits

1. **Task 1: Extend src/lib/wywtTypes.ts** — `c581d6ca` (feat)
2. **Task 2: Upgrade mediaState test stub** — `85ff05fb` (test)

## Files Modified

- `src/lib/wywtTypes.ts` — added `MediaState` union (16 lines) + `WywtTile` mediaType/posterPath fields (3 lines incl. comment)
- `tests/unit/mediaState.test.ts` — replaced single `it.todo` + stub `it` with 3 real `it(...)` cases

## Verification

- `grep -c "export type MediaState" src/lib/wywtTypes.ts` → 1
- `grep -c "mediaType?: 'photo' | 'video'" src/lib/wywtTypes.ts` → 1
- `grep -c "posterPath?: string | null" src/lib/wywtTypes.ts` → 1
- `grep -c "export interface WywtTile" src/lib/wywtTypes.ts` → 1 (preserved)
- `grep -c "export interface WywtRailData" src/lib/wywtTypes.ts` → 1 (preserved)
- `npm run build` → exit 0 (Compiled successfully)
- `npx vitest run tests/unit/mediaState.test.ts` → 3 passed, 0 failed, 0 skipped

## Self-Check

PASSED — all acceptance criteria met. No deviations from plan.

## Notes for downstream plans

- Plan 04 (`useMediaCapability` + `extractPosterBlob`) — return shape of `extractPosterBlob` is `Promise<Blob>`; the caller composes the `MediaState` `{ kind: 'video', videoBlob, posterBlob }` from those.
- Plan 05 (`VideoCaptureView`) — `onVideoReady` callback contract: `(videoBlob: Blob, posterBlob: Blob) => void`. The component does NOT construct `MediaState` itself — that responsibility lives in Plan 06 ComposeStep.
- Plan 06 (ComposeStep) — replace the legacy `photoBlob`/`setPhotoBlob` prop pair with `mediaState`/`setMediaState`. The submit handler MUST `switch (mediaState.kind)` for exhaustive narrowing.
- Plan 08 (WywtTile + lane wiring) — render branch is `mediaType === 'video' ? <video-tile> : <photo-tile>`; `posterPath` is the raw Storage path, server signs at render time (no client-side signing).
