# Phase 67: Server Action + DAL Extensions - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 5 new/modified files + 3 new test files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/actions/search.ts` (add `searchCatalogForAddFlow`) | service (Server Action) | request-response | `src/app/actions/search.ts` `searchWatchesAction` (lines 97-133) | exact |
| `src/data/catalog.ts` (add `searchCatalogForAddFlowDAL`) | service (DAL fn) | CRUD (read) | `src/data/catalog.ts` `searchCatalogWatches` (lines 332-511) | exact |
| `src/app/actions/watches.ts` (extend `addWatch` + `insertWatchSchema`) | service (Server Action) | CRUD (write) | `src/app/actions/watches.ts` `addWatch` (lines 79-306) — in-place extension | exact |
| `src/data/watches.ts` (extend `findViewerWatchByCatalogId`) | service (DAL fn) | CRUD (read) | `src/data/watches.ts` `findViewerWatchByCatalogId` (lines 295-317) — in-place extension | exact |
| `tests/actions/watches.test.ts` (add 5 `catalogId` branch cases) | test | request-response | `tests/actions/watches.test.ts` existing describe blocks | exact |
| `tests/data/searchCatalogForAddFlow.test.ts` | test | CRUD (read) | `tests/data/searchCatalogWatches.test.ts` (full file) | exact |
| `tests/data/findViewerWatchByCatalogId.test.ts` | test | CRUD (read) | `tests/data/searchCatalogWatches.test.ts` + `tests/data/getFollowedOwnersForCatalog.test.ts` | role-match |

---

## Pattern Assignments

### `src/app/actions/search.ts` — add `searchCatalogForAddFlow`

**Analog:** `src/app/actions/search.ts` `searchWatchesAction` (lines 97-133)

**Imports pattern** (lines 1-18 — already present in the file; new additions):
```typescript
// Already imported — no new imports needed:
// getCurrentUser, ActionResult, SearchCatalogWatchResult
// New: import searchCatalogForAddFlowDAL from '@/data/catalog' (add to existing catalog import)
import { searchCatalogWatches, searchCatalogForAddFlowDAL } from '@/data/catalog'
```

**New Zod schema** (place above the new export, after the existing `searchSchema`):
```typescript
// D-03: simpler schema than searchSchema — no facets, explicit 50-cap
const addFlowSearchSchema = z.object({
  q: z.string(),
  limit: z.number().int().min(1).max(50).optional(),
})
// NOTE: do NOT add .strict() — the schema has no unknown-field risk; DAL takes explicit params
```

**Auth-first + Zod pattern** (lines 97-133; copy verbatim for new fn):
```typescript
export async function searchCatalogForAddFlow(
  data: unknown,
): Promise<ActionResult<SearchCatalogWatchResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = addFlowSearchSchema.safeParse(data)
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

**Console.error prefix pattern** (lines 79, 129): prefix must be `[searchCatalogForAddFlow]` — same bracket format used by all sibling actions. DAL error detail must NOT appear in the returned `error` string (T-19-02-04 regression lock verified in `tests/actions/search.test.ts` line 92).

---

### `src/data/catalog.ts` — add `searchCatalogForAddFlowDAL`

**Analog:** `src/data/catalog.ts` `searchCatalogWatches` (lines 332-511)

**Imports pattern** (line 8 — all already imported):
```typescript
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
// The new fn uses the same import set; no new drizzle-orm exports needed
```

**Constants block** (place adjacent to `SEARCH_WATCHES_*` constants at line 264):
```typescript
const SEARCH_ADD_FLOW_CANDIDATE_CAP = 50
const SEARCH_ADD_FLOW_DEFAULT_LIMIT = 20
const SEARCH_ADD_FLOW_TRIM_MIN_LEN = 2
```

**Candidate query shape** — copy the WHERE predicate block from `searchCatalogWatches` lines 382-464, then replace the `orderBy` with the D-04/D-05 two-tier sort:

```typescript
// D-04 + D-05: exact-reference bump tier prepended above existing popularity sort
.orderBy(
  // Boolean-DESC: (col = literal) → true for exact-ref rows → sorts first under DESC
  desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`),
  desc(sql`(${watchesCatalog.ownersCount} + 0.5 * ${watchesCatalog.wishlistCount})`),
  asc(watchesCatalog.brandNormalized),
  asc(watchesCatalog.modelNormalized),
)
// CRITICAL: guard queryNormalized empty-string edge case (RESEARCH Pitfall 1):
// if (queryNormalized.length === 0) substitute sql`false` or sql`NULL`
// for the first orderBy tier so no rows get a false exact-ref bump.
```

**Empty-`topIds` guard** (lines 471-485 — copy verbatim):
```typescript
// Pitfall 4: length-guard before inArray to skip degenerate empty IN clause
const stateRows = topIds.length
  ? await db
      .select({ catalogId: watches.catalogId, status: watches.status })
      .from(watches)
      .where(and(eq(watches.userId, viewerId), inArray(watches.catalogId, topIds)))
  : []
```

**ViewerState stateMap loop** (lines 489-499 — copy verbatim; this is the D-05 owned-wins logic):
```typescript
const stateMap = new Map<string, 'owned' | 'wishlist'>()
for (const row of stateRows) {
  if (!row.catalogId) continue
  const prior = stateMap.get(row.catalogId)
  if (row.status === 'owned') {
    stateMap.set(row.catalogId, 'owned')
  } else if (row.status === 'wishlist' && prior !== 'owned') {
    stateMap.set(row.catalogId, 'wishlist')
  }
  // 'sold' and 'grail' deliberately fall through — no badge
}
```

**Result mapping** (lines 501-510 — copy verbatim):
```typescript
return top.map((r) => ({
  catalogId: r.id,
  brand: r.brand,
  model: r.model,
  reference: r.reference,
  imageUrl: r.imageUrl,
  ownersCount: r.ownersCount,
  wishlistCount: r.wishlistCount,
  viewerState: stateMap.get(r.id) ?? null,
}))
```

**Key difference from `searchCatalogWatches`:** The new fn accepts NO `filters` param (D-03). The WHERE predicate block is the ILIKE-OR-only form (no facet predicates, no `hasActiveFacet` guard, no `resolvedBrandId` brand resolution). The `q` minimum still applies (`SEARCH_ADD_FLOW_TRIM_MIN_LEN = 2`).

---

### `src/app/actions/watches.ts` — extend `insertWatchSchema` + `addWatch`

**Analog:** `src/app/actions/watches.ts` — in-place modification of existing file

**Schema field addition** (lines 22-68 — place `catalogId` next to `imageUrl` at line 47):
```typescript
// CONF-11: optional catalogId; when supplied, action uses getCatalogById instead
// of upsertCatalogFromUserInput (D-09/D-10/D-11)
catalogId: z.string().uuid().optional(),
imageUrl: z.string().optional(),
```

**`addWatch` catalogId branch placement** — insert AFTER the `cleanData` destructure (line 114) and wishlist-sortOrder block (lines 118-121), BEFORE the existing catalog upsert at line 127. Follows Phase 38 D-06 fail-loud pattern:

```typescript
// After: const { sortOrder: _ignoredSortOrder, ...cleanData } = parsed.data (line 114)
// After: wishlist sortOrder computation (lines 118-121)
// NEW: D-09/D-10 catalogId-supplied branch

let catalogId: string
let catalogRowForSkipCheck: { styleTags?: string[] | null } | null = null

if (cleanData.catalogId) {
  // D-09: fail-fast on missing catalog row — never fall back to upsert
  const catalogRow = await catalogDAL.getCatalogById(cleanData.catalogId)
  if (!catalogRow) {
    return { success: false, error: 'Catalog reference not found' }
  }
  // D-10: server-side override — catalog row IS the identity truth
  cleanData.brand = catalogRow.brand
  cleanData.model = catalogRow.model
  if (catalogRow.reference) cleanData.reference = catalogRow.reference
  catalogId = cleanData.catalogId
  catalogRowForSkipCheck = catalogRow
} else {
  // Existing path (lines 127-140 unchanged)
  let catalogIdResult: string | null
  try {
    catalogIdResult = await catalogDAL.upsertCatalogFromUserInput({
      brand: parsed.data.brand,
      model: parsed.data.model,
      reference: parsed.data.reference ?? null,
    })
  } catch (err) {
    console.error('[addWatch] catalog upsert failed (fatal post-Phase-38 — catalog_id is NOT NULL):', err)
    throw err
  }
  if (!catalogIdResult) {
    throw new Error('[addWatch] catalog upsert returned null — cannot insert watches row without catalogId')
  }
  catalogId = catalogIdResult
}

const watch = await watchDAL.createWatch(user.id, catalogId, createPayload)
```

**D-11 enrichment skip guard** — the existing enrichment block (lines 151-201) wraps with:
```typescript
// D-11: skip taste enrichment + photo write-through when catalog row already has styleTags
const alreadyEnriched = catalogRowForSkipCheck != null &&
  (catalogRowForSkipCheck.styleTags?.length ?? 0) > 0

if (catalogId) {
  const photoPath = parsed.data.photoSourcePath ?? null

  if (photoPath && !alreadyEnriched) {
    // existing photo write-through block (lines 155-171) — unchanged inside
  }

  if (!alreadyEnriched) {
    // existing enrichTasteAttributes block (lines 174-200) — unchanged inside
    // CRITICAL (RESEARCH Pitfall 3): read from cleanData.brand/model/reference
    // (post-override), NOT parsed.data.brand/model/reference
    spec: {
      brand: cleanData.brand,
      model: cleanData.model,
      reference: cleanData.reference ?? null,
      // ... rest of spec fields from cleanData not parsed.data
    }
  }
}
// logActivity, findOverlapRecipients, revalidatePath/revalidateTag: ALWAYS run unchanged
```

**Error handling pattern** (lines 299-305 — unchanged; preserve existing):
```typescript
} catch (err) {
  console.error('[addWatch] unexpected error:', err)
  if (err instanceof Error && err.message.includes('not found or access denied')) {
    return { success: false, error: 'Not found' }
  }
  return { success: false, error: 'Failed to create watch' }
}
```

---

### `src/data/watches.ts` — extend `findViewerWatchByCatalogId`

**Analog:** `src/data/watches.ts` lines 295-317 — in-place modification

**Current signature** (lines 295-298):
```typescript
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string } | null> {
```

**Extended signature** (D-06/D-07/D-08):
```typescript
export async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
  statuses: ('owned' | 'wishlist')[] = ['owned'],  // D-06: default preserves BUG-01 contract
): Promise<{ id: string; status: 'owned' | 'wishlist' } | null> {  // D-07: widened return
```

**Query body — replace `select` + `where` + `orderBy`** (lines 299-316):
```typescript
  const rows = await db
    .select({
      id: watches.id,
      status: watches.status,  // ADD: projection required for widened return type (RESEARCH Pitfall 2)
    })
    .from(watches)
    .where(and(
      eq(watches.userId, userId),
      eq(watches.catalogId, catalogId),
      inArray(watches.status, statuses),  // replaces eq(watches.status, 'owned')
    ))
    // D-08: owned wins over wishlist; within each status, most-recent wins (D-05 carry-forward)
    .orderBy(
      asc(sql`CASE ${watches.status} WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END`),
      desc(watches.createdAt),
    )
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  return { id: row.id, status: row.status as 'owned' | 'wishlist' }
```

**Imports needed** — `inArray` and `sql` must be added to the drizzle-orm import in `src/data/watches.ts` if not already present. `asc` also needed for the CASE ORDER BY.

**Existing caller** — `src/app/w/[ref]/page.tsx` line 472: `viewerOwnedRow.id` is the only field read. The widened return is a structural superset; no caller update required (confirmed in RESEARCH Pattern 5).

---

### `tests/actions/watches.test.ts` — add 5 `catalogId` branch cases

**Analog:** `tests/actions/watches.test.ts` existing structure (lines 1-55 mock setup; lines 73-131 describe blocks)

**Additional mock needed** (add to the existing `vi.mock('@/data/catalog', ...)` block at line 34):
```typescript
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromUserInput: vi.fn().mockResolvedValue('cat-id-1'),
  updateCatalogTaste: vi.fn().mockResolvedValue({ updated: true }),
  applyUserUploadedPhoto: vi.fn().mockResolvedValue({ applied: true }),
  getCatalogById: vi.fn(),  // ADD: new mock for the catalogId branch
}))
```

**Import addition** (after line 63):
```typescript
import * as catalogDAL from '@/data/catalog'
// or: import { getCatalogById } from '@/data/catalog'
```

**Test describe block pattern** (copy structure from lines 73-131):
```typescript
describe('addWatch — catalogId branch (CONF-11)', () => {
  beforeEach(() => vi.clearAllMocks())

  const catalogRow = {
    id: 'cat-uuid-1',
    brand: 'Omega',
    model: 'Speedmaster',
    reference: '311.30.42.30.01.005',
    styleTags: ['sport', 'dress'],
    // ... other CatalogEntry fields as needed
  }

  it('(a) catalogId supplied + row exists → no upsertCatalogFromUserInput call', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(catalogDAL.getCatalogById).mockResolvedValue(catalogRow as any)
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await addWatch({ ...validWatch, catalogId: 'cat-uuid-1' })
    expect(catalogDAL.upsertCatalogFromUserInput).not.toHaveBeenCalled()
    expect(watchDAL.createWatch).toHaveBeenCalledWith('u-1', 'cat-uuid-1', expect.anything())
  })

  it('(b) catalogId supplied + row missing → { success: false, error: "Catalog reference not found" }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(catalogDAL.getCatalogById).mockResolvedValue(null)
    const result = await addWatch({ ...validWatch, catalogId: 'cat-uuid-missing' })
    expect(result).toEqual({ success: false, error: 'Catalog reference not found' })
    expect(watchDAL.createWatch).not.toHaveBeenCalled()
  })

  it('(c) catalogId + client brand="WRONG" → created watch uses catalogRow.brand', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(catalogDAL.getCatalogById).mockResolvedValue(catalogRow as any)
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    await addWatch({ ...validWatch, brand: 'WRONG', catalogId: 'cat-uuid-1' })
    expect(watchDAL.createWatch).toHaveBeenCalledWith(
      'u-1', 'cat-uuid-1',
      expect.objectContaining({ brand: 'Omega' }),  // catalogRow.brand, not 'WRONG'
    )
  })

  it('(d) catalogId + non-empty styleTags → enrichTasteAttributes NOT called', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(catalogDAL.getCatalogById).mockResolvedValue({ ...catalogRow, styleTags: ['sport'] } as any)
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    const { enrichTasteAttributes } = await import('@/lib/taste/enricher')
    await addWatch({ ...validWatch, catalogId: 'cat-uuid-1' })
    expect(enrichTasteAttributes).not.toHaveBeenCalled()
  })

  it('(e) catalogId + empty styleTags → enrichTasteAttributes IS called', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1', email: 'a@b.co' })
    vi.mocked(catalogDAL.getCatalogById).mockResolvedValue({ ...catalogRow, styleTags: [] } as any)
    vi.mocked(watchDAL.createWatch).mockResolvedValue({ id: 'w-1', ...validWatch } as any)
    const { enrichTasteAttributes } = await import('@/lib/taste/enricher')
    vi.mocked(enrichTasteAttributes).mockResolvedValue(null)
    await addWatch({ ...validWatch, catalogId: 'cat-uuid-1' })
    expect(enrichTasteAttributes).toHaveBeenCalled()
  })
})
```

---

### `tests/data/searchCatalogForAddFlow.test.ts` — new file

**Analog:** `tests/data/searchCatalogWatches.test.ts` (full file — copy chainable mock infrastructure verbatim)

**Mock infrastructure** (lines 16-75 of `searchCatalogWatches.test.ts` — copy exactly):
- `type Call`, `candidateRows`, `stateRows`, `calls`, `selectCount` module-level vars
- `makeCandidateChain()` function (resolves at `.limit()`)
- `makeStateChain()` function (resolves at `.where()`)
- `vi.mock('@/db', ...)` with the `selectCount`-based dispatch

**Key test cases to cover** (mirroring existing test numbering style):
```typescript
describe('searchCatalogForAddFlow DAL (D-01/D-04/D-05/SRCH-18)', () => {
  // Test 1: 2-char gate — q="a" returns [] without DB call
  // Test 2: orderBy includes reference_normalized exact-match tier (D-04/D-05)
  //   safeStringify(orderBy.args) must contain 'reference_normalized'
  //   AND contain 'owners_count' AND 'wishlist_count' (popularity tier)
  // Test 3: WHERE is ILIKE OR across 3 normalized cols (same as searchCatalogWatches Test 3)
  // Test 4: empty candidates short-circuits before inArray (Pitfall 4)
  //   selectCount === 1, state.from calls === 0
  // Test 5: anti-N+1 — exactly ONE state-hydration query (selectCount === 2)
  // Test 6: D-05 owned wins over wishlist (same as searchCatalogWatches Test 8)
  // Test 7: result row mapping — fields wired correctly (catalogId, brand, model, etc.)
})
```

**`safeStringify` helper** (lines 83-92) — copy verbatim; needed for all ORDER BY / WHERE arg assertions.

---

### `tests/data/findViewerWatchByCatalogId.test.ts` — new file

**Analog:** `tests/data/searchCatalogWatches.test.ts` chainable mock pattern + `tests/data/getFollowedOwnersForCatalog.test.ts` (simpler single-chain queries)

**Mock infrastructure** — simpler than the two-chain search mock; only one `db.select()` call:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

let returnedRows: Array<{ id: string; status: string }> = []
let calls: Array<{ op: string; args: unknown[] }> = []

function makeChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from:    (...args) => { calls.push({ op: 'from', args }); return chain },
    where:   (...args) => { calls.push({ op: 'where', args }); return chain },
    orderBy: (...args) => { calls.push({ op: 'orderBy', args }); return chain },
    limit:   (...args) => { calls.push({ op: 'limit', args }); return Promise.resolve(returnedRows) },
  } as never
  return chain
}

vi.mock('@/db', () => ({
  db: { select: vi.fn(() => makeChain()) },
}))

import { findViewerWatchByCatalogId } from '@/data/watches'

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CATALOG_ID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => { calls = []; returnedRows = [] })
```

**Five test cases from CONTEXT.md**:
```typescript
describe('findViewerWatchByCatalogId (D-06/D-07/D-08)', () => {
  it('(a) statuses=["owned"], owned row present → returns { id, status: "owned" }', async () => {
    returnedRows = [{ id: 'w-1', status: 'owned' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned'])
    expect(result).toEqual({ id: 'w-1', status: 'owned' })
  })

  it('(b) statuses=["owned","wishlist"], only wishlist row present → returns { id, status: "wishlist" }', async () => {
    returnedRows = [{ id: 'w-2', status: 'wishlist' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toEqual({ id: 'w-2', status: 'wishlist' })
  })

  it('(c) statuses=["owned","wishlist"], both rows → returns owned row (D-08 precedence)', async () => {
    // The DB CASE ORDER BY returns owned first; mock returns that first row
    returnedRows = [{ id: 'w-owned', status: 'owned' }]
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toEqual({ id: 'w-owned', status: 'owned' })
  })

  it('(d) no matching rows → returns null', async () => {
    returnedRows = []
    const result = await findViewerWatchByCatalogId(USER_ID, CATALOG_ID, ['owned', 'wishlist'])
    expect(result).toBeNull()
  })

  it('(e) default invocation (no statuses arg) → owned-only search (BUG-01 backward compat)', async () => {
    returnedRows = [{ id: 'w-1', status: 'owned' }]
    await findViewerWatchByCatalogId(USER_ID, CATALOG_ID)  // no statuses arg
    const whereCall = calls.find((c) => c.op === 'where')
    const json = safeStringify(whereCall!.args)
    // Must NOT contain 'wishlist' in the WHERE predicate
    expect(json).not.toContain('wishlist')
    // Must contain 'owned'
    expect(json).toContain('owned')
  })
})
```

---

## Shared Patterns

### Auth-First Server Action Gate

**Source:** `src/app/actions/search.ts` lines 56-82 (`searchPeopleAction`) — canonical form; `searchWatchesAction` (lines 97-133) is the direct precedent for the new action.
**Apply to:** `searchCatalogForAddFlow` in `src/app/actions/search.ts`

```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}
// Zod parse AFTER auth
const parsed = mySchema.safeParse(data)
if (!parsed.success) {
  return { success: false, error: 'Invalid request' }
}
```

### ActionResult Never-Throws Contract

**Source:** `src/lib/actionTypes.ts`
**Apply to:** Both `searchCatalogForAddFlow` and the `addWatch` extension

```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```
The outer `try/catch` in every Server Action must catch ALL errors and return `{ success: false, error: '...' }` — never re-throw across the server/client boundary.

### Anti-N+1 ViewerState Hydration

**Source:** `src/data/catalog.ts` lines 471-499 (`searchCatalogWatches`)
**Apply to:** `searchCatalogForAddFlowDAL` in `src/data/catalog.ts`

```typescript
// Single batched query — never per-row
const stateRows = topIds.length
  ? await db
      .select({ catalogId: watches.catalogId, status: watches.status })
      .from(watches)
      .where(and(eq(watches.userId, viewerId), inArray(watches.catalogId, topIds)))
  : []

// D-05 owned-wins merge
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

### Chainable Drizzle Mock (Test Pattern)

**Source:** `tests/data/searchCatalogWatches.test.ts` lines 16-75
**Apply to:** `tests/data/searchCatalogForAddFlow.test.ts` and `tests/data/findViewerWatchByCatalogId.test.ts`

```typescript
// selectCount determines which chain to return (candidates vs state hydration)
let selectCount = 0
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      selectCount += 1
      return selectCount === 1 ? makeCandidateChain() : makeStateChain()
    }),
  },
}))
// safeStringify for cycle-breaking on Drizzle arg assertions:
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v as object)) return '[Circular]'
      seen.add(v as object)
    }
    return v
  })
}
```

### Fail-Loud Catalog Reference

**Source:** `src/app/actions/watches.ts` lines 127-140 (Phase 38 D-06 pattern)
**Apply to:** `addWatch` `catalogId`-supplied branch (D-09 extension)

The new branch follows the same "fail-fast → return ActionResult error" idiom. The difference: instead of a failed upsert throwing, it's a `null` return from `getCatalogById`:
```typescript
const catalogRow = await catalogDAL.getCatalogById(cleanData.catalogId)
if (!catalogRow) {
  return { success: false, error: 'Catalog reference not found' }
}
```

---

## No Analog Found

All files in Phase 67 have exact or near-exact analogs in the codebase. No file requires falling back to RESEARCH.md patterns exclusively.

| File | Note |
|------|------|
| — | All patterns are grounded in existing codebase analogs |

---

## Critical Pitfall Notes for Planner

These are the highest-risk implementation details identified during pattern extraction:

1. **Empty queryNormalized ORDER BY** (RESEARCH Pitfall 1): When `refNormalized.length === 0` (e.g. `q = "/-"`), the boolean tier `(reference_normalized = '')` can falsely bump rows. Guard with `refNormalized.length > 0 ? desc(sql\`...\`) : sql\`false\`` — mirror the `refPattern` guard in `searchCatalogWatches` line 361.

2. **SELECT projection must include `status`** (RESEARCH Pitfall 2): The widened return type `{ id; status }` requires updating the Drizzle `.select({ id: watches.id, status: watches.status })` call — not just the TypeScript signature. Omitting `status` from SELECT gives `undefined` at runtime with no type error.

3. **Enrichment reads `cleanData` not `parsed.data`** (RESEARCH Pitfall 3): After D-10 override writes to `cleanData.brand/model/reference`, the `enrichTasteAttributes` `spec:` block must read from `cleanData` (the overridden values), NOT `parsed.data` (the raw client input). This is a runtime correctness issue that TypeScript won't catch.

4. **`inArray` with empty `topIds`** (RESEARCH Pitfall 4): The guard `topIds.length ? ... : []` before the `inArray` call is mandatory — Drizzle emits invalid SQL `WHERE catalog_id IN ()` without it. Copy from line 471 verbatim.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/data/`, `tests/actions/`, `tests/data/`
**Files scanned:** 12 source files + 3 test files read in full
**Pattern extraction date:** 2026-05-28
