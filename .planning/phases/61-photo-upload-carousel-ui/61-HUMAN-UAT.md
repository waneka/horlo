---
status: partial
phase: 61-photo-upload-carousel-ui
source: [61-VERIFICATION.md]
started: 2026-05-26T08:15:00Z
updated: 2026-05-26T08:15:00Z
note: "Regenerated after 61-05/61-06 gap closure re-verification. Supersedes the 2026-05-25 stub. All 9 UAT gaps structurally closed; these 6 items need prod device/flow confirmation on next deploy (push origin main → Vercel)."
---

## Current Test

[PAUSED — 3 pass, 1 issue (gap #9), 2 blocked (gap #9 + #419/404). Blocked on deploy: today's fixes (d5457ed) are not live; the #419/404 must be confirmed against a deployed-with-98e7289 build before concluding. See Deploy State.]

## Tests

### 1. iOS carousel swipe navigation
expected: On prod iPhone, open `/w/[ref]` for a watch with 2+ owner photos and swipe left/right between photos. Tap "Edit photos" and confirm swipe is disabled while Edit mode is active (filmstrip drag takes priority; `reInit({ watchDrag: !editMode })`).
result: [pending]

### 2. Touch drag-reorder on filmstrip (iOS) + enlarged handle
expected: In Edit mode, long-press-drag a thumbnail (handle now has `p-2` enlarged hit area — confirm it grabs reliably). The "Cover" badge moves to the new first thumbnail (and shows ONLY in Edit mode per revised D-07); an "Order updated" toast fires; after navigating to a grid the card thumbnail reflects the new cover.
result: [pending]

### 3. OS photo picker (camera-or-library) on mobile
expected: Tapping +Add on the detail page (or the full-width dropzone in the add-watch step) opens the OS picker offering BOTH camera and library (no forced `capture`).
result: [pending]

### 4. "Skip for now" visual prominence / friction
expected: In the add-watch photos step, "Skip for now" is clearly the secondary, lower-contrast option vs the primary "Add photos"/"Continue" button; friction is sufficient but never blocks saving.
result: blocked
blocked_by: gap-9-step-never-appears
reason: "Cannot assess 'Skip for now' prominence — the 'Add your photos' step never renders (see test 6). Re-test after gap #9 is fixed."

### 5. Router-Cache stale-instance reset on /w/[ref] revisit
expected: Navigate away from `/w/[ref]` and back; Edit mode resets to off, the carousel is usable, and the filmstrip shows no stale drag state (onPointerDown reset, MEMORY `project_router_cache_stale_instance`).
result: blocked
blocked_by: react-419-404-soft-nav
reason: "User reported the #419/404 soft-nav bug (gap #1) is STILL occurring on prod, so navigating to/from /w/[ref] cannot be exercised. Cannot test stale-instance reset until the 404 blocker is confirmed resolved on the live deploy. NOTE: pending confirmation that the user is testing the post-98e7289 deploy (d5457ed) and not the prior deployment (4f9e6b1, predates the fix)."

### 6. Gap #9 live flow — "Add your photos" step appears (extract → Add to Collection → save)
expected: Open the add-watch flow FROM a watch detail page (so a real `returnTo` is set), paste a URL, get the fit verdict, click "Add to Collection," and submit the auto-filled form. The prominent "Add your photos" step (WatchPhotoStep) renders BEFORE any navigation — no auto-redirect back to origin, no premature toast "View" navigation.
result: issue
reported: "i'm still not seeing the add your photos step when adding a watch"
severity: major
repro_precise: "Entry = clicked 'Add to collection' from the PROFILE COLLECTION page (NOT from a watch detail page, NOT URL extraction). After save: brief 'Saving...' → the watch form CLEARED/reset → user STAYED on /watch/add. No photos step appeared AND no redirect to collection occurred (user expected to land back on their collection)."
note: "RECURRENCE — gap #9 fix (61-06 toast suppression, commit 8aa57c4) did NOT resolve it. The precise repro contradicts the original toast-nav-race hypothesis: there is NO redirect (it stays on /watch/add with a blank form), so the problem is that this path never transitions to photos-pending NOR navigates. Strongly suggests the /watch/add route (reached via 'Add to collection' on the profile collection page) renders a WatchForm that is NOT inside AddWatchFlow's onWatchCreated wiring — so 61-03's photos-pending machine is never engaged, and the form just resets on success."
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

- truth: "Profile (/u/[username]/[tab]) AND watch detail (/w/[ref]) pages load on client-side (soft) navigation without React #419 / 404 (gap #1)"
  status: failed
  reason: "CONFIRMED on the deployed-with-98e7289 build (67fde76 = horlo-rfkbt86o1, www.horlo.app, 2026-05-26): user-verified BOTH routes 404/#419 on soft (in-app) navigation; hard browser refresh ALWAYS loads them. Consistent (not intermittent). An interim 'profile is fixed' read was a MISREAD (hard load). So NEITHER of 98e7289's ordering fixes resolved it — profile got dynamic-AFTER-cache, watch-detail got dynamic-BEFORE-cache, both still broken. The call-ORDERING theory (P61-BUG-01) is the WRONG root cause. This is recurrence #6 of the #419 family; Phase 61 injected a dynamic cookies API (signCoverUrls/createSupabaseServerClient) into cached/PPR RSCs and broke the soft-nav static shell regardless of order. Needs a STRUCTURAL fix (cf. Phase 52), not reordering."
  severity: blocker
  test: 5
  recurrence: 6
  scope: "BOTH /u/[username]/[tab] AND /w/[ref] (all Phase-61-touched cached routes); also profile-shell-resolver/search/home are at risk"
  next_action: "Hand to /gsd-debug (session phase61-404-react-419-soft-nav, reopened, status investigating). Structural approach: move the cookie-dependent signing OUT of the cached page bodies (separate dynamic Suspense boundary / route handler / non-cookie signing path). Do NOT reorder calls again. Verification is PROD-ONLY (build + static guard pass while the bug is live)."
  artifacts: [src/app/w/[ref]/page.tsx, src/app/u/[username]/[tab]/page.tsx, src/app/u/[username]/profile-shell-resolver.tsx, src/lib/storage/signCoverUrls.ts]
  missing: []

- truth: "After creating a watch in the add-watch flow, a prominent 'Add your photos' step (WatchPhotoStep) appears before navigation (PHOTO-09 / SC5)"
  status: failed
  reason: "User reported on prod (re-test after first fix): 'i'm still not seeing the add your photos step when adding a watch'. The 61-06 fix (commit 8aa57c4 — suppress success toast when onWatchCreated present) did NOT resolve it. PRECISE REPRO obtained: entry = 'Add to collection' from the PROFILE COLLECTION page; after save the form clears and the user STAYS on /watch/add (no photos step, no redirect to collection). There is NO auto-redirect — contradicting the original toast-nav-race hypothesis."
  severity: major
  test: 6
  recurrence: 2
  prior_fix: "8aa57c4 (toast suppression) — insufficient; targeted the wrong mechanism"
  hypothesis: "PRIMARY: the /watch/add route reached via 'Add to collection' on the profile collection page renders a WatchForm that is NOT wrapped by AddWatchFlow's onWatchCreated wiring (or AddWatchFlow does not engage photos-pending for the manual/non-extract path). 61-03 wired onWatchCreated onto the two in-flow WatchForm instances (form-prefill + manual-entry) INSIDE AddWatchFlow, but the live page that the profile 'Add to collection' CTA navigates to may use a bare WatchForm/page-level create that bypasses the flow entirely. SECONDARY BUG (same path): post-save navigation is broken — on success the form resets and stays on /watch/add instead of routing back to the collection. FIRST: identify exactly what component/route /watch/add renders and how the profile 'Add to collection' button reaches it; confirm whether AddWatchFlow is even mounted there."
  secondary_truth: "After saving a watch from the /watch/add flow, the user is navigated back to their collection (not stranded on a blank /watch/add form)"
  artifacts: [src/app/watch/add, src/components/watch/AddWatchFlow.tsx, src/components/watch/WatchForm.tsx, src/components/watch/flowTypes.ts, src/components/watch/WatchPhotoStep.tsx]
  missing: []
