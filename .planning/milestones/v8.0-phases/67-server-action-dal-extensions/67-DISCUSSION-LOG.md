# Phase 67: Server Action + DAL Extensions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 67-server-action-dal-extensions
**Areas discussed:** Search Action shape, Exact-reference-first sort, DAL helper overlap with `findViewerWatchByCatalogId`, `addWatch` catalogId branch semantics

---

## Search Action shape

### Q1 — How should `searchCatalogForAddFlow` relate to the existing `searchWatchesAction`?

| Option | Description | Selected |
|--------|-------------|----------|
| New sibling action + new DAL fn | Ship `searchCatalogForAddFlow(query)` as a new Server Action in `src/app/actions/search.ts`, and a new sibling DAL fn in `src/data/catalog.ts` that owns the exact-reference-first sort. Two files touched. Zero risk of breaking the /search page. | ✓ |
| Reuse DAL via a `sortMode` param | Add `sortMode: 'popularity' \| 'exact-ref-first'` to existing `searchCatalogWatches`; thin wrapper passes the param. | |
| Extend existing action with a `purpose` flag | Add `purpose: 'browse' \| 'add-flow'` to `searchWatchesAction`. Single action, single DAL, max-DRY but couples consumers. | |

**User's choice:** New sibling action + new DAL fn
**Notes:** Cleanest isolation; /search page stays bit-identical; future divergence (no facets, different limit, etc.) lands in one place.

### Q2 — Auth gate on `searchCatalogForAddFlow`?

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-required, same as `searchWatchesAction` | `getCurrentUser()` first; on UnauthorizedError return `{ success: false, error: 'Not authenticated' }`. Matches every other Server Action. viewerState requires viewerId. | ✓ |
| Auth-required but degraded mode on anon | Auth-required for viewerState hydration, but return rows with `viewerState: null` to anon. | |
| Anonymous-allowed (no viewerState) | Skip auth + viewerState. Breaks SRCH-19 badge contract. | |

**User's choice:** Auth-required, same as `searchWatchesAction`
**Notes:** —

### Q3 — Filter surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Query + limit only | `searchCatalogForAddFlow(query: string, limit?: number)`. No facets. Reflects v8.0 scope. | ✓ |
| Query + limit + viewerState filter | Add `excludeViewerStates?: ('owned' \| 'wishlist')[]`. Speculative. | |
| Full filter passthrough | Mirror `searchWatchesAction`'s movement/size/style/brand/era. Wider test matrix; not needed by any v8.0 requirement. | |

**User's choice:** Query + limit only
**Notes:** —

---

## Exact-reference-first sort

### Q1 — What counts as "exact-reference match"?

| Option | Description | Selected |
|--------|-------------|----------|
| `reference_normalized == queryNormalized` only | Strict reference equality after the standard `regexp_replace(lower(trim(q)), '[^a-z0-9]+', '', 'g')` normalization. | ✓ |
| Reference exact OR (brand exact AND model exact) | Both "311.30.42" and "omega speedmaster" get a sort bump. | |
| Tiered: ref-exact > model-exact > brand-exact > fuzzy | Multi-level CASE WHEN in ORDER BY. Overkill at ~100 catalog rows. | |

**User's choice:** `reference_normalized == queryNormalized` only
**Notes:** Matches the user's mental model when pasting a reference number.

### Q2 — Tie-break after the exact-reference bump?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as existing: popularity-DESC then brand alpha then model alpha | Preserve the existing `ORDER BY (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC` inside each tier. | ✓ |
| Exact-ref by acquisition recency, rest by popularity | Within the bumped group, newest catalog row first (created_at DESC). | |
| Pure alphabetical after the bump | Drop popularity weighting entirely. | |

**User's choice:** Same as existing: popularity-DESC then brand alpha then model alpha
**Notes:** Predictability across surfaces.

---

## DAL helper overlap with `findViewerWatchByCatalogId`

### Q1 — How do we resolve the overlap?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing fn — add `statuses?` param, keep name | Add `statuses?: ('owned' \| 'wishlist')[]` (default `['owned']` preserves BUG-01 callers). Return widens to `{ id, status } \| null`. Single fn, single SQL, single test surface. | ✓ |
| Ship `getWatchIdByCatalogId` as new sibling fn | Two functions, near-duplicate SQL, future drift risk. Matches roadmap's literal naming. | |
| Rename + widen | Rename `findViewerWatchByCatalogId` → `getWatchIdByCatalogId`, add status param. | |

**User's choice:** Extend existing fn — add `statuses?` param, keep name
**Notes:** Widen the return to `{ id, status } | null` so Phase 70 can branch DUPE-01 (owned redirect) vs DUPE-03 (wishlist) without re-querying.

### Q2 — When both owned AND wishlist rows exist for the same catalogId, which wins?

| Option | Description | Selected |
|--------|-------------|----------|
| Owned wins; mirror existing SRCH-10 D-05 | 'owned' beats 'wishlist'. Phase 70 DUPE-01 redirect fires (correct — they own it). | ✓ |
| Most-recent wins regardless of status | Return whichever row has the newer createdAt. Risks mis-routing. | |
| Caller decides — return all matching rows | Return `Array<{ id, status }>`. More flexible but Phase 70 always wants one answer. | |

**User's choice:** Owned wins; mirror existing SRCH-10 D-05
**Notes:** Reuses the well-established precedence from `searchCatalogWatches`.

---

## `addWatch` catalogId branch semantics

### Q1 — What if `getCatalogById(catalogId)` fails (malformed UUID, deleted row, RLS denies)?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast — return `ActionResult` error, no fallback | Return `{ success: false, error: 'Catalog reference not found' }`. Matches Phase 38 D-06 fail-loud direction. | ✓ |
| Silently fall back to upsert from brand/model | More resilient UX, but masks the bug and defeats search-first dedup. | |
| Fail with a discriminated error code | Return `{ success: false, error: 'CATALOG_NOT_FOUND' }`. Better Phase 70 ergonomics. | |

**User's choice:** Fail fast — return `ActionResult` error, no fallback
**Notes:** Free-text error string this phase; typed code is a Phase 70 follow-up if needed.

### Q2 — Trust the catalogId, or cross-check brand/model?

| Option | Description | Selected |
|--------|-------------|----------|
| Trust catalogId — ignore client brand/model when catalogId present | Catalog row IS the truth. Server-side override of brand/model/reference. | ✓ |
| Cross-check + error on mismatch | Fragile across normalization (spaces, case). | |
| Cross-check + error only on hard mismatch | Reference allowed to drift; brand_normalized + model_normalized strict. | |

**User's choice:** Trust catalogId — ignore client brand/model when catalogId present
**Notes:** Matches Phase 38 D-06 spirit (catalog is canonical for identity).

### Q3 — Does the fire-and-forget chain still run when catalogId is supplied?

| Option | Description | Selected |
|--------|-------------|----------|
| Run only enrichment when catalog row needs it; rest always runs | Skip `enrichTasteAttributes` + `applyUserUploadedPhoto` when `style_tags?.length > 0`. ALWAYS run: activity log, watch-overlap notifications, all revalidates. | ✓ |
| Skip enrichment + photo write-through entirely when catalogId supplied | Simpler branch; misses legacy unenriched catalog rows. | |
| Always run the full chain unchanged | Cheapest to ship; redundant LLM calls on already-enriched rows. | |

**User's choice:** Run only enrichment when catalog row needs it; rest always runs
**Notes:** `style_tags?.length > 0` is the cheapest single "already-enriched" signal.

---

## Claude's Discretion

The following items were left to the planner per CONTEXT.md `<decisions>` § Claude's Discretion:

- Server Action result type reuses `SearchCatalogWatchResult` from `@/lib/searchTypes`
- Zod schema shape for the new search action (`{ q: z.string(), limit: z.number().int().min(1).max(50).optional() }`)
- Whether to extract `hydrateViewerStateForCatalogIds(viewerId, topIds)` as a private helper shared between `searchCatalogWatches` and `searchCatalogForAddFlow`, or inline the duplicate hydration block
- Exact placement of `catalogId: z.string().uuid().optional()` inside `insertWatchSchema`
- Exact placement of the server-side brand/model override inside `addWatch`'s body (after Zod parse + photoSourcePath ownership check, before wishlist-sortOrder computation)
- Unit-test layering for the DAL helper extension (4 cases for the new behavior + 1 backward-compat case)
- Integration-test layering for the `addWatch` catalogId branch (5 cases covering each decision)
- Whether to extract a `resolveCatalogIdentity` helper inside `addWatch` that converges the upsert-path and catalogId-supplied-path
- Optional widening of the "already-enriched" signal from `style_tags?.length > 0` to a conservative AND across multiple taste columns if production data demands it

## Deferred Ideas

- **Phase 70 — "Move to Collection" UPDATE-not-INSERT action** (DUPE-03 UI part; Phase 67 ships only the DAL primitive)
- **Phase 70 — typed error codes from `addWatch`** if Phase 70 needs `'CATALOG_NOT_FOUND'` branching
- **Phase 70 — "Add another copy" affordance plumbing** (DUPE-02; mechanically `addWatch` without `catalogId`; no `addWatch` change needed)
- **Helper extraction `hydrateViewerStateForCatalogIds`** if duplicate divergence between `searchCatalogWatches` and `searchCatalogForAddFlow` grows
- **Conservative "already-enriched" signal** (widen `style_tags?.length > 0` to AND with `era_signal IS NOT NULL` if production data shows partial-enrichment rows)
