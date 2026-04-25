---
phase: 260424-nk2
plan: 01
subsystem: home/wywt
tags: [phase-15, uat, photo, signed-url, supabase-storage]
dependency-graph:
  requires: [phase-15-photo-storage, phase-15-photo-post-flow]
  provides: [wywt-rail-renders-wear-photo, wywt-overlay-renders-wear-photo]
  affects: [src/app/page.tsx, src/components/home/WywtTile.tsx, src/components/home/WywtSlide.tsx, src/data/wearEvents.ts, src/lib/wywtTypes.ts]
tech-stack:
  added: []
  patterns: [per-request-signed-url-mint, dal-returns-raw-storage-path]
key-files:
  created:
    - tests/components/home/WywtSlide.test.tsx
  modified:
    - src/lib/wywtTypes.ts
    - src/data/wearEvents.ts
    - src/app/page.tsx
    - src/components/home/WywtTile.tsx
    - src/components/home/WywtSlide.tsx
    - tests/data/getWearRailForViewer.test.ts
    - tests/components/home/WywtTile.test.tsx
    - tests/components/home/WywtOverlay.test.tsx
decisions:
  - DAL returns wear_events.photo_url as RAW Storage path; signing lives in src/app/page.tsx (Pitfall F-2)
  - Inline signing block in page.tsx (no helper) to mirror src/app/wear/[wearEventId]/page.tsx and keep no-cache rule visible at the call site
  - Tile + Slide both render tile.photoUrl ?? tile.imageUrl with WatchIcon placeholder when both are null
metrics:
  duration: ~12 min
  tasks: 3
  completed: 2026-04-24
requirements:
  - PHASE-15-UAT-WYWT-PHOTO
---

# Quick Task 260424-nk2: Fix Phase 15 UAT Bug — WYWT Rail & Overlay Render Catalog Image Instead of Wrist-Shot Photo Summary

Phase 15 UAT bug fix: WYWT rail tiles and overlay slides now render the user's actual wrist-shot wear photo (`wear_events.photo_url`, signed per-request) instead of the watch catalog image, with graceful fallback to `watches.imageUrl` when no photo exists.

## What Changed

- **`src/lib/wywtTypes.ts`** — Added `photoUrl: string | null` to the `WywtTile` interface with a doc comment that explicitly says the field carries the RAW Storage path at the DAL boundary and gets replaced with a signed URL by `src/app/page.tsx` before reaching client components. Pitfall F-2 (no signed-URL caching) called out.
- **`src/data/wearEvents.ts` (`getWearRailForViewer`)** — Projects `wearEvents.photoUrl` into the SELECT and threads it through the per-actor map into the returned tile shape. No signing in the DAL.
- **`src/app/page.tsx`** — Mints signed URLs per-request via `createSupabaseServerClient` + `supabase.storage.from('wear-photos').createSignedUrl(path, 60 * 60)` for any tile with a non-null `photoUrl`. Replaces the raw path with the signed URL before passing `railData` to `<WywtRail>`. Mirrors the inline pattern from `src/app/wear/[wearEventId]/page.tsx` exactly. Deliberately NOT cache-wrapped.
- **`src/components/home/WywtTile.tsx`** — Renders `tile.photoUrl ?? tile.imageUrl`. Placeholder branch (WatchIcon) only triggers when both are null. `alt=""` preserved (decorative — username + time provide context).
- **`src/components/home/WywtSlide.tsx`** — Same fallback rule; `alt={`${tile.brand} ${tile.model}`}` preserved.

## Tests

Added 5 new unit tests, updated 3 existing test files for the new field:

- **`tests/data/getWearRailForViewer.test.ts`** — Unit 12 / Unit 13: photoUrl projection (present + null). Unit 8 expected shape updated for the new fields. All 13 unit tests pass; 9 integration tests still gated on local Supabase env vars.
- **`tests/components/home/WywtTile.test.tsx`** — Test 10 / 11 / 12: photoUrl wins over imageUrl, falls back to imageUrl when null, WatchIcon placeholder when both are null. `makeTile` helper updated with `photoUrl: null` default. (Used `container.querySelector('img')` instead of `getByRole('img')` because `<img alt="">` is presentational and excluded from the img role.)
- **`tests/components/home/WywtSlide.test.tsx`** — NEW FILE: 3 tests covering the same three rendering paths. Mocks `next/image`, `next/link`, and the `addToWishlistFromWearEvent` Server Action.
- **`tests/components/home/WywtOverlay.test.tsx`** — `makeTile` helper updated with `photoUrl: null` default to keep the Overlay tests typecheck-clean against the new `WywtTile` shape.

## Verification

- `npx tsc --noEmit`: no new errors. Two pre-existing errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` (unrelated to this work — verified via `git stash` baseline).
- `npm run lint`: exit 0. No lint warnings or errors in any file modified by this task.
- `npx vitest run`: 2699 passed / 149 skipped (skips are DB-gated integration tests). All 4 targeted suites green.

## Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `5914c3a` | `fix(15-uat): project wear_events.photo_url into WYWT rail tile shape` |
| 2 | `187a5a9` | `fix(15-uat): sign and render wrist-shot photo on WYWT rail and overlay slide` |
| 3 | `19a7b32` | `chore(15-uat): verify WYWT photo fix — full suite green` (--allow-empty) |

## Deviations from Plan

None — plan executed exactly as written. The only minor adjustment was using `container.querySelector('img')` instead of `screen.getByRole('img')` in the tile tests because `<img alt="">` is presentational under ARIA semantics and not assigned the `img` role in jsdom. Documented inline at the test site.

## Self-Check: PASSED

Files verified to exist:
- FOUND: `src/lib/wywtTypes.ts` (modified)
- FOUND: `src/data/wearEvents.ts` (modified)
- FOUND: `src/app/page.tsx` (modified)
- FOUND: `src/components/home/WywtTile.tsx` (modified)
- FOUND: `src/components/home/WywtSlide.tsx` (modified)
- FOUND: `tests/data/getWearRailForViewer.test.ts` (modified)
- FOUND: `tests/components/home/WywtTile.test.tsx` (modified)
- FOUND: `tests/components/home/WywtOverlay.test.tsx` (modified)
- FOUND: `tests/components/home/WywtSlide.test.tsx` (created)

Commits verified:
- FOUND: `5914c3a` (Task 1 — DAL/type)
- FOUND: `187a5a9` (Task 2 — signing + UI fallback)
- FOUND: `19a7b32` (Task 3 — verification)
