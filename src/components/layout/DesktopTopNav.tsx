'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isPublicPath } from '@/lib/constants/public-paths'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { UserMenu } from '@/components/layout/UserMenu'
import type { Watch } from '@/lib/types'

interface DesktopTopNavProps {
  user: { id: string; email: string } | null
  username: string | null
  ownedWatches: Watch[]
  /** Pre-resolved NotificationBell element (shared by reference with SlimTopNav). */
  bell: React.ReactNode
  /** Server-loaded avatar URL (Phase 25 NAV-13 — threaded through to UserMenu). */
  avatarUrl: string | null
}

/**
 * DesktopTopNav — desktop top chrome (≥768px) per CONTEXT.md D-16.
 *
 * Composition (left → right):
 *   Horlo wordmark · Explore link · persistent search input (D-24 muted fill +
 *   leading magnifier) · NavWearButton · Add icon · NotificationBell · UserMenu
 *
 * Phase 16 changes (D-23, D-24):
 *   - HeaderNav inline links removed (Profile + Settings now exclusively in
 *     UserMenu dropdown — Phase 14 D-17 made these redundant).
 *   - Search input restyled with muted-fill (bg-muted/50) + leading lucide
 *     Search icon + widened to max-w-md. handleSearchSubmit preserved.
 *
 * The theme toggle is intentionally absent — D-16 relocates it into
 * UserMenu's InlineThemeSegmented row (delivered by Plan 14-05).
 *
 * Gated by `isPublicPath(pathname)` — returns null on auth routes to prevent
 * chrome leak (T-14-04-01).
 */
export function DesktopTopNav({
  user,
  username,
  ownedWatches,
  bell,
  avatarUrl,
}: DesktopTopNavProps) {
  const pathname = usePathname() ?? ''
  if (isPublicPath(pathname)) return null

  // Search input routes to /search on submit. Phase 14 stub — /search is a
  // coming-soon page; Phase 16 rewires real search (SRCH-04).
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = String(fd.get('q') ?? '').trim()
    if (!q) {
      window.location.href = '/search'
      return
    }
    window.location.href = `/search?q=${encodeURIComponent(q)}`
  }

  return (
    <header className="sticky top-0 z-50 hidden w-full border-b border-border bg-background/80 backdrop-blur md:block">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl">Horlo</span>
          </Link>
          <Link
            href="/explore"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Explore
          </Link>
        </div>
        <form onSubmit={handleSearchSubmit} className="max-w-md flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name="q"
              placeholder="Search collectors, watches…"
              aria-label="Search"
              className="w-full bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background"
            />
          </div>
        </form>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <NavWearButton ownedWatches={ownedWatches} viewerId={user.id} />
              <Link
                href={`/watch/new?returnTo=${encodeURIComponent(pathname || '/')}`}
                aria-label="Add watch"
              >
                <Button variant="ghost" size="icon">
                  <Plus className="h-5 w-5" aria-hidden />
                </Button>
              </Link>
              {bell}
            </>
          )}
          <UserMenu user={user} username={username} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  )
}
