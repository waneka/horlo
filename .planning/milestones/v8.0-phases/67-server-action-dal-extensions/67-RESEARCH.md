# Phase 67: Server Action + DAL Extensions — Research

**Researched:** 2026-05-28
**Domain:** Next.js 16 Server Actions, Drizzle ORM DAL extensions, PostgreSQL query patterns
**Confidence:** HIGH

## Summary

Phase 67 delivers three server-side primitives that Phase 68/69/70 UI components consume: a new `searchCatalogForAddFlow` Server Action + sibling DAL function, an `addWatch` extension for optional `catalogId` passthrough, and an extension to `findViewerWatchByCatalogId` that returns `status` alongside `id` for the wishlist-path in Phase 70.

All three deliverables are surgical extensions to well-established code. The codebase has mature precedents for every pattern required — the implementation risk is low. The main complexity is correctness at the seams: the `addWatch` catalogId branch touches the existing enrichment chain, and the `findViewerWatchByCatalogId` return-type widening touches one existing caller (`/w/[ref]/page.tsx`) that only reads `.id`, making the TypeScript upgrade non-breaking.

**Primary recommendation:** Implement all three primitives in one or two plans, guided by the detailed decision log in CONTEXT.md. Each has a clear reference implementation in the codebase to follow exactly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Search Action shape — `searchCatalogForAddFlow`**
- D-01: New sibling Server Action + new sibling DAL function. Ship `searchCatalogForAddFlow` as a new export in `src/app/actions/search.ts` next to `searchWatchesAction`, AND a new fn in `src/data/catalog.ts` next to `searchCatalogWatches`. The existing `searchWatchesAction` + `searchCatalogWatches` are NOT modified.
- D-02: Auth-required; same `ActionResult` contract as `searchWatchesAction`. `getCurrentUser()` runs FIRST; on `UnauthorizedError` return `{ success: false, error: 'Not authenticated' }`.
- D-03: Query + limit only — no facet surface. Action signature: `searchCatalogForAddFlow(input: unknown): Promise<ActionResult<SearchCatalogWatchResult[]>>` where the Zod schema accepts `{ q: string, limit?: number }`. Default limit 20. No movement/size/style/brand/era filters.

**Sort behavior — exact-reference-first**
- D-04: Exact match = `reference_normalized = queryNormalized` only. `queryNormalized = regexp_replace(lower(trim(q)), '[^a-z0-9]+', '', 'g')`.
- D-05: Two-tier ORDER BY: `ORDER BY (reference_normalized = ${queryNormalized}) DESC NULLS LAST, (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC`.

**DAL helper overlap — `findViewerWatchByCatalogId`**
- D-06: Extend existing `findViewerWatchByCatalogId` (do not rename, do not duplicate). Add optional third parameter `statuses?: ('owned' | 'wishlist')[]` with default `['owned']`.
- D-07: Widen return type to `{ id: string; status: 'owned' | 'wishlist' } | null`.
- D-08: Owned wins over wishlist when both rows exist: `ORDER BY CASE status WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END, created_at DESC LIMIT 1`.

**`addWatch` catalogId branch semantics**
- D-09: Fail-fast on invalid catalogId — return `ActionResult` error, no silent fallback to upsert. Error string: `'Catalog reference not found'`.
- D-10: Trust the catalogId — server-side override `parsed.data.brand`, `parsed.data.model`, and `parsed.data.reference` with `catalogRow.brand`, `catalogRow.model`, `catalogRow.reference` BEFORE passing to `createWatch`.
- D-11: Skip taste enrichment + photo write-through ONLY when the catalog row's `style_tags` are already populated (`catalogRow.styleTags?.length > 0`). ALWAYS run: `logActivity`, `findOverlapRecipients`, `logNotification`, `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `revalidateTag('profile:${username}', 'max')`, `revalidateTag('explore', 'max')`.

### Claude's Discretion

- **Server Action result type:** reuse `SearchCatalogWatchResult` from `@/lib/searchTypes` — no new public type needed.
- **Zod schema for `searchCatalogForAddFlow`:** `z.object({ q: z.string(), limit: z.number().int().min(1).max(50).optional() })` — explicit limit cap of 50; `q` not pre-length-gated (DAL enforces the 2-char floor).
- **DAL helper-extraction call:** if extracting `hydrateViewerStateForCatalogIds(viewerId, topIds)`, the helper lives in `src/data/catalog.ts` as module-private (non-exported). Planner may inline instead.
- **`addWatch` schema field addition:** `catalogId: z.string().uuid().optional()` placed in `insertWatchSchema` next to `imageUrl`.
- **Server-side brand/model override placement:** after Zod parse + photoSourcePath ownership check, BEFORE wishlist-sortOrder computation block. Build `createPayload` with `brand: catalogRow.brand, model: catalogRow.model, reference: catalogRow.reference`.
- **Unit test layering for DAL helper:** in `src/data/__tests__/watches.test.ts` (or `tests/data/` equivalent — see test location analysis below). Five cases: (a) owned-only → returns owned; (b) wishlist-only → returns wishlist; (c) both → returns owned (D-08); (d) neither → returns null; (e) default invocation → owned-only (BUG-01 backward compat).
- **Integration test for `addWatch` catalogId branch:** in `tests/actions/watches.test.ts`. Five cases: (a) catalogId + row exists → no `upsertCatalogFromUserInput` call; (b) catalogId + row missing → `{success: false, error: 'Catalog reference not found'}`; (c) catalogId + client brand="WRONG" → created watch has `brand = catalogRow.brand`; (d) catalogId + `style_tags = ['dress']` → no `enrichTasteAttributes` call; (e) catalogId + `style_tags = []` → `enrichTasteAttributes` IS called.

### Deferred Ideas (OUT OF SCOPE)

- Phase 70 "Move to Collection" UPDATE-not-INSERT action
- Phase 70 typed error codes from `addWatch`
- Phase 70 "Add another copy" affordance plumbing
- Helper extraction `hydrateViewerStateForCatalogIds` (planner discretion)
- Conservative "already-enriched" signal widening (planner discretion)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-11 | `addWatch` Server Action Zod schema gains optional `catalogId: z.string().uuid()`; when supplied, the action calls `getCatalogById(catalogId)` to bind the user's watch row to the existing catalog row (skipping redundant `upsertCatalogFromUserInput`) | `insertWatchSchema` in `src/app/actions/watches.ts:22-68`; `getCatalogById` at `src/data/catalog.ts:254`; D-09/D-10/D-11 decision log covers semantics completely |
| DUPE-01 (DAL part) | New `findViewerWatchByCatalogId` extended to return the user's owned watch id for a catalog row they own | Existing fn at `src/data/watches.ts:295-317`; D-06/D-07/D-08 cover extension semantics; return widening is backward-compatible with the one existing caller |
| DUPE-03 (DAL part) | Same fn returns the user's wishlist watch id (status surfaced for Phase 70 to branch on) | Same fn; `statuses: ['owned', 'wishlist']` parameter addition; D-07 return type `{ id: string; status: 'owned' | 'wishlist' } | null` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catalog typeahead search | API / Backend (Server Action + DAL) | — | Auth-gated; viewer-state hydration needs session; all prior search fns follow this pattern |
| `addWatch` catalogId passthrough | API / Backend (Server Action) | Database (DAL read) | Action already owns the add flow; catalogId is a new optional param on the existing boundary |
| `findViewerWatchByCatalogId` extension | Database / Storage (DAL) | — | Pure DB read; no network calls; status field is additional projection from the same query |
| viewerState badge hydration in search | Database / Storage (DAL) | — | Anti-N+1 batch inArray pattern; lives in DAL alongside candidate query |
| Test coverage for DAL helper | API / Backend (test layer) | — | Unit tests mock the DB; integration tests mock catalog DAL |

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `drizzle-orm` | existing | Candidate + state queries | `inArray`, `and`, `eq`, `desc`, `sql` all used in `searchCatalogWatches` |
| `zod` | existing | Action input validation | `z.string().uuid().optional()` for catalogId; `z.object({ q, limit? })` for search |
| `next/cache` | existing | `revalidatePath` / `revalidateTag` | Same calls as existing `addWatch` |
| `@/lib/auth` | existing | `getCurrentUser` / `UnauthorizedError` | Auth-first gate; identical to `searchWatchesAction` |
| `@/lib/actionTypes` | existing | `ActionResult<T>` discriminated union | Same envelope; never-throws-across-boundary contract |
| `@/lib/searchTypes` | existing | `SearchCatalogWatchResult` | Exact shape the new action returns |

**No new packages required.** [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
Client (Phase 69 SearchEntry)
    │
    ▼  Server Action call
searchCatalogForAddFlow(input)          src/app/actions/search.ts
    │
    ├─ getCurrentUser()                  → UnauthorizedError → { success: false }
    ├─ Zod parse { q, limit? }          → validation error → { success: false }
    └─ searchCatalogForAddFlowDAL(q, viewerId, limit)
            │
            ├─ candidates query         → WHERE ILIKE OR (brand/model/ref normalized)
            │                              ORDER BY (ref_normalized = queryNorm) DESC,
            │                                       popularity DESC, alpha ASC
            │                              LIMIT 50 → slice to limit
            ├─ viewerState hydration    → SINGLE inArray(catalogId, topIds) + eq(userId)
            └─ return SearchCatalogWatchResult[]

Client (Phase 68/70 ConfirmStep / AddWatchFlow)
    │
    ▼  Server Action call
addWatch(data)                          src/app/actions/watches.ts
    │
    ├─ getCurrentUser()
    ├─ Zod parse (includes optional catalogId)
    ├─ photoSourcePath ownership check
    ├─ IF catalogId supplied:
    │       └─ getCatalogById(catalogId)   → null → { success: false, error: '...' }
    │          override brand/model/ref
    │          skip upsertCatalogFromUserInput
    │   ELSE:
    │       └─ upsertCatalogFromUserInput (existing path)
    ├─ createWatch(userId, catalogId, createPayload)
    ├─ IF catalogId AND styleTags.length === 0:  enrichTasteAttributes + updateCatalogTaste
    ├─ IF photoSourcePath AND styleTags.length === 0: applyUserUploadedPhoto
    ├─ logActivity
    ├─ IF owned: findOverlapRecipients + logNotification × N
    └─ revalidatePath / revalidateTag

DAL extension
findViewerWatchByCatalogId(userId, catalogId, statuses?)
    │
    ├─ WHERE userId + catalogId + status IN statuses
    ├─ ORDER BY CASE status (owned=0, wishlist=1) DESC, created_at DESC
    └─ LIMIT 1 → { id, status } | null
```

### Recommended File Layout

```
src/app/actions/
├── search.ts           ← ADD: export searchCatalogForAddFlow (next to searchWatchesAction)
└── watches.ts          ← MODIFY: insertWatchSchema + addWatch catalogId branch

src/data/
├── catalog.ts          ← ADD: searchCatalogForAddFlow DAL fn (next to searchCatalogWatches)
└── watches.ts          ← MODIFY: findViewerWatchByCatalogId signature + return type

tests/actions/
└── watches.test.ts     ← ADD: catalogId branch integration tests (5 cases from CONTEXT.md)

tests/data/
└── searchCatalogWatches.test.ts  ← CONSIDER: separate file for the new DAL fn tests,
                                     OR add to existing file with clear describe block
```

### Pattern 1: Auth-First Server Action Gate

All Server Actions in this codebase follow an identical auth-first pattern. The new `searchCatalogForAddFlow` must follow it verbatim.

```typescript
// Source: src/app/actions/search.ts:97-106 (searchWatchesAction — canonical)
export async function searchCatalogForAddFlow(
  input: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = addFlowSearchSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }
  // ... DAL call
}
```
[VERIFIED: src/app/actions/search.ts]

### Pattern 2: Anti-N+1 ViewerState Hydration

The existing `searchCatalogWatches` at `src/data/catalog.ts:471-499` is the reference implementation. The new DAL fn must replicate this exactly (or share a private helper).

```typescript
// Source: src/data/catalog.ts:471-499 (searchCatalogWatches — exact pattern)
const stateRows = topIds.length
  ? await db
      .select({ catalogId: watches.catalogId, status: watches.status })
      .from(watches)
      .where(and(eq(watches.userId, viewerId), inArray(watches.catalogId, topIds)))
  : []

const stateMap = new Map<string, 'owned' | 'wishlist'>()
for (const row of stateRows) {
  if (!row.catalogId) continue
  const prior = stateMap.get(row.catalogId)
  if (row.status === 'owned') {
    stateMap.set(row.catalogId, 'owned')
  } else if (row.status === 'wishlist' && prior !== 'owned') {
    stateMap.set(row.catalogId, 'wishlist')
  }
}
```
[VERIFIED: src/data/catalog.ts]

### Pattern 3: Exact-Reference Sort Tier (NEW for Phase 67)

The new ORDER BY adds a boolean-DESC tier above the existing popularity sort. PostgreSQL evaluates `(col = literal)` as a boolean; DESC puts `true` first.

```sql
-- D-04 + D-05 canonical ORDER BY:
ORDER BY
  (reference_normalized = ${queryNormalized}) DESC NULLS LAST,
  (owners_count + 0.5 * wishlist_count) DESC,
  brand_normalized ASC,
  model_normalized ASC
```

In Drizzle sql-template form:
```typescript
.orderBy(
  desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`),
  desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
  asc(watchesCatalog.brandNormalized),
  asc(watchesCatalog.modelNormalized),
)
```
[ASSUMED — SQL correctness verified conceptually; Drizzle sql() NULLS LAST syntax not checked against Context7]

### Pattern 4: `getCatalogById` Already Returns `styleTags`

The `CatalogEntry` type (mapped from `mapRowToCatalogEntry` at `src/data/catalog.ts:53`) includes `styleTags: string[]` (mapped from `row.styleTags`). The D-11 enrichment-skip check `catalogRow.styleTags?.length > 0` works directly on the `getCatalogById` return value.

```typescript
// Source: src/data/catalog.ts:73 (mapRowToCatalogEntry)
styleTags: row.styleTags,  // string[], notNull with default '{}'
```
[VERIFIED: src/data/catalog.ts + src/lib/types.ts]

### Pattern 5: `findViewerWatchByCatalogId` Existing Caller

The only existing caller at `src/app/w/[ref]/page.tsx:439` reads `viewerOwnedRow.id` in two places (lines 473, 497). The widened return type `{ id: string; status: 'owned' | 'wishlist' } | null` is a structural superset; TypeScript will not complain on callers that only destructure `id`. No caller update required at those two call-sites.

```typescript
// Source: src/app/w/[ref]/page.tsx:472-473
if (viewerOwnedRow) {
  const ownedWatchRaw = await getWatchById(user.id, viewerOwnedRow.id)
  // ... only .id is used
}
```
[VERIFIED: src/app/w/[ref]/page.tsx]

### Pattern 6: `addWatch` catalogId Branch Placement

The override happens AFTER Zod parse + photoSourcePath check, BEFORE the wishlist-sortOrder computation. The `const { sortOrder, ...cleanData } = parsed.data` destructure already occurs at line 114. The catalogId branch inserts after that destructure.

```typescript
// Insertion point: after line 114 cleanData destructure, before line 118 wishlist branch
let catalogRow: CatalogEntry | null = null
if (parsed.data.catalogId) {
  const row = await catalogDAL.getCatalogById(parsed.data.catalogId)
  if (!row) return { success: false, error: 'Catalog reference not found' }
  catalogRow = row
  // D-10: server-side override of identity fields
  cleanData.brand = row.brand
  cleanData.model = row.model
  if (row.reference) cleanData.reference = row.reference
}
```
[VERIFIED: src/app/actions/watches.ts lines 114-140 — confirmed insertion point]

### Anti-Patterns to Avoid

- **Modifying `searchCatalogWatches` or `searchWatchesAction`:** D-01 locks these as untouched — `/search` page must remain bit-identical.
- **N+1 viewerState hydration:** The new DAL fn MUST use the single-batch `inArray` pattern. Never query per candidate row.
- **Silent fallback to upsert on missing catalogId:** D-09 is explicit — fail-fast with `ActionResult` error, no fallback.
- **Skipping side-effects when catalogId is supplied:** `logActivity`, overlap notifications, and `revalidateTag` always run (D-11).
- **Renaming or duplicating `findViewerWatchByCatalogId`:** D-06 says extend in place, preserve the fn name, keep backward-compat default.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID validation on catalogId | Custom regex | `z.string().uuid()` | Already in Zod schema; same pattern used elsewhere in codebase |
| Auth session reading | Manual cookie parsing | `getCurrentUser()` from `@/lib/auth` | Established pattern; UnauthorizedError handled uniformly |
| Cache invalidation | Custom revalidation logic | `revalidatePath` + `revalidateTag` | Already wired in `addWatch`; same calls must be preserved |
| viewerState dedup (owned wins) | Custom sort/find | The existing `stateMap` loop in `searchCatalogWatches` | Logic already handles all edge cases including sold/grail non-badge |
| SQL injection guard on `q` | String escaping | Drizzle parameterized `sql` template binds | Established in `searchCatalogWatches` (T-19-01-01 mitigation) |

---

## Common Pitfalls

### Pitfall 1: Reference Normalization in ORDER BY

**What goes wrong:** Computing `queryNormalized` (stripped of non-alphanumeric chars) for the ORDER BY boolean is the same operation used in the WHERE clause reference branch. If the stripped form is empty (e.g. `q = "/-"`), the boolean comparison `(reference_normalized = '')` matches rows with empty `reference_normalized` — potentially wrong rows bubble to the top.

**Why it happens:** Developers copy the WHERE pattern but miss the empty-string edge case in ORDER BY.

**How to avoid:** Guard the ORDER BY tier: if `queryNormalized.length === 0`, use `sql`false`` or `sql`NULL`` for the boolean expression so no rows receive the sort bump. Mirror the `refPattern` guard in `searchCatalogWatches:361`.

**Warning signs:** Test `q = "/-"` and verify no reference-exact bump fires.

### Pitfall 2: Widening Return Type Breaks Strict TypeScript

**What goes wrong:** Changing `findViewerWatchByCatalogId` return from `{ id: string } | null` to `{ id: string; status: 'owned' | 'wishlist' } | null` while the SELECT still only fetches `id`. TypeScript won't catch this — the return will have `status: undefined` at runtime.

**Why it happens:** Updating the type signature without updating the Drizzle `.select({ id, status })` projection.

**How to avoid:** Update the `.select()` call to include `status: watches.status` alongside `id: watches.id`. Then add the CASE ORDER BY for D-08.

**Warning signs:** Unit test case (a) would pass (owned row returned) but `result.status` would be `undefined`.

### Pitfall 3: enrichTasteAttributes Reads `parsed.data.brand` Post-Override

**What goes wrong:** The `enrichTasteAttributes` call block at `src/app/actions/watches.ts:174-200` reads `parsed.data.brand`, `parsed.data.model`, etc. for the `spec:` argument. If the D-10 override writes to `cleanData.brand` but not `parsed.data.brand`, the enrichment spec sees the client-supplied (potentially wrong) identity.

**Why it happens:** `parsed.data` is immutable after Zod parse; `cleanData` is a new object.

**How to avoid:** The CONTEXT.md Claude's Discretion note is explicit: "the enricher reads from `parsed.data` today — switch those reads to the overridden values so taste enrichment (when it runs) sees the canonical identity." The fix: derive a `resolvedSpec` from `cleanData` (which has the override applied), not from `parsed.data`.

**Warning signs:** Integration test case (c) — "catalogId + client brand='WRONG' → created watch has `brand = catalogRow.brand`" — passes, but enrichment test (d) would see wrong brand.

### Pitfall 4: Empty `topIds` Array in `inArray`

**What goes wrong:** Drizzle emits invalid SQL `WHERE catalog_id IN ()` when `topIds` is empty.

**Why it happens:** Missing the length guard before the `inArray` call.

**How to avoid:** Mirror the existing guard in `searchCatalogWatches:471`: `const stateRows = topIds.length ? await db.select()...where(inArray(...)) : []`.

**Warning signs:** The reference test suite (`tests/data/searchCatalogWatches.test.ts` Test 7) already covers this for `searchCatalogWatches`; add an equivalent test for the new DAL fn.

### Pitfall 5: `searchCatalogForAddFlow` Zod Schema Must NOT Use `.strict()`

**What goes wrong:** `searchWatchesAction` uses the broader `searchSchema` with `.strict()` that includes `movement`, `size`, `style`, `brand`, `era`. The new action's Zod schema is a different, simpler shape (`{ q, limit? }`). If `.strict()` were copied naively from `searchSchema`, any client that passes extra fields gets rejected — but more importantly, if the action accidentally uses `searchSchema` instead of a new schema, facets would be accepted silently.

**Why it happens:** Copying the import line without changing the schema name.

**How to avoid:** Define a new `addFlowSearchSchema = z.object({ q: z.string(), limit: z.number().int().min(1).max(50).optional() })` in `src/app/actions/search.ts`. Do not import or reuse `searchSchema`.

---

## Code Examples

### searchCatalogForAddFlow — Full Action Shell

```typescript
// src/app/actions/search.ts — ADD after searchWatchesAction

const addFlowSearchSchema = z.object({
  q: z.string(),
  limit: z.number().int().min(1).max(50).optional(),
})

export async function searchCatalogForAddFlow(
  input: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = addFlowSearchSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const results = await searchCatalogForAddFlowDAL({
      q: parsed.data.q,
      viewerId: user.id,
      limit: parsed.data.limit ?? 20,
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchCatalogForAddFlow] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
```
[ASSUMED — based on codebase patterns; exact import names verified from existing files]

### searchCatalogForAddFlowDAL — Key Order By Difference

```typescript
// src/data/catalog.ts — ADD next to searchCatalogWatches
// The candidate query is near-identical to searchCatalogWatches, with one key difference:
// the ORDER BY gains a boolean-DESC tier for exact-reference matching.

const queryNormalized = refNormalized  // same computation as refNormalized

.orderBy(
  // D-04/D-05: exact-reference bump — true sorts first under DESC
  desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`),
  // existing popularity + alpha tie-break (matches searchCatalogWatches)
  desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
  asc(watchesCatalog.brandNormalized),
  asc(watchesCatalog.modelNormalized),
)
```
[ASSUMED — Drizzle sql() NULLS LAST syntax may need verification against Drizzle docs]

### findViewerWatchByCatalogId — Extended Signature

```typescript
// src/data/watches.ts — MODIFY lines 295-317

export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
  statuses: ('owned' | 'wishlist')[] = ['owned'],  // D-06: default preserves BUG-01
): Promise<{ id: string; status: 'owned' | 'wishlist' } | null> {  // D-07 widened
  const rows = await db
    .select({
      id: watches.id,
      status: watches.status,  // ADD: projection needed for return type
    })
    .from(watches)
    .where(and(
      eq(watches.userId, userId),
      eq(watches.catalogId, catalogId),
      inArray(watches.status, statuses),  // replaces eq(watches.status, 'owned')
    ))
    // D-08: owned wins over wishlist; within each status, most-recent wins
    .orderBy(
      asc(sql`CASE ${watches.status} WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END`),
      desc(watches.createdAt),
    )
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  return { id: row.id, status: row.status as 'owned' | 'wishlist' }
}
```
[ASSUMED — Drizzle CASE expression syntax; verify `inArray` works with a runtime array parameter]

---

## State of the Art

| Old Approach | Current Approach | Phase Changed | Impact |
|--------------|------------------|---------------|--------|
| `findViewerWatchByCatalogId` returns `{ id } | null` | Extended to `{ id, status } | null` | Phase 67 | Phase 70 can branch DUPE-01 vs DUPE-03 without a second query |
| `addWatch` always upserts catalog | `addWatch` skips upsert when `catalogId` is supplied | Phase 67 | Prevents duplicate catalog rows when user picks from typeahead |
| No search action for add flow | `searchCatalogForAddFlow` with reference-exact sort tier | Phase 67 | Typeahead results surface exact-reference matches first |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle `desc(sql\`(col = literal)\`)` produces valid PostgreSQL boolean-DESC ORDER BY without extra syntax | Code Examples — sort pattern | ORDER BY might need explicit `NULLS LAST`; planner should verify against Drizzle docs or add `sql\`(col = literal) IS TRUE\`` |
| A2 | `inArray(watches.status, statuses)` works when `statuses` is a runtime string array (not a static enum) | Code Examples — DAL extension | Drizzle `inArray` may require a column type-safe array; may need `sql` template fallback |
| A3 | The Drizzle CASE expression `sql\`CASE ${watches.status} WHEN...\`` emits valid SQL | Code Examples — DAL extension | Syntax may differ; alternative: `sql\`CASE status WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END\`` (bare column reference) |
| A4 | `cleanData.brand = row.brand` mutates the object correctly after the destructure at line 114 | Pattern 6 — addWatch catalogId branch | `cleanData` is a plain object post-destructure; mutation should work but planner should verify TypeScript doesn't narrow it immutably |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

(A1-A4 are low-risk assumptions. All are common Drizzle patterns used elsewhere in the codebase; the fallback is straightforward sql-template adjustments.)

---

## Open Questions

1. **Drizzle `inArray` with status-as-string-array**
   - What we know: `inArray` is used in `searchCatalogWatches` with `inArray(watches.catalogId, topIds)` where `topIds: string[]`.
   - What's unclear: `watches.status` is a pgEnum column (`'owned' | 'wishlist' | 'sold' | 'grail'`). Whether `inArray(watches.status, ['owned', 'wishlist'])` compiles and emits valid SQL needs a quick check in the Drizzle docs or by trying it in the codebase.
   - Recommendation: Planner should either confirm via `npx ctx7@latest docs drizzle-orm "inArray pgEnum"` or use a `sql` template fallback: `sql\`${watches.status} = ANY(ARRAY['owned','wishlist']::status_enum[])\``.

2. **Test file location for DAL helper tests**
   - What we know: CONTEXT.md Claude's Discretion says tests live in `src/data/__tests__/watches.test.ts`. However, the codebase currently has DAL tests in `tests/data/` (e.g. `tests/data/searchCatalogWatches.test.ts`) and action tests in `tests/actions/`.
   - What's unclear: There is no `src/data/__tests__/` directory currently. The CONTEXT.md spec for `findViewerWatchByCatalogId` tests references a path that doesn't exist.
   - Recommendation: Planner should use `tests/data/` as the test location (consistent with `tests/data/searchCatalogWatches.test.ts`) for the new DAL helper test file, e.g. `tests/data/findViewerWatchByCatalogId.test.ts`. OR add to the existing `tests/data/` structure. The CONTEXT.md path `src/data/__tests__/watches.test.ts` may be aspirational; planner should pick one location and be consistent with existing test placement conventions.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 67 is code-only changes to existing TypeScript/Drizzle files. No external tools, services, CLIs, or databases beyond the existing project setup are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- tests/actions/watches.test.ts tests/data/searchCatalogWatches.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-11 (a) | `catalogId` supplied + row exists → no `upsertCatalogFromUserInput` call | unit (action mock) | `npm run test -- tests/actions/watches.test.ts` | ✅ (extend existing) |
| CONF-11 (b) | `catalogId` supplied + row missing → `{success:false, error:'Catalog reference not found'}` | unit (action mock) | `npm run test -- tests/actions/watches.test.ts` | ✅ (extend existing) |
| CONF-11 (c) | `catalogId` + wrong client brand → created watch uses `catalogRow.brand` | unit (action mock) | `npm run test -- tests/actions/watches.test.ts` | ✅ (extend existing) |
| CONF-11 (d) | `catalogId` + `style_tags` non-empty → `enrichTasteAttributes` NOT called | unit (action mock) | `npm run test -- tests/actions/watches.test.ts` | ✅ (extend existing) |
| CONF-11 (e) | `catalogId` + `style_tags` empty → `enrichTasteAttributes` IS called | unit (action mock) | `npm run test -- tests/actions/watches.test.ts` | ✅ (extend existing) |
| DUPE-01 (DAL) | `statuses=['owned']`, owned row present → returns `{id, status:'owned'}` | unit (DAL mock) | `npm run test -- tests/data/findViewerWatchByCatalogId.test.ts` | ❌ Wave 0 |
| DUPE-01 (DAL) | Default invocation → owned-only result (BUG-01 backward compat) | unit (DAL mock) | `npm run test -- tests/data/findViewerWatchByCatalogId.test.ts` | ❌ Wave 0 |
| DUPE-03 (DAL) | `statuses=['owned','wishlist']`, wishlist-only row → returns `{id, status:'wishlist'}` | unit (DAL mock) | `npm run test -- tests/data/findViewerWatchByCatalogId.test.ts` | ❌ Wave 0 |
| DUPE-03 (DAL) | `statuses=['owned','wishlist']`, BOTH rows → returns owned (D-08 precedence) | unit (DAL mock) | `npm run test -- tests/data/findViewerWatchByCatalogId.test.ts` | ❌ Wave 0 |
| DUPE-01/03 | Neither row present → returns null | unit (DAL mock) | `npm run test -- tests/data/findViewerWatchByCatalogId.test.ts` | ❌ Wave 0 |
| SRCH-18 (via CONF-11) | `searchCatalogForAddFlow('speedmaster')` returns rows, exact-ref first, no N+1 | unit (DAL mock) | `npm run test -- tests/data/searchCatalogForAddFlow.test.ts` | ❌ Wave 0 |
| SRCH-18 | Auth gate fires before DAL call | unit (action mock) | `npm run test -- tests/actions/search.test.ts` (if exists) or new file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/actions/watches.test.ts tests/data/findViewerWatchByCatalogId.test.ts tests/data/searchCatalogForAddFlow.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + `npm run build` exits 0 before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/data/findViewerWatchByCatalogId.test.ts` — covers DUPE-01/03 DAL (5 test cases from CONTEXT.md)
- [ ] `tests/data/searchCatalogForAddFlow.test.ts` — covers search fn: 2-char gate, anti-N+1 (exactly 2 DB queries for non-empty candidates), exact-ref sort-bump, empty-candidates short-circuit, owned-wins viewerState
- [ ] Integration tests added to `tests/actions/watches.test.ts` — 5 CONF-11 cases from CONTEXT.md

*(Existing test files require no new framework setup — vitest + mocks are already configured.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` / `UnauthorizedError` — enforced before any DAL call |
| V3 Session Management | no | Session is read-only here; no mutation |
| V4 Access Control | yes | All DAL queries scoped by `userId` — T-20-06-01 pattern; `getCatalogById` is public-read (catalog is public) |
| V5 Input Validation | yes | Zod parse on all Server Action inputs; DAL enforces 2-char minimum |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via `catalogId` parameter | Elevation of Privilege | `getCatalogById` is public-read by design (catalog rows are not user-private); watches rows are user-scoped in all DAL queries |
| SQL injection via `q` search parameter | Tampering | Drizzle parameterized `sql` template binds (T-19-01-01); same mitigation as `searchCatalogWatches` |
| Mass-assignment via Server Action body | Tampering | Zod strict parse — `addFlowSearchSchema` does not use `.strict()` but has no unknown field risk (DAL fn takes explicit params, not the raw input) |
| Catalog row poisoning via client-supplied brand/model | Tampering | D-10: when `catalogId` is supplied, server overrides brand/model from catalog row — client-supplied values are discarded for identity fields |
| Cross-user watch ID leak via `findViewerWatchByCatalogId` | Information Disclosure | Query always includes `eq(watches.userId, userId)` — T-20-06-01 pattern enforced at DAL level |

---

## Sources

### Primary (HIGH confidence)

- `src/app/actions/watches.ts` — full `addWatch` action; insertion point for catalogId branch verified
- `src/app/actions/search.ts` — `searchWatchesAction` canonical precedent for auth + Zod + ActionResult shape
- `src/data/catalog.ts` — `searchCatalogWatches` (lines 332-511): anti-N+1 hydration pattern, ORDER BY idiom, candidate query structure; `getCatalogById` (line 254); `upsertCatalogFromUserInput` (line 138)
- `src/data/watches.ts` — `findViewerWatchByCatalogId` (lines 295-317): existing signature, BUG-01 comment, D-05 createdAt tiebreak
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult` shape verified
- `src/lib/actionTypes.ts` — `ActionResult<T>` discriminated union verified
- `src/lib/types.ts` — `CatalogEntry.styleTags: string[]` confirmed
- `tests/actions/watches.test.ts` — mock setup patterns; vi.mock locations; test file is the target for CONF-11 integration tests
- `tests/data/searchCatalogWatches.test.ts` — DAL test pattern (chainable mock, selectCount pattern) for new DAL fn tests
- `vitest.config.ts` — test include globs, environment, alias setup

### Secondary (MEDIUM confidence)

- `.planning/phases/67-server-action-dal-extensions/67-CONTEXT.md` — all decisions (D-01 through D-11) verified against actual code for consistency
- `.planning/REQUIREMENTS.md` — CONF-11, DUPE-01, DUPE-03 requirement text

### Tertiary (LOW confidence)

- Drizzle `inArray` with pgEnum column — needs verification (assumption A2)
- Drizzle boolean DESC ORDER BY SQL output — needs verification (assumption A1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in codebase, verified by file read
- Architecture: HIGH — all patterns are already implemented in sibling functions; changes are additive
- Pitfalls: HIGH — identified from actual code review of the functions being modified
- Test patterns: HIGH — existing test infrastructure fully applicable; gaps are new files only
- Drizzle-specific SQL output: MEDIUM — core pattern correct, exact syntax assumptions flagged

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable codebase; decisions locked in CONTEXT.md)
