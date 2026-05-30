'use client'

/**
 * Phase 69 Plan 05 — SearchEntry
 *
 * Pure-presenter typeahead over watches_catalog built on @base-ui/react/combobox 1.3.0.
 * Ships DORMANT — Phase 70 mounts this inside AddWatchFlow, replacing the
 * `idle` and `paste-error` FlowState branches.
 *
 * Contract (props in, callbacks out):
 *   - onPick(result) — full SearchCatalogWatchResult row on pick (D-03)
 *   - onSubmitStructured(result, catalogId, photoBlob?) — bubbled up from the
 *     inline StructuredEntryPanel (Phase 70 gap plan 06 widens the photoBlob arg)
 *   - onSwitchToUrl() — EXTR-07 escape hatch, bubbled up from StructuredEntryPanel
 *   - No internal navigation; no router-push surface (pure presenter per Phase 68 precedent)
 *
 * Decisions encoded (see 69-CONTEXT.md):
 *   D-01 — @base-ui/react/combobox 1.3.0 primitive; Combobox.Root + Input +
 *          Positioner + Popup + List + Item slot composition; NO Combobox.Empty
 *          (empty state renders OUTSIDE the popup per D-05)
 *   D-02 — Controlled query (parent state, debounced) + uncontrolled
 *          selection/open state; onValueChange fires onPick(picked)
 *   D-04 — 250ms setTimeout debounce + per-effect AbortController stale-result
 *          guard, mirroring useSearchState.ts:130-133 + :228-253 byte-for-byte
 *   D-05 — Empty-state (query.length ≥ 3 && results.length === 0) closes the
 *          popup via `open={false}` and mounts StructuredEntryPanel INLINE
 *          below the input in normal document flow
 *   D-10 — Query input stays visible above the panel; manual showPanel sticks;
 *          empty-state auto-expand resets when results return
 *   D-11 — SearchEntry owns StructuredEntryPanel as its no-match child;
 *          onSubmitStructured + onSwitchToUrl are pass-through
 *   D-12 — parseSearchQuery(query, catalogBrands) pre-seeds the panel's
 *          initialBrand/Model/Reference (SRCH-26)
 *   D-14 — ONE inline-expand mechanism, TWO entry points: SRCH-24 footer
 *          ("Not finding it? Add manually") when results > 0 AND empty-state
 *          auto-expand when results === 0 && query.length ≥ 3
 *   SRCH-19 — viewerState pill copy is "In collection" / "On wishlist" per
 *             UI-SPEC (spec wins over WatchSearchRow's "Owned"/"Wishlist")
 *   SRCH-22 — HighlightedText XSS-safe substring highlighter wraps brand+model
 *             and reference (matches WatchSearchRow.tsx:49-54 precedent)
 *   SRCH-23 — Owners count format "{n} collectors"; "0 collectors" literal on
 *             zero (no special "Be the first" copy)
 *
 * Memory guardrails:
 *   - font-semibold (NOT font-medium) on result-row primary text per
 *     WatchSearchRow.tsx:48 precedent and the no-raw-palette guardrail
 *     recurrence at Phase 65/68 (project_phase_68_complete memory)
 *   - jsdom default test environment — no @vitest-environment node pragma
 *     (project_vitest_static_node_env: behavioral tests, no fs-walking guards)
 */

import { useEffect, useState } from 'react'
import { Search, Watch as WatchIcon, Loader2 } from 'lucide-react'
import { Combobox } from '@base-ui/react/combobox'
import Image from 'next/image'

import { HighlightedText } from '@/components/search/HighlightedText'
import { StructuredEntryPanel } from '@/components/watch/StructuredEntryPanel'
import { useCatalogSearchCache } from '@/components/watch/useCatalogSearchCache'
import { searchCatalogForAddFlow } from '@/app/actions/search'
import { parseSearchQuery } from '@/lib/searchEntry/parseSearchQuery'
import type { SearchCatalogWatchResult } from '@/lib/searchTypes'
import type { ExtractedWatchData } from '@/lib/extractors/types'

export interface SearchEntryProps {
  /** D-07 — viewer id prop-drilled from AddWatchFlow → useCatalogSearchCache. */
  viewerUserId: string
  /** D-13 — SSR-fetched catalog brand list, prop-drilled to parseSearchQuery. */
  catalogBrands: string[]
  /** D-03 — emits FULL SearchCatalogWatchResult upward; Phase 70 owns DUPE branching. */
  onPick: (result: SearchCatalogWatchResult) => void
  /** D-11 — bubbled up from the inline StructuredEntryPanel on extract success.
   *  Phase 70 Wave 0 widens the contract to include `catalogId` as the second
   *  arg so the orchestrator can do the DUPE lookup + addWatch in one round-trip
   *  (RESEARCH §1, Pitfall #1). null when the catalog upsert failed.
   *  Phase 70 gap plan 06 widens to (result, catalogId, photoBlob?) so the
   *  orchestrator can call uploadCatalogSourcePhoto before addWatch.
   *  SearchEntry is a pure pass-through — does not consume photoBlob itself
   *  (the identity-stable callback at the JSX site below preserves all args). */
  onSubmitStructured: (
    result: ExtractedWatchData,
    catalogId: string | null,
    photoBlob?: Blob | null,
  ) => void
  /** EXTR-07 — bubbled up from the inline StructuredEntryPanel's URL backup link. */
  onSwitchToUrl: () => void
}

export function SearchEntry({
  viewerUserId,
  catalogBrands,
  onPick,
  onSubmitStructured,
  onSwitchToUrl,
}: SearchEntryProps) {
  // D-02 — controlled query input drives the debounced fetch + cache key.
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchCatalogWatchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // D-10 / D-14 — manual SRCH-24 footer click sticks even after results return;
  // auto-expand (forceClose, below) collapses when results re-populate.
  const [showPanel, setShowPanel] = useState(false)
  // D-05 — `open` is fully controlled (boolean, never `undefined`) to avoid
  // the base-ui "switching between controlled and uncontrolled" warning. The
  // popup opens when the user has typed enough to potentially see results and
  // closes when we either know the search is empty (force-close, mounts the
  // inline panel) or the input is empty.
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  // CLNP-07 cache hook — viewer-keyed; invalidates on user switch (Plan 02 + D-06).
  const cache = useCatalogSearchCache(viewerUserId)

  // D-05 — popup force-close + inline-mount trigger. Use the debounced query so
  // we don't flicker the panel open while the user is mid-keystroke (otherwise
  // the very first ≥3-char keystroke would mount the panel BEFORE the network
  // call could possibly return any results).
  const forceClose =
    debouncedQuery.trim().length >= 3 && !isLoading && results.length === 0
  const showStructuredPanel = showPanel || forceClose
  // D-12 — pre-seed parsed from the current query (NOT debouncedQuery) so the
  // panel mounted via SRCH-24 footer click reflects what the user actually
  // typed at the click moment.
  const seeded = showStructuredPanel
    ? parseSearchQuery(query, catalogBrands)
    : { brand: '', model: '', reference: '' }

  // Reset the manual SRCH-24 sticky open when the user clears the query. The
  // auto-expand (forceClose) handles its own collapse via the derived flag.
  useEffect(() => {
    if (query.trim().length === 0 && showPanel) {
      setShowPanel(false)
    }
  }, [query, showPanel])

  // D-05 — keep `isPopupOpen` derived from data state so the popup opens when
  // the user has typed enough to see results-or-loading and closes when the
  // empty-state force-close triggers the inline panel mount.
  useEffect(() => {
    if (forceClose) {
      setIsPopupOpen(false)
      return
    }
    const hasQueryFloor = debouncedQuery.trim().length >= 2
    const hasSurface = isLoading || results.length > 0
    setIsPopupOpen(hasQueryFloor && hasSurface)
  }, [forceClose, debouncedQuery, isLoading, results.length])

  // D-04 — 250ms debounce. Mirrors useSearchState.ts:130-133 byte-for-byte.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // D-04 — Server-Action fetch with per-effect AbortController stale-result
  // guard. Mirrors useSearchState.ts:228-253 byte-for-byte, adapted for
  // searchCatalogForAddFlow + the cache short-circuit BEFORE the network call.
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }
    // Symmetric normalization — matches the structured cache key axis 2 (D-18)
    // and aligns with the catalog DAL natural-key normalization
    // (project_local_catalog_natural_key_drift memory).
    const cacheKey = debouncedQuery.trim().toLowerCase()
    const cached = cache.get(cacheKey)
    if (cached) {
      setResults(cached)
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    void (async () => {
      try {
        const res = await searchCatalogForAddFlow({ q: debouncedQuery })
        if (controller.signal.aborted) return // stale-result guard
        if (res.success) {
          cache.set(cacheKey, res.data)
          setResults(res.data)
        } else {
          setResults([])
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
        setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()
    return () => controller.abort()
    // The cache returns a fresh `{ get, set }` object each render — including
    // it in the dep array would re-fire the effect on every keystroke. The
    // hook itself is keyed off `viewerUserId` which is stable across the
    // current AddWatchFlow lifetime, so omitting it here is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  return (
    <div className="space-y-6">
      {/* D-01 + D-02 — base-ui Combobox; controlled inputValue + uncontrolled
          selection. filter={null} + filteredItems disables base-ui's internal
          string-match (we are server-filtered already per useSearchState pattern). */}
      <Combobox.Root<SearchCatalogWatchResult>
        inputValue={query}
        onInputValueChange={(val, details) => {
          // D-02 — controlled query: ignore non-input-change reasons that
          // base-ui fires (e.g. `inputClear` on popup close after picking an
          // item, or `triggerPress`) — those would clobber the user's typed
          // query before the next render. Only honor literal keystrokes
          // (`inputChange`). The component owns the textual state; base-ui
          // owns the open/active-option lifecycle.
          if (details.reason !== 'input-change') return
          setQuery(val)
        }}
        filteredItems={results}
        filter={null}
        itemToStringLabel={(r) => `${r.brand} ${r.model}`}
        itemToStringValue={(r) => r.catalogId}
        isItemEqualToValue={(a, b) => a.catalogId === b.catalogId}
        onValueChange={(picked) => {
          if (picked) onPick(picked)
        }}
        // D-05 — `open` is fully controlled so the popup closes deterministically
        // when forceClose fires (empty-state inline panel mount) and reopens
        // when the user types again. base-ui's onOpenChange lets user dismiss
        // (e.g., Escape) and re-sync state.
        open={isPopupOpen}
        onOpenChange={(next) => setIsPopupOpen(next)}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Combobox.Input
            placeholder="Search by brand, model, or reference"
            aria-label="Search for a watch"
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start">
            <Combobox.Popup className="z-50 w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {isLoading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <Combobox.List className="max-h-[60vh] overflow-y-auto p-1">
                {results.map((r) => (
                  <Combobox.Item
                    key={r.catalogId}
                    value={r}
                    className="group flex items-center gap-4 min-w-0 rounded-md pl-2 pr-3 py-2 cursor-default data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    {/* Cover-photo circle — mirrors WatchSearchRow.tsx:34 byte-for-byte */}
                    <div className="relative size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center shrink-0">
                      {r.imageUrl ? (
                        <Image
                          src={r.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <WatchIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                    </div>

                    {/* Text block — font-semibold per WatchSearchRow.tsx:48 +
                        no-raw-palette guardrail (NOT font-medium). */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        <HighlightedText
                          text={`${r.brand} ${r.model}`}
                          q={query}
                        />
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.reference && (
                          <>
                            <HighlightedText text={r.reference} q={query} />
                            {' · '}
                          </>
                        )}
                        {r.ownersCount} collectors
                      </p>
                    </div>

                    {/* viewerState pill — SPEC TEXT wins over WatchSearchRow's
                        "Owned"/"Wishlist" copy (intentional divergence per
                        CONTEXT.md Discretion + UI-SPEC.md Copywriting Contract). */}
                    {r.viewerState === 'owned' && (
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                        In collection
                      </span>
                    )}
                    {r.viewerState === 'wishlist' && (
                      <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                        On wishlist
                      </span>
                    )}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            )}

            {/* SRCH-24 footer — D-14 entry point #1 (results > 0).
                SRCH-03: rendered as sibling of <Combobox.List> — listbox-internal
                placement swallowed clicks in real browsers (jsdom-tolerant but
                prod-broken). Placed OUTSIDE the listbox so native click semantics
                apply; same gate as the List so footer appears/disappears together
                with results. Handler preserved verbatim per D-09. */}
            {!isLoading && results.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPanel(true)}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
              >
                Not finding it? Add manually
              </button>
            )}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {/* D-05 / D-10 / D-11 — Inline panel mounts OUTSIDE the Combobox popup,
          in normal document flow below the input. D-14 entry point #2 (auto on
          empty state) and entry point #1 (footer click → showPanel=true) both
          land here with the same parseSearchQuery pre-seed. */}
      {showStructuredPanel && (
        <StructuredEntryPanel
          viewerUserId={viewerUserId}
          initialBrand={seeded.brand}
          initialModel={seeded.model}
          initialReference={seeded.reference}
          onSubmitStructured={onSubmitStructured}
          onSwitchToUrl={onSwitchToUrl}
        />
      )}
    </div>
  )
}
