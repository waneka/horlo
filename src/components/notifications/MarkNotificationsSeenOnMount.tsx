'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationsSeen } from '@/app/actions/notifications'

/**
 * MarkNotificationsSeenOnMount — fires the D-07 "visit clears bell dot" effect.
 *
 * Why this exists: in Next 16 Cache Components, revalidateTag() cannot be called
 * during a Server Component render (the runtime throws E7 — see
 * node_modules/next/dist/server/web/spec-extension/revalidate.js:113-119). The
 * original Plan 04 implementation put touchLastSeenAt + revalidateTag inline in
 * /notifications/page.tsx's render body, which tripped that guard on every visit.
 *
 * This tiny client component runs one-shot on mount, invokes the Server Action
 * markNotificationsSeen() (which does BOTH the DB touch and the tag invalidation
 * in a legal SA context), and renders nothing. The action runs exactly once per
 * mount — the `firedRef` guard protects against React 19 strict-mode double-invoke
 * in dev.
 *
 * UX contract: after the SA resolves, we call router.refresh() to force the
 * persistent root layout (which hosts Header → NotificationBell) to refetch its
 * RSC payload from the server. revalidateTag('viewer:x','max') alone only
 * invalidates the server-side cache entry — the client router keeps its cached
 * Header payload across soft navigations, so without router.refresh() the bell
 * dot would never clear on subsequent nav. This mirrors the Next 16 pattern
 * used by every other SA-triggered layout refresh in this codebase
 * (FollowButton:98, WatchDetail:87/96, login-form:33, etc.). D-07 / RESEARCH
 * Pitfall 6 — "visit clears bell dot" requires both server-side tag invalidation
 * AND a client-side refresh hint.
 */
export function MarkNotificationsSeenOnMount() {
  const firedRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    // Await the SA so router.refresh() fires AFTER the server has committed
    // touchLastSeenAt and invalidated `viewer:${user.id}`. If we refreshed
    // before the SA resolved, the refetch could race ahead of the commit and
    // re-read a still-fresh cache entry, leaving the dot stuck.
    ;(async () => {
      try {
        await markNotificationsSeen()
      } catch (err) {
        // Server Action surfaced as thrown error (e.g. network drop mid-dispatch).
        // Log but do not propagate — there's no UI to reconcile here and a
        // failed mark-seen is non-fatal (the 30s cacheLife revalidate will catch
        // up eventually, and the user can retry by navigating back).
        console.error('[MarkNotificationsSeenOnMount] markNotificationsSeen failed:', err)
        return
      }
      router.refresh()
    })()
  }, [router])

  return null
}
