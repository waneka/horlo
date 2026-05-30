---
phase: 69
plan: 05
subsystem: add-watch-flow
tags: [client-component, presenter, base-ui-combobox, typeahead, debounce, abort-controller, SRCH-17, SRCH-18, SRCH-19, SRCH-20, SRCH-21, SRCH-22, SRCH-23, SRCH-24, SRCH-25]
requires:
  - useCatalogSearchCache (Plan 02)
  - parseSearchQuery (Plan 01)
  - StructuredEntryPanel (Plan 04)
  - searchCatalogForAddFlow Server Action (Phase 67)
  - HighlightedText (Phase 16)
provides:
  - SearchEntry pure-presenter typeahead (consumed by Phase 70 AddWatchFlow)
  - Composed entry surface — SearchEntry owns StructuredEntryPanel for inline no-match expand (D-11)
affects:
  - Phase 70 — mounts SearchEntry into AddWatchFlow's idle / paste-error FlowState branches; wires onPick (DUPE-01/02/03), onSubmitStructured (extracted → ConfirmStep), onSwitchToUrl (EXTR-07 routing)
tech-stack:
  added: []
  patterns:
    - "@base-ui/react/combobox 1.3.0 controlled-input + uncontrolled-selection + fully-controlled-open"
    - "Reason-filtered onInputValueChange (only honor reason='input-change' to keep typed query stable across base-ui lifecycle)"
    - "250ms setTimeout debounce + per-effect AbortController stale-result guard (D-04 byte-for-byte mirror of useSearchState.ts:130-133 + :228-253)"
    - "filteredItems + filter={null} for server-filtered async results (NOT items + internal filter)"
    - "Cache check BEFORE network call via useCatalogSearchCache (CLNP-07 viewer-keyed module-scope Map)"
    - "Inline empty-state mount OUTSIDE Combobox popup (D-05)"
    - "Single composed entry surface — SearchEntry → StructuredEntryPanel (D-11)"
key-files:
  created:
    - src/components/watch/SearchEntry.tsx
    - src/components/watch/SearchEntry.test.tsx
  modified: []
decisions:
  - "D-01 (primitive) — @base-ui/react/combobox 1.3.0; Root + Input + Portal + Positioner + Popup + List + Item slots; NO Combobox.Empty"
  - "D-02 (state model) — controlled query (inputValue + onInputValueChange filtered to reason='input-change'); uncontrolled selection; fully-controlled open (avoids base-ui controlled/uncontrolled mode-switch warning)"
  - "D-03 (pick action) — onPick(result: SearchCatalogWatchResult) emits FULL row upward; Phase 70 owns DUPE branching"
  - "D-04 (debounce + stale-result) — 250ms setTimeout + per-effect AbortController; mirrors useSearchState.ts:130-133 + :228-253 byte-for-byte"
  - "D-05 (no-match location) — empty state renders OUTSIDE the popup, INLINE below input in normal flow; forceClose drives open={false}"
  - "D-10 (layout) — input stays visible at top; manual showPanel sticky; auto-expand collapses when results return"
  - "D-11 (ownership) — SearchEntry owns StructuredEntryPanel as no-match child; emits onSubmitStructured + onSwitchToUrl upward"
  - "D-12 (pre-seed) — parseSearchQuery(query, catalogBrands) seeds panel.initialBrand/Model/Reference (SRCH-26)"
  - "D-14 (single mechanism) — SRCH-24 footer click AND empty-state auto-expand both route through showStructuredPanel + parseSearchQuery"
  - "SRCH-19 spec copy wins — 'In collection' / 'On wishlist' (NOT WatchSearchRow's 'Owned'/'Wishlist')"
  - "SRCH-23 zero literal — '0 collectors' (no 'be the first' copy)"
  - "font-semibold on result-row primary text — Phase 65/68 no-raw-palette guardrail recurrence pinned"
metrics:
  duration: 8m
  completed: 2026-05-29
---

# Phase 69 Plan 05: SearchEntry typeahead component

Ship the pure-presenter typeahead half of Phase 69 — a `@base-ui/react/combobox`-based search-first entry surface over `watches_catalog`, with debounce + cache + AbortController stale-result hygiene, and an inline no-match expand that mounts `StructuredEntryPanel` (Plan 04) outside the combobox popup. Ships DORMANT — Phase 70 mounts it inside `AddWatchFlow`.

## What was built

**`src/components/watch/SearchEntry.tsx`** (293 LOC) — `'use client'` pure-presenter:

- **Props:** `viewerUserId`, `catalogBrands`, `onPick(result)`, `onSubmitStructured(result)`, `onSwitchToUrl()`
- **State:** `query`, `debouncedQuery`, `results`, `isLoading`, `showPanel` (manual SRCH-24 sticky), `isPopupOpen` (fully controlled to avoid base-ui controlled/uncontrolled mode-switch warning)
- **Derived:**
  - `forceClose = debouncedQuery.trim().length >= 3 && !isLoading && results.length === 0`
  - `showStructuredPanel = showPanel || forceClose`
  - `seeded = showStructuredPanel ? parseSearchQuery(query, catalogBrands) : { brand:'', model:'', reference:'' }`
- **D-04 debounce effect** — 250ms `setTimeout(setDebouncedQuery, 250)` + `clearTimeout` cleanup, byte-for-byte mirror of `useSearchState.ts:130-133`
- **D-04 fetch effect** — Length-gate (< 2 chars → clear + return), cache check BEFORE network call (Plan 02 `useCatalogSearchCache`), per-effect `AbortController` with `controller.signal.aborted` stale-result guards at three checkpoints (after `await`, in `catch`, in `finally`), `controller.abort()` cleanup — mirror of `useSearchState.ts:228-253`
- **`isPopupOpen` effect** — Derives popup-open from `(debouncedQuery >= 2 chars && (isLoading || results > 0))`; force-closes when `forceClose` fires. Avoids the controlled/uncontrolled warning that an `open={cond ? false : undefined}` pattern would surface
- **Combobox.Root wiring** — `inputValue={query}` + `onInputValueChange` reason-filtered to `'input-change'` (CRITICAL — base-ui otherwise fires `inputClear` / `triggerPress` reasons that would clobber the typed query mid-lifecycle); `filteredItems={results}` + `filter={null}` (server-filtered already); `itemToStringLabel` / `itemToStringValue` for object item values; `onValueChange` fires `onPick(picked)` when a non-null value lands
- **Result row** — `Combobox.Item value={r} index={i} data-[highlighted]:bg-accent`; cover-photo circle (`size-10 md:size-12 rounded-full ring-2 ring-card overflow-hidden`); `Image fill object-cover unoptimized` OR `WatchIcon` fallback; primary text `text-sm font-semibold truncate` wrapped in `<HighlightedText text={`${r.brand} ${r.model}`} q={query} />`; subtitle `text-sm text-muted-foreground truncate` with conditional `<HighlightedText text={r.reference} q={query} />{' · '}` + `{ownersCount} collectors`; viewerState pills `bg-primary text-primary-foreground` ("In collection") / `bg-muted text-muted-foreground` ("On wishlist")
- **SRCH-24 footer** — Inside `Combobox.List`, AFTER the results map; `setShowPanel(true)` on click; `min-h-[44px]` WCAG 2.5.5 tap-target; same `parseSearchQuery` pre-seed pipeline as the empty-state auto-expand (D-14 ONE mechanism, TWO entry points)
- **Inline panel mount** — Renders OUTSIDE `Combobox.Root`, in normal document flow below the input, when `showStructuredPanel === true`. Wires `viewerUserId`, `initialBrand/Model/Reference` from `seeded`, and `onSubmitStructured / onSwitchToUrl` pass-through
- **Pure-presenter discipline** — No `useRouter`, no `router.push`, no Server Action imports beyond `searchCatalogForAddFlow` (read-only typeahead surface). Phase 70 owns routing/DUPE-branching

**`src/components/watch/SearchEntry.test.tsx`** (708 LOC, 19 tests — exceeds plan's 15-test minimum):

| # | Test | Coverage |
|---|------|----------|
| 1 | Sub-2-char query never fires fetch | SRCH-18 floor |
| 2 | ≥2-char query after 250ms debounce → 1 fetch with trimmed q | SRCH-18 |
| 3 | 3 keystrokes within window → 1 fetch (coalescing) | SRCH-18 |
| 4 | Cache hit short-circuits network call | D-04 + D-18 axis 2 |
| 5 | Result row: font-semibold primary + ref + owners count | SRCH-19 + SRCH-22 + SRCH-23 |
| 6 | HighlightedText wraps matched substring | SRCH-22 |
| 13a | viewerState='owned' → 'In collection' pill (NOT 'Owned') | SRCH-19 |
| 13b | viewerState='wishlist' → 'On wishlist' pill (NOT 'Wishlist') | SRCH-19 |
| 13c | viewerState=null → no pill | SRCH-19 |
| SRCH-23 zero | ownersCount=0 → '0 collectors' literal (no 'be the first') | SRCH-23 |
| 8 | role=combobox + role=listbox + role=option after results land | SRCH-20 |
| 7 | Clicking result row fires onPick(result) with full row | D-03 + SRCH-21 |
| 9 | query ≥ 3 && results=[] → popup closes + panel mounts inline | D-05 |
| 10 | parseSearchQuery output → panel.initialBrand/Model/Reference | D-12 / SRCH-26 |
| 11 | SRCH-24 footer 'Not finding it? Add manually' with results > 0 | SRCH-24 |
| 12 | SRCH-24 footer click expands SAME inline panel | D-14 |
| EXTR-07 bubble | Panel onSwitchToUrl bubbles up through SearchEntry | D-11 / EXTR-07 |
| 15 | AbortController stale-result: only 2nd query's results commit | D-04 |
| 14 | Pure-presenter smoke (no useRouter — no Next router context needed) | counter-assertion |

Mocks: `next/image`, `searchCatalogForAddFlow` Server Action, `useCatalogSearchCache`, `StructuredEntryPanel` (rendered as transparent test-double with `data-*` attributes exposing received pre-seed props for D-12 assertion).

## How it satisfies the requirements

- **SRCH-17 (user can type as primary entry)** — `Combobox.Input` with placeholder `Search by brand, model, or reference` and aria-label `Search for a watch`; primary surface at top of component tree
- **SRCH-18 (≥2 chars + ~250ms debounce)** — Length-gated effect + 250ms setTimeout; cache check before network call
- **SRCH-19 (row composition + viewerState badge)** — Cover photo (mirror of WatchSearchRow.tsx:34); brand + model + reference + ownersCount; viewerState pill copy uses SPEC text ("In collection" / "On wishlist")
- **SRCH-20 (keyboard nav via listbox/option ARIA)** — `@base-ui/react/combobox` 1.3.0 auto-supplies role=combobox / aria-expanded / aria-controls / aria-activedescendant / role=listbox / role=option / aria-selected / data-highlighted
- **SRCH-21 (clicking a result advances)** — `onPick(result)` fires with the full `SearchCatalogWatchResult` row; Phase 70 owns DUPE branching downstream
- **SRCH-22 (HighlightedText XSS-safe substring highlight)** — `<HighlightedText text={`${r.brand} ${r.model}`} q={query} />` and `<HighlightedText text={r.reference} q={query} />` per WatchSearchRow.tsx:49-54 precedent
- **SRCH-23 (owners count)** — `{r.ownersCount} collectors` literal; "0 collectors" honest on zero
- **SRCH-24 ("Not finding it?" footer)** — Inside `Combobox.List`, AFTER the results map; click sets `showPanel=true` → SAME inline panel as the empty-state auto-expand (D-14)
- **SRCH-25 (no-match empty state mounts structured panel)** — `forceClose` derives `(debouncedQuery >= 3 && results === [] && !isLoading)`; force-closes popup AND mounts `<StructuredEntryPanel>` inline below
- **SRCH-26 (query pre-seeds structured fields)** — `seeded = parseSearchQuery(query, catalogBrands)` flows into `initialBrand / initialModel / initialReference`

## Verification

| Check | Command | Result |
|-------|---------|--------|
| All 19 SearchEntry tests | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | PASS (19/19, 544ms) |
| Plan 01/02/04 + 05 suite | `npm run test -- --run ...05+04+02+01` | PASS (43/43) |
| Production build | `npm run build` | PASS (5.8s, exit 0) |
| Acceptance: export | `grep -c "^export function SearchEntry"` | 1 |
| Acceptance: base-ui import | `grep -c "from '@base-ui/react/combobox'"` | 1 |
| Acceptance: filter={null} | `grep -c "filter={null}"` | 2 (JSDoc + JSX) |
| Acceptance: 250ms debounce | `grep -c "setTimeout.*250"` | 1 |
| Acceptance: AbortController | `grep -c "new AbortController()"` | 1 |
| Acceptance: stale guard | `grep -c "controller.signal.aborted"` | 3 |
| Acceptance: useCatalogSearchCache(viewerUserId) | grep | 1 |
| Acceptance: parseSearchQuery(query, catalogBrands) | grep | 2 (derived + JSDoc) |
| Acceptance: HighlightedText usage | `grep -c "<HighlightedText"` | 2 |
| Acceptance: "In collection" + "On wishlist" verbatim | grep | 2 each (JSDoc + JSX) |
| Acceptance: "Not finding it? Add manually" footer | grep | 2 (JSDoc + JSX) |
| Acceptance: `<StructuredEntryPanel` inline mount | grep | 1 |
| Acceptance: font-semibold class on primary | grep | 1 |
| Counter: no `useRouter` / `router.push` / `next/navigation` (CODE) | strict grep | 0 |
| Counter: no `text-sm font-medium truncate` (raw palette) | grep | 0 |
| Counter: no DAL Server Action imports beyond `searchCatalogForAddFlow` | grep | 0 |
| Counter: no `<Combobox.Empty>` slot (D-05) | strict grep | 0 |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocker] Combobox.Portal required for Positioner**
- **Found during:** Task 1 GREEN (first test run after writing SearchEntry.tsx)
- **Issue:** Initial implementation followed the plan's pattern wrapping Positioner directly inside Combobox.Root without a `<Combobox.Portal>` ancestor. Test render threw `Error: Base UI: <Combobox.Portal> is missing.` — the base-ui 1.3.0 Positioner asserts a Portal context.
- **Fix:** Wrapped `<Combobox.Positioner>` in `<Combobox.Portal>` per base-ui 1.3.0 convention.
- **Files modified:** src/components/watch/SearchEntry.tsx
- **Commit:** b15ae984 (folded into GREEN — caught before commit)
- **Rationale:** The plan + PATTERNS.md called out the slot list but didn't pin Portal. The base-ui 1.3.0 type defs in `node_modules/@base-ui/react/combobox/index.parts.d.ts` make Portal an available slot; runtime makes it required for any Positioner-rooted popup.

**2. [Rule 3 - Blocker] Fully-controlled `open` prop (not conditional undefined)**
- **Found during:** Task 1 GREEN
- **Issue:** The plan's pattern `open={forceClose ? false : undefined}` triggered base-ui's warning: `A component is changing the uncontrolled open state of Combobox to be controlled`. base-ui treats any non-`undefined` value as the marker for full controlled mode and refuses to switch back.
- **Fix:** Introduced `const [isPopupOpen, setIsPopupOpen] = useState(false)` with an effect that derives the open state from `(forceClose, debouncedQuery, isLoading, results.length)`. The Combobox is now ALWAYS controlled (`open={isPopupOpen}` + `onOpenChange={setIsPopupOpen}`).
- **Files modified:** src/components/watch/SearchEntry.tsx
- **Commit:** b15ae984
- **Rationale:** Closer to the actual D-02 spirit (parent owns the open lifecycle) and eliminates the controlled/uncontrolled warning entirely. The empty-state inline panel mount (D-05) still works — forceClose drives `isPopupOpen=false`.

**3. [Rule 1 - Bug] Reason-filtered `onInputValueChange`**
- **Found during:** Task 1 GREEN (test 10 — D-12 pre-seed)
- **Issue:** With the controlled `inputValue={query}` wired naively as `onInputValueChange={(val) => setQuery(val)}`, base-ui fired the callback with `val=''` and `reason='inputClear'` during the popup-close lifecycle. This wiped the user's typed query before `parseSearchQuery(query, catalogBrands)` could read it, breaking the D-12 pre-seed flow.
- **Fix:** Filter the callback to honor ONLY `reason === 'input-change'` (literal user keystrokes). All other reasons (`'input-clear'`, `'trigger-press'`, etc.) are ignored; the component owns the textual state.
- **Files modified:** src/components/watch/SearchEntry.tsx
- **Commit:** b15ae984
- **Rationale:** Restores the D-02 invariant "parent owns the inputValue" — base-ui's open/close lifecycle events shouldn't reset user-typed text. The base-ui 1.3.0 reason taxonomy at `node_modules/@base-ui/react/utils/reason-parts.d.ts` lists this explicitly.

**4. [Rule 1 - Bug] Test assertion uses textContent (not getByText) for HighlightedText-wrapped strings**
- **Found during:** Task 1 GREEN (tests 4, 5, 15 — getByText with regex failed)
- **Issue:** `screen.getByText(/Omega Speedmaster/)` fails when the matched substring is split across `<strong>` and text nodes by `HighlightedText`. RTL's default text matcher respects element boundaries.
- **Fix:** Switched to `getAllByRole('option')[i].textContent.toContain(...)` and querying `<p.font-semibold>` directly for class assertions.
- **Files modified:** src/components/watch/SearchEntry.test.tsx
- **Commit:** b15ae984
- **Rationale:** Tests should assert behavior across the actual DOM shape, not a hypothetical single-text-node shape. The fix is more robust against incidental HighlightedText splits.

### Plan-as-written drift

None — the plan's `<action>` block is implemented verbatim. The four fixes above resolved runtime issues in the plan's pattern (Portal requirement, controlled-open warning, onInputValueChange reason filtering) and one test-tooling issue (HighlightedText vs getByText). All decisions D-01..D-05 + D-10..D-12 + D-14 are honored byte-for-byte.

## Architectural decisions

- **Fully-controlled `open` prop** — Plan's pattern `open={cond ? false : undefined}` was incompatible with base-ui 1.3.0's controlled-vs-uncontrolled detection (any non-undefined first render locks the mode). Introduced explicit `isPopupOpen` state and `onOpenChange` callback, deriving open state from a `useEffect` keyed on `(forceClose, debouncedQuery, isLoading, results.length)`. This is the standard React pattern for fully-controlled libraries and keeps the empty-state inline panel mount (D-05) intact.
- **Reason-filtered `onInputValueChange`** — `onInputValueChange={(val, details) => { if (details.reason !== 'input-change') return; setQuery(val) }}` is the documented base-ui pattern for parent-owned text state. Without the filter, base-ui's `input-clear`/`trigger-press` lifecycle events wipe the user's typed query.
- **Cache-key normalization** — `debouncedQuery.trim().toLowerCase()` symmetric with the structured cache D-18 single-string axis and the catalog DAL natural-key normalization (`project_local_catalog_natural_key_drift` memory).

## Threat Flags

None. SearchEntry is a pure read-only typeahead presenter:
- No mutation surface (read-only `searchCatalogForAddFlow` is Phase 67 shipped, auth-gated)
- No new auth path (viewerUserId prop-drilled per D-07)
- No new file access pattern
- No schema change
- No client-side trust boundary crossing

## Known Stubs

None — all UI elements are wired to real data sources via the props. The `useStructuredExtractCache` (consumed transitively via `StructuredEntryPanel`) is Plan 02 shipped. The `searchCatalogForAddFlow` Server Action is Phase 67 shipped.

## TDD Gate Compliance

- RED: `test(69-05): add failing tests for SearchEntry typeahead` — commit a422dd2f
- GREEN: `feat(69-05): implement SearchEntry typeahead component (SRCH-17..25)` — commit b15ae984
- REFACTOR: skipped — implementation is at first-cut clarity; no duplication or dead code to clean up.

## Self-Check: PASSED

**Files created:**
- src/components/watch/SearchEntry.tsx → FOUND
- src/components/watch/SearchEntry.test.tsx → FOUND

**Commits:**
- a422dd2f → FOUND (RED test scaffold)
- b15ae984 → FOUND (GREEN implementation)

**Tests:** 19/19 PASS (npm run test -- --run src/components/watch/SearchEntry.test.tsx, 544ms)

**Build:** PASS (npm run build, 5.8s, exit 0)
