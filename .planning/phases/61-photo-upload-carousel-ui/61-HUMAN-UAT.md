---
status: partial
phase: 61-photo-upload-carousel-ui
source: [61-VERIFICATION.md]
started: 2026-05-26T08:15:00Z
updated: 2026-05-26T08:15:00Z
note: "Regenerated after 61-05/61-06 gap closure re-verification. Supersedes the 2026-05-25 stub. All 9 UAT gaps structurally closed; these 6 items need prod device/flow confirmation on next deploy (push origin main → Vercel)."
---

## Current Test

[walkthrough complete for this pass — 3 pass (t1/t2/t3), 1 issue (t6/gap#9), 2 blocked (t4 by gap#9, t5 by live /w/[ref] 404). Two outstanding code issues: gap #9 (/watch/new photos-step + post-save nav) and /w/[ref] #419 (debug session reopened). Re-run after both fixes land to clear t4 + t5.]

## Tests

### 1. iOS carousel swipe navigation
expected: On prod iPhone, open `/w/[ref]` for a watch with 2+ owner photos and swipe left/right between photos. Tap "Edit photos" and confirm swipe is disabled while Edit mode is active (filmstrip drag takes priority; `reInit({ watchDrag: !editMode })`).
result: pass
verified_on: 8a49a19 (prod www.horlo.app, 2026-05-26)
note: "Swipe nav + edit-mode swipe-disable + full-legibility drop zone all confirmed. ENHANCEMENT raised: with the drop zone now fully legible in Edit mode, the separate '+Add' [+] tile at the end of the filmstrip is redundant — remove it (drop zone becomes the single add affordance). Logged in Gaps."

### 2. Touch drag-reorder on filmstrip (iOS) + enlarged handle
expected: In Edit mode, long-press-drag a thumbnail (handle now has `p-2` enlarged hit area — confirm it grabs reliably). The "Cover" badge moves to the new first thumbnail (and shows ONLY in Edit mode per revised D-07); an "Order updated" toast fires; after navigating to a grid the card thumbnail reflects the new cover.
result: pass
verified_on: f9c7a4b (prod www.horlo.app, 2026-05-26)
note: "Enlarged handle grab, drag-reorder cover move + 'Order updated' toast, edit-mode-only Cover badge (revised D-07), and grid thumbnail update all confirmed."

### 3. OS photo picker (camera-or-library) on mobile
expected: Tapping +Add on the detail page (or the full-width dropzone in the add-watch step) opens the OS picker offering BOTH camera and library (no forced `capture`).
result: pass
verified_on: f9c7a4b (prod www.horlo.app, 2026-05-26)
note: "OS picker offers both camera and library — no forced capture."

### 4. "Skip for now" visual prominence / friction
expected: In the add-watch photos step, "Skip for now" is clearly the secondary, lower-contrast option vs the primary "Add photos"/"Continue" button; friction is sufficient but never blocks saving.
result: blocked
blocked_by: gap-9-step-never-appears
reason: "Cannot assess 'Skip for now' prominence — the 'Add your photos' step never renders (see test 6). Re-test after gap #9 is fixed."

### 5. Router-Cache stale-instance reset on /w/[ref] revisit
expected: Navigate away from `/w/[ref]` and back; Edit mode resets to off, the carousel is usable, and the filmstrip shows no stale drag state (onPointerDown reset, MEMORY `project_router_cache_stale_instance`).
result: unblocked
prior_result: blocked
prior_blocked_by: react-419-404-soft-nav
reason: "UNBLOCKED 2026-05-26 — gap #1 (#419/404 soft-nav) RESOLVED on deploy 5ea4291 (user-approved). /w/[ref] soft-nav now works, so stale-instance reset is testable again. Pending explicit confirmation: navigate away from /w/[ref] in Edit mode and back → Edit mode off, carousel usable, no stale drag state (onPointerDown reset, MEMORY project_router_cache_stale_instance)."

### 6. Gap #9 live flow — "Add your photos" step appears (extract → Add to Collection → save)
expected: Open the add-watch flow FROM a watch detail page (so a real `returnTo` is set), paste a URL, get the fit verdict, click "Add to Collection," and submit the auto-filled form. The prominent "Add your photos" step (WatchPhotoStep) renders BEFORE any navigation — no auto-redirect back to origin, no premature toast "View" navigation.
result: pass
verified_on: 719fef9 (prod www.horlo.app, 2026-05-26)
verified_note: "User: 'the photos step shows up now, redirect works too.' Add to Collection from profile collection → /watch/new → save → 'Add your photos' step renders → Done/Skip redirects to collection. Fix was removing the key={flowKey} remount (commit 6ffd2db). Test 4 ('Skip for now' prominence) now UNBLOCKED — pending explicit visual confirmation on a future pass."
prior_result: issue
reported: "i'm still not seeing the add your photos step when adding a watch"
severity: major
repro_precise: "Entry = clicked 'Add to collection' from the PROFILE COLLECTION page (NOT from a watch detail page, NOT URL extraction). After save: brief 'Saving...' → the watch form CLEARED/reset → user STAYED on /watch/add. No photos step appeared AND no redirect to collection occurred (user expected to land back on their collection)."
note: "RECURRENCE — gap #9 fix (61-06 toast suppression, commit 8aa57c4) did NOT resolve it. The precise repro contradicts the original toast-nav-race hypothesis: there is NO redirect (it stays on /watch/new with a blank form), so the problem is that this path never transitions to photos-pending NOR navigates. Strongly suggests the /watch/new route (reached via 'Add to collection' on the profile collection page) renders a WatchForm that is NOT inside AddWatchFlow's onWatchCreated wiring — so 61-03's photos-pending machine is never engaged, and the form just resets on success."
reconfirmed: "2026-05-26 on deploy f9c7a4b — STILL BROKEN (expected; no gap-#9 fix in this deploy). Entry: 'Add to collection' CTA from the profile COLLECTION page. After save: EMPTY FORM on /watch/new (form reset, stayed on /watch/new, no photos step, no redirect to collection). ROUTE CORRECTION: actual route is /watch/new (not /watch/add as earlier docs stated) — search artifacts accordingly."
why_critical: "Core PHOTO-09 deliverable. Failed prod verification twice. Also a SECONDARY bug surfaced: post-save navigation is broken on this path (stays on /watch/add instead of returning to collection)."

## Summary

total: 6
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 2

## Deploy State (CRITICAL — affects validity of all results above)

- Live production deploy (`www.horlo.app` / `horlo-git-main` alias) was created 2h ago and is at most commit **98e7289**.
- The `git push origin main` of **d5457ed** (today's gap-closure work: 61-05 cosmetic fixes, 61-06 gap #9 toast fix + #419 guard) did **NOT** trigger a Vercel deployment — no build queued/running after the push.
- Therefore the user tested a deploy WITHOUT any of today's gap-closure changes. Tests 1–3 (swipe, drag-reorder, OS picker) validate ONLY the already-deployed base Phase-61 features (61-01..04). The gap #5 edit-mode-only Cover badge and cosmetic gaps #2/#3/#4/#7/#8 were NOT on the tested build and need re-test after d5457ed deploys.
- **RESOLVED 2026-05-26:** auto-deploy did not fire after `git push`; triggered manually via `vercel deploy --prod`. Production (`www.horlo.app`) now serves **67fde76** (HEAD — all gap-closure code + 98e7289 #419 fix + UAT docs). Re-test now valid. (Open follow-up: why the GitHub→Vercel auto-deploy didn't fire on push.)
- **Expectation on re-test:** cosmetic gaps #2/#3/#4/#5/#7/#8 are now live and testable. Gap #9 will STILL fail (deployed fix targeted the wrong mechanism — the /watch/add entry path needs a new fix). The #419/404 is now the decisive test: this build definitely contains the ordering fix, so if 404 persists → genuine recurrence → /gsd-debug.

## Gaps

- truth: "In Edit mode, the photo add affordance is not duplicated — a single, full-legibility drop zone is the only add control (no redundant filmstrip '+Add' tile)"
  status: enhancement
  reason: "User (test 1, 2026-05-26): now that the Edit-mode drop zone renders in full legibility (gap closure from 61-05), the additional [+] '+Add' card at the end of the thumbnail filmstrip is redundant. Remove the filmstrip +Add tile; keep the drop zone as the single add affordance."
  severity: cosmetic
  test: 1
  artifacts: [src/components/watch/WatchPhotoSection.tsx, src/components/watch/SortablePhotoThumb.tsx]
  missing: []
  decision_change: "Edit-mode add UI: drop zone only; remove the filmstrip [+] tile."

- truth: "The thumbnail filmstrip wraps (≈5 per row) instead of a single horizontal-scroll row that overflows"
  status: fix_applied
  reason: "User (round 2, 2026-05-26): the filmstrip needs to wrap after ~5 pics; the single overflow-x-auto row caused big overflow/spacing issues on mobile AND desktop."
  severity: minor
  fix: "WatchPhotoSection: both filmstrips (view + edit) changed from `flex overflow-x-auto ... min-w-0` to `flex flex-wrap gap-2 max-w-sm` (max-w-sm ≈ 384px fits exactly 5×64px thumbs/row, wraps after). Edit-mode dnd switched from horizontalListSortingStrategy → rectSortingStrategy (correct for a wrapped/2D layout)."
  artifacts: [src/components/watch/WatchPhotoSection.tsx]
  missing: []

- truth: "On the watch detail page, a watch whose cover is a raw storage path (catalog/enriched photo) renders the photo, not the WatchIcon placeholder"
  status: fix_applied
  reason: "User (round 2): watches with 'url based' photos (previously in the catalog) render everywhere EXCEPT the detail page, which shows the backup watch icon. New URL-extraction watches render fine. ROOT CAUSE: detail page passed the UNSIGNED watch → catalogFallbackUrl=getSafeImageUrl(rawStoragePath)=null → placeholder; grids signed it via signCoverUrls. URL covers (https) were unaffected (getSafeImageUrl passes them through), which is why URL-extracted watches looked fine."
  severity: major
  fix: "src/app/w/[ref]/page.tsx: sign the cover via signCoverUrls([watch]) in both Branch 1 and the D-06 owned branch before passing to WatchDetail (same helper grids use). Raw storage-path covers become signed https URLs; https URLs pass through unchanged."
  artifacts: [src/app/w/[ref]/page.tsx, src/lib/storage/signCoverUrls.ts]
  missing: []

- truth: "The 'Drop photos here or tap to choose' dropzone renders ONLY in edit mode (never on page load)"
  status: fix_applied
  reason: "User (round 2): the dropzone should only show in edit mode. Worked for watches WITH a hosted photo, but for watches with only a url-based cover (or no photo) it was BACKWARDS — showed on page load and hid in edit mode."
  severity: major
  fix: "WatchPhotoSection: removed the empty-state dropzone (`{!editMode && !hasOwnerPhotos && userId && <PhotoDropzone/>}`) that rendered on page load; gated the filmstrip+dropzone section on `(hasOwnerPhotos || editMode)` so the edit-mode dropzone is reachable for photo-less watches. Toggle button reads 'Add photos' when the watch has no owner photos, 'Edit photos' otherwise."
  artifacts: [src/components/watch/WatchPhotoSection.tsx]
  missing: []

- truth: "Profile (/u/[username]/[tab]) AND watch detail (/w/[ref]) pages load on client-side (soft) navigation without React #419 / 404 (gap #1)"
  status: resolved
  resolved_on: "5ea4291 (prod, 2026-05-26) — user-approved after cache fill ('looks great, approving the 404 fix'). Fix: `await connection()` above the page/layout Suspense opts these routes out of the PPR static shell (+ admin-client signing). See debug/resolved/phase61-404-react-419-soft-nav.md. Was a SHARED, cache-timing cause — not per-route."
  reason: "CONFIRMED on the deployed-with-98e7289 build (67fde76 = horlo-rfkbt86o1, www.horlo.app, 2026-05-26): user-verified BOTH routes 404/#419 on soft (in-app) navigation; hard browser refresh ALWAYS loads them. Consistent (not intermittent). An interim 'profile is fixed' read was a MISREAD (hard load). So NEITHER of 98e7289's ordering fixes resolved it — profile got dynamic-AFTER-cache, watch-detail got dynamic-BEFORE-cache, both still broken. The call-ORDERING theory (P61-BUG-01) is the WRONG root cause. This is recurrence #6 of the #419 family; Phase 61 injected a dynamic cookies API (signCoverUrls/createSupabaseServerClient) into cached/PPR RSCs and broke the soft-nav static shell regardless of order. Needs a STRUCTURAL fix (cf. Phase 52), not reordering."
  severity: blocker
  test: 5
  recurrence: 6
  scope: "BOTH /u/[username]/[tab] AND /w/[ref] (all Phase-61-touched cached routes); also profile-shell-resolver/search/home are at risk"
  next_action: "Hand to /gsd-debug (session phase61-404-react-419-soft-nav, reopened, status investigating). Structural approach: move the cookie-dependent signing OUT of the cached page bodies (separate dynamic Suspense boundary / route handler / non-cookie signing path). Do NOT reorder calls again. Verification is PROD-ONLY (build + static guard pass while the bug is live)."
  artifacts: [src/app/w/[ref]/page.tsx, src/app/u/[username]/[tab]/page.tsx, src/app/u/[username]/profile-shell-resolver.tsx, src/lib/storage/signCoverUrls.ts]
  missing: []

- truth: "After creating a watch in the add-watch flow, a prominent 'Add your photos' step (WatchPhotoStep) appears before navigation (PHOTO-09 / SC5)"
  status: resolved
  resolved_on: "719fef9 (prod, 2026-05-26) — user confirmed: 'the photos step shows up now, redirect works too.' Fix commit 6ffd2db (remove key={flowKey} remount). Secondary post-save-nav bug resolved too (nav now flows through the photos step). Test 4 unblocked."
  reason: "User reported on prod (re-test after first fix): 'i'm still not seeing the add your photos step when adding a watch'. The 61-06 fix (commit 8aa57c4 — suppress success toast when onWatchCreated present) did NOT resolve it. PRECISE REPRO obtained: entry = 'Add to collection' from the PROFILE COLLECTION page; after save the form clears and the user STAYS on /watch/add (no photos step, no redirect to collection). There is NO auto-redirect — contradicting the original toast-nav-race hypothesis."
  severity: major
  test: 6
  recurrence: 2
  prior_fix: "8aa57c4 (toast suppression) — insufficient; targeted the wrong mechanism"
  root_cause: "CONFIRMED 2026-05-26 — NOT the prior hypothesis. AddWatchFlow IS mounted at /watch/new and onWatchCreated IS wired on both WatchForm instances (form-prefill + manual-entry); addWatch returns {success,data:watch} WITH id, so onWatchCreated fires and sets photos-pending. The real cause is a REMOUNT RACE: addWatch() calls revalidatePath('/') + revalidatePath('/u/[username]','layout') on success; a successful Server Action auto-refreshes the route it ran from, so /watch/new's Server Component RE-RAN and minted a NEW crypto.randomUUID() flowKey passed as key={} to <AddWatchFlow>. The changed key unmounted/remounted AddWatchFlow, destroying the just-set photos-pending state before WatchPhotoStep rendered, and resetting the flow to its empty initial state with NO navigation (onWatchCreated returns before router.push). ROUTE is /watch/new (docs previously said /watch/add). This also explains the secondary 'no redirect' bug — navigation only happens via the photos step's Done/Skip, which never got to render. And why the 61-06 toast fix failed — the bug is the remount, not the toast."
  fix: "Removed key={flowKey} (per-render crypto.randomUUID()) from <AddWatchFlow> in src/app/watch/new/page.tsx. React now PRESERVES AddWatchFlow client state across the post-action RSC refresh → photos-pending survives → WatchPhotoStep renders → Done/Skip → router.push(dest=returnTo=collection). FORM-04 reset-on-entry preserved by AddWatchFlow's existing Activity-hide useLayoutEffect cleanup (already resets photos-pending on nav-away). npm run build exits 0. PENDING prod verification of the full add→save→photos-step→redirect flow."
  hypothesis: "PRIMARY: the /watch/add route reached via 'Add to collection' on the profile collection page renders a WatchForm that is NOT wrapped by AddWatchFlow's onWatchCreated wiring (or AddWatchFlow does not engage photos-pending for the manual/non-extract path). 61-03 wired onWatchCreated onto the two in-flow WatchForm instances (form-prefill + manual-entry) INSIDE AddWatchFlow, but the live page that the profile 'Add to collection' CTA navigates to may use a bare WatchForm/page-level create that bypasses the flow entirely. SECONDARY BUG (same path): post-save navigation is broken — on success the form resets and stays on /watch/add instead of routing back to the collection. FIRST: identify exactly what component/route /watch/add renders and how the profile 'Add to collection' button reaches it; confirm whether AddWatchFlow is even mounted there."
  secondary_truth: "After saving a watch from the /watch/add flow, the user is navigated back to their collection (not stranded on a blank /watch/add form)"
  artifacts: [src/app/watch/add, src/components/watch/AddWatchFlow.tsx, src/components/watch/WatchForm.tsx, src/components/watch/flowTypes.ts, src/components/watch/WatchPhotoStep.tsx]
  missing: []
