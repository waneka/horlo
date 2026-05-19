---
status: complete
phase: 46-explore-shell-browse-archetypes
source: [46-VERIFICATION.md]
started: 2026-05-19T03:30:00Z
updated: 2026-05-19T04:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Modules hide correctly on /explore — EXPL-02 null-hiding passes visual inspection
expected: When no editorial content exists, HeroModule, CuratedListsRail, and WhereCollectionsGo produce zero visible DOM output; CollectorArchetypes hides when archetype counts are empty; BrowseModule always shows 3 tiles. On live /explore only CollectorArchetypes + BrowseModule render — no empty containers, no padding-only boxes.
result: pass

### 2. A–Z jump nav on /explore/brands scrolls without heading hiding under nav — EXPL-04 UAT
expected: Tapping a letter anchor scrolls the correct letter section into view with `scroll-mt-12` keeping the section heading clear of the sticky nav.
result: pass
note: "EXPL-04 scroll-offset behavior passes. User raised 3 UX refinement requests for the A–Z nav — captured as gaps G1/G2/G3 below."

### 3. All 10 archetype chips resolve to at least one result
expected: Every chip on the /explore Collector Archetypes rail shows count > 0, and navigating to /search?tab=watches&archetype={value} returns at least one watch for each of the 10 primary_archetype values.
result: issue
reported: "'Genre Crosser' and 'Tool Watch Purist' have a count of 0. Clicking an archetype correctly lands on /search with the filter applied, but: (1) clicking back to /explore and clicking a different archetype doesn't apply — the original archetype stays; (2) after removing the archetype filter via X, clicking a new archetype from /explore still doesn't apply — the URL param appears then is removed almost immediately. Refreshing the page fixes both. Also: the /explore 'Collector Archetypes' module should have a subtitle explaining what the section is."
severity: major

### 4. Archetype chip navigates to /search with prefiltered results and editorial header
expected: Clicking a chip on /explore lands on /search?tab=watches&archetype={value} showing watches filtered by that archetype, an archetype editorial header (displayName + description + N watches), and a removable chip above the results that dismisses via the X control.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The /explore/brands A–Z jump nav wraps onto multiple lines responsively (≈2 lines on normal widths, up to 3 on very small screens) with NO horizontal scrolling."
  status: failed
  reason: "User reported during Test 2: dislikes the horizontal-scrollable A–Z container; wants letters to wrap to additional lines as the screen narrows, no horizontal scroll."
  severity: minor
  test: 2
  artifacts: []
  missing: []
- truth: "Clicking an A–Z letter anchor on /explore/brands triggers a smooth ease-in-out scroll to the target section, not an instant hard jump."
  status: failed
  reason: "User reported during Test 2: wants the vertical scroll to the clicked letter's section to be smooth with ease-in-out, instead of a hard jump."
  severity: minor
  test: 2
  artifacts: []
  missing: []
- truth: "The /explore/brands A–Z nav bar stays pinned to the top of the viewport and remains visible while the user scrolls down the brand list."
  status: failed
  reason: "User reported during Test 2: wants the A–Z nav bar sticky to the top of the screen so it is always in view on scroll-down. (Verifier noted brands/page.tsx already declares `sticky top-0` — fix must investigate why it does not stay pinned: clipping ancestor overflow, sticky scope, or global-header offset.)"
  severity: minor
  test: 2
  artifacts: []
  missing: []
- truth: "All 10 Collector Archetypes chips resolve to at least one catalog watch — every chip shows a count > 0 (roadmap SC #4 / EXPL-05, amended to 10 by D-15)."
  status: failed
  reason: "User reported during Test 3: the 'Genre Crosser' (hybrid) and 'Tool Watch Purist' (tool) chips show a count of 0. CONTEXT.md D-15 assumed Phase 44 verified coverage for all 10 archetypes — UAT contradicts that for 2 values. Root cause TBD: either the catalog genuinely has zero hybrid/tool watches (data-coverage gap) or getBrowseArchetypeCounts mis-counts those values."
  severity: major
  test: 3
  artifacts: []
  missing: []
- truth: "Selecting a new archetype chip from /explore applies the new facet on /search via client-side (soft) navigation — without requiring a full page refresh."
  status: failed
  reason: "User reported during Test 3: after a first archetype is applied, navigating back to /explore and clicking a different archetype does not apply the new filter — the original archetype persists. After removing the facet via the X chip, clicking a new archetype shows the URL param briefly then it is stripped almost immediately. A hard refresh fixes both. Likely root cause: useSearchState initializes facet state from URL params only on mount, and its URL-sync effect overwrites the incoming param with stale client state on soft navigation (Next.js client nav does not remount the component)."
  severity: major
  test: 3
  artifacts: []
  missing: []
- truth: "The /explore 'Collector Archetypes' module has a short subtitle that briefly explains what the section is and does."
  status: failed
  reason: "User reported during Test 3: the Collector Archetypes module on /explore should have a subtitle briefly explaining what the section is and does."
  severity: minor
  test: 3
  artifacts: []
  missing: []
