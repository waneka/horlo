---
status: partial
phase: 18-explore-discovery-surface
source: [18-VERIFICATION.md]
started: 2026-04-28T17:14:00Z
updated: 2026-04-28T17:14:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visit /explore as authenticated user with following=0, wears=0
expected: Sparse-network hero renders with Compass icon-circle, serif h1 'Find collectors who share your taste.', supporting paragraph, 'Browse popular collectors' CTA → /explore/collectors. All three rails (Popular Collectors, Trending, Gaining Traction) render below.
result: [pending]

### 2. Visit /explore as user with following=3 OR wears>=1
expected: Hero is hidden; rails render in order Popular → Trending → Gaining.
result: [pending]

### 3. Visit /explore on a dataset where snapshot table is empty (deploy day)
expected: Gaining Traction rail header still renders with TrendingUp icon; body shows 'Not enough data yet — check back in a few days.'; no See-all link in this rail header.
result: [pending]

### 4. Click 'See all' on Popular Collectors rail
expected: Navigates to /explore/collectors showing up to 50 rows; if at cap, footer 'Showing top 50 collectors.' visible.
result: [pending]

### 5. Click 'See all' on Trending rail
expected: Navigates to /explore/watches showing two stacked sections (Trending + Gaining Traction) in responsive grid (2/3/4 cols); per-section cap footer when at limit.
result: [pending]

### 6. Open mobile viewport, verify BottomNav order
expected: 5 slots in order: Home / Search / Wear / Explore / Profile (Wear is the elevated 56×56 cradle in slot 3); active accent color on current route.
result: [pending]

### 7. Tap Explore slot in BottomNav
expected: Routes to /explore; Explore slot becomes active (text-accent + strokeWidth 2.5); aria-current='page'.
result: [pending]

### 8. Follow a user from Popular Collectors rail, return to /explore
expected: Followed user disappears from rail on next render (RYO via updateTag); rail does NOT show stale data.
result: [pending]

### 9. Add a watch via /watch/new, return to /explore
expected: Trending rail eventually reflects the new owners_count delta (SWR via revalidateTag('explore', 'max')); Popular Collectors rail also re-renders for the actor.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
