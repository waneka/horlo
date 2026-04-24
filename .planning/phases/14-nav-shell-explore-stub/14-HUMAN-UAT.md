---
status: diagnosed
phase: 14-nav-shell-explore-stub
source: [14-VERIFICATION.md]
started: 2026-04-23T23:25:00Z
updated: 2026-04-23T23:50:00Z
---

## Current Test

[complete — 2 issues routed to gap closure (14.1)]

## Tests

### 1. iOS safe-area: bottom nav does not overlap the Face ID home indicator
expected: Physical iPhone (Face ID) or iOS Simulator shows the 5-item bottom nav sitting above the home indicator bar; last page element clears the nav; rotating to landscape preserves the clearance.
result: issue — nav bar height should be ~80px (currently 60px) and nav items should be vertically centered rather than bottom-aligned. Landscape behavior pending product decision.

### 2. Zero-FOUC theme boot preserved across nav changes
expected: Chrome incognito load on `npm run build && npm run start` shows no theme flicker on first paint; Safari + Firefox likewise. Dark mode cookie applies before React hydration.
result: passed

### 3. Figma pixel parity of Wear circle elevation (node 1:4714)
expected: Mobile viewport (393px wide) visual matches Figma node 1:4714 at 1x zoom — 56x56 accent circle, extending ~20px above the bar plane, with the two-layer Figma shadow values. Labels in IBM Plex Sans 12/16.
result: covered by #1 — re-verify after height + vertical-centering fix lands.

### 4. Desktop profile dropdown theme row spacing
expected: At a laptop-width desktop browser, the 3-button Light/Dark/System segmented row inside the profile dropdown does not overflow the 64px dropdown width and looks balanced (not cramped).
result: issue — buttons render correctly but clicking Light/Dark/System does not switch the theme. Layout/spacing is fine; click handler or menu-close interception is broken.

### 5. Search form full-page reload (WR-01 from 14-REVIEW.md)
expected: Confirm whether the desktop search form's `window.location.href` behavior is acceptable for the Phase 14 stub. If unacceptable, schedule a quick-fix to swap to `useRouter` before Phase 16 rewrites `/search`.
result: passed — acceptable for the coming-soon stub; Phase 16 will replace.

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 1

## Gaps

### Gap 1 — BottomNav height + vertical centering (links to #1, #3)
source_test: 1
status: open
detail: Raise BottomNav bar from 60px to 80px. Vertically center the 5 nav items (currently `items-end` bottom-aligned). Keep `env(safe-area-inset-bottom)` padding addition. Wear circle's `-translate-y-5` lift may need a re-tune against the new 80px base so the circle still sits ~20px above the bar plane.
open_question: Should the bottom nav remain visible on landscape orientation at `<768px` width? (Current behavior: visible whenever viewport < `md` breakpoint regardless of orientation.)

### Gap 2 — InlineThemeSegmented click handler not toggling theme (links to #4)
source_test: 4
status: open
detail: User reports Light/Dark/System buttons inside profile dropdown render correctly but clicking them does not change the theme. `useTheme().setTheme(value)` is called in onClick but either (a) base-ui `DropdownMenu` intercepts/closes before handler fires, or (b) event target is a descendant of the button and gets lost, or (c) the theme-provider context isn't reaching this node (e.g. rendered in a portal outside ThemeProvider). Fix must confirm theme cookie is written AND `<html class="dark">` flips on click, without closing the menu prematurely. Add a DOM-level interaction test that exercises the click path.
