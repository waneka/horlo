---
phase: 67-server-action-dal-extensions
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/app/actions/search.ts
  - src/app/actions/watches.ts
  - src/data/catalog.ts
  - src/data/watches.ts
  - tests/actions/watches.test.ts
  - tests/data/findViewerWatchByCatalogId.test.ts
  - tests/data/searchCatalogForAddFlow.test.ts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 67: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 67 ships three server-side primitives: a `searchCatalogForAddFlow` Server Action + DAL function, a `findViewerWatchByCatalogId` extension, and an `addWatch` catalogId branch. The auth-gate pattern, Zod validation, DAL error handling, and anti-N+1 hydration are all correctly structured.

Two correctness bugs were found: (1) the D-10 reference override silently passes a client-supplied reference through when the catalog row has `reference = null`, violating the stated intent that the catalog row IS the identity truth; and (2) the D-05 ORDER BY spec mandates `DESC NULLS LAST` for the exact-reference tier but the implementation emits plain `DESC`, causing rows with `reference_normalized IS NULL` to sort unexpectedly above non-matching rows in PostgreSQL's default NULLS-first-under-DESC behavior.

Three warnings were also found: the `addFlowSearchSchema` `q` field has no `.max()` length cap (unlike every other search action in the file), the `limit` parameter is double-capped via `Math.min` in `searchCatalogForAddFlow` DAL but not in `searchCatalogWatches` (inconsistent), and the `linkWatchToCatalog` function has been marked `@deprecated` since Phase 38 but is still exported and sitting in the production DAL.

---

## Critical Issues

### CR-01: D-10 reference override silently preserves client-supplied reference when catalog row has `reference = null`

**File:** `src/app/actions/watches.ts:136`

**Issue:** The D-10 server-side identity override reads:

```typescript
if (catalogRow.reference) cleanData.reference = catalogRow.reference
```

`CatalogEntry.reference` is typed `string | null`. When the catalog row has `reference = null` (i.e., the watch has no reference number), the `if` guard is falsy and `cleanData.reference` is never overwritten. Whatever reference string the client supplied in the request body is silently passed through to `createWatch` and written to the watches row.

D-10 states: "the catalog row IS the identity truth for the (brand, model, reference) tuple." For watches with no catalog reference, the canonical value is `null`, but the action lets a client forge any reference string they want.

Because the `upsertCatalogFromUserInput` path (the non-catalogId branch at line 145–158) does pass through client-supplied reference verbatim, this inconsistency is particularly sharp on the catalogId branch where the catalog identity is supposed to be authoritative.

**Fix:** Always assign `cleanData.reference` from the catalog row, including when it is null:

```typescript
// D-10: catalog row IS the identity truth — always override reference,
// even when catalogRow.reference is null (null is the canonical value
// for watches with no reference number).
cleanData.brand = catalogRow.brand
cleanData.model = catalogRow.model
cleanData.reference = catalogRow.reference ?? undefined  // null → undefined matches Watch domain type
```

Note: `Watch.reference` is typed `string | undefined` (optional), so the domain-correct coercion is `null → undefined`.

---

### CR-02: ORDER BY tier 1 emits `DESC` without `NULLS LAST`, violating D-05 spec and causing NULL reference rows to sort unexpectedly

**File:** `src/data/catalog.ts:559-562`

**Issue:** The D-05 spec in `67-CONTEXT.md` explicitly states:

> `ORDER BY (reference_normalized = ${queryNormalized}) DESC NULLS LAST, ...`

The implementation builds the first ORDER BY tier as:

```typescript
const exactRefOrderTier =
  queryNormalized.length > 0
    ? desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`)
    : desc(sql`false`)
```

Plain `desc()` in Drizzle emits `DESC` without any NULLS modifier. In PostgreSQL, `DESC` defaults to `NULLS FIRST` (NULLs sort before any non-NULL value). The expression `(reference_normalized = queryNormalized)` evaluates to NULL (not false) for rows where `reference_normalized IS NULL`. This means watches without a reference number sort into *tier 1 position* (before non-matching watches that have a reference), which is the exact opposite of the intended ordering — they should sort last under `NULLS LAST`.

For any query that produces a mix of (a) exact-reference matches (true), (b) non-matching rows that have a reference (false), and (c) rows with no reference (NULL), the actual sort order will be `NULL, true, false` instead of the intended `true, false, NULL`.

Drizzle's column modifier API (`nullsLast()`) is available on the sort expression:

```typescript
import { sql, desc } from 'drizzle-orm'

const exactRefOrderTier =
  queryNormalized.length > 0
    ? sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST`
    : sql`false DESC NULLS LAST`
```

Or using Drizzle's typed helper on the raw SQL expression (check if the `.nullsLast()` chainable is available on `SQL` objects in the installed Drizzle version; if not, the raw SQL string in the template literal above is the safe fallback):

**Fix:**

```typescript
const exactRefOrderTier =
  queryNormalized.length > 0
    ? sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST`
    : sql`false DESC NULLS LAST`
```

And in the `.orderBy()` call, pass `exactRefOrderTier` directly (it is already a SQL fragment):

```typescript
.orderBy(
  exactRefOrderTier,   // already contains DESC NULLS LAST
  desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
  asc(watchesCatalog.brandNormalized),
  asc(watchesCatalog.modelNormalized),
)
```

---

## Warnings

### WR-01: `addFlowSearchSchema` `q` field has no `.max()` length cap

**File:** `src/app/actions/search.ts:140`

**Issue:** The `addFlowSearchSchema` Zod schema declares:

```typescript
const addFlowSearchSchema = z.object({
  q: z.string(),
  limit: z.number().int().min(1).max(50).optional(),
})
```

`q` has no `.max()` constraint. Every other search action in this same file uses `q: z.string().max(200)`. The comment on line 135-138 explains that `.strict()` was intentionally omitted (and gives a sound reason — the DAL takes explicit destructured params), but it says nothing about the missing length cap.

The DAL's 2-char floor gate (`if (qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN) return []`) only rejects short queries, not arbitrarily long ones. A caller could send a 100KB query string — it will be trimmed to 2+ chars and hit the DB as a valid ILIKE pattern.

**Fix:** Add `.max(200)` consistent with the existing search schemas in the same file:

```typescript
const addFlowSearchSchema = z.object({
  q: z.string().max(200),
  limit: z.number().int().min(1).max(50).optional(),
})
```

---

### WR-02: `candidates.slice` is double-capped in `searchCatalogForAddFlow` but not in `searchCatalogWatches` — inconsistent and redundant

**File:** `src/data/catalog.ts:598`

**Issue:** `searchCatalogForAddFlow` slices candidates with:

```typescript
const top = candidates.slice(0, Math.min(limit, SEARCH_ADD_FLOW_CANDIDATE_CAP))
```

But `searchCatalogWatches` uses:

```typescript
const top = candidates.slice(0, limit)
```

The `Math.min(limit, SEARCH_ADD_FLOW_CANDIDATE_CAP)` guard is redundant because:
1. The DB query already has `.limit(SEARCH_ADD_FLOW_CANDIDATE_CAP)` so `candidates.length` can never exceed `SEARCH_ADD_FLOW_CANDIDATE_CAP`.
2. The Zod schema in the action caps `limit` at 50 — the same value as `SEARCH_ADD_FLOW_CANDIDATE_CAP`.

The inconsistency with `searchCatalogWatches` makes it harder to reason about which version is "correct" and signals that one or both sites has a latent misunderstanding of the cap contract. If `limit` were ever made larger than `CANDIDATE_CAP` through direct DAL calls (bypassing the action's Zod cap), `searchCatalogWatches` would over-slice while `searchCatalogForAddFlow` would correctly cap — but neither behavior is tested for this case.

**Fix:** Match the simpler `searchCatalogWatches` pattern (the cap is already enforced by `.limit()`):

```typescript
const top = candidates.slice(0, limit)
```

Or, if the defensive cap is intentional for direct DAL callers, apply it consistently in both functions and document it explicitly.

---

### WR-03: `linkWatchToCatalog` is exported and unreferenced — dead production code

**File:** `src/data/watches.ts:399-408`

**Issue:** `linkWatchToCatalog` has carried `@deprecated` since Phase 38 D-06 and the comment on line 397 says "Mark for deletion in Polish." The function has no callers in the current codebase (confirmed via grep — the only reference in `src/` is the comment in `watches.ts:175`). It is still exported, meaning it is part of the public surface of the DAL module. Any new engineer reading this module will need to reason about whether it is still used somewhere they can't see, and TypeScript's unused-export check won't fire on it.

This is not a Phase 67 addition, but Phase 67 touched this file and is an appropriate moment to clean it up (it costs no migration and no behavioral change).

**Fix:** Delete the function body and its export. If a script or backfill tool calls it externally, it will fail at import time with a clear error (preferable to silent dead code).

---

## Info

### IN-01: Test coverage gap — D-10 reference null-clear case not tested

**File:** `tests/actions/watches.test.ts:401-433`

**Issue:** The `addWatch — catalogId branch (CONF-11)` test suite covers: (a) no-upsert path, (b) missing row fail-fast, (c) brand override (D-10), (d) enrichment skip, and (e) enrichment trigger. It does not cover the case where `catalogRow.reference = null` and the client sends a non-null reference — i.e., the scenario where D-10 should clear the client-supplied reference. This gap means CR-01 above would not have been caught by the test suite even if a test ran against the fix.

**Fix:** Add a test case:

```typescript
it('(f) catalogId + catalog row reference=null → created watch has reference=null (D-10 clears client-supplied reference)', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
  const rowWithNoRef = { ...catalogRow, reference: null }
  vi.mocked(catalogDAL.getCatalogById).mockResolvedValue(rowWithNoRef as any)
  vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
  vi.mocked(findOverlapRecipients).mockResolvedValue([])
  await addWatch({ ...validWatch, brand: 'WRONG', reference: 'FAKE-REF', catalogId: CATALOG_UUID })
  expect(watchDAL.createWatch).toHaveBeenCalledWith(
    'u-1',
    CATALOG_UUID,
    expect.not.objectContaining({ reference: 'FAKE-REF' }),
  )
})
```

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
