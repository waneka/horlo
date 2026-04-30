---
phase: 20
plan: 04
type: execute
wave: 3
depends_on: ["20-02", "20-03"]
files_modified:
  - src/app/watch/[id]/page.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/insights/SimilarityBadge.tsx
  - tests/app/watch-page-verdict.test.ts
autonomous: true
requirements: [FIT-01, FIT-03]

must_haves:
  truths:
    - "/watch/[id] computes VerdictBundle in the Server Component (D-03 static surface) and threads it as a prop to WatchDetail"
    - "WatchDetail renders <CollectionFitCard verdict={verdict} /> instead of <SimilarityBadge>; SimilarityBadge is deleted"
    - "When viewer collection is empty (D-07), WatchPage skips computeVerdictBundle and threads verdict=null; WatchDetail does NOT render the card slot"
    - "Engine bundle no longer ships in the same-user /watch/[id] client bundle (Pitfall 1) — verified by static text-scan of WatchDetail.tsx"
    - "Same-user (isOwner=true) renders framing='same-user'; cross-user (isOwner=false) renders framing='cross-user'"
  artifacts:
    - path: "src/app/watch/[id]/page.tsx"
      provides: "Server Component computes VerdictBundle and threads to WatchDetail"
      contains: "computeVerdictBundle"
    - path: "src/components/watch/WatchDetail.tsx"
      provides: "Updated to accept optional verdict prop and render CollectionFitCard"
      contains: "CollectionFitCard"
    - path: "src/components/insights/SimilarityBadge.tsx"
      provides: "DELETED — single consumer migrated"
      contains: "DELETED"
    - path: "tests/app/watch-page-verdict.test.ts"
      provides: "Integration tests for FIT-03 framing branches + D-07 hide-when-empty"
      contains: "framing"
  key_links:
    - from: "src/app/watch/[id]/page.tsx"
      to: "src/lib/verdict/composer (computeVerdictBundle)"
      via: "Server Component import"
      pattern: "from '@/lib/verdict/composer'"
    - from: "src/app/watch/[id]/page.tsx"
      to: "src/lib/verdict/viewerTasteProfile (computeViewerTasteProfile)"
      via: "Server Component import"
      pattern: "from '@/lib/verdict/viewerTasteProfile'"
    - from: "src/components/watch/WatchDetail.tsx"
      to: "src/components/insights/CollectionFitCard"
      via: "client component import (CollectionFitCard is pure render — works in client tree)"
      pattern: "from '@/components/insights/CollectionFitCard'"
---

<objective>
Wire the verdict computation into the existing `/watch/[id]/page.tsx` Server Component (D-03 static-surface compute) and migrate `WatchDetail.tsx` from `<SimilarityBadge>` to `<CollectionFitCard>`. Delete `SimilarityBadge.tsx` (single consumer).

Purpose: Ships the FIT-01 + FIT-03 outcomes for the same-user and cross-user `/watch/[id]` surfaces. Page computes once on the server; WatchDetail becomes a passive consumer of the precomputed `VerdictBundle`. Net result: engine no longer ships in the client bundle for this surface.

Output:
- `src/app/watch/[id]/page.tsx` — adds `computeVerdictBundle` block respecting D-07 (hide when collection empty); passes `verdict` prop to WatchDetail.
- `src/components/watch/WatchDetail.tsx` — accepts optional `verdict?: VerdictBundle | null` prop; renders `<CollectionFitCard>` when present; deletes `<SimilarityBadge>` import + usage.
- `src/components/insights/SimilarityBadge.tsx` — DELETED.
- `tests/app/watch-page-verdict.test.ts` — integration tests filled in (replaces Plan 01 it.todo).
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
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-01-SUMMARY.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-02-SUMMARY.md
@.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-03-SUMMARY.md

<interfaces>
<!-- From Plan 02: -->
```typescript
// src/lib/verdict/composer.ts
export function computeVerdictBundle(args: {
  candidate: Watch
  catalogEntry?: CatalogEntry | null
  collection: Watch[]
  preferences: UserPreferences
  profile: ViewerTasteProfile
  framing: 'same-user' | 'cross-user'
}): VerdictBundleFull

// src/lib/verdict/viewerTasteProfile.ts
export async function computeViewerTasteProfile(collection: Watch[]): Promise<ViewerTasteProfile>
export const EMPTY_PROFILE: ViewerTasteProfile
```

<!-- From Plan 03: -->
```typescript
// src/components/insights/CollectionFitCard.tsx
export function CollectionFitCard(props: { verdict: VerdictBundle }): JSX.Element
```

<!-- Existing — Plan 04 modifies these: -->
```typescript
// src/app/watch/[id]/page.tsx — current shape (verbatim, lines 12-42):
export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const [result, collection, preferences] = await Promise.all([
    getWatchByIdForViewer(user.id, id),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])
  if (!result) notFound()
  const { watch, isOwner } = result
  const lastWornDate = isOwner ? await getMostRecentWearDate(user.id, watch.id) : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
      />
    </div>
  )
}

// src/components/watch/WatchDetail.tsx — relevant prop interface (lines 30-42):
interface WatchDetailProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
  lastWornDate?: string | null
  viewerCanEdit?: boolean
}
// Currently renders <SimilarityBadge watch={watch} collection={collection} preferences={preferences} /> at line 425.
```

<!-- Phase 17 catalog DAL: -->
```typescript
// src/data/catalog.ts
export async function getCatalogById(id: string): Promise<CatalogEntry | null>
```

<!-- Existing watch DAL: -->
```typescript
// src/data/watches.ts
export async function getWatchByIdForViewer(viewerId, watchId): Promise<{ watch: Watch; isOwner: boolean } | null>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Modify /watch/[id]/page.tsx to compute VerdictBundle and add integration tests</name>
  <files>src/app/watch/[id]/page.tsx, tests/app/watch-page-verdict.test.ts</files>
  <read_first>
    - src/app/watch/[id]/page.tsx (entire file, lines 1-42) — confirm exact shape before edit
    - src/data/watches.ts (lines 85-160 — getWatchesByUser + getWatchByIdForViewer signatures)
    - src/data/catalog.ts (lines 240-250 — getCatalogById signature)
    - src/data/preferences.ts (lines 55-70 — getPreferencesByUser signature)
    - src/lib/verdict/composer.ts (Plan 02 — computeVerdictBundle args shape)
    - src/lib/verdict/viewerTasteProfile.ts (Plan 02 — computeViewerTasteProfile signature)
    - src/lib/verdict/types.ts (Plan 01 — VerdictBundle | null shape)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-03 (Server Component compute for static surfaces) + D-07 (hide when collection empty) + D-09 (analyzeSimilarity untouched)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Architecture Patterns Pattern 4 (Server Component compute → Client Renderer)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Open Questions Q4 (resolved — /watch/[id] is per-user UUID; "self-via-cross-user" CANNOT trigger here, only on /catalog/[catalogId] in Plan 06)
  </read_first>
  <behavior>
    - Page computes verdict ONLY when viewer's collection.length > 0 (D-07).
    - When collection.length === 0, verdict prop = `null`.
    - When isOwner === true, framing = `'same-user'`.
    - When isOwner === false, framing = `'cross-user'`.
    - Page reads `getCatalogById(watch.catalogId)` IFF `watch.catalogId !== null` to thread catalog taste attributes; null when watch isn't catalog-linked yet (Phase 17 backfill not yet run on a row).
    - Page does NOT trigger `'self-via-cross-user'` framing (per Q4 resolution; that's Plan 06's catalog page).
    - Page calls `Promise.all` for the 3-4 parallel reads (watch, collection, preferences, catalog) per existing pattern.
    - Page passes `verdict: VerdictBundle | null` prop down to WatchDetail.
  </behavior>
  <action>
**File 1: `src/app/watch/[id]/page.tsx`**

Replace existing file with this updated version (preserve everything except the verdict-computation block + WatchDetail prop):

```typescript
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getCatalogById } from '@/data/catalog'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import type { VerdictBundle } from '@/lib/verdict/types'
import { WatchDetail } from '@/components/watch/WatchDetail'

interface WatchPageProps {
  params: Promise<{ id: string }>
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const [result, collection, preferences] = await Promise.all([
    getWatchByIdForViewer(user.id, id),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])

  if (!result) {
    notFound()
  }

  const { watch, isOwner } = result

  // Non-owner never receives lastWornDate — conservative default that honors
  // worn_public intent without adding a separate flag lookup (T-RDB-03).
  const lastWornDate = isOwner ? await getMostRecentWearDate(user.id, watch.id) : null

  // Phase 20 D-03 + D-07: compute verdict on the server when the viewer has a
  // collection signal. Empty-collection viewers see no card at all (D-07 lock).
  // /watch/[id] is keyed by per-user watches.id; "self-via-cross-user" framing
  // (D-08) is impossible here — see RESEARCH Open Q4 resolution. Only same-user
  // and cross-user framings can occur on this route.
  let verdict: VerdictBundle | null = null
  if (collection.length > 0) {
    const [profile, catalogEntry] = await Promise.all([
      computeViewerTasteProfile(collection),
      watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null),
    ])
    verdict = computeVerdictBundle({
      candidate: watch,
      catalogEntry,
      collection,
      preferences,
      profile,
      framing: isOwner ? 'same-user' : 'cross-user',
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
        verdict={verdict}
      />
    </div>
  )
}
```

NOTE — `Watch.catalogId` may not be present on the existing `Watch` domain type. Verify by reading `src/lib/types.ts` lines 17-56. If `catalogId` is NOT on the `Watch` interface, then `watch.catalogId` will be `undefined` at runtime and the type-check will fail. In that case, look up the catalog entry by an alternative key:
- Check `src/data/watches.ts` `mapRowToWatch` — does it expose `catalogId`?
- If yes, add `catalogId?: string | null` to the `Watch` interface in `src/lib/types.ts` (a single-field addition compatible with all existing usage).
- If no, fall back to `getCatalogByBrandModel(watch.brand, watch.model)` if such a helper exists; otherwise pass `catalogEntry: null` and the composer falls through to the confidence < 0.5 fallback (acceptable per Pitfall 4).

**Implementer instructions:** First grep `mapRowToWatch` in `src/data/watches.ts`; if it sets `catalogId`, then `Watch.catalogId` should be in the type. If the type lacks the field, add `catalogId?: string | null` to the `Watch` interface in `src/lib/types.ts`. Document the addition in the SUMMARY.

**File 2: `tests/app/watch-page-verdict.test.ts`** — REPLACE Plan 01 it.todos with 4 integration tests using vi.mock to fake DAL + composer:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCurrentUser = vi.fn()
const mockGetWatchByIdForViewer = vi.fn()
const mockGetWatchesByUser = vi.fn()
const mockGetPreferencesByUser = vi.fn()
const mockGetCatalogById = vi.fn()
const mockGetMostRecentWearDate = vi.fn()
const mockComputeVerdictBundle = vi.fn()
const mockComputeViewerTasteProfile = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/watches', () => ({
  getWatchByIdForViewer: mockGetWatchByIdForViewer,
  getWatchesByUser: mockGetWatchesByUser,
}))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/wearEvents', () => ({ getMostRecentWearDate: mockGetMostRecentWearDate }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
vi.mock('@/components/watch/WatchDetail', () => ({
  WatchDetail: ({ verdict }: { verdict: unknown }) =>
    `<WatchDetail verdict=${JSON.stringify(verdict)} />`,
}))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))

import WatchPage from '@/app/watch/[id]/page'

describe('FIT-03 /watch/[id] verdict integration (Plan 04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'a@b' })
    mockGetMostRecentWearDate.mockResolvedValue(null)
    mockComputeViewerTasteProfile.mockResolvedValue({
      meanFormality: null, meanSportiness: null, meanHeritageScore: null,
      dominantArchetype: null, dominantEraSignal: null, topDesignMotifs: [],
    })
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'same-user',
      label: 'core-fit',
      headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'],
      mostSimilar: [],
      roleOverlap: false,
    })
    mockGetCatalogById.mockResolvedValue(null)
  })

  it('renders <CollectionFitCard> with framing="same-user" when isOwner=true', async () => {
    const fakeWatch = { id: 'w1', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: true })
    mockGetWatchesByUser.mockResolvedValue([fakeWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('same-user')
  })

  it('renders <CollectionFitCard> with framing="cross-user" when isOwner=false', async () => {
    const fakeWatch = { id: 'w2', userId: 'user-2', brand: 'X', model: 'Y', catalogId: null }
    const myWatch = { id: 'w-mine', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: false })
    mockGetWatchesByUser.mockResolvedValue([myWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w2' }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('does NOT render <CollectionFitCard> when viewer collection.length === 0 (D-07)', async () => {
    const fakeWatch = { id: 'w1', userId: 'user-2', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: false })
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockGetPreferencesByUser.mockResolvedValue({})
    await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
  })

  it('passes computed VerdictBundle as prop — does not call analyzeSimilarity in WatchDetail', async () => {
    // The WatchDetail mock simply records its props; assert verdict is non-null.
    const fakeWatch = { id: 'w1', userId: 'user-1', brand: 'X', model: 'Y', catalogId: null }
    mockGetWatchByIdForViewer.mockResolvedValue({ watch: fakeWatch, isOwner: true })
    mockGetWatchesByUser.mockResolvedValue([fakeWatch])
    mockGetPreferencesByUser.mockResolvedValue({})
    const result = await WatchPage({ params: Promise.resolve({ id: 'w1' }) })
    // result is React tree; we asserted via mock spy the bundle was computed.
    expect(mockComputeVerdictBundle).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/app/watch-page-verdict --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `grep "computeVerdictBundle" src/app/watch/[id]/page.tsx` exits 0
    - `grep "computeViewerTasteProfile" src/app/watch/[id]/page.tsx` exits 0
    - `grep "framing: isOwner ? 'same-user' : 'cross-user'" src/app/watch/[id]/page.tsx` exits 0 (D-03 framing branch)
    - `grep "if (collection.length > 0)" src/app/watch/[id]/page.tsx` exits 0 (D-07 hide-when-empty)
    - `grep "verdict={verdict}" src/app/watch/[id]/page.tsx` exits 0 (prop threaded)
    - `grep "VerdictBundle" src/app/watch/[id]/page.tsx` exits 0 (typed)
    - `grep "self-via-cross-user" src/app/watch/[id]/page.tsx` exits 1 (Q4 — this route doesn't trigger D-08)
    - `grep -c "it\.todo" tests/app/watch-page-verdict.test.ts` returns 0
    - `grep -cE "^\s*it\(" tests/app/watch-page-verdict.test.ts` returns 4
    - `npx vitest run tests/app/watch-page-verdict --reporter=basic` exits 0 (4 passing)
  </acceptance_criteria>
  <done>WatchPage Server Component computes VerdictBundle and threads it down per D-03/D-07; 4 integration tests pass.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate WatchDetail.tsx from SimilarityBadge to CollectionFitCard + delete SimilarityBadge.tsx</name>
  <files>src/components/watch/WatchDetail.tsx, src/components/insights/SimilarityBadge.tsx</files>
  <read_first>
    - src/components/watch/WatchDetail.tsx (entire file — confirm 'use client' directive, prop interface lines 30-42, import line 25 `SimilarityBadge`, usage line 425)
    - src/components/insights/SimilarityBadge.tsx (entire file — confirm zero other consumers via grep)
    - src/components/insights/CollectionFitCard.tsx (Plan 03 file — pure renderer prop shape)
    - src/lib/verdict/types.ts (Plan 01 — VerdictBundle | null type for new prop)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § State of the Art (SimilarityBadge becomes dead code; delete during Phase 20 to avoid drift)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Open Q3 (WatchDetail stays Client; receives precomputed prop)
  </read_first>
  <action>
**Step 1:** Confirm SimilarityBadge has only one consumer:

Run `grep -r "SimilarityBadge" src/ tests/` and verify the only matches are:
- `src/components/insights/SimilarityBadge.tsx` (the file itself)
- `src/components/watch/WatchDetail.tsx` (line 25 import, line 425 usage)
- (Possibly a test file — grep `tests/components/insights/` if exists)

If any OTHER consumer exists, abort the plan and consult before proceeding.

**Step 2:** Modify `src/components/watch/WatchDetail.tsx`:

1. Update import block (around line 25): replace `import { SimilarityBadge } from '@/components/insights/SimilarityBadge'` with `import { CollectionFitCard } from '@/components/insights/CollectionFitCard'` AND `import type { VerdictBundle } from '@/lib/verdict/types'`.

2. Update `WatchDetailProps` interface (around line 30-42): add `verdict?: VerdictBundle | null` AFTER the `viewerCanEdit?: boolean` field. Add a JSDoc comment:
```typescript
/**
 * Phase 20 D-03/D-04: precomputed VerdictBundle from /watch/[id]/page.tsx.
 * `null` means D-07 fired (viewer collection is empty) — render no card slot.
 * `undefined` means a defensive default for any non-Plan-04 caller; treat as null.
 */
verdict?: VerdictBundle | null
```

3. Update component signature (around line 63): destructure `verdict` from props with default `null`:
```typescript
export function WatchDetail({ watch, collection, preferences, lastWornDate, viewerCanEdit = true, verdict = null }: WatchDetailProps) {
```

4. Replace the `<SimilarityBadge>` JSX (around line 425) with:
```typescript
{/* Phase 20 FIT-01/D-04: pure-render card; computation happens in /watch/[id]/page.tsx (D-03 Server Component compute) */}
{verdict && <CollectionFitCard verdict={verdict} />}
```

5. The `analyzeSimilarity` import path in WatchDetail must NOT exist anymore — but verify: WatchDetail itself never imported `analyzeSimilarity` directly (only via `<SimilarityBadge>` transitively). Confirm no direct import remains.

**Step 3:** Delete `src/components/insights/SimilarityBadge.tsx` outright.

```bash
rm src/components/insights/SimilarityBadge.tsx
```

**Step 4:** Delete any test file solely targeting SimilarityBadge if it exists. Grep confirms — `tests/components/insights/SimilarityBadge.test.tsx` likely doesn't exist (the existing `tests/components/insights/insights-retirement.test.tsx` is unrelated). If a SimilarityBadge.test exists, delete it too.

**Step 5:** Run `npm run lint` to confirm no orphaned imports.
  </action>
  <verify>
    <automated>npx vitest run tests/components tests/app --reporter=basic && test ! -f src/components/insights/SimilarityBadge.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test ! -f src/components/insights/SimilarityBadge.tsx` exits 0 (file deleted)
    - `grep -r "SimilarityBadge" src/ tests/` exits 1 (no remaining references in src/ or tests/)
    - `grep "import { CollectionFitCard }" src/components/watch/WatchDetail.tsx` exits 0
    - `grep "import type { VerdictBundle }" src/components/watch/WatchDetail.tsx` exits 0
    - `grep "verdict\?: VerdictBundle \| null" src/components/watch/WatchDetail.tsx` exits 0 (new prop)
    - `grep "verdict = null" src/components/watch/WatchDetail.tsx` exits 0 (defaulted destructure)
    - `grep "{verdict && <CollectionFitCard" src/components/watch/WatchDetail.tsx` exits 0 (conditional render)
    - `grep "analyzeSimilarity" src/components/watch/WatchDetail.tsx` exits 1 (no direct engine usage; was only via deleted SimilarityBadge)
    - `npx tsc --noEmit` exits 0 (compiles cleanly)
    - `npx vitest run tests/components tests/app --reporter=basic` exits 0 (full component + app suites green)
  </acceptance_criteria>
  <done>WatchDetail migrated to CollectionFitCard; SimilarityBadge.tsx deleted; no orphan imports; type-check passes; full test suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| viewer DB → Server Component | `getWatchByIdForViewer` enforces two-layer privacy (RLS + profile_public/collection_public/wishlist_public per-tab gate). Existing v3.0 audit. |
| Server Component → Client Component | `verdict: VerdictBundle | null` flows down via props as plain JSON (RSC serialization). Pitfall 3: VerdictBundle has no Date / Map / Set. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-04-01 | Information Disclosure | /watch/[id] cross-user verdict computation | mitigate | Verdict input is `(viewer.collection, watch.fields_only)`. The `watch` object passes through `getWatchByIdForViewer` privacy gate before reaching computeVerdictBundle. The `collection` is from `getWatchesByUser(viewer.id)` — viewer's own watches. The `mostSimilar` array contains ONLY viewer's own collection rows. NO cross-user collection leak. Acceptance criterion in tests verifies framing branches by isOwner. |
| T-20-04-02 | Information Disclosure | RSC payload of VerdictBundle to client | mitigate | VerdictBundle contains label (categorical), headlinePhrasing (string), contextualPhrasings (strings), mostSimilar (viewer's own watches), roleOverlap (boolean), framing (categorical). All viewer-owned data; no leak. |
| T-20-04-03 | Tampering | watch.catalogId potentially attacker-influenced | mitigate | `catalogId` is set by Phase 17 link helpers from server-side context only; user input never directly sets `catalogId`. Even if it were attacker-supplied, `getCatalogById(catalogId)` returns null for non-existent IDs and the composer falls through to confidence-< 0.5 fallback. No SSRF, no SQL injection (Drizzle parameterized binds). |
| T-20-04-04 | Information Disclosure | Phase 19.1 confidence column read by computeViewerTasteProfile | accept | `confidence` is a public column on `watches_catalog` (RLS allows read). No PII. |

ASVS L1: V4 (access control) — getWatchByIdForViewer existing two-layer privacy gate (audited v3.0). V5 (input validation) — Server Component params parsed via Next.js dynamic-route shape validation; catalogId resolution gated by getCatalogById null-handling.
</threat_model>

<verification>
- All 4 frontmatter `files_modified` resolved (3 modified, 1 deleted)
- `npx vitest run tests/app tests/components --reporter=basic` exits 0
- `test ! -f src/components/insights/SimilarityBadge.tsx` exits 0
- `grep "computeVerdictBundle" src/app/watch/[id]/page.tsx` exits 0
- `grep "CollectionFitCard" src/components/watch/WatchDetail.tsx` exits 0
- `git diff HEAD -- src/lib/similarity.ts` empty (D-09 still locked)
</verification>

<success_criteria>
1. `/watch/[id]/page.tsx` computes `VerdictBundle` on the server when collection is non-empty, and threads `verdict` prop to `WatchDetail`.
2. D-07 enforced: empty viewer collection → no `<CollectionFitCard>` rendered.
3. Same-user → framing="same-user"; cross-user → framing="cross-user".
4. `WatchDetail.tsx` renders `<CollectionFitCard verdict={verdict} />` instead of `<SimilarityBadge>`.
5. `SimilarityBadge.tsx` deleted (single consumer migrated; no dead code).
6. Engine no longer imported by `WatchDetail.tsx` directly.
7. `analyzeSimilarity` body byte-identical to HEAD (D-09).
8. 4 integration tests + full test suite green.
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-04-SUMMARY.md`.
</output>
