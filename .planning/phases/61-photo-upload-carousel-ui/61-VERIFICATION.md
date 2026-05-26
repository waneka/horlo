---
phase: 61-photo-upload-carousel-ui
verified: 2026-05-26T10:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Gap #1: PPR #419/404 soft-nav regression guard (P61-BUG-01 static test) added"
    - "Gap #2: edit-mode dropzone now renders full affordance text (full-width PhotoDropzone below filmstrip, +Add icon tile triggers via id)"
    - "Gap #3: drag-handle hit area enlarged (p-2 padding on GripVertical wrapper)"
    - "Gap #4: position indicator wrapped in w-full max-w-md matching carousel viewport"
    - "Gap #5: Cover badge gated on isCover && editMode in SortablePhotoThumb; view-mode filmstrip in WatchPhotoSection carries no Cover span"
    - "Gap #6: setDeletedIds fires in startTransition at click time (immediate hide); 5s setTimeout contains only deleteWatchPhotoAction"
    - "Gap #7: text-destructive-foreground replaced with text-white on delete button"
    - "Gap #8: min-w-0 added to outer filmstrip container and both filmstrip row divs"
    - "Gap #9 (structural): onWatchCreated ? {} : buildSuccessOpts() suppresses toast/nav race; form-prefill→submit→photos-pending path covered by 3 new component tests"
  gaps_remaining:
    - "Gap #9 (live-path): prod re-verification required — see human_verification item 6"
  regressions: []
human_verification:
  - test: "iOS Carousel Swipe Navigation"
    expected: "Owner can swipe left/right between photos on /w/[ref]; swipe is disabled while Edit mode is active"
    why_human: "embla watchDrag:!editMode toggle is in code but iOS Safari gesture coexistence with dnd-kit TouchSensor requires live device confirmation (MEMORY feedback_mobile_ui_verify_on_prod)"
  - test: "Touch Drag-Reorder on Filmstrip (iOS)"
    expected: "Owner can long-press-drag a thumbnail to a new position; Cover badge moves to new first thumb in edit mode only; Order updated toast fires; grid thumbnail updates after navigation"
    why_human: "dnd-kit TouchSensor (250ms delay, tolerance 8) on iOS Safari requires live confirmation; p-2 enlarged handle is structural but touch grab reliability must be confirmed on device"
  - test: "OS Photo Picker (camera-or-library)"
    expected: "Tapping +Add in edit mode opens OS picker offering both camera and library (no forced capture)"
    why_human: "accept=image/* without capture is in PhotoDropzone code but OS picker presentation depends on mobile browser implementation"
  - test: "Skip for now visual prominence / friction"
    expected: "Skip for now is clearly smaller and lower-contrast than the primary Add photos Button; skip always works"
    why_human: "Visual hierarchy judgment requires human evaluation on device; code confirms plain button.text-muted-foreground vs Button.variant-default but visual weight is design judgment"
  - test: "Stale-Instance Reset on /w/[ref] Revisit"
    expected: "Edit mode resets to off after navigating away and back; carousel is usable without page reload"
    why_human: "Next 16 Router Cache stale-instance behavior only manifests on revisited dynamic URLs in a running session (MEMORY project_router_cache_stale_instance); onPointerDown reset is in code"
  - test: "Gap #9 live flow: Add your photos step appears on extract→Add to Collection→save path"
    expected: "After clicking Add to Collection on the fit-verdict screen and submitting the auto-filled watch form, the prominent Add your photos step renders before any navigation; no auto-redirect occurs"
    why_human: "The 61-06 fix suppresses the Sonner toast action race (empty opts to run() when onWatchCreated is present). The component test proves form-prefill→submit→photos-pending works structurally. However the original UAT symptom was auto-redirect on the live URL-extract→verdict→Add to Collection path. The fix closes the known toast race, but the live path involves returnTo URL params from CatalogPageActions which the component test does not fully exercise with a real returnTo value. Prod re-verification confirms the fix is complete for the actual user journey."
---

# Phase 61: Photo Upload + Carousel UI — Re-Verification Report

**Phase Goal:** A watch owner can upload, view, reorder, and delete photos from the watch detail page; the add-watch flow prominently surfaces photo upload as a first-class step.
**Verified:** 2026-05-26T10:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 61-05 and 61-06 closed 9 UAT gaps)

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | An owner can upload one or more photos to a watch they own and see them appear on the detail page | VERIFIED | Unchanged from initial verification; upload pipeline wired and tested |
| SC2 | Photos display in a one-at-a-time carousel with arrow and swipe navigation | VERIFIED (structural) | Unchanged from initial verification; iOS swipe is human_needed |
| SC3 | An owner can drag-reorder photos; dragging a photo to the first position makes it the card thumbnail across grids | VERIFIED (structural/owner-view) | Unchanged from initial verification; touch drag is human_needed |
| SC4 | An owner can delete an individual photo; the cap affordance is visibly blocked with clear messaging when the ~10-photo limit is reached | VERIFIED | Gap #6 fix confirmed: setDeletedIds fires in startTransition at click time (immediate hide); deleteWatchPhotoAction inside 5s setTimeout only |
| SC5 | The add-watch flow presents a prominent (not buried) photo upload affordance that is not easily skipped | VERIFIED (structural) | Gap #9 structural fix confirmed: onWatchCreated ? {} : buildSuccessOpts() suppresses toast/nav race; 3 new component tests prove form-prefill→submit→photos-pending path; live-path prod re-verification required (see human_needed item 6) |

**Score:** 5/5 truths verified (all gap fixes structurally confirmed; device behaviors and gap #9 live-path remain human_needed)

### Gap Closure Verification

#### Gap #1 — PPR #419 Static Guard

**Structural evidence:**
- `tests/static/ppr-dynamic-before-use-cache.test.ts` exists
- First line is `// @vitest-environment node` (confirmed by grep)
- Asserts P61-BUG-01 ordering rule against both `src/app/u/[username]/[tab]/page.tsx` and `src/app/w/[ref]/page.tsx`
- 3 assertions: ProfileShellResolver before getBatchedWatchCountsCached; getBatchedWatchCountsCached before signCoverUrls; each getLikesForTargetCached preceded by createSupabaseServerClient within 50 lines
- SUMMARY reports 3/3 tests passing against current (fixed) source

**Status:** VERIFIED

#### Gap #2 — Edit-Mode Dropzone Affordance Text Legible

**Structural evidence:**
- `WatchPhotoSection.tsx`: the `+Add` tile (`w-16 h-16` icon-only) triggers via `document.getElementById('photo-dropzone-${watchId}')?.click()` (line 481)
- Full-width `PhotoDropzone` rendered below the filmstrip with `id={'photo-dropzone-${watchId}'}` (line 525), outside any `w-16 h-16` constraint
- `PhotoDropzone.tsx` line 264: `<p className="text-sm text-muted-foreground">Drop photos here or tap to choose</p>` renders at full dropzone width
- `PhotoDropzone` has `id?` prop (line 77) consumed at root `div id={id}` (line 235)

**Status:** VERIFIED (structural; visual legibility is human_needed on prod)

#### Gap #3 — Drag-Handle Hit Area Enlarged

**Structural evidence:**
- `SortablePhotoThumb.tsx` line 151: `className="absolute bottom-0 left-0 p-2 cursor-grab active:cursor-grabbing touch-manipulation"`
- `p-2` adds 8px padding on all sides around the `size-3` (12px) GripVertical, expanding the touch target to ~28px rendered; behavioral ~44px with OS touch expansion
- `{...listeners}` remains on the handle wrapper only (line 150), not on the outer div (Pitfall 3)

**Status:** VERIFIED (structural; mobile grab reliability is human_needed on prod)

#### Gap #4 — Position Indicator Centered on Photo

**Structural evidence:**
- `WatchPhotoSection.tsx`: position indicator wrapped in `<div className="w-full max-w-md">` (line 422)
- Carrier `<p>` has `text-center tabular-nums` (line 425) — now centers within the max-w-md box, not the full parent region
- `max-w-md` count: 3 occurrences (carousel viewport line 338, indicator wrapper div line 422, one inside the position indicator subtree)

**Status:** VERIFIED

#### Gap #5 — Cover Badge Edit-Mode Only (D-07 Revised)

**Structural evidence:**
- `SortablePhotoThumb.tsx` line 121: `{isCover && editMode && (` — badge gated on both conditions
- Comment on line 120: `{/* Cover badge — edit-mode only (D-07 revised 2026-05-25, commit 38b8e1c) */}`
- `WatchPhotoSection.tsx` view-mode filmstrip branch (lines 547-575): plain `<div>` thumbnails with no Cover span — confirmed by grep for `>Cover<` or `<span.*Cover` returning no results in view-mode section
- Comment line 573: `{/* D-07 revised 2026-05-25: no Cover badge in view mode */}`
- `CONTEXT.md` D-07 shows revised wording: "Cover badge on the first filmstrip thumbnail shows ONLY in Edit mode"

**Status:** VERIFIED

#### Gap #6 — Photo Hides Immediately on × Click (Optimistic)

**Structural evidence:**
- `WatchPhotoSection.tsx` lines 262-264: `startTransition(() => { setDeletedIds(photoId) // optimistic hide — immediate })` executes at click time, before any setTimeout
- Lines 291-304: the 5s `setTimeout` contains ONLY `deleteWatchPhotoAction` — no `setDeletedIds` inside
- Undo path (lines 273-285): clears timer (`undoTimerRef`) AND sets `signal.aborted = true` AND fires a no-op `startTransition` to flush `useOptimistic` back to server snapshot
- `undoSignalRef` (line 253) holds the current abort signal across closures

**Status:** VERIFIED

#### Gap #7 — × Glyph Legible Contrast

**Structural evidence:**
- `SortablePhotoThumb.tsx` line 142: `className="absolute top-1 right-1 size-5 bg-destructive text-white ..."`
- `text-white` confirmed present; `text-destructive-foreground` confirmed absent (grep returns 0 matches)

**Status:** VERIFIED

#### Gap #8 — Filmstrip Scrolls Internally Within Column

**Structural evidence:**
- `WatchPhotoSection.tsx` line 438: outer filmstrip wrapper `<div className="min-w-0">` (hasOwnerPhotos wrapper)
- Line 458: edit-mode filmstrip row `className="flex overflow-x-auto gap-2 pb-1 min-w-0"`
- Line 545: view-mode filmstrip row `className="flex overflow-x-auto gap-2 pb-1 min-w-0"`
- `min-w-0` count: 3 occurrences in WatchPhotoSection

**Status:** VERIFIED (structural; visual containment behavior at higher photo counts is human_needed on prod)

#### Gap #9 — Add your photos Step Appears on Extract→Collection Path

**Structural evidence (mechanism verified):**
- `WatchForm.tsx` line 287: `? (onWatchCreated ? {} : buildSuccessOpts(...))` — when `onWatchCreated` is present on a create-mode commit, empty `{}` opts are passed to `run()`
- `useFormFeedback.ts` line 171: `const suppressToast = !callerProvidedMessage && !callerProvidedAction` → with `{}` opts both are undefined → `suppressToast = true` → `toast.success` not called → no Sonner "View" action button with `router.push` exists to race
- `WatchForm.tsx` lines 270-272: `onWatchCreated(result.data.id, dest); return result` — fires callback and returns early before `router.push(dest)` at line 274
- `AddWatchFlow.tsx` line 586: `onWatchCreated={handleWatchCreated}` on the form-prefill WatchForm instance
- `AddWatchFlow.tsx` line 461-462: `handleWatchCreated` sets `setState({ kind: 'photos-pending', ... })`
- `AddWatchFlow.tsx` line 628: `photos-pending` render branch shows `<WatchPhotoStep>`

**Test coverage:**
- `tests/components/add-watch-flow-photos.test.tsx` line 243: drives form-prefill → submit → asserts "Add your photos" renders AND `mockPush` not called
- Line 283: asserts Skip fires `router.push`
- Line 315: asserts `toast.success` not called when onWatchCreated intercepts

**Mechanism assessment for UAT symptom ("never appears, auto-redirects"):**
The 61-06 SUMMARY investigation confirmed `onWatchCreated` WAS correctly wired before this fix. The root cause traced to `buildSuccessOpts` returning a success toast with a "View" action `onClick: () => router.push(href)` when `returnTo` is set (the CatalogPageActions path: `/watch/new?catalogId=X&intent=owned&returnTo=/w/ref`). Clicking this toast button while `WatchPhotoStep` is showing navigates away. The fix (empty opts) prevents the toast from rendering entirely.

**IMPORTANT CAVEAT:** The test uses the deep-link path (initialCatalogId + initialCatalogPrefill skipping the extract step) and does NOT thread an actual `returnTo` value through the test scenario — it relies on `baseFlowProps` which has `initialReturnTo: null`. The fix's effectiveness on the path WITH `returnTo` set is logically sound (empty opts always suppress toast regardless of whether `returnTo` would have generated a "View" action) but this specific scenario is not directly exercised by the new test. The live prod path where the user arrives from `/w/[ref]` via CatalogPageActions with `?returnTo=/w/[ref]` is the variant requiring prod re-verification.

**Status:** VERIFIED (structural + toast-suppression mechanism confirmed); live-path confirmation is human_needed

### Required Artifacts (updated for gap-closure plans)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/SortablePhotoThumb.tsx` | isCover && editMode gate, text-white × glyph, p-2 drag handle | VERIFIED | All three gap fixes confirmed in source |
| `src/components/watch/WatchPhotoSection.tsx` | Immediate optimistic delete, max-w-md indicator, min-w-0 filmstrip, no view-mode Cover span, full-width dropzone pattern | VERIFIED | All five gap fixes confirmed in source |
| `src/components/watch/PhotoDropzone.tsx` | id prop for external trigger, full "Drop photos here or tap to choose" text | VERIFIED | id prop at line 77, full text at line 264 |
| `src/components/watch/WatchForm.tsx` | onWatchCreated ? {} : buildSuccessOpts() toast suppression | VERIFIED | Line 287 confirms conditional |
| `tests/static/ppr-dynamic-before-use-cache.test.ts` | // @vitest-environment node first line; asserts P61-BUG-01 for both PPR routes | VERIFIED | First line confirmed; both routes asserted |
| `tests/components/add-watch-flow-photos.test.tsx` | 3 new gap #9 tests: photos-pending renders, Skip navigates, toast suppressed | VERIFIED | describe block at line 238 with 3 it() cases |

All previously verified artifacts from the initial verification remain in place (unchanged by gap-closure plans).

### Key Link Verification (gap-closure additions)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| WatchPhotoSection +Add tile | PhotoDropzone | `document.getElementById('photo-dropzone-${watchId}')?.click()` | WIRED | Line 481 — icon tile triggers full-width dropzone |
| SortablePhotoThumb editMode | Cover badge render | `isCover && editMode && (` condition | WIRED | Line 121 |
| WatchPhotoSection handleDelete | setDeletedIds (immediate) | `startTransition(() => setDeletedIds(photoId))` at click time | WIRED | Lines 262-264 |
| WatchForm run() | toast suppression | `onWatchCreated ? {} : buildSuccessOpts(...)` opts | WIRED | Line 287 |
| WatchForm run() {} opts | useFormFeedback suppressToast | `!callerProvidedMessage && !callerProvidedAction` → suppressToast=true | WIRED | useFormFeedback.ts line 171 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| P61-BUG-01 PPR ordering guard | `npm test -- ppr-dynamic-before-use-cache` | 3/3 passed (SUMMARY reports) | PASS |
| Gap #9 form-prefill path | `npm test -- add-watch-flow-photos` | 10/10 passed (SUMMARY reports) | PASS |
| WatchPhotoSection (all gap fixes) | `npm test -- watch-photo-section` | 16/16 passed (SUMMARY reports) | PASS |
| Build gate | `npm run build` | exit 0 (confirmed) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PHOTO-02 | Plans 01, 02 | Upload one or more photos to an owned watch | SATISFIED | Unchanged from initial verification; upload pipeline verified |
| PHOTO-03 | Plan 02 | Carousel one-at-a-time, arrows + swipe | SATISFIED (structural) | Unchanged; iOS swipe human_needed |
| PHOTO-05 | Plans 01, 02, 04 | Drag-reorder sets cover/thumbnail | SATISFIED (structural/owner-view) | Unchanged; touch drag human_needed |
| PHOTO-06 | Plans 01, 02, 05 | Delete a photo | SATISFIED | Gap #6 fix: immediate optimistic hide at click time confirmed |
| PHOTO-09 | Plans 03, 06 | Prominent add-watch photo affordance | SATISFIED (structural) | Gap #9 fix: toast suppression wired; form-prefill→photos-pending path tested; live-path prod re-verification required |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (None new in gap-closure plans) | — | — | — | — |

No TBD, FIXME, or XXX debt markers in any gap-closure modified file. Previously noted INFO items from initial verification (WatchPhotoStep Add photos button non-functional at 0-uploads state; search.tsx signCoverUrls viewer-only limitation) are unchanged and remain classified as INFO.

### Human Verification Required

#### 1. iOS Carousel Swipe Navigation

**Test:** On prod iPhone, open `/w/[ref]` for a watch with 2+ owner photos. Swipe left/right between photos. Then tap "Edit photos" and confirm swipe is disabled during edit mode.
**Expected:** Smooth carousel swipe in view mode; swipe does not interfere with filmstrip drag in edit mode.
**Why human:** embla `watchDrag: !editMode` toggle is in code, but iOS Safari gesture coexistence with dnd-kit TouchSensor requires live device confirmation.

#### 2. Touch Drag-Reorder on Filmstrip (iOS)

**Test:** On prod iPhone, tap "Edit photos" on a watch with 2+ photos. Long-press-drag a non-cover thumbnail to the first position. Confirm the Cover badge (which shows ONLY in edit mode after gap #5 fix) moves to it and an "Order updated" toast fires. Navigate to your profile grid and confirm the card thumbnail updates.
**Expected:** Drag succeeds; Cover badge moves to new first position in edit mode; toast fires; grid thumbnails update.
**Why human:** dnd-kit TouchSensor gesture behavior on iOS Safari requires live confirmation; p-2 enlarged handle is structural.

#### 3. OS Photo Picker (Camera-or-Library)

**Test:** On prod iPhone, tap "+Add" in edit mode. Confirm the OS picker offers both camera and library options.
**Expected:** Standard OS picker sheet, both options available; no forced camera.
**Why human:** OS picker presentation depends on mobile browser implementation.

#### 4. "Skip for now" Visual Prominence / Friction

**Test:** On prod mobile, add a watch via URL import, when the "Add your photos" step appears: confirm (a) the heading reads as a first-class step; (b) "Skip for now" is clearly smaller and lower-contrast than the primary "Add photos" Button; (c) skipping works.
**Expected:** Clear visual hierarchy; skip always works.
**Why human:** Visual hierarchy judgment requires human evaluation on device.

#### 5. Stale-Instance Reset on /w/[ref] Revisit

**Test:** On prod mobile, navigate to `/w/[ref]`, enter Edit mode, navigate away, navigate back. Confirm Edit mode resets to off.
**Expected:** Edit mode resets on each visit; no stale drag state.
**Why human:** Next 16 Router Cache stale-instance behavior only manifests on revisited dynamic URLs in a running prod session.

#### 6. Gap #9 Live Flow: "Add your photos" Step on Extract→Collection Path

**Test:** On prod: (a) Paste a watch URL in the add-watch flow, wait for the fit verdict. (b) Click "Add to Collection". (c) Review the auto-filled form and click "Add Watch". (d) Confirm the "Add your photos" step renders before any navigation — NOT a redirect back to the origin page.
**Expected:** After step (c), the "Add your photos" heading appears with the PhotoDropzone. Tapping "Skip for now" navigates to the collection. The page does NOT auto-redirect before the user interacts with the photos step.
**Why human:** The 61-06 fix suppresses the Sonner toast/navigation race via empty opts to `run()` when `onWatchCreated` is present. The component test confirms the structural form-prefill→submit→photos-pending path works and toast is suppressed. The specific live scenario where `returnTo` is set (arriving from `/w/[ref]` via CatalogPageActions) is the path the original UAT hit, and while the fix's logic correctly handles `returnTo` (empty opts always suppress regardless of returnTo), this path with an actual returnTo value is not directly covered by the new test. Prod re-verification closes this uncertainty.

### Re-Verification Summary

**9 gaps closed in plans 61-05 and 61-06:**

- **Gaps #2–#8** (61-05): All 7 cosmetic/behavioral gap fixes confirmed structurally wired in source. Visual/touch behaviors (#3, #4, #8 at scale) remain human_needed on prod per project pattern.
- **Gap #1** (61-06): P61-BUG-01 static guard exists, has `// @vitest-environment node`, asserts ordering rule against both PPR routes, passes against current fixed source.
- **Gap #9** (61-06): Toast-suppression fix structurally wired and tested. The mechanism (empty opts → no Sonner action button → no router.push race) addresses the identified root cause. Prod re-verification required for the live extract→Add to Collection path with `returnTo` set (item 6 above).

All 5 ROADMAP success criteria remain verified at the structural level. The 6 human_needed items are standard device/live-flow verifications per the project pattern (MEMORY `feedback_mobile_ui_verify_on_prod`). No new blockers or structural gaps were introduced by the gap-closure plans.

---

_Verified: 2026-05-26T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure: plans 61-05 (gaps #2–#8) and 61-06 (gaps #1, #9)_
