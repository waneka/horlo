---
status: partial
phase: 72-search-composition-fixes
source: [72-VERIFICATION.md]
started: 2026-05-30T03:30:00Z
updated: 2026-05-30T03:30:00Z
---

## Current Test

[awaiting human testing — bundle with v8.1 phases 73 + 74 before prod deploy]

## Tests

### 1. Multi-token catalog search returns matching row on prod

expected: Typing "Brut Datejust" (and separately "Timex Weekender") on `/watch/new` in a deployed prod environment returns a catalog row whose brand contains "Brut"/"Timex" and whose model contains "Datejust"/"Weekender". DAL tokenization is unit-tested with a mock; prod verifies the real Postgres ILIKE AND-of-ORs query against the live catalog data.
result: [pending]

### 2. Combobox keyboard navigation works end-to-end on prod

expected: With 2+ results visible, ArrowDown moves the visible highlight to the first row, ArrowDown again to the second, ArrowUp back to the first, Enter on the highlighted row fires `onPick` (flow advances to confirm screen or owned-redirect — no premature popup close). jsdom tests assert the `data-highlighted` attribute + `onPick` call; prod verifies the Tailwind `data-[highlighted]:bg-accent` CSS renders and Enter-triggered transition reaches AddWatchFlow.handleSearchPick in a real browser.
result: [pending]

### 3. "Not finding it? Add manually" footer click expands the inline panel on prod

expected: With results visible in the dropdown, clicking the footer button mounts `<StructuredEntryPanel>` inline below the search input with brand/model/reference pre-seeded from the current query. SRCH-03a structural jsdom test proves the button is a sibling of (not child of) the listbox; prod verifies a real browser delivers the click to the handler (the prod bug was specifically that listbox event routing swallowed the click in real browsers).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
