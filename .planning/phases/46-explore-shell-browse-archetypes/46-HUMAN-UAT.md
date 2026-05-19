---
status: partial
phase: 46-explore-shell-browse-archetypes
source: [46-VERIFICATION.md]
started: 2026-05-19T03:30:00Z
updated: 2026-05-19T03:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Modules hide correctly on /explore — EXPL-02 null-hiding passes visual inspection
expected: When no editorial content exists, HeroModule, CuratedListsRail, and WhereCollectionsGo produce zero visible DOM output; CollectorArchetypes hides when archetype counts are empty; BrowseModule always shows 3 tiles. On live /explore only CollectorArchetypes + BrowseModule render — no empty containers, no padding-only boxes.
result: [pending]

### 2. A–Z jump nav on /explore/brands scrolls without heading hiding under nav — EXPL-04 UAT
expected: Tapping a letter anchor scrolls the correct letter section into view with `scroll-mt-12` keeping the section heading clear of the sticky nav.
result: [pending]

### 3. All 10 archetype chips resolve to at least one result
expected: Every chip on the /explore Collector Archetypes rail shows count > 0, and navigating to /search?tab=watches&archetype={value} returns at least one watch for each of the 10 primary_archetype values.
result: [pending]

### 4. Archetype chip navigates to /search with prefiltered results and editorial header
expected: Clicking a chip on /explore lands on /search?tab=watches&archetype={value} showing watches filtered by that archetype, an archetype editorial header (displayName + description + N watches), and a removable chip above the results that dismisses via the X control.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
