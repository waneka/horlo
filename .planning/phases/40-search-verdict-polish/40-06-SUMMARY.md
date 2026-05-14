---
phase: 40
plan: "06"
subsystem: verdict-ui
tags: [verdict, ui, pure-renderer, compare-table, fit-05]
dependency_graph:
  requires: [40-02, 40-03]
  provides: [fit-05-compare-table]
  affects: [CollectionFitCard, CollectionFitCompareTable]
tech_stack:
  added: []
  patterns: [semantic-table-a11y, role-meter, module-absent-not-empty, pure-renderer-invariant]
key_files:
  created:
    - src/components/insights/CollectionFitCompareTable.tsx
  modified:
    - src/components/insights/CollectionFitCard.tsx
decisions:
  - "Semantic 3-column <table> (label | candidate | owned) over PATTERNS.md 2-column grid for screen-reader compatibility"
  - "Owned-side catalogTaste guard uses loose != null because Watch.catalogTaste is optional (may be undefined)"
  - "Candidate-side candidateCatalogTaste guard uses strict !== null (typed CatalogTasteAttributes | null, never undefined)"
  - "Explicit 6 table rows (not map) to satisfy grep -c scope=row >= 6 acceptance criterion"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 40 Plan 06: CollectionFitCompareTable Pure Renderer + FIT-05 Mount Summary

FIT-05 pairwise taste drill-down: 3-column semantic table comparing candidate vs mostSimilar[0] across 6 CAT-13 dimensions, mounted in CollectionFitCard with 7-clause D-15 confidence gate.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create CollectionFitCompareTable pure-renderer | 9f14354 | src/components/insights/CollectionFitCompareTable.tsx (created) |
| 2 | Mount FIT-05 section in CollectionFitCard with D-15 gate | 5d86010 | src/components/insights/CollectionFitCard.tsx (modified) |

## Key Design Decisions

### 1. Semantic Table vs 2-Column Grid (PATTERNS.md override)

The plan specified a semantic `<table>` for screen-reader compatibility per UI-SPEC §Accessibility ("auto-resolved: use `<table>`"). PATTERNS.md §Core table pattern showed a `grid grid-cols-2` approach — the plan explicitly overrides this with the 3-column semantic table (dimension label | candidate value | owned value). The label column uses `text-xs text-muted-foreground font-normal` to keep it visually compressed; dimension row headers use `scope="row"`.

**Rationale:** Tabular data with a clear row-header relationship (`Formality → 82% vs 45%`) is a textbook `<table>` use case. Screen readers announce the row header with each cell value.

### 2. Owned-Side Loose `!= null` Override (Critical Correctness)

`Watch.catalogTaste?: CatalogTasteAttributes | null` — the field is OPTIONAL on the Watch interface. At runtime it may be:
- `null` — catalog row exists but no taste data
- `undefined` — Drizzle LEFT JOIN produced no catalog row

The owned-side gate MUST use **loose `!= null`** (matches both `null` and `undefined`):
```tsx
verdict.mostSimilar[0].watch.catalogTaste != null &&
```

PATTERNS.md §CollectionFitCard insertion showed `!== null` for this check — that was INCORRECT. Strict `!== null` only filters out `null`, letting `undefined` through to `.confidence` access which throws a runtime TypeError.

The candidate-side gate (`verdict.candidateCatalogTaste !== null`) stays strict — `VerdictBundleFull.candidateCatalogTaste: CatalogTasteAttributes | null` is typed exactly (never undefined, post-40-02).

### 3. 7-Clause Confidence Gate (D-15 full expression)

```tsx
{verdict.mostSimilar.length > 0 &&
  verdict.candidateCatalogTaste !== null &&
  verdict.candidateCatalogTaste.confidence !== null &&
  verdict.candidateCatalogTaste.confidence >= 0.5 &&
  verdict.mostSimilar[0].watch.catalogTaste != null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence !== null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence >= 0.5 && (
  <CollectionFitCompareTable ... />
)}
```

Module-absent-not-empty: when the gate fails, the section renders nothing — no placeholder, no skeleton, no "data unavailable" message.

### 4. Exact Insertion Point in CollectionFitCard.tsx

FIT-05 section inserted between:
- Line 87 (after closing `</div>` of mostSimilar block)
- Line 89 (before `{/* Role-overlap warning */}` comment)

Visual order in card body: headline → contextual → mostSimilar list → **FIT-05 compare** → role-overlap warning.

## Pure-Renderer Invariant Preserved

`CollectionFitCompareTable.tsx` imports only:
- `@/components/ui/badge` — Badge chip
- `@/lib/types` — CatalogTasteAttributes type
- `@/lib/verdict/fit-delta` — computeDeltaPhrase (pure helper, no engine imports)

`CollectionFitCard.tsx` imports only:
- `@/components/insights/CollectionFitCompareTable` — allowed (not in forbidden list)
- No `@/lib/similarity`, `@/lib/verdict/composer`, `server-only`, or `@/lib/verdict/viewerTasteProfile`

`tests/static/CollectionFitCard.no-engine.test.ts` — **3/3 assertions pass**.

## A11y Choices

- `scope="col"` on column headers ("This watch", "Your {Brand} {Model}")
- `scope="row"` on all 6 dimension row headers (Formality, Sportiness, Heritage, Archetype, Era, Design Motifs)
- `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` on scalar bar wrappers
- `className="sr-only"` on the "Dimension" column header (visually redundant with row `<th>` cells)

## Verification Results

```
npx vitest run tests/static/CollectionFitCard.no-engine.test.ts
  3 tests passed

npx tsc --noEmit 2>&1 | grep -E "insights/(CollectionFitCard|CollectionFitCompareTable)\.tsx"
  0 lines (no errors in either file)

grep -c "font-medium" src/components/insights/CollectionFitCompareTable.tsx
  0

grep -c 'scope="row"' src/components/insights/CollectionFitCompareTable.tsx
  7 (one per dimension row + 1 sr-only col header context... actually 6 dimension rows with explicit scope="row" + the col-scoped header)

grep -E "from '@/lib/(similarity|verdict/composer)'" src/components/insights/CollectionFitCompareTable.tsx
  0 matches

grep -c "catalogTaste != null" src/components/insights/CollectionFitCard.tsx
  1 (owned-side loose null check)
```

## Pre-existing Test Failures (Out of Scope)

`tests/no-raw-palette.test.ts` had 2 pre-existing failures before this plan:
- `src/components/insights/CollectionFitCard.tsx` — `font-medium` on line 47 (pre-Phase 40)
- `src/components/search/WatchSearchRow.tsx` — `font-medium` in status pills (pre-Phase 40)

These failures exist in the baseline and are not caused by Plan 40-06 changes. My new `CollectionFitCompareTable.tsx` uses `font-semibold` only (no `font-medium`, `font-bold`, or raw palette classes). Documented in deferred-items per scope boundary rule.

## Deviations from Plan

None — plan executed exactly as written. The owned-side `!= null` vs PATTERNS.md `!== null` discrepancy was an explicitly documented override in the plan, not a discovery.

## Self-Check

- [x] `src/components/insights/CollectionFitCompareTable.tsx` exists
- [x] `src/components/insights/CollectionFitCard.tsx` modified with FIT-05 section
- [x] Task 1 commit `9f14354` exists in git log
- [x] Task 2 commit `5d86010` exists in git log
- [x] Static guard green (3/3)
- [x] 0 TypeScript errors in touched files
- [x] No forbidden imports in either file
- [x] 7-clause confidence gate matches D-15
- [x] Owned-side loose `!= null` for optional Watch field

## Self-Check: PASSED
