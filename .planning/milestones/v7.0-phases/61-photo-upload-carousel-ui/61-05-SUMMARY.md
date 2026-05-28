---
phase: 61-photo-upload-carousel-ui
plan: "05"
subsystem: watch-photos-ui
tags: [gap-closure, ui, carousel, filmstrip, accessibility]
dependency_graph:
  requires: [61-02]
  provides: [gap-closure-2,gap-closure-3,gap-closure-4,gap-closure-5,gap-closure-6,gap-closure-7,gap-closure-8]
  affects: [WatchPhotoSection, SortablePhotoThumb, PhotoDropzone]
tech_stack:
  added: []
  patterns:
    - "Immediate optimistic hide with aborted-signal Undo pattern"
    - "Full-width PhotoDropzone below filmstrip triggered by icon tile via id"
    - "min-w-0 on flex filmstrip ancestor for internal overflow-x-auto scroll"
    - "max-w-md wrapper on position indicator to center on photo width"
key_files:
  created: []
  modified:
    - src/components/watch/SortablePhotoThumb.tsx
    - src/components/watch/WatchPhotoSection.tsx
    - src/components/watch/PhotoDropzone.tsx
    - tests/components/watch-photo-section.test.tsx
decisions:
  - "D-07 revised honored: Cover badge gated on isCover && editMode in SortablePhotoThumb; view-mode filmstrip in WatchPhotoSection carries no Cover badge"
  - "Gap #6 immediate-hide uses aborted-signal pattern (object ref) instead of clearTimeout-only so Undo reliably prevents the server call after the toast fires"
  - "Gap #2 resolved by rendering PhotoDropzone at full width below the filmstrip; +Add icon tile triggers it via id (no duplicate pipeline wiring)"
  - "text-destructive-foreground replaced with text-white (--destructive-foreground is undefined in globals.css)"
metrics:
  duration: "5 minutes"
  completed: "2026-05-26T14:47:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 61 Plan 05: UAT Gap Closure — Carousel/Filmstrip/Dropzone Summary

**One-liner:** Closed 7 UAT-reported gaps in carousel/filmstrip/dropzone: Cover badge edit-mode-only (D-07 revised), × glyph contrast, drag-handle hit area, position indicator centering, immediate optimistic delete, filmstrip overflow containment, full-width dropzone affordance.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix SortablePhotoThumb — drag-handle hit area (#3), Cover badge edit-mode gate (#5), × glyph contrast (#7) | d73187d | SortablePhotoThumb.tsx, WatchPhotoSection.tsx, tests |
| 2 | Fix WatchPhotoSection — indicator centering (#4), immediate optimistic delete (#6), filmstrip overflow containment (#8), full-size edit-mode dropzone (#2) | a5cf30a | WatchPhotoSection.tsx, PhotoDropzone.tsx, tests |

## Gaps Closed

### Gap #2 — Edit-mode dropzone affordance text legible
**Change:** Removed `w-16 h-16` constraint wrapping `PhotoDropzone`. The filmstrip now renders a compact icon-only `+Add` tile that triggers the full-width `PhotoDropzone` (rendered below the filmstrip) via `id`-based `.click()`. Full "Drop photos here or tap to choose" text renders legibly in the full-width affordance. Added `id` prop to `PhotoDropzone`.

### Gap #3 — Drag-handle hit area enlarged
**Change:** Replaced bare `GripVertical` icon div (`absolute bottom-1 left-1`) with padded wrapper (`absolute bottom-0 left-0 p-2`). Padding expands the draggable hit target from the raw 12px icon to ~40px tap area. `{...listeners}` remain on the handle wrapper (not the outer thumb). Prod touch confirmation on mobile per MEMORY.

### Gap #4 — Position indicator centered on photo
**Change:** Wrapped the position indicator `<p>` in a `<div className="w-full max-w-md">` matching the carousel viewport constraint. `text-center` now centers within the `max-w-md` box, not the full parent width. Source grep: `max-w-md` appears ≥ 2 times (carousel viewport + indicator wrapper).

### Gap #5 — Cover badge edit-mode only (D-07 revised)
**Change (SortablePhotoThumb):** Changed `{isCover && (` to `{isCover && editMode && (`. Badge now renders only in edit mode.
**Change (WatchPhotoSection view-mode filmstrip):** Removed the `{visibleIds[0] === id && <span>Cover</span>}` block from the view-mode plain-thumbnail branch. Also removed `, Cover` from the view-mode `aria-label` conditional.

### Gap #6 — Photo hides immediately on × click (optimistic)
**Change:** `setDeletedIds(photoId)` now fires in a `startTransition` AT CLICK TIME (immediately). The 5s `setTimeout` contains ONLY the `deleteWatchPhotoAction` server call. Undo: sets `signal.aborted = true` AND clears the timer; a no-op `startTransition` flushes the optimistic layer so `useOptimistic` reverts to the server snapshot (photo reappears). Server failure after undo window: `useOptimistic` auto-reverts + `toast.error`.

### Gap #7 — × glyph legible contrast
**Change:** Replaced `text-destructive-foreground` with `text-white` on the delete button. `--destructive-foreground` is undefined in `globals.css`; the glyph previously fell back to inherited near-black `--foreground` over the dark-red `bg-destructive`.

### Gap #8 — Filmstrip scrolls internally within column
**Change:** Added `min-w-0` to the outer filmstrip wrapper (`div` in `hasOwnerPhotos`), and to both the edit-mode and view-mode filmstrip `flex overflow-x-auto` row divs. This removes flexbox's `min-width: auto` expansion so `overflow-x-auto` scrolls within the container bounds rather than pushing the right rail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] View-mode Cover badge in WatchPhotoSection also needed removal**
- **Found during:** Task 1 test run (tests failed revealing the view-mode badge in WatchPhotoSection)
- **Issue:** Plan specified fixing the Cover badge in SortablePhotoThumb (Task 1), but WatchPhotoSection's view-mode filmstrip independently rendered a `<span>Cover</span>` on `visibleIds[0]`. Plan mentioned this in Task 2 (gap #5 D-07 action) but the test caught it in Task 1.
- **Fix:** Removed view-mode Cover span from WatchPhotoSection in Task 1 (earlier than planned, no harm)
- **Files modified:** src/components/watch/WatchPhotoSection.tsx
- **Commit:** d73187d

**2. [Rule 2 - Missing functionality] Undo signal pattern for immediate-hide delete**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `signal.aborted` flag and no-op transition for Undo restore; `undoSignalRef` was also needed as a module-level ref to assign fresh signals per delete call.
- **Fix:** Added `undoSignalRef` (`useRef<{ aborted: boolean }>`) alongside existing `undoTimerRef`. Each `handleDelete` call creates a fresh `signal` object and assigns it to the ref. Undo sets `signal.aborted = true`.
- **Files modified:** src/components/watch/WatchPhotoSection.tsx
- **Commit:** a5cf30a

## Known Stubs

None — all gaps resolved with functional code. No placeholder text or hardcoded empty values introduced.

## Threat Flags

None — all changes are pure CSS/client-state cosmetic fixes per the plan's threat model (T-61-05-01/02/03 all accepted/mitigated with no new surface).

## Test Results

- `npm test -- watch-photo-section`: 16 tests, all pass
  - Updated: Cover badge assertions flip to edit-mode-only (D-07 revised)
  - Added: explicit view-mode-no-badge assertion
  - Updated: delete test asserts toast fires immediately AND `deleteWatchPhotoAction` is NOT called until after the 5s timeout
- `npm run build`: exits 0 (authoritative gate)

## Self-Check

### Files exist
- [x] src/components/watch/SortablePhotoThumb.tsx
- [x] src/components/watch/WatchPhotoSection.tsx
- [x] src/components/watch/PhotoDropzone.tsx
- [x] tests/components/watch-photo-section.test.tsx

### Commits exist
- [x] d73187d — Task 1
- [x] a5cf30a — Task 2
