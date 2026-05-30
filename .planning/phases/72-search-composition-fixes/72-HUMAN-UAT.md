---
status: passed
phase: 72-search-composition-fixes
source: [72-VERIFICATION.md]
started: 2026-05-30T03:30:00Z
updated: 2026-05-30T17:30:00Z
---

## Current Test

[all 3 pass on prod after quick-260530-e55 composite handler fix shipped + UAT re-confirmed]

## Tests

### 1. Multi-token catalog search returns matching row on prod

expected: Typing "Brut Datejust" (and separately "Timex Weekender") on `/watch/new` in a deployed prod environment returns a catalog row whose brand contains "Brut"/"Timex" and whose model contains "Datejust"/"Weekender". DAL tokenization is unit-tested with a mock; prod verifies the real Postgres ILIKE AND-of-ORs query against the live catalog data.
result: pass

### 2. Combobox keyboard navigation works end-to-end on prod

expected: With 2+ results visible, ArrowDown moves the visible highlight to the first row, ArrowDown again to the second, ArrowUp back to the first, Enter on the highlighted row fires `onPick` (flow advances to confirm screen or owned-redirect — no premature popup close). jsdom tests assert the `data-highlighted` attribute + `onPick` call; prod verifies the Tailwind `data-[highlighted]:bg-accent` CSS renders and Enter-triggered transition reaches AddWatchFlow.handleSearchPick in a real browser.
result: pass

### 3. "Not finding it? Add manually" footer click expands the inline panel on prod

expected: With results visible in the dropdown, clicking the footer button mounts `<StructuredEntryPanel>` inline below the search input with brand/model/reference pre-seeded from the current query. SRCH-03a structural jsdom test proves the button is a sibling of (not child of) the listbox; prod verifies a real browser delivers the click to the handler (the prod bug was specifically that listbox event routing swallowed the click in real browsers).
result: pass (after quick-260530-e55 — see Gaps section for fix path). Footer click now collapses the popup AND reveals the inline StructuredEntryPanel with pre-seeded brand/model.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### SRCH-03-followup — footer click leaves combobox popup open [RESOLVED]

**Symptom:** Clicking "Not finding it? Add manually" pre-seeded StructuredEntryPanel below the search input, but the combobox popup remained open on top, hiding the panel. To the user, nothing visibly happened.

**Root cause:** `SearchEntry.tsx:329` — `onClick={() => setShowPanel(true)}` only triggered the panel; it did not close the popup. `isPopupOpen` stayed true, the popup was z-stacked above the panel.

**Fix (one composite handler):**
```tsx
onClick={() => { setShowPanel(true); setIsPopupOpen(false); }}
```

**Test gap addressed:** SRCH-03b extended with `expect(screen.queryByRole('listbox')).not.toBeInTheDocument()` after the click — regression-guards the popup-close behavior.

**Resolution path:** `/gsd-quick` → `260530-e55-srch-03-followup-popup-stay-open-fix` (RED test commit `6070c5cc`, GREEN fix commit `17d5bc0f`, SUMMARY `4441a978`, plan artifact `d9c1d97e`). Prod UAT re-confirmed pass 2026-05-30.

**Durable learning:** [[feedback_test_assert_disappearance_too]] — when a click both mounts a panel AND should dismiss an overlapping popup, assert BOTH directions in jsdom.

debug_session: none (root cause confirmed by inspection; closed via /gsd-quick)
status: resolved
