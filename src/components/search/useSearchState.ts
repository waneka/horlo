'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { searchPeopleAction } from '@/app/actions/search'
import type { SearchProfileResult, SearchTab } from '@/lib/searchTypes'

const DEBOUNCE_MS = 250          // D-03
const CLIENT_MIN_CHARS = 2       // D-03 client-side defense (DAL also gates per D-20)

export interface UseSearchState {
  q: string
  setQ: (next: string) => void
  debouncedQ: string
  tab: SearchTab
  setTab: (next: SearchTab) => void
  results: SearchProfileResult[]
  isLoading: boolean
  hasError: boolean
}

/**
 * Phase 16 People Search — single source of truth for the q ↔ URL ↔ fetch
 * trifecta (D-28). Owns:
 *
 *   - q (current input, immediate)
 *   - debouncedQ (250ms-debounced derivation)
 *   - tab (SearchTab; defaults to 'all', omitted from URL when active per D-12)
 *   - URL sync via router.replace({ scroll: false }) (D-04 — single history entry)
 *   - Fetch effect with AbortController + cleanup (D-03 — stale-cancel)
 *   - Tab gate: only 'all' and 'people' fire searchPeopleAction (SRCH-02)
 *   - 2-char client minimum (D-20 server-side is the authoritative gate)
 *
 * Cleanup ordering: when q changes, the debounce timer cleanup runs FIRST
 * (clearing the pending timer), then on the next debouncedQ change the fetch
 * effect cleanup aborts the prior controller. This ordering keeps stale fetches
 * out of the UI without flicker.
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
  const [results, setResults] = useState<SearchProfileResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  // 1. Debounce q → debouncedQ (D-03 250ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  // 2. URL sync (D-04 router.replace, scroll: false; D-12 omit tab=all)
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim().length >= CLIENT_MIN_CHARS) params.set('q', debouncedQ)
    if (tab !== 'all') params.set('tab', tab)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
  }, [debouncedQ, tab, router])

  // 3. Fetch effect with AbortController (D-03 / SRCH-02 tab gate)
  useEffect(() => {
    // Tab gate: only People + All fire (SRCH-02 — Watches/Collections render coming-soon only)
    if (tab !== 'all' && tab !== 'people') {
      setResults([])
      setIsLoading(false)
      setHasError(false)
      return
    }
    // 2-char client minimum (D-20 server-side is authoritative)
    if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
      setResults([])
      setIsLoading(false)
      setHasError(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setHasError(false)

    void (async () => {
      try {
        const result = await searchPeopleAction({ q: debouncedQ })
        if (controller.signal.aborted) return  // Pitfall 2 stale-result guard
        if (!result.success) {
          setHasError(true)
          setResults([])
        } else {
          setResults(result.data)
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        if (controller.signal.aborted) return
        setHasError(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [debouncedQ, tab])

  const setTab = (next: SearchTab) => setTabState(next)

  return { q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError }
}
