---
phase: 20
plan: 05
type: execute
wave: 3
depends_on: ["20-02", "20-03"]
files_modified:
  - src/app/actions/verdict.ts
  - src/components/search/WatchSearchRow.tsx
  - src/components/search/WatchSearchRowsAccordion.tsx
  - src/components/search/useWatchSearchVerdictCache.ts
  - src/components/search/SearchPageClient.tsx
  - src/app/search/page.tsx
  - tests/components/search/WatchSearchRow.test.tsx
  - tests/components/search/WatchSearchRowsAccordion.test.tsx
  - tests/components/search/useWatchSearchVerdictCache.test.tsx
  - tests/actions/verdict.test.ts
autonomous: true
requirements: [FIT-04]

must_haves:
  truths:
    - "Server Action getVerdictForCatalogWatch is auth-gated, Zod-validated, returns ActionResult<VerdictBundle>; never accepts viewerId from input (V4 ASVS)"
    - "WatchSearchRow no longer references /evaluate?catalogId — the dangling Link is replaced by an Accordion.Trigger inside WatchSearchRowsAccordion"
    - "Accordion is one-at-a-time (multiple={false}) per D-05; ESC collapses; Tab keyboard-navigates triggers"
    - "First expand of a row fires the Server Action; re-expand of the same row uses in-memory cache (no second call) per D-06"
    - "Cache invalidates when collection-revision (passed as prop from server) changes — D-06 lock"
    - "Server Action error → Sonner toast 'Couldn\\'t compute verdict. Try again.' + accordion collapse"
    - "Loading state renders <VerdictSkeleton /> from Plan 03; cache-hit state renders <CollectionFitCard /> instantly (no skeleton flash)"
  artifacts:
    - path: "src/app/actions/verdict.ts"
      provides: "getVerdictForCatalogWatch Server Action"
      exports: ["getVerdictForCatalogWatch"]
      contains: "z.string().uuid"
    - path: "src/components/search/WatchSearchRow.tsx"
      provides: "MODIFIED — Link removed; whole-row click absorbed by Accordion.Trigger in parent"
      contains: "WatchSearchRow"
    - path: "src/components/search/WatchSearchRowsAccordion.tsx"
      provides: "Accordion shell that wraps result rows + manages cache + Server Action"
      exports: ["WatchSearchRowsAccordion"]
      contains: "Accordion"
    - path: "src/components/search/useWatchSearchVerdictCache.ts"
      provides: "Cache hook keyed by collectionRevision prop"
      exports: ["useWatchSearchVerdictCache"]
      contains: "collectionRevision"
    - path: "src/components/search/SearchPageClient.tsx"
      provides: "MODIFIED — accepts collectionRevision prop, threads to accordion shell"
      contains: "collectionRevision"
    - path: "src/app/search/page.tsx"
      provides: "MODIFIED — passes viewer.collection.length as collectionRevision prop"
      contains: "collectionRevision"
    - path: "tests/components/search/WatchSearchRow.test.tsx"
      provides: "UPDATED — drops /evaluate href assertions, adds accordion-friendly DOM expectations"
      contains: "describe"
    - path: "tests/components/search/WatchSearchRowsAccordion.test.tsx"
      provides: "10 RTL tests for accordion expand / one-at-a-time / ESC / cache / Server Action"
      contains: "Accordion"
    - path: "tests/components/search/useWatchSearchVerdictCache.test.tsx"
      provides: "4 hook tests for cache get/set/revision invalidation"
      contains: "useWatchSearchVerdictCache"
    - path: "tests/actions/verdict.test.ts"
      provides: "8 Server Action tests for auth/Zod/error paths/Pitfall 3 serialization"
      contains: "getVerdictForCatalogWatch"
  key_links:
    - from: "src/components/search/WatchSearchRowsAccordion.tsx"
      to: "src/app/actions/verdict.ts"
      via: "Server Action call on first row expand"
      pattern: "getVerdictForCatalogWatch"
    - from: "src/components/search/WatchSearchRowsAccordion.tsx"
      to: "src/components/insights/CollectionFitCard"
      via: "renders verdict result"
      pattern: "CollectionFitCard"
    - from: "src/components/search/WatchSearchRowsAccordion.tsx"
      to: "src/components/insights/VerdictSkeleton"
      via: "renders during pending Server Action"
      pattern: "VerdictSkeleton"
    - from: "src/components/search/WatchSearchRowsAccordion.tsx"
      to: "@base-ui/react/accordion"
      via: "Accordion primitive (Root, Item, Header, Trigger, Panel)"
      pattern: "from '@base-ui/react/accordion'"
---

<objective>
Ship FIT-04: replace the dangling `/evaluate?catalogId=` href with an inline-expand verdict preview backed by `getVerdictForCatalogWatch` Server Action and `@base-ui/react/accordion`. Dangling `/evaluate` references in the search surface are eliminated.

Purpose: Lazy compute (D-06) — idle search rows pay zero verdict cost. First expand fires the Server Action; cache hits render instantly. Auth-gated, Zod-validated, never accepts viewerId from input (V4 ASVS L1).

Output:
- `src/app/actions/verdict.ts` — Server Action with Zod schema + auth + parallel DAL reads + composer call.
- `src/components/search/WatchSearchRowsAccordion.tsx` — accordion shell wrapping the rows.
- `src/components/search/useWatchSearchVerdictCache.ts` — cache hook keyed by collectionRevision.
- `src/components/search/WatchSearchRow.tsx` — modified to drop the absolute-inset Link (Accordion.Trigger absorbs that role).
- `src/components/search/SearchPageClient.tsx` — modified to pass collectionRevision prop and use accordion shell.
- `src/app/search/page.tsx` — modified to compute collectionRevision (viewer collection length) and pass down.
- 4 test files (Server Action + 2 components + 1 hook) replacing Plan 01 it.todos.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md
@.planning/phases/19-search-watches-collections/19-CONTEXT.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-01-SUMMARY.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-02-SUMMARY.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-03-SUMMARY.md

<interfaces>
<!-- From Plan 01: VerdictBundle type -->
```typescript
import type { VerdictBundle } from '@/lib/verdict/types'
```

<!-- From Plan 02: composer + shim + viewerTasteProfile -->
```typescript
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
```

<!-- From Plan 03: pure renderer + skeleton -->
```typescript
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
```

<!-- Existing — Plan 19 search infrastructure -->
```typescript
// src/lib/searchTypes.ts — verified existing
export interface SearchCatalogWatchResult {
  catalogId: string
  brand: string
  model: string
  reference: string | null
  imageUrl: string | null
  ownersCount: number
  wishlistCount: number
  viewerState: 'owned' | 'wishlist' | null
}

// src/components/search/WatchSearchRow.tsx — current shape (Plan 19)
// Renders absolute-inset <Link href="/evaluate?catalogId=..."> + raised inline button.
// Plan 20 replaces this with Accordion.Trigger absorbing the click target.

// src/lib/auth.ts
export async function getCurrentUser(): Promise<{ id: string; email: string }>

// src/data/catalog.ts
export async function getCatalogById(id: string): Promise<CatalogEntry | null>

// src/data/watches.ts
export async function getWatchesByUser(userId: string): Promise<Watch[]>

// src/data/preferences.ts
export async function getPreferencesByUser(userId: string): Promise<UserPreferences>

// src/lib/actionTypes.ts
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

<!-- @base-ui/react Accordion (verified at node_modules/@base-ui/react/accordion/index.parts.d.ts) -->
```typescript
import { Accordion } from '@base-ui/react/accordion'
// Accordion.Root: { value, onValueChange, multiple, defaultValue, ... }
// Accordion.Item: { value, ... }
// Accordion.Header, Accordion.Trigger, Accordion.Panel
```

<!-- Sonner toaster (existing in src/components/ui/ThemedToaster.tsx, mounted in src/app/layout.tsx) -->
```typescript
import { toast } from 'sonner'
toast.error('message')
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement getVerdictForCatalogWatch Server Action + 8 tests</name>
  <files>src/app/actions/verdict.ts, tests/actions/verdict.test.ts</files>
  <read_first>
    - src/app/actions/search.ts (entire file — Phase 19 Server Action pattern: 'use server', getCurrentUser, Zod .strict(), generic error copy)
    - src/lib/auth.ts (entire file — getCurrentUser throws UnauthorizedError; mirror pattern)
    - src/lib/actionTypes.ts (entire file — ActionResult discriminated union)
    - src/data/catalog.ts (lines 240-250 — getCatalogById signature)
    - src/data/watches.ts (lines 85-100 — getWatchesByUser signature)
    - src/data/preferences.ts (lines 55-70 — getPreferencesByUser signature)
    - src/lib/verdict/composer.ts (Plan 02 — computeVerdictBundle args)
    - src/lib/verdict/viewerTasteProfile.ts (Plan 02 — computeViewerTasteProfile)
    - src/lib/verdict/shims.ts (Plan 02 — catalogEntryToSimilarityInput)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-06 (Server Action lazy compute on first expand)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Architecture Patterns Pattern 3 (full Server Action reference) + § Common Pitfalls Pitfall 3 (RSC serialization — no Date/Map/Set)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Security Domain (Zod .strict + UUID validation; never accept viewerId)
  </read_first>
  <behavior>
    - Returns `{success:false, error:'Not authenticated'}` when getCurrentUser throws.
    - Returns `{success:false, error:'Invalid request'}` when input fails Zod (non-UUID, extra fields, missing).
    - Returns `{success:false, error:'Watch not found'}` when getCatalogById returns null.
    - Returns `{success:true, data: VerdictBundleFull}` on success — framing always `'cross-user'` (search rows are non-owned candidates).
    - Returned VerdictBundle is plain JSON-serializable (no Date / Map / Set / undefined-as-property — Pitfall 3).
    - Uses `user.id` from getCurrentUser exclusively — never reads `viewerId` from input (T-20-05-01 mitigation).
    - Catches DAL errors with try/catch and returns `'Couldn\'t compute verdict.'` + console.error with `[getVerdictForCatalogWatch]` prefix.
    - When viewer collection is empty, the function still computes (returns a valid bundle with EMPTY_PROFILE-driven fallback phrasings — D-07 hide is a CLIENT-side decision; the action returns whatever the composer produces).
  </behavior>
  <action>
**File 1: `src/app/actions/verdict.ts`**

```typescript
'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import type { ActionResult } from '@/lib/actionTypes'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 D-06 + FIT-04 Server Action.
 *
 * Auth-gated (UnauthorizedError → 'Not authenticated'); Zod .strict() blocks
 * mass-assignment + UUID validation rejects non-UUID input. Mirrors
 * searchWatchesAction pattern at src/app/actions/search.ts:81-107.
 *
 * Pitfall 3: VerdictBundle is plain JSON-serializable. No Date / Map / Set.
 *
 * V4 ASVS L1: viewerId is taken from getCurrentUser() — never accepted from
 * input. The 'data' parameter is unknown until validated.
 *
 * Search rows are always non-owned candidates → framing is hardcoded to
 * 'cross-user'. Self-via-cross-user (D-08) is owned by Plan 06's catalog page.
 */
const verdictSchema = z.object({ catalogId: z.string().uuid() }).strict()

export async function getVerdictForCatalogWatch(
  data: unknown,
): Promise<ActionResult<VerdictBundle>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = verdictSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const [entry, collection, preferences] = await Promise.all([
      getCatalogById(parsed.data.catalogId),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])

    if (!entry) return { success: false, error: 'Watch not found' }

    const profile = await computeViewerTasteProfile(collection)
    const candidate = catalogEntryToSimilarityInput(entry)
    const bundle = computeVerdictBundle({
      candidate,
      catalogEntry: entry,
      collection,
      preferences,
      profile,
      framing: 'cross-user',
    })

    return { success: true, data: bundle }
  } catch (err) {
    console.error('[getVerdictForCatalogWatch] unexpected error:', err)
    return { success: false, error: "Couldn't compute verdict." }
  }
}
```

**File 2: `tests/actions/verdict.test.ts`** — REPLACE Plan 01 todos with 8 real tests:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCurrentUser = vi.fn()
const mockGetCatalogById = vi.fn()
const mockGetWatchesByUser = vi.fn()
const mockGetPreferencesByUser = vi.fn()
const mockComputeViewerTasteProfile = vi.fn()
const mockComputeVerdictBundle = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
// shim is pure — no need to mock; it'll consume the fake catalog entry.

import { getVerdictForCatalogWatch } from '@/app/actions/verdict'

const validUuid = '00000000-0000-4000-8000-000000000000'

describe('D-06 getVerdictForCatalogWatch Server Action (Plan 05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComputeViewerTasteProfile.mockResolvedValue({
      meanFormality: null, meanSportiness: null, meanHeritageScore: null,
      dominantArchetype: null, dominantEraSignal: null, topDesignMotifs: [],
    })
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'cross-user',
      label: 'core-fit',
      headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'],
      mostSimilar: [],
      roleOverlap: false,
    })
  })

  it('returns {success:false, error:"Not authenticated"} when getCurrentUser throws', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('unauth'))
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('returns {success:false, error:"Invalid request"} when catalogId is not a UUID', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    const r = await getVerdictForCatalogWatch({ catalogId: 'not-a-uuid' })
    expect(r).toEqual({ success: false, error: 'Invalid request' })
  })

  it('returns {success:false, error:"Invalid request"} when extra fields present (Zod .strict)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid, viewerId: 'attacker' })
    expect(r).toEqual({ success: false, error: 'Invalid request' })
  })

  it('returns {success:false, error:"Watch not found"} when getCatalogById returns null', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue(null)
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r).toEqual({ success: false, error: 'Watch not found' })
  })

  it('returns {success:true, data:VerdictBundle} for valid request with viewer.collection.length > 0', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue({
      id: validUuid, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
      imageUrl: null, imageSourceUrl: null, imageSourceQuality: null,
      movement: null, caseSizeMm: null, lugToLugMm: null, waterResistanceM: null,
      crystalType: null, dialColor: null, isChronometer: null, productionYear: null,
      productionYearIsEstimate: false,
      styleTags: [], designTraits: [], roleTags: [], complications: [],
      ownersCount: 0, wishlistCount: 0,
      formality: null, sportiness: null, heritageScore: null,
      primaryArchetype: null, eraSignal: null, designMotifs: [],
      confidence: null, extractedFromPhoto: false,
      createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z',
    })
    mockGetWatchesByUser.mockResolvedValue([{ id: 'w1' }])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.framing).toBe('cross-user')
    }
  })

  it('VerdictBundle is plain JSON-serializable (no Date, Map, Set in returned object — Pitfall 3)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue({
      id: validUuid, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
      imageUrl: null, imageSourceUrl: null, imageSourceQuality: null,
      movement: null, caseSizeMm: null, lugToLugMm: null, waterResistanceM: null,
      crystalType: null, dialColor: null, isChronometer: null, productionYear: null,
      productionYearIsEstimate: false,
      styleTags: [], designTraits: [], roleTags: [], complications: [],
      ownersCount: 0, wishlistCount: 0,
      formality: null, sportiness: null, heritageScore: null,
      primaryArchetype: null, eraSignal: null, designMotifs: [],
      confidence: null, extractedFromPhoto: false,
      createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z',
    })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(r.success).toBe(true)
    // round-trip JSON should preserve the value (no exotic types)
    if (r.success) {
      expect(JSON.parse(JSON.stringify(r.data))).toEqual(r.data)
    }
  })

  it('framing in returned bundle is "cross-user" (search rows are always non-owned per Plan 05 contract)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue({
      id: validUuid, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
      imageUrl: null, imageSourceUrl: null, imageSourceQuality: null,
      movement: null, caseSizeMm: null, lugToLugMm: null, waterResistanceM: null,
      crystalType: null, dialColor: null, isChronometer: null, productionYear: null,
      productionYearIsEstimate: false,
      styleTags: [], designTraits: [], roleTags: [], complications: [],
      ownersCount: 0, wishlistCount: 0,
      formality: null, sportiness: null, heritageScore: null,
      primaryArchetype: null, eraSignal: null, designMotifs: [],
      confidence: null, extractedFromPhoto: false,
      createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z',
    })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    const r = await getVerdictForCatalogWatch({ catalogId: validUuid })
    if (r.success) {
      expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
    }
  })

  it('uses user.id from getCurrentUser — never accepts viewerId from input (V4 ASVS)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'authenticated-user', email: 'a@b' })
    mockGetCatalogById.mockResolvedValue({
      id: validUuid, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
      imageUrl: null, imageSourceUrl: null, imageSourceQuality: null,
      movement: null, caseSizeMm: null, lugToLugMm: null, waterResistanceM: null,
      crystalType: null, dialColor: null, isChronometer: null, productionYear: null,
      productionYearIsEstimate: false,
      styleTags: [], designTraits: [], roleTags: [], complications: [],
      ownersCount: 0, wishlistCount: 0,
      formality: null, sportiness: null, heritageScore: null,
      primaryArchetype: null, eraSignal: null, designMotifs: [],
      confidence: null, extractedFromPhoto: false,
      createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z',
    })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    await getVerdictForCatalogWatch({ catalogId: validUuid })
    expect(mockGetWatchesByUser).toHaveBeenCalledWith('authenticated-user')
    expect(mockGetPreferencesByUser).toHaveBeenCalledWith('authenticated-user')
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/actions/verdict --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/actions/verdict.ts` exits 0
    - `grep "'use server'" src/app/actions/verdict.ts` exits 0 (Server Action directive at top)
    - `grep "z.string().uuid" src/app/actions/verdict.ts` exits 0 (UUID validation)
    - `grep ".strict()" src/app/actions/verdict.ts` exits 0 (Zod strict mode rejects mass-assignment)
    - `grep "export async function getVerdictForCatalogWatch" src/app/actions/verdict.ts` exits 0
    - `grep "framing: 'cross-user'" src/app/actions/verdict.ts` exits 0 (locked to cross-user per Plan contract)
    - `grep "user.id" src/app/actions/verdict.ts` exits 0 (auth user id used, not input viewerId)
    - `grep "viewerId:" src/app/actions/verdict.ts` exits 1 (Zod schema does NOT accept viewerId field)
    - `grep "Couldn't compute verdict" src/app/actions/verdict.ts` exits 0 (generic error copy)
    - `grep -c "it\.todo" tests/actions/verdict.test.ts` returns 0
    - `grep -cE "^\s*it\(" tests/actions/verdict.test.ts` returns 8
    - `npx vitest run tests/actions/verdict --reporter=basic` exits 0 (8 passing)
  </acceptance_criteria>
  <done>Server Action implemented with auth + Zod + parallel DAL + composer; 8 tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement useWatchSearchVerdictCache hook + 4 tests</name>
  <files>src/components/search/useWatchSearchVerdictCache.ts, tests/components/search/useWatchSearchVerdictCache.test.tsx</files>
  <read_first>
    - src/lib/verdict/types.ts (Plan 01 — VerdictBundle type)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-06 (cache invalidates on collection-revision change)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Architecture Patterns Pattern 3 (Server Action with In-Memory Client Cache; full reference impl)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Assumption A6 (collection-revision is passed as a prop from server — Plan 05 finalized this approach since useWatchStore is filter-only)
    - src/store/watchStore.ts (entire file — confirms it is filter-only; no watches collection there)
  </read_first>
  <behavior>
    - Hook accepts `collectionRevision: number` prop and returns `{get(id), set(id, bundle), revision}`.
    - When `collectionRevision` changes between renders, the cache is dropped (new empty Map).
    - When the same revision is rendered repeatedly, the cache persists.
    - `get(unknownId)` returns `undefined`.
    - After `set(id, bundle)`, `get(id)` returns the same bundle.
  </behavior>
  <action>
**File 1: `src/components/search/useWatchSearchVerdictCache.ts`**

```typescript
'use client'

import { useState } from 'react'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 D-06: per-mount verdict cache for the FIT-04 search-row inline expand.
 *
 * Keyed by viewer's collection-revision. The revision is passed as a prop from
 * the server (Plan 05 wires src/app/search/page.tsx to pass viewer.collection.length).
 * When the revision changes (viewer added/removed/edited a watch and the page
 * re-rendered), the cache is replaced with an empty Map. Cache only persists
 * across renders WITHIN the same revision — and across navigation away/back, the
 * SearchPageClient unmounts and the cache is fresh anyway.
 *
 * Why a snapshot integer instead of a fancier counter: the server page has the
 * truth; client-side only-cares-about-changed (not the absolute value).
 */
export function useWatchSearchVerdictCache(collectionRevision: number) {
  const [state, setState] = useState<{ rev: number; map: Map<string, VerdictBundle> }>(
    () => ({ rev: collectionRevision, map: new Map() }),
  )

  // Drop cache when revision changes. setState in render is acceptable here
  // (React docs: "Storing information from previous renders" pattern).
  if (state.rev !== collectionRevision) {
    setState({ rev: collectionRevision, map: new Map() })
  }

  return {
    revision: state.rev,
    get: (id: string): VerdictBundle | undefined => state.map.get(id),
    set: (id: string, bundle: VerdictBundle): void => {
      setState((prev) => {
        if (prev.rev !== collectionRevision) {
          // Stale write attempted; ignore (revision moved).
          return prev
        }
        const next = new Map(prev.map)
        next.set(id, bundle)
        return { rev: prev.rev, map: next }
      })
    },
  }
}
```

**File 2: `tests/components/search/useWatchSearchVerdictCache.test.tsx`** — REPLACE Plan 01 todos with 4 tests:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
import type { VerdictBundle } from '@/lib/verdict/types'

const fakeBundle: VerdictBundle = {
  framing: 'cross-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['ok'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('D-06 useWatchSearchVerdictCache (Plan 05)', () => {
  it('get() returns undefined for a never-set catalogId', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3))
    expect(result.current.get('unknown')).toBeUndefined()
  })

  it('set() then get() returns the same VerdictBundle', () => {
    const { result } = renderHook(() => useWatchSearchVerdictCache(3))
    act(() => result.current.set('cat-1', fakeBundle))
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
  })

  it('changing collectionRevision prop drops all cached entries', () => {
    const { result, rerender } = renderHook(
      ({ rev }) => useWatchSearchVerdictCache(rev),
      { initialProps: { rev: 3 } },
    )
    act(() => result.current.set('cat-1', fakeBundle))
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
    rerender({ rev: 4 })
    expect(result.current.get('cat-1')).toBeUndefined()
  })

  it('hook does not refetch on re-render when revision is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ rev }) => useWatchSearchVerdictCache(rev),
      { initialProps: { rev: 3 } },
    )
    act(() => result.current.set('cat-1', fakeBundle))
    rerender({ rev: 3 })  // same revision
    expect(result.current.get('cat-1')).toEqual(fakeBundle)
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/components/search/useWatchSearchVerdictCache --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/search/useWatchSearchVerdictCache.ts` exits 0
    - `grep "'use client'" src/components/search/useWatchSearchVerdictCache.ts` exits 0
    - `grep "export function useWatchSearchVerdictCache" src/components/search/useWatchSearchVerdictCache.ts` exits 0
    - `grep "collectionRevision: number" src/components/search/useWatchSearchVerdictCache.ts` exits 0 (D-06 prop signature)
    - `grep -c "it\.todo" tests/components/search/useWatchSearchVerdictCache.test.tsx` returns 0
    - `grep -cE "^\s*it\(" tests/components/search/useWatchSearchVerdictCache.test.tsx` returns 4
    - `npx vitest run tests/components/search/useWatchSearchVerdictCache --reporter=basic` exits 0 (4 passing)
  </acceptance_criteria>
  <done>Cache hook implemented with revision-keyed invalidation; 4 tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement WatchSearchRowsAccordion + modify WatchSearchRow + 10 RTL tests + update existing WatchSearchRow.test.tsx</name>
  <files>src/components/search/WatchSearchRow.tsx, src/components/search/WatchSearchRowsAccordion.tsx, tests/components/search/WatchSearchRow.test.tsx, tests/components/search/WatchSearchRowsAccordion.test.tsx</files>
  <read_first>
    - src/components/search/WatchSearchRow.tsx (entire file — confirm /evaluate?catalogId= references at line 43, 47, 87 — to be removed)
    - tests/components/search/WatchSearchRow.test.tsx (entire file — existing tests assert /evaluate href; update to drop those assertions)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-05 (accordion one-at-a-time + ESC) + D-06 (lazy compute on first expand + cache)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Component Inventory → "<Accordion> (FIT-04 inline-expand on /search?tab=watches)" (full ARIA + keyboard contract + animation utils)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Component Inventory → "Accordion expand affordance" (whole-row trigger + Evaluate→Hide label toggle + ChevronDown rotation)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Copywriting Contract (error toast copy: "Couldn't compute verdict. Try again." / "This watch is no longer available." / "Sign in to see how this fits your collection.")
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Code Examples Example 4 (full WatchSearchRowAccordion reference)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Common Pitfalls Pitfall 6 (Accordion.Trigger replaces absolute-inset Link)
    - node_modules/@base-ui/react/accordion/index.parts.d.ts (Accordion API surface)
    - src/components/insights/CollectionFitCard.tsx (Plan 03 — props {verdict})
    - src/components/insights/VerdictSkeleton.tsx (Plan 03 — no props)
  </read_first>
  <behavior>
    - WatchSearchRow renders the same VISUAL shape as before (image + brand/model + reference + Owned/Wishlist pill + right-side Evaluate button visual) but does NOT contain a `<Link>`. The whole-row trigger comes from the parent `<Accordion.Trigger>`. The right-edge "Evaluate" element is now a static `<span>` styled like a button (per UI-SPEC § "Accordion expand affordance — what does the trigger look like?").
    - Right-edge button label is "Evaluate" by default and "Hide" when the row is expanded — driven by `data-state="open"` from base-ui Accordion.
    - ChevronDown icon rotates 180° via `data-[state=open]:rotate-180`.
    - WatchSearchRowsAccordion wraps a list of rows; one row open at a time (`Accordion.Root` with default `multiple={false}`).
    - On first expand of a row → fires `getVerdictForCatalogWatch({catalogId})`; renders `<VerdictSkeleton />` while pending.
    - On success → caches the bundle via `useWatchSearchVerdictCache.set` and renders `<CollectionFitCard verdict={bundle} />`.
    - On second expand of same row in same revision → cache-hit; renders `<CollectionFitCard />` instantly (no skeleton flash).
    - On error → Sonner `toast.error(...)` with appropriate copy + automatically collapse the panel (programmatically pop the value off `openValue`).
    - ESC key collapses an open row (base-ui handles by default; verified in tests).
    - Tab key navigates between row triggers (base-ui handles by default).
  </behavior>
  <action>
**Step 1:** Modify `src/components/search/WatchSearchRow.tsx` to remove the `<Link>` and the `/evaluate` href. The visual shape stays identical, but the click behaviour is now the parent's responsibility.

```typescript
import Image from 'next/image'
import { Watch as WatchIcon, ChevronDown } from 'lucide-react'

import { HighlightedText } from '@/components/search/HighlightedText'
import { buttonVariants } from '@/components/ui/button'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 20 FIT-04 — modified row.
 *
 * The dangling `/evaluate?catalogId=` Link is removed. The whole-row click
 * affordance is now provided by <Accordion.Trigger render={<button absolute>}>
 * in the parent <WatchSearchRowsAccordion>. The right-edge "Evaluate" element
 * is a static <span> styled like a button — visual affordance only, not a
 * separate click target.
 *
 * Pitfall 6: trigger element is supplied by the parent. This row component
 * is now a pure presentational shell.
 *
 * Phase 19 D-07/D-08 contract is preserved (Owned/Wishlist pill rendering).
 */
export function WatchSearchRow({
  result,
  q,
}: {
  result: SearchCatalogWatchResult
  q: string
}) {
  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <div className="size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center shrink-0">
        {result.imageUrl ? (
          <Image
            src={result.imageUrl}
            alt=""
            width={48}
            height={48}
            className="object-cover"
            unoptimized
          />
        ) : (
          <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">
          <HighlightedText text={`${result.brand} ${result.model}`} q={q} />
        </p>
        {result.reference && (
          <p className="text-sm text-muted-foreground truncate">
            <HighlightedText text={result.reference} q={q} />
          </p>
        )}
      </div>
      {result.viewerState === 'owned' && (
        <span className="relative bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none">
          Owned
        </span>
      )}
      {result.viewerState === 'wishlist' && (
        <span className="relative bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none">
          Wishlist
        </span>
      )}
      <span
        className={
          buttonVariants({ variant: 'outline', size: 'sm' }) +
          ' relative inline-flex items-center gap-1 pointer-events-none'
        }
      >
        <span className="hidden group-data-[state=open]:hidden">Evaluate</span>
        <span className="group-data-[state=open]:inline hidden">Hide</span>
        <ChevronDown
          className="size-4 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </span>
    </div>
  )
}
```

NOTE: The `group-data-[state=open]` selectors above depend on the parent (`<Accordion.Trigger>`) being the `group`. The parent will render the row inside `<button data-state="open|closed" className="group ...">`. If the trigger element does not pass `group` class to the row context, fall back to **two siblings**: render two spans, both initially hidden via CSS class, and toggle via JS state from the accordion open value. Implementer must verify base-ui's `data-state` attribute IS set on the Trigger node and that the row receives it via `[data-state]` selectors.

If `group-data-[state=...]` selectors don't work in this codebase's Tailwind 4 config (they typically do — Tailwind 4 supports `group-data-*` natively), an acceptable simpler approach: the parent `<Accordion.Trigger>` exposes the open state via a render prop or React context, and `WatchSearchRow` accepts an `isOpen?: boolean` prop. Choose this fallback if the CSS-only approach fails. Document the choice in SUMMARY.

**Step 2:** Create `src/components/search/WatchSearchRowsAccordion.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Accordion } from '@base-ui/react/accordion'
import { toast } from 'sonner'

import { WatchSearchRow } from '@/components/search/WatchSearchRow'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
import { getVerdictForCatalogWatch } from '@/app/actions/verdict'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 20 FIT-04 / D-05 + D-06 — Accordion shell wrapping search rows with
 * lazy-compute Server Action + per-mount cache keyed by collectionRevision.
 *
 * Pitfall 6: Accordion.Trigger absorbs the whole-row click.
 *
 * Behavior:
 *   - One row open at a time (Accordion.Root multiple={false}, the default)
 *   - First expand → Server Action fires → <VerdictSkeleton /> while pending
 *   - Cache hit on re-expand → <CollectionFitCard /> instantly, no skeleton
 *   - Server Action error → toast.error + collapse panel
 *   - ESC + Tab keyboard contract handled by base-ui Accordion natively
 */
export function WatchSearchRowsAccordion({
  results,
  q,
  collectionRevision,
}: {
  results: SearchCatalogWatchResult[]
  q: string
  collectionRevision: number
}) {
  const [openValue, setOpenValue] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const cache = useWatchSearchVerdictCache(collectionRevision)

  const handleValueChange = (next: string | null) => {
    setOpenValue(next)
    if (next && !cache.get(next)) {
      setLoadingId(next)
      startTransition(async () => {
        const res = await getVerdictForCatalogWatch({ catalogId: next })
        if (res.success) {
          cache.set(next, res.data)
        } else {
          // D-05: collapse on error; show toast.
          toast.error(toastCopyForError(res.error))
          setOpenValue(null)
        }
        setLoadingId(null)
      })
    }
  }

  return (
    <Accordion.Root
      value={openValue ?? undefined}
      onValueChange={(v) => handleValueChange((v as string) ?? null)}
    >
      {results.map((r) => (
        <Accordion.Item key={r.catalogId} value={r.catalogId}>
          <Accordion.Header>
            <Accordion.Trigger
              className="group block w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Evaluate ${r.brand} ${r.model}`}
            >
              <WatchSearchRow result={r} q={q} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="px-2 pt-2 pb-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-150">
            {loadingId === r.catalogId ? (
              <VerdictSkeleton />
            ) : (
              (() => {
                const cached = cache.get(r.catalogId)
                return cached ? <CollectionFitCard verdict={cached} /> : null
              })()
            )}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

function toastCopyForError(error: string): string {
  if (error === 'Watch not found') return 'This watch is no longer available.'
  if (error === 'Not authenticated') return 'Sign in to see how this fits your collection.'
  return "Couldn't compute verdict. Try again."
}
```

NOTE for the implementer: Verify the exact shape of `Accordion.Root`'s `value` and `onValueChange` (controlled-mode signature) by reading `node_modules/@base-ui/react/accordion/root/AccordionRoot.d.ts`. The single-string vs array-of-strings shape depends on the `multiple` flag. In `multiple=false` (default) the value is `string | null`. Adapt the code if the shape differs.

**Step 3:** Update `tests/components/search/WatchSearchRow.test.tsx` — drop `/evaluate` href assertions, add accordion-friendly DOM expectations.

The existing test file (read at Plan time) likely contains 5+ tests. Update them as follows:
- DELETE any test that asserts `<a href="/evaluate?catalogId=...">` is in the DOM (no Link renders anymore).
- Test 1: Highlighting (keep — assertion does not depend on href)
- Test 2: Reference sub-label (keep)
- Test 3: No reference sub-label when null (keep)
- ADD Test: `does not render a /evaluate link` — assert `screen.queryByRole('link')` returns null.
- ADD Test: `renders the brand+model in plain text (no anchor wrapper)` — assert the brand+model text is rendered inside a `<p>`, not an `<a>`.
- ADD Test: `renders 'Evaluate' label` — assert `screen.getByText('Evaluate')` is in the doc (the static button-styled span).
- ADD Test: `renders chevron-down icon` — assert at least one SVG element renders (lucide-react ChevronDown).

Keep the existing next/link mock (it'll go unused but it's harmless).

**Step 4:** Create `tests/components/search/WatchSearchRowsAccordion.test.tsx` — REPLACE Plan 01 todos with 10 RTL tests:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

const mockServerAction = vi.fn()
const mockToastError = vi.fn()

vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: mockServerAction,
}))
vi.mock('sonner', () => ({ toast: { error: mockToastError } }))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => `<img src="${src}" alt="${alt}" />`,
}))

import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

const buildResult = (id: string, brand: string, model: string): SearchCatalogWatchResult => ({
  catalogId: id, brand, model, reference: null, imageUrl: null,
  ownersCount: 0, wishlistCount: 0, viewerState: null,
})

const fakeBundle = {
  framing: 'cross-user' as const,
  label: 'core-fit' as const,
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: ['ok'],
  mostSimilar: [],
  roleOverlap: false,
}

describe('FIT-04 D-05 WatchSearchRowsAccordion (Plan 05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServerAction.mockResolvedValue({ success: true, data: fakeBundle })
  })

  it('clicking a row trigger expands its panel and renders <CollectionFitCard>', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'Rolex', 'Submariner')]} q="rolex" collectionRevision={3} />)
    const trigger = screen.getByRole('button', { name: /Evaluate Rolex Submariner/ })
    await user.click(trigger)
    await waitFor(() => expect(screen.getByText('Collection Fit')).toBeInTheDocument())
  })

  it('opening a second row collapses the first (one-at-a-time, multiple=false default)', async () => {
    const user = userEvent.setup()
    const results = [buildResult('c1', 'Rolex', 'Sub'), buildResult('c2', 'Omega', 'Speed')]
    render(<WatchSearchRowsAccordion results={results} q="" collectionRevision={3} />)
    const triggers = screen.getAllByRole('button')
    await user.click(triggers[0])
    await waitFor(() => expect(screen.getAllByText('Collection Fit').length).toBeGreaterThan(0))
    await user.click(triggers[1])
    // base-ui collapses the first; both Server Action calls fire (one per first-expand).
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledTimes(2))
  })

  it('ESC key collapses the open row', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'Rolex', 'Sub')]} q="" collectionRevision={3} />)
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    await waitFor(() => expect(screen.getByText('Collection Fit')).toBeInTheDocument())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument())
  })

  it('Tab key moves focus between row triggers without entering panel content', async () => {
    const user = userEvent.setup()
    const results = [buildResult('c1', 'A', 'B'), buildResult('c2', 'C', 'D')]
    render(<WatchSearchRowsAccordion results={results} q="" collectionRevision={3} />)
    const triggers = screen.getAllByRole('button')
    triggers[0].focus()
    await user.tab()
    expect(triggers[1]).toHaveFocus()
  })

  it('chevron rotates 180deg when row is open (data-[state=open]:rotate-180)', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    // The data-state attribute is set by base-ui on the trigger.
    await waitFor(() => expect(trigger.getAttribute('data-state')).toBe('open'))
  })

  it('button label toggles "Evaluate" → "Hide" via data-state attribute', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    expect(screen.getByText('Evaluate')).toBeInTheDocument()
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    // The "Hide" span becomes visible via group-data-[state=open] CSS — this is
    // visual-only; the assertion is on the data-state attribute (proxy).
    await waitFor(() => expect(trigger.getAttribute('data-state')).toBe('open'))
  })

  it('first expand fires getVerdictForCatalogWatch Server Action', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledWith({ catalogId: 'c1' }))
  })

  it('re-expand of same row uses cache (no second Server Action call)', async () => {
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    await waitFor(() => expect(mockServerAction).toHaveBeenCalledTimes(1))
    await user.click(trigger)  // collapse
    await user.click(trigger)  // re-expand
    expect(mockServerAction).toHaveBeenCalledTimes(1)  // still 1 — cache hit
  })

  it('shows <VerdictSkeleton /> while Server Action is pending', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    mockServerAction.mockReturnValue(new Promise((res) => { resolveAction = res }))
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    await user.click(screen.getByRole('button'))
    // Skeleton should be visible while the promise is unresolved. The skeleton
    // is identified by its shadcn pulse classes; assert by container query.
    await waitFor(() => {
      const pulses = document.querySelectorAll('[class*="animate-pulse"]')
      expect(pulses.length).toBeGreaterThan(0)
    })
    resolveAction({ success: true, data: fakeBundle })
  })

  it('Sonner toast fires on Server Action error and panel collapses', async () => {
    mockServerAction.mockResolvedValue({ success: false, error: 'Watch not found' })
    const user = userEvent.setup()
    render(<WatchSearchRowsAccordion results={[buildResult('c1', 'A', 'B')]} q="" collectionRevision={3} />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('This watch is no longer available.'))
    expect(screen.queryByText('Collection Fit')).not.toBeInTheDocument()
  })
})
```

NOTE: The exact selector for "Skeleton" in the pending-state test depends on the shadcn `Skeleton` primitive's class output. Read `src/components/ui/skeleton.tsx` to confirm the class is `animate-pulse` (default shadcn shape) — adapt the assertion if it uses a different class.
  </action>
  <verify>
    <automated>npx vitest run tests/components/search/WatchSearchRow tests/components/search/WatchSearchRowsAccordion --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `grep "/evaluate?catalogId" src/components/search/WatchSearchRow.tsx` exits 1 (FIT-04 — dangling href removed)
    - `grep "from 'next/link'" src/components/search/WatchSearchRow.tsx` exits 1 (no Link import)
    - `grep "<Link" src/components/search/WatchSearchRow.tsx` exits 1 (no Link rendered)
    - `grep "ChevronDown" src/components/search/WatchSearchRow.tsx` exits 0 (chevron icon present)
    - `grep "Evaluate" src/components/search/WatchSearchRow.tsx` exits 0 (default label)
    - `grep "Hide" src/components/search/WatchSearchRow.tsx` exits 0 (open-state label)
    - `test -f src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "from '@base-ui/react/accordion'" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "getVerdictForCatalogWatch" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "VerdictSkeleton" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "CollectionFitCard" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "useWatchSearchVerdictCache" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "toast.error" src/components/search/WatchSearchRowsAccordion.tsx` exits 0
    - `grep "This watch is no longer available." src/components/search/WatchSearchRowsAccordion.tsx` exits 0 (UI-SPEC verbatim)
    - `grep "Sign in to see how this fits your collection." src/components/search/WatchSearchRowsAccordion.tsx` exits 0 (UI-SPEC verbatim)
    - `grep "Couldn't compute verdict. Try again." src/components/search/WatchSearchRowsAccordion.tsx` exits 0 (UI-SPEC verbatim)
    - `grep -c "/evaluate?catalogId" tests/components/search/WatchSearchRow.test.tsx` returns 0 (assertions dropped)
    - `grep -c "it\.todo" tests/components/search/WatchSearchRowsAccordion.test.tsx` returns 0
    - `grep -cE "^\s*it\(" tests/components/search/WatchSearchRowsAccordion.test.tsx` returns 10
    - `npx vitest run tests/components/search/WatchSearchRow tests/components/search/WatchSearchRowsAccordion --reporter=basic` exits 0 (existing row tests + 10 accordion tests passing)
  </acceptance_criteria>
  <done>WatchSearchRow Link removed; Accordion shell wraps rows with cache + Server Action + skeleton + toast; 10+ tests pass; existing WatchSearchRow tests updated.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Wire SearchPageClient + /search/page.tsx to thread collectionRevision and use WatchSearchRowsAccordion</name>
  <files>src/components/search/SearchPageClient.tsx, src/app/search/page.tsx</files>
  <read_first>
    - src/components/search/SearchPageClient.tsx (entire file — current `WatchesPanel` function around lines 236-297; the `<WatchSearchRow key={...} />` map at line 287)
    - src/app/search/page.tsx (entire file) — Read first to see how SearchPageClient is invoked; confirm presence of viewerId prop, where to add collectionRevision
    - src/data/watches.ts — getWatchesByUser already imported elsewhere; we'll re-use to get viewer collection length
    - src/components/search/WatchSearchRowsAccordion.tsx (just created in Task 3)
  </read_first>
  <action>
**Step 1:** Modify `src/components/search/SearchPageClient.tsx`:

Add `collectionRevision: number` to `SearchPageClientProps`. Thread it through to `WatchesPanel` via prop. In `WatchesPanel`, replace the `results.map((r) => <WatchSearchRow ... />)` block with `<WatchSearchRowsAccordion results={results} q={q} collectionRevision={collectionRevision} />`.

For the `AllTabResults` invocation, ALSO pass `collectionRevision` so that AllTabResults' internal Watches section uses the accordion (Task 5 / Plan 19 follow-up if AllTabResults renders WatchSearchRow directly — verify and patch accordingly; if AllTabResults takes its own path, leave it: this plan only touches the dedicated `?tab=watches` panel for FIT-04 scope. The AllTabResults capped-5 watches list can keep WatchSearchRow without accordion — UI-SPEC implies the accordion is for the dedicated Watches tab panel, not the All tab's mini-section. Document the decision in SUMMARY).

For the canonical implementation, only WatchesPanel uses the Accordion; AllTabResults' watches mini-section keeps the static rows (since the FIT-04 success criterion is "WatchSearchRow Evaluate CTA opens an inline-expand verdict preview", and the All-tab mini-section doesn't expose Evaluate at full row depth). Document this scope decision.

```typescript
// Updated SearchPageClient prop interface:
interface SearchPageClientProps {
  viewerId: string
  collectionRevision: number  // Plan 20 D-06 — verdict cache invalidator
  children: React.ReactNode
}

// Updated WatchesPanel signature:
function WatchesPanel({ q, results, isLoading, hasError, collectionRevision }: {
  q: string
  results: SearchCatalogWatchResult[]
  isLoading: boolean
  hasError: boolean
  collectionRevision: number
}) {
  // ... same skeleton/error/empty/pre-query branches ...

  // Replace the existing results.map at the end:
  return (
    <WatchSearchRowsAccordion
      results={results}
      q={q}
      collectionRevision={collectionRevision}
    />
  )
}
```

Add the import at the top of the file:
```typescript
import { WatchSearchRowsAccordion } from '@/components/search/WatchSearchRowsAccordion'
```

In the main `SearchPageClient` body, pass `collectionRevision` to `<WatchesPanel>`:
```typescript
<TabsContent value="watches" className="mt-6">
  <WatchesPanel
    q={trimmed}
    results={watchesResults}
    isLoading={watchesIsLoading}
    hasError={watchesHasError}
    collectionRevision={collectionRevision}
  />
</TabsContent>
```

The "Showing top 20" footer now lives inside `WatchSearchRowsAccordion` OR the WatchesPanel renders it OUTSIDE the accordion. Choose the latter for minimal disruption: leave the "Showing top 20" footer in WatchesPanel after the accordion, conditional on `results.length === 20`.

**Step 2:** Modify `src/app/search/page.tsx`:

Read the existing file first. Add a `getWatchesByUser(viewer.id)` call (or query just the count) and pass the length as `collectionRevision`. Use Promise.all for parallelism with existing reads:

```typescript
// Existing imports + add:
import { getWatchesByUser } from '@/data/watches'

// Inside the page:
const [viewer, viewerCollection] = await Promise.all([
  // ... existing reads
  getCurrentUser(),
  getWatchesByUser(/* user.id once available */),
])

// Pass to client:
<SearchPageClient
  viewerId={user.id}
  collectionRevision={viewerCollection.length}
>
  ...
</SearchPageClient>
```

Verify the existing flow first; if `getCurrentUser` is already called above and the user object is in scope, just add `getWatchesByUser(user.id)` and use `.length` as the revision.

For correctness: the revision is the number of watches the viewer owns. This is a coarse signal — when a user adds, removes, or modifies a watch, the count changes (add/remove) OR — for an "edit" — the count is unchanged but the user's taste profile may have changed. For Phase 20 we accept the trade-off: edits don't invalidate the cache automatically; the user can navigate away and back to refresh. Document this in SUMMARY (defer-to-20.1 — when add-watch flow lands, it can `router.refresh()` the search page and the count-based key naturally invalidates).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run tests/components/search --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `grep "WatchSearchRowsAccordion" src/components/search/SearchPageClient.tsx` exits 0 (Watches panel uses Accordion)
    - `grep "collectionRevision" src/components/search/SearchPageClient.tsx` exits 0 (prop threaded)
    - `grep "collectionRevision" src/app/search/page.tsx` exits 0 (page computes revision)
    - `grep "getWatchesByUser" src/app/search/page.tsx` exits 0 (page reads collection length)
    - `npx tsc --noEmit` exits 0 (compiles cleanly)
    - `npx vitest run tests/components/search --reporter=basic` exits 0 (search tests green)
  </acceptance_criteria>
  <done>SearchPageClient + /search/page.tsx wired to thread collectionRevision; WatchesPanel uses WatchSearchRowsAccordion; type-check clean; tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→Server Action | `getVerdictForCatalogWatch` accepts unknown input from client; Zod .strict + UUID validates before DAL access |
| Server Action→DAL | `user.id` from `getCurrentUser()` scopes the viewer collection read; never accepts viewerId from input |
| Server Action→client (RSC payload) | VerdictBundle is plain JSON; Pitfall 3 enforced via tests |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-05-01 | Spoofing | getVerdictForCatalogWatch — viewerId parameter spoofing | mitigate | `viewerId` is NEVER read from input. Zod .strict() rejects extra fields including a forged `viewerId`. The `user.id` from getCurrentUser() is the only source of truth. Acceptance criterion `grep "viewerId:" src/app/actions/verdict.ts` exits 1. |
| T-20-05-02 | Tampering | Server Action input validation | mitigate | Zod schema `z.object({catalogId: z.string().uuid()}).strict()`. Non-UUID rejected; extra fields rejected (mass-assignment). Acceptance criterion `grep ".strict()"` exits 0. |
| T-20-05-03 | Repudiation | Server Action errors not logged | mitigate | `console.error('[getVerdictForCatalogWatch] unexpected error:', err)` on catch. User-facing copy is generic ("Couldn't compute verdict.") — DB internals never leaked. |
| T-20-05-04 | Information Disclosure | Verdict bundle leaks other users' watches via mostSimilar | mitigate | `mostSimilar` is built by `analyzeSimilarity` from the `collection` arg, which the action passes from `getWatchesByUser(user.id)` — viewer's own collection only. Engine never reaches into other users' rows. |
| T-20-05-05 | Information Disclosure | RSC payload exposes server-only fields | mitigate | VerdictBundle type is hand-typed (Plan 01); contains only label, headlinePhrasing, contextualPhrasings, mostSimilar (viewer's own watches), roleOverlap, framing. No DB row metadata, no internal IDs beyond viewer's own. |
| T-20-05-06 | Denial of Service | Mass cache pollution by rapid expand of every search row | accept | Search results are capped at 20 rows; per-row Server Action takes 50–250ms. Even worst case (20 rows × 250ms = 5s) is bounded. No rate limit added; if abuse arises we can add a per-IP token bucket in Phase 25 (UX polish) or earlier if a v4.0 incident occurs. |
| T-20-05-07 | Tampering | sonner toast copy injection | mitigate | `toastCopyForError` switches on a fixed set of error strings ('Watch not found', 'Not authenticated', else default). The `error` field comes from the action's own response shape — controlled by Plan 05's own code, not user input. No template injection surface. |

ASVS L1 V2 (auth): getCurrentUser gate. V3 (session): Supabase SSR session reused. V4 (access control): viewer.id scoping; never accept viewerId from input. V5 (input validation): Zod .strict() + UUID. V8 (data protection): generic error copy; no DB internals leaked.
</threat_model>

<verification>
- All 10 frontmatter `files_modified` exist on disk
- `npx vitest run --reporter=basic` exits 0 (full suite green)
- `grep -r "/evaluate?catalogId=" src/components/` exits 1 (no remaining dangling refs in components)
- `grep -r "/evaluate?catalogId=" src/app/` exits 1 (no remaining dangling refs in app)
- `grep "WatchSearchRowsAccordion" src/components/search/SearchPageClient.tsx` exits 0 (wired)
- `git diff HEAD -- src/lib/similarity.ts` empty (D-09 still locked)
- Static guard tests/static/CollectionFitCard.no-engine.test.ts still passes (Plan 03 invariant intact)
</verification>

<success_criteria>
1. `getVerdictForCatalogWatch` Server Action exists with auth + Zod + parallel DAL + composer.
2. `WatchSearchRow.tsx` does NOT import next/link or render a Link to /evaluate.
3. `WatchSearchRowsAccordion.tsx` wraps rows with one-at-a-time accordion + Server Action + cache + skeleton + toast.
4. `useWatchSearchVerdictCache` invalidates on `collectionRevision` change.
5. `SearchPageClient` accepts `collectionRevision` prop and threads to WatchesPanel.
6. `/search/page.tsx` computes `collectionRevision` from `getWatchesByUser(user.id).length`.
7. 22 new tests passing (8 action + 4 cache + 10 accordion); existing WatchSearchRow tests updated.
8. Full vitest suite green.
9. `analyzeSimilarity` body byte-identical to HEAD (D-09).
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-05-SUMMARY.md`.
</output>
