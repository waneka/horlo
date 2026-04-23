'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isPublicPath } from '@/lib/constants/public-paths'
import { HeaderNav } from '@/components/layout/HeaderNav'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { UserMenu } from '@/components/layout/UserMenu'
import type { Watch } from '@/lib/types'

interface DesktopTopNavProps {
  user: { id: string; email: string } | null
  username: string | null
  ownedWatches: Watch[]
  /** Pre-resolved NotificationBell element (shared by reference with SlimTopNav). */
  bell: React.ReactNode
}

/**
 * DesktopTopNav — desktop top chrome (≥768px) per CONTEXT.md D-16.
 *
 * Composition (left → right):
 *   Horlo wordmark · HeaderNav (Collection + dynamic Profile/Settings) ·
 *   Explore link · persistent search input · NavWearButton · Add icon ·
 *   NotificationBell · UserMenu (D-17 dropdown)
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
          <HeaderNav username={username} />
          <Link
            href="/explore"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Explore
          </Link>
        </div>
        <form onSubmit={handleSearchSubmit} className="max-w-xs flex-1">
          <Input
            type="search"
            name="q"
            placeholder="Search collectors, watches…"
            aria-label="Search"
            className="w-full"
          />
        </form>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <NavWearButton ownedWatches={ownedWatches} />
              <Link href="/watch/new" aria-label="Add watch">
                <Button variant="ghost" size="icon">
                  <Plus className="h-5 w-5" aria-hidden />
                </Button>
              </Link>
              {bell}
            </>
          )}
          <UserMenu user={user} username={username} />
        </div>
      </div>
    </header>
  )
}
