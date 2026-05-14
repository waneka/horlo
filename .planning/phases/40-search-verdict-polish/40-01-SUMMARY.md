---
phase: 40-search-verdict-polish
plan: 01
subsystem: search-dal
tags: [search, dal, faceted-filters, drizzle, zod, cache, srch-16]

# Dependency graph
requires:
  - phase: 35-layer-b-lineage-edges-structured-movement-era-material
    provides: "movementType pgEnum column on watches_catalog"
  - phase: 40-07
    provides: "REQUIREMENTS.md paperwork (SRCH-16 chip group correction)"
provides:
  - CatalogSearchFilters interface (exported from src/data/catalog.ts)
  - Extended searchCatalogWatches with movement/size/style facet predicates
  - getTopStyleTags cached vocab DAL function
  - Extended searchWatchesAction Zod schema with optional facet fields
  - tests/static/search-dal.movement-type.test.ts (ROADMAP SC#4 guard)
  - tests/actions/search.facets.test.ts (Zod contract)
affects:
  - 40-04 (hook — will call searchWatchesAction with facet params)
  - 40-05 (UI mount — WatchFacetSheet wires to hook state)

# Tech stack
added: []
patterns:
  - Drizzle predicate array composition with and(...predicates) guard (Pitfall 1)
  - 'use cache' + cacheLife('hours') for server-only DAL vocab function
  - Zod .strict() schema extension with optional .enum() fields
  - D-08 NULL exclusion via isNotNull() per active facet

# Key files
created:
  - tests/static/search-dal.movement-type.test.ts
  - tests/actions/search.facets.test.ts
modified:
  - src/data/catalog.ts
  - src/app/actions/search.ts

# Decisions
- Used IIFE pattern `(() => { ... })()` for inline predicate composition inside
  the Drizzle `.where()` call — avoids a named variable at the same indentation
  level as the query chain while keeping the conditional logic readable.
- Drizzle `db.execute()` result cast via `as unknown as Array<{tag: string}>` to
  satisfy TypeScript strict overlap check (RowList is not assignable to typed array
  without double-cast).
- SIZE_BAND_MAP typed as `Record<NonNullable<CatalogSearchFilters['size']>, [number, number]>`
  for compile-time exhaustiveness — ensures all 5 size band keys are covered.
---

# Phase 40 Plan 01: Catalog DAL + Server Action Zod Schema + Cached Style Vocab + Tests Summary

**One-liner:** Drizzle facet predicate composition (movement_type/case_size_mm/style_tags) + Zod schema extension + cached getTopStyleTags + ROADMAP SC#4 static test

**Completed:** 2026-05-14T21:54:00Z
**Duration:** ~18 minutes
**Tasks:** 3/3
**Requirements:** SRCH-16

---

## What Was Built

### New interface: `CatalogSearchFilters` (exported)

```typescript
export interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
}
```

URL band values are ASCII-safe per D-03: `lt36` (not `<36`), `46plus` (not `46+`).

### `SIZE_BAND_MAP` — 5 inclusive bounds (per D-05)

```typescript
const SIZE_BAND_MAP: Record<NonNullable<CatalogSearchFilters['size']>, [number, number]> = {
  lt36: [0, 35.9],
  '36-39': [36, 39],
  '40-42': [40, 42],
  '43-45': [43, 45],
  '46plus': [46, 999],
}
```

Upper bound on `lt36` is 35.9 (not 36) to avoid overlap with `36-39` lower bound. Values in the catalog are typically integer or half-step, so the 0.1mm gap prevents ambiguity.

### Extended `searchCatalogWatches` — browse-mode lift logic (D-01)

```typescript
// Early-return guard — lifted when any facet active
const hasActiveFacet = !!(filters?.movement || filters?.size || filters?.style?.length)
if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN && !hasActiveFacet) return []
```

Empty `q` + no facets → returns `[]` (pre-query state preserved). Empty `q` + any facet active → proceeds to DB query.

### Predicate composition — Pitfall 1 (and() with 0 args)

```typescript
.where((() => {
  const predicates = []

  if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) {
    predicates.push(or(ilike(...), ilike(...), refPattern ? ilike(...) : sql`false`)!)
  }
  if (filters?.movement) {
    predicates.push(isNotNull(watchesCatalog.movementType)!)
    predicates.push(eq(watchesCatalog.movementType, filters.movement)!)
  }
  if (filters?.size) {
    const [min, max] = SIZE_BAND_MAP[filters.size]
    predicates.push(isNotNull(watchesCatalog.caseSizeMm)!)
    predicates.push(between(watchesCatalog.caseSizeMm, min, max)!)
  }
  if (filters?.style?.length) {
    predicates.push(arrayOverlaps(watchesCatalog.styleTags, filters.style)!)
    // No isNotNull needed: styleTags is notNull with default '{}' (D-08)
  }

  return predicates.length > 0 ? and(...predicates) : undefined
})())
```

- D-08 NULL exclusion applied: `isNotNull` on movementType when movement facet active; `isNotNull` on caseSizeMm when size facet active; style is array-typed with `'{}'` default so no guard needed.
- Pitfall 1 resolved: `predicates.length > 0 ? and(...predicates) : undefined` — Drizzle omits WHERE when undefined.

### `getTopStyleTags(limit = 8): Promise<string[]>` — cache contract

```typescript
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  const rows = await db.execute(
    sql`SELECT tag, COUNT(*) AS freq
        FROM watches_catalog, unnest(style_tags) AS tag
        GROUP BY tag
        ORDER BY freq DESC
        LIMIT ${limit}`
  )
  return (rows as unknown as Array<{ tag: string }>).map((r) => r.tag)
}
```

Cache profile: `'hours'` TTL appropriate for catalog metadata that changes only on enrichment runs. Double-cast via `unknown` required for TypeScript RowList compatibility.

### Zod schema additions — field by field

```typescript
const searchSchema = z.object({
  q: z.string().max(200),
  movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),  // closed enum (D-03)
  size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),     // closed enum (D-05)
  style: z.string().max(500).optional(),  // comma-joined; DAL splits (A4 assumption)
}).strict()  // mass-assignment guard preserved (T-40-02)
```

- `movement` and `size`: closed `z.enum` — rejects any value not in the allowlist
- `style`: `z.string().max(500)` — length-bounded raw string; DAL splits/trims/filters
- `.strict()` preserved — rejects unknown keys (T-40-02 mitigation)
- Comment added noting People + Collections actions accept-but-ignore the new fields (D-04)

### Filters passthrough in `searchWatchesAction`

```typescript
filters: {
  movement: parsed.data.movement,
  size: parsed.data.size,
  style: parsed.data.style?.split(',').map((s) => s.trim()).filter(Boolean),
},
```

Style split/trim/filter handles edge cases like `"tool,"` → `['tool']` (Assumption A4).

---

## Tests

### `tests/static/search-dal.movement-type.test.ts` — ROADMAP SC#4

Two assertions:
1. `expect(dalSrc).toMatch(/movementType/)` — positive: DAL references the pgEnum column
2. `expect(dalSrc).not.toMatch(/watchesCatalog\.movement[^TCa]/)` — negative: no deprecated free-text `movement` column reference

The positive assertion PASSES today because `mapRowToCatalogEntry` already touches `movementType` (line 61). The negative assertion is the load-bearing guard — it fires if any future code adds `watchesCatalog.movement` (no T/C/a suffix).

### `tests/actions/search.facets.test.ts` — Zod contract (4 cases)

| Case | Input | Expected | State |
|------|-------|----------|-------|
| 1 | `{ q: 'sub', movement: 'auto' }` | `{ success: true }` | GREEN after Task 3 |
| 2 | `{ q: 'sub', size: '40-42', style: 'tool,diver' }` | `{ success: true }` | GREEN after Task 3 |
| 3 | `{ q: 'sub', movement: 'invalid_enum' }` | `{ success: false, error: 'Invalid request' }` | was PASS (strict), GREEN |
| 4 | `{ q: 'sub', extraneousKey: 'x' }` | `{ success: false, error: 'Invalid request' }` | was PASS (strict), GREEN |

Cases 1+2 were RED during Task 1 (schema rejected facet keys via .strict()). Tasks 2+3 turned all 4 GREEN.

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7e42b29 | test | add Wave 0 RED tests for SRCH-16 DAL + Zod facet contract |
| 73a1c87 | feat | extend searchCatalogWatches with movement/size/style facets + getTopStyleTags vocab DAL |
| b35b95e | feat | extend searchWatchesAction Zod schema with optional movement/size/style + DAL passthrough |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- The IIFE pattern `(() => { ... })()` for predicate composition inside `.where()` was used as an implementation choice. The plan described building `const predicates: SQL[] = []` outside the query chain — the IIFE keeps the logic co-located with `.where()` which is equally valid.
- TypeScript required a double-cast `as unknown as Array<{tag: string}>` for the `db.execute()` result in `getTopStyleTags` — the `RowList<Record<string, unknown>[]>` type does not overlap with `{tag: string}[]`. This is idiomatic for raw SQL execution in Drizzle.

---

## Known Stubs

None. This plan produces no UI-facing components with stub data. The DAL functions will return empty arrays when no catalog data matches facets — this is correct behavior (not a stub).

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are:
- Extensions to an existing DAL function (parameterized Drizzle operators only — T-40-01 mitigated)
- Extension to an existing Zod schema (closed enums + .strict() preserved — T-40-02 mitigated)
- New cached read-only DAL function (no auth surface — T-40-04 accepted)

## Self-Check: PASSED

Files verified:
- `src/data/catalog.ts` — exists, contains CatalogSearchFilters, SIZE_BAND_MAP, getTopStyleTags, 'use cache'
- `src/app/actions/search.ts` — exists, contains movement Zod field, .strict() preserved
- `tests/static/search-dal.movement-type.test.ts` — exists, 2 tests passing
- `tests/actions/search.facets.test.ts` — exists, 4 tests passing

Commits verified:
- 7e42b29 — test(40-01): add Wave 0 RED tests
- 73a1c87 — feat(40-01): extend searchCatalogWatches + getTopStyleTags
- b35b95e — feat(40-01): extend searchWatchesAction Zod schema
