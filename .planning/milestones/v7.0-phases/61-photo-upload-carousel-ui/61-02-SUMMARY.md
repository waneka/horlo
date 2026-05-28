---
phase: 61-photo-upload-carousel-ui
plan: "02"
subsystem: watch-photos-ui
tags: [carousel, filmstrip, dnd-kit, embla, upload, signed-urls]
dependency_graph:
  requires: [61-01]
  provides: [WatchPhotoSection, SortablePhotoThumb, PhotoDropzone, signed-url-rsc]
  affects: [src/app/w/[ref]/page.tsx, src/components/watch/WatchDetail.tsx]
tech_stack:
  added: [embla-carousel-react (carousel viewport)]
  patterns: [useOptimistic + useTransition, horizontalListSortingStrategy, vi.hoisted() mocks]
key_files:
  created:
    - src/components/watch/WatchPhotoSection.tsx
    - src/components/watch/SortablePhotoThumb.tsx
    - src/components/watch/PhotoDropzone.tsx
  modified:
    - src/app/w/[ref]/page.tsx
    - src/components/watch/WatchDetail.tsx
    - tests/components/watch-photo-section.test.tsx
    - tests/components/photo-uploader.test.tsx
decisions:
  - "embla v8 uses watchDrag (not draggable) in reInit() — corrected from PLAN comment; behavior identical"
  - "backward compat: signedPhotos is optional in WatchDetailProps; old image block retained in else-branch for non-Phase-61 callers"
  - "WatchPhotoSection shows WatchIcon placeholder when zero photos + no fallback (no empty-state copy per UI-SPEC)"
  - "Auto-approved checkpoint: device behavior (iOS swipe, touch drag) classified human_needed per MEMORY feedback_mobile_ui_verify_on_prod"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-25T20:57:00Z"
  tasks_completed: 2
  files_changed: 7
---

# Phase 61 Plan 02: Carousel + Filmstrip UI Summary

**One-liner:** embla carousel + always-on dnd-kit filmstrip with signed-URL RSC fetch, multi-file upload pipeline, Edit toggle, drag-to-cover, and per-photo delete undo toast on `/w/[ref]`.

## What Was Built

Plan 02 delivers the visible heart of Phase 61: a fully functional owner photo carousel on `/w/[ref]`. The implementation replaces the single `<Image>` block in `WatchDetail` with three new components wired to the Plan 01 server actions.

### WatchPhotoSection (120+ lines, primary orchestrator)

- embla carousel viewport: `loop:false`, `dragFree:false`, `watchDrag: !editMode` toggle for dnd-kit gesture coexistence
- Always-on filmstrip (`flex overflow-x-auto gap-2`) — tap-to-jump via `emblaApi.scrollTo(idx)`
- Arrow prev/next hidden at single slide, `opacity-50` + disabled at boundary
- Position indicator `"{n} / {total}"` with `aria-live="polite"`, hidden at 1 slide
- Edit toggle on `onPointerDown` (not onClick — stale-instance memory fix)
- DndContext + SortableContext (`horizontalListSortingStrategy`) wraps filmstrip only in edit mode
- `useOptimistic` + `useTransition` for drag-reorder; `reorderWatchPhotosAction` called on drag-end
- Optimistic delete + 5-second undo `toast()` with action button, then `deleteWatchPhotoAction`
- Catalog fallback slide (D-09: single slide, no "stock" label) when `photos.length === 0 && catalogFallbackUrl`
- WatchIcon placeholder when no photos and no fallback
- All edit controls (`Edit photos` toggle, `×` badges, drag handles, `+Add` tile) gated on `viewerCanEdit`

### SortablePhotoThumb (64×64 px thumbnail)

- `useSortable({ id })` + `CSS.Transform.toString(transform)` + `touchAction: 'manipulation'`
- `opacity: isDragging ? 0.3 : 1` (SortableProfileWatchCard precedent)
- Horizontal drop indicators: `w-0.5 h-16 bg-ring` gap-lines (left/right symmetry)
- Cover badge (`text-xs font-semibold bg-background/80`) on index [0] — moves with optimistic drag
- Delete `×` badge: `onClick` only, `bg-destructive`, `aria-label="Delete photo {n}"`
- `GripVertical` drag handle: the ONLY element receiving `{...listeners}` (Pitfall 3)

### PhotoDropzone (multi-file upload pipeline)

- Hidden `<input type="file" multiple accept="image/*,.heic,.heif">` triggered programmatically
- Desktop `onDragOver`/`onDragLeave`/`onDrop` with `ring-2 ring-ring` drag-over highlight
- Cap enforcement: `remaining = 10 - currentPhotoCount`; accepts `files.slice(0, remaining)`; rejects extras with locked toast
- SEQUENTIAL processing loop (sort_order race avoidance — RESEARCH Pitfall 4)
- HEIC detection + `convertHeic` Worker (verbatim from CatalogPhotoUploader)
- Lazy `import('@/lib/exif/strip')` → `stripAndResize` → `uploadWatchPhoto` → `addWatchPhotoAction`
- Input value reset after each batch (`e.target.value = ''`)
- At-cap state: shows "10 photos — at the limit." message, `aria-disabled`

### RSC Modifications (`/w/[ref]/page.tsx`)

- Imports `getWatchPhotosForWatch` + `createSupabaseServerClient`
- Branch 1 (per-user): fetches raw photos + signs each via `supabase.storage.from('watch-photos').createSignedUrl(path, 3600)`; passes `signedPhotos` + `userId` to both owner `<WatchDetail>` call sites
- Branch 2 D-06 (catalog-owned): same pattern using `ownedWatch.id`
- Pure cross-user catalog branch: unchanged (no owner photos this phase)
- Signing ONLY in the RSC, never in DAL (Pitfall 1 compliance)

### WatchDetail Modifications

- Added `signedPhotos?: Array<{ id: string; signedUrl: string | null; sortOrder: number }>` prop
- Added `userId?: string` prop (for client-direct upload auth)
- Old image block preserved in `else` branch (backward compat for any non-Phase-61 caller)
- Active path: when `signedPhotos !== undefined` → renders `<WatchPhotoSection />`

## Tests (TDD — RED → GREEN)

RED commit: `ae68f07` — 2 test files failing (components didn't exist)
GREEN commit: `f810fdf` — 24 tests passing

| File | Tests | Coverage |
|------|-------|---------|
| `tests/components/watch-photo-section.test.tsx` | 15 | PHOTO-03 carousel render, position indicator, filmstrip tap; PHOTO-05 edit mode, DndContext, Cover badge; PHOTO-06 delete badge visibility |
| `tests/components/photo-uploader.test.tsx` | 9 | PHOTO-02 cap enforcement, batch overflow toast, JPEG pipeline, HEIC pipeline, input reset, drop zone |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] embla v8 watchDrag vs draggable API rename**
- **Found during:** Build type check
- **Issue:** PLAN referenced `emblaApi.reInit({ draggable: !editMode })` but embla v8 renames this option to `watchDrag` — `Argument of type '"reinit"'...` was a separate typo (correct: `'reInit'`)
- **Fix:** Used `emblaApi.reInit({ watchDrag: !editMode })` and corrected event name from `'reinit'` to `'reInit'`
- **Files modified:** `src/components/watch/WatchPhotoSection.tsx`
- **Commit:** `f810fdf`

**2. [Rule 2 - Missing] vi.hoisted() for sonner mock factories**
- **Found during:** First test run
- **Issue:** `vi.mock('sonner', () => ({ toast: Object.assign(mockToast, ...) }))` crashed with "Cannot access 'mockToast' before initialization" — hoisting issue (same root cause as Phase 61 Plan 01 KEY DECISION)
- **Fix:** All mock variables moved into `vi.hoisted()` factory before use in `vi.mock()`
- **Files modified:** Both test files
- **Commit:** `f810fdf`

### Architectural Choices (not deviations)

- **backward compat fallback**: Old single `<Image>` block preserved in WatchDetail `else` branch for any caller that hasn't yet threaded `signedPhotos`. The RSC always passes it so this branch never triggers in practice.
- **WatchPhotoSection `+Add` affordance**: In view mode (no edit) with no photos and a userId present, a PhotoDropzone renders below the Edit toggle for quick first upload without entering edit mode. This aligns with UI-SPEC §Empty / Catalog fallback state.

## Checkpoint Status

Task 2 (device verification) was auto-approved per `workflow._auto_chain_active=true`. Device behavior (iOS carousel swipe PHOTO-03, touch drag-reorder PHOTO-05, OS picker PHOTO-02, stale-instance reset) is `human_needed` — user verifies on prod per MEMORY `feedback_mobile_ui_verify_on_prod`.

## Known Stubs

None. All functional paths are wired.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` already registered:
- T-61-08 (drop zone reads `e.dataTransfer.files` only — no URL fetch): mitigated ✓
- T-61-09 (non-owner attempting upload via UI): mitigated (viewerCanEdit gate + DAL backstop) ✓
- T-61-10 (EXIF metadata): mitigated (all files pass stripAndResize) ✓
- T-61-11 (raw storage path to non-owner): mitigated (non-owners get no signedPhotos) ✓

## Self-Check: PASSED

Files exist:
- FOUND: src/components/watch/WatchPhotoSection.tsx
- FOUND: src/components/watch/SortablePhotoThumb.tsx
- FOUND: src/components/watch/PhotoDropzone.tsx

Commits exist:
- ae68f07: test(61-02) RED — failing tests
- f810fdf: feat(61-02) GREEN — implementation + build passes
