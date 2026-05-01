'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Phase 22 D-13 / D-14 / D-16 — Status toast handler.
 *
 * Reads `?status=` from the URL fragment (hash-internal querystring per D-16:
 * `/settings#account?status=email_changed`) and fires a one-shot Sonner toast,
 * then strips the status param while preserving the active tab in the hash.
 *
 * D-16 footgun: the SET-06 callback redirect places `?status=` INSIDE the hash
 * (not in `location.search`), so `useSearchParams()` cannot see it — the React
 * SearchParams context is populated from `location.search` only. We must parse
 * the hash directly: `hash.slice(1).split('?', 2)` then `URLSearchParams(query)`.
 *
 * D-14 footgun: naive `router.replace(pathname)` drops the `#account` fragment
 * and kicks the user back to the default tab. We always reconstruct
 * `pathname + #tab` (preserving the tab portion) when stripping `status`.
 *
 * Strict-Mode guard via ref so the toast doesn't fire twice on dev double-mount
 * (FG-5 from 22-UI-SPEC.md).
 */
export function StatusToastHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const fired = useRef(false)
  const [hash, setHash] = useState('')

  useEffect(() => {
    setHash(window.location.hash)
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (fired.current || !hash) return
    const [tab, query] = hash.slice(1).split('?', 2)
    const params = new URLSearchParams(query ?? '')
    const status = params.get('status')
    if (!status) return

    if (status === 'email_changed') {
      toast.success('Email changed successfully')
    } else {
      // Unknown status — no toast, no strip. Future phases extend the map here.
      return
    }

    fired.current = true

    // D-14: preserve the tab portion of the hash through the strip. Naive
    // router.replace(pathname) would drop #account and break the active tab.
    params.delete('status')
    const remainder = params.toString()
    const newHash = remainder ? `#${tab}?${remainder}` : `#${tab}`
    router.replace(`${pathname}${newHash}`, { scroll: false })
  }, [hash, pathname, router])

  return null
}
