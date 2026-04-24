---
phase: 15
plan: 03b
subsystem: wywt-frontend
tags: [wywt, dialog, compose, toast, visibility, camera, frontend, photo]

# Dependency graph
dependency-graph:
  requires:
    - phase: 15
      plan: 01
      provides: "stripAndResize, uploadWearPhoto, PhotoUploader (extended), CameraCaptureView, WristOverlaySvg"
    - phase: 15
      plan: 02
      provides: "<ThemedToaster /> mounted in root layout — client-side toast.success('Wear logged') call sites usable"
    - phase: 15
      plan: 03a
      provides: "logWearWithPhoto + getWornTodayIdsForUserAction Server Actions consumed directly from @/app/actions/wearEvents"
  provides:
    - "WywtPostDialog orchestrator — two-step picker → compose with preflight + state preservation on Change"
    - "ComposeStep — Step 2 form with photo zone (3 states), note (200-char), visibility, submit pipeline"
    - "VisibilitySegmentedControl — Private/Followers/Public segmented with sub-label copy per UI-SPEC"
    - "WatchPickerDialog extended with optional onWatchSelected + wornTodayIds props (backwards-compatible)"
    - "NavWearButton + WywtRail self-placeholder now open WywtPostDialog (D-04 call-site swap)"
    - "PhotoUploader forwardRef + useImperativeHandle exposing openPicker() — unblocks D-07 'Choose another' path"
  affects:
    - "Plan 15-04 (Wear Detail) — WywtPostDialog surface is now the canonical wear-post entry; /wear/[id] gate consumes the same wear_events rows this flow writes."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 1 (lazy-loaded dialog): NavWearButton + WywtRail both use `lazy(() => import('@/components/wywt/WywtPostDialog'))` with render-gated `{open && ...}` to keep the initial bundle small on pages that never trigger the Wear CTA"
    - "Pattern 2 (two-step state machine with preserved form state): step: 'picker' | 'compose' with useState; Change link clears selectedWatchId but keeps photoBlob / note / visibility — close resets everything"
    - "Pattern 3 (backwards-compatible prop extension): WatchPickerDialog's new `onWatchSelected` + `wornTodayIds` props are strictly additive; when absent the Phase 10 markAsWorn path is byte-preserved and LogTodaysWearButton keeps using it"
    - "Pattern 6 (duplicate-day): client-side preflight via getWornTodayIdsForUserAction (Plan 03a Server Action) + DB-side 23505 catch as the safety net; failed preflight degrades gracefully"
    - "Pattern 7 (client-direct upload + server validates): client uploads to Storage at {userId}/{wearEventId}.jpg via uploadWearPhoto BEFORE calling logWearWithPhoto; the action runs its .list() existence probe and rejects if the client lied about hasPhoto"
    - "Pattern 8 (Sonner toast from Client Component): toast.success('Wear logged') fires from ComposeStep's submit handler after Server Action returns success — Server Action has NO sonner import (H-2 invariant)"
    - "React 'adjust state during render' pattern (prevOpen via useState + conditional setState) used in WywtPostDialog to reset draft state when parent flips open={false} — avoids the setState-in-effect lint violation while achieving the same semantics"
    - "forwardRef + useImperativeHandle for imperative openPicker() API on PhotoUploader — ref stays alive across photo-zone transitions because PhotoUploader is always rendered (sr-only when not in chooser branch)"

key-files:
  created:
    - "src/components/wywt/WywtPostDialog.tsx"
    - "src/components/wywt/ComposeStep.tsx"
    - "src/components/wywt/VisibilitySegmentedControl.tsx"
    - "tests/components/WywtPostDialog.test.tsx"
  modified:
    - "src/components/home/WatchPickerDialog.tsx (Task 1 — +onWatchSelected, +wornTodayIds; existing handleSubmit / markAsWorn path byte-preserved when props absent)"
    - "src/components/wywt/PhotoUploader.tsx (Task 3 — forwardRef + useImperativeHandle exposing openPicker(); existing API surface strictly additive)"
    - "src/components/home/WywtRail.tsx (Task 4 — lazy target swap: WatchPickerDialog → WywtPostDialog; forwards data.viewerId)"
    - "src/components/layout/NavWearButton.tsx (Task 4 — lazy target swap + viewerId prop added)"
    - "src/components/layout/BottomNav.tsx (Task 4 — viewerId prop added + plumbed through)"
    - "src/components/layout/BottomNavServer.tsx (Task 4 — pass user.id as viewerId)"
    - "src/components/layout/DesktopTopNav.tsx (Task 4 — pass user.id as viewerId)"
    - "tests/components/layout/NavWearButton.test.tsx (Task 4 — module mock retargeted; viewerId prop added to 10 renders)"
    - "tests/components/layout/BottomNav.test.tsx (Task 4 — module mock retargeted; viewerId prop added to 18 renders)"
  deleted:
    - "src/components/layout/MobileNav.tsx (stray untracked leftover from pre-base worktree state — same Rule 3 cleanup 15-03a performed)"

key-decisions:
  - "PhotoUploader extension via Option A (forwardRef + useImperativeHandle exposing openPicker()) rather than Option B (duplicate hidden <input> in ComposeStep) — Option A keeps the HEIC + stripAndResize pipeline centralized in PhotoUploader; no duplicate Plan 01 logic."
  - "PhotoUploader rendered unconditionally with a sr-only wrapper when not in the pre-capture chooser branch. If PhotoUploader were only rendered inside the chooser branch, photoUploaderRef would be null by the time the user clicked 'Choose another' on the preview — the ref must survive photo-zone transitions. D-07 Test 20 locks this contract."
  - "ComposeStep uses a plain <h2 className='font-heading text-base leading-none font-semibold'> instead of DialogTitle. ComposeStep can be unit-rendered without a DialogRoot context this way; production still wraps it in DialogContent (inside DialogRoot) in WywtPostDialog so role='dialog' semantics are preserved."
  - "Parent-driven close state reset uses the React 'adjust state during render' pattern (useState-tracked prevOpen + conditional setState) rather than useEffect. Satisfies both react-hooks/set-state-in-effect (no state mutation in effects) and react-hooks/refs (no ref-mutation-in-render) lint rules with zero behavior change."
  - "WywtPostDialog consumes getWornTodayIdsForUserAction directly from '@/app/actions/wearEvents' — no intermediate DAL import, no mid-task rename. Plan 03a shipped the Server Action in Wave 2; by Wave 3 (this plan) the symbol exists and tsc passes on first commit."
  - "LogTodaysWearButton is byte-unchanged since the base commit. The quick-log markAsWorn path is preserved per D-04 (profile page still uses WatchPickerDialog directly with markAsWorn, while the full photo-post flow is opened from NavWearButton + WywtRail)."
  - "PhotoUploader ref type exported as `PhotoUploaderHandle = { openPicker(): void }`. Keeps the imperative contract discoverable via TypeScript autocomplete for any future caller."

patterns-established:
  - "Two-step modal with preserved form state (picker → compose with Change link preserving partial state). Generalizable to any feature that needs a selection step followed by a compose step with optional return-to-select."
  - "Forward-ref imperative handle for file-picker re-opens: a standard pattern any component that wraps a hidden <input type='file'> can adopt when callers need to programmatically re-open the picker (upload-replace flows, edit-previous-upload, etc.)."
  - "Segmented control with per-option sub-label row — reusable whenever a tri-state selector needs explicit description copy under the group."

requirements-completed: [WYWT-01, WYWT-02, WYWT-03, WYWT-04, WYWT-07, WYWT-08, WYWT-16]

# Metrics
metrics:
  duration_min: 18
  completed: "2026-04-24T19:24Z"
  tasks: 4
  tests_added: 20
---

# Phase 15 Plan 03b: WYWT Post Flow Frontend Summary

Client-side composition layer for the Phase 15 WYWT photo post flow shipped: `WywtPostDialog` two-step orchestrator (picker → compose with preflight + state preservation), `ComposeStep` form with D-07 three distinct handlers (X remove / Retake re-acquires MediaStream / Choose-another re-opens file picker via PhotoUploader ref), `VisibilitySegmentedControl` tri-state segmented button, backwards-compatible `WatchPickerDialog` extension (`onWatchSelected` + `wornTodayIds`), and call-site routing updates in `NavWearButton` (+ all callers plumbed with `viewerId`) + `WywtRail` self-placeholder tile.

All 20 Wave 0 tests GREEN. Full repo: 84/84 test files PASS, 2640 tests PASS, 135 env-gated integration tests skipped. `npx tsc --noEmit` clean (only 3 pre-existing out-of-scope errors remain — same set documented in 15-01/02/03a). ESLint clean on every new / modified file. Plan-level greps: `grep -rn 'WatchPickerDialog' src/components/layout/` returns 0 active imports; `grep -rn 'WywtPostDialog' src/components/` returns 22 matches; `grep -rn 'toast(' src/app/actions/` returns 0 (H-2 invariant preserved from 03a).

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-24T19:06Z
- **Completed:** 2026-04-24T19:24Z
- **Tasks:** 4
- **Files changed:** 13 (3 created src + 1 created test + 8 modified src + 2 modified test + 1 deleted stray)

## Tasks Completed

| Task | Name                                                                                                          | Commit  | Files                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Extend WatchPickerDialog with onWatchSelected + wornTodayIds (backwards-compatible)                           | b877230 | src/components/home/WatchPickerDialog.tsx, tests/components/WywtPostDialog.test.tsx (+ stubs for WywtPostDialog/ComposeStep/VisibilitySegmentedControl)                                       |
| 2    | Ship WywtPostDialog two-step orchestrator with preflight                                                      | f4b55ff | src/components/wywt/WywtPostDialog.tsx                                                                                                                                                       |
| 3    | Ship ComposeStep + VisibilitySegmentedControl with D-07 three-handler split (+ PhotoUploader forwardRef)      | 840a32e | src/components/wywt/ComposeStep.tsx, src/components/wywt/VisibilitySegmentedControl.tsx, src/components/wywt/PhotoUploader.tsx, src/components/wywt/WywtPostDialog.tsx (setState-in-render), tests/components/WywtPostDialog.test.tsx |
| 4    | Swap NavWearButton + WywtRail call sites to WywtPostDialog (D-04)                                             | 4fa4c73 | src/components/home/WywtRail.tsx, src/components/layout/NavWearButton.tsx, src/components/layout/BottomNav.tsx, src/components/layout/BottomNavServer.tsx, src/components/layout/DesktopTopNav.tsx, src/components/wywt/ComposeStep.tsx (font-medium → font-semibold), tests/components/layout/{NavWearButton,BottomNav}.test.tsx |

## Verification Results

| Check                                                                                                                            | Result                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run test -- tests/components/WywtPostDialog.test.tsx --run`                                                                 | PASS (20/20 in ~0.3s)                                                                                                  |
| `npm run test -- tests/components/home/WatchPickerDialog.test.tsx --run` (regression)                                            | PASS (8/8)                                                                                                             |
| `npm run test -- tests/components/layout/NavWearButton.test.tsx --run` (regression)                                              | PASS (10/10)                                                                                                           |
| `npm run test -- tests/components/layout/BottomNav.test.tsx --run` (regression)                                                  | PASS (22/22)                                                                                                           |
| `npm run test -- tests/components/PhotoUploader.test.tsx --run` (regression after forwardRef extension)                          | PASS (7/7)                                                                                                             |
| `npm run test -- tests/components/ThemedToaster.test.tsx --run` (sanity)                                                         | PASS (3/3)                                                                                                             |
| `npm run test -- --run` (full suite)                                                                                             | 84 files PASS, 2640 tests PASS, 135 skipped (env-gated integration suites); 0 failures                                 |
| `npx tsc --noEmit`                                                                                                               | 3 pre-existing errors only (layout.tsx LayoutProps; PreferencesClient.debt01 ×2 — same set flagged in 15-01/02/03a)    |
| `npx eslint <all 10 modified src files>`                                                                                         | Clean (0 errors, 0 warnings)                                                                                           |
| `grep -rn "WatchPickerDialog" src/components/layout/`                                                                            | 3 doc-comment references only; 0 active imports                                                                        |
| `grep -rn "WywtPostDialog" src/components/`                                                                                      | 22 matches (NavWearButton, WywtRail, WywtPostDialog itself, all call sites)                                            |
| `grep -rn "toast(" src/app/actions/`                                                                                             | 0 matches (Pitfall H-2 enforced — Plan 03a invariant preserved)                                                        |
| `grep -rn "import heic2any" src/ \| grep -v heic-worker`                                                                         | 0 matches (Pitfall E-1 enforced from Plan 01)                                                                          |
| `grep -n "handleRemovePhoto\|handleRetake\|handleChooseAnother" src/components/wywt/ComposeStep.tsx`                             | 11 matches: 3 function declarations + 3 JSX onClick handlers + 5 doc-comment references                                |
| `git diff 13506ea..HEAD -- src/components/profile/LogTodaysWearButton.tsx`                                                       | empty (LogTodaysWearButton byte-unchanged; quick-log markAsWorn path preserved per D-04)                               |

## Test Count

| Block                                                           | Tests | Status |
| --------------------------------------------------------------- | ----- | ------ |
| Task 1 — WatchPickerDialog extension (Tests 1–3)                | 3     | GREEN  |
| Task 2 — WywtPostDialog orchestrator (Tests 4–8)                | 5     | GREEN  |
| Task 3 — VisibilitySegmentedControl (Tests 9–11)                | 3     | GREEN  |
| Task 3 — ComposeStep core flow (Tests 12–17)                    | 6     | GREEN  |
| Task 3 — D-07 three-handler distinction (Tests 18–20)           | 3     | GREEN  |
| **Plan 03b Wave 0 total (tests/components/WywtPostDialog.test.tsx)** | **20** | **GREEN** |

Plan expected 18+. 20 delivered. Task 3's "12+ tests for behaviors 9–20" was met exactly (3 + 6 + 3 = 12).

## PhotoUploader Extension Path

**Option A (forwardRef + useImperativeHandle) chosen.**

Full diff on `src/components/wywt/PhotoUploader.tsx`:
- Converted `export function PhotoUploader(...)` to `export const PhotoUploader = forwardRef<PhotoUploaderHandle, PhotoUploaderProps>(...)`.
- Added `export interface PhotoUploaderHandle { openPicker: () => void }`.
- Added `useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), [])` inside the component body.
- No changes to `isHeicFile` / `convertHeic` / `handleFileChange` / JSX structure. Existing `tests/components/PhotoUploader.test.tsx` (7 tests) still passes — the ref is strictly additive.

Rejected Option B (duplicate hidden `<input type="file">` in ComposeStep + inlined HEIC detection + stripAndResize pipeline) as it would duplicate Plan 01 logic across two surfaces.

## Caller list for NavWearButton viewerId plumbing

NavWearButton now requires `viewerId: string`. Three callers updated to pass through `user.id` from `getCurrentUser()`:

| Caller | Path | Method |
| --- | --- | --- |
| DesktopTopNav | `src/components/layout/DesktopTopNav.tsx` | Receives `user.id` via `DesktopTopNavProps.user`; forwards as `<NavWearButton ... viewerId={user.id} />` |
| BottomNav (mobile) | `src/components/layout/BottomNav.tsx` + `src/components/layout/BottomNavServer.tsx` | BottomNavServer receives `user.id` from `getCurrentUser()`, adds to `<BottomNav viewerId={user.id} ... />`, BottomNav forwards to NavWearButton |
| WywtRail self-placeholder | `src/components/home/WywtRail.tsx` | Forwards `data.viewerId` (already present in `WywtRailData` from Phase 10) to `<WywtPostDialog viewerId={data.viewerId} />` directly — does NOT render NavWearButton itself; its own lazy-loaded WywtPostDialog branch handles viewerId |

Header.tsx (Server Component) already resolves `user.id` via `getCurrentUser()` and is the source for both DesktopTopNav's and BottomNavServer's user-id reads. No changes required to Header itself.

## D-07 Three-Handler Distinction (Tests 18 / 19 / 20)

Tests pin the three distinct behaviors explicitly:

| Test | Trigger | Expected effect |
| --- | --- | --- |
| Test 18 | X button on photo preview (either source) | `setPhotoBlob(null)` + `setPhotoSource(null)` → pre-capture chooser re-renders with Take wrist shot + Upload photo both visible. |
| Test 19 | "Retake" link (camera source only) | `navigator.mediaDevices.getUserMedia` invoked a SECOND time with a fresh MediaStream → CameraCaptureView re-mounts receiving the new stream (data-stream-id changes). Pre-capture chooser is NOT re-rendered. `photoSource` stays 'camera'. |
| Test 20 | "Choose another" link (upload source only) | `photoUploaderRef.current.openPicker()` invoked exactly once (spy'd on the forwardRef mock). PhotoUploader remains mounted (sr-only wrapper) so the ref is alive. |

`grep -n "handleRemovePhoto\|handleRetake\|handleChooseAnother" src/components/wywt/ComposeStep.tsx` returns:
- 3 distinct function declarations (`const handleRemovePhoto = ...`, `const handleRetake = async () => ...`, `const handleChooseAnother = () => ...`)
- 3 distinct JSX wirings (`onClick={handleRemovePhoto}` on X button; `onClick={handleRetake}` on Retake link; `onClick={handleChooseAnother}` on Choose another link)
- 5 doc-comment references

No cross-wiring — the threat T-15-28 mitigation is verified by all three behaviors.

## Deviations from Plan

### [Rule 3 — Blocking] Replaced DialogTitle with plain <h2> in ComposeStep

- **Found during:** Task 3 first test run
- **Issue:** `<DialogTitle>` from `@/components/ui/dialog` requires a `DialogRoot` context. ComposeStep is unit-tested naked (without a Dialog wrapper), causing `TypeError: Cannot destructure property 'store' of 'useDialogRootContext(...)' as it is undefined` on every test that renders it directly.
- **Fix:** Replaced `<DialogTitle>` with `<h2 className="font-heading text-base leading-none font-semibold">`. In production, ComposeStep is still wrapped in `<DialogContent>` (inside `DialogRoot`) by WywtPostDialog — so the outer `role="dialog"` / accessibility semantics are unaffected. The h2 is visually identical.
- **Files modified:** `src/components/wywt/ComposeStep.tsx` (removed `DialogTitle` import; h2 rendered in the header row)
- **Committed in:** 840a32e

### [Rule 3 — Blocking] Added URL.createObjectURL / URL.revokeObjectURL stubs to test file

- **Found during:** Task 3 ComposeStep tests (Test 12 onward)
- **Issue:** jsdom omits `URL.createObjectURL` / `URL.revokeObjectURL`. ComposeStep builds a photo preview URL inside a `useMemo` on every render with a non-null blob, so the stubs must exist before the first render.
- **Fix:** Added test-local stubs at the top of `tests/components/WywtPostDialog.test.tsx`:
  ```typescript
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:stub/preview'
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = () => {}
  }
  ```
- **Files modified:** `tests/components/WywtPostDialog.test.tsx`
- **Committed in:** 840a32e

### [Rule 3 — Blocking] Persistent PhotoUploader instance (hidden when not in chooser branch)

- **Found during:** Task 3 Test 20 first run (openPicker spy received 0 calls)
- **Issue:** Plan's Step 2 code renders PhotoUploader ONLY inside the pre-capture chooser branch of the photo zone. When photoBlob becomes non-null, PhotoUploader unmounts → `photoUploaderRef.current` is null → handleChooseAnother's `openPicker()` call is a no-op.
- **Fix:** PhotoUploader is rendered UNCONDITIONALLY below the state branches. A wrapper div applies `sr-only` when not in the chooser branch (`!photoBlob && !cameraStream` ? visible : sr-only) so the imperative ref stays alive across photo-zone transitions. Production UX is identical (Upload photo button only appears in the chooser); the component just remains mounted in the DOM.
- **Files modified:** `src/components/wywt/ComposeStep.tsx` — photo-zone JSX restructured so PhotoUploader is a sibling of the state branches rather than a child of the chooser branch.
- **Committed in:** 840a32e

### [Rule 3 — Blocking] React `adjust state during render` pattern for parent-driven close

- **Found during:** Task 3 lint run
- **Issue:** The plan's WywtPostDialog Task 2 code handles parent-driven close only via `handleOpenChange` — if a parent unilaterally flips `open={false}` via its own state setter (e.g., an out-of-band close from a different UI surface), draft state wouldn't reset. First attempted fix: `useEffect` with `setState` calls inside → flagged by `react-hooks/set-state-in-effect`. Second attempted fix: `useRef` tracking prev open → flagged by `react-hooks/refs` (no ref access/mutation during render).
- **Fix:** Use the React-recommended pattern: a `useState`-tracked `prevOpen` + conditional `setState` during render when `prevOpen !== open`. React docs explicitly endorse this pattern for "adjust state based on a changing prop". Zero behavior change from the plan spec; zero lint violations.
- **Files modified:** `src/components/wywt/WywtPostDialog.tsx` (replaced the useEffect block; dropped useRef import)
- **Committed in:** 840a32e

### [Rule 3 — Blocking] font-medium → font-semibold in ComposeStep h2

- **Found during:** Task 4 full test suite run
- **Issue:** `tests/no-raw-palette.test.ts` forbids `\bfont-medium\b` across all src files. The DialogTitle-replacement h2 in ComposeStep inherited the `font-medium` weight from DialogTitle's className.
- **Fix:** Swapped `font-medium` → `font-semibold`. UI-SPEC title typography accepts both weights; semibold is already used throughout other ComposeStep strings (Change link, watch card brand, submit button).
- **Files modified:** `src/components/wywt/ComposeStep.tsx`
- **Committed in:** 4fa4c73

### [Rule 3 — Blocking] Removed stray untracked `src/components/layout/MobileNav.tsx`

- **Found during:** Task 4 full test suite run
- **Issue:** Same condition 15-03a hit — `tests/lib/mobile-nav-absence.test.ts` asserts `existsSync('src/components/layout/MobileNav.tsx') === false`. The file was present in the worktree as an untracked leftover from a pre-base state (never in HEAD of the base commit `13506ea`).
- **Fix:** Deleted the untracked file. No git-add required (never tracked); the deletion itself clears the on-disk assertion.
- **Files modified:** `src/components/layout/MobileNav.tsx` (deleted; never tracked)
- **Committed in:** 4fa4c73 (noted in commit message)

### No other deviations

The plan executed per the spec for all four tasks. No Rule-1 bug fixes were required; no Rule-2 missing-functionality additions beyond the PhotoUploader persistence fix above; no Rule-4 architectural escalations.

## Authentication Gates

None encountered. The Server Actions (logWearWithPhoto / getWornTodayIdsForUserAction) are Plan 03a surfaces and are already auth-gated via `getCurrentUser()`; Plan 03b only consumes them from Client Components.

## Known Stubs

None. Every export is fully wired:
- `WywtPostDialog`, `ComposeStep`, `VisibilitySegmentedControl` render real UI end-to-end (no `null` early returns except the defensive no-selected-watch fallback that re-routes to the picker).
- `WatchPickerDialog` new props have real behavior (emit-upward + disabled-row rendering).
- `PhotoUploader` extension exposes a real imperative handle that calls a real `inputRef.current.click()`.
- All call-site swaps (NavWearButton, WywtRail, BottomNav, DesktopTopNav) pass live viewerId values resolved from `getCurrentUser()` in Server Components.

## Threat-Model Mitigations Verified

| Threat ID | Mitigation                                                                                                                                                  | Verification                                                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-15-01   | `getUserMedia` is the FIRST await in `handleTapCamera` and `handleRetake` (no setState / prop access / fetch before it)                                       | Code review: lines 129–149 (`handleTapCamera`) and 189–193 (`handleRetake`) in ComposeStep.tsx — `setError(null)` is a synchronous state update, not an await; no Promise before `getUserMedia` |
| T-15-10   | `handleRemovePhoto` / `handleCancelCamera` / submit path + useEffect unmount all stop MediaStream tracks before clearing `cameraStream`                        | ComposeStep.tsx lines 121–126 (unmount cleanup), 179–183 (handleRemovePhoto), 199–203 (handleCancelCamera); CameraCaptureView unmount effect is Plan 01's additional defense-in-depth |
| T-15-27   | Duplicate-day error string 'Already logged this watch today' is a UX message, not a security boundary                                                        | Plan 03a Server Action returns the exact string (Test 19 in 15-03a integration tests); ComposeStep Test 16 verifies the string surfaces in the inline `role="alert"` banner          |
| T-15-28   | Three distinct handlers (`handleRemovePhoto`, `handleRetake`, `handleChooseAnother`) wired to three distinct UI elements — no cross-wiring                    | Tests 18, 19, 20 pin each handler's unique side effect; `grep` returns 3 distinct declarations + 3 distinct JSX onClick wirings                                                      |

## Plan Success Criteria — Final Status

| #   | Criterion                                                                                                                               | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Two-step modal flow: NavWearButton/WywtRail self-placeholder → WywtPostDialog → picker (with wornTodayIds preflight) → compose → Server Action → toast | DONE  |
| 2   | 'Change' link returns to Step 1 preserving note + visibility + photo (D-05)                                                              | DONE (Test 5 + prop-pass verification) |
| 3   | Submit-with-no-photo path works (hasPhoto:false → row with photo_url:null)                                                               | DONE (Test 12)                                                   |
| 4   | Submit-with-photo path: stripAndResize → uploadWearPhoto → logWearWithPhoto in order                                                      | DONE (Test 17 verifies call-order via `invocationCallOrder`)     |
| 5   | D-07 three-handler distinction: X → chooser; Retake → live camera; Choose another → file picker                                           | DONE (Tests 18 / 19 / 20)                                        |
| 6   | Sonner 'Wear logged' toast fires on success; inline `role="alert"` banner on failure (never both)                                         | DONE (Test 15 success; Test 16 failure)                          |
| 7   | WYWT rail non-self tile tap still opens WywtOverlay (Phase 10 preserved)                                                                 | DONE (WywtRail lines 112–123 untouched; openAt(tile) handler and WywtOverlay lazy import preserved)                                                                           |
| 8   | LogTodaysWearButton unchanged (quick-log markAsWorn path preserved)                                                                      | DONE (`git diff 13506ea..HEAD -- src/components/profile/LogTodaysWearButton.tsx` is empty)                                                                                     |
| 9   | All Wave 0 tests in tests/components/WywtPostDialog.test.tsx (20+ tests) are green                                                       | DONE (20/20)                                                     |
| 10  | `npx tsc --noEmit` passes on every task commit (Plan 03a symbols already present)                                                        | DONE (only 3 pre-existing errors remain throughout)              |

## Threat Flags

None — this plan composes existing primitives (Plan 01 photo pipeline, Plan 02 Toaster, Plan 03a Server Actions) into a UI surface. No new network endpoints, no new auth paths, no new file access patterns, no schema changes. The Server Actions invoked from this plan's submit handler were already fully threat-modeled in 15-03a; Plan 03b inherits those mitigations intact.

## Self-Check

### Files exist (all verified via `ls` + `git ls-files`):

- `src/components/wywt/WywtPostDialog.tsx` — FOUND (created in b877230, rewritten in f4b55ff, tweaked in 840a32e)
- `src/components/wywt/ComposeStep.tsx` — FOUND (created stub in b877230, implemented in 840a32e, tweaked in 4fa4c73)
- `src/components/wywt/VisibilitySegmentedControl.tsx` — FOUND (created stub in b877230, implemented in 840a32e)
- `src/components/home/WatchPickerDialog.tsx` — FOUND (modified in b877230)
- `src/components/wywt/PhotoUploader.tsx` — FOUND (forwardRef extension in 840a32e)
- `src/components/home/WywtRail.tsx` — FOUND (modified in 4fa4c73)
- `src/components/layout/NavWearButton.tsx` — FOUND (modified in 4fa4c73)
- `src/components/layout/BottomNav.tsx` — FOUND (modified in 4fa4c73)
- `src/components/layout/BottomNavServer.tsx` — FOUND (modified in 4fa4c73)
- `src/components/layout/DesktopTopNav.tsx` — FOUND (modified in 4fa4c73)
- `tests/components/WywtPostDialog.test.tsx` — FOUND (created in b877230, extended in 840a32e)
- `tests/components/layout/NavWearButton.test.tsx` — FOUND (modified in 4fa4c73)
- `tests/components/layout/BottomNav.test.tsx` — FOUND (modified in 4fa4c73)
- `.planning/phases/15-wywt-photo-post-flow/15-03b-SUMMARY.md` — being written now
- `src/components/layout/MobileNav.tsx` — REMOVED (was untracked leftover)

### Commits exist (verified via `git log --oneline 13506ea..HEAD`):

- `b877230` — feat(15-03b): extend WatchPickerDialog with onWatchSelected + wornTodayIds (D-02, D-03) — FOUND
- `f4b55ff` — feat(15-03b): ship WywtPostDialog two-step orchestrator with preflight — FOUND
- `840a32e` — feat(15-03b): ship ComposeStep + VisibilitySegmentedControl with D-07 three-handler split — FOUND
- `4fa4c73` — feat(15-03b): swap NavWearButton + WywtRail call sites to WywtPostDialog (D-04) — FOUND

### Re-runs before sign-off:

- `npm run test -- tests/components/WywtPostDialog.test.tsx --run` → 20/20 PASS (~0.3s)
- `npm run test -- --run` (full suite) → 84 files PASS, 2640 tests PASS, 135 skipped
- `npx tsc --noEmit` → 3 pre-existing errors only (no new errors from this plan)
- `npx eslint <all 10 modified src files>` → 0 errors, 0 warnings
- Plan-level greps (WatchPickerDialog in layout, WywtPostDialog coverage, toast in actions, heic2any eager, three-handler grep) → all expected results

## Self-Check: PASSED

---

*Phase: 15-wywt-photo-post-flow*
*Completed: 2026-04-24*
