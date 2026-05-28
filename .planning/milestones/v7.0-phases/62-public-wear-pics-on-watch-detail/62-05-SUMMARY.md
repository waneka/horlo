---
phase: 62-public-wear-pics-on-watch-detail
plan: 05
subsystem: ui
tags: [next.js, react, carousel, wear-pics, social, overlay, gap-closure]

# Dependency graph
requires:
  - phase: 62-public-wear-pics-on-watch-detail/62-04
    provides: Wear-pic slides with inline social row; LikeButton + WearCommentHost bottom-sheet; eye/hide toggle
provides:
  - Per-slide bottom-right on-photo social overlay (LikeButton + comment-count button) inside wear-pic slide map
  - Standalone below-carousel social row deleted
  - Wear-pic slide discoverable social controls (closes UAT Test 4 / WPIC-06 cosmetic gap)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-slide absolute overlay inside wear-pic map uses wp loop var (not activeWearPic) for targeting — each slide owns its own social state"
    - "bg-background/80 backdrop-blur-sm rounded-full scrim on overlay container matches Worn-badge / arrow-button token chain for legibility over arbitrary photos"
    - "onClick preserved on comment button (not onPointerDown) — fresh-per-interaction controls are not subject to Router-Cache stale-instance mitigation"

key-files:
  created: []
  modified:
    - src/components/watch/WatchPhotoSection.tsx

key-decisions:
  - "Per-slide overlay uses wp.wearEventId (loop variable) for LikeButton target and comment count lookup — NOT activeWearPic — so every slide is independently interactive regardless of which slide is currently selected"
  - "Single WearCommentHost host (lines 599+) and commentSheetOpen state left in place; only the trigger button moved into the per-slide overlay"
  - "Prod visual re-check (Task 2) deferred to human verification after Vercel deploy + cache fill (per project workflow: mobile/visual UAT on prod)"

patterns-established:
  - "JSX-position-only gap closure: move controls inside the existing relative slide container as an absolute overlay; no new props, imports, state, or event handlers"

requirements-completed: [WPIC-06]

# Metrics
duration: ~10 minutes
completed: 2026-05-27
---

# Phase 62 Plan 05: WPIC-06 Wear-Pic Social Overlay Relocation Summary

**Per-slide bottom-right on-photo social overlay added inside wear-pic slide map; standalone below-carousel social row deleted — build exits 0, 56 unit tests green; prod visual re-check deferred to human verification**

## Performance

- **Duration:** ~10 minutes
- **Started:** 2026-05-27
- **Completed:** 2026-05-27
- **Tasks:** 1 code task complete; 1 prod human-verify deferred
- **Files modified:** 1

## Accomplishments

- Inside the wear-pic slide map (`visibleWearPics.map`), added a per-slide `<div className="absolute bottom-2 right-2 ...">` overlay as the last child of each slide's `flex-none w-full h-full relative` wrapper — a sibling after the existing Worn badge at bottom-left
- Overlay contains: `LikeButton` fed `wp.wearEventId` / `wp.initialLikeState` (per-slide loop var), and a `<button onClick={() => setCommentSheetOpen(true)}>` with `MessageCircle` icon + count display using `wearPicCommentCounts[wp.wearEventId] ?? wp.commentCount`
- Overlay container uses `bg-background/80 backdrop-blur-sm rounded-full px-1` scrim — same token chain as the Worn badge and arrow buttons — for legibility over light and dark photos
- Deleted the standalone `{isWearPicSlide && activeWearPic && ...}` social-row block (`flex items-center gap-2 w-full max-w-md`) that previously rendered below the position indicator
- All constraints preserved: Worn badge UTC pin (`T00:00:00Z` + `timeZone: 'UTC'`), `variant="bottom-sheet"` WearCommentHost host, `commentSheetOpen` state, `wearPicCommentCounts` sync, position indicator, editMode eye/hide `onPointerDown` toggle — all untouched

## Task Commits

1. **Task 1: Relocate social controls into per-slide wear-pic overlay (bottom-right), delete standalone row** — `5e6f136` (fix)
2. **Task 2: Prod re-check of UAT Test 4** — DEFERRED (see below)

## Files Created/Modified

- `src/components/watch/WatchPhotoSection.tsx` — Per-slide bottom-right social overlay added inside `visibleWearPics.map`; standalone `{isWearPicSlide && activeWearPic && ...}` social row deleted (net: 35 insertions, 38 deletions — no functional logic change, JSX position only)

## Decisions Made

- **Per-slide wp loop var** — The overlay targets each slide's own `wp.wearEventId` and `wp.initialLikeState` rather than `activeWearPic`, so every slide is independently interactive. `activeWearPic` is still used by the WearCommentHost host (unchanged — it equals the visible slide when the sheet is opened, so the correct thread always opens).
- **Prod visual re-check deferred** — Task 2 is a blocking `checkpoint:human-verify` that requires a Vercel deploy + manual visual check after the route's cache fills (per MEMORY feedback_mobile_ui_verify_on_prod). The executor cannot self-verify visual placement.

## Deviations from Plan

None — plan executed exactly as written. JSX-position-only move; no new props, imports, state, or event handlers.

## Pending Human Verification (Task 2 — Blocking checkpoint:human-verify)

Task 2 is a **blocking human-verify** checkpoint. The prod re-check of UAT Test 4 must be performed AFTER deploying to Vercel and AFTER the cache fills (cold reads can false-positive — MEMORY project_ppr_dynamic_before_use_cache):

| # | Check |
|---|-------|
| 1 | Open /w/[ref] for a watch with public wear pics; swipe to a wear-pic slide — confirm like + comment controls appear OVERLAID on the photo, bottom-right corner, with a legible scrim over both light and dark photos |
| 2 | Confirm the "Worn · [date]" badge is still bottom-LEFT with no overlap/collision |
| 3 | Tap Like (optimistic toggle); tap the comment count → that pic's bottom sheet opens; post a comment + dismiss → count stays in sync |
| 4 | Confirm owner studio/hero uploads and the catalog-fallback slide carry NO social overlay |
| 5 | Confirm no React #418/#419 hydration error in the console after the cache fills |

**Resume signal:** Type "approved" once the overlay is discoverable on prod and functional parity holds, or describe any failure.

## Known Stubs

None — all data paths are wired. The relocated controls use the same `wp.initialLikeState` and `wearPicCommentCounts[wp.wearEventId]` values that were wired in Plan 04.

## Threat Flags

No new trust boundaries introduced. T-62-15 (UTC hydration pin — Worn badge untouched), T-62-16 (cache-contract — page RSC and await connection() untouched), T-62-17 (per-slide targeting — each overlay keyed to its own wp.wearEventId) all mitigated as specified in the plan threat model.

## Self-Check

- `src/components/watch/WatchPhotoSection.tsx` — modified (confirmed: 5e6f136 in git log)
- Commit 5e6f136 exists in git log
- `grep -c "absolute bottom-2 right-2"` → 1 (overlay anchor present)
- `grep -n "id: wp.wearEventId"` → line 519 (per-slide targeting confirmed)
- `grep -n "onClick"` → line 530 (onClick preserved, not onPointerDown)
- `grep -n "T00:00:00Z"` → line 500 (UTC pin intact)
- `grep -n "timeZone: 'UTC'"` → line 501 (UTC pin intact)
- `grep -n 'variant="bottom-sheet"'` → line 598 (WearCommentHost intact)
- `npm run build` → exits 0
- `npx vitest run tests/unit/` → 56/56 passed

## Self-Check: PASSED
