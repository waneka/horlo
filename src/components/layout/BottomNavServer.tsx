import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { BottomNav } from '@/components/layout/BottomNav'
import type { Watch } from '@/lib/types'

/**
 * Server Component container for BottomNav (Phase 14 NAV-01..05).
 *
 * Resolves viewer identity + username + owned watches server-side and hands
 * the resolved data to the client `BottomNav`. Kept in its own Suspense leaf
 * (Pitfall A-1) in `src/app/layout.tsx` so the client `usePathname()` read
 * does not block the static shell under `cacheComponents: true`.
 *
 * Auth semantics:
 *   - `UnauthorizedError` from `getCurrentUser()` resolves to `null` render
 *     (BottomNav is auth-gated). Any other error rethrows.
 *   - Profile / owned-watches fetch failures log and fall back to rendering
 *     an empty-watch BottomNav so unauthenticated-looking state never leaks.
 *
 * Ownership: only `status='owned'` watches are passed to NavWearButton —
 * the picker itself also filters, but pre-filtering here keeps the client
 * payload small on routes with 100+ owned-or-sold rows.
 */
export async function BottomNavServer() {
  let user: { id: string; email: string } | null = null
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  if (!user) return null

  let username: string | null = null
  let ownedWatches: Watch[] = []
  try {
    const [profile, watches] = await Promise.all([
      getProfileById(user.id),
      getWatchesByUser(user.id),
    ])
    username = profile?.username ?? null
    ownedWatches = watches.filter((w) => w.status === 'owned')
  } catch (err) {
    console.error('[BottomNavServer] failed to resolve user data:', err)
  }

  return <BottomNav username={username} ownedWatches={ownedWatches} />
}
