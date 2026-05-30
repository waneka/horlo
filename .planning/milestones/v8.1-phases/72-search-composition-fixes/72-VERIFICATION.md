---
phase: 72-search-composition-fixes
verified: 2026-05-30T03:30:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /watch/new in a deployed prod environment. Type 'Brut Datejust' in the search input and wait for results."
    expected: "A catalog row for a watch with brand 'Brut' and model containing 'Datejust' appears in the dropdown."
    why_human: "DAL tokenization is unit-tested with a mock; prod verifies the real Postgres query against the live catalog data."
  - test: "Type any query that returns 2+ results. Press ArrowDown — first row visually highlights (accent background). Press ArrowDown again — second row highlights. Press ArrowUp — first row re-highlights. Press Enter — picker fires (flow advances to confirm screen or owned-redirect)."
    expected: "Each arrow key moves the visible highlight; Enter on highlighted row advances the flow without closing the popup prematurely."
    why_human: "jsdom tests assert data-highlighted attribute and onPick call; prod visual highlight rendering (accent color, CSS transitions) requires a real browser."
  - test: "With results visible in the combobox dropdown, click 'Not finding it? Add manually'."
    expected: "StructuredEntryPanel expands inline below the search input with brand/model pre-seeded from the current query."
    why_human: "jsdom does not enforce listbox event delegation; the structural test (SRCH-03a) proves the button is outside the listbox, but a real browser click confirms the fix works end-to-end in prod."
---

# Phase 72: Search Composition Fixes — Verification Report

**Phase Goal:** Users can find watches using multi-token queries and navigate search results with the keyboard or footer affordance
**Verified:** 2026-05-30T03:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | searchCatalogForAddFlow returns matching rows for multi-token queries 'Brut Datejust' and 'Timex Weekender' (SRCH-01) | VERIFIED | `and(...tokenClauses)` at catalog.ts:613; 5/5 DAL unit tests pass including T2 ('Brut Datejust') and T3 ('Timex Weekender') |
| 2 | WHERE clause is AND-of-ORs over ILIKE — each token hits at least one of (brand_normalized, model_normalized, reference_normalized) | VERIFIED | `tokenClauses = tokens.map(token => or(ilike(brandNormalized, ...), ilike(modelNormalized, ...), ilike(referenceNormalized, ...)))` at catalog.ts:587-598; grep confirms `and(...tokenClauses)` present |
| 3 | Tokenization is qTrimmed.toLowerCase().split(/\s+/).filter(Boolean); defensive tokens.length===0 guard present | VERIFIED | catalog.ts:567 (`const tokens = qTrimmed.toLowerCase().split(/\s+/).filter(Boolean)`); catalog.ts:570 (`if (tokens.length === 0) return []`); both grep-confirmed |
| 4 | T-67-02-01 SQL injection mitigation preserved — no raw SQL interpolation in WHERE block | VERIFIED | `grep -E 'sql\`%\$\{' catalog.ts` returns 0 lines; per-token `%${token}%` is a TypeScript string bound via Drizzle ilike(), not SQL text; T-67-02-01 docstring comment preserved (grep count ≥ 1) |
| 5 | exactRefOrderTier and popularity/alpha ORDER BY chain preserved bit-for-bit | VERIFIED | grep shows exactRefOrderTier appears in 2 locations (definition line 578 + .orderBy line 617); ORDER BY chain at lines 615-622 unchanged |
| 6 | isItemEqualToValue prop on Combobox.Root resolves SRCH-02 keyboard navigation (plus index={i} removal per D-07 HALT operator decision) | VERIFIED | SearchEntry.tsx:223 `isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}` present (grep count = 1); `<Combobox.Item index={...}` pattern grep returns 0 lines (index={i} removed); SRCH-02a and SRCH-02b tests GREEN (24/24 pass) |
| 7 | Footer button relocated OUTSIDE Combobox.List as sibling inside Combobox.Popup (SRCH-03) | VERIFIED | Footer `<button>` at SearchEntry.tsx:327-333 appears after `</Combobox.List>` at line 317 and before `</Combobox.Popup>` at line 335; SRCH-03a structural test (footer.closest('[role="listbox"]') === null) passes GREEN |
| 8 | font-semibold guardrail intact — no font-medium in classNames | VERIFIED | `grep -c "font-medium" SearchEntry.tsx` returns 2 — both are documentation comments (lines 45, 283), not className values |
| 9 | Phase 69 D-03 pure-presenter contract preserved — no new props on SearchEntry | VERIFIED | SearchEntry props interface unchanged; `onPick`, `onSubmitStructured`, `onSwitchToUrl` signatures at lines 71/80/86 match prior definitions; no new props added |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/catalog.ts` | searchCatalogForAddFlow with tokenized AND-of-ORs WHERE clause | VERIFIED | `and(...tokenClauses)` present; T-67-02-01 mitigation in docstring; exactRefOrderTier preserved |
| `src/data/__tests__/catalog-search-tokens.test.ts` | SRCH-01 regression test — multi-token, single-token, order-invariance | VERIFIED | 5 tests present covering T1-T5; safeStringify WHERE-arg inspection pattern used; vi.mock('@/db') chain-mock pattern matches analog |
| `src/components/watch/SearchEntry.tsx` | Combobox.Root with isItemEqualToValue + footer as sibling of Combobox.List | VERIFIED | isItemEqualToValue at line 223; footer at lines 326-334 is sibling of Combobox.List (after line 317), inside Combobox.Popup (before line 335) |
| `src/components/watch/SearchEntry.test.tsx` | SRCH-02 keyboard nav tests + SRCH-03 structural footer-placement test | VERIFIED | Describe blocks 'keyboard arrow-key navigation (SRCH-02)' and 'footer placement (SRCH-03)' both present; 24/24 tests pass including 4 new SRCH-02/SRCH-03 cases |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/data/catalog.ts:searchCatalogForAddFlow` | watches_catalog table | `drizzle and(...tokenClauses)` bound parameters | WIRED | `and(...tokenClauses)` at line 613; each token is a Drizzle ilike() bind parameter, not SQL text |
| `src/data/__tests__/catalog-search-tokens.test.ts` | `src/data/catalog.ts:searchCatalogForAddFlow` | `vi.mock('@/db') + import from '@/data/catalog'` | WIRED | `vi.mock('@/db', ...)` at line 64; `import { searchCatalogForAddFlow } from '@/data/catalog'` at line 73 after the mock |
| `src/components/watch/SearchEntry.tsx:<Combobox.Root>` | @base-ui/react Combobox internal active-index tracker | `isItemEqualToValue` prop (catalogId comparator) | WIRED | `isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}` at line 223; index={i} removed from Combobox.Item |
| `src/components/watch/SearchEntry.tsx:footer button` | `setShowPanel(true)` handler | native React onClick (outside listbox) | WIRED | `onClick={() => setShowPanel(true)}` at line 329; button is sibling of Combobox.List, not child |

### Data-Flow Trace (Level 4)

Not applicable — artifacts are a DAL function and a UI component that re-renders from mock data in tests. The DAL fix is verified at the WHERE-clause construction level by unit tests; the component fix is structural (prop addition + subtree relocation) with no new data-flow paths introduced.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SRCH-01: 5 DAL regression tests pass | `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts` | 5/5 passed, exit 0 | PASS |
| SRCH-02 + SRCH-03: 24 SearchEntry tests pass | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | 24/24 passed, exit 0 | PASS |
| Build gate | `npm run build` | Compiled successfully in 5.6s, exit 0 | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared for this phase. Behavioral spot-checks above serve as the automated verification layer.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRCH-01 | 72-01-PLAN.md | Multi-token queries return matching catalog rows | SATISFIED | `and(...tokenClauses)` WHERE clause; 5/5 DAL unit tests GREEN |
| SRCH-02 | 72-02-PLAN.md | Keyboard Up/Down/Enter/Escape navigation in combobox | SATISFIED | `isItemEqualToValue` prop + `index={i}` removal; SRCH-02a and SRCH-02b tests GREEN |
| SRCH-03 | 72-02-PLAN.md | "Not finding it? Add manually" footer click expands panel | SATISFIED | Footer relocated outside Combobox.List; SRCH-03a structural test + SRCH-03b behavioral test GREEN |

All 3 SRCH-* requirements owned by Phase 72 per REQUIREMENTS.md are satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Zero TBD/FIXME/XXX markers found across all 4 modified files. No unreferenced debt markers. No `return null` / `return []` stubs in implementation paths (the catalog.ts `return []` early-returns are deliberate guards per D-03, not stubs).

### Human Verification Required

Three items require prod UAT per `feedback_mobile_ui_verify_on_prod`. Automated jsdom tests cover structural assertions and call semantics; a real browser on prod confirms the user-observable behaviors.

#### 1. Multi-token search returns real catalog rows on prod

**Test:** Open `/watch/new` (prod). Type `"Brut Datejust"` in the search input and wait ~300ms.
**Expected:** A catalog row for Brut Datejust appears in the combobox dropdown. Repeat with `"Timex Weekender"` and `"Datejust Brut"` (order-invariance). Single-token `"Brut"` still returns results.
**Why human:** DAL tokenization is proven correct by a mocked unit test. Prod verifies the actual Postgres ILIKE AND-of-ORs query against the live catalog with real normalized column data.

#### 2. Keyboard arrow-key navigation works visually in prod

**Test:** Open `/watch/new` (prod). Type a query returning 2+ results. Press ArrowDown — first row should show an accent-colored highlight. Press ArrowDown again — second row highlights. Press ArrowUp — first row re-highlights. Press Enter — flow advances (owned-redirect to `/w/[ref]` or confirm screen for new addition).
**Expected:** Each keypress visibly moves the highlight. Enter fires the pick and advances the flow.
**Why human:** jsdom tests confirm `data-highlighted` attribute and `onPick` call semantics. Prod confirms the Tailwind `data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground` CSS renders correctly and the Enter-triggered flow transition works end-to-end through AddWatchFlow.handleSearchPick.

#### 3. Footer click expands StructuredEntryPanel in prod (not inside listbox)

**Test:** Open `/watch/new` (prod). Type a query with results. Click `"Not finding it? Add manually"`.
**Expected:** StructuredEntryPanel expands inline below the search input with brand/model pre-seeded from the current query.
**Why human:** jsdom does not enforce browser listbox event delegation. SRCH-03a structural test (footer.closest('[role="listbox"]') === null) proves the button is outside the listbox at DOM level. Prod confirms a real browser delivers the click event to the button handler (the prod bug was specifically that listbox event routing swallowed the click in real browsers).

### Gaps Summary

No gaps. All 9 observable truths are VERIFIED by codebase evidence and automated test results. The human verification items are UI behavior confirmations required by the `feedback_mobile_ui_verify_on_prod` convention — they do not indicate implementation deficiencies.

Per `feedback_mobile_ui_verify_on_prod`: bundle Phase 72 with Phases 73 and 74 for a single prod push, then run the UAT walk across all three phases.

---

_Verified: 2026-05-30T03:30:00Z_
_Verifier: Claude (gsd-verifier)_
