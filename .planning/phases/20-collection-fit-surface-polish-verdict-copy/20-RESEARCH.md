# Phase 20: Collection Fit Surface Polish + Verdict Copy — Research

**Researched:** 2026-04-29
**Domain:** UI extraction + deterministic copy composition + Server Action lazy compute (Next.js 16 App Router, base-ui, Zustand-free Server Components)
**Confidence:** HIGH

## Summary

Phase 20 is a UI/composition phase, not an engine phase. The substrate already exists: `analyzeSimilarity()` is byte-locked (D-09); Phase 19.1 just shipped `formality`, `sportiness`, `heritage_score`, `primary_archetype`, `era_signal`, `design_motifs`, `confidence`, and `extracted_from_photo` columns on `watches_catalog` (verified in `src/lib/types.ts:134-145`); Phase 19 ships `WatchSearchRow` with a single dangling `/evaluate?catalogId=` href; Phase 18 ships a `DiscoveryWatchCard` that is currently non-clickable (verified in `src/components/explore/DiscoveryWatchCard.tsx`).

This phase does five concrete things: (1) extract a pure-renderer `<CollectionFitCard>` from `<SimilarityBadge>`; (2) build a deterministic template-library composer over `SimilarityResult` + viewer aggregate taste profile + candidate `CatalogEntry`; (3) add a cross-user verdict surface on the *existing* `/watch/[id]` route (no new route file); (4) replace the `<Link>`-wrapped row in `WatchSearchRow` with an accordion-aware row that lazy-loads its verdict via a `getVerdictForCatalogWatch(catalogId)` Server Action; (5) wire `DiscoveryWatchCard` into a clickable card pointing somewhere sensible (see Open Question 4 below — D-10 has a routing-shape ambiguity that needs locking before code).

**Primary recommendation:** Use base-ui's existing `Accordion` primitive (`@base-ui/react/accordion`, version 1.4.1 confirmed) for FIT-04 — it is already a dependency and supplies `value`/`onValueChange` controlled mode plus `multiple={false}` (one-at-a-time). Co-locate the composer + caller-shim + viewer-profile pure functions in a new `src/lib/verdict/` module sibling to `src/lib/taste/`. Keep `WatchDetail.tsx` as a Client Component for now (D-09 minimal-disruption), and lift verdict computation to its parent Server Component (`src/app/watch/[id]/page.tsx`) so it ships zero engine-code on the same-user surface and zero engine-code on the cross-user surface — the lazy-compute Server Action only fires for `WatchSearchRow` accordion expansions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Verdict Copy Generation (FIT-02):**
- **D-01:** Verdict phrasings produced by a **template library with slot substitution**. A pure composer function picks the right template(s) from a curated library based on `SimilarityResult` + viewer collection's aggregate taste profile + candidate watch's taste row, then fills named slots (`dominant_style`, `contrast`, `specific_watch`, etc.). Deterministic, free, testable, no LLM. Template library is the single source of truth for the FIT-02 phrasings — including the four roadmap examples (*"fills a hole in your collection"*, *"aligns with your heritage-driven taste"*, *"your collection skews [dominant] — this is a [contrast]"*, *"overlaps strongly with [specific watch]"*).
- **D-02:** Viewer collection's aggregate taste profile is computed by a **pure function on every render**: join viewer watches → `watches_catalog.taste_*` → `mean(formality)`, `mean(sportiness)`, `mean(heritage_score)`, `mode(primary_archetype)`, `mode(era_signal)`, top-K `design_motifs`. **Null-tolerant** — taste columns may be NULL for catalog rows the Phase 19.1 enrichment hasn't reached yet (graceful: skip nulls in mean/mode). No persistence layer, no materialized view. O(N) over collection size (target N < 500 per CLAUDE.md).

**Compute Placement (FIT-01):**
- **D-03:** Two computation paths optimized per surface:
  - **Server Component** for static surfaces: `src/components/watch/WatchDetail.tsx` (existing — same-user) and the new cross-user `/watch/[id]`. Server reads viewer's collection + candidate + computes `VerdictBundle`, ships it as props. Zero client-side similarity engine on these surfaces.
  - **Client Component** for `WatchSearchRow` inline-expand. Lazy compute on first expand via Server Action (see D-06). Avoids shipping the engine + composer in the search-page bundle.
- **D-04:** `<CollectionFitCard>` is a **pure renderer**. Props: `{ verdict: VerdictBundle }` where `VerdictBundle = { label, headlinePhrasing, contextualPhrasings: string[], mostSimilar: Array<{watch, score}>, roleOverlap: boolean, framing: 'same-user' | 'cross-user' | 'self-via-cross-user' }`. Card has no logic — caller (server or client) runs `analyzeSimilarity` + `composeVerdictCopy` and hands the finished bundle. Swap to LLM-generated copy in v5+ by changing the composer, not the card.

**`/search` Inline-Expand UX (FIT-04):**
- **D-05:** Click-to-expand-below-row, **accordion** behavior. Click row's "Evaluate" affordance → row stays in place, `<CollectionFitCard>` slides down underneath. Opening another row's evaluate auto-collapses the previous one (one open at a time). ESC collapses. Tab/keyboard accessible.
- **D-06:** **Lazy compute via Server Action** on first expand:
  - Server Action: `getVerdictForCatalogWatch(catalogId)` → returns `VerdictBundle` for the authenticated viewer's collection.
  - **In-memory session cache** by `catalogId` in the SearchPageClient component state — re-expanding the same row is instant.
  - Cache invalidates if the viewer mutates their collection (subscribe to a Zustand collection-revision counter, or simply key the cache by collection-revision so a new revision drops stale entries).
  - Idle search rows pay zero verdict cost.

**Cross-User Framing + Edge Cases (FIT-03):**
- **D-07:** When viewer's collection has 0 watches, the cross-user `/watch/[id]` page **hides `<CollectionFitCard>` entirely**. No empty-state copy, no onboarding nudge — fit is meaningless without a collection signal. Other detail-page sections render normally.
- **D-08:** When viewer reaches the cross-user route on a watch they already own (`viewer.id === watch_owner.id`), the card **swaps body to a "You own this" framing**: small callout with "You own this watch — added {date}" plus a link to the owner's `WatchDetail`. No verdict computed, no contextual phrasings. Detection at the page level (single read of the watch row's `userId`).

**Engine Lock + Type Unification:**
- **D-09:** `analyzeSimilarity()` body remains **byte-identical** in this phase. Engine changes are deferred to v5+. Type mismatch (search rows are `CatalogEntry`, cross-user collection clicks are someone else's `Watch`, `analyzeSimilarity()` takes `Watch`) is resolved by **caller shims at the boundary**: each call site converts whatever shape it has into the `Watch`-compatible input the engine expects. Shim is a small pure mapper (e.g. `catalogEntryToSimilarityInput()`) co-located with the similarity module. No engine signature change.

**`/explore` Cleanup:**
- **D-10:** `src/components/explore/DiscoveryWatchCard.tsx:14` currently links to dangling `/evaluate?catalogId=`. **Repoint** to cross-user `/watch/[catalogId]` (the new CollectionFitCard surface from FIT-03). Single change per card. Mirrors the rest of v4.0 — catalog watches now have a real detail page.

> **Research note on D-10:** The existing `/watch/[id]/page.tsx` route looks up by `watches.id` (per-user row UUID) via `getWatchByIdForViewer`, NOT by `catalogId`. There is no `/watch/[catalogId]` route today and the existing `[id]` param isn't a catalog UUID. See **Open Question 4** in this RESEARCH.md — the planner must lock the routing shape before D-10 implementation. Three viable resolutions are documented.

### Claude's Discretion

- Exact set of templates in the library (composer's curated phrasing pool) — Claude proposes a starting set covering the four roadmap examples plus 8-12 supporting phrasings, user reviews in PR.
- ESC key handling implementation detail (KeyboardEvent listener vs `useEffect` cleanup) for accordion collapse.
- Server Action caching layer (if any beyond in-memory client cache) — none required by D-06 but acceptable if it falls out naturally from RSC patterns already in use.
- Animation/transition for accordion expand (Framer Motion, CSS transition, or instant) — Claude picks consistent with existing patterns.
- VerdictBundle field naming and exact shape — keep it minimal and pure-render-friendly.

### Deferred Ideas (OUT OF SCOPE)

- **LLM-generated verdict copy** (FIT-06 — v5+): When the template library hits its expressive limit, route low-confidence cases or premium phrasings through claude-haiku-4-5. Requires caching layer + cost monitoring.
- **A/B testing infra for FIT-02 phrasings** (v5+): Random template selection from equivalent variants, measure CTR or downstream "added to wishlist" rate.
- **`analyzeSimilarity()` engine refactor to accept discriminated union `Watch | CatalogEntry`** (v5+): Removes the caller shim layer. Currently locked.
- **Hover-peek verdict on desktop** (v5+ polish): Tiny pill on row hover before full expand.
- **Multi-row simultaneous expand on /search** (v5+ polish): If users want to compare verdicts side-by-side. Currently accordion (D-05).
- **Dominant-style detection enhancement using design_motifs frequency** (v5+): Top-K design motifs across collection as a higher-fidelity dominance signal beyond `primary_archetype` mode.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIT-01 | Extract pure-renderer `<CollectionFitCard>` from `<SimilarityBadge>`; computation moves to caller. | `<SimilarityBadge>` body verified at `src/components/insights/SimilarityBadge.tsx:14-83` — calls `analyzeSimilarity` inline. Surgery is mechanical: strip the call, accept `VerdictBundle` props, keep the JSX rhythm. |
| FIT-02 | Verdict copy expands beyond the 6 fixed `SimilarityLabel` values into richer contextual phrasings. | `getSimilarityLabelDisplay()` at `src/lib/similarity.ts:343-382` is the existing 6-label generator. New composer reads `SimilarityResult` + viewer-aggregate-taste + `CatalogEntry.taste_*` to fill template slots. Phase 19.1 columns confirmed available on `CatalogEntry` — see DAL Inventory. |
| FIT-03 | Cross-user `/watch/[id]` renders correctly framed for a watch the viewer doesn't own. | Existing `/watch/[id]/page.tsx` already privacy-gates cross-user reads via `getWatchByIdForViewer` and passes `viewerCanEdit={isOwner}` to `WatchDetail`. The cross-user case is just `isOwner===false` — already wired. Phase 20 adds verdict computation in this branch. |
| FIT-04 | `WatchSearchRow` "Evaluate" CTA opens an inline-expand verdict preview; the dangling `/evaluate?catalogId=` link is removed. | `WatchSearchRow` href confirmed at `src/components/search/WatchSearchRow.tsx:43`. Replace the absolute-inset Link + raised "Evaluate" Link with an accordion trigger that fires `getVerdictForCatalogWatch(catalogId)` Server Action. |
</phase_requirements>

## Project Constraints (from CLAUDE.md + AGENTS.md)

| Constraint | Source | Impact on Phase 20 |
|------------|--------|---------------------|
| **Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing code** | `AGENTS.md` | Server Action signatures, `'use cache'`/`cacheTag`/`cacheLife` semantics, and Server Component / Client Component boundaries differ from training data. Confirmed Next.js 16.2.4 in registry vs locked 16.2.3 in package.json — patch-level, no migration risk. |
| **Tech stack: Next.js 16 App Router — no rewrites; extend, don't break existing structure** | `CLAUDE.md` | Don't rewrite WatchDetail. Surgical insert of CollectionFitCard at line 425 (existing SimilarityBadge slot). |
| **Performance: target <500 watches per user** | `CLAUDE.md` | D-02 pure-function-per-render is fine at 500 watches × 8 fields = 4000 ops; no need to memoize across renders or cache the aggregate. |
| **Personal first; data isolation correct after multi-user** | `CLAUDE.md` | Server Action `getVerdictForCatalogWatch` MUST gate on `getCurrentUser()` — viewer's collection is the input, never the URL or session-passed userId. Mirror Phase 19 pattern in `src/app/actions/search.ts:81-107`. |
| **Single-user data isolation correctness** | `CLAUDE.md` | Cross-user `/watch/[id]` reads viewer's own collection (auth-gated) and the OTHER user's watch (privacy-gated by getWatchByIdForViewer). Never leak the other user's collection into the verdict input. |
| **GSD Workflow Enforcement: no direct edits outside GSD command** | `CLAUDE.md` | Implementation only proceeds through `/gsd-execute-phase`. Plans must be created via `/gsd-plan-phase 20` after this RESEARCH lands. |

## Standard Stack

### Core (already in repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` | 1.3.0 (registry latest 1.4.1) | Accordion primitive for FIT-04 inline-expand | Already a dependency; ships `Accordion.Root`/`Item`/`Header`/`Trigger`/`Panel` with `value`/`defaultValue`/`onValueChange` controlled mode + `multiple` flag for one-at-a-time. `[VERIFIED: ls node_modules/@base-ui/react/accordion/]` |
| Next.js | 16.2.3 (registry latest 16.2.4) | App Router + Server Actions + Server Components | Locked stack. Patch-level ahead in registry; no migration. `[VERIFIED: npm view next version]` |
| React | 19.2.4 | UI rendering, `useTransition` for pending UX on Server Action | Already used elsewhere (`WatchDetail.tsx:65`). |
| `zustand` | 5.0.12 | Collection revision counter for D-06 cache invalidation | Already used by `useWatchStore` (existing); add a single revision counter (or read existing collection length as a coarse cache key). |
| Vitest + RTL | (existing test setup) | Composer determinism + accordion behavior tests | `vitest.config.ts` confirmed; `tests/setup.ts` includes jest→vi shim. `[VERIFIED: cat vitest.config.ts]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` + `tailwind-merge` (`cn`) | existing | Conditional classes on accordion expand state | Already used everywhere via `src/lib/utils.ts`. |
| `lucide-react` | 1.8.0 | Chevron icon for accordion trigger | Already imported elsewhere (e.g., `Search` icon in SearchPageClient). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@base-ui/react/accordion` | Hand-rolled `useState<openId \| null>` | Hand-roll has fewer deps but loses arrow-key navigation + ARIA + `loopFocus`. base-ui Accordion supplies these out of the box. Pick base-ui. |
| `@base-ui/react/collapsible` (singular per-row) | base-ui Accordion (group-aware) | Collapsible is per-element only and offers no group coordination. With D-05 one-at-a-time semantics, Accordion is the right primitive — passing `multiple={false}` (the default) gives the exact behavior. |
| Server Action with full RSC streaming | Plain `useTransition` + Server Action | Streaming RSC payloads on every accordion expand is overkill at v4.0 scale. Plain Server Action returning `VerdictBundle` JSON is simpler and matches Phase 19's `searchWatchesAction` shape. |
| Materialized aggregate-taste view | Per-render pure function (D-02) | D-02 locked. Don't reconsider. |

**Installation:** No new packages. All dependencies already present.

**Version verification:**
- `npm view next version` → `16.2.4` (lockfile 16.2.3, patch-level ok)
- `npm view @base-ui/react version` → `1.4.1` (lockfile 1.3.0, minor-level ahead — `[VERIFIED: npm view 2026-04-29]`)
- Both in registry as of research date; do NOT bump in this phase (out of scope; existing lockfile is fine).

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── verdict/                       # NEW module — sibling to src/lib/taste/
│   │   ├── types.ts                   # VerdictBundle, ViewerTasteProfile types
│   │   ├── viewerTasteProfile.ts      # Pure function: collection + catalog joins → aggregate taste
│   │   ├── viewerTasteProfile.test.ts # Null-tolerance tests + mean/mode determinism
│   │   ├── templates.ts               # Curated template library (10-16 templates with predicates)
│   │   ├── composer.ts                # composeVerdictCopy(result, viewerProfile, candidate, framing) → VerdictBundle
│   │   ├── composer.test.ts           # Determinism + 4 roadmap-example assertions + framing variants
│   │   ├── shims.ts                   # catalogEntryToSimilarityInput, viewerWatchListToSimilarityInput
│   │   └── shims.test.ts              # Round-trip preservation + null-field handling
│   └── similarity.ts                  # UNCHANGED (D-09 byte-lock)
├── components/
│   └── insights/
│       ├── CollectionFitCard.tsx      # NEW — pure renderer, props: { verdict: VerdictBundle }
│       ├── CollectionFitCard.test.tsx # Renders all framings; never imports analyzeSimilarity
│       └── SimilarityBadge.tsx        # DELETE after WatchDetail migrates (single consumer)
├── components/
│   └── search/
│       ├── WatchSearchRow.tsx         # MODIFIED — Link replaced by Accordion.Trigger
│       ├── WatchSearchRowAccordion.tsx # NEW — Accordion.Root wrapper composed with row + panel
│       └── useWatchSearchVerdictCache.ts # NEW — Map<catalogId, VerdictBundle> hook keyed by collection-revision
├── app/
│   └── actions/
│       └── verdict.ts                 # NEW — getVerdictForCatalogWatch(catalogId) Server Action
└── app/
    └── watch/
        └── [id]/
            └── page.tsx               # MODIFIED — compute VerdictBundle in cross-user branch, pass to WatchDetail
```

### Pattern 1: Pure Renderer Card (D-04)

**What:** `<CollectionFitCard>` is a "dumb" component. It accepts a `VerdictBundle` and renders it. No imports of `analyzeSimilarity`, no `useEffect`, no Server Action calls. Caller computes the bundle and hands it down.

**When to use:** This is mandatory per D-04 — non-negotiable. Mirrors how Phase 19's `<WatchSearchRow>` is a pure renderer (`SearchCatalogWatchResult` props, no fetching).

**Example:**
```typescript
// Source: src/components/insights/CollectionFitCard.tsx (NEW)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VerdictBundle } from '@/lib/verdict/types'

interface CollectionFitCardProps {
  verdict: VerdictBundle
}

export function CollectionFitCard({ verdict }: CollectionFitCardProps) {
  if (verdict.framing === 'self-via-cross-user') {
    return <YouOwnThisCallout ownedAt={verdict.ownedAt} ownerHref={verdict.ownerHref} />
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Collection Fit
          <Badge variant="outline">{verdict.headlinePhrasing}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {verdict.contextualPhrasings.map((p, i) => (
          <p key={i} className="text-sm text-muted-foreground">{p}</p>
        ))}
        {/* mostSimilar list mirrors existing SimilarityBadge.tsx:43-61 rhythm */}
      </CardContent>
    </Card>
  )
}
```

### Pattern 2: Caller Shim at the Engine Boundary (D-09)

**What:** `analyzeSimilarity()` takes `Watch[]`. Search-row callers have a `CatalogEntry` (no `id`, no `status`, slightly different field shapes). Cross-user callers have someone else's `Watch[]` and a `Watch`. Each caller converts its input shape into a `Watch`-compatible shape via a small pure shim, then calls `analyzeSimilarity()` unchanged.

**When to use:** Every place that calls `analyzeSimilarity()` from a non-`Watch` source. There will be exactly two new shim call sites in Phase 20:
1. `getVerdictForCatalogWatch(catalogId)` Server Action — converts `CatalogEntry → Watch-shape` for the candidate.
2. Cross-user `/watch/[id]` page — already has `Watch` (from `getWatchByIdForViewer`) so no shim needed there; only the candidate needs one if we ever evaluate against a `CatalogEntry` directly. (For FIT-03, the candidate IS a real `Watch` of the other user — so NO shim needed for FIT-03's primary flow. Only FIT-04 search-row needs a shim.)

**Example (recommended placement: `src/lib/verdict/shims.ts`):**
```typescript
// Source: NEW — co-located with composer per "cross-domain mappers" convention.
// Codebase precedent: src/data/catalog.ts has mapRowToCatalogEntry() (DB→domain).
// Verdict shim is domain→domain (CatalogEntry→Watch-shape), distinct from DAL.
import type { Watch, CatalogEntry, WatchStatus } from '@/lib/types'

const STATUS_FOR_CANDIDATE: WatchStatus = 'wishlist' // synthetic — candidate is being evaluated, not owned

export function catalogEntryToSimilarityInput(entry: CatalogEntry): Watch {
  return {
    id: entry.id,                    // catalog UUID stands in for watch.id; analyzeSimilarity filters by id
    brand: entry.brand,
    model: entry.model,
    reference: entry.reference ?? undefined,
    status: STATUS_FOR_CANDIDATE,
    movement: (entry.movement as Watch['movement']) ?? 'other',
    complications: entry.complications,
    caseSizeMm: entry.caseSizeMm ?? undefined,
    lugToLugMm: entry.lugToLugMm ?? undefined,
    waterResistanceM: entry.waterResistanceM ?? undefined,
    crystalType: (entry.crystalType as Watch['crystalType']) ?? undefined,
    dialColor: entry.dialColor ?? undefined,
    styleTags: entry.styleTags,
    designTraits: entry.designTraits,
    roleTags: entry.roleTags,
    isChronometer: entry.isChronometer ?? undefined,
    productionYear: entry.productionYear ?? undefined,
    imageUrl: entry.imageUrl ?? undefined,
  }
}
```

**Edge case to plan for:** `entry.movement` is `string | null` on `CatalogEntry`; `Watch.movement` is the closed union `'automatic' | 'manual' | 'quartz' | 'spring-drive' | 'other'`. Coerce unknown values to `'other'` (the engine's `WEIGHTS.strapType` and similar handle missing strap as `0` via `?? 0.5` neutral score; coerce to neutral default rather than throwing).

### Pattern 3: Server Action with In-Memory Client Cache (D-06)

**What:** `getVerdictForCatalogWatch(catalogId)` Server Action computes the bundle for the authenticated viewer. Client component (`WatchSearchRowAccordion`) keeps a `Map<catalogId, VerdictBundle>` keyed by a collection-revision token.

**When to use:** Search row inline-expand. Re-expanding the same row is instant; switching to a different row recomputes. Closing the accordion does NOT clear the cache — the next re-expand of any-already-fetched row returns instantly.

**Example (Server Action — mirrors `searchWatchesAction` pattern):**
```typescript
// Source: NEW src/app/actions/verdict.ts
// Pattern source: src/app/actions/search.ts:81-107 (searchWatchesAction)
'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import type { ActionResult } from '@/lib/actionTypes'
import type { VerdictBundle } from '@/lib/verdict/types'

const verdictSchema = z.object({ catalogId: z.string().uuid() }).strict()

export async function getVerdictForCatalogWatch(
  data: unknown,
): Promise<ActionResult<VerdictBundle>> {
  let user
  try { user = await getCurrentUser() }
  catch { return { success: false, error: 'Not authenticated' } }

  const parsed = verdictSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid request' }

  try {
    const [entry, collection, preferences] = await Promise.all([
      getCatalogById(parsed.data.catalogId),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])
    if (!entry) return { success: false, error: 'Watch not found' }

    const candidate = catalogEntryToSimilarityInput(entry)
    const bundle = computeVerdictBundle({
      candidate,
      catalogEntry: entry,
      collection,
      preferences,
      framing: 'cross-user', // search rows are always non-owned candidates
    })
    return { success: true, data: bundle }
  } catch (err) {
    console.error('[getVerdictForCatalogWatch] unexpected error:', err)
    return { success: false, error: "Couldn't compute verdict." }
  }
}
```

**Cache invalidation strategy:** Key the client-side `Map` by the watch-collection length (or any cheap monotonic counter). When viewer adds/removes a watch, the count changes, the Map is replaced, all cached entries dropped. Mirrors how Phase 18 invalidates `revalidateTag('explore')` on watch mutations — same intent, simpler at this scope.

```typescript
// Source: NEW src/components/search/useWatchSearchVerdictCache.ts
import { useState } from 'react'
import { useWatchStore } from '@/store/watchStore'
import type { VerdictBundle } from '@/lib/verdict/types'

export function useWatchSearchVerdictCache() {
  const collectionLen = useWatchStore((s) => s.watches.length) // or expose a revision counter
  const [cache, setCache] = useState<{ rev: number; map: Map<string, VerdictBundle> }>({
    rev: collectionLen, map: new Map()
  })
  if (cache.rev !== collectionLen) {
    setCache({ rev: collectionLen, map: new Map() })
  }
  return {
    get: (id: string) => cache.map.get(id),
    set: (id: string, b: VerdictBundle) => {
      cache.map.set(id, b)
      setCache({ ...cache, map: new Map(cache.map) }) // trigger re-render
    },
  }
}
```

### Pattern 4: Server Component Compute → Client Renderer (D-03)

**What:** For `/watch/[id]/page.tsx`, compute `VerdictBundle` in the page (Server Component), pass it as a prop to `WatchDetail` (Client Component, retained), which threads it to `<CollectionFitCard>`.

**When to use:** Static surfaces where the data is known at request time (the cross-user `/watch/[id]` and same-user `/watch/[id]` both have the watch + viewer's collection at server-render time). No client-side recompute needed.

**Recommended adjustment to WatchDetail.tsx:** Add a `verdict?: VerdictBundle` prop (optional for backward compat). When provided, `WatchDetail` renders `<CollectionFitCard verdict={verdict} />`. When not provided (defensive default), it falls through to NOT rendering the card — never re-runs `analyzeSimilarity` itself. This is the smallest possible change to `WatchDetail` (it stays Client because of `useTransition`, `useRouter`, `Dialog` state — those don't conflict with receiving a precomputed prop).

**Example (page-level compute):**
```typescript
// Source: src/app/watch/[id]/page.tsx — MODIFIED
// (Existing structure is preserved; the diff is the verdict computation block.)
import { computeVerdictBundle } from '@/lib/verdict/composer'

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

  // NEW: compute verdict per D-07 + D-08
  let verdict: VerdictBundle | null = null
  if (collection.length > 0) {  // D-07: hide card entirely if viewer has empty collection
    const framing = isOwner
      ? 'same-user'
      // D-08: detect "viewer reaches cross-user route on watch they own" —
      // current page is reached via /watch/{theirWatchId}, not /watch/{myWatchId},
      // so this is moot for /watch/[id] as designed. The "self-via-cross-user"
      // case applies only when DiscoveryWatchCard or some surface routes a viewer
      // to a watch where catalog_id matches one they already own. See Open Q4.
      : 'cross-user'
    verdict = computeVerdictBundle({ candidate: watch, collection, preferences, framing })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
        verdict={verdict}    // NEW prop
      />
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Computing the verdict inside `<CollectionFitCard>`:** Violates D-04. The card must be pure-render. If you find yourself adding `useMemo(() => analyzeSimilarity(...))` inside the card, stop — lift it.
- **Subscribing the card to Zustand:** Violates D-04 (turns it into a stateful client component). Caller subscribes if needed; card receives a finished bundle.
- **Pre-fetching all visible search rows' verdicts on mount:** Violates D-06 lazy compute. Only the FIRST expand of a given row should fire the Server Action.
- **Creating a new `/watch/[catalogId]` route file separate from `/watch/[id]`:** Likely violates Next.js routing constraints (two dynamic params at the same level conflict). See Open Q4.
- **Importing `analyzeSimilarity` from `<CollectionFitCard>`:** Catch this in the test — assert the file does not contain `analyzeSimilarity` after refactor (a static-text assertion is sufficient for this guarantee; mirrors how `tests/no-raw-img.test.ts` enforces a similar invariant).
- **Composing copy on the client when the surface is a Server Component:** D-03 says compute on the server for static surfaces. If you find yourself doing `'use client'` + composer inside a page, you violated the bundle-size intent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion with one-at-a-time expand + ARIA + keyboard navigation | Custom `useState<openId \| null>` + manual ARIA | `@base-ui/react/accordion` with `multiple={false}` | Already a dependency; ships `loopFocus`, arrow-key navigation, ARIA-valid `<details>`-style semantics, controlled-mode support. Hand-roll loses these and the test surface for keyboard flows triples. |
| ESC key to collapse accordion | Document-level `keydown` listener with manual cleanup | base-ui Accordion (already supports ESC via Trigger focus + Escape) | Verify in implementation — but base-ui handles this idiomatically. Hand-rolled ESC handlers always have cleanup bugs. |
| Server Action auth gate | Roll-your-own session lookup | `getCurrentUser()` from `src/lib/auth.ts` | Already used by `searchWatchesAction` and 8+ other actions. Throws `UnauthorizedError`; catch and return `{success:false,error:'Not authenticated'}`. Mirror the existing shape exactly. |
| Server Action input validation | Manual type checks | Zod `.strict().max(...)` | Phase 19 standard. Reject mass-assignment + bound input length. |
| Cross-domain mappers (CatalogEntry → Watch) | Spreading + manual normalization at each call site | One co-located shim function with explicit defaults | Centralizing the type bridge means updating it once when `CatalogEntry` or `Watch` evolves. Mirrors `mapRowToCatalogEntry` / `mapRowToWatch` DAL precedent. |
| Pure aggregate-taste profile (mean/mode/top-K) | Lodash imports | Inline reducers | Math is trivial (8 fields, < 30 lines). Avoid library bloat; the codebase has zero lodash usage today. |
| Template-string interpolation with conditionals | Custom mini-DSL | Plain JS function returning a string with template-literal slot fills | Templates as functions are easier to type, easier to test, and don't drag in a templating engine. |

**Key insight:** Phase 20 has zero greenfield infrastructure needs. Every primitive (Accordion, Server Action shape, Server Component compute, Zod validation, base-ui composition) already has a proven precedent in the codebase. Resist the urge to invent.

## Common Pitfalls

### Pitfall 1: WatchDetail.tsx 'use client' boundary leaks the engine into the bundle
**What goes wrong:** `WatchDetail` is `'use client'` (line 1) and currently imports `analyzeSimilarity` (transitively through `<SimilarityBadge>` line 25). If FIT-01 extracts `<CollectionFitCard>` but the new card still imports `analyzeSimilarity` (or imports the composer which transitively imports it), the engine ships in the search-page client bundle the moment any client surface uses the card.
**Why it happens:** Tree-shaking limits — `'use client'` files include all transitive imports in the client bundle.
**How to avoid:**
- `<CollectionFitCard>` MUST NOT import `@/lib/similarity` or `@/lib/verdict/composer` directly.
- The composer should live in `src/lib/verdict/composer.ts` and ONLY be imported by Server Components (`/watch/[id]/page.tsx`) and Server Actions (`getVerdictForCatalogWatch`).
- Add an automated test that scans `CollectionFitCard.tsx` source text for `from '@/lib/similarity'` and `from '@/lib/verdict/composer'` — expect zero matches.
**Warning signs:** Bundle analyzer shows `similarity.ts` in the search-route chunk after Phase 20 ships. Or the FIT-04 search bundle gains > 5KB.

### Pitfall 2: Null taste columns crash the aggregate-taste pure function
**What goes wrong:** Phase 19.1 backfill (`db:backfill-taste`) is a manual post-deploy step. On a fresh dev DB, every catalog row has `formality=null`, `primary_archetype=null`, etc. A naive `mean(arr.map(x => x.formality))` produces `NaN`; a naive `mode()` over an empty array returns `undefined` and breaks downstream slot-fill.
**Why it happens:** D-02 explicitly says null-tolerant, but it's easy to forget when writing the reducer.
**How to avoid:**
- For `mean`: filter nulls THEN check length > 0 THEN average; return `null` (not `0`, not `NaN`) when no signal.
- For `mode`: filter nulls THEN tally; return `null` when tally is empty.
- For `topK design_motifs`: flatten arrays, filter empty, tally, sort desc, slice — return `[]` (not undefined) when no signal.
- Composer must accept `ViewerTasteProfile` where every field is `T | null` (or `[]` for arrays) and gracefully degrade templates that need a non-null slot value (skip the template if its slot resolves to null; fall through to a default phrasing).
**Warning signs:** Composer test that mocks an all-null collection should produce a valid bundle with the 6-fixed-label fallback (D-14 hedged copy gating from Phase 19.1 — but Phase 20 owns the gate logic).

### Pitfall 3: Server Action returns Date objects that don't serialize across the RSC boundary
**What goes wrong:** Server Actions serialize their return value via React's flight payload. `Date` objects, `Map`/`Set`, undefined-as-property, and class instances do NOT survive. Returning `VerdictBundle` with a `Date` for `ownedAt` (D-08) or with `Map` of mostSimilar throws at the boundary.
**Why it happens:** RSC serialization is stricter than JSON. Even `Date` is not natively allowed; must be ISO string.
**How to avoid:**
- `VerdictBundle` MUST be plain serializable JSON: arrays, objects, strings, numbers, booleans, null.
- `mostSimilar` field: array of `{watch: Watch, score: number}` — `Watch` is already serializable per existing CRUD patterns.
- D-08 "added {date}" → store as `ownedAtIso: string`.
- Server Action explicitly returns `JSON.parse(JSON.stringify(bundle))` only as a defensive last resort — better: type-discipline.
**Warning signs:** "Cannot find module" or "Failed to serialize" errors in Server Action response. Or stale UI: bundle is sent but a Date field arrives as an empty `{}`.

### Pitfall 4: Phase 19.1 D-14 confidence gating ambiguity
**What goes wrong:** Phase 19.1 D-14 says: `confidence >= 0.7` → full contextual; `0.5 <= confidence < 0.7` → hedged ("likely a heritage piece"); `confidence < 0.5` → fall back to 6-fixed labels. **Phase 20 owns the gate enforcement.** If the planner forgets to wire the gate, the composer might fire heritage-driven phrasings for catalog rows where the LLM had low confidence — leaking unreliable signals to the user.
**Why it happens:** The gate isn't in the composer's local data; it's a coordination contract between Phase 19.1 (storage) and Phase 20 (consumption).
**How to avoid:**
- Composer reads `entry.confidence` first. If `entry.confidence === null` or `< 0.5`, return a `VerdictBundle` whose `contextualPhrasings` is sourced ONLY from the 6-fixed-label fallback (`getSimilarityLabelDisplay(result.label).description`).
- If `0.5 <= entry.confidence < 0.7`, the composer's slot-fill copy uses hedge templates (e.g. "likely a heritage piece" instead of "is a heritage piece").
- If `entry.confidence >= 0.7`, full contextual templates fire.
- The viewer-aggregate-taste profile has no confidence — but its inputs (collection's catalog rows) might. **Recommendation:** for the aggregate, only include catalog rows with `confidence >= 0.5` in the mean/mode computation; below that threshold the row's taste signal is too noisy to count toward the dominant-style detection. Document this clearly in the composer.
**Warning signs:** A test fixture with `entry.confidence = 0.3` produces a heritage phrasing in the bundle.

### Pitfall 5: D-10 routing-shape ambiguity blocks DiscoveryWatchCard wiring
**What goes wrong:** D-10 says "Repoint to cross-user `/watch/[catalogId]`" but `/watch/[id]/page.tsx` looks up by `watches.id` (a per-user UUID), not `catalogId`. Three plausible interpretations exist; if the planner picks one at implementation time and is wrong, rework is forced.
**Why it happens:** CONTEXT.md was drafted before route-shape verification. The discrepancy was caught in research, not gathering.
**How to avoid:** Lock the routing shape during plan-checker review. Three options documented in **Open Question 4 below** with recommendation. Do NOT implement D-10 until the discuss-phase or planner explicitly resolves this.
**Warning signs:** Implementer hits "404 — getWatchByIdForViewer returns null for catalog UUID" the first time DiscoveryWatchCard is clicked.

### Pitfall 6: Replacing the absolute-inset Link in WatchSearchRow breaks whole-row click
**What goes wrong:** Phase 19's WatchSearchRow uses an `<Link className="absolute inset-0">` to make the entire row clickable, with the inline "Evaluate" button raised via `relative z-10`. Removing the Link breaks whole-row click; keeping the Link conflicts with Accordion.Trigger semantics.
**Why it happens:** Accordion.Trigger needs a button element; the row needs whole-row click; both want the same surface.
**How to avoid:**
- Replace the absolute-inset Link with `<Accordion.Trigger render={<button className="absolute inset-0">}>` — this gives the button-on-the-row semantics base-ui needs, AND makes the entire row clickable.
- Drop the inline raised "Evaluate" button entirely (the new affordance is "click anywhere → expand below"). Or keep it as a *visual* button (no separate click target) inside the row, since the wrapping trigger handles the click.
- Verify ARIA: `Accordion.Trigger` already adds `aria-expanded`/`aria-controls`; we don't need a separate aria-label for the row.
**Warning signs:** Tab key skips the row entirely (no focusable trigger), or two clicks fire (row + button).

### Pitfall 7: Caller shim sets candidate.status='wishlist' which alters analyzeSimilarity flow
**What goes wrong:** `analyzeSimilarity()` (line 222) filters the collection: `collection.filter((w) => w.id !== targetWatch.id)`. The shim assigns `id = entry.id` (catalog UUID). Viewer collection items have their own per-user `watches.id` UUIDs. Catalog UUID never collides with watches UUID — so the filter is a no-op, which is correct. **HOWEVER** — line 225-227: `otherWatches.filter((w) => w.status === 'owned' || w.status === 'grail')` — only owned/grail rows participate. Setting candidate.status='wishlist' in the shim means the candidate itself wouldn't qualify as a comparison target — which is fine because it's the *target*, not in `collection`. **No bug here, but it's load-bearing knowledge.**
**Why it happens:** The engine's status filter is for the collection it's comparing against, not the target. Confusion is easy.
**How to avoid:** Document the shim's `status: 'wishlist'` choice explicitly with a comment referencing engine line 225 — make the invariant visible.
**Warning signs:** Test where `candidate.status='owned'` produces a different result than `candidate.status='wishlist'` — should be byte-identical (target's status is not used in scoring; only its other fields).

## Code Examples

### Example 1: Composer template library shape (recommended)

```typescript
// Source: NEW src/lib/verdict/templates.ts
// Pattern: condition-predicate + template-string with named slots
import type { SimilarityResult, Watch } from '@/lib/types'
import type { ViewerTasteProfile } from './types'

export interface Template {
  id: string
  // Predicate decides whether this template can fire for the given inputs.
  // Returns the slot bag if applicable, null if not.
  predicate: (
    result: SimilarityResult,
    profile: ViewerTasteProfile,
    candidate: Watch,
    candidateTaste: { primaryArchetype: string | null; heritageScore: number | null; confidence: number | null },
  ) => Record<string, string> | null
  // Template literal with ${slot} placeholders.
  template: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'fills-a-hole',
    predicate: (result, profile, _candidate, taste) => {
      // Fires when avgSimilarity is moderate (taste-expansion or outlier)
      // AND candidate's archetype isn't already dominant in the collection
      // AND confidence is sufficient to trust the signal.
      if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
      if (!taste.primaryArchetype || profile.dominantArchetype === taste.primaryArchetype) return null
      if ((taste.confidence ?? 0) < 0.5) return null
      return { archetype: taste.primaryArchetype }
    },
    template: 'Fills a hole in your collection — your first ${archetype}.',
  },
  {
    id: 'aligns-with-heritage',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'hard-mismatch') return null
      if ((taste.heritageScore ?? 0) < 0.7) return null
      if ((profile.meanHeritageScore ?? 0) < 0.6) return null
      if ((taste.confidence ?? 0) < 0.7) return null  // full-confidence gate
      return {}
    },
    template: 'Aligns with your heritage-driven taste.',
  },
  {
    id: 'collection-skews-contrast',
    predicate: (result, profile, _c, taste) => {
      if (result.label === 'core-fit') return null  // contrast doesn't apply when watch is mainstream
      if (!profile.dominantArchetype || !taste.primaryArchetype) return null
      if (profile.dominantArchetype === taste.primaryArchetype) return null
      if ((taste.confidence ?? 0) < 0.7) return null
      return { dominant: profile.dominantArchetype, contrast: taste.primaryArchetype }
    },
    template: 'Your collection skews ${dominant} — this is a ${contrast}.',
  },
  {
    id: 'overlaps-with-specific',
    predicate: (result) => {
      if (!result.mostSimilarWatches[0]) return null
      const top = result.mostSimilarWatches[0]
      if (top.score < 0.6) return null
      return { specific: `${top.watch.brand} ${top.watch.model}` }
    },
    template: 'Overlaps strongly with your ${specific}.',
  },
  // 8-12 supporting templates (planner curates final list during plan-checker)
]
```

### Example 2: Composer entry point

```typescript
// Source: NEW src/lib/verdict/composer.ts
// Server-only by transitivity (imports analyzeSimilarity from src/lib/similarity.ts which is pure but lives in client-importable space; mark composer.ts as 'server-only' to prevent leakage into client bundles per Pitfall 1).
import 'server-only'
import { analyzeSimilarity } from '@/lib/similarity'
import { computeViewerTasteProfile } from './viewerTasteProfile'
import { TEMPLATES } from './templates'
import type { Watch, UserPreferences, CatalogEntry } from '@/lib/types'
import type { VerdictBundle, Framing } from './types'

interface ComposeArgs {
  candidate: Watch                       // already shim-converted if originating from CatalogEntry
  catalogEntry?: CatalogEntry | null     // optional taste source; null when candidate is a per-user Watch w/o catalog link
  collection: Watch[]
  preferences: UserPreferences
  framing: Framing
}

export function computeVerdictBundle(args: ComposeArgs): VerdictBundle {
  const { candidate, catalogEntry, collection, preferences, framing } = args
  const result = analyzeSimilarity(candidate, collection, preferences)
  const profile = computeViewerTasteProfile(collection /*, catalogJoinFn */)

  const candidateTaste = {
    primaryArchetype: catalogEntry?.primaryArchetype ?? null,
    heritageScore: catalogEntry?.heritageScore ?? null,
    confidence: catalogEntry?.confidence ?? null,
  }

  // Pitfall 4: low-confidence fall-through to 6-fixed-label phrasings.
  if ((candidateTaste.confidence ?? 0) < 0.5) {
    return {
      label: result.label,
      headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
      contextualPhrasings: [DESCRIPTION_FOR_LABEL[result.label]],
      mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({ watch, score })),
      roleOverlap: result.roleOverlap,
      framing,
    }
  }

  const phrasings: string[] = []
  for (const t of TEMPLATES) {
    const slots = t.predicate(result, profile, candidate, candidateTaste)
    if (!slots) continue
    phrasings.push(fillTemplate(t.template, slots))
  }
  if (phrasings.length === 0) {
    // Fallback: 6-fixed phrase
    phrasings.push(DESCRIPTION_FOR_LABEL[result.label])
  }

  return {
    label: result.label,
    headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
    contextualPhrasings: phrasings,
    mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({ watch, score })),
    roleOverlap: result.roleOverlap,
    framing,
  }
}

function fillTemplate(tmpl: string, slots: Record<string, string>): string {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, k) => slots[k] ?? '')
}

const HEADLINE_FOR_LABEL = {
  'core-fit': 'Core Fit', 'familiar-territory': 'Familiar Territory', 'role-duplicate': 'Role Duplicate',
  'taste-expansion': 'Taste Expansion', 'outlier': 'Outlier', 'hard-mismatch': 'Hard Mismatch',
} as const
const DESCRIPTION_FOR_LABEL = {
  'core-fit': 'Highly aligned with your taste',
  'familiar-territory': 'Similar to what you like',
  'role-duplicate': 'May compete for wrist time',
  'taste-expansion': 'New but still aligned',
  'outlier': 'Unusual for your collection',
  'hard-mismatch': 'Conflicts with stated dislikes',
} as const  // mirrors getSimilarityLabelDisplay() at src/lib/similarity.ts:343-382
```

### Example 3: ViewerTasteProfile pure function (null-tolerant)

```typescript
// Source: NEW src/lib/verdict/viewerTasteProfile.ts
import 'server-only'
import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Watch } from '@/lib/types'
import type { ViewerTasteProfile, PrimaryArchetype, EraSignal } from './types'

const CONFIDENCE_FLOOR = 0.5  // Pitfall 4 — exclude low-confidence catalog rows from aggregate

export async function computeViewerTasteProfile(collection: Watch[]): Promise<ViewerTasteProfile> {
  if (collection.length === 0) {
    return EMPTY_PROFILE
  }
  const watchIds = collection.map((w) => w.id)
  // JOIN watches → watches_catalog by catalogId (nullable; rows without catalog skipped)
  const rows = await db
    .select({
      formality: watchesCatalog.formality,
      sportiness: watchesCatalog.sportiness,
      heritageScore: watchesCatalog.heritageScore,
      primaryArchetype: watchesCatalog.primaryArchetype,
      eraSignal: watchesCatalog.eraSignal,
      designMotifs: watchesCatalog.designMotifs,
      confidence: watchesCatalog.confidence,
    })
    .from(watches)
    .innerJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(and(
      inArray(watches.id, watchIds),
      sql`${watchesCatalog.confidence} >= ${CONFIDENCE_FLOOR}`,
    ))

  const formalities = rows.map(r => r.formality !== null ? Number(r.formality) : null).filter((x): x is number => x !== null)
  const sportinesses = rows.map(r => r.sportiness !== null ? Number(r.sportiness) : null).filter((x): x is number => x !== null)
  const heritages = rows.map(r => r.heritageScore !== null ? Number(r.heritageScore) : null).filter((x): x is number => x !== null)

  return {
    meanFormality: formalities.length ? formalities.reduce((a, b) => a + b, 0) / formalities.length : null,
    meanSportiness: sportinesses.length ? sportinesses.reduce((a, b) => a + b, 0) / sportinesses.length : null,
    meanHeritageScore: heritages.length ? heritages.reduce((a, b) => a + b, 0) / heritages.length : null,
    dominantArchetype: mode(rows.map(r => r.primaryArchetype).filter((x): x is PrimaryArchetype => x !== null)),
    dominantEraSignal: mode(rows.map(r => r.eraSignal).filter((x): x is EraSignal => x !== null)),
    topDesignMotifs: topK(rows.flatMap(r => r.designMotifs ?? []), 3),
  }
}

const EMPTY_PROFILE: ViewerTasteProfile = {
  meanFormality: null, meanSportiness: null, meanHeritageScore: null,
  dominantArchetype: null, dominantEraSignal: null, topDesignMotifs: [],
}

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  let best: T | null = null; let bestN = 0
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n }
  return best
}

function topK(arr: string[], k: number): string[] {
  if (arr.length === 0) return []
  const counts = new Map<string, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([s]) => s)
}
```

### Example 4: Accordion-wrapped WatchSearchRow

```typescript
// Source: NEW src/components/search/WatchSearchRowAccordion.tsx
'use client'
import { Accordion } from '@base-ui/react/accordion'
import { useState } from 'react'
import { WatchSearchRow } from './WatchSearchRow'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { useWatchSearchVerdictCache } from './useWatchSearchVerdictCache'
import { getVerdictForCatalogWatch } from '@/app/actions/verdict'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
import type { VerdictBundle } from '@/lib/verdict/types'

export function WatchSearchRowsAccordion({
  results, q,
}: { results: SearchCatalogWatchResult[]; q: string }) {
  const [openValue, setOpenValue] = useState<string[]>([])
  const cache = useWatchSearchVerdictCache()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  return (
    <Accordion.Root
      value={openValue}
      onValueChange={async (next) => {
        setOpenValue(next)
        const justOpened = next.find((id) => !openValue.includes(id))
        if (justOpened && !cache.get(justOpened)) {
          setLoadingId(justOpened)
          const res = await getVerdictForCatalogWatch({ catalogId: justOpened })
          if (res.success) cache.set(justOpened, res.data)
          setLoadingId(null)
        }
      }}
      // Default multiple={false} → one-at-a-time per D-05
    >
      {results.map((r) => (
        <Accordion.Item key={r.catalogId} value={r.catalogId}>
          <Accordion.Header>
            <Accordion.Trigger render={<WatchSearchRowTrigger result={r} q={q} />} />
          </Accordion.Header>
          <Accordion.Panel>
            {loadingId === r.catalogId ? (
              <VerdictSkeleton />
            ) : cache.get(r.catalogId) ? (
              <CollectionFitCard verdict={cache.get(r.catalogId)!} />
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<SimilarityBadge>` calls `analyzeSimilarity` inline (Client Component, line 15) | Pure `<CollectionFitCard>` + caller-side compute (D-04) | Phase 20 | Engine no longer ships in any client bundle that imports the card. |
| `WatchSearchRow` whole-row Link → `/evaluate?catalogId=` | Whole-row Accordion.Trigger → inline expand verdict | Phase 20 | One destination removed; one new server action added. |
| 6 fixed `SimilarityLabel` descriptions from `getSimilarityLabelDisplay` | Template-library composer with viewer-aware slot fills | Phase 20 | Copy gains contextual richness; engine output unchanged. |
| `DiscoveryWatchCard` is non-clickable (Phase 18 default) | Wrapped in Link to cross-user watch detail (D-10 — exact route shape pending Open Q4) | Phase 20 | Catalog watches gain a real detail page entry from /explore. |
| Manual `analyzeSimilarity` call at every consumer | Single composer module + caller shims | Phase 20 | Future LLM swap (FIT-06 v5+) is one-file change; engine unification (CAT-13 v5+) deletes shim layer. |

**Deprecated/outdated:**
- The `SimilarityBadge` component will become dead code after Phase 20 — its only consumer is `WatchDetail.tsx:425`. Delete it during Phase 20 to avoid dead-code drift.
- The `/evaluate` route is documented as nonexistent in CONTEXT.md success criterion 5; code references at `WatchSearchRow.tsx:43` and `DiscoveryWatchCard.tsx:14` (comment only) must be removed. Test fixture in `tests/components/search/WatchSearchRow.test.tsx` likely references the href and will break — fixture update required.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Watch.id` (per-user UUID) and `CatalogEntry.id` (catalog UUID) never collide, so the shim's `id: entry.id` assignment in `analyzeSimilarity` collection-filter is safe. | Pattern 2 / Pitfall 7 | Both are Postgres `gen_random_uuid()` — collision probability ~1 in 2^122. If wrong, the shim'd candidate would be filtered OUT of its own comparison set (which would be a no-op since the candidate isn't in the collection anyway). [ASSUMED but extremely safe] |
| A2 | Phase 19.1 `taste_*` columns on `watches_catalog` will be NULL on a fresh dev DB until `npm run db:backfill-taste` runs, but never undefined or missing. | Pitfall 2 | Phase 19.1 schema migration ran; columns exist. NULL-tolerance is the contract. [VERIFIED: src/lib/types.ts:134-145 + 19.1-04-SUMMARY.md] |
| A3 | base-ui `Accordion.Trigger` supports `render={<button>}` slot composition like `Tabs` does. | Pattern 1 / Pitfall 6 | Codebase has `<DialogTrigger render={<Button variant="destructive" />}>` at WatchDetail.tsx:192 — slot composition is the base-ui idiom. Highly likely Accordion supports the same. Verify in implementation by inspecting `Accordion.Trigger.Props`. [ASSUMED — high confidence] |
| A4 | Server Action `getVerdictForCatalogWatch` JSON serialization survives the RSC boundary as long as `VerdictBundle` contains only plain JSON-serializable fields. | Pitfall 3 | RSC flight payload supports plain JS values (objects, arrays, strings, numbers, booleans, null), Date/Map/Set/undefined-as-property rejected. Same constraint as Phase 19's `searchWatchesAction` return shape. [VERIFIED: existing search action shape works] |
| A5 | Phase 19.1 D-14 confidence gating thresholds (0.5, 0.7) are correct for Phase 20 gate enforcement. | Pitfall 4 | Quoted from 19.1-CONTEXT.md D-14 verbatim; user reviewed at gather-time. Risk is low but the thresholds may want tuning during plan-checker. [CITED: 19.1-CONTEXT.md D-14] |
| A6 | The viewer's existing `useWatchStore` exposes a way to detect collection-revision (length count, version counter, or watches array reference identity). | Pattern 3 | Need to verify in implementation. Worst case: add a `revision: number` field to the store and increment on add/edit/delete. Trivial change. [ASSUMED; verifiable in 5 min] |
| A7 | The cross-user `/watch/[id]` route already supports cross-user reads via `getWatchByIdForViewer`'s privacy gate. | FIT-03 / Pattern 4 | [VERIFIED: src/data/watches.ts:119-157 + src/app/watch/[id]/page.tsx existing flow + WatchDetail's `viewerCanEdit` prop] |
| A8 | Removing the `<Link>` wrapper from `WatchSearchRow` and replacing it with an Accordion.Trigger does not break the existing test in `tests/components/search/WatchSearchRow.test.tsx`. | FIT-04 / Pitfall 6 | The test file exists; it likely asserts the row is a Link. [ASSUMED — needs test-file inspection during planning to confirm exact assertions and update them.] |

## Open Questions

1. **Disclosure/Collapsible/Accordion primitive availability** — **RESOLVED.** `@base-ui/react/accordion` is available in the dependency tree (verified at `node_modules/@base-ui/react/accordion/index.parts.d.ts` exporting `Root`, `Item`, `Header`, `Trigger`, `Panel`). The `Root` accepts `value`/`defaultValue`/`onValueChange`/`multiple` props (default `multiple: false`) which matches D-05 one-at-a-time semantics exactly. Use it. NO hand-roll.

2. **Server Action auth reuse** — **RESOLVED.** Phase 19's `searchCatalogWatches` Server Action (`src/app/actions/search.ts:81-107`) uses `getCurrentUser()` from `@/lib/auth.ts:11-19`. The pattern is: `let user; try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }`. `getVerdictForCatalogWatch` should mirror this exactly. Auth helper is `'server-only'` and returns `{id: string; email: string}`.

3. **WatchDetail.tsx rendering model** — **RESOLVED, recommend (b) with minimal-disruption refactor.** WatchDetail.tsx is `'use client'` (line 1) due to `useTransition` (line 65), `useRouter` (line 64), `Dialog` open-state (line 66), and `Checkbox`/`useCallback` interactions. Migrating to a Server Component would require splitting these client interactions out — a much larger change than D-09's intent ("byte-identical engine; minimal touch elsewhere"). **Recommendation:** Lift the verdict computation up to `src/app/watch/[id]/page.tsx` (Server Component, already exists). Add an optional `verdict?: VerdictBundle` prop to `WatchDetail`. WatchDetail stays Client; it just receives a precomputed bundle and threads it to `<CollectionFitCard>`. This keeps the engine off the client bundle for the same-user surface (the current behavior already includes the engine via `<SimilarityBadge>` import — Phase 20 *removes* it from the client bundle, a net improvement).

4. **Cross-user `/watch/[id]` routing shape** — **PARTIALLY RESOLVED — D-10 ROUTING AMBIGUITY NEEDS LOCKING IN PLAN-CHECKER.**

   The existing route is `src/app/watch/[id]/page.tsx`. The `[id]` parameter is a `watches.id` (per-user UUID) — `getWatchByIdForViewer(user.id, id)` reads from `watches` by primary key. **The route already supports cross-user via the privacy gate**: `/u/{username}/collection` clicks navigate to `/watch/${watch.id}` (verified in `src/components/profile/ProfileWatchCard.tsx:42`); when `viewerId !== watch.userId`, the route's privacy logic admits the read if `profile_public AND collection_public`.

   For FIT-03, **NO new route is needed.** The cross-user case is already a code path inside the existing `/watch/[id]/page.tsx` (the `isOwner: false` branch).

   **The unresolved part is D-10:** "Repoint DiscoveryWatchCard to `/watch/[catalogId]`". The DiscoveryWatchCard surfaces *catalog rows* (`watches_catalog.id`, NOT `watches.id`). Three options:

   - **Option A (preferred):** Add a new route `src/app/catalog/[catalogId]/page.tsx` that looks up by catalog UUID, identifies if the viewer or anyone they follow owns it, and renders a CollectionFitCard. Cross-user route (`/watch/[id]`) stays untouched. DiscoveryWatchCard links to `/catalog/[catalogId]`. Most architecturally clean — separates "this is a catalog reference page" from "this is someone's specific instance."
   - **Option B:** Add a new route `src/app/watch/c/[catalogId]/page.tsx` — same idea, nested under `/watch/` for namespace cohesion.
   - **Option C:** Make `/watch/[id]` look up by EITHER `watches.id` OR `watches_catalog.id` (overload) — fragile, breaks the existing privacy gate semantics, NOT recommended.

   **Recommendation: Option A.** It's the smallest semantic surface that captures the user intent ("show me this catalog watch's fit verdict against my collection"). The route reads the catalog row, computes the verdict against the viewer's collection (via `getVerdictForCatalogWatch`-style Server Component compute), and renders. It does NOT need to expose owner identity (catalog rows aren't owned). It does need to detect "viewer already owns this catalog ref" (D-08 self-via-cross-user) by querying `watches WHERE userId=viewer AND catalogId=catalogId`.

   **Action required:** Discuss-phase or plan-checker locks the route shape (A vs B vs C) before D-10 implementation. Without this lock, the implementer is forced to invent.

5. **Watch image display in `<CollectionFitCard>`** — **RESOLVED.** Confirmed via `src/components/insights/SimilarityBadge.tsx` (read end-to-end): the current `<SimilarityBadge>` does NOT render the watch image — it renders only the `Collection Fit` headline + analysis bullets + most-similar list. `<CollectionFitCard>` should mirror this and NOT render the watch image. The parent surface (page or row) renders the image; the card is a verdict-text-only card. **Therefore `getCatalogPhotoSignedUrl` is NOT needed in this phase.** Phase 19.1's storage helper (`src/lib/storage/catalogSourcePhotos.ts:getCatalogSourcePhotoSignedUrl`) is irrelevant to Phase 20.

6. **Composer template library shape** — **RESOLVED.** Recommend `Array<{id, predicate, template}>` as in Example 1 above. Codebase precedent: `getSimilarityLabelDisplay()` uses a `Record<SimilarityLabel, {...}>` shape, which works for fixed-key lookups but doesn't generalize to predicate-driven phrasing. Predicate-array is the right shape for FIT-02; mirrors how rule-engines are typically organized. Iteration order is deterministic (insertion order); composer fires all matching templates in order, dedupes if needed. Planner curates the final 10-16 entries during plan-checker.

7. **Viewer aggregate taste profile fields** — **RESOLVED.** All 8 Phase 19.1 fields confirmed present on `CatalogEntry` per `src/lib/types.ts:134-145`:
   - `formality: number | null` (numeric 0..1)
   - `sportiness: number | null` (numeric 0..1)
   - `heritageScore: number | null` (numeric 0..1)
   - `primaryArchetype: PrimaryArchetype | null` (closed union)
   - `eraSignal: EraSignal | null` (closed union)
   - `designMotifs: string[]` (always array, possibly empty)
   - `confidence: number | null` (numeric 0..1)
   - `extractedFromPhoto: boolean` (always boolean, default false)

   Aggregate-taste pure function should expose: `meanFormality | null`, `meanSportiness | null`, `meanHeritageScore | null`, `dominantArchetype | null`, `dominantEraSignal | null`, `topDesignMotifs: string[]` (always array, possibly empty). `confidence` and `extractedFromPhoto` aren't aggregated — they're per-row gates (Pitfall 2 + Pitfall 4).

8. **Caller shim location** — **RESOLVED.** Co-locate at `src/lib/verdict/shims.ts` alongside the composer. Codebase precedent for cross-domain mappers:
   - `src/data/catalog.ts:51` `mapRowToCatalogEntry` (DB row → domain) — DAL-internal.
   - `src/data/watches.ts:17` `mapRowToWatch` (DB row → domain) — DAL-internal.
   - The verdict shim is **domain → domain** (`CatalogEntry → Watch-shape`), distinct from DAL row mapping. Place it in the verdict module that owns the conversion semantics. Do NOT add it to `src/lib/similarity.ts` (D-09 byte-lock includes file scope; don't even add new exports).

9. **Existing `/evaluate` references** — **RESOLVED.** Source-tree grep confirms only **TWO** code references:
   - `src/components/search/WatchSearchRow.tsx:43` — `const href = '/evaluate?catalogId=${result.catalogId}'` (and lines 13, 47, 87 also reference it within JSX)
   - `src/components/explore/DiscoveryWatchCard.tsx:14` — **comment-only** mention; no actual link
   - Plus one test file: `tests/components/search/WatchSearchRow.test.tsx` (likely asserts the href; needs updating during plan).

   Documentation references (`.planning/...`) are historical and don't need code changes. Sitemap/robots: no entries; nothing to remove.

10. **Validation Architecture** — see dedicated section below.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16 App Router | Server Action, Server Components | ✓ | 16.2.3 (lockfile) / 16.2.4 (registry) | — |
| `@base-ui/react/accordion` | FIT-04 inline-expand | ✓ | 1.3.0 (lockfile) / 1.4.1 (registry) | Hand-roll fallback documented but not recommended |
| `getCurrentUser()` from `@/lib/auth` | Server Action auth gate | ✓ | (existing) | — |
| Zod | Server Action input validation | ✓ | 4.3.6 | — |
| `getCatalogById` DAL | Server Action `getVerdictForCatalogWatch` | ✓ | existing in `src/data/catalog.ts:245` | — |
| `getWatchesByUser` DAL | Server Action + page-level compute | ✓ | existing in `src/data/watches.ts:89` | — |
| `getPreferencesByUser` DAL | Server Action + page-level compute | ✓ | existing in `src/data/preferences.ts:61` | — |
| `analyzeSimilarity` engine | Composer | ✓ | byte-locked (D-09) | — |
| Phase 19.1 `taste_*` columns on `watches_catalog` | Composer slot fills | ✓ (NULL-tolerated) | shipped | Composer falls through to 6-fixed-label phrasings when confidence < 0.5 |
| Vitest + RTL test harness | Composer/card tests | ✓ | (existing) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x via `vitest run` (project root); jsdom environment for component tests |
| Config file | `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` |
| Quick run command | `npm test -- src/lib/verdict tests/components/search/WatchSearchRow tests/components/insights/CollectionFitCard` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIT-01 | `<CollectionFitCard>` is a pure renderer (no engine import, no Server Action call) | unit (text-scan) | `npm test -- src/components/insights/CollectionFitCard` | ❌ Wave 0 |
| FIT-01 | `<CollectionFitCard>` renders `VerdictBundle` props correctly across `same-user`, `cross-user`, `self-via-cross-user` framings | unit (RTL) | `npm test -- src/components/insights/CollectionFitCard` | ❌ Wave 0 |
| FIT-01 | `<CollectionFitCard>` does NOT contain `analyzeSimilarity` import (statically) | unit (text-scan) | `npm test -- tests/static/CollectionFitCard.no-engine.test.ts` | ❌ Wave 0 |
| FIT-02 | Composer is deterministic: same `(result, profile, candidate)` → same bundle | unit | `npm test -- src/lib/verdict/composer` | ❌ Wave 0 |
| FIT-02 | Composer fires all four roadmap phrasings under their predicate-applicable inputs | unit | `npm test -- src/lib/verdict/composer` | ❌ Wave 0 |
| FIT-02 | Composer falls through to 6-fixed-label phrasings when `entry.confidence < 0.5` | unit | `npm test -- src/lib/verdict/composer` | ❌ Wave 0 |
| FIT-02 | Composer hedges phrasing when `0.5 <= entry.confidence < 0.7` | unit | `npm test -- src/lib/verdict/composer` | ❌ Wave 0 |
| FIT-02 | Viewer aggregate taste profile is null-tolerant (collection with all-NULL taste columns produces empty profile, no NaN) | unit | `npm test -- src/lib/verdict/viewerTasteProfile` | ❌ Wave 0 |
| FIT-02 | Caller shim `catalogEntryToSimilarityInput` round-trips: shim'd `Watch` produces same `SimilarityResult` as a real `Watch` with identical fields | unit | `npm test -- src/lib/verdict/shims` | ❌ Wave 0 |
| FIT-03 | Cross-user `/watch/[id]` page renders `<CollectionFitCard>` with `framing='cross-user'` when viewer.id !== watch.userId | integration (Server Component test) | `npm test -- tests/app/watch/[id]/page.test.ts` | ❌ Wave 0 |
| FIT-03 | When viewer's collection is empty (D-07), `<CollectionFitCard>` is NOT rendered on cross-user `/watch/[id]` | integration | `npm test -- tests/app/watch/[id]/page.test.ts` | ❌ Wave 0 |
| FIT-03 | When viewer reaches catalog watch they already own (D-08), card swaps to "You own this" body | unit (composer framing) | `npm test -- src/lib/verdict/composer` | ❌ Wave 0 |
| FIT-04 | `WatchSearchRow` no longer contains `/evaluate?catalogId=` href | unit (text-scan + DOM) | `npm test -- tests/components/search/WatchSearchRow` | ✓ exists, needs update |
| FIT-04 | Clicking a row's accordion trigger expands the verdict; opening another row collapses the previous (one-at-a-time per D-05) | unit (RTL) | `npm test -- tests/components/search/WatchSearchRowAccordion` | ❌ Wave 0 |
| FIT-04 | ESC key collapses an open accordion row | unit (RTL keyboard event) | `npm test -- tests/components/search/WatchSearchRowAccordion` | ❌ Wave 0 |
| FIT-04 | Tab key navigates between accordion triggers (keyboard accessible per D-05) | unit (RTL keyboard event) | `npm test -- tests/components/search/WatchSearchRowAccordion` | ❌ Wave 0 |
| FIT-04 | Re-expanding the same row does NOT re-fire `getVerdictForCatalogWatch` (in-memory cache hit per D-06) | unit (RTL + Server Action mock spy) | `npm test -- tests/components/search/WatchSearchRowAccordion` | ❌ Wave 0 |
| FIT-04 | Adding a watch via `useWatchStore.addWatch` invalidates the verdict cache (revision counter bump) | unit (RTL + store fixture) | `npm test -- tests/components/search/useWatchSearchVerdictCache` | ❌ Wave 0 |
| FIT-04 | `getVerdictForCatalogWatch` Server Action returns `{success:false, error:'Not authenticated'}` when no session | unit (mocked auth) | `npm test -- tests/app/actions/verdict.test` | ❌ Wave 0 |
| FIT-04 | `getVerdictForCatalogWatch` Server Action validates input via Zod (rejects non-UUID `catalogId`) | unit | `npm test -- tests/app/actions/verdict.test` | ❌ Wave 0 |
| Success Criterion 5 (CONTEXT.md) | The `/evaluate` route does not exist | smoke | `npm test -- tests/no-evaluate-route.test.ts` (file-system assertion: `src/app/evaluate/` does not exist) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/lib/verdict tests/components/search/WatchSearchRow tests/components/insights/CollectionFitCard`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/components/insights/CollectionFitCard.test.tsx` — RTL render tests for all three framings
- [ ] `tests/static/CollectionFitCard.no-engine.test.ts` — text-scan to enforce Pitfall 1 invariant (no `analyzeSimilarity` import in card)
- [ ] `src/lib/verdict/composer.test.ts` — composer determinism + 4 roadmap phrasings + confidence gating
- [ ] `src/lib/verdict/viewerTasteProfile.test.ts` — null-tolerance tests for mean/mode/topK
- [ ] `src/lib/verdict/shims.test.ts` — round-trip preservation
- [ ] `tests/app/actions/verdict.test.ts` — Server Action auth gate + Zod validation
- [ ] `tests/components/search/WatchSearchRowAccordion.test.tsx` — accordion expand/collapse + ESC + cache + keyboard nav
- [ ] `tests/components/search/useWatchSearchVerdictCache.test.tsx` — revision-keyed cache invalidation
- [ ] `tests/app/watch/[id]/page.test.ts` — Server Component test for cross-user verdict computation + D-07 hide-when-empty + D-08 self-via-cross-user
- [ ] `tests/no-evaluate-route.test.ts` — file-system assertion that `src/app/evaluate/` does not exist
- [ ] **Update existing** `tests/components/search/WatchSearchRow.test.tsx` to remove `/evaluate?catalogId=` href assertions and replace with accordion-trigger DOM expectations

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` gate on Server Action; throws `UnauthorizedError`; mirrors `searchPeopleAction` / `searchWatchesAction` precedent |
| V3 Session Management | yes (transitively) | Supabase SSR session via `createSupabaseServerClient` (already shipped); no new session logic in Phase 20 |
| V4 Access Control | yes | `getVerdictForCatalogWatch` MUST use `user.id` from `getCurrentUser()` for the viewer's collection lookup — never accept `viewerId` from input. Cross-user `/watch/[id]` already enforces privacy gate via `getWatchByIdForViewer`. |
| V5 Input Validation | yes | Zod `.strict()` schema on `getVerdictForCatalogWatch({catalogId: z.string().uuid()})` — rejects non-UUID input + mass-assignment |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns for Next.js 16 + Server Actions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Action accepts unvalidated input → SSRF/injection downstream | Tampering | Zod `.strict().max(...)` schema; UUID format on catalogId |
| Server Action leaks data across users via passed userId | Information Disclosure | NEVER accept viewerId from input. Use `getCurrentUser().id` only. |
| Cross-user `/watch/[id]` leaks private watches | Information Disclosure | EXISTING `getWatchByIdForViewer` privacy gate — already audited in v3.0; no new surface in Phase 20 |
| Verdict bundle leaks other users' watch IDs/details | Information Disclosure | `mostSimilar` array contains ONLY viewer's own watches (engine filters by collection passed in). Cross-user candidate is the *target*, never echoed back as "similar." Verify in test. |
| Server Action error message leaks DB internals | Information Disclosure | Generic error copy: "Couldn't compute verdict." (mirrors searchWatchesAction) |
| `/evaluate` dangling references could redirect to attacker-controlled paths | Tampering | Phase 20 removes the only two source-tree references; success criterion 5 enforces nonexistence; `tests/no-evaluate-route.test.ts` enforces at CI time |
| RSC payload exposes server-only fields | Information Disclosure | `VerdictBundle` is hand-typed; `mostSimilar` watches are already public to the viewer (their own collection); no leak |
| Accordion's controlled-mode races between trigger and Server Action | Tampering | The Server Action call inside `onValueChange` is async; client must guard against multiple simultaneous fires. Mitigation: track `loadingId` in state and ignore further fires until current resolves. |

## Sources

### Primary (HIGH confidence)
- **Codebase reads (verified end-to-end):**
  - `src/lib/similarity.ts` (entire file) — engine signature + 6-label table
  - `src/components/insights/SimilarityBadge.tsx` (entire file) — verdict-text-only confirms image not rendered
  - `src/components/watch/WatchDetail.tsx` (entire file) — `'use client'`, `useTransition`, `Dialog` imports confirm Client Component
  - `src/components/search/WatchSearchRow.tsx` (entire file) — confirmed `/evaluate?catalogId=` at line 43
  - `src/components/explore/DiscoveryWatchCard.tsx` (entire file) — non-clickable; `/evaluate` is comment-only at line 14
  - `src/lib/types.ts` (entire file) — confirmed Phase 19.1 fields on `CatalogEntry` lines 134-145
  - `src/app/watch/[id]/page.tsx` — confirmed route looks up by `watches.id`, supports cross-user via privacy gate
  - `src/app/u/[username]/[tab]/page.tsx` (entire file) — confirmed `/u/{username}/collection` is reached via tab routing
  - `src/components/profile/ProfileWatchCard.tsx` — confirmed link from collection grid is `/watch/${watch.id}` (per-user UUID)
  - `src/components/search/SearchPageClient.tsx`, `useSearchState.ts` — confirmed accordion-wrap-friendly client architecture
  - `src/data/catalog.ts:245` `getCatalogById`, `:285` `searchCatalogWatches` — DAL inventory
  - `src/data/watches.ts:89,119` — DAL inventory
  - `src/data/preferences.ts:61` — DAL inventory
  - `src/lib/auth.ts` — `getCurrentUser` shape
  - `src/app/actions/search.ts:81-107` — Server Action precedent
  - `tests/setup.ts`, `vitest.config.ts` — confirmed test framework
- **Filesystem reads (verified):**
  - `node_modules/@base-ui/react/accordion/index.parts.d.ts` + `root/AccordionRoot.d.ts` — Accordion API confirmed (multiple, value, onValueChange, etc.)
  - `node_modules/@base-ui/react/collapsible/` — Collapsible API confirmed (singular per-element)
- **Registry verifications:**
  - `npm view next version` → `16.2.4` (matches CLAUDE.md Next.js 16 stack)
  - `npm view @base-ui/react version` → `1.4.1`

### Secondary (MEDIUM confidence)
- **CONTEXT files (Phase 19, 19.1, 20):** locked decisions cited verbatim
- **`tests/components/search/WatchSearchRow.test.tsx`:** existence confirmed via grep; contents not fully read — assumed to assert `/evaluate?catalogId=` href

### Tertiary (LOW confidence)
- None — all critical claims verified via codebase reads or registry lookups.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency verified in lockfile + filesystem; Accordion API directly inspected.
- Architecture: HIGH for Patterns 1, 2, 3, 4 — each has a Phase 17/18/19 precedent. MEDIUM for Pattern 4's WatchDetail surgery (recommended approach is locked but the precise prop wiring needs the planner to commit).
- Pitfalls: HIGH — each pitfall identified is grounded in a specific code location or lock-decision. Pitfall 5 (D-10 routing ambiguity) is HIGH-confidence flag; the *resolution* requires user/planner input.
- Validation: HIGH — Vitest infrastructure verified; test files largely absent (Wave 0).
- Security: HIGH — every threat pattern has a documented mitigation already in use elsewhere.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — stack is mature; Phase 19.1 just shipped; minimal drift expected)

---

*Phase: 20-collection-fit-surface-polish-verdict-copy*
*Research generated by gsd-researcher agent*
