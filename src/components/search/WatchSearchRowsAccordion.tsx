'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion } from '@base-ui/react/accordion'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { WatchSearchRow } from '@/components/search/WatchSearchRow'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { VerdictSkeleton } from '@/components/insights/VerdictSkeleton'
import { useWatchSearchVerdictCache } from '@/components/search/useWatchSearchVerdictCache'
import { getVerdictForCatalogWatch } from '@/app/actions/verdict'
import { addWatch } from '@/app/actions/watches'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'

/**
 * Phase 20 FIT-04 / D-05 + D-06 — Accordion shell wrapping search rows with
 * lazy-compute Server Action + per-mount cache keyed by collectionRevision.
 *
 * Phase 20.1 D-04 — adds 3 inline CTAs (Add to Wishlist / Add to Collection /
 * Hide) inside Accordion.Panel below the verdict card. Pitfall 2: every onClick
 * starts with `e.stopPropagation()` so the click never bubbles up to the
 * Accordion.Trigger ancestor and collapses the panel.
 *
 * Pitfall 6: Accordion.Trigger absorbs the whole-row click.
 *
 * base-ui Accordion.Root.value is an array (AccordionValue = Value[]).
 * With multiple={false} (default), at most one item is open at a time.
 *
 * Behavior:
 *   - One row open at a time (Accordion.Root multiple={false}, the default)
 *   - First expand → Server Action fires → <VerdictSkeleton /> while pending
 *   - Cache hit on re-expand → <CollectionFitCard /> instantly, no skeleton
 *   - Server Action error → toast.error + collapse panel
 *   - Tab keyboard navigation handled by base-ui Accordion natively
 *   - ESC key handled via onKeyDown on the Accordion.Root (collapses open panel)
 *
 *   Phase 20.1 D-04 wiring:
 *   - Add to Wishlist → addWatch (status='wishlist') + toast.success + collapse
 *     + router.refresh (Pitfall 3 — bumps collectionRevision so cache drops)
 *   - Add to Collection → router.push('/watch/new?catalogId=X&intent=owned'),
 *     does NOT call addWatch (Open Q1 recommendation b — navigate to prefilled
 *     form so user can enter ownership-only fields like pricePaid)
 *   - Hide → setOpenValues([]) (collapse-as-skip semantic)
 *
 * Implementation note on label toggle: isOpen prop is passed to WatchSearchRow
 * so it can toggle "Evaluate"/"Hide" label and rotate ChevronDown. This is
 * cleaner than CSS group-data-[state=open] selectors which require the trigger
 * to propagate data-state into the row's className context.
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
  // base-ui Accordion value is always an array; with multiple=false, max 1 element
  const [openValues, setOpenValues] = useState<string[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const cache = useWatchSearchVerdictCache(collectionRevision)
  const router = useRouter()
  const [committingId, setCommittingId] = useState<string | null>(null)
  const [committingTarget, setCommittingTarget] = useState<'wishlist' | 'collection' | null>(null)

  const openId = openValues[0] ?? null

  const handleValueChange = (next: string[]) => {
    console.log('[accordion] handleValueChange', next) // TODO(20.1-07): remove after gap 5 verification
    setOpenValues(next)
    const nextId = next[0] ?? null
    if (nextId && !cache.get(nextId)) {
      setLoadingId(nextId)
      startTransition(async () => {
        const res = await getVerdictForCatalogWatch({ catalogId: nextId })
        if (res.success) {
          cache.set(nextId, res.data)
        } else {
          // D-05: collapse on error; show toast.
          toast.error(toastCopyForError(res.error))
          setOpenValues([])
        }
        setLoadingId(null)
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && openValues.length > 0) {
      e.preventDefault()
      setOpenValues([])
    }
  }

  // Phase 20.1 D-04 — Wishlist commit handler.
  // SearchCatalogWatchResult only carries identity fields (brand, model, reference,
  // imageUrl) plus counts + viewerState — it does NOT carry spec fields. The
  // /search inline path is the FAST commit; richer spec gets enriched by the
  // catalog upsert pipeline inside addWatch (catalog upserter + taste enricher).
  // movement defaults to 'automatic' — the addWatch Zod schema requires it,
  // and the catalog enricher backfills the real value on the catalog row.
  const handleAddToWishlist = (r: SearchCatalogWatchResult) => {
    if (committingId) return
    setCommittingId(r.catalogId)
    setCommittingTarget('wishlist')
    startTransition(async () => {
      // Pitfall 6: NEVER set photoSourcePath from /search surface.
      // No notes — D-13 verdict-rationale UX is /watch/new only;
      // /search inline commit is the fast path (no rationale prompt).
      const payload = {
        brand: r.brand,
        model: r.model,
        reference: r.reference ?? undefined,
        status: 'wishlist' as const,
        movement: 'automatic' as const,
        complications: [],
        styleTags: [],
        designTraits: [],
        roleTags: [],
        imageUrl: r.imageUrl ?? undefined,
      }
      const result = await addWatch(payload)
      if (result.success) {
        toast.success('Added to wishlist')
        setOpenValues([]) // collapse panel as success cue
        router.refresh() // Pitfall 3: bump collectionRevision so cache drops
      } else {
        toast.error(result.error)
      }
      setCommittingId(null)
      setCommittingTarget(null)
    })
  }

  const handleAddToCollection = (r: SearchCatalogWatchResult) => {
    // D-04 / Open Q1 recommendation b: navigate to /watch/new prefilled-form
    // path so the user can enter ownership-only fields (pricePaid,
    // acquisitionDate). Plan 04 page reads searchParams and advances flow to
    // form-prefill.
    router.push(`/watch/new?catalogId=${encodeURIComponent(r.catalogId)}&intent=owned`)
  }

  const handleHide = () => {
    setOpenValues([])
  }

  return (
    <Accordion.Root
      value={openValues}
      onValueChange={handleValueChange}
      onKeyDown={handleKeyDown}
    >
      {results.map((r) => {
        const isOpen = openId === r.catalogId
        return (
          <Accordion.Item key={r.catalogId} value={r.catalogId}>
            <Accordion.Header>
              <Accordion.Trigger
                className="block w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Evaluate ${r.brand} ${r.model}`}
              >
                <WatchSearchRow result={r} q={q} isOpen={isOpen} />
              </Accordion.Trigger>
            </Accordion.Header>
            {/* base-ui's AccordionPanel exposes data-open (no value) — NOT a data-state attribute.
                See node_modules/@base-ui/react/accordion/panel/AccordionPanelDataAttributes.js.
                UAT gap 5 fix: previous Tailwind selectors keyed off data-state never matched, animations never ran. */}
            <Accordion.Panel className="overflow-hidden px-2 pt-2 pb-4 data-[open]:animate-in data-[open]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 duration-150">
              {loadingId === r.catalogId ? (
                <VerdictSkeleton />
              ) : (
                (() => {
                  const cached = cache.get(r.catalogId)
                  return cached ? <CollectionFitCard verdict={cached} /> : null
                })()
              )}
              {/* Phase 20.1 D-04 — inline 3 CTAs below verdict. Pitfall 2:
                  stopPropagation prevents click bubbling up to Accordion.Trigger
                  and collapsing the panel. */}
              {loadingId !== r.catalogId && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddToWishlist(r)
                    }}
                    disabled={committingId !== null}
                    className="w-full sm:w-auto sm:flex-1"
                    aria-label="Add to Wishlist"
                  >
                    {committingId === r.catalogId && committingTarget === 'wishlist' ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                        Saving...
                      </>
                    ) : (
                      'Add to Wishlist'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddToCollection(r)
                    }}
                    disabled={committingId !== null}
                    className="w-full sm:w-auto sm:flex-1"
                    aria-label="Add to Collection"
                  >
                    Add to Collection
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleHide()
                    }}
                    disabled={committingId !== null}
                    className="w-full sm:w-auto"
                    aria-label="Hide"
                  >
                    Hide
                  </Button>
                </div>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        )
      })}
    </Accordion.Root>
  )
}

function toastCopyForError(error: string): string {
  if (error === 'Watch not found') return 'This watch is no longer available.'
  if (error === 'Not authenticated') return 'Sign in to see how this fits your collection.'
  return "Couldn't compute verdict. Try again."
}
