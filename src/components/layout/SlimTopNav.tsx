'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { isPublicPath } from '@/lib/constants/public-paths'
import { UserMenu } from '@/components/layout/UserMenu'

interface SlimTopNavProps {
  /** Whether viewer is authenticated — controls bell rendering */
  hasUser: boolean
  /** Pre-resolved NotificationBell Server Component element (or null when !hasUser) */
  bell: React.ReactNode
  /** Authenticated user (or null on public surfaces) — passed to UserMenu */
  user: { id: string; email: string } | null
  /** Viewer username (or null when unset) — drives the avatar Link href in UserMenu */
  username: string | null
  /** Server-loaded avatar URL (Phase 25 NAV-15 — rendered by UserMenu's AvatarDisplay) */
  avatarUrl: string | null
}

/**
 * SlimTopNav — mobile top chrome (<768px) per CONTEXT.md D-11.
 *
 * Composition (left → right):
 *   Horlo wordmark · Search icon · NotificationBell · UserMenu (avatar+chevron)
 *
 * Phase 25 (NAV-15 / D-03): the legacy Settings cog at the right edge is replaced
 * with the same `<UserMenu>` dual-affordance used by DesktopTopNav. Settings is
 * still reachable via the dropdown's Settings item — no functional loss.
 *
 * The `bell` prop is pre-constructed upstream in Header.tsx so that one
 * NotificationBell React element is shared by reference between SlimTopNav
 * and DesktopTopNav (RESEARCH §P-06). This Client Component stays outside
 * the Bell's `'use cache'` scope.
 *
 * Gated by `isPublicPath(pathname)` — returns null on /login, /signup, etc.
 * to prevent leaking authenticated nav chrome (T-14-04-01).
 */
export function SlimTopNav({
  hasUser,
  bell,
  user,
  username,
  avatarUrl,
}: SlimTopNavProps) {
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
          <UserMenu user={user} username={username} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  )
}
