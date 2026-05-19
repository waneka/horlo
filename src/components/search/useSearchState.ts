'use client'

import { useEffect, useRef, useState } from 'react'
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
  // Phase 40 SRCH-16 facet state (D-03/D-04) — URL-synced, Watches-only consumers.
  movement: string | null
  setMovement: (v: string | null) => void
  size: string | null
  setSize: (v: string | null) => void
  styleArr: string[]
  setStyleArr: (v: string[]) => void
  // Phase 46 D-12: brand/era/genre/archetype facets for Explore deep-links.
  brand: string | null
  setBrand: (v: string | null) => void
  era: string | null
  setEra: (v: string | null) => void
  genre: string | null
  setGenre: (v: string | null) => void
  archetype: string | null
  setArchetype: (v: string | null) => void
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

  // Phase 40 SRCH-16 facet state — initialized from URL on mount (D-03/D-04 round-trip).
  // Written to URL unconditionally (D-04 — survive tab switches); Watches sub-effect is the only consumer.
  const [movement, setMovement] = useState<string | null>(
    searchParams.get('movement') ?? null
  )
  const [size, setSize] = useState<string | null>(
    searchParams.get('size') ?? null
  )
  const [styleArr, setStyleArr] = useState<string[]>(
    searchParams.get('style')?.split(',').filter(Boolean) ?? []
  )

  // Phase 46 D-12: brand/era/genre/archetype facet state — initialized from URL params.
  const [brand, setBrand] = useState<string | null>(searchParams.get('brand') ?? null)
  const [era, setEra] = useState<string | null>(searchParams.get('era') ?? null)
  const [genre, setGenre] = useState<string | null>(searchParams.get('genre') ?? null)
  const [archetype, setArchetype] = useState<string | null>(searchParams.get('archetype') ?? null)

  // Last URL emitted to router.replace() — used by the URL-sync effect to skip
  // re-emitting a URL it has already pushed (infinite-loop guard, see effect 2).
  const lastReplacedUrl = useRef<string | null>(null)

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

  // 1a. URL→state reconciliation (Phase 46 G5 fix — Fault 1).
  //     App Router soft nav does NOT remount /search, so useState initializers
  //     only seed from URL at first mount. This effect watches `searchParams`
  //     (which is a new object reference per navigation in App Router) and
  //     copies facet values into state whenever the URL value differs — making
  //     URL the true source of truth for facets on every navigation.
  useEffect(() => {
    const urlMovement = searchParams.get('movement') ?? null
    const urlSize = searchParams.get('size') ?? null
    const urlStyleArr = searchParams.get('style')?.split(',').filter(Boolean) ?? []
    const urlBrand = searchParams.get('brand') ?? null
    const urlEra = searchParams.get('era') ?? null
    const urlGenre = searchParams.get('genre') ?? null
    const urlArchetype = searchParams.get('archetype') ?? null

    if (urlMovement !== movement) setMovement(urlMovement)
    if (urlSize !== size) setSize(urlSize)
    if (urlStyleArr.join(',') !== styleArr.join(',')) setStyleArr(urlStyleArr)
    if (urlBrand !== brand) setBrand(urlBrand)
    if (urlEra !== era) setEra(urlEra)
    if (urlGenre !== genre) setGenre(urlGenre)
    if (urlArchetype !== archetype) setArchetype(urlArchetype)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // keyed on searchParams: fires when App Router hands a new object per navigation

  // 2. URL sync (D-04 router.replace, scroll: false; D-12 omit tab=all — Phase 16
  //    carry-forward). Phase 40: facet params written unconditionally (D-04 — survive
  //    tab switches so user can navigate Watches → People → Watches and keep filters).
  //    Phase 46 G5 fix — Fault 2: searchParams added to dep array so this effect
  //    re-runs after a soft nav, and a no-op guard prevents clobbering a freshly-arrived
  //    param before the reconciliation effect (1a) has settled state into the new value.
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim().length >= CLIENT_MIN_CHARS) params.set('q', debouncedQ)
    if (tab !== 'all') params.set('tab', tab)
    // Phase 40 D-04 — facet params unconditional: survive tab switches
    if (movement) params.set('movement', movement)
    if (size) params.set('size', size)
    if (styleArr.length > 0) params.set('style', styleArr.join(','))
    // Phase 46 D-12: new facet params unconditional
    if (brand) params.set('brand', brand)
    if (era) params.set('era', era)
    if (genre) params.set('genre', genre)
    if (archetype) params.set('archetype', archetype)

    // Fault 2 guard: don't strip a facet param that arrived via soft nav but
    // hasn't settled into in-memory state yet (reconciliation runs in the same
    // commit but setState is async — state updates on the next render). If
    // searchParams has a facet key that the built URL omits, skip the replace;
    // the reconciliation effect (1a) will setX(urlValue) → trigger another
    // render → this effect re-runs with the correct state and emits the right
    // URL. Scoped to the facet keys effect 1a actually reconciles — `q` and
    // `tab` are deliberately excluded: 1a never reconciles them, so guarding
    // them would skip the replace permanently when the user clears the search
    // box (q omitted) or returns to the All tab (tab omitted).
    const RECONCILED_FACET_PARAMS = ['movement', 'size', 'style', 'brand', 'era', 'genre', 'archetype']
    const wouldStripIncoming = RECONCILED_FACET_PARAMS.some(
      (key) => searchParams.get(key) !== null && !params.has(key),
    )
    if (wouldStripIncoming) return

    const qs = params.toString()
    const nextUrl = qs ? `/search?${qs}` : '/search'

    // Infinite-loop guard. `searchParams` is in this effect's dep array
    // (Fault 2), but App Router hands back a NEW searchParams object identity
    // after every router.replace() — even a replace to an identical URL. That
    // re-fires this effect; without this guard it would replace → re-fire →
    // replace forever. Skip when the URL we would emit equals the one we last
    // emitted ourselves. (A ref, not a searchParams comparison: it must not
    // depend on how soon App Router reflects the replace back into the hook.)
    if (nextUrl === lastReplacedUrl.current) return
    lastReplacedUrl.current = nextUrl

    router.replace(nextUrl, { scroll: false })
  }, [debouncedQ, tab, movement, size, styleArr, brand, era, genre, archetype, router, searchParams])

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
  // Phase 40 D-01/D-02: facet changes trigger instant fetch (no debounce path);
  // the existing AbortController abort-and-restart wiring covers facet dep changes
  // automatically — no new controller needed (RESEARCH Q3 confirmed).
  useEffect(() => {
    const isActive = tab === 'all' || tab === 'watches'
    if (!isActive) {
      setWatchesResults([])
      setWatchesIsLoading(false)
      setWatchesHasError(false)
      return
    }
    // Phase 40 D-01 — browse mode: facets fire fetches even with empty/short q.
    // Guard lifted when at least one facet is active (hasActiveFacet === true).
    // Phase 46 D-11: extend to include brand/era/genre/archetype facets.
    const hasActiveFacet = !!(movement || size || styleArr.length || brand || era || genre || archetype)
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS && !hasActiveFacet) {
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
        const res = await searchWatchesAction({
          q: debouncedQ,
          movement: movement ?? undefined,
          size: size ?? undefined,
          // Phase 40 D-03: styleArr is joined to comma string; DAL splits back to string[]
          style: styleArr.length > 0 ? styleArr.join(',') : undefined,
          // Phase 46 D-12: new facets passed to the search action.
          brand:     brand     ?? undefined,
          era:       era       ?? undefined,
          genre:     genre     ?? undefined,
          archetype: archetype ?? undefined,
        })
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
  }, [debouncedQ, tab, movement, size, styleArr, brand, era, genre, archetype])

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
    // Phase 40 SRCH-16 facet state + setters (D-03/D-04).
    // 40-05 FilterSheet + chip groups consume these; URL is the single source of truth.
    movement,
    setMovement,
    size,
    setSize,
    styleArr,
    setStyleArr,
    // Phase 46 D-12: brand/era/genre/archetype facet state + setters.
    brand,
    setBrand,
    era,
    setEra,
    genre,
    setGenre,
    archetype,
    setArchetype,
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
