---
status: resolved
phase: 14-nav-shell-explore-stub
source: [14-VERIFICATION.md]
started: 2026-04-23T23:25:00Z
updated: 2026-04-23T22:43:00Z
---

## Current Test

[complete — all 5 items resolved, user approved]

## Tests

### 1. iOS safe-area: bottom nav does not overlap the Face ID home indicator
expected: Physical iPhone (Face ID) or iOS Simulator shows the 5-item bottom nav sitting above the home indicator bar; last page element clears the nav; rotating to landscape preserves the clearance.
result: passed — bar height raised to 80px; each column uses `justify-end gap-1 pb-4` so icons sit 4px above labels and labels share a bottom baseline. `pb-[env(safe-area-inset-bottom)]` preserved. Landscape behavior unchanged per product decision (visible <768px regardless of orientation).

### 2. Zero-FOUC theme boot preserved across nav changes
expected: Chrome incognito load on `npm run build && npm run start` shows no theme flicker on first paint; Safari + Firefox likewise. Dark mode cookie applies before React hydration.
result: passed

### 3. Figma pixel parity of Wear circle elevation (node 1:4714)
expected: Mobile viewport (393px wide) visual matches Figma node 1:4714 at 1x zoom — 56x56 accent circle, extending ~20px above the bar plane, with the two-layer Figma shadow values. Labels in IBM Plex Sans 12/16.
result: passed — 56x56 circle with `shrink-0` stays a true square; column's 92px content in 80px bar creates a 12px natural overflow above the bar top (cradle lift) without needing a transform. Two-layer Figma shadow intact.

### 4. Desktop profile dropdown theme row spacing / click behavior
expected: At a laptop-width desktop browser, the 3-button Light/Dark/System segmented row inside the profile dropdown does not overflow the 64px dropdown width, is balanced, and clicks switch the theme.
result: passed — `onPointerDown`/`onPointerUp` stopPropagation guards on each segment button prevent base-ui Menu's Floating UI useDismiss from tearing down the Popup before onClick fires; theme cookie writes and `<html class="dark">` flips on click.

### 5. Search form full-page reload (WR-01 from 14-REVIEW.md)
expected: Confirm whether the desktop search form's `window.location.href` behavior is acceptable for the Phase 14 stub. If unacceptable, schedule a quick-fix to swap to `useRouter` before Phase 16 rewrites `/search`.
result: passed — acceptable for the coming-soon stub; Phase 16 will replace.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### Gap 1 — BottomNav height + label alignment + cradle (links to #1, #3)
source_test: 1
status: resolved
detail: Fixed inline in commits f06117e, bb8bd60, 9aa5922, 20e7645. Final geometry: 80px bar, `justify-end gap-1 pb-4` columns, 56×56 `shrink-0` Wear circle with 12px natural overflow as the cradle lift. 3 new geometry-lock tests added.

### Gap 2 — InlineThemeSegmented click handler (links to #4)
source_test: 4
status: resolved
detail: Fixed inline in commit f06117e. Added `onPointerDown`/`onPointerUp` stopPropagation guards + `onClick` stopPropagation so base-ui Menu's useDismiss can't pre-empt the synthetic click. 2 new regression-lock tests added.
