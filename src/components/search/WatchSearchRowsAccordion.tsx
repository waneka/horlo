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

  const openId = openValues[0] ?? null

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
            <Accordion.Panel className="px-2 pt-2 pb-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150">
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
