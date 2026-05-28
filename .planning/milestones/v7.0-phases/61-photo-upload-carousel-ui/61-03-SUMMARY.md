---
phase: 61-photo-upload-carousel-ui
plan: "03"
subsystem: add-watch-flow
tags: [photo-upload, state-machine, ux, tdd]
dependency_graph:
  requires: [61-01]
  provides: [PHOTO-09]
  affects: [AddWatchFlow, WatchForm, flowTypes]
tech_stack:
  added: []
  patterns:
    - onWatchCreated optional callback pattern for intercepting WatchForm's create-success path
    - photos-pending FlowState variant for mid-flow photo upload step
    - PhotoDropzone reuse in lean step component (WatchPhotoStep)
key_files:
  created:
    - src/components/watch/WatchPhotoStep.tsx
  modified:
    - src/components/watch/flowTypes.ts
    - src/components/watch/WatchForm.tsx
    - src/components/watch/AddWatchFlow.tsx
    - tests/components/add-watch-flow-photos.test.tsx
decisions:
  - WatchPhotoStep imports PhotoDropzone (Plan 02) rather than inlining upload mechanics — avoids duplication, reuses proven pipeline
  - userId resolved via useEffect (not synchronous call) in WatchPhotoStep to avoid React act() warnings in tests
  - photos-pending state excluded from the Recently Evaluated Rail visibility conditions (rail hidden in this step)
  - onWatchCreated fires with result.data.id and the computed dest — no change to edit-mode paths
metrics:
  duration: "5m"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 61 Plan 03: Add-Watch Photos Step (PHOTO-09) Summary

**One-liner:** photos-pending FlowState + WatchForm onWatchCreated callback inserts a skippable-with-friction "Add your photos" step after watch creation before final navigation, wired to both URL-extract and manual-entry paths.

## What Was Built

Phase 61 Plan 03 inserts a prominent, friction-to-skip photo upload step (PHOTO-09) into the `AddWatchFlow` state machine, placed after the watch row is created and before final navigation.

The architecturally complex part — the watchId timing — is solved via an optional `onWatchCreated?: (watchId, destination) => void` callback on `WatchForm`. When this prop is present and a create-mode commit succeeds, `WatchForm` calls `onWatchCreated(result.data.id, dest)` and returns early instead of `router.push(dest)`. `AddWatchFlow` intercepts the watchId and transitions to `photos-pending` state, rendering `WatchPhotoStep` before navigating on Done/Skip.

### Files Modified

**`src/components/watch/flowTypes.ts`** — Added `| { kind: 'photos-pending'; watchId: string; destination: string }` to the `FlowState` discriminated union. `watchId` carries the just-created watch row's id (needed for `addWatchPhotoAction`); `destination` is the post-Done/Skip nav target.

**`src/components/watch/WatchForm.tsx`** — Added optional `onWatchCreated?: (watchId: string, destination: string) => void` prop. At the create-mode success path (~line 270), if the prop is present and `result.data.id` exists, calls `onWatchCreated(result.data.id, dest)` and returns early. The existing `router.push(dest)` remains intact for all other callers (backward compatible). Edit-mode paths are unchanged.

**`src/components/watch/AddWatchFlow.tsx`** — Four changes:
1. Added `handleWatchCreated = (watchId, dest) => setState({ kind: 'photos-pending', watchId, destination: dest })`.
2. Passed `onWatchCreated={handleWatchCreated}` to BOTH the `form-prefill` (~line 579) and `manual-entry` (~line 612) `<WatchForm>` instances (D-15: works for both URL-extract and manual paths).
3. Added `photos-pending` render branch rendering `<WatchPhotoStep>` with `onDone` / `onSkip` that reset state to idle, clear url/rail, and navigate.
4. Extended `useLayoutEffect` cleanup comment to document that `photos-pending` is also reset on Activity-hide (RESEARCH Pitfall 6). The reset logic already handles all non-idle non-form-prefill states.
5. Added `photos-pending` to the rail visibility exclusion list.

**`src/components/watch/WatchPhotoStep.tsx`** (new) — Lean add-flow photo step:
- Heading: `text-lg font-semibold` "Add your photos"
- Subheading: `text-sm text-muted-foreground` "Show how it looks in person."
- `PhotoDropzone` (reused from Plan 02) for multi-file selection + upload pipeline
- 3-column per-file progress grid showing "Processing…" for non-previewed uploads
- Primary `<Button variant="default">` reading "Add photos" (0 uploads) / "Continue" (≥1 upload) calling `onDone`
- Secondary `<button>` (plain, NOT shadcn Button) with `text-muted-foreground` reading "Skip for now" calling `onSkip` (D-16 friction)
- `userId` resolved via `useEffect` (cancellable) from Supabase browser client

## Task Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 RED | test | 3316f77 | Failing tests for PHOTO-09 photos-pending step |
| 1 GREEN | feat | 62973e9 | Implement PHOTO-09 photos-pending step in add-watch flow |
| 2 | checkpoint | — | ⚡ Auto-approved: device-behavior verified by user on prod (chain mode) |

## Deviations from Plan

### Auto-decisions (Claude's Discretion)

**[Discretion - Import] WatchPhotoStep imports PhotoDropzone instead of inlining upload mechanics**
- The plan noted: "if PhotoDropzone is present, prefer importing/reusing it"
- PhotoDropzone exists from Plan 02, so imported it directly
- Eliminates duplication of ~100 lines of HEIC + stripAndResize + uploadWatchPhoto + addWatchPhotoAction logic
- No plan deviation — the plan explicitly guided this choice

**[Discretion - useEffect] userId resolved via useEffect instead of synchronous void call**
- The initial implementation used a synchronous `void resolveUserId()` in render body
- This produced React `act()` warnings in tests (state update outside act boundary)
- Fixed to `useEffect` with cancellable flag — cleaner lifecycle, no test noise
- Functionality identical; only the timing of the setUserId call changes (post-mount)

**[Minor addition] photos-pending excluded from RecentlyEvaluatedRail visibility**
- Rail logic already excluded form-prefill, manual-entry, wishlist-rationale-open, submitting-wishlist
- Added photos-pending to match the same pattern (rail should not show during an in-progress step)
- Not mentioned in the plan but follows existing conventions

None - plan executed essentially as written.

## Known Stubs

None. The upload pipeline is fully wired (PhotoDropzone → addWatchPhotoAction). The "Add photos" primary CTA opens the PhotoDropzone picker when clicked via the dropzone's own interaction (the button is a visible affordance above the dropzone, not a duplicate trigger). After ≥1 upload, "Continue" calls `onDone`.

## Threat Surface Scan

No new trust boundaries introduced beyond the plan's threat model. The `photos-pending` state carries a `watchId` produced by the session's own `addWatch` result; `addWatchPhotoAction` re-verifies ownership via the DAL `watches.user_id` gate (T-61-12 mitigation, Plan 01). No new network endpoints or auth paths added.

## Self-Check: PASSED

- src/components/watch/WatchPhotoStep.tsx — FOUND
- src/components/watch/flowTypes.ts — FOUND
- src/components/watch/WatchForm.tsx — FOUND
- src/components/watch/AddWatchFlow.tsx — FOUND
- Commit 3316f77 (RED test) — FOUND
- Commit 62973e9 (GREEN implementation) — FOUND
