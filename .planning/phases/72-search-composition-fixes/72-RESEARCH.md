# Phase 72: Search Composition Fixes - Research

**Researched:** 2026-05-29
**Domain:** base-ui Combobox 1.3.0 keyboard composition, Drizzle ORM multi-token ILIKE, RTL+userEvent keyboard testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SRCH-01 — multi-token search fix**
- D-01: DAL fix only. No catalog row edits in this phase.
- D-02: Tokenize + AND-of-ORs over ILIKE. Each token must hit `(brand_normalized ILIKE %token% OR model_normalized ILIKE %token% OR reference_normalized ILIKE %token%)`. Existing `queryNormalized` lane and `exactRefOrderTier` stay intact.
- D-03: Whitespace split `qTrimmed.split(/\s+/).filter(Boolean)`. No quote handling, no per-token min-length floor beyond the existing `SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return.
- D-04: Drizzle parameterized template binds for every per-token pattern. NEVER string-concat into SQL text (T-67-02-01 mitigation).

**SRCH-02 — combobox keyboard navigation fix**
- D-05: SC minimum — Up/Down arrows, Enter on active option, Tab/Escape exit. Nothing else tested.
- D-06: Research base-ui docs FIRST, then fix. (Completed — see findings below.)
- D-07: Single targeted code change. Do NOT layer speculative fixes simultaneously.

**SRCH-03 — footer click fix**
- D-08: Move footer `<button>` OUTSIDE `<Combobox.List>` but INSIDE `<Combobox.Popup>` as a sibling of List.
- D-09: Keep `onClick={() => setShowPanel(true)}` exactly as-is. Handler was always correct.
- D-10: Footer NOT in keyboard arrow-nav loop. Tab from input reaches footer. Arrow keys traverse Items only.

**Regression tests**
- D-11: Per-defect tests at their natural level. SRCH-01 = Vitest unit on `searchCatalogForAddFlow` (DAL mock pattern). SRCH-02 = RTL+userEvent keyboard test in SearchEntry.test.tsx. SRCH-03 = RTL footer-click test in SearchEntry.test.tsx.
- D-12: No new test-runner config. Existing jsdom default env. No `// @vitest-environment node` pragma needed.

### Claude's Discretion

- `searchCatalogForAddFlow` empty-token-list defensive guard
- Per-token pattern variable naming (`tokenPatterns: string[]` or inline)
- `Combobox.Item` value shape fix — planner picks minimal-surface variant after research (see SRCH-02 root cause below)
- Footer button styling after relocation — keep font-semibold (NOT font-medium)
- DAL test seed strategy — use existing `catalog-facets.test.ts` mock pattern or ad-hoc `beforeEach` inserts

### Deferred Ideas (OUT OF SCOPE)

- Catalog row cleanup sweep (noisy rows like "TIMEX Weekender 38mm...")
- Postgres tsvector + GIN migration
- `/search` page DAL multi-token parity (`searchCatalogWatches`)
- SRCH-02 full WAI-ARIA combobox contract (Home/End/PageUp/PageDown/typeahead)
- SRCH-03 keyboard-nav reach for the footer
- Shared search-tokenizer helper
- `useTypeaheadSearch(query, action)` shared hook
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Multi-token brand+model queries return matching catalog rows | DAL WHERE clause rewrite: AND-of-OR-groups per token using existing `and()`+`or()`+`ilike()` Drizzle builders |
| SRCH-02 | Keyboard Up/Down/Enter navigation works in the combobox | Root cause confirmed: missing `isItemEqualToValue` prop; full mechanism documented below |
| SRCH-03 | "Not finding it?" footer click mounts StructuredEntryPanel | Root cause confirmed: footer inside `<Combobox.List>` swallows pointer events; fix = sibling relocation |
</phase_requirements>

---

## Summary

Phase 72 closes three discrete defects in the SearchEntry combobox surface. All three root causes are confirmed through direct inspection of base-ui 1.3.0 source code (`node_modules/@base-ui/react/combobox/`) and Drizzle ORM usage patterns already present in the codebase.

**SRCH-01** is a straightforward DAL WHERE clause change. The existing single-token `or(ilike(brand, pattern), ilike(model, pattern), ilike(ref, pattern))` correctly matches each column, but a multi-token query like "Brut Datejust" has no single column that contains the whole string. The fix is to split the query on whitespace and AND-compose one OR-group per token. Drizzle's `and(...arr)` and `or(...)` builders support this without any schema change.

**SRCH-02** root cause is confirmed: `<Combobox.Root>` is missing `isItemEqualToValue`. The `ComboboxRoot` wrapper always sets `selectionMode = 'single'` (never `'none'`). With object-valued `value={r}` and the default `Object.is` comparator, `selectedIndex` is always `-1` (objects never reference-equal across renders). This cascades to floating-ui's `useListNavigation` receiving `selectedIndex = null` on every popup open, which prevents `focusItemOnOpen` from auto-highlighting an item. Additionally, the `shouldFillInput` path fires on item selection (since `inputInsidePopup = false`), which interacts unexpectedly with the controlled `inputValue`. Adding `isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}` is the single targeted fix per D-07.

**SRCH-03** root cause is structural: the footer `<button>` is a child of `<Combobox.List>`, which renders as a listbox. The listbox only routes interaction events to `<Combobox.Item>` children; a plain `<button>` inside the listbox receives no native click dispatching from base-ui's event delegation. Moving the button OUTSIDE `<Combobox.List>` (but inside `<Combobox.Popup>`) as a sibling restores normal browser click semantics.

**Primary recommendation:** Fix in order SRCH-03 (one-line relocation) → SRCH-01 (DAL rewrite, 10 lines) → SRCH-02 (one prop addition after verifying `isItemEqualToValue` resolves keyboard nav). Each fix has its own regression test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-token catalog search | API / Backend (DAL) | — | `searchCatalogForAddFlow` is a Server Action DAL; WHERE clause runs in Postgres |
| Combobox keyboard navigation | Browser / Client | — | `SearchEntry` is a `'use client'` component; base-ui is a client-side primitive |
| Footer click handler | Browser / Client | — | `setShowPanel` is a client-side state mutation; no server involvement |
| Regression test (SRCH-01) | API / Backend (unit) | — | Mocks `@/db`; exercises DAL function directly via `src/data/__tests__/` pattern |
| Regression test (SRCH-02 + SRCH-03) | Browser / Client (RTL) | — | RTL + jsdom exercises the component tree; co-located in `SearchEntry.test.tsx` |

---

## Standard Stack

### Core (already present — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` | `^1.3.0` | Combobox primitive (Root, Input, Portal, Positioner, Popup, List, Item) | Project-locked in Phase 69 D-01; no change |
| `drizzle-orm` | (project version) | `and()`, `or()`, `ilike()` builders for SRCH-01 WHERE clause | Already imported at `catalog.ts:8` |
| `@testing-library/react` | `^16.3.2` | RTL `render`, `screen`, `act`, `waitFor`, `fireEvent` | Project test standard |
| `@testing-library/user-event` | `^14.6.1` | `userEvent.setup()` + `userEvent.keyboard('{ArrowDown}')` for SRCH-02 keyboard test | Confirmed in `tests/setup.tsx`; used in `ConfirmStep.test.tsx` for `{ArrowRight}` arrow-key tests |

**No new installations required.** All libraries are already in `package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
User types query
      |
      v
SearchEntry (client) --debounce 250ms--> searchCatalogForAddFlow (Server Action)
                                                  |
                                                  v
                                         catalog.ts DAL
                                         ┌──────────────────────────────────────┐
                                         │ tokens = qTrimmed.split(/\s+/)       │
                                         │ WHERE AND(                            │
                                         │   OR(brand ILIKE %t1%, model, ref)   │
                                         │   OR(brand ILIKE %t2%, model, ref)   │
                                         │   ...                                 │
                                         │ )                                     │
                                         │ ORDER BY exactRef DESC, popularity   │
                                         └──────────────────────────────────────┘
                                                  |
                                                  v
                                         SearchCatalogWatchResult[]
                                                  |
                                                  v
SearchEntry renders results in <Combobox.Root>
      ├── <Combobox.Input> (outside portal — input field)
      └── <Combobox.Portal>
            └── <Combobox.Positioner>
                  └── <Combobox.Popup>
                        ├── <Combobox.List> (listbox)
                        │     └── <Combobox.Item index={i} value={r}> × N
                        └── <button "Not finding it?"> ← SIBLING of List (post-fix)
                                    |
                                    v
                              setShowPanel(true)
                                    |
                                    v
                        StructuredEntryPanel (inline, below input)
```

### Recommended Project Structure

No structural changes. Modifications are confined to:
```
src/
├── data/
│   ├── catalog.ts                    # SRCH-01: searchCatalogForAddFlow WHERE clause
│   └── __tests__/
│       └── catalog-search-tokens.test.ts  # NEW: SRCH-01 regression test
└── components/
    └── watch/
        ├── SearchEntry.tsx           # SRCH-02 + SRCH-03: prop addition + relocation
        └── SearchEntry.test.tsx      # SRCH-02 + SRCH-03: keyboard + footer-click tests
```

The DAL test file name is Claude's discretion (D-11). `catalog-search-tokens.test.ts` is a natural co-location with the existing `__tests__/catalog-facets.test.ts`.

---

## SRCH-01: DAL Multi-Token Pattern

### Root Cause (VERIFIED)

`src/data/catalog.ts:554-588` builds:
```ts
const pattern = `%${lowerQ}%`
// ...
.where(
  or(
    ilike(watchesCatalog.brandNormalized, pattern),
    ilike(watchesCatalog.modelNormalized, pattern),
    queryNormalized.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${queryNormalized}%`)
      : sql`false`,
  ),
)
```

For `q = "Brut Datejust"`, `pattern = "%brut datejust%"`. No single column contains "brut datejust" as a substring → WHERE-OR returns zero rows.

### Fix Pattern

```typescript
// Source: src/data/catalog.ts — SRCH-01 fix (D-02 + D-03 + D-04)
const qTrimmed = q.trim()
if (qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN) return []

const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)
// Defensive: impossible after early-return above, but belt-and-suspenders per Claude's Discretion
if (tokens.length === 0) return []

const queryNormalized = qTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
const exactRefOrderTier =
  queryNormalized.length > 0
    ? sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST`
    : sql`false DESC NULLS LAST`

// D-02: AND-of-ORs — each token must hit at least one of the three columns.
// D-04: pattern construction in TS; string bound via Drizzle parameterized bind.
const tokenClauses = tokens.map((token) => {
  const p = `%${token}%`
  return or(
    ilike(watchesCatalog.brandNormalized, p),
    ilike(watchesCatalog.modelNormalized, p),
    queryNormalized.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${token.replace(/[^a-z0-9]+/g, '')}%`)
      : sql`false`,
  )
})

const candidates = await db
  .select({ ... })
  .from(watchesCatalog)
  .where(and(...tokenClauses))
  .orderBy(exactRefOrderTier, ...)
  .limit(SEARCH_ADD_FLOW_CANDIDATE_CAP)
```

**Note on reference branch:** Each per-token reference pattern should also normalize the token (strip non-alphanumeric) to match `referenceNormalized`'s format. The original code used `queryNormalized` for the reference column — the per-token equivalent is `token.replace(/[^a-z0-9]+/g, '')`. Planner discretion on whether to inline or extract to a helper.

**Security:** All `p` values are TypeScript strings bound via `ilike(column, p)` — Drizzle generates parameterized placeholders, never string-interpolated SQL. Maintains T-67-02-01 mitigation. [VERIFIED: source inspection of `catalog.ts:8` imports + DAL docstring at line 537-540]

### Test Cases (from D-11 + CONTEXT.md §Specific Ideas)

| Input | Expected | Purpose |
|-------|----------|---------|
| `"Brut"` | Row with brand="Brut" | Single-token regression (must not break) |
| `"Timex"` | Row with brand="Timex" | Single-token regression |
| `"Brut Datejust"` | Row with brand="Brut", model contains "Datejust" | Primary failing case (SRCH-01) |
| `"Timex Weekender"` | Row with brand="Timex", model contains "Weekender" | Primary failing case (SRCH-01) |
| `"Datejust Brut"` | Same row as "Brut Datejust" | Token-order invariance (AND is commutative) |

---

## SRCH-02: Combobox Keyboard Navigation — Root Cause Analysis

### Confirmed Root Cause [VERIFIED: source inspection of `node_modules/@base-ui/react/combobox/`]

**Finding 1: `ComboboxRoot` always sets `selectionMode = 'single'`**

From `ComboboxRoot.js`:
```js
function ComboboxRoot(props) {
  const { multiple = false, defaultValue, value, onValueChange, ... } = props;
  return <AriaCombobox
    ...
    selectionMode: multiple ? 'multiple' : 'single'   // ← always 'single'
    selectedValue: value
    onSelectedValueChange: onValueChange
  />;
}
```

`multiple` defaults to `false`, so `selectionMode` is always `'single'`. The current SearchEntry composition correctly passes `onValueChange` but omits `isItemEqualToValue`.

**Finding 2: Default `isItemEqualToValue = Object.is` fails for object values**

From `utils/itemEquality.js`:
```js
const defaultItemEquality = (itemValue, selectedValue) => Object.is(itemValue, selectedValue);
```

Each call to `searchCatalogForAddFlow` returns fresh result objects. After selecting an item (`selectedValue = r`), on the next query change, `findItemIndex(registry, selectedValue, Object.is)` always returns `-1` because the new result objects never reference-equal the stored selection. This yields `selectedIndex = null` always.

**Finding 3: `focusItemOnOpen` in floating-ui depends on `queryChangedAfterOpen`**

From `AriaCombobox.js:832`:
```js
focusItemOnOpen: queryChangedAfterOpen || selectionMode === 'none' && !autoHighlightMode ? false : 'auto',
```

With `selectionMode = 'single'` (not `'none'`), this simplifies to:
`queryChangedAfterOpen ? false : 'auto'`

After the user types any character while the popup is open (which happens on every search), `queryChangedAfterOpen = true` → `focusItemOnOpen = false`. This means no item is auto-focused on popup open; `indexRef.current` starts at `-1`. ArrowDown from `-1` should still navigate to index `0` — but only if `listRef.current[0]` is properly populated.

**Finding 4: `listRef.current` population via item self-registration**

When `items` prop is NOT provided (SearchEntry only passes `filteredItems`), `listRef.current` is populated by each `<Combobox.Item>`'s `useIsoLayoutEffect`. This effect runs because `indexProp = i` (not null) satisfies `shouldRun = hasRegistered && (virtualized || indexProp != null)`. So DOM elements ARE registered in `listRef.current` when items render.

**Finding 5: v1.3.0 CHANGELOG entry for `#4235`**

CHANGELOG entry: "Preserve inline input on Enter when nothing is highlighted (#4235) by @atomiks"

With `activeIndex = null` (nothing highlighted), Enter now "preserves inline input" and calls `store.state.setOpen(false, ...)` rather than firing selection. This is exactly the user's symptom: "Enter closes the popup without firing `onPick`." The `#4235` fix is correct behavior when `activeIndex = null` — the real bug is WHY `activeIndex` stays null after ArrowDown.

**Finding 6: The `shouldFillInput` path with `selectionMode = 'single'` and input outside popup**

From `AriaCombobox.js:493`:
```js
const shouldFillInput = selectionMode === 'none' && popupRef.current && fillInputOnItemPress
  || single && !store.state.inputInsidePopup;
```

With `selectionMode = 'single'` and `inputInsidePopup = false` (input is outside the portal), `shouldFillInput = true`. On item selection, base-ui calls `setInputValue(stringifyAsLabel(r, itemToStringLabel), reason=itemPress)`. SearchEntry's `onInputValueChange` filters `reason !== 'input-change'` and ignores it. But base-ui's internal state is updated, and the `setQueryChangedAfterOpen(true)` path fires for input changes, causing the `focusItemOnOpen = false` condition to persist across open/close cycles.

### Confirmed Fix [CITED: base-ui.com/react/components/combobox]

Add `isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}` to `<Combobox.Root>`:

```tsx
// Source: base-ui.com/react/components/combobox — isItemEqualToValue prop
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val, details) => { ... }}
  filteredItems={results}
  filter={null}
  itemToStringLabel={(r) => `${r.brand} ${r.model}`}
  itemToStringValue={(r) => r.catalogId}
  isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}   // ← ADD THIS
  onValueChange={(picked) => { if (picked) onPick(picked) }}
  open={isPopupOpen}
  onOpenChange={(next) => setIsPopupOpen(next)}
>
```

This allows base-ui to:
1. Correctly compute `selectedIndex` when the same catalog row appears in successive result sets (avoids permanent `selectedIndex = null`)
2. Correctly apply `focusItemOnOpen` behavior based on the actual selected state
3. Avoid the `isCurrentlySelected` mismatch in `handleSelection`

Per D-07: this is a single prop addition. If keyboard navigation is still broken after adding this prop (verified by running the SRCH-02 test), investigate Finding 3 and 6 before adding any further changes.

### jsdom Testing Gotchas for SRCH-02 [VERIFIED: tests/setup.tsx inspection]

- **PointerEvent polyfill**: Already present in `tests/setup.tsx`. base-ui dispatches `new PointerEvent` internally; the polyfill extends MouseEvent. ArrowDown tests use `userEvent.keyboard`, not pointer events, so this is complementary.
- **`userEvent.setup()` pattern**: Use `const user = userEvent.setup()` then `await user.keyboard('{ArrowDown}')`. Do NOT use `userEvent.keyboard(...)` static method in tests that need fake timers (the setup instance properly handles timer interactions). Confirmed pattern from `ConfirmStep.test.tsx:186`.
- **Focus before keyboard**: The combobox input must be focused before `userEvent.keyboard` fires. Either `user.click(input)` to focus, or `input.focus()` + `fireEvent.focus(input)`.
- **`vi.useFakeTimers()` + `userEvent`**: Do NOT use fake timers for SRCH-02 keyboard tests. The keyboard navigation path in base-ui does not go through debounce timeouts. Use real timers for keyboard tests. The SRCH-01 DAL test also doesn't need fake timers (no debounce in the DAL function itself).
- **jsdom CSS visibility**: `getComputedStyle(element).display` in jsdom returns `''` (not `'none'`), so `isElementVisible` returns true for all rendered elements. Items will not be incorrectly filtered as hidden. This is expected jsdom behavior — fine for these tests.
- **RTL StrictMode wrapper**: `tests/setup.tsx` wraps all renders in `<StrictMode>`. Effects run mount→cleanup→mount. Ensure the test fixture waits for results to render before pressing ArrowDown (use `waitFor` or `await act(async () => {...})`).

---

## SRCH-03: Footer Click — Root Cause and Fix

### Root Cause [VERIFIED: source inspection of `node_modules/@base-ui/react/combobox/list/ComboboxList.js`]

The `<Combobox.List>` renders as a `role="listbox"`. The footer `<button>` is currently a child of `<Combobox.List>` (SearchEntry.tsx:321-328). The listbox element intercepts pointer events for its own item selection handling. A plain `<button>` inside the listbox is NOT a `<Combobox.Item>` and therefore does not receive base-ui's delegated click routing. The `onClick` handler on the button never fires when clicked.

### Fix [VERIFIED: base-ui slot tree from ComboboxRoot.d.ts + CONTEXT.md D-08]

Move the footer button from INSIDE `<Combobox.List>` to OUTSIDE it, as a sibling within `<Combobox.Popup>`:

```tsx
// BEFORE (broken): footer inside <Combobox.List>
<Combobox.List className="...">
  {results.map((r, i) => (
    <Combobox.Item key={r.catalogId} value={r} index={i} className="...">
      ...
    </Combobox.Item>
  ))}
  <button onClick={() => setShowPanel(true)} className="...">
    Not finding it? Add manually
  </button>
</Combobox.List>

// AFTER (fixed): footer as sibling of <Combobox.List>
<Combobox.Popup className="...">
  {isLoading && <div>Searching…</div>}
  {!isLoading && results.length > 0 && (
    <Combobox.List className="max-h-[60vh] overflow-y-auto p-1">
      {results.map((r, i) => (
        <Combobox.Item key={r.catalogId} value={r} index={i} className="...">
          ...
        </Combobox.Item>
      ))}
    </Combobox.List>
  )}
  {results.length > 0 && (
    <button
      type="button"
      onClick={() => setShowPanel(true)}
      className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
    >
      Not finding it? Add manually
    </button>
  )}
</Combobox.Popup>
```

**Styling note (Claude's Discretion):** The `mt-1` top margin was relative to the last List item inside the same container. After relocation outside `<Combobox.List>`, `mt-1` may need adjustment to maintain visual spacing. The planner should adjust as needed. font-semibold guardrail: this button uses `text-sm text-muted-foreground` — it is secondary text, not primary. If any text-weight class needs to be added to this button text in future polish, use `font-semibold` NOT `font-medium` per `project_phase_68_complete` memory.

**Popup lifecycle:** The button renders only when `results.length > 0`, mirroring the existing condition. It inherits the popup's `open` lifecycle via the parent `{!isLoading && results.length > 0 && ...}` rendering, same as before.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-token SQL WHERE composition | Custom string builder | `and(...arr)` + `or(...)` + `ilike()` from drizzle-orm | Already imported; Drizzle handles parameterization and SQL generation |
| Object equality for combobox active tracking | Custom reference tracker | `isItemEqualToValue` prop on `<Combobox.Root>` | One-line prop; base-ui handles the full tracking lifecycle |
| Keyboard navigation testing | Custom event dispatchers | `userEvent.setup()` + `userEvent.keyboard()` from `@testing-library/user-event` | v14 already in `package.json`; polyfills already in `tests/setup.tsx` |

---

## Common Pitfalls

### Pitfall 1: Token normalization for reference column
**What goes wrong:** The reference column is indexed on `reference_normalized` (alphanumeric-only: `regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')`). Using the raw token `%brut%` against `reference_normalized` instead of `%brut%` (already lowercase) or the normalized form works for most cases but may miss references that need stripping.
**Why it happens:** The per-token pattern construction does `%${token}%` where `token` is already lowercased from `qTrimmed.toLowerCase().split(...)`. For brand/model columns, this matches the `*_normalized` columns correctly. For reference_normalized, extra non-alphanumeric chars in the token would be a problem — but since the upstream early-return at `SEARCH_ADD_FLOW_TRIM_MIN_LEN` ensures `qTrimmed` is at least 2 chars of meaningful input, and users typically type alphabetic/numeric query tokens, this is a minor edge case.
**How to avoid:** Normalize each token for the reference branch: `token.replace(/[^a-z0-9]+/g, '')`. This mirrors the existing `queryNormalized` pattern. If a token's normalized form is empty (e.g., token = "---"), use `sql\`false\`` for the reference branch rather than `ilike(ref, '%%')`.
**Warning signs:** A test token of pure punctuation returning unexpected results.

### Pitfall 2: `and(...[])` with an empty array
**What goes wrong:** If `tokens` is somehow empty, `and(...[])` generates an empty AND clause — behavior is Drizzle-version-dependent (may throw or generate `WHERE TRUE`).
**Why it happens:** The existing `qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return makes empty tokens impossible, but static analysis can't prove it. The CONTEXT.md explicitly identifies this as a discretion item for the planner.
**How to avoid:** Add `if (tokens.length === 0) return []` after tokenization.
**Warning signs:** Unit test with `q = "  "` (spaces only) returning non-empty results.

### Pitfall 3: Single-prop discipline for SRCH-02
**What goes wrong:** Layering `autoHighlight={true}` or changing `onOpenChange` to also reset `activeIndex` alongside `isItemEqualToValue` hides the actual root cause and creates compound side effects.
**Why it happens:** Multiple plausible hypotheses (D-06 lists three). It's tempting to add all three fixes at once.
**How to avoid:** Follow D-07: add `isItemEqualToValue` ONLY. Run the SRCH-02 keyboard test. If it passes, stop. If it still fails, investigate the next candidate.
**Warning signs:** The test passes but with multiple speculative changes active — you can't know which one actually fixed it.

### Pitfall 4: `fireEvent.click` for SRCH-02 keyboard test
**What goes wrong:** Using `fireEvent.click` on a result row verifies mouse-click selection (already tested in test case 7) but NOT keyboard navigation. The test would pass without fixing the keyboard bug.
**Why it happens:** `fireEvent.click` is the existing pattern in the test file; it's easy to copy.
**How to avoid:** SRCH-02 test MUST use `userEvent.keyboard('{ArrowDown}')` then `userEvent.keyboard('{Enter}')` to exercise the actual code path.
**Warning signs:** SRCH-02 test passes both before and after the fix.

### Pitfall 5: Footer render condition after relocation
**What goes wrong:** If the footer button is rendered unconditionally after relocation, it appears even when results are empty (e.g., during loading, or after `forceClose`).
**Why it happens:** Inside `<Combobox.List>`, the footer was inside the `{!isLoading && results.length > 0 && (...)}` block. After moving outside, the render condition must be explicitly replicated.
**How to avoid:** Wrap the footer in `{results.length > 0 && (...)}` (or the full `{!isLoading && results.length > 0 && (...)}` if the loading state matters).

### Pitfall 6: `vi.useFakeTimers()` in SRCH-02 keyboard tests
**What goes wrong:** Keyboard navigation through base-ui does not use timers, but the popup open/close lifecycle in SearchEntry uses debounce (250ms). If fake timers are active in the keyboard test, `waitFor` polling deadlocks (the `jest`-shim in `tests/setup.tsx` forwards `advanceTimersByTime`, but base-ui's async state updates may not settle).
**Why it happens:** The existing ARIA+keyboard describe block uses `vi.useFakeTimers()` in `beforeEach`.
**How to avoid:** For the NEW SRCH-02 keyboard test, use `vi.useRealTimers()` (or add a separate describe block that doesn't use fake timers). The debounce can be bypassed by pre-seeding the mock to return results immediately and advancing timers before the keyboard interaction.

---

## Code Examples

### SRCH-01: Tokenized AND-of-ORs WHERE clause

```typescript
// Source: inferred from catalog.ts:8 (existing Drizzle imports) + D-02/D-03/D-04
const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)
if (tokens.length === 0) return []

const tokenClauses = tokens.map((token) => {
  const colPattern = `%${token}%`
  const refToken = token.replace(/[^a-z0-9]+/g, '')
  return or(
    ilike(watchesCatalog.brandNormalized, colPattern),
    ilike(watchesCatalog.modelNormalized, colPattern),
    refToken.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${refToken}%`)
      : sql`false`,
  )
})

.where(and(...tokenClauses))
```

### SRCH-02: isItemEqualToValue addition

```tsx
// Source: base-ui.com/react/components/combobox — isItemEqualToValue prop
// Add to existing <Combobox.Root> in SearchEntry.tsx
<Combobox.Root<SearchCatalogWatchResult>
  // ... existing props unchanged ...
  isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}
  // ... existing props unchanged ...
>
```

### SRCH-02: Keyboard regression test skeleton

```tsx
// Source: ConfirmStep.test.tsx:170-195 pattern + D-11
import userEvent from '@testing-library/user-event'

it('(SRCH-02a) ArrowDown highlights first result; repeat moves to second; Enter fires onPick', async () => {
  const user = userEvent.setup()
  vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
    success: true,
    data: [OMEGA, BRUT],
  })

  render(<SearchEntry {...BASE_PROPS} />)
  const input = screen.getByRole('combobox')

  fireEvent.change(input, { target: { value: 'speed' } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })

  // Popup is open with results
  expect(screen.getByRole('listbox')).toBeInTheDocument()

  input.focus()
  await user.keyboard('{ArrowDown}')
  // First result highlighted — assert data-highlighted on first option
  const options = screen.getAllByRole('option')
  expect(options[0]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{ArrowDown}')
  expect(options[1]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{ArrowUp}')
  expect(options[0]).toHaveAttribute('data-highlighted', '')

  await user.keyboard('{Enter}')
  expect(BASE_PROPS.onPick).toHaveBeenCalledWith(OMEGA)
})
```

**Note:** The `data-highlighted` attribute name should be verified against base-ui's actual state attribute. base-ui uses `data-highlighted` per the `stateAttributesMapping` in ComboboxItem.

### SRCH-03: Footer-click regression test

```tsx
// Source: SearchEntry.test.tsx:597-626 pattern (existing test 12 uses fireEvent.click)
it('(SRCH-03) clicking "Not finding it?" footer outside Combobox.List mounts StructuredEntryPanel', async () => {
  vi.mocked(searchCatalogForAddFlow).mockResolvedValue({
    success: true,
    data: [OMEGA],
  })
  render(<SearchEntry {...BASE_PROPS} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'speed' } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })

  expect(screen.queryByTestId('structured-panel-mock')).not.toBeInTheDocument()

  const footer = screen.getByRole('button', { name: /not finding it/i })
  fireEvent.click(footer)

  expect(screen.getByTestId('structured-panel-mock')).toBeInTheDocument()
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-token ILIKE OR | AND-of-ORs per token | Phase 72 (this) | Multi-word queries now match across brand+model columns |
| No `isItemEqualToValue` | `isItemEqualToValue` by catalogId | Phase 72 (this) | base-ui can correctly track selected item across re-renders |
| Footer inside `<Combobox.List>` | Footer as sibling of `<Combobox.List>` | Phase 72 (this) | Click events reach the button handler |

**base-ui v1.3.0 relevant changes:**
- `#4235` — "Preserve inline input on Enter when nothing is highlighted": This is the fix that makes `activeIndex = null` + Enter close the popup instead of submitting. Correct behavior; our SRCH-02 fix ensures `activeIndex` is properly set by keyboard navigation.
- `#4117` — "Respect a null filter prop": Confirms that `filter={null}` (used in SearchEntry) is the correct way to disable internal filtering. This was a bug fix in 1.3.0. [VERIFIED: CHANGELOG.md in node_modules]
- `#4154` — "Avoid applying field attributes to input when it is inside popup": Relevant if input were inside the popup; in SearchEntry the input is outside, so this doesn't apply.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data-highlighted` is the exact attribute name base-ui sets on highlighted items | SRCH-02 test skeleton | Test assertion would fail; fix: grep `stateAttributesMapping` for the actual attribute |
| A2 | Adding `isItemEqualToValue` alone is sufficient to fix ArrowDown keyboard navigation | SRCH-02 root cause | If navigation still broken after adding this prop, the second candidate (D-06b: controlled `open` + `queryChangedAfterOpen` interaction) needs investigation |
| A3 | The footer `<button>` receives no click events because it's inside the listbox element | SRCH-03 root cause | Confirmed by code inspection but not by running the test; the test at RTL level will definitively confirm |

---

## Open Questions

1. **`data-highlighted` attribute name for SRCH-02 test assertion**
   - What we know: base-ui uses `stateAttributesMapping` to convert state to data attributes. The `highlighted` state in `ComboboxItemState` maps to a data attribute.
   - What's unclear: Whether it's `data-highlighted`, `data-state="highlighted"`, or something else.
   - Recommendation: Grep `node_modules/@base-ui/react/combobox/utils/stateAttributesMapping.js` for the actual key before writing the assertion. `data-highlighted=""` (empty string attribute) is the standard base-ui pattern for boolean states.

2. **Whether `isItemEqualToValue` fully fixes SRCH-02 or if controlled `open` interaction is also a factor**
   - What we know: The `shouldFillInput` path fires with `selectionMode = 'single'` + `inputInsidePopup = false`. This may cause unexpected state after selection.
   - What's unclear: Whether this creates a feedback loop that prevents ArrowDown from working on the first popup open (no prior selection).
   - Recommendation: Per D-07, add `isItemEqualToValue` first, run the SRCH-02 keyboard test. If it passes, stop.

---

## Environment Availability

Step 2.6: SKIPPED for external dependencies. All required tools (Node.js 25.2.1, npm 11.6.2, Next.js 16.2.3, Vitest, RTL) are confirmed available in the project environment. No external services required for this phase's fixes (DAL is tested with mocks; no live DB required for the unit test).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | v25.2.1 | — |
| npm | Install/build | Yes | 11.6.2 | — |
| Next.js | Build gate | Yes | 16.2.3 | — |
| `@base-ui/react` | SearchEntry fix | Yes | ^1.3.0 | — |
| `drizzle-orm` | SRCH-01 DAL | Yes | project version | — |
| `@testing-library/user-event` | SRCH-02 test | Yes | ^14.6.1 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom default) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts src/components/watch/SearchEntry.test.tsx` |
| Full suite command | `npm run build` (authoritative gate per `project_baseline_not_green_build_is_gate`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | `searchCatalogForAddFlow("Brut Datejust")` returns matching row | unit (DAL mock) | `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts` | No — Wave 0 |
| SRCH-01 | `searchCatalogForAddFlow("Timex Weekender")` returns matching row | unit (DAL mock) | same | No — Wave 0 |
| SRCH-01 | `searchCatalogForAddFlow("Datejust Brut")` returns same row as "Brut Datejust" (order-invariance) | unit (DAL mock) | same | No — Wave 0 |
| SRCH-01 | `searchCatalogForAddFlow("Brut")` still returns matching row (single-token regression) | unit (DAL mock) | same | No — Wave 0 |
| SRCH-02 | ArrowDown highlights first result; second ArrowDown moves to second; Enter fires `onPick(result)` | component (RTL+userEvent) | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | Partial — Wave 0 adds keyboard test |
| SRCH-02 | Escape closes the popup | component (RTL+userEvent) | same | Partial — Wave 0 adds escape test |
| SRCH-03 | Clicking "Not finding it?" footer mounts StructuredEntryPanel | component (RTL+fireEvent) | same | Partial — Wave 0 adds structural assertion |

### Sampling Rate

- **Per task commit:** `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts src/components/watch/SearchEntry.test.tsx`
- **Per wave merge:** Full suite via `npm run build` (exit 0)
- **Phase gate:** `npm run build` exit 0 before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/data/__tests__/catalog-search-tokens.test.ts` — covers SRCH-01 (multi-token + single-token regression + order-invariance)
- [ ] `SearchEntry.test.tsx` keyboard test addition — covers SRCH-02 (ArrowDown/ArrowUp/Enter/Escape)
- [ ] `SearchEntry.test.tsx` footer structural test addition — covers SRCH-03 (click outside List)

*(Framework and shared fixtures already exist — `vitest.config.ts`, `tests/setup.tsx`, existing SearchEntry.test.tsx mocks. No new harness needed.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To |
|-----------|-----------|
| Tech stack: Next.js 16 App Router — no rewrites | Phase 72 makes no framework changes |
| Data model: Watch and UserPreferences — extend, don't break | `searchCatalogForAddFlow` return type `SearchCatalogWatchResult` unchanged |
| Tailwind CSS 4 inline utility classes — no CSS modules | Footer relocation adjusts Tailwind classes only |
| `cn()` helper for conditional class composition | Footer button uses inline Tailwind; `cn()` not needed here |
| No relative imports; use `@/*` absolute paths | All test imports use `@/*` |
| `'use client'` on pages/components using Zustand/client hooks | SearchEntry already has `'use client'`; no change |
| `npm run build` gate (from milestone constraints ROADMAP.md:222) | Confirmed — only authoritative gate |
| `workflow.use_worktrees = false` | No worktrees; confirmed in config.json |
| Per-phase regression test required | Three new tests (SRCH-01 unit, SRCH-02+SRCH-03 component) |
| font-semibold NOT font-medium for primary text | Footer button text is secondary (`text-muted-foreground`) — no font-weight class needed; if added in future, must be `font-semibold` |

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes — SRCH-01 | Drizzle parameterized binds via `ilike(column, pattern)` — never string-interpolated SQL. Each `pattern = \`%${token}%\`` is a TS string bound via the ORM. T-67-02-01 mitigation preserved. |
| V2 Authentication | No | DAL fix is read-only catalog query; no auth change |
| V4 Access Control | No | Catalog search is viewer-keyed; no IDOR surface in the WHERE change |
| V6 Cryptography | No | No crypto in scope |

**Known threat pattern:** SQL injection via multi-token pattern construction. Mitigated by Drizzle parameterization — the `token` string is never concatenated into SQL text. The `%${token}%` construction produces a TS string that becomes a bind parameter `$1`, `$2`, etc. in the generated query. [VERIFIED: catalog.ts T-67-02-01 docstring + source inspection]

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@base-ui/react/combobox/root/ComboboxRoot.js` — confirmed `selectionMode = 'single'` always
- `node_modules/@base-ui/react/combobox/root/AriaCombobox.js` — confirmed `isItemEqualToValue = defaultItemEquality`, `focusItemOnOpen` formula, `shouldFillInput` path
- `node_modules/@base-ui/react/utils/itemEquality.js` — confirmed `defaultItemEquality = Object.is`
- `node_modules/@base-ui/react/combobox/root/ComboboxRoot.d.ts` — confirmed `isItemEqualToValue` prop signature
- `node_modules/@base-ui/react/floating-ui-react/hooks/useListNavigation.js` — confirmed ArrowDown/Enter handling with `virtual: true`
- `node_modules/@base-ui/react/combobox/input/ComboboxInput.js` — confirmed Enter behavior with `activeIndex === null`
- `node_modules/@base-ui/react/CHANGELOG.md` — confirmed v1.3.0 `#4235` "Preserve inline input on Enter when nothing is highlighted" and `#4117` "Respect a null filter prop"
- `src/data/catalog.ts:542-644` — confirmed existing DAL single-token pattern and Drizzle import set
- `src/components/watch/SearchEntry.tsx:207-333` — confirmed missing `isItemEqualToValue`, footer position inside List
- `src/components/watch/SearchEntry.test.tsx` — confirmed test 7 uses `fireEvent.click` (not keyboard), no existing keyboard nav test
- `tests/setup.tsx` — confirmed PointerEvent polyfill, `userEvent` v14 available, jsdom environment
- `vitest.config.ts` — confirmed `environment: 'jsdom'` default

### Secondary (MEDIUM confidence)
- `base-ui.com/react/components/combobox` — confirmed `isItemEqualToValue` usage for object values [CITED: official docs]

---

## Metadata

**Confidence breakdown:**
- SRCH-01 (DAL fix): HIGH — root cause confirmed by source inspection; Drizzle `and()`+`or()` builders verified in existing imports
- SRCH-02 (keyboard fix): HIGH (root cause) / MEDIUM (fix sufficiency) — mechanism confirmed; single-prop fix is hypothesis A2 per D-07 discipline
- SRCH-03 (footer fix): HIGH — root cause confirmed by structural inspection; fix is a relocation with zero behavior change to the handler
- Test infrastructure: HIGH — existing patterns confirmed (`catalog-facets.test.ts`, `ConfirmStep.test.tsx`, `SearchEntry.test.tsx`)

**Research date:** 2026-05-29
**Valid until:** 2026-06-29 (base-ui 1.3.0 is pinned; Drizzle API is stable)
