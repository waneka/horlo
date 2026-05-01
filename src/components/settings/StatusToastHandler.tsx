'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Phase 22 D-13 / D-14 — Status toast handler.
 *
 * Reads `?status=` from useSearchParams and fires a one-shot Sonner toast,
 * then strips the status param while preserving window.location.hash.
 *
 * D-14 footgun: naive `router.replace(pathname)` drops the `#account` fragment
 * and kicks the user back to the default tab. We always reconstruct
 * `pathname + queryString + hash` to keep the active tab.
 *
 * Strict-Mode guard via ref so the toast doesn't fire twice on dev double-mount
 * (FG-5 from 22-UI-SPEC.md).
 *
 * MUST be wrapped in <Suspense fallback={null}> by the parent (Pitfall 3 —
 * Next.js 16 non-PPR bails prerender on useSearchParams without Suspense).
 */
export function StatusToastHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    const status = searchParams.get('status')
    if (!status) return

    if (status === 'email_changed') {
      toast.success('Email changed successfully')
    } else {
      // Unknown status — no toast, no strip. Future phases extend the map here.
      return
    }

    fired.current = true

    // D-14: preserve hash through the strip. Naive router.replace(pathname)
    // would drop #account and break the active tab.
    const newSearch = new URLSearchParams(searchParams)
    newSearch.delete('status')
    const queryStr = newSearch.toString()
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const target = `${pathname}${queryStr ? `?${queryStr}` : ''}${hash}`
    router.replace(target, { scroll: false })
  }, [searchParams, pathname, router])

  return null
}
