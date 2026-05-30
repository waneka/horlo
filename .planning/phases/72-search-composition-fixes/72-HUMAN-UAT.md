---
status: partial
phase: 72-search-composition-fixes
source: [72-VERIFICATION.md]
started: 2026-05-30T03:30:00Z
updated: 2026-05-30T04:00:00Z
---

## Current Test

[SRCH-03 follow-up — footer click pre-seeds StructuredEntryPanel BEHIND the still-open combobox popup; visually appears broken to user. One-line fix required (also close popup on click). Bumps Phase 72 to gap-closure.]

## Tests

### 1. Multi-token catalog search returns matching row on prod

expected: Typing "Brut Datejust" (and separately "Timex Weekender") on `/watch/new` in a deployed prod environment returns a catalog row whose brand contains "Brut"/"Timex" and whose model contains "Datejust"/"Weekender". DAL tokenization is unit-tested with a mock; prod verifies the real Postgres ILIKE AND-of-ORs query against the live catalog data.
result: pass

### 2. Combobox keyboard navigation works end-to-end on prod

expected: With 2+ results visible, ArrowDown moves the visible highlight to the first row, ArrowDown again to the second, ArrowUp back to the first, Enter on the highlighted row fires `onPick` (flow advances to confirm screen or owned-redirect — no premature popup close). jsdom tests assert the `data-highlighted` attribute + `onPick` call; prod verifies the Tailwind `data-[highlighted]:bg-accent` CSS renders and Enter-triggered transition reaches AddWatchFlow.handleSearchPick in a real browser.
result: pass

### 3. "Not finding it? Add manually" footer click expands the inline panel on prod

expected: With results visible in the dropdown, clicking the footer button mounts `<StructuredEntryPanel>` inline below the search input with brand/model/reference pre-seeded from the current query. SRCH-03a structural jsdom test proves the button is a sibling of (not child of) the listbox; prod verifies a real browser delivers the click to the handler (the prod bug was specifically that listbox event routing swallowed the click in real browsers).
result: issue — pre-seed works but combobox popup does NOT close, so the inline StructuredEntryPanel mounts behind the still-open popup. To the user it looks like the click did nothing. Footer handler must also close the popup (`setIsPopupOpen(false)`) in addition to `setShowPanel(true)`.

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### SRCH-03-followup — footer click leaves combobox popup open

**Symptom:** Clicking "Not finding it? Add manually" pre-seeds StructuredEntryPanel below the search input, but the combobox popup remains open on top, hiding the panel. To the user, nothing visibly happens.

**Root cause:** `SearchEntry.tsx:329` — `onClick={() => setShowPanel(true)}` only triggers the panel; it does not close the popup. `isPopupOpen` stays true, the popup is z-stacked above the panel.

**Fix (one composite handler):**
```tsx
onClick={() => { setShowPanel(true); setIsPopupOpen(false); }}
```

**Test gap (why jsdom missed this):** SRCH-03b asserts the panel mounts; it never asserted the listbox unmounts. Add `expect(screen.queryByRole('listbox')).not.toBeInTheDocument()` after the click (or new SRCH-03c).

**Phase status:** human_needed → gaps_found. Run `/gsd-plan-phase 72 --gaps` or `/gsd-quick` to close.

debug_session: none (root cause confirmed by inspection)
status: failed
