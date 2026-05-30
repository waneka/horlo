---
phase: 67
plan: "02"
subsystem: search-dal
tags:
  - dal
  - server-action
  - search
  - catalog
  - drizzle
dependency_graph:
  requires:
    - "67-01 (findViewerWatchByCatalogId extension)"
  provides:
    - "searchCatalogForAddFlow DAL fn in src/data/catalog.ts"
    - "searchCatalogForAddFlow Server Action in src/app/actions/search.ts"
    - "addFlowSearchSchema Zod schema in src/app/actions/search.ts"
  affects:
    - "Phase 69 SearchEntry typeahead (direct consumer of the new action)"
    - "Phase 70 AddWatchFlow (indirect — search seam provides catalog ID)"
tech_stack:
  added: []
  patterns:
    - "New sibling DAL + Server Action pattern (D-01 — zero /search regression risk)"
    - "Pitfall 1 guard: empty queryNormalized substitutes sql`false` in ORDER BY tier"
    - "Pitfall 4 guard: topIds.length short-circuit before inArray on empty candidates"
    - "Two-tier ORDER BY: (reference_normalized = queryNormalized) DESC + popularity/alpha"
key_files:
  created:
    - tests/data/searchCatalogForAddFlow.test.ts
  modified:
    - src/data/catalog.ts
    - src/app/actions/search.ts
decisions:
  - "D-01: New sibling DAL + Server Action — searchCatalogWatches and searchWatchesAction untouched"
  - "D-03: addFlowSearchSchema has q + limit only — no facets; NOT derived from searchSchema (Pitfall 5)"
  - "D-04/D-05: Two-tier ORDER BY adds reference_normalized exact-match tier above popularity sort"
  - "Pitfall 1: empty queryNormalized uses sql`false` for boolean-DESC tier (no false exact-ref bump)"
  - "Pitfall 4: topIds.length guard before inArray avoids degenerate WHERE IN () SQL"
  - "Named import alias searchCatalogForAddFlowDAL avoids name collision between action and DAL fn"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  files_modified: 2
  files_created: 1
---

# Phase 67 Plan 02: searchCatalogForAddFlow DAL + Server Action Summary

**One-liner:** New `searchCatalogForAddFlow` Server Action + sibling DAL fn with two-tier ORDER BY (exact-reference-first) and anti-N+1 viewerState hydration, delivering the Phase 69 typeahead seam.

## What Was Built

### New DAL Function: `searchCatalogForAddFlow` (`src/data/catalog.ts`)

Placed after `searchCatalogWatches` (D-01 sibling pattern). Key differences from `searchCatalogWatches`:

1. **Two-tier ORDER BY (D-04/D-05):** `(reference_normalized = queryNormalized) DESC` as the first tier puts exact-reference rows first. Below that: `(owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC` — identical to `searchCatalogWatches`.
2. **No facets (D-03):** WHERE is ILIKE OR over `brand_normalized`, `model_normalized`, `reference_normalized` only. No `movement`, `size`, `style`, `brand`, `era` predicates.
3. **Pitfall 1 guard:** When `queryNormalized.length === 0` (e.g. `q = "/-"`), the first ORDER BY tier substitutes `desc(sql\`false\`)` — no rows receive a false exact-ref sort bump.
4. **Pitfall 4 guard:** `topIds.length ? ... : []` before the `inArray` call skips the degenerate `WHERE catalog_id IN ()` SQL when no candidates are found.
5. **Anti-N+1 viewerState hydration:** Single batched `inArray(watches.catalogId, topIds)` keyed by `viewerId` — never per-row.
6. **D-05 owned-wins stateMap loop:** `'owned'` always wins; `'wishlist'` only sets when no prior `'owned'`; `'sold'` and `'grail'` fall through (no badge).

Three new constants placed adjacent to `SEARCH_WATCHES_*`:
- `SEARCH_ADD_FLOW_TRIM_MIN_LEN = 2`
- `SEARCH_ADD_FLOW_CANDIDATE_CAP = 50`
- `SEARCH_ADD_FLOW_DEFAULT_LIMIT = 20`

### New Server Action: `searchCatalogForAddFlow` (`src/app/actions/search.ts`)

Placed after `searchWatchesAction` (D-01 sibling pattern). Key decisions:

1. **Named import alias:** `searchCatalogForAddFlow as searchCatalogForAddFlowDAL` avoids the name collision between the action and the DAL function (both named `searchCatalogForAddFlow`).
2. **New sibling Zod schema `addFlowSearchSchema`:** `{ q: z.string(), limit: z.number().int().min(1).max(50).optional() }` — NOT derived from `searchSchema` (Pitfall 5) and NOT using `.strict()` (the DAL takes explicit destructured params, so unknown fields cannot reach SQL).
3. **Auth-first gate (D-02):** `getCurrentUser()` throws → return `{ success: false, error: 'Not authenticated' }` BEFORE Zod parse.
4. **T-19-02-04 prefix:** `console.error('[searchCatalogForAddFlow] unexpected error:', err)` — DAL error detail NEVER appears in the returned `error` string.

### New Test File: `tests/data/searchCatalogForAddFlow.test.ts`

7-case unit suite with chainable Drizzle mock infrastructure lifted verbatim from `tests/data/searchCatalogWatches.test.ts`:

| Test | What it proves |
|------|---------------|
| Test 1 | 2-char gate returns `[]` without any `db.select()` call |
| Test 2 | ORDER BY captures contain both `reference_normalized` and `owners_count` |
| Test 3 | WHERE has ILIKE OR across all 3 normalized cols; no facet predicates |
| Test 4 | Empty candidates → `selectCount === 1` (viewerState query skipped, Pitfall 4) |
| Test 5 | 3 candidates → `selectCount === 2` with single `inArray` (anti-N+1) |
| Test 6 | wishlist + owned rows for same catalogId → `viewerState: 'owned'` (D-05) |
| Test 7 | Result row has all 8 `SearchCatalogWatchResult` fields wired correctly |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` covers:
- T-67-02-01: Drizzle parameterized sql templates in all WHERE/ORDER BY interpolations
- T-67-02-02: T-19-02-04 prefix in place; generic error returned to client
- T-67-02-03: viewerState hydration WHERE uses `eq(watches.userId, viewerId)` from server session
- T-67-02-04: Auth-first gate before Zod parse
- T-67-02-05: Zod `limit.max(50)` + `SEARCH_ADD_FLOW_CANDIDATE_CAP = 50` ceiling
- T-67-02-06: DAL takes explicit destructured params — no mass-assignment path

## Self-Check: PASSED

| Item | Status |
|------|--------|
| tests/data/searchCatalogForAddFlow.test.ts | FOUND |
| src/data/catalog.ts | FOUND |
| src/app/actions/search.ts | FOUND |
| Task 1 commit 72f8c8a2 | FOUND |
| Task 2 commit c8d334b5 | FOUND |
| Task 3 commit 854c0a0e | FOUND |
