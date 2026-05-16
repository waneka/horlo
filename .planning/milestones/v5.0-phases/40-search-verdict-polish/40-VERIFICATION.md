---
phase: 40-search-verdict-polish
verified: 2026-05-14T22:16:28Z
status: approved
milestone_close_approval: "2026-05-16 — operator approved at v5.0 milestone close; SearchPageClient.test.tsx regression fixed at commit 083c251 (6/6 green, re-run verified), accepted"
score: 4/5
overrides_applied: 0
gaps:
  - truth: "Three faceted filters narrow results without page reload — test regression: SearchPageClient.test.tsx fails (6/6) due to missing mock fields"
    status: failed
    reason: "Phase 40 added movement/size/styleArr destructured from useSearchState() and required styleVocab prop to SearchPageClient, but tests/components/search/SearchPageClient.test.tsx was not updated. The test mocks useSearchState without movement/size/styleArr fields, causing TypeError: Cannot read properties of undefined (reading 'length') at SearchPageClient.tsx:102 (styleArr.length). All 6 SearchPageClient tests crash. The no-raw-palette test also reports 2 pre-existing failures (font-medium in CollectionFitCard + WatchSearchRow — present before Phase 40, confirmed by git log)."
    artifacts:
      - path: "tests/components/search/SearchPageClient.test.tsx"
        issue: "Mock useSearchState missing movement/size/styleArr/setMovement/setSize/setStyleArr fields added by Phase 40. Component now crashes when mock returns undefined for styleArr."
      - path: "src/components/search/SearchPageClient.tsx"
        issue: "No regression in the implementation itself — the SearchPageClient code is correct. The gap is the unfixed test."
    missing:
      - "Update tests/components/search/SearchPageClient.test.tsx: add movement: null, size: null, styleArr: [], setMovement: vi.fn(), setSize: vi.fn(), setStyleArr: vi.fn() to the mockSearchState object, and add styleVocab={[]} to all SearchPageClient render calls."
---

# Phase 40: Search & Verdict Polish — Verification Report

**Phase Goal:** Add three faceted filters to the `/search` Watches tab (SRCH-16) and ship the pairwise drill-down section in CollectionFitCard (FIT-05), giving collectors taste-aware search refinement and side-by-side comparison.
**Verified:** 2026-05-14T22:16:28Z
**Status:** approved (operator-approved at v5.0 milestone close, 2026-05-16; SearchPageClient.test.tsx regression fixed at commit 083c251 — 6/6 green)
**Re-verification:** No — initial verification; gap resolved post-verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Three faceted filters (Movement/CaseSize/Style) narrow results without page reload | VERIFIED | DAL predicates, hook facet state, URL sync, and chip components all verified. 17/17 Phase 40 targeted tests pass (`tests/static/search-dal.movement-type.test.ts` 2/2, `tests/actions/search.facets.test.ts` 4/4, `tests/static/CollectionFitCard.no-engine.test.ts` 3/3, `tests/unit/lib/verdict/fit-delta.test.ts` 8/8). |
| 2 | Mobile bottom-sheet + URL share-link round-trip | VERIFIED | `FilterSheet.tsx` uses `side="bottom"` (no responsive variant). URL params `movement`/`size`/`style` written unconditionally in `useSearchState` (survive tab switches per D-04). Case size values ASCII-safe: `lt36`/`36-39`/`40-42`/`43-45`/`46plus`. |
| 3 | CollectionFitCard gains pairwise drill-down with delta row | VERIFIED | `CollectionFitCompareTable.tsx` renders 6 CAT-13 taste fields (formality, sportiness, heritageScore, primaryArchetype, eraSignal, designMotifs). Semantic `<table>` layout with label column + 2 value columns (candidate / owned) — no responsive variant per D-13. `computeDeltaPhrase` call at line 107. D-15 confidence gate in `CollectionFitCard.tsx` (lines 90-103). |
| 4 | DAL test asserts `movement_type` pgEnum (not deprecated `movement`) — ROADMAP SC#4 | VERIFIED | `tests/static/search-dal.movement-type.test.ts` 2/2 pass: positive assertion (`movementType` reference found) and negative assertion (no bare `watchesCatalog.movement[^TCa]` reference). `src/data/catalog.ts` references `watchesCatalog.movementType` at 5 locations; `eq(watchesCatalog.movementType, filters.movement)` at line 385. |
| 5 | Phase 35 dependency — `movement_type` pgEnum exists; Phase 40 references correctly | VERIFIED | `src/db/schema.ts` line 38: `export const movementTypeEnum = pgEnum('movement_type_enum', ['auto', 'manual', 'quartz', 'spring_drive'])`. Schema lines 97-98: `movementType: movementTypeEnum('movement_type')`. Phase 40 DAL uses the ORM column reference, not deprecated free-text. |

**Score (goal-backward truths):** 5/5 — all observable truths verified at implementation level.

**Test suite score:** 4/5 — existing `tests/components/search/SearchPageClient.test.tsx` breaks (6/6 fail) because Phase 40 extended `SearchPageClient`'s prop interface and `useSearchState` return shape without updating this test file.

---

### Deferred Items

None identified. All gaps are Phase 40 regressions, not items intentionally deferred to later phases.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/data/catalog.ts` | `searchCatalogWatches` with facet predicates + `getTopStyleTags` | VERIFIED | `CatalogSearchFilters` interface (lines 274-278), `SIZE_BAND_MAP` (lines 286-292), movement/size/style WHERE predicates (lines 382-399), `getTopStyleTags` function (lines 474-485). Browse-mode guard lifted at line 337-338. |
| `src/app/actions/search.ts` | Zod schema with optional movement/size/style facet fields | VERIFIED | `searchSchema` extends with `movement: z.enum([...]).optional()`, `size: z.enum([...]).optional()`, `style: z.string().max(500).optional()`. `.strict()` preserved. `searchWatchesAction` passes `filters` object to DAL (lines 101-110). |
| `src/components/search/useSearchState.ts` | Facet state + URL sync + Watches sub-effect facet deps | VERIFIED | 3 new `useState` slices (movement/size/styleArr). URL sync effect includes facet params unconditionally (line 129). Watches sub-effect dep array: `[debouncedQ, tab, movement, size, styleArr]` (line 229). `hasActiveFacet` computed for browse-mode guard (line 189). |
| `src/app/search/page.tsx` | `styleVocab` thread from Server Component | VERIFIED | `getTopStyleTags(8)` in `Promise.all` (line 47). `styleVocab={styleVocab}` prop passed to `SearchPageClient` (line 56). |
| `src/components/search/SearchPageClient.tsx` | Filter button + sheet mount + browse-mode empty state | VERIFIED | Filter button (lines 162-173) with active-count badge. `WatchFacetSheet` mount (lines 183-193). `WatchesPanel` hasActiveFacet prop. Browse-mode empty state branch (lines 330-338). |
| `src/components/search/FilterSheet.tsx` | Bottom-sheet shell, exports `WatchFacetSheet` | VERIFIED | `side="bottom"` (line 47). Three chip group mounts. "Clear all" footer button (lines 65-71). |
| `src/components/search/MovementChips.tsx` | Movement chip group with 4 options | VERIFIED | `MOVEMENT_OPTIONS as const` with `auto/manual/quartz/spring_drive`. Single-select toggle. `font-semibold` on selected state. |
| `src/components/search/CaseSizeChips.tsx` | Case size chip group with 5 ASCII-safe bands | VERIFIED | `CASE_SIZE_OPTIONS as const` with `lt36/36-39/40-42/43-45/46plus` values. Labels use en-dash (`36–39mm`). |
| `src/components/search/StyleChips.tsx` | Style multi-select chip group from vocab prop | VERIFIED | Multi-select toggle logic. `vocab: string[]` prop consumed. OR-logic semantics through styleArr join to comma string. |
| `src/components/insights/CollectionFitCard.tsx` | FIT-05 mount with D-15 confidence gate | VERIFIED | Lines 89-103: 7-clause gate. Owned-side uses loose `!= null` (line 94 — `Watch.catalogTaste` is optional). Candidate-side uses strict `!== null` (line 91). `CollectionFitCompareTable` import is NOT a forbidden engine import. |
| `src/components/insights/CollectionFitCompareTable.tsx` | Pure renderer with 6 taste fields + delta row | VERIFIED | 6 CAT-13 rows rendered (formality/sportiness/heritageScore/primaryArchetype/eraSignal/designMotifs). `computeDeltaPhrase` called at line 107. Section title: "Compare with the {brand} {model} you own". |
| `src/lib/verdict/types.ts` | `VerdictBundleFull.candidateCatalogTaste` added | VERIFIED | Line 36: `candidateCatalogTaste: CatalogTasteAttributes | null`. Typed as exactly null (not optional/undefined), matching strict gate in `CollectionFitCard`. |
| `src/lib/verdict/composer.ts` | Threads `candidateCatalogTaste` with Number() coercion | VERIFIED | Lines 99-110: wires `catalogEntry` fields through `Number()` coercion for formality/sportiness/heritageScore/confidence. Returns `null` when no `catalogEntry`. |
| `src/lib/verdict/fit-delta.ts` | Pure `computeDeltaPhrase` helper, no forbidden imports | VERIFIED | D-16 algorithm: scalar deltas (lines 21-33), categorical deltas (lines 35-36), motif Jaccard (lines 39-43), threshold guard (lines 46-56), winner selection (lines 58-79), phrase emission (lines 89-116). Zero imports from `@/lib/similarity` or `@/lib/verdict/composer`. |
| `tests/static/search-dal.movement-type.test.ts` | Source-text guard: movementType positive + movement negative | VERIFIED | 2/2 pass. Positive: `expect(dalSrc).toMatch(/movementType/)`. Negative: `expect(dalSrc).not.toMatch(/watchesCatalog\.movement[^TCa]/)`. |
| `tests/unit/lib/verdict/fit-delta.test.ts` | 8 D-16 scenario unit tests | VERIFIED | 8/8 pass. Covers: "Very similar" fallback, formality high/low, sportiness high/low, heritage high, archetype mismatch, era mismatch, motif mismatch, null scalar exclusion. |
| `tests/actions/search.facets.test.ts` | 4 Zod schema cases | VERIFIED | 4/4 pass. Covers: valid movement, valid size+style, invalid movement enum, extraneous key `.strict()` guard. |
| `tests/static/CollectionFitCard.no-engine.test.ts` | Pure-renderer invariant — must remain green | VERIFIED | 3/3 pass. No `@/lib/similarity`, no `@/lib/verdict/composer`, no `server-only` imports in `CollectionFitCard.tsx`. `CollectionFitCompareTable.tsx` not in the forbidden list (allowed: `@/lib/verdict/fit-delta`). |
| `.planning/REQUIREMENTS.md` | SRCH-16 updated to chip group (Plan 07) | VERIFIED | "chip group with 5 pre-defined size bands" present (grep count = 1). "numeric range slider" absent (grep count = 0). "Resolved per Phase 40 D-05." appended. |
| `tests/components/search/SearchPageClient.test.tsx` | Must remain green after Phase 40 prop/hook changes | FAILED | 6/6 tests crash — mock missing `movement`, `size`, `styleArr` fields and `styleVocab` prop not passed. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useSearchState` facet state | `searchWatchesAction` | Hook Watches sub-effect passes `movement`, `size`, `style` to action | WIRED | `src/components/search/useSearchState.ts` lines 202-209: `searchWatchesAction({ q: debouncedQ, movement: movement ?? undefined, size: size ?? undefined, style: styleArr.length > 0 ? styleArr.join(',') : undefined })` |
| `searchWatchesAction` | `searchCatalogWatches` | Passes `filters` object with parsed fields | WIRED | `src/app/actions/search.ts` lines 101-110. `filters.style` is split from comma string. |
| `searchCatalogWatches` | `watchesCatalog.movementType` | `eq(watchesCatalog.movementType, filters.movement)` | WIRED | `src/data/catalog.ts` lines 383-386: `isNotNull` + `eq` predicates. |
| `/search` Server Component | `SearchPageClient` | `styleVocab` prop from `getTopStyleTags(8)` | WIRED | `src/app/search/page.tsx` lines 43-47, line 56. `getTopStyleTags` in `Promise.all`. |
| `WatchFacetSheet` chip taps | `useSearchState` setters | `onMovementChange`/`onSizeChange`/`onStyleChange` callbacks | WIRED | `src/components/search/SearchPageClient.tsx` lines 186-192. Callbacks directly call `setMovement`/`setSize`/`setStyleArr`. |
| URL params | Facet state on mount | `searchParams.get('movement'/'size'/'style')` in `useState` initializers | WIRED | `src/components/search/useSearchState.ts` lines 88-96. Round-trip confirmed by Zod schema ASCII-safe values matching chip option values. |
| `VerdictBundleFull.candidateCatalogTaste` | `CollectionFitCard` D-15 gate | Verdict bundle prop received and gate evaluated | WIRED | `src/components/insights/CollectionFitCard.tsx` lines 90-93: strict `!== null` check + `.confidence >= 0.5` check on `verdict.candidateCatalogTaste`. |
| `CollectionFitCard` D-15 gate | `CollectionFitCompareTable` | Conditional render when gate passes | WIRED | `CollectionFitCard.tsx` lines 90-103: 7-clause condition guards the `<CollectionFitCompareTable>` mount. |
| `CollectionFitCompareTable` | `computeDeltaPhrase` | Import from `@/lib/verdict/fit-delta` | WIRED | `CollectionFitCompareTable.tsx` line 3: `import { computeDeltaPhrase } from '@/lib/verdict/fit-delta'`. Called at line 107. Result rendered at line 188. |
| `computeVerdictBundle` (composer) | `VerdictBundleFull.candidateCatalogTaste` | `candidateCatalogTaste: catalogEntry ? { ... } : null` | WIRED | `src/lib/verdict/composer.ts` lines 96-110. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `SearchPageClient.tsx` `WatchesPanel` | `watchesResults` | `searchWatchesAction` → `searchCatalogWatches` → Drizzle ORM query with facet predicates | Yes — DB query with parameterized predicates, not static return | FLOWING |
| `CollectionFitCompareTable.tsx` | `candidate`, `owned` (CatalogTasteAttributes) | `verdict.candidateCatalogTaste` threaded from `computeVerdictBundle` which reads `catalogEntry` from DAL | Yes — sourced from real catalog DB rows via LEFT JOIN in `getWatchesByUser` | FLOWING |
| `StyleChips.tsx` | `vocab` | `getTopStyleTags(8)` server-side DB query (SQL `unnest(style_tags)` + COUNT) | Yes — real DB aggregate, cached 1hr | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DAL references `movementType` pgEnum | `grep -c "movementType" src/data/catalog.ts` | 5 | PASS |
| `candidateCatalogTaste` wired in types + composer + card | `grep -c "candidateCatalogTaste" src/lib/verdict/types.ts src/lib/verdict/composer.ts src/components/insights/CollectionFitCard.tsx` | 1, 1, 4 | PASS |
| Phase 40 targeted tests pass | `npx vitest run tests/static/search-dal.movement-type.test.ts tests/actions/search.facets.test.ts tests/unit/lib/verdict/fit-delta.test.ts tests/static/CollectionFitCard.no-engine.test.ts` | 17/17 pass | PASS |
| TypeScript errors in Phase 40 files | `npx tsc --noEmit 2>&1 | grep -E "(src/data/catalog|src/app/actions/search|src/app/search/page|src/components/search/|src/components/insights/CollectionFit|src/lib/verdict/)" | wc -l` | 0 | PASS |
| `side="bottom"` in FilterSheet (no responsive variant) | `grep -n "side=" src/components/search/FilterSheet.tsx` | `side="bottom"` at line 47 only | PASS |
| Pure-renderer invariant: no forbidden engine imports | `grep -c "from '@/lib/similarity'\|from '@/lib/verdict/composer'" src/components/insights/CollectionFitCard.tsx src/components/insights/CollectionFitCompareTable.tsx` | 0, 0 | PASS |
| `SearchPageClient.test.tsx` regression | `npx vitest run tests/components/search/SearchPageClient.test.tsx` | 6/6 FAIL — TypeError `undefined.length` at SearchPageClient.tsx:102 | FAIL |

---

### Probe Execution

No probe scripts defined for this phase (not a migration or tooling phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SRCH-16 | 40-01, 40-04, 40-05, 40-07 | Three faceted filters on `/search` Watches tab with mobile bottom-sheet | SATISFIED (with gap) | DAL predicates, Zod schema, hook state, chip components, sheet — all implemented and wired. `SearchPageClient.test.tsx` regression noted as gap. |
| FIT-05 | 40-02, 40-03, 40-06 | Pairwise drill-down in `CollectionFitCard` with confidence gate and delta row | SATISFIED | `CollectionFitCompareTable` renders 6 CAT-13 fields. D-15 gate correct. `computeDeltaPhrase` wired. 8/8 delta unit tests pass. Pure-renderer invariant maintained. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/insights/CollectionFitCard.tsx` | 47, 48, 129 | `font-medium` | Warning | Pre-existing violation present before Phase 40 (confirmed by git log: `85fe53f` Phase 20-03 introduced it). Phase 40 commit `5d86010` did NOT add `font-medium`. `no-raw-palette.test.ts` was already failing before Phase 40. |
| `src/components/search/WatchSearchRow.tsx` | 59, 64 | `font-medium` | Warning | Pre-existing violation (Phase 19-03 introduced it, last modified Phase 20.1). Not a Phase 40 regression. |
| `tests/components/search/SearchPageClient.test.tsx` | 138, 168, 222, 246, 265, 271-283 | Missing `movement/size/styleArr` in mock + missing `styleVocab` prop in render calls | BLOCKER | Phase 40 regression — component interface extended by Phase 40 but test not updated. 6/6 tests crash with `TypeError: Cannot read properties of undefined (reading 'length')`. |

---

### Human Verification Required

**1. Mobile bottom-sheet open/close + URL share-link round-trip**

**Test:** Open `/search`, type `sub`, click the Watches tab, open the Filter sheet, tap Movement=auto + Style=tool (if available), copy the URL, open in a new tab.
**Expected:** Facets are restored, results are filtered accordingly. Sheet opens as a bottom sheet on mobile.
**Why human:** Visual UX and clipboard behavior cannot be verified programmatically.

**2. FIT-05 drill-down renders on viewer with collection + confident catalog taste**

**Test:** Sign in as twwaneka@gmail.com, navigate to `/search`, type `Sub`, expand a verdict row (a Submariner or similar) — the "Compare with the [Brand Model] you own" section should appear with 6 rows and a delta phrase.
**Expected:** Section visible below "Most Similar in Collection" list. Both columns show real data. Delta phrase is one of the D-16 template phrases.
**Why human:** End-to-end verdict pipeline with real catalog taste data requires a running app with populated DB.

**3. FIT-05 confidence gate — hides cleanly when either side has null/low-confidence**

**Test:** Find a catalog watch where `catalogTaste IS NULL` or `confidence < 0.5`, search it, expand the verdict row.
**Expected:** "Compare with the [Brand Model] you own" section does NOT render. Rest of `CollectionFitCard` (headline, mostSimilar list, role overlap) still renders.
**Why human:** Module-absent-not-empty visual check requires specific catalog state in the DB.

---

### Gaps Summary

**1 blocker gap found** preventing a clean PASS:

**Gap: `tests/components/search/SearchPageClient.test.tsx` — Phase 40 test regression (6/6 tests fail)**

Phase 40 changed `SearchPageClient` in two ways that broke the existing test file:

1. Added `styleVocab: string[]` as a required prop. All 6 test render calls pass `SearchPageClient` without `styleVocab`, causing a TypeScript error (though vitest doesn't error on missing props in JSX — the runtime crash is from (2)).

2. Destructures `movement`, `size`, `styleArr` (plus their setters) from `useSearchState()`. The test mocks `useSearchState` without these fields. At runtime, `styleArr` is `undefined`, and line 102 of `SearchPageClient.tsx` calls `styleArr.length`, crashing with `TypeError: Cannot read properties of undefined (reading 'length')`.

**Fix required:** Update `tests/components/search/SearchPageClient.test.tsx`:
- Add `movement: null, size: null, styleArr: [], setMovement: vi.fn(), setSize: vi.fn(), setStyleArr: vi.fn()` to `mockSearchState`.
- Add `styleVocab={[]}` to all 6 `render(<SearchPageClient ...>)` calls.

The implementation itself (`SearchPageClient.tsx`, `useSearchState.ts`, `FilterSheet.tsx`, and all chip components) is correct and verified. The regression is isolated to the test file.

**Pre-existing non-blockers (noted for awareness):**
- `font-medium` in `CollectionFitCard.tsx` and `WatchSearchRow.tsx` — confirmed pre-existing (Phase 20 and 19 respectively), not introduced by Phase 40. `no-raw-palette.test.ts` has 2 pre-existing failures. Phase 40's new components all use `font-semibold`.
- `tasteOverlap.test.ts` 1-test failure — pre-existing (last relevant change: Phase 35, `0bf392c`). Not a Phase 40 regression.

---

_Verified: 2026-05-14T22:16:28Z_
_Verifier: Claude (gsd-verifier)_
