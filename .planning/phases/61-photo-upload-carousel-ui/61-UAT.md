---
status: complete
phase: 61-photo-upload-carousel-ui
source: [61-01-SUMMARY.md, 61-02-SUMMARY.md, 61-03-SUMMARY.md, 61-04-SUMMARY.md]
started: 2026-05-25T22:30:00Z
updated: 2026-05-25T22:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Upload photos on the detail page
expected: On a watch you own at /w/[ref], tap +Add (mobile OS picker offers camera AND library, no forced capture) or drag-drop onto the desktop drop zone. Selected photos process and appear in the carousel.
result: issue
reported: "Edit-mode drop zone is too small — 'Drop photos here or tap to choose' text doesn't fit; only the camera icon and the word 'Drop' are visible. (Upload functionality itself was not reported as broken.)"
severity: cosmetic
note: "A separate cross-cutting BLOCKER (404 + React #419) was also reported in this response — logged as the first Gap below."

### 2. Carousel viewing (one-at-a-time + swipe/arrows + filmstrip)
expected: Photos show one at a time. Swipe left/right on mobile (or arrows on desktop) moves between them; a position indicator (e.g. "2 / 5") updates. Tapping a thumbnail in the filmstrip jumps the carousel to that photo.
result: pass
note: "Functional pass. Cosmetic: on desktop the position indicator is not horizontally centered on the photo — sits too far right (~2/3 of the width). Logged as a Gap."

### 3. Edit-photos toggle (owner only)
expected: Tapping "Edit photos" shows a × delete badge on each thumbnail, a "+ Add" tile, and drag handles; "Done editing" returns to the clean view. A non-owner viewing the same watch sees none of these controls (and no Edit toggle).
result: pass

### 4. Drag-reorder sets the cover across grids
expected: In Edit mode, drag a photo to the first position. The "Cover" badge moves to it and an "Order updated" toast fires. After navigating to your home/profile grid, that watch's card thumbnail now shows the new cover photo.
result: pass
note: "Reorder result works (cover moves, toast, grid thumbnail updates). Mobile drag-handle grab difficulty tracked separately as a minor Gap."

### 5. Delete a photo (with undo)
expected: In Edit mode, tap × on a photo. It disappears with a "Photo deleted" toast offering "Undo". Tapping Undo restores it; letting the toast lapse (~5s) deletes it permanently. A failed delete restores the photo and shows an error.
result: pass
note: "Delete + undo + lapse-commit all work. Two deviations logged as Gaps: (a) photo does not hide immediately on × — it only hides when the toast closes (~5s); (b) × button is dark-red bg with black icon/font — poor contrast."

### 6. 10-photo cap is visibly blocked
expected: At 10 photos the +Add tile is disabled/hidden with a clear message ("10 photos — at the limit."). Selecting a batch larger than the remaining slots accepts up to the cap and shows a message about the skipped extras (no silent drop).
result: pass
note: "Cap boundary correctly enforced (incl. batch-overflow rejection). Layout Gap logged: on desktop, past ~6 thumbnails the filmstrip overflows and collapses the adjacent right-rail content."

### 7. Catalog fallback slide when no owner photos
expected: A watch you own with zero uploaded photos but a catalog image shows the catalog stock image as the single carousel slide (no "stock"/"catalog" label). After you upload ≥1 photo, the carousel switches to your photos only.
result: pass

### 8. Add-watch "Add your photos" step
expected: Adding a new watch (URL-extract or manual), after the verdict and before final save, presents a prominent "Add your photos" step (big dropzone, not a buried field). The primary CTA is "Add photos"/"Continue"; "Skip for now" is clearly the smaller, lower-contrast option and never blocks saving the watch.
result: issue
reported: "The 'Add your photos' step never appears. After clicking Add to collection from the extract/fit verdict and saving the auto-filled form, the 'Saving...' text shows briefly and then the page redirects back to where I came from — straight past any photos step. (The form's pre-existing 'reference photo' single-image field is NOT the new step.)"
severity: major

### 9. Stale-instance reset on /w/[ref] revisit
expected: Open /w/[ref], toggle Edit mode on, then navigate away and back to the same watch. Edit mode is off, the carousel is usable, and the filmstrip shows no stale drag/edit state.
result: pass

## Summary

total: 9
passed: 7
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Profile pages and watch detail pages load when navigating from profile tabs (collection / wishlist / notes / stats) and from search"
  status: failed
  reason: "User reported: 404s on ALL profile pages AND all watch detail pages when routing from profile collection/wishlist/notes/stats and from search. React minified error #419 in the console. This regression was absent in the previous version — re-introduced during Phase 61. DIAGNOSTIC (test 2): the 404 occurs on client-side (soft) navigation from EVERY source, but a hard browser refresh (full SSR document load) loads the page fine — i.e. the broken client transition aborts the render (#419) on soft-nav while full SSR succeeds. This is the Router Cache / Cache Components soft-navigation signature."
  severity: blocker
  test: cross-cutting
  hypothesis: "Phase 61 wired signCoverUrls (which calls createSupabaseServerClient() — a dynamic cookie/auth API) into cached RSCs: profile-shell-resolver.tsx ('use cache' scope), u/[username]/[tab]/page.tsx, search/page.tsx; plus signed-photo fetch in w/[ref]/page.tsx. A dynamic call inside/across a 'use cache'/PPR boundary triggers React #419 and route failure on soft-nav (full SSR refresh still works). Diff this phase's changes to those 5 RSCs first; the soft-nav-only symptom points hardest at the cached profile-shell-resolver wrapper."
  artifacts: []
  missing: []

- truth: "The edit-mode upload drop zone renders its full affordance text legibly"
  status: failed
  reason: "User reported: in edit mode the 'Drop photos here or tap to choose' slot is too small; the text does not fit — only the camera icon and the word 'Drop' are visible."
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []

- truth: "On mobile, the filmstrip drag handle is large enough to reliably grab for reorder"
  status: failed
  reason: "User reported: on mobile the drag handle within the thumbnail is small and hard to use; it takes a few tries to enter drag mode."
  severity: minor
  test: 4
  artifacts: []
  missing: []

- truth: "The carousel position indicator is horizontally centered on the photo (desktop)"
  status: failed
  reason: "User reported: on desktop the position indicator is not centered — it sits too far right, ~2/3 of the photo width."
  severity: cosmetic
  test: 2
  artifacts: []
  missing: []

- truth: "The 'Cover' badge visibility matches the desired behavior"
  status: failed
  reason: "User wants the 'Cover' badge to show ONLY in edit mode. NOTE: current always-visible behavior is per locked decision D-07 (CONTEXT.md: 'the first filmstrip thumbnail always carries a small Cover badge … persistent'). This is a DECISION CHANGE, not a regression — D-07 should be updated to 'edit-mode only' and the badge gated on editMode in WatchPhotoSection/SortablePhotoThumb."
  severity: minor
  test: 2
  decision_change: "D-07 (Cover badge persistent → edit-mode only) — CONFIRMED by user 2026-05-25; update CONTEXT.md D-07 and gate the badge on editMode in WatchPhotoSection/SortablePhotoThumb during gap closure."
  artifacts: [src/components/watch/SortablePhotoThumb.tsx, src/components/watch/WatchPhotoSection.tsx]
  missing: []

- truth: "Tapping × hides the photo immediately (optimistic), with the undo toast offering restore"
  status: failed
  reason: "User reported: the photo does NOT disappear immediately on × — the toast fires immediately but the photo only hides when the toast closes (~5s). Likely a side effect of the CR-01/WR-02 fix, which moved the optimistic setDeletedIds INTO the 5s setTimeout (alongside the server call) to get useOptimistic auto-revert. Fix: hide immediately on click, keep undo restore, and still revert on server-delete failure."
  severity: minor
  test: 5
  artifacts: [src/components/watch/WatchPhotoSection.tsx]
  missing: []

- truth: "The × delete badge has legible contrast"
  status: failed
  reason: "User reported: the × button is dark red (bg-destructive) with a black icon/font — hard to read. Should use a white/destructive-foreground icon color."
  severity: cosmetic
  test: 5
  artifacts: [src/components/watch/SortablePhotoThumb.tsx]
  missing: []

- truth: "The filmstrip stays within its column and does not collapse adjacent layout at higher photo counts"
  status: failed
  reason: "User reported: on desktop, photos added past ~6 cause the filmstrip to overflow and collapse the content in the right rail next to it. The single-row overflow-x-auto filmstrip is expanding instead of scrolling internally (flexbox min-width:auto gotcha — container needs min-w-0 / max-w-full so overflow-x-auto scrolls within the column). User suggested wrap-to-second-line after 5, or a constrained horizontal scroll (noted scroll feels clunky with drag-and-drop)."
  severity: minor
  test: 6
  artifacts: [src/components/watch/WatchPhotoSection.tsx]
  missing: []

- truth: "After creating a watch in the add-watch flow, a prominent 'Add your photos' step appears before navigation (PHOTO-09 / SC5)"
  status: failed
  reason: "User reported: the 'Add your photos' step NEVER appears. On the extract → fit-verdict → 'Add to collection' → save path, the form saves ('Saving...') then router.push redirects straight back to the origin, bypassing the photos step entirely. The onWatchCreated interception is not taking effect on this path — it falls through to the default navigation."
  severity: major
  test: 8
  hypothesis: "The extract→'Add to collection'→prefilled-form→save path is not invoking AddWatchFlow.handleWatchCreated (onWatchCreated). Possible causes: (a) the 'Add to collection' CTA / fit-verdict path creates the watch via a different code path (direct add action or a WatchForm instance NOT receiving onWatchCreated), bypassing the photos-pending transition; (b) onWatchCreated is wired but the create handler still calls router.push instead of deferring to the callback; (c) photos-pending transitions but immediately falls through. Verifier confirmed onWatchCreated on both form instances structurally — so the live extract→add-to-collection trigger likely doesn't route through those instances. Trace the fit/verdict 'Add to collection' CTA → which WatchForm/create handler fires → confirm onWatchCreated is called before router.push."
  artifacts: [src/components/watch/AddWatchFlow.tsx, src/components/watch/WatchForm.tsx, src/components/watch/flowTypes.ts]
  missing: []
