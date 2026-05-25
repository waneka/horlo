---
status: partial
phase: 61-photo-upload-carousel-ui
source: [61-VERIFICATION.md]
started: 2026-05-25T22:10:00Z
updated: 2026-05-25T22:10:00Z
---

## Current Test

[awaiting human testing on prod — push origin main → Vercel, then verify on device]

## Tests

### 1. Carousel swipe navigation on iOS
expected: On prod iPhone, open `/w/[ref]` for a watch with 2+ owner photos and swipe left/right between photos. Tap "Edit photos" and confirm swipe is disabled while Edit mode is active (filmstrip drag takes priority; `reInit({ watchDrag: !editMode })`).
result: [pending]

### 2. Touch drag-reorder on filmstrip (iOS)
expected: In Edit mode, long-press-drag a thumbnail to a new position; the "Cover" badge moves to the new first thumbnail; an "Order updated" toast fires; after navigating to a grid the card thumbnail reflects the new cover.
result: [pending]

### 3. OS photo picker (camera-or-library) on mobile
expected: Tapping +Add on the detail page (or the dropzone in the add-watch step) opens the OS picker offering BOTH camera and library (no forced `capture`).
result: [pending]

### 4. "Skip for now" visual prominence / friction
expected: In the add-watch photos step, "Skip for now" is clearly the secondary, lower-contrast option vs the primary "Add photos"/"Continue" button; friction is sufficient but never blocks saving.
result: [pending]

### 5. Router-Cache stale-instance reset on /w/[ref] revisit
expected: Navigate away from `/w/[ref]` and back; Edit mode resets to off, the carousel is usable, and the filmstrip shows no stale drag state (onPointerDown reset, MEMORY `project_router_cache_stale_instance`).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
