'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Settings } from 'lucide-react'
import { isPublicPath } from '@/lib/constants/public-paths'

interface SlimTopNavProps {
  /** Whether viewer is authenticated — controls bell rendering */
  hasUser: boolean
  /** Pre-resolved NotificationBell Server Component element (or null when !hasUser) */
  bell: React.ReactNode
}

/**
 * SlimTopNav — mobile top chrome (<768px) per CONTEXT.md D-11.
 *
 * Composition (left → right):
 *   Horlo wordmark · Search icon · NotificationBell · Settings cog
 *
 * The `bell` prop is pre-constructed upstream in Header.tsx so that one
 * NotificationBell React element is shared by reference between SlimTopNav
 * and DesktopTopNav (RESEARCH §P-06). This Client Component stays outside
 * the Bell's `'use cache'` scope.
 *
 * Gated by `isPublicPath(pathname)` — returns null on /login, /signup, etc.
 * to prevent leaking authenticated nav chrome (T-14-04-01).
 */
export function SlimTopNav({ hasUser, bell }: SlimTopNavProps) {
  const pathname = usePathname() ?? ''
  if (isPublicPath(pathname)) return null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur md:hidden">
      <div className="container mx-auto flex h-12 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-xl">Horlo</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="inline-flex h-11 w-11 items-center justify-center"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          {hasUser && bell}
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex h-11 w-11 items-center justify-center"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  )
}
