---
status: partial
phase: 61-photo-upload-carousel-ui
source: [61-VERIFICATION.md]
started: 2026-05-26T08:15:00Z
updated: 2026-05-26T08:15:00Z
note: "Regenerated after 61-05/61-06 gap closure re-verification. Supersedes the 2026-05-25 stub. All 9 UAT gaps structurally closed; these 6 items need prod device/flow confirmation on next deploy (push origin main → Vercel)."
---

## Current Test

[awaiting human testing on prod — push origin main → Vercel, then verify on device]

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
result: [pending]

### 5. Router-Cache stale-instance reset on /w/[ref] revisit
expected: Navigate away from `/w/[ref]` and back; Edit mode resets to off, the carousel is usable, and the filmstrip shows no stale drag state (onPointerDown reset, MEMORY `project_router_cache_stale_instance`).
result: [pending]

### 6. Gap #9 live flow — "Add your photos" step appears (extract → Add to Collection → save)
expected: Open the add-watch flow FROM a watch detail page (so a real `returnTo` is set), paste a URL, get the fit verdict, click "Add to Collection," and submit the auto-filled form. The prominent "Add your photos" step (WatchPhotoStep) renders BEFORE any navigation — no auto-redirect back to origin, no premature toast "View" navigation.
result: [pending]
why_critical: "This is the live path the original UAT reported broken. The 61-06 fix suppresses the success-toast nav race when onWatchCreated is present; the mechanism is sound but the new component test uses returnTo:null, so this exact returnTo-set path needs one prod smoke test to close the uncertainty."

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
