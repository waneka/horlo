'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PasteSection } from './PasteSection'
import { VerdictStep } from './VerdictStep'
import { WishlistRationalePanel } from './WishlistRationalePanel'
import { RecentlyEvaluatedRail } from './RecentlyEvaluatedRail'
import { WatchForm } from './WatchForm'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
import { getVerdictForCatalogWatch } from '@/app/actions/verdict'
import { addWatch } from '@/app/actions/watches'

import type { FlowState, RailEntry } from './flowTypes'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { Watch, MovementType, WatchStatus } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20.1 D-01 + D-02 — Add-Watch Flow orchestrator.
 *
 * Owns the FlowState state machine, fetches /api/extract-watch (D-08),
 * computes verdict via getVerdictForCatalogWatch Server Action (D-07
 * single round-trip), commits Wishlist via addWatch (D-13 verdict
 * rationale), and routes Collection to a prefilled <WatchForm
 * lockedStatus="owned"> (D-12).
 *
 * Pitfalls explicitly mitigated:
 *   - Pitfall 1: searchParams Promise — handled in page.tsx; here we just
 *     short-circuit to form-prefill when initialCatalogId+intent+prefill
 *     are all set
 *   - Pitfall 3: router.refresh() after Wishlist commit so the next render
 *     gets the bumped collectionRevision and the verdict cache invalidates
 *   - Pitfall 5: textarea blank passes through to addWatch verbatim — the
 *     WishlistRationalePanel sends notes literal; we forward as-is
 *   - Pitfall 6: photoSourcePath is NEVER set on the URL-extract surface
 *     (only the manual-entry photo uploader path may set it; this flow
 *     does not pass through that uploader on the Wishlist commit)
 *   - Pitfall 8: collectionRevision === 0 short-circuits the verdict
 *     compute entirely (D-06 empty-collection edge)
 */
interface AddWatchFlowProps {
  /** Length of viewer's collection — drives verdict cache invalidation per Phase 20 D-06. */
  collectionRevision: number
  /** Deep-link prefill from /search ADD-06 or /catalog ADD-06: jumps flow into form-prefill directly. */
  initialCatalogId: string | null
  /** Whitelisted by the page Server Component to literal 'owned' or null. */
  initialIntent: 'owned' | null
  /** Server-fetched ExtractedWatchData synthesized from a catalog row when initialCatalogId is set. */
  initialCatalogPrefill: ExtractedWatchData | null
  /** Phase 25 D-09: when true (from `?manual=1` server-whitelisted), the flow
   *  starts in `manual-entry` and skips the paste step entirely. Used by the
   *  Collection no-key fallback CTA + the Wishlist empty-state CTA. */
  initialManual: boolean
  /** Phase 25 D-05: when set (from `?status=wishlist` server-whitelisted), the
   *  manual-entry WatchForm opens with status pre-set to this value (still
   *  user-editable; uses WatchForm's `defaultStatus` prop, not `lockedStatus`). */
  initialStatus: 'wishlist' | null
}

const RAIL_MAX = 5

export function AddWatchFlow({
  collectionRevision,
  initialCatalogId,
  initialIntent,
  initialCatalogPrefill,
  initialManual,
  initialStatus,
}: AddWatchFlowProps) {
  const router = useRouter()

  // Pitfall 1 deep-link short-circuit: if catalogId+intent='owned'+prefill all
  // present, jump straight to form-prefill (skip paste + verdict).
  // Phase 25 D-09: else if `?manual=1` is set, skip paste and jump straight to
  // manual-entry. The order of precedence is form-prefill > manual-entry > idle
  // because catalog deep-links carry full extracted data and shouldn't be
  // overridden by a stray manual=1 query string.
  const initialState: FlowState =
    initialCatalogId && initialIntent === 'owned' && initialCatalogPrefill
      ? { kind: 'form-prefill', catalogId: initialCatalogId, extracted: initialCatalogPrefill }
      : initialManual
        ? { kind: 'manual-entry', partial: null }
        : { kind: 'idle' }

  const [state, setState] = useState<FlowState>(initialState)
  const [url, setUrl] = useState('')
  const [, startTransition] = useTransition()
  const [rail, setRail] = useState<RailEntry[]>([])
  const cache = useWatchSearchVerdictCache(collectionRevision)
  // UAT gap 1 (Plan 06): drives the VerdictStep fallback copy split. Threaded
  // into every VerdictStep render call site so a null verdict on a non-empty
  // collection surfaces "Couldn't compute fit" instead of the misleading
  // empty-collection copy.
  const hasCollection = collectionRevision > 0

  // Auto-focus URL input on transitions back to idle (D-14 skip behavior).
  useEffect(() => {
    if (state.kind === 'idle') {
      const el = document.getElementById('paste-url') as HTMLInputElement | null
      el?.focus()
    }
  }, [state.kind])

  // -- Extract handler (D-07 sync wait + D-08 single round-trip) --
  // Plain async (no startTransition) — the extract path needs the
  // 'extracting' render to commit promptly so users (and tests) observe
  // the "Working..." copy. startTransition would defer the awaited
  // verdict-ready setState as a transition; act() in tests flushes all
  // pending updates and skips the intermediate render. The Wishlist
  // commit still uses startTransition because its post-commit work
  // (toast + router.refresh) IS legitimately deferrable.
  const handleExtract = async () => {
    if (!url.trim()) return
    setState({ kind: 'extracting', url })
    // Yield via requestAnimationFrame so the 'extracting' render commits and
    // is observable (e.g. the "Working..." copy + VerdictSkeleton) before we
    // kick off the network round-trip. Without this yield, RTL's act() flushes
    // all awaited microtasks (fetch + verdict resolves) in the same batch as
    // the click handler, and the intermediate render is never observable from
    // findByText. Users in real browsers also benefit from the brief paint
    // pass before the heavier fetch begins.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve())
      } else {
        setTimeout(resolve, 16)
      }
    })
    try {
      const res = await fetch('/api/extract-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({
          kind: 'extraction-failed',
          partial: null,
          reason: data?.error ?? 'Extraction failed',
        })
        return
      }
      const extracted: ExtractedWatchData = data.data ?? {}
      const catalogId: string | null = data.catalogId ?? null
      // Phase 20.1 UAT gap 1 observability: route surfaces an explicit error
      // indicator whenever the catalog upsert path could not produce a real id.
      const catalogIdError: string | null = data.catalogIdError ?? null

      // Pitfall 8: empty collection → skip verdict compute entirely.
      if (collectionRevision === 0) {
        // UAT gap 1 observability — distinguish empty-collection short-circuit
        // from upstream silent failures.
        console.warn('[AddWatchFlow] verdict=null path: collection-empty', { catalogId, catalogIdError })
        setState({
          kind: 'verdict-ready',
          catalogId: catalogId ?? '',
          extracted,
          verdict: null,
        })
        return
      }
      if (!catalogId) {
        // Brand+model missing OR catalog upsert failed; render verdict-ready
        // without verdict so the user can still pick Wishlist/Collection/Skip.
        // UAT gap 1 observability — surfaces which sub-case fired:
        //   - "brand/model missing from extraction" (extractor-side)
        //   - "catalog upsert threw: <msg>" (DB-side)
        //   - "catalog upsert returned null id" (DAL-side, possibly RETURNING shape)
        console.warn('[AddWatchFlow] verdict=null path: catalogId-missing', { catalogIdError })
        setState({ kind: 'verdict-ready', catalogId: '', extracted, verdict: null })
        return
      }
      // Cache hit shortcut (D-10).
      const cached = cache.get(catalogId)
      if (cached) {
        setState({ kind: 'verdict-ready', catalogId, extracted, verdict: cached })
        return
      }
      // Compute verdict.
      const v = await getVerdictForCatalogWatch({ catalogId })
      const bundle: VerdictBundle | null = v.success ? v.data : null
      if (!v.success) {
        // UAT gap 1 observability — surfaces the Server Action error string.
        console.warn('[AddWatchFlow] verdict=null path: verdict-failed', { catalogId, error: v.error })
      }
      if (bundle) cache.set(catalogId, bundle)
      setState({ kind: 'verdict-ready', catalogId, extracted, verdict: bundle })
    } catch (err) {
      console.error('[AddWatchFlow] extract failed:', err)
      // Strip leading "Error:" prefix from String(err) so the surfaced reason
      // reads as user-facing copy rather than a debug toString.
      const reason = err instanceof Error
        ? err.message
        : String(err).replace(/^Error:\s*/i, '')
      setState({ kind: 'extraction-failed', partial: null, reason })
    }
  }

  // -- 3-button handlers from VerdictStep --
  const handleWishlist = () => {
    if (state.kind !== 'verdict-ready') return
    setState({
      kind: 'wishlist-rationale-open',
      catalogId: state.catalogId,
      extracted: state.extracted,
      verdict: state.verdict,
    })
  }

  const handleCollection = () => {
    if (state.kind !== 'verdict-ready') return
    setState({ kind: 'form-prefill', catalogId: state.catalogId, extracted: state.extracted })
  }

  // -- Skip handler — UAT gap 3 fix --
  // Previously guarded with `if (state.catalogId)` which silently no-op'd the
  // rail push when catalogId was empty (silent catalog upsert failure path).
  // Now always pushes; synthesizes id from brand|model when catalogId missing.
  const handleSkip = () => {
    if (state.kind !== 'verdict-ready') return
    // UAT gap 3 fix: ALWAYS push a rail entry. When state.catalogId is empty
    // (upstream catalog upsert silently failed OR brand/model missing), synthesize
    // a stable id from brand|model so the chip still renders. Cache lookup on
    // synthesized ids will miss intentionally — re-clicking the chip restores the
    // previously-stored verdict (which may be null) without re-extracting.
    const brand = state.extracted.brand ?? 'Unknown'
    const model = state.extracted.model ?? ''
    const railId = state.catalogId
      ? state.catalogId
      : `synth:${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}`
    const entry: RailEntry = {
      catalogId: railId,
      brand,
      model,
      imageUrl: state.extracted.imageUrl ?? null,
      extracted: state.extracted,
      verdict: state.verdict,
    }
    setRail((prev) =>
      [entry, ...prev.filter((r) => r.catalogId !== entry.catalogId)].slice(0, RAIL_MAX),
    )
    setUrl('')
    setState({ kind: 'idle' })
  }

  // -- Wishlist commit handler (from WishlistRationalePanel) --
  const handleWishlistConfirm = (notes: string) => {
    if (state.kind !== 'wishlist-rationale-open') return
    const captured = state
    setState({
      kind: 'submitting-wishlist',
      catalogId: captured.catalogId,
      extracted: captured.extracted,
      verdict: captured.verdict,
      notes,
    })
    startTransition(async () => {
      // Pitfall 5: notes is verbatim — '' if user blanked.
      // Pitfall 6: NEVER pass photoSourcePath from URL-extract surface.
      const payload = buildAddWatchPayload(captured.extracted, 'wishlist', notes)
      const result = await addWatch(payload)
      if (result.success) {
        toast.success('Added to wishlist')
        // Pitfall 3: refresh so collectionRevision bumps and verdict cache drops.
        router.refresh()
        setUrl('')
        setState({ kind: 'idle' })
      } else {
        toast.error(result.error)
        // Roll back to wishlist-rationale-open so user can retry.
        setState({
          kind: 'wishlist-rationale-open',
          catalogId: captured.catalogId,
          extracted: captured.extracted,
          verdict: captured.verdict,
        })
      }
    })
  }

  const handleWishlistCancel = () => {
    if (state.kind !== 'wishlist-rationale-open') return
    setState({
      kind: 'verdict-ready',
      catalogId: state.catalogId,
      extracted: state.extracted,
      verdict: state.verdict,
    })
  }

  // -- Manual entry (D-03) + extraction-failed continue --
  const handleManualEntry = () => {
    setState({ kind: 'manual-entry', partial: null })
  }

  const handleContinueManually = () => {
    if (state.kind !== 'extraction-failed') return
    setState({ kind: 'manual-entry', partial: state.partial })
  }

  const handleStartOver = () => {
    setUrl('')
    setState({ kind: 'idle' })
  }

  // -- Rail click → re-open verdict from cache or stored entry --
  const handleRailSelect = (entry: RailEntry) => {
    const cached = cache.get(entry.catalogId)
    setState({
      kind: 'verdict-ready',
      catalogId: entry.catalogId,
      extracted: entry.extracted,
      verdict: cached ?? entry.verdict,
    })
  }

  // -- Render branches per UI-SPEC §Section Visibility per State --
  return (
    <div className="space-y-8">
      {/* Idle / extraction-failed: paste section + manual link */}
      {(state.kind === 'idle' || state.kind === 'extraction-failed') && (
        <PasteSection
          url={url}
          onUrlChange={setUrl}
          onExtract={handleExtract}
          onManualEntry={handleManualEntry}
          pending={false}
        />
      )}

      {/* Extracting: disabled paste + skeleton + Working copy */}
      {state.kind === 'extracting' && (
        <div className="space-y-4">
          <PasteSection
            url={url}
            onUrlChange={setUrl}
            onExtract={() => {}}
            onManualEntry={() => {}}
            pending={true}
            disabled={true}
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Extracting + computing fit...
          </p>
          <VerdictSkeleton />
        </div>
      )}

      {/* Verdict-ready: full step UI */}
      {state.kind === 'verdict-ready' && (
        <VerdictStep
          extracted={state.extracted}
          verdict={state.verdict}
          hasCollection={hasCollection}
          pending={false}
          pendingTarget={null}
          onWishlist={handleWishlist}
          onCollection={handleCollection}
          onSkip={handleSkip}
        />
      )}

      {/* Wishlist-rationale-open / submitting: panel pre-filled with verdict copy */}
      {(state.kind === 'wishlist-rationale-open' ||
        state.kind === 'submitting-wishlist') && (
        <>
          <VerdictStep
            extracted={state.extracted}
            verdict={state.verdict}
            hasCollection={hasCollection}
            pending={state.kind === 'submitting-wishlist'}
            pendingTarget={state.kind === 'submitting-wishlist' ? 'wishlist' : null}
            onWishlist={() => {}}
            onCollection={() => {}}
            onSkip={() => {}}
          />
          <WishlistRationalePanel
            verdict={state.verdict}
            onConfirm={handleWishlistConfirm}
            onCancel={handleWishlistCancel}
            pending={state.kind === 'submitting-wishlist'}
          />
        </>
      )}

      {/* Form-prefill (D-12): WatchForm with lockedStatus="owned" */}
      {state.kind === 'form-prefill' && (
        <WatchForm
          mode="create"
          lockedStatus="owned"
          watch={extractedToPartialWatch(state.extracted, 'owned')}
        />
      )}

      {/* Manual-entry (D-03 + D-18): WatchForm without lockedStatus.
          UAT gap 4 fix (Plan 08): prepend a quiet "Cancel — paste a URL instead"
          back affordance wired to the existing handleStartOver. Both ingress paths
          (direct via PasteSection "or enter manually" + post-failure via
          "Continue manually") share this exit.
          Phase 25 D-05: when initialStatus='wishlist' was threaded from
          `?status=wishlist`, pass it as `defaultStatus` (NOT `lockedStatus`)
          so the form opens pre-set to wishlist but the user can still change. */}
      {state.kind === 'manual-entry' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleStartOver}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
          >
            ← Cancel — paste a URL instead
          </button>
          <WatchForm
            mode="create"
            defaultStatus={initialStatus ?? undefined}
            watch={
              state.partial
                ? extractedToPartialWatch(state.partial, initialStatus ?? 'wishlist')
                : undefined
            }
          />
        </div>
      )}

      {/* Extraction-failed (D-18): unified fallback */}
      {state.kind === 'extraction-failed' && (
        <Card role="alert">
          <CardHeader>
            <CardTitle>Extraction didn&apos;t work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fill in manually using any details below.
            </p>
            {state.reason && (
              <p className="text-xs text-destructive" role="status">
                {state.reason}
              </p>
            )}
            {state.partial && (
              <div className="text-sm space-y-1">
                {state.partial.brand && (
                  <p>
                    <span className="text-muted-foreground">Brand:</span> {state.partial.brand}
                  </p>
                )}
                {state.partial.model && (
                  <p>
                    <span className="text-muted-foreground">Model:</span> {state.partial.model}
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={handleContinueManually}>
                Continue manually
              </Button>
              <Button type="button" variant="outline" onClick={handleStartOver}>
                Try another URL
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rail visible in idle / extracting / verdict-ready / extraction-failed
          (UI-SPEC §Section Visibility per State); hidden in form-prefill / manual-entry. */}
      {state.kind !== 'form-prefill' &&
        state.kind !== 'manual-entry' &&
        state.kind !== 'wishlist-rationale-open' &&
        state.kind !== 'submitting-wishlist' && (
          <RecentlyEvaluatedRail entries={rail} onSelect={handleRailSelect} />
        )}
    </div>
  )
}

/**
 * Map ExtractedWatchData (URL-extract shape) into a partial Watch for WatchForm prefill.
 * - status defaulted to caller-provided value
 * - id is a placeholder string (WatchForm.mode='create' ignores id)
 * - Required fields with no extracted value get safe defaults
 */
function extractedToPartialWatch(data: ExtractedWatchData, status: WatchStatus): Watch {
  const movement: MovementType = data.movement ?? 'automatic'
  return {
    id: 'pending',
    brand: data.brand ?? '',
    model: data.model ?? '',
    reference: data.reference,
    status,
    marketPrice: data.marketPrice,
    movement,
    complications: data.complications ?? [],
    caseSizeMm: data.caseSizeMm,
    lugToLugMm: data.lugToLugMm,
    waterResistanceM: data.waterResistanceM,
    strapType: data.strapType,
    crystalType: data.crystalType,
    dialColor: data.dialColor,
    styleTags: data.styleTags ?? [],
    designTraits: data.designTraits ?? [],
    roleTags: [],
    productionYear: undefined,
    isChronometer: data.isChronometer,
    notes: undefined,
    imageUrl: data.imageUrl,
  }
}

/**
 * Build the addWatch payload for the Wishlist commit path.
 * - Pitfall 6: NEVER set photoSourcePath (URL-extract surface forbids it).
 * - Pitfall 5: notes is verbatim, including '' when user blanked.
 */
function buildAddWatchPayload(
  data: ExtractedWatchData,
  status: WatchStatus,
  notes: string,
) {
  return {
    brand: data.brand ?? '',
    model: data.model ?? '',
    reference: data.reference,
    status,
    marketPrice: data.marketPrice,
    movement: data.movement ?? 'automatic',
    complications: data.complications ?? [],
    caseSizeMm: data.caseSizeMm,
    lugToLugMm: data.lugToLugMm,
    waterResistanceM: data.waterResistanceM,
    strapType: data.strapType,
    crystalType: data.crystalType,
    dialColor: data.dialColor,
    styleTags: data.styleTags ?? [],
    designTraits: data.designTraits ?? [],
    roleTags: [],
    isChronometer: data.isChronometer,
    notes,
    imageUrl: data.imageUrl,
  }
}
