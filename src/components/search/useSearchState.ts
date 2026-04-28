'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  searchPeopleAction,
  searchWatchesAction,
  searchCollectionsAction,
} from '@/app/actions/search'
import type {
  SearchProfileResult,
  SearchCatalogWatchResult,
  SearchCollectionResult,
  SearchTab,
} from '@/lib/searchTypes'

const DEBOUNCE_MS = 250          // D-03
const CLIENT_MIN_CHARS = 2       // D-03 client-side defense (DAL also gates per D-20)
const ALL_TAB_SECTION_CAP = 5    // SRCH-13 / D-13 — each All-tab section capped at 5

export interface UseSearchState {
  q: string
  setQ: (next: string) => void
  debouncedQ: string
  tab: SearchTab
  setTab: (next: SearchTab) => void
  peopleResults: SearchProfileResult[]
  watchesResults: SearchCatalogWatchResult[]
  collectionsResults: SearchCollectionResult[]
  peopleIsLoading: boolean
  watchesIsLoading: boolean
  collectionsIsLoading: boolean
  peopleHasError: boolean
  watchesHasError: boolean
  collectionsHasError: boolean
  // Phase 16 backward-compat aliases — Plan 06 will remove these when it
  // rewrites SearchPageClient to consume the per-tab slices directly.
  results: SearchProfileResult[]
  isLoading: boolean
  hasError: boolean
}

/**
 * Phase 19 extended search hook — three independent sub-effects per RESEARCH.md
 * Q4 path A recommendation.
 *
 *   - Debounce + URL sync + 2-char minimum carry forward unchanged from Phase 16.
 *   - Pitfall 9 fix: the old Phase 16 tab-gate early-return that bailed out
 *     when neither All nor People was active is gone. Watches and Collections
 *     sub-effects each fire when their tab is active OR when tab === 'all'.
 *   - SRCH-14: each sub-effect has its own AbortController. On `[debouncedQ, tab]`
 *     change, React's useEffect cleanup fires `controller.abort()` for each
 *     section that is leaving its active set.
 *   - D-13 / SRCH-13: All tab caps each section at 5 results inside the hook.
 *     Per-tab views return up to the DAL's full 20.
 *   - D-15 / per-section paint independence: each section's loading flag flips
 *     independently as its own fetch resolves. Fast sections paint immediately;
 *     slow sections continue to render their skeleton.
 *
 * Per-tab slices keep error/loading state isolated — one section's error does
 * not zero out the others' results.
 *
 * AbortController on Server Actions (Assumption A1 in RESEARCH.md): the browser
 * fetch transport honors abort; server-side execution may continue but the
 * response is dropped. The `signal.aborted` check after each `await` ensures
 * stale results never land in component state.
 */
export function useSearchState(): UseSearchState {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('tab') as SearchTab | null) ?? 'all'

  const [q, setQ] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [tab, setTabState] = useState<SearchTab>(initialTab)

  const [peopleResults, setPeopleResults] = useState<SearchProfileResult[]>([])
  const [watchesResults, setWatchesResults] = useState<SearchCatalogWatchResult[]>([])
  const [collectionsResults, setCollectionsResults] = useState<SearchCollectionResult[]>([])

  const [peopleIsLoading, setPeopleIsLoading] = useState(false)
  const [watchesIsLoading, setWatchesIsLoading] = useState(false)
  const [collectionsIsLoading, setCollectionsIsLoading] = useState(false)

  const [peopleHasError, setPeopleHasError] = useState(false)
  const [watchesHasError, setWatchesHasError] = useState(false)
  const [collectionsHasError, setCollectionsHasError] = useState(false)

  // 1. Debounce q → debouncedQ (D-03 250ms — Phase 16 carry-forward, byte-identical).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  // 2. URL sync (D-04 router.replace, scroll: false; D-12 omit tab=all — Phase 16
  //    carry-forward, byte-identical).
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim().length >= CLIENT_MIN_CHARS) params.set('q', debouncedQ)
    if (tab !== 'all') params.set('tab', tab)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
  }, [debouncedQ, tab, router])

  // 3a. People sub-effect — fires when tab === 'all' || tab === 'people'.
  useEffect(() => {
    const isActive = tab === 'all' || tab === 'people'
    if (!isActive) {
      setPeopleResults([])
      setPeopleIsLoading(false)
      setPeopleHasError(false)
      return
    }
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
      setPeopleResults([])
      setPeopleIsLoading(false)
      setPeopleHasError(false)
      return
    }

    const controller = new AbortController()
    setPeopleIsLoading(true)
    setPeopleHasError(false)

    void (async () => {
      try {
        const res = await searchPeopleAction({ q: debouncedQ })
        if (controller.signal.aborted) return // Pitfall 3 stale-result guard
        if (res.success) {
          setPeopleResults(
            tab === 'all' ? res.data.slice(0, ALL_TAB_SECTION_CAP) : res.data,
          )
        } else {
          setPeopleHasError(true)
          setPeopleResults([])
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
        setPeopleHasError(true)
      } finally {
        if (!controller.signal.aborted) setPeopleIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debouncedQ, tab])

  // 3b. Watches sub-effect — fires when tab === 'all' || tab === 'watches'.
  useEffect(() => {
    const isActive = tab === 'all' || tab === 'watches'
    if (!isActive) {
      setWatchesResults([])
      setWatchesIsLoading(false)
      setWatchesHasError(false)
      return
    }
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
      setWatchesResults([])
      setWatchesIsLoading(false)
      setWatchesHasError(false)
      return
    }

    const controller = new AbortController()
    setWatchesIsLoading(true)
    setWatchesHasError(false)

    void (async () => {
      try {
        const res = await searchWatchesAction({ q: debouncedQ })
        if (controller.signal.aborted) return // Pitfall 3 stale-result guard
        if (res.success) {
          setWatchesResults(
            tab === 'all' ? res.data.slice(0, ALL_TAB_SECTION_CAP) : res.data,
          )
        } else {
          setWatchesHasError(true)
          setWatchesResults([])
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
        setWatchesHasError(true)
      } finally {
        if (!controller.signal.aborted) setWatchesIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debouncedQ, tab])

  // 3c. Collections sub-effect — fires when tab === 'all' || tab === 'collections'.
  useEffect(() => {
    const isActive = tab === 'all' || tab === 'collections'
    if (!isActive) {
      setCollectionsResults([])
      setCollectionsIsLoading(false)
      setCollectionsHasError(false)
      return
    }
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
      setCollectionsResults([])
      setCollectionsIsLoading(false)
      setCollectionsHasError(false)
      return
    }

    const controller = new AbortController()
    setCollectionsIsLoading(true)
    setCollectionsHasError(false)

    void (async () => {
      try {
        const res = await searchCollectionsAction({ q: debouncedQ })
        if (controller.signal.aborted) return // Pitfall 3 stale-result guard
        if (res.success) {
          setCollectionsResults(
            tab === 'all' ? res.data.slice(0, ALL_TAB_SECTION_CAP) : res.data,
          )
        } else {
          setCollectionsHasError(true)
          setCollectionsResults([])
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
        setCollectionsHasError(true)
      } finally {
        if (!controller.signal.aborted) setCollectionsIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debouncedQ, tab])

  const setTab = (next: SearchTab) => setTabState(next)

  return {
    q,
    setQ,
    debouncedQ,
    tab,
    setTab,
    peopleResults,
    watchesResults,
    collectionsResults,
    peopleIsLoading,
    watchesIsLoading,
    collectionsIsLoading,
    peopleHasError,
    watchesHasError,
    collectionsHasError,
    // Phase 16 backward-compat aliases (Plan 06 removes these).
    results: peopleResults,
    isLoading: peopleIsLoading,
    hasError: peopleHasError,
  }
}
