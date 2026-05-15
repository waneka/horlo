---
status: complete
phase: 40-search-verdict-polish
source: [40-01-SUMMARY.md, 40-02-SUMMARY.md, 40-03-SUMMARY.md, 40-04-SUMMARY.md, 40-05-SUMMARY.md, 40-06-SUMMARY.md, 40-07-SUMMARY.md]
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Filter button on Watches tab
expected: On /search Watches tab with a query typed, a "Filter" button appears inline above the results (scrolls with page, not sticky). Reads "Filter" with no facets active.
result: pass

### 2. Bottom-sheet opens with 3 chip groups
expected: Clicking "Filter" opens a bottom-sheet (slides up from the bottom edge) with three chip groups — Movement Type (auto / manual / quartz / spring drive), Case Size (5 bands: <36mm / 36–39mm / 40–42mm / 43–45mm / 46mm+), and Style (up to 8 chips). Footer has a "Clear all" affordance. Same sheet on mobile and desktop.
result: pass

### 3. Chip tap filters instantly with active-count badge
expected: Tapping a chip immediately narrows the result list behind the sheet — no "Apply" button, no full page reload. The Filter button label updates to show the active count, e.g. "Filter (1)" → "Filter (3)". Each selected Style chip counts individually toward the badge.
result: pass

### 4. URL round-trip and share-link
expected: Selecting facets updates the URL with params like `?q=sub&movement=auto&size=40-42&style=tool,diver` (ASCII-safe band values: lt36 / 46plus). Copying the URL and opening it in a new tab restores the same query, facets, and results. Browser back/forward steps through facet states.
result: pass

### 5. Browse mode — facets work with empty query
expected: Clear the search box so the query is empty, then select a facet chip. Results still appear (the 2-char minimum is lifted while a facet is active). With an empty query AND zero results, the empty-state reads "No watches match these filters. Try removing one." With an empty query and no facets, the original pre-query prompt is shown instead.
result: pass

### 6. FIT-05 pairwise compare table in CollectionFitCard
expected: On a watch's verdict where you own at least one watch, the CollectionFitCard shows a "Compare with the [Brand Model] you own" section below the most-similar list. It is a 2-column table comparing 6 taste dimensions (Formality, Sportiness, Heritage, Archetype, Era, Design Motifs) with a single plain-language delta phrase at the bottom (e.g. "This is more formal" or "Very similar across all taste dimensions").
result: pass

### 7. FIT-05 confidence gate hides cleanly
expected: For a watch where either the candidate or the closest-owned watch has missing or low-confidence taste data, the entire compare section is absent — not an empty box or skeleton. The rest of CollectionFitCard (headline, most-similar list, role overlap) still renders normally.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
