---
status: partial
phase: 14-nav-shell-explore-stub
source: [14-VERIFICATION.md]
started: 2026-04-23T23:25:00Z
updated: 2026-04-23T23:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS safe-area: bottom nav does not overlap the Face ID home indicator
expected: Physical iPhone (Face ID) or iOS Simulator shows the 5-item bottom nav sitting above the home indicator bar; last page element clears the nav; rotating to landscape preserves the clearance.
result: [pending]

### 2. Zero-FOUC theme boot preserved across nav changes
expected: Chrome incognito load on `npm run build && npm run start` shows no theme flicker on first paint; Safari + Firefox likewise. Dark mode cookie applies before React hydration.
result: [pending]

### 3. Figma pixel parity of Wear circle elevation (node 1:4714)
expected: Mobile viewport (393px wide) visual matches Figma node 1:4714 at 1x zoom — 56x56 accent circle, extending ~20px above the bar plane, with the two-layer Figma shadow values. Labels in IBM Plex Sans 12/16.
result: [pending]

### 4. Desktop profile dropdown theme row spacing
expected: At a laptop-width desktop browser, the 3-button Light/Dark/System segmented row inside the profile dropdown does not overflow the 64px dropdown width and looks balanced (not cramped).
result: [pending]

### 5. Search form full-page reload (WR-01 from 14-REVIEW.md)
expected: Confirm whether the desktop search form's `window.location.href` behavior is acceptable for the Phase 14 stub. If unacceptable, schedule a quick-fix to swap to `useRouter` before Phase 16 rewrites `/search`.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
