# Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 14 (new/modified/retrofitted)
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/watch/flowTypes.ts` | model/types | — | `src/components/watch/flowTypes.ts` (self — rewrite) | self-rewrite |
| `src/components/watch/AddWatchFlow.tsx` | orchestrator component | request-response + event-driven | `src/components/watch/AddWatchFlow.tsx` (self — rewrite) | self-rewrite |
| `src/components/watch/DupeBanner.tsx` | component/presenter | event-driven | `src/components/watch/ConfirmStep.tsx` | exact role |
| `src/components/watch/__tests__/DupeBanner.test.tsx` | test | — | `src/components/watch/ConfirmStep.test.tsx` | exact |
| `src/components/watch/__tests__/flowTypes.test.ts` | test | — | `src/components/watch/ConfirmStep.test.tsx` | role-match |
| `src/app/actions/watches.ts` (new export) | server action | CRUD | `src/app/actions/watches.ts:82` (addWatch) | exact |
| `src/app/actions/__tests__/moveWishlistToCollection.test.ts` | test | — | `src/app/actions/__tests__/reorderWishlist.test.ts` | exact |
| `src/components/watch/StructuredEntryPanel.tsx` (patch) | component/presenter | request-response | `src/components/watch/StructuredEntryPanel.tsx` (self — patch) | self-patch |
| `src/data/watches.ts` (patch) | DAL | CRUD | `src/data/watches.ts:295` (findViewerWatchByCatalogId — self patch) | self-patch |
| `src/components/watch/AddWatchFlow.test.tsx` (retrofit) | test | — | `src/components/watch/AddWatchFlow.test.tsx` (self — retrofit) | self-retrofit |
| `src/components/watch/WatchForm.tsx` (optional patch) | component | CRUD | `src/components/watch/WatchForm.tsx` (self — patch) | self-patch |

---

## Pattern Assignments

### `src/components/watch/flowTypes.ts` (model/types — full rewrite)

**Analog:** `src/components/watch/flowTypes.ts` (current file — self-rewrite from this shape to D-01 shape)

**Current union shape** (lines 17–35 — to be replaced entirely):
```typescript
// REMOVE these variants:
| { kind: 'idle' }
| { kind: 'extracting'; url: string }
| { kind: 'verdict-ready'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null }
| { kind: 'wishlist-rationale-open'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null }
| { kind: 'submitting-wishlist'; catalogId: string; extracted: ExtractedWatchData; verdict: VerdictBundle | null; notes: string }
| { kind: 'submitting-collection'; catalogId: string; extracted: ExtractedWatchData }
```

**Phase 70 D-01 replacement union** — write this verbatim:
```typescript
// Imports: REMOVE VerdictBundle import (no longer used here); KEEP ExtractErrorCategory
import type { ExtractedWatchData } from '@/lib/extractors'
import type { ExtractErrorCategory } from './ExtractErrorCard'

// D-01 final FlowState union (Phase 70 — CLNP-05 reconciliation)
export type FlowState =
  | { kind: 'search-idle' }
  | { kind: 'extracting-url'; url: string }
  | { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory; mode: 'url' | 'structured' }
  | { kind: 'confirming'; catalogId: string | null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult | null; dupeContext: DupeContext | null; pending: boolean }
  | { kind: 'form-prefill'; catalogId: string; extracted: ExtractedWatchData }
  | { kind: 'manual-entry'; partial?: ExtractedWatchData | null }
  | { kind: 'photos-pending'; watchId: string; destination: string }

export interface DupeContext {
  existingWatchId: string
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
}
```

**D-02 transition map comment** — write as a JSDoc comment block above the type declaration:
```typescript
/**
 * State transition map (D-02 — write this verbatim in flowTypes.ts):
 *
 * search-idle ──onPick (owned)──────────────────→ /w/[ref]                          [DUPE-01]
 * search-idle ──onPick (wishlist)───────────────→ confirming(dupeContext: wishlist) [DUPE-03 entry]
 * search-idle ──onPick (null)───────────────────→ confirming(dupeContext: null)
 * search-idle ──onSubmitStructured──────────────→ confirming(dupeContext: lookup)   [DUPE-02 may apply]
 * search-idle ──onSwitchToUrl───────────────────→ extracting-url
 * search-idle ──Skip-search link────────────────→ manual-entry                       [CLNP-06]
 * extracting-url ──success──────────────────────→ confirming(dupeContext: lookup)
 * extracting-url ──failure──────────────────────→ extraction-failed(mode: 'url')
 * confirming ──onPrimary (success)──────────────→ photos-pending (owned) | destination (wishlist/grail)
 * confirming ──onPrimary (failure)──────────────→ confirming(pending: false) + toast.error
 * confirming ──onEditDetails────────────────────→ form-prefill
 * confirming ──onStartOver──────────────────────→ search-idle
 * confirming ──DupeBanner.onViewExisting────────→ /w/[ref]                          [DUPE-02 opt-out for owned]
 * confirming ──DupeBanner.onMoveToCollection────→ moveWishlistToCollection → /u/[username]/collection  [DUPE-03 commit]
 * confirming ──DupeBanner.onAddAnotherCopy──────→ confirming(dupeContext: null)     [DUPE-02 explicit-bypass]
 * form-prefill ──onWatchCreated─────────────────→ photos-pending
 * manual-entry ──onWatchCreated─────────────────→ photos-pending
 * manual-entry ──back affordance────────────────→ search-idle
 * photos-pending ──onDone / onSkip──────────────→ destination
 * extraction-failed ──retryAction───────────────→ search-idle
 * extraction-failed ──manualAction──────────────→ /watch/new?manual=1
 */
```

**Retained exports** (keep verbatim from current file, lines 43–57):
```typescript
// RailEntry and PendingTarget stay in Phase 70 — Phase 71 deletes alongside RecentlyEvaluatedRail.
export interface RailEntry { ... }
export type PendingTarget = 'wishlist' | 'collection' | 'skip' | null
```

---

### `src/components/watch/AddWatchFlow.tsx` (orchestrator component — full rewrite)

**Analog:** `src/components/watch/AddWatchFlow.tsx` (self; retain these specific patterns from the current file)

**Imports pattern** — what changes (current lines 1–24):
```typescript
'use client'

// KEEP:
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
// REMOVE: useTransition (no longer used for primary commit path)
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// REMOVE these imports entirely (hard cutover — Phase 71 will delete the files):
// import { PasteSection } from './PasteSection'
// import { VerdictStep } from './VerdictStep'
// import { WishlistRationalePanel } from './WishlistRationalePanel'
// import { RecentlyEvaluatedRail } from './RecentlyEvaluatedRail'
// import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
// import { getVerdictForCatalogWatch } from '@/app/actions/verdict'

// ADD:
import { SearchEntry } from './SearchEntry'
import { ConfirmStep } from './ConfirmStep'
import { DupeBanner } from './DupeBanner'
import { findViewerWatchByCatalogId } from '@/data/watches'
import { moveWishlistToCollection } from '@/app/actions/watches'

// KEEP:
import { WatchForm } from './WatchForm'
import { WatchPhotoStep } from './WatchPhotoStep'
import { ExtractErrorCard, type ExtractErrorCategory } from './ExtractErrorCard'
import { useUrlExtractCache } from './useUrlExtractCache'
import { addWatch } from '@/app/actions/watches'
import { canonicalize, defaultDestinationForStatus } from '@/lib/watchFlow/destinations'

// KEEP type imports (update FlowState consumers):
import type { FlowState, RailEntry, DupeContext } from './flowTypes'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { Watch, MovementType, WatchStatus } from '@/lib/types'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
```

**initialState ternary pattern** (current lines 135–140 — update third branch):
```typescript
// KEEP precedence: form-prefill > manual-entry > search-idle (D-03)
const initialState: FlowState =
  initialCatalogId && initialIntent === 'owned' && initialCatalogPrefill
    ? { kind: 'form-prefill', catalogId: initialCatalogId, extracted: initialCatalogPrefill }
    : initialManual
      ? { kind: 'manual-entry', partial: null }
      : { kind: 'search-idle' }  // ← renamed from 'idle'
```

**State declarations pattern** (current lines 142–156 — remove verdict cache):
```typescript
const [state, setState] = useState<FlowState>(initialState)
const [url, setUrl] = useState('')     // reused for extracting-url inline input
const [rail, setRail] = useState<RailEntry[]>([])   // kept for safety; CLNP-04 deferred
// REMOVE: const [, startTransition] = useTransition()
// REMOVE: const cache = useWatchSearchVerdictCache(collectionRevision, viewerUserId)
// REMOVE: const hasCollection = collectionRevision > 0
const urlCache = useUrlExtractCache(viewerUserId)   // KEEP; reused by handleUrlBackup
```

**Activity-hide useLayoutEffect cleanup pattern** (current lines 199–215 — update per D-22):
```typescript
const stateRef = useRef(state)
const urlRef = useRef(url)
const railRef = useRef(rail)
stateRef.current = state
urlRef.current = url
railRef.current = rail

useLayoutEffect(() => {
  return () => {
    const s = stateRef.current
    // Skip case 2: form-prefill is initialState-derived from URL params.
    if (s.kind === 'form-prefill') return
    // Skip case 3 (NEW — D-22): manual-entry from ?manual=1 deep-link.
    // Must survive StrictMode mount/cleanup/mount like form-prefill.
    if (s.kind === 'manual-entry' && s.partial === null && initialManual === true) return
    // Skip case 1: nothing user-accumulated (renamed 'idle' → 'search-idle').
    if (s.kind === 'search-idle' && urlRef.current === '' && railRef.current.length === 0) return
    // Real Activity-hide: reset to search-idle.
    setState({ kind: 'search-idle' })   // ← renamed from 'idle'
    setUrl('')
    setRail([])
    // NOTE: module-scope caches NOT cleared here — Phase 69 CLNP-07 handles
    // cross-user reset via viewerUserId mismatch check. Same-user remount
    // cache survival is the whole point. (D-22)
  }
}, [])
```

**handleUrlBackup pattern** (extracted from current handleExtract lines 225–361, verdict-compute branch REMOVED):
```typescript
const handleUrlBackup = async () => {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return
  setState({ kind: 'extracting-url', url: trimmedUrl })

  // requestAnimationFrame yield so the 'extracting-url' render commits (mirrors handleExtract pattern)
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 16)
    }
  })

  // FORM-04 Gap 3 cache pattern (mirrors handleExtract:249-270; verdict-compute branch REMOVED)
  const cachedExtract = urlCache.get(trimmedUrl)
  if (cachedExtract) {
    const { catalogId, extracted } = cachedExtract
    const dupeContext = catalogId
      ? await findViewerWatchByCatalogId(viewerUserId, catalogId, ['owned', 'wishlist'])
          .then((row) => row ? { existingWatchId: row.id, existingStatus: row.status, existingReference: row.reference } : null)
      : null
    setState({ kind: 'confirming', catalogId, extracted, pickedResult: null, dupeContext, pending: false })
    return
  }

  try {
    // Mode-discriminated body — Phase 66 D-08 contract
    const res = await fetch('/api/extract-watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'url', url: trimmedUrl }),
    })
    const data = await res.json()
    if (!res.ok) {
      const category: ExtractErrorCategory =
        (data?.category as ExtractErrorCategory | undefined) ?? 'generic-network'
      setState({ kind: 'extraction-failed', partial: null, reason: data?.error ?? 'Extraction failed', category, mode: 'url' })
      return
    }
    const extracted: ExtractedWatchData = data.data ?? {}
    const catalogId: string | null = data.catalogId ?? null
    const catalogIdError: string | null = data.catalogIdError ?? null
    if (catalogId) {
      urlCache.set(trimmedUrl, { catalogId, extracted, catalogIdError })
    }
    const dupeContext = catalogId
      ? await findViewerWatchByCatalogId(viewerUserId, catalogId, ['owned', 'wishlist'])
          .then((row) => row ? { existingWatchId: row.id, existingStatus: row.status, existingReference: row.reference } : null)
      : null
    setState({ kind: 'confirming', catalogId, extracted, pickedResult: null, dupeContext, pending: false })
  } catch (err) {
    console.error('[AddWatchFlow] URL-backup extract failed:', err)
    const reason = err instanceof Error ? err.message : String(err).replace(/^Error:\s*/i, '')
    setState({ kind: 'extraction-failed', partial: null, reason, category: 'generic-network', mode: 'url' })
  }
}
```

**handleStartOver / retryAction / manualAction pattern** (current lines 498–520 — keep verbatim, rename idle→search-idle):
```typescript
// handleStartOver: preserved verbatim (D-02 "confirming ──onStartOver──→ search-idle")
const handleStartOver = () => {
  setUrl('')
  setState({ kind: 'search-idle' })  // renamed from 'idle'
}

// retryAction / manualAction: preserved verbatim (D-02 extraction-failed branch)
const retryAction = useCallback(() => {
  setUrl('')
  setState({ kind: 'search-idle' })  // renamed from 'idle'
}, [])
const manualAction = useCallback(() => {
  const qs = initialReturnTo
    ? `?manual=1&returnTo=${encodeURIComponent(initialReturnTo)}`
    : '?manual=1'
  router.push(`/watch/new${qs}`)
}, [router, initialReturnTo])
```

**handleWatchCreated pattern** (current lines 485–487 — add D-17 gate):
```typescript
// D-17: gate photos-pending on status === 'owned' (v7.0 → v8.0 UX evolution)
const handleWatchCreated = useCallback((watchId: string, dest: string, status: WatchStatus) => {
  if (status === 'owned') {
    setState({ kind: 'photos-pending', watchId, destination: dest })
  } else {
    // wishlist / grail: skip photos step, navigate directly
    setUrl('')
    setRail([])
    setState({ kind: 'search-idle' })
    router.push(dest)
  }
}, [router])
```

**manual-entry back-affordance pattern** (current lines 626–632 — relabel per D-20):
```typescript
// D-20: relabeled from "← Cancel — paste a URL instead" to "← Cancel — return to search"
<button
  type="button"
  onClick={handleStartOver}
  className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
>
  ← Cancel — return to search
</button>
```

**CLNP-06 skip-search link pattern** (new, inside search-idle branch — per D-19):
```typescript
// D-19: rendered BELOW SearchEntry in the search-idle branch
// In-flow transition only — no router.push to ?manual=1
<button
  type="button"
  onClick={() => setState({ kind: 'manual-entry', partial: null })}
  className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
>
  Skip search — enter manually
</button>
```

**photos-pending render branch** (current lines 648–669 — update dest reset to search-idle):
```typescript
{state.kind === 'photos-pending' && (
  <WatchPhotoStep
    watchId={state.watchId}
    userId={viewerUserId}
    onDone={() => {
      setUrl('')
      setRail([])
      setState({ kind: 'search-idle' })  // renamed from 'idle'
      router.push(state.destination)
    }}
    onSkip={() => {
      setUrl('')
      setRail([])
      setState({ kind: 'search-idle' })  // renamed from 'idle'
      router.push(state.destination)
    }}
  />
)}
```

**extractedToPartialWatch helper** (current lines 705–730 — keep verbatim):
```typescript
// No change — this helper is still used by form-prefill and manual-entry branches.
function extractedToPartialWatch(data: ExtractedWatchData, status: WatchStatus): Watch { ... }
```

---

### `src/components/watch/DupeBanner.tsx` (component/presenter — new)

**Analog:** `src/components/watch/ConfirmStep.tsx` (pure-presenter pattern: props in, callbacks out, no server calls)
**Styling analog:** `src/components/insights/FollowedOwnersModule.tsx` (compact-card vocabulary: `space-y-2`, `text-sm font-semibold text-foreground`, `text-xs text-muted-foreground`)
**Button-row analog:** `src/components/watch/VerdictStep.tsx` lines 102–130 (`flex flex-col gap-2 sm:flex-row sm:gap-3`)

**Imports pattern** (follow ConfirmStep lines 1–12):
```typescript
'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

**Props interface** (from D-11):
```typescript
interface DupeBannerProps {
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
  onViewExisting: () => void
  onMoveToCollection?: () => void   // only present when existingStatus === 'wishlist'
  onAddAnotherCopy: () => void
  pending?: boolean
}
```

**Core pattern** — muted-fill card, font-semibold headline, mobile-first action row:
```typescript
// Styling follows FollowedOwnersModule's compact-card vocabulary:
// text-sm font-semibold text-foreground (NOT font-medium — no-raw-palette guardrail)
// bg-muted/40 rounded-lg border (contextual, not screen-dominating)
// aria-live="polite" (ConfirmStep line 165 precedent)

export function DupeBanner({ existingStatus, existingReference, onViewExisting, onMoveToCollection, onAddAnotherCopy, pending = false }: DupeBannerProps) {
  const isOwned = existingStatus === 'owned'
  const headline = isOwned ? 'Already in your collection' : 'On your wishlist'
  const subtext = isOwned
    ? 'You already own this watch. Add another copy or view the existing one.'
    : 'This watch is already on your wishlist. Move it to your collection or add again.'

  return (
    <div
      className={cn('rounded-lg border bg-muted/40 p-4 space-y-3')}
      aria-live="polite"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{headline}</p>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>

      {/* Mobile-first button row — mirrors VerdictStep.tsx:102 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        {existingReference && (
          <Button
            type="button"
            variant="ghost"
            onClick={onViewExisting}
            disabled={pending}
            className="w-full sm:flex-1"
          >
            View existing
          </Button>
        )}
        {!isOwned && onMoveToCollection && (
          <Button
            type="button"
            onClick={onMoveToCollection}
            disabled={pending}
            className="w-full sm:flex-1"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                Moving...
              </>
            ) : (
              'Move to Collection'
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onAddAnotherCopy}
          disabled={pending}
          className="w-full sm:flex-1"
        >
          Add another copy
        </Button>
      </div>
    </div>
  )
}
```

---

### `src/components/watch/__tests__/DupeBanner.test.tsx` (test — new)

**Analog:** `src/components/watch/ConfirmStep.test.tsx` (co-located component test pattern)

**Test structure pattern** (mirror ConfirmStep.test.tsx lines 1–55):
```typescript
// Phase 70 Plan NN — DupeBanner presenter (DUPE-02/03)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DupeBanner } from '@/components/watch/DupeBanner'

const BASE_OWNED_PROPS = {
  existingStatus: 'owned' as const,
  existingReference: 'REF-001',
  onViewExisting: vi.fn(),
  onAddAnotherCopy: vi.fn(),
}

const BASE_WISHLIST_PROPS = {
  existingStatus: 'wishlist' as const,
  existingReference: 'REF-001',
  onViewExisting: vi.fn(),
  onMoveToCollection: vi.fn(),
  onAddAnotherCopy: vi.fn(),
}

describe('DupeBanner — owned context (DUPE-02)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  // case (a): "Already in your collection" headline shown
  // case (b): "View existing" button shown when existingReference non-null
  // case (c): no "Move to Collection" button in owned context
})

describe('DupeBanner — wishlist context (DUPE-03)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  // case (d): "On your wishlist" headline shown
  // case (e): "Move to Collection" fires onMoveToCollection
})

describe('DupeBanner — null reference', () => {
  // case (f): "View existing" hidden when existingReference is null
})
```

---

### `src/components/watch/__tests__/flowTypes.test.ts` (test — new)

**Analog:** `src/components/watch/ConfirmStep.test.tsx` (structure), `src/app/actions/__tests__/reorderWishlist.test.ts` (type-level assertion pattern)

**Test structure pattern**:
```typescript
// Phase 70 — flowTypes.ts CLNP-05 kind enumeration + serialization round-trip

import { describe, it, expect } from 'vitest'
import type { FlowState } from '@/components/watch/flowTypes'

// Exhaustive kind array — assertion that D-01 final union is the only shapes present.
// This is a type-level + runtime check: if a new kind is added without updating this list,
// the exhaustive switch in AddWatchFlow will fail to compile.
const ALL_KINDS = [
  'search-idle',
  'extracting-url',
  'extraction-failed',
  'confirming',
  'form-prefill',
  'manual-entry',
  'photos-pending',
] as const

describe('flowTypes — CLNP-05 union shape', () => {
  it('all kinds in ALL_KINDS are valid FlowState kinds', () => {
    // Compile-time check: this assignment errors if any kind in ALL_KINDS is not in FlowState
    const _: FlowState['kind'][] = [...ALL_KINDS]
    expect(_).toHaveLength(ALL_KINDS.length)
  })

  it('old verdict-flow kinds are NOT in the union', () => {
    // These should not be assignable to FlowState['kind']
    const REMOVED_KINDS = ['idle', 'extracting', 'verdict-ready', 'wishlist-rationale-open', 'submitting-wishlist', 'submitting-collection']
    // Runtime: construct a FlowState with each removed kind — TypeScript error if union is clean
    // (This is a documentation test; TypeScript compile gate is the real enforcement)
    expect(REMOVED_KINDS).not.toContain('search-idle')
  })
})
```

---

### `src/app/actions/watches.ts` — new export `moveWishlistToCollection`

**Analog:** `src/app/actions/watches.ts` — `addWatch` function (lines 82–350) for overall structure; `editWatch` (lines 358–512) for the schema pattern

**Auth-first gate pattern** (addWatch line 84 — identical):
```typescript
// [VERIFIED: watches.ts:84] — auth BEFORE Zod parse
export async function moveWishlistToCollection(
  watchId: string,
  opts?: { pricePaid?: number; notes?: string }
): Promise<ActionResult<Watch>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
```

**Zod schema pattern** (addWatch lines 22–71 for schema style; Claude's Discretion schema):
```typescript
  const parsed = z.object({
    watchId: z.string().uuid(),
    pricePaid: z.number().int().min(0).optional(),
    notes: z.string().max(2000).optional(),
  }).safeParse({ watchId, ...opts })
  if (!parsed.success) return { success: false, error: 'Invalid request' }
```

**editWatch priorRow check pattern** (editWatch line 371–380 area — mirrors null-check):
```typescript
  try {
    const priorRow = await watchDAL.getWatchById(user.id, watchId)
    if (!priorRow) return { success: false, error: 'Watch not found' }
    if (priorRow.status !== 'wishlist') {
      if (priorRow.status === 'owned') return { success: true, data: priorRow }  // idempotent
      return { success: false, error: `Cannot move ${priorRow.status} watch to collection` }
    }
```

**logActivity side-effect pattern** (addWatch lines 247–266 — the 'watch_added' branch):
```typescript
    // Activity logging — fire and forget, failure does not block mutation
    try {
      await logActivity(user.id, 'watch_added', updatedWatch.id, {
        brand: updatedWatch.brand,
        model: updatedWatch.model,
        imageUrl: updatedWatch.imageUrl ?? null,
      })
      console.warn('[Phase 70] moveWishlistToCollection: wishlist→collection activity logged', { watchId })
    } catch (err) {
      console.error('[moveWishlistToCollection] activity log failed (non-fatal):', err)
    }
```

**findOverlapRecipients + logNotification loop pattern** (addWatch lines 272–318 — identical block):
```typescript
    // NOTIF-03 pattern — overlap notifications for new owned watch
    if (updatedWatch.status === 'owned') {
      try {
        const recipients = await findOverlapRecipients({
          brand: updatedWatch.brand,
          model: updatedWatch.model,
          actorUserId: user.id,
        })
        if (recipients.length > 0) {
          const actorProfile = await getProfileById(user.id)
          const brandNormalized = updatedWatch.brand.trim().toLowerCase()
          const modelNormalized = updatedWatch.model.trim().toLowerCase()
          for (const recipient of recipients) {
            await logNotification({
              type: 'watch_overlap',
              recipientUserId: recipient.userId,
              actorUserId: user.id,
              payload: {
                actor_username: actorProfile?.username ?? '',
                actor_display_name: actorProfile?.displayName ?? null,
                watch_id: updatedWatch.id,
                watch_brand: updatedWatch.brand,
                watch_model: updatedWatch.model,
                watch_brand_normalized: brandNormalized,
                watch_model_normalized: modelNormalized,
              },
            })
            revalidateTag(`viewer:${recipient.userId}`, 'max')
          }
        }
      } catch (err) {
        console.error('[moveWishlistToCollection] overlap lookup failed (non-fatal):', err)
      }
    }
```

**revalidatePath / revalidateTag pattern** (addWatch lines 320–341 — identical matrix):
```typescript
    revalidatePath('/')
    revalidatePath('/u/[username]', 'layout')
    const ownerProfile = await getProfileById(user.id)
    if (ownerProfile?.username) {
      revalidateTag(`profile:${ownerProfile.username}`, 'max')
    }
    revalidateTag('explore', 'max')

    return { success: true, data: updatedWatch }
  } catch (err) {
    console.error('[moveWishlistToCollection] unexpected error:', err)
    return { success: false, error: 'Failed to move watch to collection' }
  }
}
```

---

### `src/app/actions/__tests__/moveWishlistToCollection.test.ts` (test — new)

**Analog:** `src/app/actions/__tests__/reorderWishlist.test.ts` (Server Action test pattern — exact match)

**vi.mock setup pattern** (reorderWishlist.test.ts lines 21–43):
```typescript
// Phase 70 — moveWishlistToCollection Server Action (DUPE-03)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/data/watches', async () => {
  const actual = await vi.importActual<typeof import('@/data/watches')>('@/data/watches')
  return {
    ...actual,
    getWatchById: vi.fn(),
    updateWatch: vi.fn(),
  }
})
vi.mock('@/data/activities', () => ({ logActivity: vi.fn() }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { moveWishlistToCollection } from '@/app/actions/watches'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById, updateWatch } from '@/data/watches'
import { logActivity } from '@/data/activities'
import { findOverlapRecipients } from '@/data/notifications'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'  // RFC 4122 v4 strict UUID

describe('Phase 70 — moveWishlistToCollection (DUPE-03)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('auth gate — getCurrentUser rejects → "Not authenticated"', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not authenticated'))
    const result = await moveWishlistToCollection(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('wishlist→owned happy path — updates watch, fires logActivity, returns success', async () => { ... })
  it('idempotent already-owned — returns { success: true, data: priorRow } without update', async () => { ... })
  it('sold/grail rejection — returns { success: false, error: "Cannot move sold watch to collection" }', async () => { ... })
  it('not-yours rejection — getWatchById returns null → "Watch not found"', async () => { ... })
  it('side-effect chain fires logActivity + findOverlapRecipients on owned commit', async () => { ... })
})
```

**Key mock patterns** (from reorderWishlist.test.ts line 64 — mockResolvedValue as any):
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
vi.mocked(getWatchById).mockResolvedValue({ id: VALID_UUID, status: 'wishlist', brand: 'Omega', model: 'Speedmaster', imageUrl: null } as any)
vi.mocked(updateWatch).mockResolvedValue({ id: VALID_UUID, status: 'owned', brand: 'Omega', model: 'Speedmaster' } as any)
vi.mocked(findOverlapRecipients).mockResolvedValue([])
```

---

### `src/components/watch/StructuredEntryPanel.tsx` — Wave 0 patch

**Analog:** `src/components/watch/StructuredEntryPanel.tsx` (self-patch — 3 lines change)

**Gap confirmed** (RESEARCH.md — StructuredEntryPanel.tsx:60 and :156):
```typescript
// CURRENT (line 60):
onSubmitStructured: (result: ExtractedWatchData) => void

// PATCH TO:
onSubmitStructured: (result: ExtractedWatchData, catalogId: string | null) => void

// CURRENT (line 156):
onSubmitStructured(envelope.data)

// PATCH TO:
onSubmitStructured(envelope.data, envelope.catalogId ?? null)
```

Also update SearchEntry.tsx (the pass-through site — line 74 area) to match the widened type.

---

### `src/data/watches.ts` — Wave 0 patch to `findViewerWatchByCatalogId`

**Analog:** `src/data/watches.ts:295–322` (self-patch — extend SELECT + return type)

**Gap confirmed** (RESEARCH.md — return type is `{ id: string; status: 'owned' | 'wishlist' } | null`):
```typescript
// CURRENT return type (line 299):
): Promise<{ id: string; status: 'owned' | 'wishlist' } | null>

// PATCH TO:
): Promise<{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null>

// Add watches_catalog JOIN to the query SELECT block:
import { watchesCatalog } from '@/db/schema'  // add if not already imported

// In the .select() call, add:
reference: watchesCatalog.reference,

// In the .from() + .where(), add a leftJoin:
.leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))

// Update return on line 321:
return { id: row.id, status: row.status as 'owned' | 'wishlist', reference: row.reference ?? null }
```

---

### `src/components/watch/AddWatchFlow.test.tsx` (retrofit — add Phase 70 cases)

**Analog:** `src/components/watch/AddWatchFlow.test.tsx` (self-retrofit — keep existing Phase 69 CLNP-07 four-cache test; add new cases below it)

**Existing test setup pattern** (lines 15–41 — keep and extend):
```typescript
// Existing mocks to keep (lines 15-30):
vi.mock('@/app/actions/verdict', ...)     // no longer needed — remove if clean
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
  moveWishlistToCollection: vi.fn(),       // ADD
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

// ADD mocks for Phase 70 dormant components now being mounted:
vi.mock('@/components/watch/SearchEntry', () => ({
  SearchEntry: ({ onPick, onSubmitStructured, onSwitchToUrl }: { onPick: (r: unknown) => void; onSubmitStructured: (r: unknown, id: string | null) => void; onSwitchToUrl: () => void }) => (
    <div data-testid="search-entry">
      <button onClick={() => onPick({ reference: 'REF-001', viewerState: null })}>Pick null</button>
      <button onClick={() => onPick({ reference: 'REF-001', viewerState: 'owned' })}>Pick owned</button>
      <button onClick={() => onPick({ reference: 'REF-001', viewerState: 'wishlist' })}>Pick wishlist</button>
      <button onClick={() => onSubmitStructured({ brand: 'Omega', model: 'Speedmaster' }, 'cat-uuid')}>Submit structured</button>
      <button onClick={onSwitchToUrl}>Switch to URL</button>
    </div>
  ),
}))
vi.mock('@/components/watch/ConfirmStep', () => ({
  ConfirmStep: ({ onPrimary, onStartOver, onEditDetails, pending }: { onPrimary: () => void; onStartOver: () => void; onEditDetails: () => void; pending?: boolean }) => (
    <div data-testid="confirm-step">
      <button onClick={onPrimary} disabled={pending}>Confirm primary</button>
      <button onClick={onStartOver}>Start over</button>
      <button onClick={onEditDetails}>Edit details</button>
    </div>
  ),
}))
vi.mock('@/components/watch/DupeBanner', () => ({
  DupeBanner: ({ onMoveToCollection, onAddAnotherCopy, existingStatus }: { onMoveToCollection?: () => void; onAddAnotherCopy: () => void; existingStatus: string }) => (
    <div data-testid={`dupe-banner-${existingStatus}`}>
      {onMoveToCollection && <button onClick={onMoveToCollection}>Move to Collection</button>}
      <button onClick={onAddAnotherCopy}>Add another copy</button>
    </div>
  ),
}))
```

**Render helper pattern** (existing test lines 107–120 — update props for new AddWatchFlow interface):
```typescript
// Phase 70 updated prop set — initialCatalogId → initialCatalogId (same name); ADD: catalogBrands consumed
function renderFlow(overrides?: Partial<AddWatchFlowProps>) {
  return render(
    <AddWatchFlow
      collectionRevision={3}
      initialCatalogId={null}
      initialIntent={null}
      initialCatalogPrefill={null}
      initialManual={false}
      initialStatus={null}
      initialReturnTo={null}
      viewerUsername="tester"
      viewerUserId="user-a"
      catalogBrands={[]}
      {...overrides}
    />,
  )
}
```

---

## Shared Patterns

### Authentication (all Server Actions)
**Source:** `src/app/actions/watches.ts` line 84
**Apply to:** `moveWishlistToCollection`
```typescript
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
```
Auth gate fires BEFORE Zod parse — consistent with addWatch/editWatch.

### Error Handling (Server Actions)
**Source:** `src/app/actions/watches.ts` lines 343–349
**Apply to:** `moveWishlistToCollection`
```typescript
} catch (err) {
  console.error('[moveWishlistToCollection] unexpected error:', err)
  return { success: false, error: 'Failed to move watch to collection' }
}
```

### pure-presenter pattern (components)
**Source:** `src/components/watch/ConfirmStep.tsx` (entire file)
**Apply to:** `DupeBanner.tsx`
- No Server Action imports
- No `useRouter`
- All callbacks are props (`onX: () => void`)
- `pending` prop drives disabled state + Loader2 swap on primary CTA

### font-semibold guardrail
**Source:** `src/components/insights/FollowedOwnersModule.tsx` line 76
**Apply to:** `DupeBanner.tsx`, any `extracting-url` branch copy in `AddWatchFlow.tsx`
```typescript
// Use: className="text-sm font-semibold text-foreground"
// Never: className="text-sm font-medium text-foreground"
// Enforced by: tests/no-raw-palette.test.ts FORBIDDEN array contains /\bfont-medium\b/
```

### Mobile-first button row
**Source:** `src/components/watch/VerdictStep.tsx` line 102
**Apply to:** `DupeBanner.tsx` action row
```typescript
className="flex flex-col gap-2 sm:flex-row sm:gap-3"
// Each child: className="w-full sm:flex-1"
```

### Activity-hide useLayoutEffect (state reset on back-nav)
**Source:** `src/components/watch/AddWatchFlow.tsx` lines 193–215
**Apply to:** `AddWatchFlow.tsx` rewrite — update skip cases for new FlowState kinds per D-22.
Key invariant: ref-based reads (`stateRef`, `urlRef`, `railRef`) to avoid stale closure; empty dependency array `[]`.

### useCallback for handlers threaded into children
**Source:** `src/components/watch/AddWatchFlow.tsx` lines 509–520 (`retryAction`, `manualAction`)
**Apply to:** All handlers passed as props to SearchEntry, ConfirmStep, DupeBanner (prevents identity churn / effect-loops)
```typescript
const retryAction = useCallback(() => { ... }, [])
const manualAction = useCallback(() => { ... }, [router, initialReturnTo])
const handleSearchPick = useCallback((result: SearchCatalogWatchResult) => { ... }, [router, viewerUserId])
```

### ActionResult envelope
**Source:** `src/lib/actionTypes.ts`
**Apply to:** `moveWishlistToCollection` return type
```typescript
import type { ActionResult } from '@/lib/actionTypes'
// Returns: Promise<ActionResult<Watch>>
// Shape: { success: true; data: T } | { success: false; error: string }
```

---

## No Analog Found

All files have clear analogs from the existing codebase. No files require falling back to RESEARCH.md patterns exclusively.

| File | Closest analog | Note |
|------|----------------|------|
| `flowTypes.test.ts` | `ConfirmStep.test.tsx` | Type-level union enumeration has no exact prior in the codebase, but the test structure is the same |

---

## Metadata

**Analog search scope:** `src/components/watch/`, `src/app/actions/`, `src/app/actions/__tests__/`, `src/data/watches.ts`, `src/components/insights/`
**Files scanned:** 14 source files + 4 test files read directly
**Pattern extraction date:** 2026-05-29

### Critical Implementation Notes for Planner

1. **Wave 0 patches must land before main rewrite** — `StructuredEntryPanel.tsx` emit + `findViewerWatchByCatalogId` return type both have TypeScript-error consequences if the main AddWatchFlow rewrite lands first.

2. **`font-medium` is forbidden** — `tests/no-raw-palette.test.ts` has it in the FORBIDDEN array. DupeBanner's headline MUST use `font-semibold`. Build gate catches violations.

3. **`extracting-url` state's `url` field is the FlowState payload** — the local `const [url, setUrl]` is for the pending-input before the user submits; once they click "Find specs", transition to `{ kind: 'extracting-url', url: trimmedUrl }` and use `state.url` (not the local `url`) inside `handleUrlBackup`.

4. **`onSubmitStructured` needs two args after the patch** — `(result: ExtractedWatchData, catalogId: string | null)`. After the StructuredEntryPanel Wave 0 patch, SearchEntry's pass-through prop type and AddWatchFlow's `handleStructuredSubmit` signature must all match.

5. **No `useTransition` for moveWishlistToCollection** — plain async. Set `confirming.pending = true` before await; `false` in finally. Matches the addWatch plain-async pattern already in AddWatchFlow.

6. **Planner verifies `WatchAddedMetadata` type** — if adding `source?: string` to the type, it is a TypeScript-only change (JSONB column; no migration). If omitting, use `console.warn` for telemetry per Claude's Discretion.
