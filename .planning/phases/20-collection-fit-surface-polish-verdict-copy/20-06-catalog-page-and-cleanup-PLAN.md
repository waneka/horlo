---
phase: 20
plan: 06
type: execute
wave: 3
depends_on: ["20-02", "20-03"]
files_modified:
  - src/app/catalog/[catalogId]/page.tsx
  - src/components/explore/DiscoveryWatchCard.tsx
  - src/components/explore/TrendingWatches.tsx
  - src/components/explore/GainingTraction.tsx
  - tests/app/catalog-page.test.ts
autonomous: true
requirements: [FIT-03]

must_haves:
  truths:
    - "/catalog/[catalogId] route exists and is keyed by watches_catalog.id (UUID)"
    - "Page returns 404 when catalogId does not exist in watches_catalog"
    - "When viewer.collection.length === 0 → page renders without <CollectionFitCard> (D-07)"
    - "When viewer already owns a watch with this catalogId → page renders 'You own this watch' callout (D-08), framing='self-via-cross-user'"
    - "When viewer does NOT own this catalogId AND collection > 0 → page renders <CollectionFitCard> with framing='cross-user'"
    - "DiscoveryWatchCard is wrapped in <Link href='/catalog/{watch.catalogId}'> — the dangling /evaluate?catalogId= comment is removed"
    - "/evaluate route does NOT exist anywhere in src/ — verified by tests/no-evaluate-route.test.ts"
  artifacts:
    - path: "src/app/catalog/[catalogId]/page.tsx"
      provides: "Server Component for catalog watch detail with verdict computation + D-07/D-08 framing"
      contains: "computeVerdictBundle"
    - path: "src/components/explore/DiscoveryWatchCard.tsx"
      provides: "MODIFIED — wrapped in Link to /catalog/[catalogId]"
      contains: "/catalog/"
    - path: "tests/app/catalog-page.test.ts"
      provides: "5 integration tests for /catalog/[catalogId] route — 404, framing branches, D-07, D-08"
      contains: "framing"
  key_links:
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/lib/verdict/composer (computeVerdictBundle)"
      via: "Server Component import"
      pattern: "from '@/lib/verdict/composer'"
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/lib/verdict/shims (catalogEntryToSimilarityInput)"
      via: "Server Component import — catalog entries are not Watch yet, need shim"
      pattern: "catalogEntryToSimilarityInput"
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/data/catalog (getCatalogById)"
      via: "DAL import"
      pattern: "getCatalogById"
    - from: "src/components/explore/DiscoveryWatchCard.tsx"
      to: "src/app/catalog/[catalogId]/page.tsx"
      via: "Link click target"
      pattern: "href={`/catalog/"
---

<objective>
Ship FIT-03 + D-10:
- Build the new `/catalog/[catalogId]/page.tsx` Server Component that surfaces a catalog watch with viewer-specific Collection Fit verdict (D-03 static surface, framing branches per D-07/D-08).
- Repoint `DiscoveryWatchCard` (and any other catalog-row entry point in src/components/explore/) from the dangling `/evaluate?catalogId=` reference to `/catalog/[catalogId]`.
- Verify the `/evaluate` route does not exist anywhere in src/.

Purpose: Closes the loop on D-10 (locked routing shape: Option A — `/catalog/[catalogId]` per Plan-Checker resolution of RESEARCH Open Q4). Existing `/watch/[id]` route stays untouched. The catalog page is reached from `/explore` Trending + Gaining Traction rails.

Output:
- `src/app/catalog/[catalogId]/page.tsx` — NEW Server Component with full D-07/D-08 branching.
- `src/components/explore/DiscoveryWatchCard.tsx` — MODIFIED to wrap in `<Link href='/catalog/{catalogId}'>`.
- `src/components/explore/TrendingWatches.tsx`, `GainingTraction.tsx` — MODIFIED to pass watch.catalogId (or whatever shape DiscoveryWatchCard now expects) and remove the comment-only /evaluate reference.
- `tests/app/catalog-page.test.ts` — 5 integration tests filling Plan 01 it.todos.
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
<!-- From Plan 02 -->
```typescript
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
```

<!-- From Plan 03 -->
```typescript
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
```

<!-- Existing DAL -->
```typescript
// src/data/catalog.ts
export async function getCatalogById(id: string): Promise<CatalogEntry | null>

// src/data/watches.ts (existing)
export async function getWatchesByUser(userId: string): Promise<Watch[]>
```

<!-- Existing components in src/components/explore/ — verify shapes by Read first -->
```typescript
// src/components/explore/DiscoveryWatchCard.tsx — current shape (Plan 18):
// Non-clickable card with brand/model/sublabel; the comment at line 14
// references "Phase 20 lights up /evaluate?catalogId={uuid}" — UPDATE to
// /catalog/{catalogId}.

// src/components/explore/TrendingWatches.tsx + GainingTraction.tsx —
// existing rail components that render <DiscoveryWatchCard>; need to confirm
// what shape they pass + whether they wrap in their own Link or not (Plan 06
// adds the Link wrapper if they don't, OR modifies DiscoveryWatchCard to wrap
// itself — choose the path the codebase prefers per Read).
```

<!-- Auth + types -->
```typescript
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import type { Watch } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'
```

<!-- Drizzle for self-owned detection -->
```typescript
// src/db
import { db } from '@/db'
import { watches } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create /catalog/[catalogId]/page.tsx with D-07/D-08 framing branches + 5 integration tests</name>
  <files>src/app/catalog/[catalogId]/page.tsx, tests/app/catalog-page.test.ts</files>
  <read_first>
    - src/app/watch/[id]/page.tsx (post-Plan-04 state — confirms the verdict-computation shape Plan 06 mirrors)
    - src/data/catalog.ts (lines 240-250 — getCatalogById signature)
    - src/data/watches.ts (lines 85-160 — getWatchesByUser; verify if there's a helper for "find viewer's watch with catalogId" — if NOT, hand-roll a Drizzle SELECT in this plan)
    - src/db/schema (watches table — confirm `userId`, `catalogId`, `id`, `acquisitionDate`, `createdAt` columns)
    - src/lib/verdict/composer.ts (Plan 02), shims.ts, viewerTasteProfile.ts
    - src/lib/verdict/types.ts (Plan 01 — VerdictBundle, including VerdictBundleSelfOwned shape with ownedAtIso + ownerHref)
    - src/components/insights/CollectionFitCard.tsx (Plan 03 — pure renderer)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-03, D-07, D-08, D-10
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Cross-Surface Integration Notes → "/catalog/[catalogId]/page.tsx (NEW per D-10 lock)" — full page chrome contract + h1 styling
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-RESEARCH.md § Open Questions Q4 (Option A locked) — "/catalog/[catalogId]" route
  </read_first>
  <behavior>
    - URL `/catalog/{uuid}` reaches the page; the param is the catalog UUID (NOT a per-user watches.id).
    - When `getCatalogById(catalogId)` returns null → call `notFound()` → 404.
    - When viewer is unauthenticated → behaviour matches existing project convention (typically getCurrentUser throws, page redirects to /signin via the layout — confirm this exists; if not, manually redirect).
    - When viewer is authenticated AND `viewerOwnsCatalogRef === true` → render `<CollectionFitCard>` with `framing: 'self-via-cross-user'`, `ownedAtIso: viewerWatch.acquisitionDate ?? viewerWatch.createdAt`, `ownerHref: /watch/{viewerWatch.id}`.
    - When viewer is authenticated AND `viewerOwnsCatalogRef === false` AND `collection.length === 0` → page renders WITHOUT the verdict card (D-07).
    - When viewer is authenticated AND `viewerOwnsCatalogRef === false` AND `collection.length > 0` → render `<CollectionFitCard>` with `framing: 'cross-user'`, full verdict computed.
    - Page chrome includes watch image (catalog imageUrl), brand+model+reference heading (`<h1 className="text-2xl font-semibold">`), specs sublabel, then the card slot.
  </behavior>
  <action>
**File 1: `src/app/catalog/[catalogId]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import Image from 'next/image'

import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import type { Watch } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'

import { db } from '@/db'
import { watches as watchesTable } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

interface CatalogPageProps {
  params: Promise<{ catalogId: string }>
}

/**
 * Phase 20 D-10 — /catalog/[catalogId] route (locked per Plan-Checker resolution
 * of RESEARCH Open Q4 / Option A).
 *
 * - Looks up by watches_catalog.id (catalog UUID), NOT watches.id.
 * - Computes verdict against viewer's own collection (D-03 server compute).
 * - D-07: when viewer collection is empty → no verdict card.
 * - D-08: when viewer already owns a watch with this catalogId → "You own this"
 *   framing — no verdict computed; link points to viewer's per-user /watch/[id].
 *
 * Existing /watch/[id]/page.tsx (per-user UUID lookup) stays byte-untouched.
 */
export default async function CatalogPage({ params }: CatalogPageProps) {
  const { catalogId } = await params
  const user = await getCurrentUser()

  const [catalogEntry, collection, preferences, viewerOwnedRow] = await Promise.all([
    getCatalogById(catalogId),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
    findViewerWatchByCatalogId(user.id, catalogId),
  ])

  if (!catalogEntry) notFound()

  let verdict: VerdictBundle | null = null

  if (viewerOwnedRow) {
    // D-08 — viewer already owns this catalog ref; swap to "You own this" framing.
    verdict = {
      framing: 'self-via-cross-user',
      ownedAtIso: viewerOwnedRow.acquisitionDate ?? new Date().toISOString(),
      ownerHref: `/watch/${viewerOwnedRow.id}`,
    }
  } else if (collection.length > 0) {
    // D-03/D-07 — cross-user framing, full verdict.
    const profile = await computeViewerTasteProfile(collection)
    const candidate: Watch = catalogEntryToSimilarityInput(catalogEntry)
    verdict = computeVerdictBundle({
      candidate,
      catalogEntry,
      collection,
      preferences,
      profile,
      framing: 'cross-user',
    })
  }
  // else: collection.length === 0 → verdict stays null → no card (D-07)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-start gap-4">
        {catalogEntry.imageUrl && (
          <div className="size-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
            <Image
              src={catalogEntry.imageUrl}
              alt={`${catalogEntry.brand} ${catalogEntry.model}`}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {catalogEntry.brand} {catalogEntry.model}
          </h1>
          {catalogEntry.reference && (
            <p className="text-sm text-muted-foreground">{catalogEntry.reference}</p>
          )}
          <SpecsSublabel
            movement={catalogEntry.movement}
            caseSizeMm={catalogEntry.caseSizeMm}
            dialColor={catalogEntry.dialColor}
          />
        </div>
      </div>

      {verdict && <CollectionFitCard verdict={verdict} />}
    </div>
  )
}

function SpecsSublabel({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement: string | null
  caseSizeMm: number | null
  dialColor: string | null
}) {
  const parts = [
    movement,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}

/**
 * D-08 detection — does the viewer already own a row in `watches` with this
 * catalogId? If yes, return the row (we need its id + acquisitionDate for the
 * "You own this" callout). If no, return null.
 *
 * SECURITY: query is scoped by both userId AND catalogId — the viewer can never
 * read another user's watches.id even if catalogIds collide across users
 * (which is expected — multiple users own the same catalog ref).
 */
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string | null } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
      acquisitionDate: watchesTable.acquisitionDate,
      createdAt: watchesTable.createdAt,
    })
    .from(watchesTable)
    .where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  // acquisitionDate is `date` (ISO yyyy-mm-dd) or null; createdAt is timestamp.
  // VerdictBundleSelfOwned.ownedAtIso is `string` (ISO date). Use acquisitionDate
  // when present, else fall back to createdAt converted to ISO.
  const iso = row.acquisitionDate
    ? String(row.acquisitionDate)
    : (row.createdAt ? new Date(row.createdAt as unknown as Date).toISOString() : null)
  return { id: row.id, acquisitionDate: iso }
}
```

NOTES:
- Implementer must verify the column types of `watchesTable.acquisitionDate` and `watchesTable.createdAt` in src/db/schema. The `String(row.acquisitionDate)` and `new Date(...).toISOString()` adapters above are placeholders — adjust based on actual schema.
- If a helper like `getViewerWatchByCatalog(userId, catalogId)` already exists in `src/data/watches.ts`, USE THAT instead of inlining a Drizzle SELECT. Read the file first.
- The page does NOT support unauthenticated viewers — `getCurrentUser` throws → caller layout typically redirects. If the project's pattern differs (some routes are anonymous-friendly), consult `src/app/u/[username]/page.tsx` for precedent and adapt.

**File 2: `tests/app/catalog-page.test.ts`** — REPLACE Plan 01 it.todos with 5 integration tests:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCurrentUser = vi.fn()
const mockGetCatalogById = vi.fn()
const mockGetWatchesByUser = vi.fn()
const mockGetPreferencesByUser = vi.fn()
const mockComputeVerdictBundle = vi.fn()
const mockComputeViewerTasteProfile = vi.fn()
const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })

// Mock the inline Drizzle SELECT via mocking @/db.
const mockDbLimit = vi.fn()
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockDbLimit,
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/data/catalog', () => ({ getCatalogById: mockGetCatalogById }))
vi.mock('@/data/watches', () => ({ getWatchesByUser: mockGetWatchesByUser }))
vi.mock('@/data/preferences', () => ({ getPreferencesByUser: mockGetPreferencesByUser }))
vi.mock('@/lib/verdict/composer', () => ({ computeVerdictBundle: mockComputeVerdictBundle }))
vi.mock('@/lib/verdict/viewerTasteProfile', () => ({
  computeViewerTasteProfile: mockComputeViewerTasteProfile,
}))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: unknown }) =>
    `<CollectionFitCard verdict=${JSON.stringify(verdict)} />`,
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => `<img src="${src}" alt="${alt}" />`,
}))

import CatalogPage from '@/app/catalog/[catalogId]/page'

const validCatalogId = '00000000-0000-4000-8000-000000000000'

const baseCatalogEntry = {
  id: validCatalogId, brand: 'X', model: 'Y', reference: null, source: 'admin_curated',
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
}

describe('D-10 /catalog/[catalogId] page (Plan 06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'viewer-1', email: 'v@b' })
    mockGetWatchesByUser.mockResolvedValue([])
    mockGetPreferencesByUser.mockResolvedValue({})
    mockComputeViewerTasteProfile.mockResolvedValue({})
    mockComputeVerdictBundle.mockReturnValue({
      framing: 'cross-user', label: 'core-fit', headlinePhrasing: 'Core Fit',
      contextualPhrasings: ['ok'], mostSimilar: [], roleOverlap: false,
    })
    mockDbLimit.mockResolvedValue([])  // viewer does NOT own a watch with this catalogId
  })

  it('returns 404 when catalogId does not exist in watches_catalog', async () => {
    mockGetCatalogById.mockResolvedValue(null)
    await expect(CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) }))
      .rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders <CollectionFitCard> with framing="cross-user" when viewer does not own this catalog ref AND collection > 0', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([])  // not owned
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).toHaveBeenCalledTimes(1)
    expect(mockComputeVerdictBundle.mock.calls[0][0].framing).toBe('cross-user')
  })

  it('hides <CollectionFitCard> entirely when viewer.collection.length === 0 (D-07)', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([])  // empty collection
    mockDbLimit.mockResolvedValue([])  // not owned
    await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
  })

  it('renders "You own this watch" callout when viewer already owns this catalog ref (D-08)', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'mine-1',
      acquisitionDate: '2026-04-12',
      createdAt: '2026-04-12T00:00:00.000Z',
    }])
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    // D-08 path does NOT call composer; verdict is built inline as VerdictBundleSelfOwned.
    expect(mockComputeVerdictBundle).not.toHaveBeenCalled()
    // Result should contain the self-owned framing — assert via stringified mock CollectionFitCard.
    const rendered = JSON.stringify(result)
    expect(rendered).toMatch(/self-via-cross-user/)
  })

  it('callout link points to /watch/{viewer.watches.id} — per-user UUID, not catalog UUID', async () => {
    mockGetCatalogById.mockResolvedValue(baseCatalogEntry)
    mockGetWatchesByUser.mockResolvedValue([{ id: 'mine-1' }])
    mockDbLimit.mockResolvedValue([{
      id: 'per-user-uuid-abc',
      acquisitionDate: '2026-04-12',
      createdAt: '2026-04-12T00:00:00.000Z',
    }])
    const result = await CatalogPage({ params: Promise.resolve({ catalogId: validCatalogId }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toMatch(/\/watch\/per-user-uuid-abc/)
    expect(rendered).not.toMatch(new RegExp(`/watch/${validCatalogId}`))  // not catalog UUID
  })
})
```
  </action>
  <verify>
    <automated>npx vitest run tests/app/catalog-page tests/no-evaluate-route --reporter=basic</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/catalog/[catalogId]/page.tsx` exits 0
    - `grep "computeVerdictBundle" src/app/catalog/[catalogId]/page.tsx` exits 0
    - `grep "framing: 'cross-user'" src/app/catalog/[catalogId]/page.tsx` exits 0 (D-03 cross-user branch)
    - `grep "framing: 'self-via-cross-user'" src/app/catalog/[catalogId]/page.tsx` exits 0 (D-08 branch)
    - `grep "if (collection.length > 0)" src/app/catalog/[catalogId]/page.tsx` exits 0 (D-07 hide-when-empty)
    - `grep "viewerOwnedRow" src/app/catalog/[catalogId]/page.tsx` exits 0 (D-08 detection)
    - `grep "ownerHref: \`/watch/" src/app/catalog/[catalogId]/page.tsx` exits 0 (links to viewer's per-user watches.id, not catalog uuid)
    - `grep "catalogEntryToSimilarityInput" src/app/catalog/[catalogId]/page.tsx` exits 0 (uses Plan 02 shim)
    - `grep "notFound()" src/app/catalog/[catalogId]/page.tsx` exits 0 (404 handling)
    - `grep -c "it\.todo" tests/app/catalog-page.test.ts` returns 0
    - `grep -cE "^\s*it\(" tests/app/catalog-page.test.ts` returns 5
    - `npx vitest run tests/app/catalog-page tests/no-evaluate-route --reporter=basic` exits 0 (5 + 3 passing)
    - `test ! -d src/app/evaluate` exits 0 (success criterion 5 — never created)
  </acceptance_criteria>
  <done>/catalog/[catalogId] route exists with D-07/D-08/D-03 framing branches; 5 integration tests pass; no /evaluate route created.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire DiscoveryWatchCard + Trending/GainingTraction rails to /catalog/[catalogId]</name>
  <files>src/components/explore/DiscoveryWatchCard.tsx, src/components/explore/TrendingWatches.tsx, src/components/explore/GainingTraction.tsx</files>
  <read_first>
    - src/components/explore/DiscoveryWatchCard.tsx (entire file — line 14 comment about /evaluate; current shape takes `watch: { id, brand, model, imageUrl }` — verify if `id` is the catalog UUID or a per-user watch id; CONTEXT D-10 says it's the catalog UUID)
    - src/components/explore/TrendingWatches.tsx (entire file — confirm what shape it passes to DiscoveryWatchCard; if it does its own Link wrapping, remove that)
    - src/components/explore/GainingTraction.tsx (entire file — same as Trending)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-CONTEXT.md § Implementation Decisions D-10 (lock: /catalog/[catalogId] is the new route)
    - .planning/phases/20-collection-fit-surface-polish-verdict-copy/20-UI-SPEC.md § Cross-Surface Integration Notes → "DiscoveryWatchCard (Phase 18, MODIFIED per D-10)" — wrap in Link, no new visual shapes
  </read_first>
  <action>
**Step 1:** Read both rail files (TrendingWatches, GainingTraction) to confirm current shape. The shape may differ between them.

**Step 2:** Modify `src/components/explore/DiscoveryWatchCard.tsx` to wrap the card body in a `<Link href={`/catalog/${watch.id}`}>` (where `watch.id` is the catalog UUID — the current Phase 18 contract; verify by reading the file). Remove the `/evaluate?catalogId=` mention from the comment block.

```typescript
import Link from 'next/link'
import type { ReactNode } from 'react'

interface DiscoveryWatchCardWatch {
  id: string                  // watches_catalog.id (catalog UUID)
  brand: string
  model: string
  imageUrl: string | null
}

/**
 * DiscoveryWatchCard — shared card body for Trending + Gaining Traction (D-13).
 *
 * Phase 20 D-10: wrapped in <Link href="/catalog/[catalogId]"> per the new
 * catalog detail route. The watch.id field is `watches_catalog.id` (NOT a
 * per-user watches.id) — the route looks up by catalog UUID.
 *
 * Width: w-44 mobile / w-52 desktop — fits 5+ cards on a desktop scroll strip
 * per 18-UI-SPEC.md § Component Inventory.
 */
export function DiscoveryWatchCard({
  watch,
  sublabel,
}: {
  watch: DiscoveryWatchCardWatch
  sublabel: ReactNode
}) {
  return (
    <Link
      href={`/catalog/${watch.id}`}
      className="block w-44 md:w-52 space-y-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${watch.brand} ${watch.model} — view details`}
    >
      <div className="aspect-square rounded-md bg-muted overflow-hidden">
        {watch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={watch.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground truncate">{watch.brand}</p>
        <p className="text-sm text-muted-foreground truncate">{watch.model}</p>
        <p className="text-sm text-muted-foreground">{sublabel}</p>
      </div>
    </Link>
  )
}
```

**Step 3:** Read `src/components/explore/TrendingWatches.tsx` and `src/components/explore/GainingTraction.tsx`. If either of them already wraps `<DiscoveryWatchCard>` in a `<Link>`, remove THAT wrapper (DiscoveryWatchCard now owns the link). If they do not, no changes needed in those files. Either way, verify they pass `watch.id = catalogEntry.id` (catalog UUID).

If the rail files reference `/evaluate?catalogId=` in any comment or string literal, remove those references.

**Step 4:** Sweep for any other `/evaluate?catalogId=` references in `src/app/`, `src/components/`, `src/lib/`. If grep finds any, remove them (with the exception of test files which were already updated in Plan 05).
  </action>
  <verify>
    <automated>npx vitest run tests/no-evaluate-route tests/app/catalog-page --reporter=basic && grep -r "/evaluate?catalogId" src/ || echo "OK: no remaining /evaluate refs in src/"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "from 'next/link'" src/components/explore/DiscoveryWatchCard.tsx` exits 0 (Link import added)
    - `grep "href={\\\`/catalog/" src/components/explore/DiscoveryWatchCard.tsx` exits 0 (Link href to /catalog)
    - `grep "/evaluate" src/components/explore/DiscoveryWatchCard.tsx` exits 1 (old reference removed)
    - `grep "/evaluate" src/components/explore/TrendingWatches.tsx` exits 1
    - `grep "/evaluate" src/components/explore/GainingTraction.tsx` exits 1
    - `grep -r "/evaluate?catalogId" src/` exits 1 (NO remaining refs anywhere in src/)
    - `npx vitest run tests/no-evaluate-route tests/app/catalog-page --reporter=basic` exits 0
    - `test ! -d src/app/evaluate` exits 0 (success criterion 5 still holds)
  </acceptance_criteria>
  <done>DiscoveryWatchCard wrapped in Link to /catalog/[catalogId]; rails verified clean; no remaining /evaluate references in src/.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client URL → /catalog/[catalogId] | The `catalogId` param flows in via the URL; no privacy gate needed because watches_catalog is public-read RLS (CAT-02) |
| viewer DB → page Server Component | `findViewerWatchByCatalogId(viewerId, catalogId)` is scoped by BOTH userId AND catalogId; never reads other users' watches |
| Discovery card → /catalog page | Click target is a per-page route; the auth requirement is the same as the rest of the app |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-06-01 | Information Disclosure | findViewerWatchByCatalogId — could leak other users' rows | mitigate | Drizzle SELECT WHERE userId=viewer.id AND catalogId=catalogId — both clauses. Other users' rows with same catalogId are filtered by the userId predicate. Drizzle parameterized binds prevent injection. Acceptance criterion `grep "eq(watchesTable.userId, userId)"` exits 0. |
| T-20-06-02 | Tampering | catalogId URL param | mitigate | `getCatalogById(catalogId)` returns null for non-existent IDs → page calls notFound(). No SQL injection (Drizzle parameterized bind). Even an attacker-supplied catalogId can only resolve to a public catalog row — RLS public-read is the existing v3.0 contract (CAT-02). |
| T-20-06-03 | Information Disclosure | Page leaks viewer collection details to other viewers | accept | The page is per-viewer rendered (Server Component computes against `getCurrentUser`). No cross-viewer leak — the verdict and most-similar list are built from the calling viewer's own collection. |
| T-20-06-04 | Spoofing | Direct navigation to /catalog/{any-uuid} | accept | Anyone authenticated can navigate to any catalog page. That's intentional — the catalog is a global/public reference. The viewer's verdict is computed against THEIR collection only, so no privacy leak. |
| T-20-06-05 | Information Disclosure | acquisitionDate displayed for a watch the viewer owns | accept | The viewer is reading THEIR OWN row's acquisitionDate. No leak. |
| T-20-06-06 | Tampering | DiscoveryWatchCard image source URL | accept | imageUrl flows from `watches_catalog.imageUrl` which is admin/extracted-controlled. We use `next/image` `unoptimized` (existing project pattern). No SSRF surface added. |

ASVS L1 V2 (auth): getCurrentUser. V4 (access control): viewer.id scoping in findViewerWatchByCatalogId. V5 (input validation): catalogId resolved via Drizzle parameterized bind; null result → notFound().
</threat_model>

<verification>
- All 5 frontmatter `files_modified` exist on disk (1 new, 3 modified, 1 test)
- `test -f src/app/catalog/[catalogId]/page.tsx` exits 0
- `test ! -d src/app/evaluate` exits 0 (success criterion 5)
- `grep -r "/evaluate?catalogId" src/` exits 1 (no remaining refs)
- `npx vitest run --reporter=basic` exits 0 (full suite green)
- `git diff HEAD -- src/lib/similarity.ts` empty (D-09 still locked)
- Static guards from Plan 01 still pass: `tests/no-evaluate-route.test.ts` + `tests/static/CollectionFitCard.no-engine.test.ts`
</verification>

<success_criteria>
1. `/catalog/[catalogId]/page.tsx` exists, computes verdict on the server with D-07/D-08 framing branches.
2. `notFound()` is called for nonexistent catalogIds.
3. D-08 self-via-cross-user framing is built INLINE on the page (composer not called when viewer already owns) and links to `/watch/{viewer.watches.id}`.
4. `DiscoveryWatchCard` wrapped in `<Link href='/catalog/{catalogId}'>` — dangling `/evaluate?catalogId=` reference eliminated.
5. No remaining `/evaluate?catalogId=` references anywhere in `src/`.
6. `/evaluate/` directory does NOT exist (success criterion 5 enforced by Plan 01 guard test still passing).
7. 5 integration tests passing for catalog page.
8. Full vitest suite green.
9. `analyzeSimilarity` body byte-identical to HEAD (D-09).
</success_criteria>

<output>
After completion, create `.planning/phases/20-collection-fit-surface-polish-verdict-copy/20-06-SUMMARY.md`.
</output>
