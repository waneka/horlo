---
phase: 69-searchentry-structuredentrypanel-cache-hygiene
verified: 2026-05-29T22:44:30Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Type 'speedmaster' into /watch/new search input on prod — verify debounce (results appear after ~250 ms pause, not on every keystroke), verify results show brand/model/reference/cover photo, and verify 'In collection'/'On wishlist' badges appear for watches you own or have wishlisted"
    expected: "Results appear with debounce, cover photos load, badge copy matches spec ('In collection' / 'On wishlist', NOT 'Owned'/'Wishlist')"
    why_human: "Debounce wall-clock timing, network round-trip, cover photo rendering, and badge visual rendering require a live browser against prod — cannot be confirmed by static code grep alone"
  - test: "In search results, try keyboard Up/Down arrow navigation and Enter to select a result"
    expected: "Focus moves visually through result rows; Enter fires onPick (advances flow in Phase 70); no keyboard trap"
    why_human: "WAI-ARIA combobox keyboard behavior provided by @base-ui/react/combobox 1.3.0 requires live browser interaction; ARIA attributes are present in code but rendering in actual browser MUST be human-verified"
  - test: "Type 3+ characters that match nothing ('zzz'), then verify the no-match state and URL backup link"
    expected: "StructuredEntryPanel mounts inline below the search input with pre-seeded fields; 'Have a URL for this watch?' ghost link is visible; typing back to valid results collapses the panel"
    why_human: "Inline expand/collapse behavior and visual layout in real browser; the collapse logic relies on derived state and effects that are unit-tested but prod rendering is the authoritative check"
  - test: "On /watch/new with results present, verify the 'Not finding it? Add manually' footer row appears below results and expands the same StructuredEntryPanel when clicked"
    expected: "Footer row visible in results list; clicking it expands StructuredEntryPanel inline with parsed brand/model/reference pre-seeded"
    why_human: "SRCH-24 footer is inside the Combobox.List popup — visual position and tap-target legibility require live browser"
---

# Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene — Verification Report

**Phase Goal:** The two entry surfaces (typeahead search and 4-field structured-input form) are built as components with their own module-scope caches, and all four module-scope caches (including the two pre-existing ones) clear on user signOut via a shared `lastUserId` check.
**Verified:** 2026-05-29T22:44:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SearchEntry fires results after ~250 ms debounce only when query ≥ 2 chars; rows show brand, model, reference, cover photo, viewer-state badge | ✓ VERIFIED | `SearchEntry.tsx:139` — `setTimeout(..., 250)`; `:147` — `< 2` length gate; `:273–300` — row renders brand+model via HighlightedText, reference, ownersCount, viewerState pills "In collection"/"On wishlist" |
| 2 | Matched text highlighted via HighlightedText; rows show owners count ("47 collectors") | ✓ VERIFIED | `SearchEntry.tsx:56` — imports HighlightedText; `:274–282` — two HighlightedText calls on brand+model AND reference; `:286` — `{r.ownersCount} collectors` literal; `SearchEntry.test.tsx` tests 5, 6, SRCH-23 |
| 3 | Keyboard Up/Down/Enter navigation; combobox ARIA roles (role="listbox", role="option") | ✓ VERIFIED (CODE) / ? UNCERTAIN (BROWSER) | `SearchEntry.tsx:53` — `@base-ui/react/combobox` which provides ARIA contract headlessly; `SearchEntry.test.tsx:445` tests for role=combobox/listbox/option; 19/19 tests pass |
| 4 | No-match empty state (query ≥ 3, results = 0) mounts StructuredEntryPanel inline; "Not finding it?" footer when results > 0; "Have a URL?" in StructuredEntryPanel | ✓ VERIFIED (CODE) / ? UNCERTAIN (BROWSER) | `SearchEntry.tsx:106–108` — `forceClose` derived flag; `:314` — "Not finding it? Add manually" footer button; `StructuredEntryPanel.tsx:282` — "Have a URL for this watch?" ghost link; `SearchEntry.test.tsx` tests 9, 11, 12 |
| 5 | signOut clears all four module-scope caches (`useCatalogSearchCache`, `useStructuredExtractCache`, `useWatchSearchVerdictCache`, `useUrlExtractCache`) | ✓ VERIFIED | `AddWatchFlow.test.tsx:699` — "Phase 69 — cache hygiene integration (CLNP-07)" describe block; all 4 __resetForTests called in beforeEach; user-a seeds all 4 caches; user-b read returns `undefined` for all 4; 13/13 tests pass |

**Score:** 5/5 truths verified at code level. Items 3 and 4 contain human verification items for browser behavior.

---

### Deferred Items

None — all 5 success criteria are addressed by this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/SearchEntry.tsx` | @base-ui/react/combobox typeahead, 293 LOC | ✓ VERIFIED | Substantive; 250ms debounce, AbortController, cache check, HighlightedText, forceClose, SRCH-24 footer, inline StructuredEntryPanel mount |
| `src/components/watch/SearchEntry.test.tsx` | 19 tests covering SRCH-17..25 | ✓ VERIFIED | 19/19 pass |
| `src/components/watch/StructuredEntryPanel.tsx` | 4-field form, VerdictSkeleton, CatalogPhotoUploader, ExtractErrorCard mode=structured, EXTR-07 ghost link | ✓ VERIFIED | Substantive 287 LOC; all sections present |
| `src/components/watch/StructuredEntryPanel.test.tsx` | 10 tests | ✓ VERIFIED | 10/10 pass |
| `src/components/watch/useCatalogSearchCache.ts` | module-scope Map, viewerUserId reset, stale-write guard | ✓ VERIFIED | Lines 27–61; `if (moduleUserId !== viewerUserId)` reset block + stale-write guard in `set()` |
| `src/components/watch/useCatalogSearchCache.test.ts` | 4 behavioral tests | ✓ VERIFIED | 4/4 pass |
| `src/components/watch/useStructuredExtractCache.ts` | same shape + D-18 JSON-tuple cache key | ✓ VERIFIED | ExtractCacheEntry re-imported from useUrlExtractCache; same D-06 pattern |
| `src/components/watch/useStructuredExtractCache.test.ts` | 5 behavioral tests including D-18 normalization | ✓ VERIFIED | 5/5 pass |
| `src/components/watch/useUrlExtractCache.ts` | RETROFIT: required viewerUserId arg + D-06 reset | ✓ VERIFIED | Lines 50–57; required `viewerUserId: string` arg; reset block; stale-write guard |
| `src/components/watch/useUrlExtractCache.test.ts` | 4 tests | ✓ VERIFIED | 4/4 pass |
| `src/components/search/useWatchSearchVerdictCache.ts` | RETROFIT: required 2nd arg viewerUserId, outer user-switch guard before revision guard | ✓ VERIFIED | Lines 45–59; outer `moduleUserId !== viewerUserId` guard runs first, resets `moduleRevision=0` for inner guard |
| `src/components/search/useWatchSearchVerdictCache.test.ts` | 6 tests | ✓ VERIFIED | 6/6 pass |
| `src/lib/searchEntry/parseSearchQuery.ts` | D-12 longest-prefix brand match + naive fallback | ✓ VERIFIED | 166 LOC; sorts brands DESC by length; whitespace-bounded prefix match; original-case preservation |
| `src/lib/searchEntry/parseSearchQuery.test.ts` | 10 tests including cases a-f from CONTEXT.md | ✓ VERIFIED | 10/10 pass |
| `src/data/catalog.ts` (modified) | `listCatalogBrands(): Promise<string[]>` DAL fn | ✓ VERIFIED | `grep` confirms export at line 839; Drizzle `selectDistinct` |
| `src/components/watch/ExtractErrorCard.tsx` (modified) | `mode?: 'url' | 'structured'` prop + structured-data-missing copy branch | ✓ VERIFIED | Line 52: `mode?: 'url' | 'structured'`; line 128–129: branch with verbatim copy |
| `src/components/watch/AddWatchFlow.test.tsx` (modified) | CLNP-07 four-cache integration test | ✓ VERIFIED | "Phase 69 — cache hygiene integration (CLNP-07)" describe block; 13/13 tests pass |
| `src/app/watch/new/page.tsx` (modified) | listCatalogBrands in Promise.all → catalogBrands={catalogBrands} | ✓ VERIFIED | Line 94: `listCatalogBrands()` in Promise.all; line 136: `catalogBrands={catalogBrands}` JSX prop |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SearchEntry.tsx` | `searchCatalogForAddFlow` Server Action | `import` + debounced `useEffect` | ✓ WIRED | `src/app/actions/search.ts` imported; called with `{ q: debouncedQuery }` |
| `SearchEntry.tsx` | `useCatalogSearchCache` | `import` + call `cache.get()` before fetch | ✓ WIRED | Cache check at line 156 before network call |
| `SearchEntry.tsx` | `HighlightedText` | `import` + JSX | ✓ WIRED | Two `<HighlightedText>` in result rows |
| `SearchEntry.tsx` | `StructuredEntryPanel` | `import` + conditional `{showStructuredPanel && <StructuredEntryPanel>}` | ✓ WIRED | Inline mount at line 327; passes all required props |
| `SearchEntry.tsx` | `parseSearchQuery` | `import` + derived `seeded` | ✓ WIRED | `parseSearchQuery(query, catalogBrands)` in derived state |
| `StructuredEntryPanel.tsx` | `/api/extract-watch` | `fetch('/api/extract-watch', { method: 'POST', body: JSON.stringify({mode:'structured',...}) })` | ✓ WIRED | `handleFindSpecs` at line 143 |
| `StructuredEntryPanel.tsx` | `useStructuredExtractCache` | `import` + `cache.get(key)` before fetch | ✓ WIRED | Cache check at line 123; `cache.set()` on success at line 151 |
| `StructuredEntryPanel.tsx` | `CatalogPhotoUploader` | `import` + JSX inline (always rendered) | ✓ WIRED | Line 232; D-16 always-rendered pattern |
| `StructuredEntryPanel.tsx` | `VerdictSkeleton` | `import` + `{isExtracting && <VerdictSkeleton />}` | ✓ WIRED | Line 261; in-place loading state |
| `StructuredEntryPanel.tsx` | `ExtractErrorCard mode="structured"` | `import` + conditional render with `mode="structured"` | ✓ WIRED | Line 265–271 |
| `useWatchSearchVerdictCache` | `AddWatchFlow.tsx` | `import` + `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` | ✓ WIRED | Line 146 in AddWatchFlow.tsx |
| `useUrlExtractCache` | `AddWatchFlow.tsx` | `import` + `useUrlExtractCache(viewerUserId)` | ✓ WIRED | Line 151 in AddWatchFlow.tsx |
| `useWatchSearchVerdictCache` | `WatchSearchRowsAccordion.tsx` | required `viewerUserId` prop + call site | ✓ WIRED | Line 53 in WatchSearchRowsAccordion.tsx |
| `useWatchSearchVerdictCache` | `AllTabResults.tsx` | `viewerUserId={viewerId}` JSX prop (Rule 3 auto-fix) | ✓ WIRED | Line 115 in AllTabResults.tsx |
| `listCatalogBrands()` | `/watch/new/page.tsx` | added to `Promise.all`, prop-drilled as `catalogBrands` | ✓ WIRED | Lines 5, 90–94, 136 in page.tsx |
| `AddWatchFlow.tsx` | `SearchEntry` / `StructuredEntryPanel` | NO IMPORT (phase boundary: dormant) | ✓ CORRECT (dormant) | Only comment references; no import; Phase 70 owns mounting |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SearchEntry.tsx` | `results: SearchCatalogWatchResult[]` | `searchCatalogForAddFlow` Server Action → `searchCatalogForAddFlow` DAL (Phase 67, live DB query) | Yes — Phase 67 DAL returns live catalog rows with viewerState hydration | ✓ FLOWING |
| `SearchEntry.tsx` | `seeded` (brand/model/reference) | `parseSearchQuery(query, catalogBrands)` — pure function over SSR-fetched brand list | Yes — catalogBrands is real DB data from `listCatalogBrands()` | ✓ FLOWING |
| `StructuredEntryPanel.tsx` | `onSubmitStructured(result)` payload | `/api/extract-watch?mode=structured` → Phase 66 LLM extraction | Yes — Phase 66 route extension ships LLM-extracted ExtractedWatchData | ✓ FLOWING |
| `useCatalogSearchCache` | module-scope Map | Populated by `searchCatalogForAddFlow` result on cache miss | Yes — writes from live Server Action response | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| parseSearchQuery 10 test cases | `npm run test -- --run parseSearchQuery.test.ts` | 10/10 pass | ✓ PASS |
| useCatalogSearchCache 4 tests | `npm run test -- --run useCatalogSearchCache.test.ts` | 4/4 pass | ✓ PASS |
| useStructuredExtractCache 5 tests | `npm run test -- --run useStructuredExtractCache.test.ts` | 5/5 pass | ✓ PASS |
| useUrlExtractCache 4 tests | `npm run test -- --run useUrlExtractCache.test.ts` | 4/4 pass | ✓ PASS |
| useWatchSearchVerdictCache 6 tests | `npm run test -- --run useWatchSearchVerdictCache.test.ts` | 6/6 pass | ✓ PASS |
| ExtractErrorCard 18 tests (15 existing + 3 new) | `npm run test -- --run ExtractErrorCard.test.tsx` | 18/18 pass | ✓ PASS |
| StructuredEntryPanel 10 tests | `npm run test -- --run StructuredEntryPanel.test.tsx` | 10/10 pass | ✓ PASS |
| SearchEntry 19 tests | `npm run test -- --run SearchEntry.test.tsx` | 19/19 pass | ✓ PASS |
| AddWatchFlow 13 tests (CLNP-07 integration) | `npm run test -- --run AddWatchFlow.test.tsx` | 13/13 pass | ✓ PASS |
| Build gate (authoritative per memory) | `npm run build` | exit 0, "✓ Compiled successfully in 7.0s" | ✓ PASS |

---

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared or found for this phase. Step 7c: SKIPPED — behavioral spot-checks cover the same surface.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SRCH-17 | Plan 05 | User can type in search input as primary entry | ✓ SATISFIED | `SearchEntry.tsx` — `Combobox.Input` with placeholder "Search by brand, model, or reference" |
| SRCH-18 | Plan 05 | Results fire at ≥2 chars with ~250 ms debounce | ✓ SATISFIED | `SearchEntry.tsx:132,139` — length gate `< 2` + `setTimeout(..., 250)` |
| SRCH-19 | Plan 05 | Row shows brand, model, reference, cover photo, viewer-state badge | ✓ SATISFIED | `SearchEntry.tsx:273–300` — cover photo circle, HighlightedText brand+model, reference, "In collection"/"On wishlist" pills |
| SRCH-20 | Plan 05 | Keyboard nav via role=listbox + role=option | ✓ SATISFIED | `@base-ui/react/combobox` provides headless ARIA contract; SearchEntry.test.tsx test 8 asserts role=combobox/listbox/option |
| SRCH-21 | Plan 05 | Clicking a result advances flow | ✓ SATISFIED | `SearchEntry.tsx:211–213` — `onValueChange → onPick(picked)`; Phase 70 owns routing |
| SRCH-22 | Plan 05 | Matched text highlighted via HighlightedText | ✓ SATISFIED | `SearchEntry.tsx:274,282` — two HighlightedText calls |
| SRCH-23 | Plan 05 | Owners count displayed ("47 collectors") | ✓ SATISFIED | `SearchEntry.tsx:286` — `{r.ownersCount} collectors` |
| SRCH-24 | Plan 05 | "Not finding it?" footer when results > 0 | ✓ SATISFIED | `SearchEntry.tsx:309–315` — footer button inside Combobox.List |
| SRCH-25 | Plan 05 | No-match empty state mounts StructuredEntryPanel | ✓ SATISFIED | `SearchEntry.tsx:106–108,327` — `forceClose` derives the trigger; `{showStructuredPanel && <StructuredEntryPanel>}` |
| SRCH-26 | Plans 01+05 | Query pre-seeds structured panel fields | ✓ SATISFIED | `parseSearchQuery.ts` D-12 algorithm; `SearchEntry.tsx:112–114` — `seeded` derived state; passed as `initialBrand/Model/Reference` |
| EXTR-05 | Plan 04 | VerdictSkeleton loading state; explicit "Find specs" button gates LLM call | ✓ SATISFIED | `StructuredEntryPanel.tsx:247,261` — button disabled without brand+model; `{isExtracting && <VerdictSkeleton />}` |
| EXTR-06 | Plan 04 | CatalogPhotoUploader inline on structured panel | ✓ SATISFIED | `StructuredEntryPanel.tsx:232–241` — CatalogPhotoUploader always rendered (not behind reveal) |
| EXTR-07 | Plan 04 | "Have a URL for this watch?" backup link | ✓ SATISFIED | `StructuredEntryPanel.tsx:275–284` — ghost Button with EXTR-07 copy verbatim; fires `onSwitchToUrl()` |
| CLNP-07 | Plans 02+03+06 | All 4 caches clear on signOut via lastUserId check | ✓ SATISFIED | 2 new caches (Plan 02) + 2 retrofit (Plan 03) + integration test (Plan 06 — 13/13 pass) |

**14/14 requirements satisfied.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/AddWatchFlow.tsx` | 118 | `_catalogBrands` destructured but intentionally unused | ℹ️ Info | Intentional dormancy — Phase 70 is the consumer; commented as such |
| `src/app/watch/new/page.tsx` | (comments) | Comment mentions "SearchEntry" and "Phase 70 mounts" | ℹ️ Info | Forward-reference comment — expected for phase-boundary design |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase 69 file. No stubs found — all components are fully wired in isolation; dormancy is by design per phase boundary (Phase 70 owns mounting into AddWatchFlow).

---

### Phase Boundary Check (Dormant Components)

VERIFIED: `SearchEntry` and `StructuredEntryPanel` are NOT imported in `src/components/watch/AddWatchFlow.tsx` or `src/app/watch/new/page.tsx`. Only comment references exist. This is correct — Phase 70 owns the AddWatchFlow state machine rewrite that mounts them. The components are dormant but functional in isolation (all tests pass against real data sources).

---

### Human Verification Required

The following items require live browser verification on prod (horlo.app) per the `feedback_mobile_ui_verify_on_prod` memory. Bundle with Phase 70 and 71 into a single push when possible.

#### 1. Debounce and Row Content

**Test:** Navigate to `/watch/new` on prod. Type "speedmaster" character-by-character. Watch for when network requests fire.
**Expected:** Network call fires approximately 250 ms after the last keystroke; not on every keystroke. Results rows show brand (e.g. "Omega"), model ("Speedmaster"), reference if present, cover photo (circle with watch image), and "In collection" / "On wishlist" badge for any catalog watches in your collection or wishlist.
**Why human:** Debounce wall-clock timing, network round-trip, cover photo image rendering, and badge visual presentation cannot be confirmed by static analysis.

#### 2. Keyboard Navigation (WAI-ARIA combobox)

**Test:** With results visible, press Down arrow repeatedly; press Up; press Enter on a highlighted result.
**Expected:** Each Down/Up keystroke moves visual focus to the next/previous result row. Enter fires selection. Escape dismisses the popup.
**Why human:** WAI-ARIA combobox keyboard behavior is provided headlessly by @base-ui/react/combobox 1.3.0; ARIA attributes are present in code but live browser keyboard interaction is the authoritative check.

#### 3. No-Match Panel Expand and Collapse

**Test:** Type "zzzmadeupwatch" (or similar non-existent query ≥ 3 chars). Observe what happens to the UI.
**Expected:** Popup closes; StructuredEntryPanel appears inline below the search input; brand/model/reference fields are pre-seeded from the query; "Have a URL for this watch?" ghost link is visible. Then clear the query or type something with results — StructuredEntryPanel collapses.
**Why human:** Inline expand/collapse behavior and visual layout in a real browser viewport — particularly the panel's integration with the surrounding page structure and scroll behavior.

#### 4. SRCH-24 Footer Expand

**Test:** Type "omega" or another known brand that returns results > 0. Verify the "Not finding it? Add manually" footer row is visible below the results list. Click it.
**Expected:** Footer row is visible and tap-target sized (≥44px height). Clicking it expands StructuredEntryPanel inline below the search input with query-derived brand/model/reference pre-seeded.
**Why human:** SRCH-24 footer sits inside the Combobox.List popup — its visual position, scrollability, and tap-target legibility require live browser testing.

---

### Summary

Phase 69 delivers what it claimed. All 5 success criteria are satisfied at the code level:

1. **SC#1 (debounce + row content):** 250 ms `setTimeout` + 2-char floor gate in code; result rows render all required fields in JSX — wired and substantive.
2. **SC#2 (HighlightedText + owners count):** Two `<HighlightedText>` calls per row + `{r.ownersCount} collectors` literal — verified.
3. **SC#3 (keyboard ARIA):** `@base-ui/react/combobox` headless primitive provides the full WAI-ARIA contract; 19 SearchEntry tests pass including role assertions — code-verified; browser behavior is the human-verification item.
4. **SC#4 (no-match panel + footer + URL backup):** `forceClose` derived flag + inline `StructuredEntryPanel` mount + SRCH-24 footer button + EXTR-07 ghost link — all wired and tested.
5. **SC#5 (four-cache signOut hygiene):** All four caches have `if (moduleUserId !== viewerUserId)` reset block + stale-write guard; CLNP-07 integration test in AddWatchFlow.test.tsx proves user-switch clears all four — 13/13 pass.

The `npm run build` gate exits 0. 14/14 requirements marked complete. Phase boundary is clean — SearchEntry and StructuredEntryPanel ship dormant; Phase 70 owns mounting.

Status is `human_needed` (not `passed`) because SC#3 keyboard behavior and SC#4 panel expand/collapse require live browser verification — these are structural and behavioral UI tests that cannot be fully validated by static analysis.

---

_Verified: 2026-05-29T22:44:30Z_
_Verifier: Claude (gsd-verifier)_
