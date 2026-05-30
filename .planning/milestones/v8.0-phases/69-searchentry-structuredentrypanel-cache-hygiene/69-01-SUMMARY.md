---
phase: 69
plan: 01
subsystem: searchEntry / catalog DAL
tags: [pure-helper, dal, parseSearchQuery, listCatalogBrands, srch-26, d-12, d-13]
requires:
  - watchesCatalog table (already exists)
  - drizzle-orm `asc` + `selectDistinct` (already imported)
provides:
  - parseSearchQuery(query, catalogBrands) → {brand, model, reference} pure helper
  - listCatalogBrands(): Promise<string[]> DAL fn (SSR per-request)
affects:
  - src/data/catalog.ts (additive — append-only)
  - src/lib/searchEntry/ (new directory)
tech-stack:
  added: []
  patterns:
    - "Pure helper file-level fn (mirror of `extractedToPartialWatch` in AddWatchFlow.tsx)"
    - "Drizzle ORM `selectDistinct().from().orderBy(asc(...))` DAL pattern"
key-files:
  created:
    - src/lib/searchEntry/parseSearchQuery.ts
    - src/lib/searchEntry/parseSearchQuery.test.ts
  modified:
    - src/data/catalog.ts (+39 lines — listCatalogBrands appended)
decisions:
  - "D-12 algorithm implemented exactly per CONTEXT.md: normalize trim+collapse+lower → sort catalog by length DESC → whitespace-bounded prefix match → on hit return original-case catalog brand + title-cased model + last digit-bearing reference; on miss naive 3-token split preserving user casing for brand"
  - "Hit-branch model is title-cased (Test 1 'omega speedmaster 3135' → model 'Speedmaster'); miss-branch preserves user input casing exactly (Test 5 'cartier' stays lowercase)"
  - "D-13 DAL uses Drizzle ORM `selectDistinct` (NOT raw sql); NO 'use cache' / cacheLife — per-request SSR fetch is intentional per CONTEXT.md D-13"
  - "Year is NEVER returned from parseSearchQuery — caller (Plan 04 StructuredEntryPanel) handles year as a separate field per SRCH-26 spec"
  - "Single-token-no-digit miss-branch input ('speedmaster') returns brand=that-token, model='', reference='' — Test 6 verbatim. Multi-token brand-miss with digit-bearing tail uses naive split (Test 5)"
metrics:
  duration: "~3 min"
  completed: "2026-05-29T04:48:03Z"
  tasks: 2
  files_changed: 3
  loc_added: 306
  loc_removed: 0
  test_cases: 10
  commits: 2
---

# Phase 69 Plan 01: SearchEntry/StructuredEntryPanel Cache Hygiene — Foundations Summary

Pure D-12 query parser + per-request D-13 catalog brand list DAL — two leaf modules shipped dormant for Plans 04–06 to consume.

## What Was Built

**1. `src/lib/searchEntry/parseSearchQuery.ts`** (165 LOC) — Pure helper implementing the D-12 longest-prefix brand match algorithm with naive 3-token fallback.

Algorithm steps (CONTEXT.md D-12, verbatim):
1. Normalize input: trim → collapse internal whitespace → lowercase
2. Empty input → all-empty fast-path
3. Build `(original, normalized)` brand tuples; sort by `normalized.length` DESC so multi-word brands (e.g. "Tag Heuer") win over single-word prefixes ("Tag")
4. Find first whitespace-bounded prefix match in normalized query (char after match is space or EOS — never partial-word like "rolexX")
5. On hit: `brand` = original-case catalog value; remainder split into model (title-cased) + reference (LAST digit-bearing token)
6. On miss: naive split. First token = brand (preserving user casing). For multi-token: LAST digit-bearing token (index ≥ 1) = reference; in-between tokens join into model. For single-token: brand-only return.

Year is NEVER returned — caller handles it as a separate field per SRCH-26.

**2. `src/lib/searchEntry/parseSearchQuery.test.ts`** (102 LOC) — 10 vitest cases covering all 6 canonical CONTEXT.md examples (a–f) plus 3 edge cases plus return-shape assertion.

**3. `src/data/catalog.ts` (modified, +39 LOC)** — Appended `listCatalogBrands(): Promise<string[]>` DAL fn:

```ts
export async function listCatalogBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: watchesCatalog.brand })
    .from(watchesCatalog)
    .orderBy(asc(watchesCatalog.brand))
  return rows.map((r) => r.brand)
}
```

- Drizzle ORM `selectDistinct` (NOT raw sql)
- **NO `'use cache'` / `cacheLife`** — INTENTIONAL per D-13: per-request SSR fetch at navigation-to-page cadence; cheap SELECT DISTINCT (~100 rows in prod); brand-list staleness has no behavioral failure mode (D-12 naive split covers novel brands).
- Zero arguments: public-read RLS on `watches_catalog` already allows it without viewer identity.
- Returns ORIGINAL-case brand values so D-12 can preserve catalog casing on a hit.

## Test Cases Pinned

| # | Case | Query | catalogBrands | Result |
|---|------|-------|---------------|--------|
| a | D-12 brand hit + model + ref | `omega speedmaster 3135` | `[Omega, Rolex]` | `{Omega, Speedmaster, 3135}` |
| b | D-12 multi-word brand (length-DESC wins) | `tag heuer monaco 1133b` | `[Tag, Tag Heuer, Rolex]` | `{Tag Heuer, Monaco, 1133b}` |
| c | D-12 brand + model, no ref | `rolex datejust` | `[Rolex]` | `{Rolex, Datejust, ""}` |
| d | D-12 brand only | `omega` | `[Omega]` | `{Omega, "", ""}` |
| e | D-12 brand miss naive | `cartier 4329xx` | `[Omega, Rolex]` | `{cartier, "", 4329xx}` |
| f | D-12 single-token brand miss | `speedmaster` | `[Omega]` | `{speedmaster, "", ""}` |
| 7 | edge: empty input | `""` | `[Omega]` | `{"", "", ""}` |
| 8 | edge: whitespace collapse | `  omega   speedmaster  3135  ` | `[Omega]` | `{Omega, Speedmaster, 3135}` |
| 9 | length-DESC sanity (Tag listed first) | `tag heuer monaco` | `[Tag, Tag Heuer]` | `{Tag Heuer, Monaco, ""}` |
| 10 | return-shape: only brand/model/reference (no year key) | — | — | `Object.keys === [brand, model, reference]` |

All 10 cases pass with `npm run test -- --run src/lib/searchEntry/parseSearchQuery.test.ts` exit 0.

## Deviations from Plan

None — plan executed exactly as written. The plan's "casing preservation" clarification was followed verbatim (hit-branch model is title-cased; miss-branch brand preserves user input casing for Test 5).

Minor doc-only clarification: the JSDoc originally said "no 'use client' directive" — the literal string `'use client'` in prose caused the `grep -c "'use client'"` acceptance check to return 1. Reworded to "no client directive" (semantics identical; satisfies the explicit grep-based acceptance criterion verbatim). No code behavior changed.

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| `src/lib/searchEntry/parseSearchQuery.ts` exists | ✓ |
| `src/lib/searchEntry/parseSearchQuery.test.ts` exists | ✓ |
| `grep -c "^export function parseSearchQuery" === 1` | ✓ |
| `grep -c "'use client'" === 0` | ✓ |
| `npm run test ... parseSearchQuery.test.ts` exit 0 | ✓ (10/10 tests pass) |
| Signature `(query: string, catalogBrands: string[]) → {brand, model, reference}` | ✓ |
| No React/Drizzle/Next imports in parser | ✓ |
| `grep -c "^export async function listCatalogBrands" === 1` | ✓ |
| `selectDistinct` present in fn body | ✓ |
| No `'use cache'` in fn body | ✓ |
| `asc` imported from `drizzle-orm` | ✓ (already present in shared import list) |
| `npm run build` exit 0 | ✓ |

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | parseSearchQuery pure helper + test suite (TDD: RED → GREEN) | `8929887d` |
| 2 | listCatalogBrands DAL fn (Drizzle selectDistinct, no use-cache) | `ec0a0540` |

## Downstream Wiring (out of scope for this plan)

- **Plan 04** (StructuredEntryPanel) — will consume `parseSearchQuery(query, catalogBrands)` to pre-seed the brand/model/reference fields when SearchEntry emits its no-match expand
- **Plan 06** (page.tsx + AddWatchFlow plumbing) — will add `listCatalogBrands()` to the `/watch/new` page's `Promise.all` SSR fetch and prop-drill `catalogBrands: string[]` through `AddWatchFlow` → `SearchEntry`

Both are independent of the rest of Phase 69 Wave 1 (Plans 02, 03 ship in parallel).

## Threat Flags

None — this plan adds no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The new DAL fn reads public-read-RLS data with no viewer identity; the parser is a pure string-transform with no I/O. CodeQL surface unchanged.

## Self-Check: PASSED

- `src/lib/searchEntry/parseSearchQuery.ts` — FOUND
- `src/lib/searchEntry/parseSearchQuery.test.ts` — FOUND
- `src/data/catalog.ts` modification — listCatalogBrands present (line 839)
- Commit `8929887d` — FOUND
- Commit `ec0a0540` — FOUND
