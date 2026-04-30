'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion } from '@base-ui/react/accordion'
import { toast } from 'sonner'
import { Loader2, ChevronDown } from 'lucide-react'

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
 * Phase 20.1 gap-5 follow-up:
 *   - Row body is now a <Link> to /catalog/[id] (primary action).
 *   - Right-edge chevron is the ONLY accordion trigger affordance (passed to
 *     WatchSearchRow as the `trigger` slot).
 *   - "Hide" CTA removed — clicking the chevron again collapses the panel.
 *
 * base-ui Accordion.Root.value is an array (AccordionValue = Value[]).
 * With multiple={false} (default), at most one item is open at a time.
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
  const [openValues, setOpenValues] = useState<string[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const cache = useWatchSearchVerdictCache(collectionRevision)
  const router = useRouter()
  const [committingId, setCommittingId] = useState<string | null>(null)
  const [committingTarget, setCommittingTarget] = useState<'wishlist' | 'collection' | null>(null)

  const handleValueChange = (next: string[]) => {
    setOpenValues(next)
    const nextId = next[0] ?? null
    if (nextId && !cache.get(nextId)) {
      setLoadingId(nextId)
      startTransition(async () => {
        const res = await getVerdictForCatalogWatch({ catalogId: nextId })
        if (res.success) {
          cache.set(nextId, res.data)
        } else {
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

  const handleAddToWishlist = (r: SearchCatalogWatchResult) => {
    if (committingId) return
    setCommittingId(r.catalogId)
    setCommittingTarget('wishlist')
    startTransition(async () => {
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
        setOpenValues([])
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setCommittingId(null)
      setCommittingTarget(null)
    })
  }

  const handleAddToCollection = (r: SearchCatalogWatchResult) => {
    router.push(`/watch/new?catalogId=${encodeURIComponent(r.catalogId)}&intent=owned`)
  }

  return (
    <Accordion.Root
      value={openValues}
      onValueChange={handleValueChange}
      onKeyDown={handleKeyDown}
    >
      {results.map((r) => (
        <Accordion.Item key={r.catalogId} value={r.catalogId}>
          <Accordion.Header className="contents">
            <WatchSearchRow
              result={r}
              q={q}
              trigger={
                <Accordion.Trigger
                  className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 data-[panel-open]:[&>svg]:rotate-180 [&>svg]:transition-transform"
                  aria-label={`Toggle fit for ${r.brand} ${r.model}`}
                >
                  <ChevronDown className="size-5" aria-hidden="true" />
                </Accordion.Trigger>
              }
            />
          </Accordion.Header>
          {/* base-ui's AccordionPanel exposes data-open (no value) — NOT a data-state attribute.
              See node_modules/@base-ui/react/accordion/panel/AccordionPanelDataAttributes.js. */}
          <Accordion.Panel className="overflow-hidden px-2 pt-2 pb-4 data-[open]:animate-in data-[open]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 duration-150">
            {loadingId === r.catalogId ? (
              <VerdictSkeleton />
            ) : (
              (() => {
                const cached = cache.get(r.catalogId)
                return cached ? <CollectionFitCard verdict={cached} /> : null
              })()
            )}
            {/* Phase 20.1 D-04 — inline CTAs below verdict. Pitfall 2:
                stopPropagation prevents click bubbling up to ancestors. */}
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
              </div>
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
