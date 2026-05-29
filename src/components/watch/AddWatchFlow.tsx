'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { SearchEntry } from './SearchEntry'
import { ConfirmStep } from './ConfirmStep'
import { DupeBanner } from './DupeBanner'
import { WatchForm } from './WatchForm'
import { WatchPhotoStep } from './WatchPhotoStep'
import { ExtractErrorCard, type ExtractErrorCategory } from './ExtractErrorCard'
import { useUrlExtractCache } from './useUrlExtractCache'
import {
  addWatch,
  moveWishlistToCollection,
  findViewerWatchByCatalogIdAction,
} from '@/app/actions/watches'
import { defaultDestinationForStatus } from '@/lib/watchFlow/destinations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { FlowState, RailEntry, DupeContext } from './flowTypes'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { Watch, MovementType, WatchStatus } from '@/lib/types'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 70 — Add-Watch Flow orchestrator (v8.0 search-first rewrite).
 *
 * Owns the FlowState state machine per Plan 04's D-01 union. Mounts the
 * dormant Phase 66/67/68/69 primitives (SearchEntry, ConfirmStep,
 * StructuredEntryPanel via SearchEntry, ExtractErrorCard, WatchPhotoStep)
 * and the new Phase 70 DupeBanner. Hard-cutover: no PasteSection /
 * VerdictStep / WishlistRationalePanel / RecentlyEvaluatedRail /
 * useWatchSearchVerdictCache / verdict imports.
 *
 * D-NN locked decisions implemented:
 *   D-01 FlowState union from flowTypes.ts (Plan 04)
 *   D-02 transition map JSDoc in flowTypes.ts
 *   D-03 initialState precedence: form-prefill > manual-entry > search-idle
 *   D-04 initialReturnTo threaded through every commit branch
 *   D-05 DUPE-01 owned-pick → router.push(`/w/${reference}`)
 *   D-06 null-reference owned fallthrough → confirming with owned banner
 *   D-07 DUPE-02 only in confirming when dupeContext.existingStatus==='owned'
 *   D-08 "Add another copy" clears dupeContext only; CTA stays addWatch
 *   D-09 no /w/[ref] edit (PROJECT.md lock)
 *   D-11 DupeBanner sibling ABOVE ConfirmStep (Phase 68 D-03 contract intact)
 *   D-12 DupeBanner is the primary affordance when mounted
 *   D-13 post-DUPE-03 nav: defaultDestinationForStatus('owned', viewerUsername); no photos step
 *   D-14 extracting-url is INLINE (no PasteSection); {mode:'url',url} body
 *   D-15 "← Back to search" always rendered in extracting-url
 *   D-16 useUrlExtractCache reused identically (Phase 69 D-08)
 *   D-17 photos-pending gated on status === 'owned'
 *   D-18 full destination matrix
 *   D-19 CLNP-06 skip link BELOW SearchEntry; setState manual-entry, no router.push
 *   D-20 manual-entry back affordance: "← Cancel — return to search" → search-idle
 *   D-21 default confirming status: initialStatus ?? 'wishlist'
 *   D-22 useLayoutEffect cleanup updated for new FlowState kinds; module caches NOT cleared
 */
interface AddWatchFlowProps {
  /** Length of viewer's collection — historically drove verdict cache invalidation; retained for
   *  the page-side prop shape per /watch/new/page.tsx; not consumed in the v8.0 search-first flow. */
  collectionRevision: number
  initialCatalogId: string | null
  initialIntent: 'owned' | null
  initialCatalogPrefill: ExtractedWatchData | null
  initialManual: boolean
  initialStatus: 'wishlist' | null
  initialReturnTo: string | null
  viewerUsername: string | null
  viewerUserId: string
  /** Phase 69 D-13 — SSR-fetched catalog brand list for SearchEntry / parseSearchQuery SRCH-26 pre-seed. */
  catalogBrands: string[]
}

export function AddWatchFlow({
  collectionRevision: _collectionRevision,
  initialCatalogId,
  initialIntent,
  initialCatalogPrefill,
  initialManual,
  initialStatus,
  initialReturnTo,
  viewerUsername,
  viewerUserId,
  catalogBrands,
}: AddWatchFlowProps) {
  const router = useRouter()

  // D-03 — initialState precedence: form-prefill > manual-entry > search-idle.
  const initialState: FlowState =
    initialCatalogId && initialIntent === 'owned' && initialCatalogPrefill
      ? { kind: 'form-prefill', catalogId: initialCatalogId, extracted: initialCatalogPrefill }
      : initialManual
        ? { kind: 'manual-entry', partial: null }
        : { kind: 'search-idle' }

  const [state, setState] = useState<FlowState>(initialState)
  // `url` is the local input for the extracting-url inline mini-form (D-14).
  const [url, setUrl] = useState('')
  // `rail` is preserved for Activity-hide cleanup safety; CLNP-04 deferred to Phase 71.
  const [rail, setRail] = useState<RailEntry[]>([])

  // D-16 — Phase 69 D-08 retrofit: viewerUserId threaded for CLNP-07 cross-user reset.
  const urlCache = useUrlExtractCache(viewerUserId)

  // ConfirmStep-controlled fields (Phase 68 D-03 LOCKED contract — orchestrator owns the state).
  // D-21 default status: initialStatus ?? 'wishlist'.
  const [confirmStatus, setConfirmStatus] = useState<'owned' | 'wishlist' | 'grail'>(
    initialStatus ?? 'wishlist',
  )
  const [confirmReference, setConfirmReference] = useState<string>('')
  const [confirmYear, setConfirmYear] = useState<number | undefined>(undefined)
  const [confirmPrice, setConfirmPrice] = useState<number | undefined>(undefined)

  // Auto-focus URL input when entering extracting-url so the user can paste immediately.
  useEffect(() => {
    if (state.kind === 'extracting-url') {
      const el = document.getElementById('extracting-url-input') as HTMLInputElement | null
      el?.focus()
    }
  }, [state.kind])

  // D-22 — Activity-hide cleanup (Phase 29 / FORM-04). Three skip cases; otherwise reset to search-idle.
  // Module-scope caches are NOT cleared here — Phase 69 CLNP-07 handles cross-user reset via viewerUserId mismatch.
  const stateRef = useRef(state)
  const urlRef = useRef(url)
  const railRef = useRef(rail)
  stateRef.current = state
  urlRef.current = url
  railRef.current = rail
  useLayoutEffect(() => {
    return () => {
      const s = stateRef.current
      // Skip case 2: form-prefill is initialState-derived from URL params; survives StrictMode.
      if (s.kind === 'form-prefill') return
      // Skip case 3: manual-entry-from-deep-link must survive StrictMode mount/cleanup/mount.
      if (s.kind === 'manual-entry' && s.partial === null && initialManual === true) return
      // Skip case 1: nothing user-accumulated to reset (search-idle, no URL, no rail).
      if (s.kind === 'search-idle' && urlRef.current === '' && railRef.current.length === 0) return
      // Real Activity-hide reset.
      setState({ kind: 'search-idle' })
      setUrl('')
      setRail([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // SearchEntry handlers
  // ---------------------------------------------------------------------------

  // D-05 / D-06 / DUPE-01 / DUPE-03 entry — search-pick branch.
  const handleSearchPick = useCallback(
    async (result: SearchCatalogWatchResult) => {
      // D-05 — owned + non-null reference → /w/[ref] redirect.
      if (result.viewerState === 'owned' && result.reference) {
        router.push(`/w/${encodeURIComponent(result.reference)}`)
        return
      }
      // D-06 — owned + null reference → confirm with owned-banner.
      if (result.viewerState === 'owned') {
        console.warn('[Phase 70] dupeContext: owned existing → confirm-with-banner (null reference fallback)')
        const dupeRow = await resolveDupeContext(result.catalogId)
        const dupeContext: DupeContext | null = dupeRow
          ? { existingWatchId: dupeRow.id, existingStatus: dupeRow.status, existingReference: dupeRow.reference }
          : null
        const extracted = searchResultToExtracted(result)
        setConfirmStatus('owned')
        setConfirmReference(result.reference ?? '')
        setConfirmYear(undefined)
        setConfirmPrice(undefined)
        setState({
          kind: 'confirming',
          catalogId: result.catalogId,
          extracted,
          pickedResult: result,
          dupeContext,
          pending: false,
          // Search-pick has no inline photo affordance — the photo step happens
          // later in WatchPhotoStep (D-17 owned gate). photoBlob stays null.
          photoBlob: null,
        })
        return
      }
      // wishlist or null — confirming branch.
      if (result.viewerState === 'wishlist') {
        console.warn('[Phase 70] dupeContext: wishlist existing → move-to-collection affordance')
      }
      const dupeRow = result.viewerState ? await resolveDupeContext(result.catalogId) : null
      const dupeContext: DupeContext | null = dupeRow
        ? { existingWatchId: dupeRow.id, existingStatus: dupeRow.status, existingReference: dupeRow.reference }
        : null
      const extracted = searchResultToExtracted(result)
      // D-21 — DUPE-03 wishlist context: default status to wishlist (already initialStatus ?? 'wishlist').
      setConfirmStatus(initialStatus ?? 'wishlist')
      setConfirmReference(result.reference ?? '')
      setConfirmYear(undefined)
      setConfirmPrice(undefined)
      setState({
        kind: 'confirming',
        catalogId: result.catalogId,
        extracted,
        pickedResult: result,
        dupeContext,
        pending: false,
        // Search-pick has no inline photo affordance — photoBlob stays null.
        photoBlob: null,
      })
    },
    [router, initialStatus],
  )

  // DUPE-02 entry — structured-input branch (T-70-04: server-side dupe re-verify).
  // Phase 70 gap plan 07 — CR-01 closure: the third arg `photoBlob` is the
  // EXIF-cleaned Blob captured by StructuredEntryPanel's CatalogPhotoUploader and
  // forwarded upward via the widened (gap plan 06) onSubmitStructured contract.
  // Capture it onto the confirming state so handleConfirmPrimary can upload via
  // uploadCatalogSourcePhoto before addWatch (mirrors WatchForm.tsx:222-249).
  const handleStructuredSubmit = useCallback(
    async (
      extracted: ExtractedWatchData,
      catalogId: string | null,
      photoBlob?: Blob | null,
    ) => {
      const dupeRow = catalogId ? await resolveDupeContext(catalogId) : null
      const dupeContext: DupeContext | null = dupeRow
        ? { existingWatchId: dupeRow.id, existingStatus: dupeRow.status, existingReference: dupeRow.reference }
        : null
      if (dupeContext) {
        console.warn(
          `[Phase 70] dupeContext: ${dupeContext.existingStatus} existing → ${
            dupeContext.existingStatus === 'owned' ? 'confirm-with-banner' : 'move-to-collection affordance'
          }`,
        )
      }
      // D-21 — DUPE-02 owned context overrides to 'owned'; else default.
      const nextStatus: 'owned' | 'wishlist' | 'grail' =
        dupeContext?.existingStatus === 'owned' ? 'owned' : (initialStatus ?? 'wishlist')
      setConfirmStatus(nextStatus)
      setConfirmReference(extracted.reference ?? '')
      setConfirmYear(undefined)
      setConfirmPrice(undefined)
      setState({
        kind: 'confirming',
        catalogId,
        extracted,
        pickedResult: null,
        dupeContext,
        pending: false,
        photoBlob: photoBlob ?? null,
      })
    },
    [initialStatus],
  )

  // D-14 — switch to URL-backup mode.
  const handleSwitchToUrl = useCallback(() => {
    setUrl('')
    setState({ kind: 'extracting-url', url: '' })
  }, [])

  // D-19 — CLNP-06 skip link → in-flow transition to manual-entry (NO router.push).
  const handleSkipSearch = useCallback(() => {
    setState({ kind: 'manual-entry', partial: null })
  }, [])

  // ---------------------------------------------------------------------------
  // URL-backup handler (D-14 / D-16 / Phase 66 mode-discriminated body)
  // ---------------------------------------------------------------------------

  const handleUrlBackup = useCallback(async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    setState({ kind: 'extracting-url', url: trimmedUrl })

    // Yield via requestAnimationFrame so the extracting render commits.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve())
      } else {
        setTimeout(resolve, 16)
      }
    })

    // FORM-04 Gap 3 / D-16 — cache check.
    const cachedExtract = urlCache.get(trimmedUrl)
    if (cachedExtract) {
      const { catalogId, extracted } = cachedExtract
      const dupeRow = catalogId ? await resolveDupeContext(catalogId) : null
      const dupeContext: DupeContext | null = dupeRow
        ? { existingWatchId: dupeRow.id, existingStatus: dupeRow.status, existingReference: dupeRow.reference }
        : null
      const nextStatus: 'owned' | 'wishlist' | 'grail' =
        dupeContext?.existingStatus === 'owned' ? 'owned' : (initialStatus ?? 'wishlist')
      setConfirmStatus(nextStatus)
      setConfirmReference(extracted.reference ?? '')
      setConfirmYear(undefined)
      setConfirmPrice(undefined)
      setState({
        kind: 'confirming',
        catalogId,
        extracted,
        pickedResult: null,
        dupeContext,
        pending: false,
        // URL-backup path has no inline photo affordance — photoBlob stays null.
        photoBlob: null,
      })
      return
    }

    try {
      // D-14 — Phase 66 mode-discriminated body.
      const res = await fetch('/api/extract-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'url', url: trimmedUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        const category: ExtractErrorCategory =
          (data?.category as ExtractErrorCategory | undefined) ?? 'generic-network'
        setState({
          kind: 'extraction-failed',
          partial: null,
          reason: data?.error ?? 'Extraction failed',
          category,
          mode: 'url',
        })
        return
      }
      const extracted: ExtractedWatchData = data.data ?? {}
      const catalogId: string | null = data.catalogId ?? null
      const catalogIdError: string | null = data.catalogIdError ?? null

      // Only cache fully-successful extracts with a real catalogId.
      if (catalogId) {
        urlCache.set(trimmedUrl, { catalogId, extracted, catalogIdError })
      }

      const dupeRow = catalogId ? await resolveDupeContext(catalogId) : null
      const dupeContext: DupeContext | null = dupeRow
        ? { existingWatchId: dupeRow.id, existingStatus: dupeRow.status, existingReference: dupeRow.reference }
        : null
      if (dupeContext) {
        console.warn(
          `[Phase 70] dupeContext: ${dupeContext.existingStatus} existing → ${
            dupeContext.existingStatus === 'owned' ? 'confirm-with-banner' : 'move-to-collection affordance'
          }`,
        )
      }
      const nextStatus: 'owned' | 'wishlist' | 'grail' =
        dupeContext?.existingStatus === 'owned' ? 'owned' : (initialStatus ?? 'wishlist')
      setConfirmStatus(nextStatus)
      setConfirmReference(extracted.reference ?? '')
      setConfirmYear(undefined)
      setConfirmPrice(undefined)
      setState({
        kind: 'confirming',
        catalogId,
        extracted,
        pickedResult: null,
        dupeContext,
        pending: false,
        // URL-backup path has no inline photo affordance — photoBlob stays null.
        photoBlob: null,
      })
    } catch (err) {
      console.error('[AddWatchFlow] URL-backup extract failed:', err)
      const reason =
        err instanceof Error ? err.message : String(err).replace(/^Error:\s*/i, '')
      setState({
        kind: 'extraction-failed',
        partial: null,
        reason,
        category: 'generic-network',
        mode: 'url',
      })
    }
  }, [url, urlCache, initialStatus])

  // ---------------------------------------------------------------------------
  // ConfirmStep handlers
  // ---------------------------------------------------------------------------

  // Primary commit — addWatch with the catalogId branch (Phase 67).
  //
  // Phase 70 gap plan 07 (VERIFICATION gap #1 closure):
  //   CR-02 movement: the pre-gap code shipped a synthetic auto-default on the
  //     movement field which corrupted quartz/manual catalog rows to auto in the
  //     user's watches row. Fix: gate on catalogId — when set, OMIT movement
  //     entirely so the catalog row + Phase 19.5 LLM-derived taste enrichment
  //     owns the truth. When no catalogId (URL-backup transient failure), only
  //     forward extracted.movement if it was actually provided (no synthetic
  //     default ever).
  //   CR-02 imageUrl: the dead imageUrl payload field has been removed (Phase 60
  //     dropped the column; mapDomainToRow:94 silently drops it).
  //   CR-01 photoSourcePath: upload the captured photoBlob via uploadCatalogSourcePhoto
  //     BEFORE addWatch; forward bucket path as photoSourcePath in the payload.
  //     Mirrors WatchForm.tsx:222-249. Fire-and-forget on failure (proceed without photo).
  const handleConfirmPrimary = useCallback(async () => {
    if (state.kind !== 'confirming') return
    const captured = state
    setState({ ...captured, pending: true })

    // Build payload. catalogId branch (Phase 67 D-10) server-overrides brand/model/reference.
    const payload: Record<string, unknown> = {
      brand: captured.extracted.brand ?? '',
      model: captured.extracted.model ?? '',
      reference: confirmReference || captured.extracted.reference || undefined,
      status: confirmStatus,
      complications: captured.extracted.complications ?? [],
      caseSizeMm: captured.extracted.caseSizeMm,
      lugToLugMm: captured.extracted.lugToLugMm,
      waterResistanceM: captured.extracted.waterResistanceM,
      strapType: captured.extracted.strapType,
      crystalType: captured.extracted.crystalType,
      dialColor: captured.extracted.dialColor,
      styleTags: captured.extracted.styleTags ?? [],
      designTraits: captured.extracted.designTraits ?? [],
      roleTags: [],
      isChronometer: captured.extracted.isChronometer,
      marketPrice: captured.extracted.marketPrice,
      productionYear: confirmYear,
    }
    // CR-02 movement fix: when catalogId is set, the catalog row + downstream
    // taste enrichment supplies movement; never default to 'auto'. When no
    // catalogId (URL-backup transient failure), forward extracted.movement only
    // if it was actually provided (no synthetic default).
    if (!captured.catalogId && captured.extracted.movement) {
      payload.movement = captured.extracted.movement
    }
    if (captured.catalogId) payload.catalogId = captured.catalogId
    if (confirmStatus === 'owned' && confirmPrice !== undefined) payload.pricePaid = confirmPrice
    if ((confirmStatus === 'wishlist' || confirmStatus === 'grail') && confirmPrice !== undefined) {
      payload.targetPrice = confirmPrice
    }

    // CR-01 photo upload: if a Blob was captured via the gap plan 06 widened
    // onSubmitStructured(result, catalogId, photoBlob?) contract, upload it
    // BEFORE addWatch. Fire-and-forget on failure — the watch commit proceeds
    // without photoSourcePath (mirrors WatchForm.tsx:222-249).
    if (captured.photoBlob) {
      try {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { uploadCatalogSourcePhoto } = await import('@/lib/storage/catalogSourcePhotos')
          const uploadResult = await uploadCatalogSourcePhoto(user.id, 'pending', captured.photoBlob)
          if ('path' in uploadResult) {
            payload.photoSourcePath = uploadResult.path
          } else {
            console.error('[AddWatchFlow gap-07] photo upload failed:', uploadResult.error)
          }
        }
      } catch (err) {
        console.error('[AddWatchFlow gap-07] photo upload exception (non-fatal):', err)
      }
    }

    const result = await addWatch(payload)
    if (!result.success) {
      toast.error(result.error)
      setState({ ...captured, pending: false })
      return
    }

    const watchId = result.data.id
    // D-18 / D-17 — destination matrix.
    const dest = initialReturnTo ?? defaultDestinationForStatus(confirmStatus, viewerUsername)
    if (confirmStatus === 'owned') {
      setState({ kind: 'photos-pending', watchId, destination: dest })
    } else {
      setUrl('')
      setRail([])
      setState({ kind: 'search-idle' })
      router.push(dest)
    }
  }, [state, confirmStatus, confirmReference, confirmYear, confirmPrice, initialReturnTo, viewerUsername, router])

  // CONF-07 — open WatchForm for full edit.
  const handleConfirmEditDetails = useCallback(() => {
    if (state.kind !== 'confirming') return
    if (!state.catalogId) {
      // Without a catalogId we fall back to manual-entry with the extracted partial.
      setState({ kind: 'manual-entry', partial: state.extracted })
      return
    }
    setState({ kind: 'form-prefill', catalogId: state.catalogId, extracted: state.extracted })
  }, [state])

  // CONF-09 — return to search idle.
  const handleConfirmStartOver = useCallback(() => {
    setUrl('')
    setState({ kind: 'search-idle' })
  }, [])

  // ---------------------------------------------------------------------------
  // DupeBanner handlers
  // ---------------------------------------------------------------------------

  // D-05 / D-09 — onViewExisting only called when existingReference is non-null
  // (DupeBanner hides the button otherwise).
  const handleViewExisting = useCallback(() => {
    if (state.kind !== 'confirming' || !state.dupeContext?.existingReference) return
    router.push(`/w/${encodeURIComponent(state.dupeContext.existingReference)}`)
  }, [state, router])

  // D-13 — DUPE-03 commit. Plain async; orchestrator sets pending; no useTransition.
  const handleMoveToCollection = useCallback(async () => {
    if (state.kind !== 'confirming' || !state.dupeContext || state.dupeContext.existingStatus !== 'wishlist') return
    const captured = state
    const existingWatchId = captured.dupeContext!.existingWatchId
    setState({ ...captured, pending: true })

    const result = await moveWishlistToCollection(existingWatchId)
    if (!result.success) {
      toast.error(result.error)
      setState({ ...captured, pending: false })
      return
    }

    const dest = initialReturnTo ?? defaultDestinationForStatus('owned', viewerUsername)
    const actionHref = viewerUsername ? `/u/${viewerUsername}/collection` : null
    if (actionHref) {
      toast.success('Moved to collection', {
        action: {
          label: 'View',
          onClick: () => router.push(actionHref),
        },
      })
    }
    setUrl('')
    setRail([])
    setState({ kind: 'search-idle' })
    router.push(dest)
  }, [state, initialReturnTo, viewerUsername, router])

  // D-08 — "Add another copy" clears dupeContext only; ConfirmStep stays mounted.
  const handleAddAnotherCopy = useCallback(() => {
    if (state.kind !== 'confirming') return
    setState({ ...state, dupeContext: null, pending: false })
  }, [state])

  // ---------------------------------------------------------------------------
  // WatchForm / WatchPhotoStep handlers
  // ---------------------------------------------------------------------------

  // D-17 — form-prefill / manual-entry intercept. Status from WatchForm's third arg gates photos-pending.
  const handleWatchCreated = useCallback(
    (watchId: string, dest: string, status: WatchStatus) => {
      if (status === 'owned') {
        setState({ kind: 'photos-pending', watchId, destination: dest })
      } else {
        setUrl('')
        setRail([])
        setState({ kind: 'search-idle' })
        router.push(dest)
      }
    },
    [router],
  )

  // ---------------------------------------------------------------------------
  // ExtractErrorCard recovery actions (preserved verbatim from prior orchestrator)
  // ---------------------------------------------------------------------------

  const retryAction = useCallback(() => {
    setUrl('')
    setState({ kind: 'search-idle' })
  }, [])

  const manualAction = useCallback(() => {
    const qs = initialReturnTo
      ? `?manual=1&returnTo=${encodeURIComponent(initialReturnTo)}`
      : '?manual=1'
    router.push(`/watch/new${qs}`)
  }, [router, initialReturnTo])

  // ---------------------------------------------------------------------------
  // Render branches per UI-SPEC §C / B / E / D
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* C — search-idle branch: SearchEntry + CLNP-06 skip link (D-19) */}
      {state.kind === 'search-idle' && (
        <div className="space-y-6">
          <SearchEntry
            viewerUserId={viewerUserId}
            catalogBrands={catalogBrands}
            onPick={handleSearchPick}
            onSubmitStructured={handleStructuredSubmit}
            onSwitchToUrl={handleSwitchToUrl}
          />
          <button
            type="button"
            onClick={handleSkipSearch}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
          >
            Skip search — enter manually
          </button>
        </div>
      )}

      {/* B — extracting-url branch: inline URL input + "Find specs" + "← Back to search" (D-14/D-15) */}
      {state.kind === 'extracting-url' && (
        <div className="space-y-4" aria-live="polite">
          <button
            type="button"
            onClick={() => {
              setUrl('')
              setState({ kind: 'search-idle' })
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
          >
            ← Back to search
          </button>
          <div className="space-y-2">
            <Input
              id="extracting-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a watch URL"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlBackup()
              }}
              aria-label="Watch page URL"
            />
          </div>
          <Button
            type="button"
            onClick={handleUrlBackup}
            disabled={!url.trim()}
            className="w-full"
          >
            {state.url !== '' ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                Finding specs…
              </>
            ) : (
              'Find specs'
            )}
          </Button>
        </div>
      )}

      {/* E — confirming branch: DupeBanner (when dupeContext) ABOVE ConfirmStep (D-11) */}
      {state.kind === 'confirming' && (
        <div className="space-y-6">
          {state.dupeContext && (
            <DupeBanner
              existingStatus={state.dupeContext.existingStatus}
              existingReference={state.dupeContext.existingReference}
              onViewExisting={handleViewExisting}
              onMoveToCollection={
                state.dupeContext.existingStatus === 'wishlist' ? handleMoveToCollection : undefined
              }
              onAddAnotherCopy={handleAddAnotherCopy}
              pending={state.pending}
            />
          )}
          <ConfirmStep
            catalogImageUrl={state.pickedResult?.imageUrl ?? null}
            extractedImageUrl={state.extracted.imageUrl ?? null}
            brand={state.extracted.brand ?? ''}
            model={state.extracted.model ?? ''}
            reference={confirmReference}
            onReferenceChange={setConfirmReference}
            productionYear={confirmYear}
            onProductionYearChange={setConfirmYear}
            status={confirmStatus}
            onStatusChange={setConfirmStatus}
            price={confirmPrice}
            onPriceChange={setConfirmPrice}
            onPrimary={handleConfirmPrimary}
            onEditDetails={handleConfirmEditDetails}
            onStartOver={handleConfirmStartOver}
            pending={state.pending}
            movement={state.extracted.movement ?? null}
            caseSizeMm={state.extracted.caseSizeMm ?? null}
            dialColor={state.extracted.dialColor ?? null}
          />
        </div>
      )}

      {/* form-prefill branch: WatchForm locked to owned (existing pattern) */}
      {state.kind === 'form-prefill' && (
        <WatchForm
          mode="create"
          lockedStatus="owned"
          watch={extractedToPartialWatch(state.extracted, 'owned')}
          returnTo={initialReturnTo}
          viewerUsername={viewerUsername}
          onWatchCreated={handleWatchCreated}
        />
      )}

      {/* D — manual-entry branch: back affordance copy updated per D-20 */}
      {state.kind === 'manual-entry' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setUrl('')
              setState({ kind: 'search-idle' })
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
          >
            ← Cancel — return to search
          </button>
          <WatchForm
            mode="create"
            defaultStatus={initialStatus ?? undefined}
            watch={
              state.partial
                ? extractedToPartialWatch(state.partial, initialStatus ?? 'wishlist')
                : undefined
            }
            returnTo={initialReturnTo}
            viewerUsername={viewerUsername}
            onWatchCreated={handleWatchCreated}
          />
        </div>
      )}

      {/* photos-pending branch: D-17 gate is applied upstream (handleConfirmPrimary / handleWatchCreated) */}
      {state.kind === 'photos-pending' && (
        <WatchPhotoStep
          watchId={state.watchId}
          userId={viewerUserId}
          onDone={() => {
            setUrl('')
            setRail([])
            setState({ kind: 'search-idle' })
            router.push(state.destination)
          }}
          onSkip={() => {
            setUrl('')
            setRail([])
            setState({ kind: 'search-idle' })
            router.push(state.destination)
          }}
        />
      )}

      {/* extraction-failed branch: ExtractErrorCard with mode prop wired (Phase 69 D-06) */}
      {state.kind === 'extraction-failed' && (
        <ExtractErrorCard
          category={state.category}
          mode={state.mode}
          message={state.reason}
          retryAction={retryAction}
          manualAction={manualAction}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that calls the `findViewerWatchByCatalogIdAction` Server Action
 * with the LOCKED `['owned', 'wishlist']` status whitelist (Phase 70 DUPE
 * resolution) and unwraps the ActionResult envelope. Returns `null` for both
 * "no existing row" and "action failed" — failing to resolve is non-fatal for
 * the orchestrator (the confirming branch falls back to dupeContext=null,
 * losing only the DupeBanner affordance; the primary add path continues to work).
 *
 * T-70-04 mitigation: viewer identity is re-derived inside the action via
 * `getCurrentUser()`; the client-supplied viewerUserId prop is NOT trusted on
 * this code path (the action ignores the client identity entirely).
 */
async function resolveDupeContext(
  catalogId: string,
): Promise<{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null> {
  const result = await findViewerWatchByCatalogIdAction(catalogId, ['owned', 'wishlist'])
  if (!result.success) {
    console.warn('[Phase 70] resolveDupeContext failed (non-fatal):', result.error)
    return null
  }
  return result.data
}

/**
 * Map a SearchCatalogWatchResult into the partial ExtractedWatchData shape
 * ConfirmStep consumes. The search result carries brand/model/reference/imageUrl
 * directly; the other ExtractedWatchData fields are unknown at search-pick time
 * (they live on the catalog row but the search projection does not fetch them).
 */
function searchResultToExtracted(result: SearchCatalogWatchResult): ExtractedWatchData {
  return {
    brand: result.brand,
    model: result.model,
    reference: result.reference ?? undefined,
    imageUrl: result.imageUrl ?? undefined,
  }
}

/**
 * Map ExtractedWatchData (URL-extract / search-pick / structured-input shape)
 * into a partial Watch for WatchForm prefill. Preserved verbatim from the prior
 * orchestrator.
 */
function extractedToPartialWatch(data: ExtractedWatchData, status: WatchStatus): Watch {
  const movement: MovementType = data.movement ?? 'auto'
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
