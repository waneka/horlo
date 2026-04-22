'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * WYWT viewed-state hook (CONTEXT.md W-06, RESEARCH.md Pitfall 4).
 *
 * Stores the set of wearEventIds the viewer has opened in the WYWT overlay,
 * backing them with localStorage. The value is a localStorage-only signal —
 * viewed state is a visual nudge, not load-bearing — so there is no DB write
 * and no cross-device sync.
 *
 * SSR safety: on first render `hydrated` is `false` and `viewed` is an empty
 * Set. The `useEffect` on mount reads localStorage and flips `hydrated` to
 * true. Callers MUST gate visual viewed/unviewed state on `hydrated` to avoid
 * React hydration mismatches (server says "unviewed ring"; client says
 * "viewed ring"). Recommended usage:
 *
 *   const { viewed, markViewed, hydrated } = useViewedWears()
 *   const isViewed = hydrated && viewed.has(wearEventId)
 *   const ringClass = isViewed ? 'ring-1 ring-muted-foreground/40' : 'ring-2 ring-ring'
 *
 * Cap: MAX_ENTRIES = 200. When the cap is exceeded the oldest insertions
 * (iteration order) are evicted. 200 entries ~= 200 wear events ~= the
 * maximum a single viewer could realistically accumulate across any 48h
 * window, so the cap never bites in practice.
 */

const STORAGE_KEY = 'horlo:wywt:viewed:v1'
const MAX_ENTRIES = 200

export function useViewedWears() {
  const [viewed, setViewed] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          // Only accept an array of strings; anything else is treated as
          // malformed and ignored.
          const filtered = (parsed as unknown[]).filter(
            (v): v is string => typeof v === 'string',
          )
          setViewed(new Set(filtered))
        }
      }
    } catch {
      // Malformed JSON, SecurityError (Safari private mode), or missing DOM
      // storage — hydrate empty rather than crash. The viewed-state signal
      // degrades gracefully.
    }
    setHydrated(true)
  }, [])

  const markViewed = useCallback((id: string) => {
    setViewed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      // Cap size — drop oldest insertions (Set iteration order is insertion
      // order) until we're at/under the cap.
      while (next.size > MAX_ENTRIES) {
        const iter = next.values()
        const oldest = iter.next().value
        if (oldest === undefined) break
        next.delete(oldest)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Storage quota, permissions, or no-op storage (private mode) — state
        // still updates in-memory so the current session works; next reload
        // starts fresh.
      }
      return next
    })
  }, [])

  return { viewed, markViewed, hydrated }
}
