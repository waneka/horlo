---
phase: 82
plan: "01"
subsystem: dal-ssr-brand-list
tags: [dal, ssr-fetch, brand-list, page-prop-drill, refactor]
dependency_graph:
  requires: []
  provides: [listBrands-dal, brandsWithIds-prop-pipeline]
  affects: [src/data/catalog.ts, src/app/watch/new/page.tsx, src/components/watch/AddWatchFlow.tsx, src/components/watch/SearchEntry.tsx, src/components/watch/StructuredEntryPanel.tsx]
tech_stack:
  added: []
  patterns: [drizzle-select-{id,name}, SSR-Promise.all, prop-drill-chain]
key_files:
  created: []
  modified:
    - src/data/catalog.ts
    - src/app/watch/new/page.tsx
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/SearchEntry.tsx
    - src/components/watch/StructuredEntryPanel.tsx
decisions:
  - "D-82-02 implemented: listCatalogBrands renamed to listCatalogBrandNames (string[] preserved); new listBrands() returns { id, name }[] from brands table"
  - "brandsWithIds threaded as optional prop through SearchEntry and StructuredEntryPanel to establish the Plan 02 BrandPicker seam"
  - "Rule 3 auto-fix: SearchEntry and StructuredEntryPanel props extended in this plan (not Plan 02) to allow build to pass with brandsWithIds on the SearchEntry JSX call"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-13"
  tasks_completed: 2
  files_changed: 5
---

# Phase 82 Plan 01: DAL + Page Prep for BrandPicker Summary

**One-liner:** Renamed `listCatalogBrands` → `listCatalogBrandNames` (string[] preserved) and shipped new `listBrands()` DAL returning `{ id, name }[]` from the `brands` table, extended `/watch/new` Promise.all to SSR-fetch both lists, and prop-drilled `brandsWithIds` from page through AddWatchFlow → SearchEntry → StructuredEntryPanel ready for BrandPicker (Plan 02).

## What Was Built

### Task 1 — DAL rename + new sibling (commit `0ce30065`)

- `src/data/catalog.ts`: renamed `export async function listCatalogBrands()` → `export async function listCatalogBrandNames()`. Body byte-identical; returns `string[]` for `parseSearchQuery` / `SearchEntry` callers unchanged.
- Added new `export async function listBrands(): Promise<{ id: string; name: string }[]>` that `SELECT id, name FROM brands ORDER BY name ASC`. No `'use cache'` (matches existing rationale; per-request-fresh, ~100 rows cheap). Uses the already-imported `brands` table from `@/db/schema`.
- Zero remaining references to the old `listCatalogBrands` name in `src/` (grep armor: 0 matches).

### Task 2 — Page SSR fetch + prop threading (commit `985dbcd0`)

- `src/app/watch/new/page.tsx`: updated import to `listCatalogBrandNames, listBrands`; extended `Promise.all` tuple to destructure `catalogBrandNames` + `brandsWithIds`; updated `<AddWatchFlow>` mount to pass both `catalogBrands={catalogBrandNames}` and `brandsWithIds={brandsWithIds}`.
- `src/components/watch/AddWatchFlow.tsx`: added `brandsWithIds: { id: string; name: string }[]` to `AddWatchFlowProps` interface; destructured in function body; passed as `brandsWithIds={brandsWithIds}` to `<SearchEntry>`.
- `src/components/watch/SearchEntry.tsx`: added `brandsWithIds` to `SearchEntryProps` interface and function destructure; forwarded to `<StructuredEntryPanel brandsWithIds={brandsWithIds} ... />`.
- `src/components/watch/StructuredEntryPanel.tsx`: added optional `brandsWithIds?: { id: string; name: string }[]` to `StructuredEntryPanelProps` interface (Plan 02 will destructure and wire to `<BrandPicker>`).

## Verification Results

- `grep -rn "listCatalogBrands\b" src/ | wc -l` → **0** (rename complete)
- `grep -c "export async function listBrands" src/data/catalog.ts` → **1**
- `grep -c "brandsWithIds" src/components/watch/AddWatchFlow.tsx` → **3** (interface + destructure + JSX forward)
- `grep -c "listBrands()" src/app/watch/new/page.tsx` → **1**
- `grep -c "listCatalogBrandNames()" src/app/watch/new/page.tsx` → **1**
- `npm run build` → **exit 0** ("Compiled successfully in 6.2s")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended SearchEntry and StructuredEntryPanel props in Task 2 (not Plan 02)**

- **Found during:** Task 2 — passing `brandsWithIds={brandsWithIds}` to `<SearchEntry>` would fail TypeScript because `SearchEntryProps` didn't include the new prop.
- **Issue:** The plan stated "Plan 02 extends SearchEntry's props to accept-and-forward" but Task 2 passes the prop at the `<SearchEntry>` call site — TypeScript build gate would fail immediately.
- **Fix:** Added `brandsWithIds` to `SearchEntryProps` interface + destructure (thread through to `<StructuredEntryPanel>`), and added optional `brandsWithIds?` to `StructuredEntryPanelProps`. This is minimal additive surface — Plan 02 still owns wiring BrandPicker to consume the value.
- **Files modified:** `src/components/watch/SearchEntry.tsx`, `src/components/watch/StructuredEntryPanel.tsx`
- **Commits:** `985dbcd0`

## Known Stubs

None. `brandsWithIds` flows through the prop chain but is not yet consumed inside `StructuredEntryPanel` — this is intentional. Plan 02 wires `<BrandPicker brands={brandsWithIds ?? []} ... />` to consume it. The prop is optional (`?`) so StructuredEntryPanel renders correctly without it today (falls through; the brand `<Input>` at L220 is unchanged until Plan 02).

## Threat Flags

None. `listBrands()` projects only `id` + `name` from the `brands` table — public catalog data, no PII. Trust boundary analysis per plan threat model: accept (T-82-P01-01/02/03).

## Self-Check: PASSED

- `src/data/catalog.ts` modified: confirmed (grep shows both new functions)
- `src/app/watch/new/page.tsx` modified: confirmed (imports + Promise.all + JSX)
- `src/components/watch/AddWatchFlow.tsx` modified: confirmed (3 brandsWithIds occurrences)
- `src/components/watch/SearchEntry.tsx` modified: confirmed (interface + forward)
- `src/components/watch/StructuredEntryPanel.tsx` modified: confirmed (interface)
- Commits `0ce30065` and `985dbcd0`: confirmed via `git log --oneline -3`
- `npm run build` exit 0: confirmed ("Compiled successfully in 6.2s")
