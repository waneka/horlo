---
phase: 82
plan: "02"
subsystem: brand-picker-ui
tags: [combobox, brand-picker, base-ui, controlled-open, srch-03-lesson, ui-01, ui-02]
dependency_graph:
  requires: [82-01]
  provides: [BrandPicker-component, UI-01-brand-typeahead, UI-02-couldnt-find-affordance]
  affects:
    - src/components/watch/BrandPicker.tsx
    - src/components/watch/BrandPicker.test.tsx
    - src/components/watch/StructuredEntryPanel.tsx
    - src/components/watch/StructuredEntryPanel.test.tsx
tech_stack:
  added: []
  patterns:
    - "@base-ui/react/combobox controlled-open (filter={null} + filteredItems)"
    - "UI-02 affordance as sibling of Combobox.List (SRCH-03 lesson)"
    - "assert-disappearance-too on affordance click"
    - "inputId forwarding for Label association"
key_files:
  created:
    - src/components/watch/BrandPicker.tsx
    - src/components/watch/BrandPicker.test.tsx
  modified:
    - src/components/watch/StructuredEntryPanel.tsx
    - src/components/watch/StructuredEntryPanel.test.tsx
decisions:
  - "D-82-01 implemented: BrandPicker uses @base-ui/react/combobox controlled-open pattern mirroring SearchEntry L207-338"
  - "BrandPicker inputId prop added (Rule 2 auto-add): forwards to Combobox.Input for Label htmlFor association, preserving a11y and existing tests"
  - "StructuredEntryPanel gains selectedBrand state for identity tracking; onChange updates both identity + string; onCouldntFind clears identity, locks typed string"
  - "POST body construction (brand: brand.trim()) is unchanged — picker constrains input, outbound shape identical"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-13"
  tasks_completed: 2
  files_changed: 4
---

# Phase 82 Plan 02: BrandPicker component + StructuredEntryPanel wire-in Summary

**One-liner:** New `BrandPicker` component using `@base-ui/react/combobox` controlled-open pattern with UI-02 "Couldn't find" affordance as sibling of `Combobox.List`, wired into `StructuredEntryPanel` replacing the raw brand `<Input>`.

## What Was Built

### Task 1 — BrandPicker.tsx + BrandPicker.test.tsx (commits `6e983017`)

- New `src/components/watch/BrandPicker.tsx`: ~120-line client component
  - Controlled-open combobox mirroring SearchEntry L207-338 verbatim
  - `filter={null}` + `filteredItems={filteredBrands}` pair (disables base-ui internal match)
  - `onInputValueChange` with `details.reason !== 'input-change'` guard
  - Client-side substring filter via `useMemo` (D-82-02 — zero round-trips)
  - UI-02 affordance placed as SIBLING of `Combobox.List` inside `Combobox.Popup` (SRCH-03 lesson)
  - Affordance gate: `filteredBrands.length === 0 && inputValue.trim().length > 0 && onCouldntFind`
  - Affordance click: calls `onCouldntFind(inputValue.trim())` + `setOpen(false)`
  - Highlighted items: `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground` (NOT bg-primary)
  - Optional `disabled` prop forwarded to `Combobox.Input`
  - Optional `inputId` prop forwarded to `Combobox.Input` for Label association
  - NO `Combobox.Empty` usage (SRCH-03 lesson)
- New `src/components/watch/BrandPicker.test.tsx`: 9 tests
  - (1a/1b) Render + filter: `'ome'` → Omega only; `'xyz'` → zero items + affordance
  - (2) Selection fires `onChange` AND popup closes (assert-disappearance-too)
  - (3) Empty input → no affordance
  - (4) No `onCouldntFind` prop → no affordance (merge dialog use case)
  - (5) THE load-bearing test: affordance click asserts BOTH callback AND popup close
  - (6) Whitespace trim in affordance emit
  - (7) Grep armor: zero `Combobox.Empty` occurrences
  - (8) Grep armor: verbatim D-82-05 copy present

### Task 2 — StructuredEntryPanel wire-in (commit `b00d8015`)

- `src/components/watch/StructuredEntryPanel.tsx`:
  - Added `BrandPicker` import; kept `Input` import for model/reference/year fields
  - Destructures `brandsWithIds` from props (was optional from Plan 01)
  - Added `selectedBrand` state for identity tracking
  - Replaced raw brand `<Input id="se-brand">` with `<BrandPicker>`:
    - `brands={brandsWithIds ?? []}` — threads SSR-fetched list
    - `value={selectedBrand}` — controlled selection
    - `inputId="se-brand"` — preserves Label htmlFor association
    - `onChange`: updates both `selectedBrand` + `brand` string state
    - `onCouldntFind`: clears `selectedBrand`, locks typed value as `brand` string
    - `disabled={isExtracting}` — gates picker during extraction
  - POST body construction (`brand: brand.trim()`) is UNCHANGED
- `src/components/watch/StructuredEntryPanel.test.tsx`:
  - Added BrandPicker mock (transparent test-double with `data-brand-count`, `inputId` forwarding, `onCouldntFind` affordance button)
  - Extended `BASE_PROPS` with `brandsWithIds: []`
  - Added 4 new P82-02 tests: (a) prop threading, (b/c) grep armor, (d) onCouldntFind wiring
  - All 14 existing tests continue to pass

## Verification Results

- `npx vitest run src/components/watch/BrandPicker.test.tsx`: **9 / 9 passed**
- `npx vitest run src/components/watch/StructuredEntryPanel.test.tsx`: **18 / 18 passed**
- `npm run build`: **exit 0** ("Compiled successfully in 5.9s")
- Grep armor:
  - `Combobox.Empty` in BrandPicker.tsx: **0** (correct)
  - D-82-05 copy `Couldn't find that brand...add as`: **1** (correct)
  - `filter={null}` in BrandPicker.tsx: **1** (correct)
  - `data-[highlighted]:bg-accent` in BrandPicker.tsx: **2** (correct)
  - `id="se-brand"` in StructuredEntryPanel.tsx: **0** (correct — raw Input gone)
  - `<BrandPicker` in StructuredEntryPanel.tsx: **1** (correct)
  - `brandsWithIds` in SearchEntry.tsx: **3** (correct — prop drilled)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `inputId` prop to BrandPicker**
- **Found during:** Task 2 implementation
- **Issue:** StructuredEntryPanel's `<Label htmlFor="se-brand">` would have lost its input association when the raw `<Input id="se-brand">` was replaced by BrandPicker. This would break accessibility (label-to-input association) and the existing test (1) that uses `getByLabelText(/Brand/i)`.
- **Fix:** Added optional `inputId?: string` prop to BrandPicker forwarded to `<Combobox.Input id={inputId}>`. StructuredEntryPanel passes `inputId="se-brand"`. This preserves the label association for both a11y and test compatibility.
- **Files modified:** `src/components/watch/BrandPicker.tsx`
- **Commits:** `b00d8015`

## Known Stubs

None. The BrandPicker is fully wired with real brand data from the SSR-fetched `brandsWithIds` prop (Plan 01 provides this from `listBrands()` DAL). No hardcoded empty values or placeholder text in the component logic.

## Threat Flags

No new security-relevant surface introduced. BrandPicker is a pure client component with no network calls. The threat model from the plan is fully addressed:
- T-82-P02-01: Client picker state is UX-only; `/api/extract-watch` is the security surface (Phase 80, unchanged)
- T-82-P02-02: Brand list is public catalog data
- T-82-P02-03: `{inputValue.trim()}` in affordance text is a JSX text node — React auto-escapes, no XSS
- T-82-P02-04: Affordance is sibling of `Combobox.List` (SRCH-03 lesson enforced); grep armor + unit test verify this

## Self-Check: PASSED

- `src/components/watch/BrandPicker.tsx`: EXISTS
- `src/components/watch/BrandPicker.test.tsx`: EXISTS
- `src/components/watch/StructuredEntryPanel.tsx`: MODIFIED (BrandPicker wired)
- `src/components/watch/StructuredEntryPanel.test.tsx`: MODIFIED (4 new tests)
- Commit `6e983017`: EXISTS (feat(82-02): create BrandPicker)
- Commit `b00d8015`: EXISTS (feat(82-02): wire BrandPicker into StructuredEntryPanel)
- `npm run build`: PASSED (exit 0)
- All 27 unit tests: PASSED
