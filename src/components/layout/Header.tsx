import { Suspense } from 'react'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import { SlimTopNav } from '@/components/layout/SlimTopNav'
import { DesktopTopNav } from '@/components/layout/DesktopTopNav'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { Watch } from '@/lib/types'

/**
 * Header — thin Server Component delegator (Phase 14 D-23 / D-24).
 *
 * Resolves auth + profile + owned watches, then renders both nav surfaces
 * (mobile <768px and desktop ≥768px). Each surface CSS-hides itself at
 * the wrong breakpoint, so only one is visible at a time. The nav
 * components own the `<header>` element — this component does not
 * render one itself.
 *
 * NotificationBell is its own Suspense leaf (Pitfall A-1/B-1). The `bell`
 * element is constructed exactly ONCE and handed by reference to both
 * surfaces so the downstream `cacheTag(..., viewer:${viewerId})` keys a
 * single cache entry per render pass (RESEARCH §P-06).
 */
export async function Header() {
  let user: { id: string; email: string } | null = null
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
    // unauth is the expected case on /login, /signup, etc.
  }

  let username: string | null = null
  let ownedWatches: Watch[] = []
  if (user) {
    try {
      const [profile, watches] = await Promise.all([
        getProfileById(user.id),
        getWatchesByUser(user.id),
      ])
      username = profile?.username ?? null
      ownedWatches = watches.filter((w) => w.status === 'owned')
    } catch (err) {
      console.error('[Header] failed to resolve user data:', err)
    }
  }

  // CRITICAL (RESEARCH §P-06): single element, passed by reference to both
  // nav surfaces. Constructing two separate <NotificationBell> elements
  // would double the cacheTag entries. Do not "simplify" this block.
  const bell = user ? (
    <Suspense fallback={null}>
      <NotificationBell viewerId={user.id} />
    </Suspense>
  ) : null

  return (
    <>
      <SlimTopNav hasUser={!!user} bell={bell} />
      <DesktopTopNav
        user={user}
        username={username}
        ownedWatches={ownedWatches}
        bell={bell}
      />
    </>
  )
}
