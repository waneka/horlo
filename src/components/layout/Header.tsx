import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { MobileNav } from '@/components/layout/MobileNav'
import { HeaderNav } from '@/components/layout/HeaderNav'
import { UserMenu } from '@/components/layout/UserMenu'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import type { Watch } from '@/lib/types'

export async function Header() {
  let user: { id: string; email: string } | null = null
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
    // unauth is the expected case on /login, /signup, etc.
  }

  // Look up the viewer's username so HeaderNav can render the Profile link,
  // and resolve owned watches so the NavWearButton can open the shared picker
  // (CONTEXT.md N-01 — two triggers, one dialog). Falls back to defaults on
  // any error so the header still renders with the rest of the nav even if a
  // transient DB blip occurs.
  let username: string | null = null
  let ownedWatches: Watch[] = []
  if (user) {
    try {
      const [profile, watches] = await Promise.all([
        getProfileById(user.id),
        getWatchesByUser(user.id),
      ])
      username = profile?.username ?? null
      // WatchPickerDialog itself filters to status='owned', but we do it here
      // too so the prop carried across the component boundary is minimal.
      ownedWatches = watches.filter((w) => w.status === 'owned')
    } catch (err) {
      console.error('[Header] failed to resolve user data:', err)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 md:gap-8">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl">Horlo</span>
          </Link>
          <HeaderNav username={username} />
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          {user && (
            <>
              <NavWearButton ownedWatches={ownedWatches} />
              <Link href="/watch/new">
                <Button>Add Watch</Button>
              </Link>
            </>
          )}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
